'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import type { ActionState } from '@/app/admin/actions';
import { Post } from '@/lib/types';

type FormAction = (
  prev: ActionState,
  formData: FormData,
) => Promise<ActionState>;

export function PostForm({
  action,
  post,
  submitLabel,
}: {
  action: FormAction;
  post?: Post;
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState(action, {});

  return (
    <form action={formAction} className="space-y-5">
      {state.error && (
        <p className="rounded-md bg-red-50 p-3 text-sm text-red-700">
          {state.error}
        </p>
      )}

      <Field label="หัวข้อ *">
        <input
          name="title"
          required
          defaultValue={post?.title}
          className={inputClass}
        />
      </Field>

      <Field label="Slug (เว้นว่างเพื่อสร้างอัตโนมัติ)">
        <input name="slug" defaultValue={post?.slug} className={inputClass} />
      </Field>

      <Field label="คำโปรย (excerpt)">
        <textarea
          name="excerpt"
          rows={2}
          defaultValue={post?.excerpt ?? ''}
          className={inputClass}
        />
      </Field>

      <Field label="เนื้อหา *">
        <textarea
          name="content"
          required
          rows={12}
          defaultValue={post?.content}
          className={inputClass}
        />
      </Field>

      <Field label="URL รูปปก">
        <input
          name="coverImageUrl"
          defaultValue={post?.coverImageUrl ?? ''}
          className={inputClass}
        />
      </Field>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="published"
          defaultChecked={post?.published ?? false}
          className="h-4 w-4 rounded border-slate-300"
        />
        เผยแพร่ (published)
      </label>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
        >
          {pending ? 'กำลังบันทึก...' : submitLabel}
        </button>
        <Link
          href="/admin"
          className="text-sm font-medium text-slate-600 hover:underline"
        >
          ยกเลิก
        </Link>
      </div>
    </form>
  );
}

const inputClass =
  'w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500';

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-slate-700">
        {label}
      </span>
      {children}
    </label>
  );
}
