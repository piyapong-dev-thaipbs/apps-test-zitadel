import { notFound } from 'next/navigation';
import { updatePostAction } from '@/app/admin/actions';
import { PostForm } from '@/components/PostForm';
import { getPostById } from '@/lib/posts';

export const dynamic = 'force-dynamic';

export default async function EditPostPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  let post;
  try {
    post = await getPostById(id);
  } catch {
    notFound();
  }

  // Bind the post id to the update action.
  const action = updatePostAction.bind(null, id);

  return (
    <div>
      <h1 className="mb-6 text-3xl font-bold tracking-tight">แก้ไขบทความ</h1>
      <PostForm action={action} post={post} submitLabel="บันทึกการแก้ไข" />
    </div>
  );
}
