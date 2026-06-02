import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { desc, eq } from 'drizzle-orm';
import type { AuthUser } from '../auth/jwt.strategy';
import { DRIZZLE, type DrizzleDB } from '../db/drizzle.module';
import { Post, posts } from '../db/schema';
import { CreatePostDto } from './dto/create-post.dto';
import { UpdatePostDto } from './dto/update-post.dto';

@Injectable()
export class PostsService {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  /** Public listing — published posts only, newest first. */
  findAllPublished(): Promise<Post[]> {
    return this.db
      .select()
      .from(posts)
      .where(eq(posts.published, true))
      .orderBy(desc(posts.createdAt));
  }

  /** Admin listing — every post including drafts. */
  findAllAdmin(): Promise<Post[]> {
    return this.db.select().from(posts).orderBy(desc(posts.createdAt));
  }

  async findBySlug(slug: string): Promise<Post> {
    const [post] = await this.db
      .select()
      .from(posts)
      .where(eq(posts.slug, slug))
      .limit(1);
    if (!post || !post.published) throw new NotFoundException('Post not found');
    return post;
  }

  async findById(id: string): Promise<Post> {
    const [post] = await this.db
      .select()
      .from(posts)
      .where(eq(posts.id, id))
      .limit(1);
    if (!post) throw new NotFoundException('Post not found');
    return post;
  }

  async create(dto: CreatePostDto, author: AuthUser): Promise<Post> {
    const slug = dto.slug?.trim() || slugify(dto.title);
    await this.ensureSlugFree(slug);

    const [post] = await this.db
      .insert(posts)
      .values({
        title: dto.title,
        slug,
        excerpt: dto.excerpt,
        content: dto.content,
        coverImageUrl: dto.coverImageUrl,
        published: dto.published ?? false,
        authorSub: author.sub,
        authorName: author.username ?? author.email,
      })
      .returning();
    return post;
  }

  async update(id: string, dto: UpdatePostDto): Promise<Post> {
    await this.findById(id); // 404 if missing

    const slug = dto.slug?.trim() || (dto.title ? slugify(dto.title) : undefined);
    if (slug) await this.ensureSlugFree(slug, id);

    const [post] = await this.db
      .update(posts)
      .set({
        ...(dto.title !== undefined && { title: dto.title }),
        ...(slug !== undefined && { slug }),
        ...(dto.excerpt !== undefined && { excerpt: dto.excerpt }),
        ...(dto.content !== undefined && { content: dto.content }),
        ...(dto.coverImageUrl !== undefined && {
          coverImageUrl: dto.coverImageUrl,
        }),
        ...(dto.published !== undefined && { published: dto.published }),
        updatedAt: new Date(),
      })
      .where(eq(posts.id, id))
      .returning();
    return post;
  }

  async remove(id: string): Promise<{ id: string }> {
    const [deleted] = await this.db
      .delete(posts)
      .where(eq(posts.id, id))
      .returning({ id: posts.id });
    if (!deleted) throw new NotFoundException('Post not found');
    return deleted;
  }

  private async ensureSlugFree(slug: string, exceptId?: string): Promise<void> {
    const [existing] = await this.db
      .select({ id: posts.id })
      .from(posts)
      .where(eq(posts.slug, slug))
      .limit(1);
    if (existing && existing.id !== exceptId) {
      throw new ConflictException(`Slug "${slug}" is already in use`);
    }
  }
}

/** Lowercase, hyphenated slug. Keeps unicode letters (incl. Thai) and digits. */
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '');
}
