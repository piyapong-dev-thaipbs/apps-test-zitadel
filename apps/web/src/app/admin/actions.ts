'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createPost, deletePost, updatePost } from '@/lib/posts';
import { PostInput } from '@/lib/types';

function parseForm(formData: FormData): PostInput {
  return {
    title: String(formData.get('title') ?? '').trim(),
    slug: String(formData.get('slug') ?? '').trim() || undefined,
    excerpt: String(formData.get('excerpt') ?? '').trim() || undefined,
    content: String(formData.get('content') ?? '').trim(),
    coverImageUrl: String(formData.get('coverImageUrl') ?? '').trim() || undefined,
    published: formData.get('published') === 'on',
  };
}

export type ActionState = { error?: string };

export async function createPostAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    await createPost(parseForm(formData));
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'เกิดข้อผิดพลาด' };
  }
  revalidatePath('/admin');
  revalidatePath('/');
  redirect('/admin');
}

export async function updatePostAction(
  id: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    await updatePost(id, parseForm(formData));
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'เกิดข้อผิดพลาด' };
  }
  revalidatePath('/admin');
  revalidatePath('/');
  redirect('/admin');
}

export async function deletePostAction(formData: FormData): Promise<void> {
  const id = String(formData.get('id'));
  await deletePost(id);
  revalidatePath('/admin');
  revalidatePath('/');
}
