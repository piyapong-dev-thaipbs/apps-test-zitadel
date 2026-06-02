import Link from 'next/link';
import { DeletePostButton } from '@/components/DeletePostButton';
import { getAllPosts } from '@/lib/posts';
import { Post } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  let posts: Post[] = [];
  let error: string | null = null;

  try {
    posts = await getAllPosts();
  } catch (err) {
    error =
      err instanceof Error
        ? err.message
        : 'ไม่สามารถโหลดบทความได้ (ต้องมี role "admin" ใน ZITADEL)';
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">จัดการบทความ</h1>
        <Link
          href="/admin/new"
          className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500"
        >
          + สร้างบทความ
        </Link>
      </div>

      {error && (
        <p className="rounded-md bg-red-50 p-4 text-sm text-red-700">{error}</p>
      )}

      {!error && (
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">หัวข้อ</th>
                <th className="px-4 py-3 font-medium">สถานะ</th>
                <th className="px-4 py-3 font-medium">วันที่</th>
                <th className="px-4 py-3 text-right font-medium">จัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {posts.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-slate-400">
                    ยังไม่มีบทความ
                  </td>
                </tr>
              )}
              {posts.map((post) => (
                <tr key={post.id}>
                  <td className="px-4 py-3">
                    <span className="font-medium text-slate-900">
                      {post.title}
                    </span>
                    <span className="block text-xs text-slate-400">
                      /{post.slug}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {post.published ? (
                      <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                        เผยแพร่
                      </span>
                    ) : (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                        ฉบับร่าง
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-500">
                    {new Date(post.createdAt).toLocaleDateString('th-TH')}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-4">
                      <Link
                        href={`/admin/${post.id}/edit`}
                        className="text-sm font-medium text-indigo-600 hover:underline"
                      >
                        แก้ไข
                      </Link>
                      <DeletePostButton id={post.id} title={post.title} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
