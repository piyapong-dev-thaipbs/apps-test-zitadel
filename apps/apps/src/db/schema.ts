import { sql } from 'drizzle-orm';
import { boolean, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

/**
 * Blog posts table. `id` uses Postgres' built-in `gen_random_uuid()`
 * (available on Postgres 13+). `slug` is unique and used for public URLs.
 */
export const posts = pgTable('posts', {
  id: uuid('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  title: text('title').notNull(),
  slug: text('slug').notNull().unique(),
  excerpt: text('excerpt'),
  content: text('content').notNull(),
  coverImageUrl: text('cover_image_url'),
  published: boolean('published').notNull().default(false),
  // ZITADEL identity of the author (from the access token `sub`).
  authorSub: text('author_sub'),
  authorName: text('author_name'),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type Post = typeof posts.$inferSelect;
export type NewPost = typeof posts.$inferInsert;
