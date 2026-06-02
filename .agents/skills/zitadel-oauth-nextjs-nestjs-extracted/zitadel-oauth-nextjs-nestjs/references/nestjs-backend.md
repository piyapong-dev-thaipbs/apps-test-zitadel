# NestJS backend — ZITADEL OAuth resource server

This side **never logs anyone in**. It receives requests carrying
`Authorization: Bearer <access_token>` from the Next.js frontend and **validates
the token** on every request. Pick ONE of the two strategies below (decided in
SKILL.md). Both end with a guard you apply to controllers.

The resource server must always check, at minimum: **signature/validity**,
**issuer** (`iss` = your ZITADEL domain), **audience** (`aud` contains this
API), and **expiry**.

---

## Strategy A — Local JWT validation via JWKS (fast)

Validates the JWT locally against ZITADEL's public keys (`/oauth/v2/keys`),
fetched and cached automatically. No per-request network call. Requires the
frontend app to issue **JWT** access tokens (Console → Token Settings).

### Install

```bash
npm install @nestjs/passport passport passport-jwt jwks-rsa
npm install -D @types/passport-jwt
```

### The strategy — `src/auth/jwt.strategy.ts`

```ts
import { Injectable } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import { passportJwtSecret } from "jwks-rsa";

const DOMAIN = process.env.ZITADEL_DOMAIN!;        // e.g. https://x.zitadel.cloud
const API_CLIENT_ID = process.env.ZITADEL_API_CLIENT_ID!;

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, "zitadel-jwt") {
  constructor() {
    super({
      // Pull the bearer token off the Authorization header.
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      // Fetch + cache ZITADEL's signing keys; verify the RS256 signature.
      secretOrKeyProvider: passportJwtSecret({
        cache: true,
        rateLimit: true,
        jwksRequestsPerMinute: 5,
        jwksUri: `${DOMAIN}/oauth/v2/keys`,
      }),
      issuer: DOMAIN,           // reject tokens from other issuers
      audience: API_CLIENT_ID,  // reject tokens not scoped to this API
      algorithms: ["RS256"],    // ZITADEL default signing alg
    });
  }

  // Return value becomes request.user. Shape it to what controllers need.
  async validate(payload: any) {
    return {
      sub: payload.sub,
      email: payload.email,
      username: payload["preferred_username"],
      // ZITADEL project roles claim:
      roles: payload["urn:zitadel:iam:org:project:roles"] ?? {},
    };
  }
}
```

> Audience note: depending on token settings the API may appear in `aud` as the
> API app's Client ID or as the project. If you get `jwt audience invalid`,
> log the decoded `aud` and set `audience` to whatever value ZITADEL actually
> put there (often the API app Client ID). You can also pass an array.

### The guard — `src/auth/jwt-auth.guard.ts`

```ts
import { Injectable } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";

@Injectable()
export class JwtAuthGuard extends AuthGuard("zitadel-jwt") {}
```

Skip to **"Wire it up"** below.

---

## Strategy B — Token introspection (revocable, zero-trust)

Calls ZITADEL's `/oauth/v2/introspect` to ask "is this token still active?" on
each request. Works with opaque OR JWT tokens and supports instant revocation.
Authenticate the introspection call with the API app's **Private Key JWT**
(recommended) — download the key JSON from the Console (API app → New key →
JSON).

### Install

```bash
npm install @nestjs/passport passport passport-http-bearer jose
npm install -D @types/passport-http-bearer
```

### Build the client-assertion + introspect — `src/auth/introspection.ts`

```ts
import { readFileSync } from "fs";
import { SignJWT, importPKCS8 } from "jose";

const DOMAIN = process.env.ZITADEL_DOMAIN!;
const keyFile = JSON.parse(
  readFileSync(process.env.ZITADEL_INTROSPECTION_KEY_PATH!, "utf8"),
);
// keyFile fields from ZITADEL: { type, keyId, key (PEM), clientId, ... }

// Build a short-lived JWT signed with the API app's private key (client_assertion).
async function buildClientAssertion(): Promise<string> {
  const privateKey = await importPKCS8(keyFile.key, "RS256");
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({})
    .setProtectedHeader({ alg: "RS256", kid: keyFile.keyId })
    .setIssuer(keyFile.clientId)
    .setSubject(keyFile.clientId)
    .setAudience(DOMAIN)        // audience = the ZITADEL issuer
    .setIssuedAt(now)
    .setExpirationTime(now + 60)
    .sign(privateKey);
}

export async function introspect(token: string): Promise<any | null> {
  const assertion = await buildClientAssertion();
  const res = await fetch(`${DOMAIN}/oauth/v2/introspect`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_assertion_type:
        "urn:ietf:params:oauth:client-assertion-type:jwt-bearer",
      client_assertion: assertion,
      token,
    }),
  });
  if (!res.ok) return null;
  const data = await res.json();
  // ZITADEL returns { active: boolean, sub, aud, ...claims } — active gates all.
  return data.active ? data : null;
}
```

> Cache introspection results briefly (e.g. 30–60s keyed by token hash) to avoid
> hitting ZITADEL on every single request while still honoring revocation
> quickly. A simple in-memory LRU is enough for one instance; use Redis if you
> run multiple.
>
> Simpler alternative auth: instead of Private Key JWT you can use **Basic
> auth** with the API app's `client_id:client_secret` (set
> `Authorization: Basic base64(id:secret)` on the introspect call and drop the
> assertion). Private Key JWT is the recommended, more secure option.

### The strategy — `src/auth/introspection.strategy.ts`

```ts
import { Injectable, UnauthorizedException } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { Strategy } from "passport-http-bearer";
import { introspect } from "./introspection";

@Injectable()
export class IntrospectionStrategy extends PassportStrategy(
  Strategy,
  "zitadel-introspect",
) {
  async validate(token: string) {
    const claims = await introspect(token);
    if (!claims) throw new UnauthorizedException();
    return {
      sub: claims.sub,
      email: claims.email,
      username: claims["username"] ?? claims["preferred_username"],
      roles: claims["urn:zitadel:iam:org:project:roles"] ?? {},
    };
  }
}
```

### The guard — `src/auth/jwt-auth.guard.ts`

```ts
import { Injectable } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";

@Injectable()
export class JwtAuthGuard extends AuthGuard("zitadel-introspect") {}
```

---

## Wire it up (both strategies)

### Auth module — `src/auth/auth.module.ts`

```ts
import { Module } from "@nestjs/common";
import { PassportModule } from "@nestjs/passport";
// import ONE of the two strategies you chose:
import { JwtStrategy } from "./jwt.strategy";              // Strategy A
// import { IntrospectionStrategy } from "./introspection.strategy"; // Strategy B

@Module({
  imports: [PassportModule],
  providers: [JwtStrategy /* or IntrospectionStrategy */],
  exports: [PassportModule],
})
export class AuthModule {}
```

### Protect a route — `src/app.controller.ts`

```ts
import { Controller, Get, Req, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "./auth/jwt-auth.guard";

@Controller("api/v1")
export class AppController {
  @UseGuards(JwtAuthGuard)
  @Get("me")
  me(@Req() req: any) {
    return req.user; // the object returned from validate()
  }
}
```

To protect everything by default and opt routes *out*, register the guard
globally and add a `@Public()` decorator + a custom guard that checks for it —
mirror the pattern from NestJS docs on global guards.

## Role-based authorization (optional)

ZITADEL roles arrive under `urn:zitadel:iam:org:project:roles` as an object
keyed by role name. A simple roles guard:

```ts
import { CanActivate, ExecutionContext, Injectable, SetMetadata } from "@nestjs/common";
import { Reflector } from "@nestjs/core";

export const Roles = (...roles: string[]) => SetMetadata("roles", roles);

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}
  canActivate(ctx: ExecutionContext): boolean {
    const required = this.reflector.get<string[]>("roles", ctx.getHandler());
    if (!required?.length) return true;
    const { user } = ctx.switchToHttp().getRequest();
    const granted = Object.keys(user?.roles ?? {});
    return required.some((r) => granted.includes(r));
  }
}
```
Use as `@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles("admin")`.

## CORS + headers — `src/main.ts`

The API and frontend are on different origins, so CORS must allow the frontend
origin and the `Authorization` header.

```ts
import { NestFactory } from "@nestjs/core";
import helmet from "helmet";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.use(helmet());
  app.enableCors({
    origin: process.env.FRONTEND_ORIGIN ?? "http://localhost:3000",
    allowedHeaders: ["Authorization", "Content-Type"],
    credentials: true,
  });
  await app.listen(process.env.PORT ?? 4000);
}
bootstrap();
```

## Test it

```bash
# No token -> 401
curl -i http://localhost:4000/api/v1/me

# Real token (grab one from a logged-in frontend session) -> 200 + user JSON
curl -i http://localhost:4000/api/v1/me -H "Authorization: Bearer $JWT"
```

## Common failures on this side

- **`401` with a valid-looking token** — audience mismatch. The frontend isn't
  sending the `...:{PROJECT_ID}:aud` scope, so the API isn't in `aud`. Fix it on
  the *frontend* (see `nextjs-frontend.md`), or relax/inspect the `audience`
  check here.
- **`jwt malformed` / signature errors (Strategy A)** — the frontend app is
  issuing **opaque** tokens, not JWT. Either switch its Token Settings to JWT,
  or use Strategy B (introspection), which handles opaque tokens.
- **Issuer mismatch** — `ZITADEL_DOMAIN` differs between front and back (often a
  trailing slash). Make them identical.
- **CORS error in the browser** — the `Authorization` header isn't in
  `allowedHeaders`, or the origin isn't whitelisted.
- **Introspection 401 from ZITADEL (Strategy B)** — the client assertion's
  `aud` must be the issuer, signed with the API app's private key, `kid` must
  match the downloaded key's `keyId`.
