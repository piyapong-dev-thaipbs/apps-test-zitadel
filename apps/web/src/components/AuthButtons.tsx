import Link from 'next/link';
import { auth, signIn, signOut } from '@/auth';

export async function AuthButtons() {
  const session = await auth();

  if (!session) {
    return (
      <form
        action={async () => {
          'use server';
          await signIn('zitadel', { redirectTo: '/admin' });
        }}
      >
        <button
          type="submit"
          className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-500"
        >
          เข้าสู่ระบบ
        </button>
      </form>
    );
  }

  return (
    <div className="flex items-center gap-3 text-sm">
      <Link href="/admin" className="font-medium text-indigo-600 hover:underline">
        Admin
      </Link>
      <span className="hidden text-slate-500 sm:inline">
        {session.user?.email ?? session.user?.name}
      </span>
      <form
        action={async () => {
          'use server';
          await signOut({ redirectTo: '/' });
        }}
      >
        <button
          type="submit"
          className="rounded-md border border-slate-300 px-3 py-1.5 font-medium text-slate-700 hover:bg-slate-100"
        >
          ออกจากระบบ
        </button>
      </form>
    </div>
  );
}
