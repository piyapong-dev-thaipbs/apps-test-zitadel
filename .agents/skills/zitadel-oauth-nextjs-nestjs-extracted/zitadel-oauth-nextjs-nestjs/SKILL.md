---
name: zitadel-oauth-nextjs-nestjs
description: >-
  Wire up ZITADEL OAuth 2.0 / OIDC authentication for a DECOUPLED app where the
  frontend is Next.js and the backend is a separate NestJS API. The Next.js app
  is the OAuth client (Authorization Code + PKCE login via Auth.js/NextAuth) and
  the NestJS app is an OAuth 2.0 resource server that validates bearer tokens.
  Use this skill whenever the user mentions ZITADEL, OIDC, OAuth, PKCE, SSO,
  "login", "auth", access tokens, JWT validation, token introspection, or
  protecting API routes — AND the stack involves Next.js calling a NestJS API
  (or any "frontend + separate backend API" split). Trigger even if the user
  only names one side ("add ZITADEL login to my Next.js app" or "validate
  ZITADEL tokens in NestJS"), because the two halves must agree on audience,
  scopes, and token format.
---

# ZITADEL OAuth: Next.js frontend + NestJS backend API

## The one thing that trips everyone up

The official ZITADEL Next.js and NestJS examples are each **standalone
full-stack apps** that run the *entire* login flow themselves. This skill is
for a **different, decoupled architecture**: a Next.js frontend talking to a
*separate* NestJS API. The responsibilities split cleanly, and copying the
standalone examples verbatim will not work.

```
┌──────────────────────┐   1. PKCE login (browser ⇄ ZITADEL)   ┌──────────────┐
│   Next.js frontend   │ ─────────────────────────────────────▶│   ZITADEL    │
│   (OAuth CLIENT)     │ ◀───────────────────────────────────── │ (Auth server)│
│   Auth.js / NextAuth │   2. id_token + access_token + refresh └──────────────┘
└──────────┬───────────┘                                               ▲
           │ 3. fetch() with                                           │
           │    Authorization: Bearer <access_token>      4. validate  │
           ▼                                                 token      │
┌──────────────────────┐ ──────────────────────────────────────────────┘
│   NestJS backend API │   (JWKS local verify  OR  /oauth/v2/introspect)
│   (RESOURCE SERVER)  │
└──────────────────────┘
```

- The **frontend** logs the user in and **holds** the tokens. It never validates them.
- The **backend** never logs anyone in. It only **validates** the bearer token on each request.

If you only read one thing, read **"Make the two halves agree"** below — it is
where decoupled setups actually break.

## Pick the backend validation strategy first

This decision shapes both ZITADEL config and the NestJS code. Confirm it with
the user before writing code.

| Strategy | When to use | Trade-off |
|---|---|---|
| **Local JWT validation (JWKS)** | High-throughput APIs; you control the ZITADEL app and can set tokens to JWT | Fast (no network call per request), but tokens can't be revoked instantly — they stay valid until expiry |
| **Token introspection** | You need instant revocation, or tokens are opaque, or zero-trust requirements | One network call to ZITADEL per request (cache it); works with both opaque and JWT tokens |

Default recommendation: **local JWKS validation** for most APIs; switch to
**introspection** when instant revocation matters. ZITADEL's own guidance is
that introspection gives stronger, centralized control while JWKS gives speed.

## ZITADEL Console setup

You need **two** ZITADEL applications inside one project (the shared project is
what ties their audiences together):

1. **The frontend app** — type **Web**, auth method **PKCE**.
   - Redirect URI (dev): `http://localhost:3000/api/auth/callback/zitadel`
   - Post-logout redirect URI (dev): `http://localhost:3000`
   - Enable **Dev Mode** for local HTTP. Turn it off and use HTTPS in production.
   - In **Token Settings**, enable refresh tokens if you want long-lived sessions
     (requires the `offline_access` scope), and choose the access-token type:
     - For **JWKS** backend validation → set access token type to **JWT**.
     - For **introspection** → either type works; opaque is fine.

2. **The backend API app** — type **API**.
   - Auth method **JWT (Private Key)** if using introspection (download the key
     JSON), or just note the **Client ID** if using JWKS.
   - This app's identity is what the access token must be **audience**-scoped to.

Copy the instance domain (the **issuer**, e.g.
`https://your-instance.zitadel.cloud`), the frontend **Client ID**, and the
**Project ID** (you'll need it for the audience scope).

Key ZITADEL endpoints (all relative to the instance domain):
- Discovery: `/.well-known/openid-configuration`
- Authorization: `/oauth/v2/authorize`  ·  Token: `/oauth/v2/token`
- JWKS (public keys): `/oauth/v2/keys`
- Introspection: `/oauth/v2/introspect`
- UserInfo: `/oidc/v1/userinfo`  ·  End session: `/oidc/v1/end_session`

## Make the two halves agree (the part that actually breaks)

A token the frontend gets is useless to the backend unless three things line up.
When you get a `401`/`invalid audience` from the API, it is almost always one of
these:

1. **Audience.** The access token must list the backend API as an audience, or
   the resource server will reject it. ZITADEL does **not** add other apps to the
   audience automatically. The frontend must request the reserved scope that
   injects the project (and thus the API app) into the token audience:
   ```
   urn:zitadel:iam:org:project:id:{PROJECT_ID}:aud
   ```
   Add this to the frontend's `scope` string. The backend then validates its own
   Client ID / project ID against the token's `aud`.

2. **Token format.** If the backend does **JWKS** validation, the frontend's app
   must be configured to issue **JWT** access tokens (Console → frontend app →
   Token Settings). If the backend does **introspection**, the format doesn't
   matter — introspection accepts opaque or JWT.

3. **Issuer.** Both sides use the *same* instance domain as `issuer`. The backend
   validates `iss` against it. A trailing-slash mismatch here is a classic bug.

Recommended frontend scope string:
```
openid profile email offline_access urn:zitadel:iam:org:project:id:{PROJECT_ID}:aud
```
Add `urn:zitadel:iam:org:projects:roles` too if you want role claims for
authorization checks. ZITADEL surfaces roles under the claim
`urn:zitadel:iam:org:project:roles`.

## Build order

1. Configure both ZITADEL apps as above.
2. Build the **frontend** login + token forwarding → read
   **`references/nextjs-frontend.md`**.
3. Build the **backend** resource server with the chosen strategy → read
   **`references/nestjs-backend.md`**.
4. End-to-end test: log in via Next.js, then have it call a protected NestJS
   route. Verify a missing/garbage token gives `401` and a real one gives `200`.

Read the relevant reference file fully before writing code for that side — each
contains complete, working configuration including env vars, the auth wiring,
guards/strategies, refresh handling, and logout.

## Environment variables (shared shape)

Frontend (`.env.local`):
```
ZITADEL_DOMAIN=https://your-instance.zitadel.cloud
ZITADEL_CLIENT_ID=your-frontend-client-id
ZITADEL_CLIENT_SECRET=generate-a-random-secret      # Auth.js requires one even for PKCE
ZITADEL_PROJECT_ID=your-project-id                  # for the audience scope
AUTH_SECRET=generate-with-openssl-rand               # session/JWT cookie encryption
NEXTAUTH_URL=http://localhost:3000
NEXT_PUBLIC_API_BASE_URL=http://localhost:4000       # where the NestJS API lives
```

Backend (`.env`):
```
ZITADEL_DOMAIN=https://your-instance.zitadel.cloud   # = issuer
ZITADEL_API_CLIENT_ID=your-api-app-client-id         # for audience check (JWKS) / introspection (basic)
# Introspection-only extras:
ZITADEL_INTROSPECTION_KEY_PATH=./api-key.json        # if using Private Key JWT
PORT=4000
```

Generate secrets with:
`node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`

## Security checklist (don't skip)

- Store tokens in **HTTP-only, Secure, SameSite** cookies on the frontend; never
  expose the access token to client-side JS unless a call genuinely needs it.
- Always validate **issuer + audience + expiry + signature** on the backend.
- Use HTTPS and disable ZITADEL **Dev Mode** in production.
- Add security headers on the NestJS side (`helmet`).
- Lock CORS on the API to the frontend origin only; allow the `Authorization`
  header.
- Prefer `offline_access` + silent refresh over long-lived access tokens.
