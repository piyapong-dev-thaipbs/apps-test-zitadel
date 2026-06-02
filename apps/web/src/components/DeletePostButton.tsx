'use client';

import { deletePostAction } from '@/app/admin/actions';

export function DeletePostButton({ id, title }: { id: string; title: string }) {
  return (
    <form
      action={deletePostAction}
      onSubmit={(e) => {
        if (!confirm(`ลบบทความ "${title}" ?`)) e.preventDefault();
      }}
    >
      <input type="hidden" name="id" value={id} />
      <button
        type="submit"
        className="text-sm font-medium text-red-600 hover:underline"
      >
        ลบ
      </button>
    </form>
  );
}
