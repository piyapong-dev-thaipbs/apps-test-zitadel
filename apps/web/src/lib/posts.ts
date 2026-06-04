import { apiFetch, publicFetch } from './api';
import { Post, PostInput } from './types';

// ---- Public (no auth) ----

export async function getPublishedPosts(): Promise<Post[]> {
  const res = await publicFetch('/api/posts');
  if (!res.ok) throw new Error('Failed to load posts');
  return res.json();
}

export async function getPostBySlug(slug: string): Promise<Post | null> {
  const res = await publicFetch(`/api/posts/${encodeURIComponent(slug)}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error('Failed to load post');
  return res.json();
}

// ---- Admin (auth + 'admin' role, server-side only) ----

export async function getAllPosts(): Promise<Post[]> {
  const res = await apiFetch('/api/posts/admin/all');
  if (!res.ok) throw new Error(await errorMessage(res, 'load posts'));
  return res.json();
}

export async function getPostById(id: string): Promise<Post> {
  const res = await apiFetch(`/api/posts/admin/${id}`);
  if (!res.ok) throw new Error(await errorMessage(res, 'load post'));
  return res.json();
}

export async function createPost(input: PostInput): Promise<Post> {
  const res = await apiFetch('/api/posts', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(await errorMessage(res, 'create post'));
  return res.json();
}

export async function updatePost(
  id: string,
  input: Partial<PostInput>,
): Promise<Post> {
  const res = await apiFetch(`/api/posts/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(await errorMessage(res, 'update post'));
  return res.json();
}

export async function deletePost(id: string): Promise<void> {
  const res = await apiFetch(`/api/posts/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error(await errorMessage(res, 'delete post'));
}

async function errorMessage(res: Response, action: string): Promise<string> {
  try {
    const data = await res.json();
    const msg = Array.isArray(data.message)
      ? data.message.join(', ')
      : data.message;
    return `Failed to ${action} (${res.status}): ${msg ?? 'unknown error'}`;
  } catch {
    return `Failed to ${action} (${res.status})`;
  }
}
