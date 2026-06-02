import NextAuth, { type NextAuthResult } from 'next-auth';
import ZITADEL from 'next-auth/providers/zitadel';

const DOMAIN = process.env.ZITADEL_DOMAIN as string;
const PROJECT_ID = process.env.ZITADEL_PROJECT_ID as string;

/**
 * Exchange the refresh token for a fresh access token when the current one
 * expires. Requires the `offline_access` scope + refresh tokens enabled in the
 * ZITADEL Console.
 */
async function refreshZitadelToken(token: Record<string, any>) {
  try {
    const res = await fetch(`${DOMAIN}/oauth/v2/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: token.refreshToken as string,
        client_id: process.env.ZITADEL_CLIENT_ID as string,
        client_secret: process.env.ZITADEL_CLIENT_SECRET as string,
      }),
    });
    const data = await res.json();
    if (!res.ok) throw data;
    return {
      ...token,
      accessToken: data.access_token,
      refreshToken: data.refresh_token ?? token.refreshToken,
      expiresAt: Math.floor(Date.now() / 1000) + data.expires_in,
      error: undefined,
    };
  } catch {
    return { ...token, error: 'RefreshAccessTokenError' };
  }
}

const result = NextAuth({
  providers: [
    ZITADEL({
      issuer: DOMAIN,
      clientId: process.env.ZITADEL_CLIENT_ID,
      clientSecret: process.env.ZITADEL_CLIENT_SECRET, // required by Auth.js even for PKCE
      authorization: {
        params: {
          scope: [
            'openid',
            'profile',
            'email',
            'offline_access',
            // CRITICAL: puts the NestJS API into the token audience.
            `urn:zitadel:iam:org:project:id:${PROJECT_ID}:aud`,
            // Include ZITADEL project roles (for the 'admin' role check).
            'urn:zitadel:iam:org:projects:roles',
          ].join(' '),
        },
      },
    }),
  ],
  session: { strategy: 'jwt' },
  callbacks: {
    async jwt({ token, account }) {
      if (account) {
        token.accessToken = account.access_token;
        token.refreshToken = account.refresh_token;
        token.expiresAt = account.expires_at; // unix seconds
        return token;
      }
      if (token.expiresAt && Date.now() < (token.expiresAt as number) * 1000) {
        return token;
      }
      return refreshZitadelToken(token as Record<string, any>);
    },
    async session({ session, token }) {
      (session as any).accessToken = token.accessToken;
      (session as any).error = (token as any).error;
      return session;
    },
  },
});

// Explicit annotations work around Auth.js v5 + composite-project TS2742.
export const handlers: NextAuthResult['handlers'] = result.handlers;
export const auth: NextAuthResult['auth'] = result.auth;
export const signIn: NextAuthResult['signIn'] = result.signIn;
export const signOut: NextAuthResult['signOut'] = result.signOut;
