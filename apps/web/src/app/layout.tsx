import Link from 'next/link';
import { Suspense } from 'react';
import { AuthButtons } from '@/components/AuthButtons';
import './global.css';

export const metadata = {
  title: 'My Blog',
  description: 'A blog built with NestJS, Drizzle, Next.js and ZITADEL OAuth',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="th">
      <body>
        <header className="border-b border-slate-200 bg-white">
          <nav className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3">
            <Link href="/" className="text-lg font-bold text-slate-900">
              📝 My Blog
            </Link>
            <Suspense fallback={null}>
              <AuthButtons />
            </Suspense>
          </nav>
        </header>
        <main className="mx-auto max-w-4xl px-4 py-8">{children}</main>
        <footer className="mx-auto max-w-4xl px-4 py-8 text-center text-sm text-slate-400">
          Built with NestJS · Drizzle · Next.js · ZITADEL
        </footer>
      </body>
    </html>
  );
}
