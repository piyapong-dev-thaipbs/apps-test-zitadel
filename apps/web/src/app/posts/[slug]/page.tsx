import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getPostBySlug } from '@/lib/posts';

export const dynamic = 'force-dynamic';

export default async function PostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = await getPostBySlug(slug);

  if (!post) notFound();

  return (
    <article>
      <Link href="/" className="text-sm text-indigo-600 hover:underline">
        ← กลับหน้าแรก
      </Link>

      <h1 className="mt-4 text-4xl font-bold tracking-tight">{post.title}</h1>

      <div className="mt-2 flex items-center gap-2 text-sm text-slate-400">
        <span>{post.authorName ?? 'ไม่ระบุผู้เขียน'}</span>
        <span>·</span>
        <time>{new Date(post.createdAt).toLocaleDateString('th-TH')}</time>
      </div>

      {post.coverImageUrl && (
        <img
          src={post.coverImageUrl}
          alt={post.title}
          className="mt-6 w-full rounded-lg object-cover"
        />
      )}

      <div className="article-body mt-6 text-lg">{post.content}</div>
    </article>
  );
}
