# Next.js frontend — ZITADEL OAuth client

This side runs the **Authorization Code + PKCE** login and **holds the tokens**.
It uses **Auth.js (NextAuth v5)**, which has a built-in ZITADEL provider and
handles PKCE, the code/token exchange, and encrypted session cookies for you.

> Uses the App Router and Auth.js v5 (`next-auth@^5`). If the project is on
> NextAuth v4 / Pages Router, the concepts are identical but the file layout
> differs — see the note at the end.

## 1. Install

```bash
npm install next-auth@beta
```

## 2. The Auth.js config — `auth.ts` (project root)

The two non-obvious parts are the **scope string** (it must request the audience
scope so the NestJS API will accept the token) and the **callbacks** (you must
persist the `access_token` into the session so you can forward it to the API).

```ts
// auth.ts
import NextAuth from "next-auth";
import ZITADEL from "next-auth/providers/zitadel";

const DOMAIN = process.env.ZITADEL_DOMAIN!;
const PROJECT_ID = process.env.ZITADEL_PROJECT_ID!;

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    ZITADEL({
      issuer: DOMAIN,
      clientId: process.env.ZITADEL_CLIENT_ID!,
      clientSecret: process.env.ZITADEL_CLIENT_SECRET!, // required by Auth.js even for PKCE
      authorization: {
        params: {
          // openid/profile/email -> basic identity
          // offline_access       -> refresh tokens
          // ...:aud scope         -> puts the API into the token audience (CRITICAL)
          // ...:roles             -> include ZITADEL roles for authorization
          scope: [
            "openid",
            "profile",
            "email",
            "offline_access",
            `urn:zitadel:iam:org:project:id:${PROJECT_ID}:aud`,
            "urn:zitadel:iam:org:projects:roles",
          ].join(" "),
        },
      },
    }),
  ],
  session: { strategy: "jwt" },
  callbacks: {
    // Runs at sign-in (account present) and on every session read.
    async jwt({ token, account }) {
      if (account) {
        // First login: stash the tokens on the NextAuth JWT.
        token.accessToken = account.access_token;
        token.refreshToken = account.refresh_token;
        token.expiresAt = account.expires_at; // unix seconds
        return token;
      }
      // Still valid? return as-is.
      if (token.expiresAt && Date.now() < (token.expiresAt as number) * 1000) {
        return token;
      }
      // Expired -> try to refresh (see section 5).
      return refreshZitadelToken(token);
    },
    async session({ session, token }) {
      // Expose what the UI / API-forwarding layer needs.
      (session as any).accessToken = token.accessToken;
      (session as any).error = (token as any).error;
      return session;
    },
  },
});
```

## 3. The route handler — `app/api/auth/[...nextauth]/route.ts`

```ts
// app/api/auth/[...nextauth]/route.ts
import { handlers } from "@/auth";
export const { GET, POST } = handlers;
```

This is what makes the redirect URI
`http://localhost:3000/api/auth/callback/zitadel` resolve — it must match the
Redirect URI you set in the ZITADEL Console exactly.

## 4. Login / logout UI

```tsx
// app/components/AuthButtons.tsx
import { signIn, signOut, auth } from "@/auth";

export async function AuthButtons() {
  const session = await auth();
  if (!session) {
    return (
      <form action={async () => { "use server"; await signIn("zitadel"); }}>
        <button type="submit">Sign in with ZITADEL</button>
      </form>
    );
  }
  return (
    <form action={async () => { "use server"; await signOut(); }}>
      <span>{session.user?.email}</span>
      <button type="submit">Sign out</button>
    </form>
  );
}
```

For **federated logout** (ending the ZITADEL session too, not just the local
cookie), redirect the browser to ZITADEL's end-session endpoint after
`signOut()`:
```
{ZITADEL_DOMAIN}/oidc/v1/end_session?post_logout_redirect_uri={your_url}&id_token_hint={id_token}
```
Capture the `id_token` in the `jwt` callback (`account.id_token`) if you need
the `id_token_hint`. Register the `post_logout_redirect_uri` in the Console.

## 5. Token refresh

When the access token expires, exchange the refresh token for a new one. This
requires the `offline_access` scope (section 2) and refresh tokens enabled in
the Console.

```ts
// auth.ts (helper used by the jwt callback)
async function refreshZitadelToken(token: any) {
  try {
    const res = await fetch(`${process.env.ZITADEL_DOMAIN}/oauth/v2/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: token.refreshToken as string,
        client_id: process.env.ZITADEL_CLIENT_ID!,
        client_secret: process.env.ZITADEL_CLIENT_SECRET!,
      }),
    });
    const data = await res.json();
    if (!res.ok) throw data;
    return {
      ...token,
      accessToken: data.access_token,
      // ZITADEL may rotate the refresh token — keep the new one if present.
      refreshToken: data.refresh_token ?? token.refreshToken,
      expiresAt: Math.floor(Date.now() / 1000) + data.expires_in,
      error: undefined,
    };
  } catch {
    // Force re-login on next protected access.
    return { ...token, error: "RefreshAccessTokenError" };
  }
}
```

If `session.error === "RefreshAccessTokenError"`, send the user back through
`signIn("zitadel")`.

## 6. Forwarding the token to the NestJS API (the whole point)

Always attach the access token as a `Bearer` header. Do this **server-side**
(Server Component / Route Handler / Server Action) so the token never touches
the browser.

```ts
// app/lib/api.ts  — server-only helper
import { auth } from "@/auth";

export async function apiFetch(path: string, init: RequestInit = {}) {
  const session = await auth();
  const token = (session as any)?.accessToken;
  if (!token) throw new Error("Not authenticated");

  return fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}${path}`, {
    ...init,
    headers: {
      ...init.headers,
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    cache: "no-store",
  });
}
```

```tsx
// app/profile/page.tsx — example consumer
import { apiFetch } from "@/app/lib/api";

export default async function Profile() {
  const res = await apiFetch("/api/v1/me");
  if (res.status === 401) return <p>Session expired — please sign in again.</p>;
  const data = await res.json();
  return <pre>{JSON.stringify(data, null, 2)}</pre>;
}
```

If you must call the API from the **browser** (client component), route through
a thin Next.js Route Handler that uses `apiFetch` internally — that keeps the
raw access token on the server.

## 7. Protecting frontend routes

Use middleware to gate pages that require login:

```ts
// middleware.ts
export { auth as middleware } from "@/auth";

export const config = {
  matcher: ["/profile/:path*", "/dashboard/:path*"], // protected paths
};
```

## Common failures on this side

- **`redirect_uri mismatch`** — the callback URL must match the Console value
  byte-for-byte, including `http`/`https` and trailing path.
- **API returns 401 despite being logged in** — the audience scope
  (`urn:zitadel:iam:org:project:id:{PROJECT_ID}:aud`) is missing from `scope`,
  so the token isn't scoped to the API. This is the most common decoupled bug.
- **`offline_access` ignored** — refresh tokens aren't enabled in the Console
  app's Token Settings.
- **Auth.js "clientSecret required"** — generate a random secret in the Console
  app even though PKCE conceptually doesn't need one; Auth.js validates its
  presence.

## NextAuth v4 / Pages Router note

The provider, scope string, and callbacks are identical. Differences: config
lives in `pages/api/auth/[...nextauth].ts` wrapped in `NextAuth({...})`; you read
the session with `getServerSession(authOptions)` instead of `auth()`; the
callback path is `/api/auth/callback/zitadel` (same as v5).
