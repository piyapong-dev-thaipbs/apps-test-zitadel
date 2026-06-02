import { createPostAction } from '@/app/admin/actions';
import { PostForm } from '@/components/PostForm';

export default function NewPostPage() {
  return (
    <div>
      <h1 className="mb-6 text-3xl font-bold tracking-tight">สร้างบทความใหม่</h1>
      <PostForm action={createPostAction} submitLabel="สร้างบทความ" />
    </div>
  );
}
