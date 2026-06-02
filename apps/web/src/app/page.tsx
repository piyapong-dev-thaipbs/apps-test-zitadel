import Link from 'next/link';
import { getPublishedPosts } from '@/lib/posts';
import { Post } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  let posts: Post[] = [];
  let error: string | null = null;

  try {
    posts = await getPublishedPosts();
  } catch {
    error = 'ไม่สามารถโหลดบทความได้ — ตรวจสอบว่า API กำลังทำงานอยู่ที่พอร์ต 4000';
  }

  return (
    <div>
      <h1 className="mb-6 text-3xl font-bold tracking-tight">บทความล่าสุด</h1>

      {error && (
        <p className="rounded-md bg-red-50 p-4 text-sm text-red-700">{error}</p>
      )}

      {!error && posts.length === 0 && (
        <p className="text-slate-500">ยังไม่มีบทความที่เผยแพร่</p>
      )}

      <div className="grid gap-6 sm:grid-cols-2">
        {posts.map((post) => (
          <article
            key={post.id}
            className="rounded-lg border border-slate-200 bg-white p-5 transition hover:shadow-md"
          >
            <Link href={`/posts/${post.slug}`} className="block">
              <h2 className="mb-2 text-xl font-semibold text-slate-900 hover:text-indigo-600">
                {post.title}
              </h2>
              {post.excerpt && (
                <p className="mb-3 line-clamp-3 text-sm text-slate-600">
                  {post.excerpt}
                </p>
              )}
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <span>{post.authorName ?? 'ไม่ระบุผู้เขียน'}</span>
                <span>·</span>
                <time>
                  {new Date(post.createdAt).toLocaleDateString('th-TH')}
                </time>
              </div>
            </Link>
          </article>
        ))}
      </div>
    </div>
  );
}
