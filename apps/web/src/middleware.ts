export { auth as middleware } from '@/auth';

// Protect the admin area — unauthenticated users get redirected to sign in.
export const config = {
  matcher: ['/admin/:path*'],
};
