import 'dotenv/config';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { NewPost, posts } from './schema';
import { slugify } from '../posts/posts.service';

/**
 * Seed sample blog posts. Run with: `npx nx db:seed @apps/apps`
 * (or `tsx src/db/seed.ts` from apps/apps). Idempotent: clears the table first.
 */
const samplePosts: Omit<NewPost, 'slug'>[] = [
  {
    title: 'ยินดีต้อนรับสู่บล็อกของเรา',
    excerpt: 'โพสต์แรกบนแพลตฟอร์มบล็อกที่สร้างด้วย NestJS, Drizzle และ Next.js',
    content:
      'นี่คือบทความตัวอย่างแรกของเรา ระบบบล็อกนี้สร้างด้วย NestJS + Drizzle ORM ' +
      'สำหรับ backend และ Next.js สำหรับ frontend โดยมีระบบ authentication ผ่าน ZITADEL OAuth\n\n' +
      'คุณสามารถอ่านบทความได้โดยไม่ต้องเข้าสู่ระบบ แต่การสร้าง แก้ไข หรือลบบทความ ' +
      'จะต้องเข้าสู่ระบบผ่านหน้า admin',
    published: true,
    authorName: 'Admin',
  },
  {
    title: 'เริ่มต้นกับ Drizzle ORM ใน NestJS',
    excerpt: 'แนวทางการเชื่อมต่อ PostgreSQL ด้วย Drizzle ORM แบบ type-safe',
    content:
      'Drizzle ORM เป็น ORM ที่เน้น type-safety และใกล้เคียงกับ SQL ' +
      'ทำให้เขียน query ได้อย่างมั่นใจ พร้อม migration ที่จัดการง่ายด้วย drizzle-kit\n\n' +
      'ในโปรเจกต์นี้เราใช้ provider ของ NestJS เพื่อ inject instance ของ Drizzle ' +
      'เข้าไปใน service ต่าง ๆ',
    published: true,
    authorName: 'Admin',
  },
  {
    title: 'ความปลอดภัยด้วย ZITADEL OAuth 2.0',
    excerpt: 'สถาปัตยกรรมแบบ decoupled: Next.js เป็น client, NestJS เป็น resource server',
    content:
      'ZITADEL ให้บริการ OAuth 2.0 / OIDC ที่ใช้งานง่าย ' +
      'ในสถาปัตยกรรมนี้ Next.js ทำหน้าที่ login ผู้ใช้และถือ token ' +
      'ส่วน NestJS ทำหน้าที่ตรวจสอบ bearer token ในทุก request ผ่าน JWKS\n\n' +
      'การแยกหน้าที่แบบนี้ทำให้ระบบขยายตัวได้ง่ายและปลอดภัย',
    published: true,
    authorName: 'Admin',
  },
  {
    title: '(ฉบับร่าง) ฟีเจอร์ที่กำลังจะมาถึง',
    excerpt: 'บทความนี้ยังไม่เผยแพร่ — จะไม่แสดงในหน้าสาธารณะ',
    content:
      'นี่คือบทความฉบับร่าง (draft) ใช้สำหรับทดสอบว่าหน้าสาธารณะแสดงเฉพาะ ' +
      'บทความที่ published = true เท่านั้น ส่วนหน้า admin จะเห็นบทความนี้ด้วย',
    published: false,
    authorName: 'Admin',
  },
];

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is not set');

  const client = postgres(url, { max: 1 });
  const db = drizzle(client);

  console.log('Clearing existing posts...');
  await db.delete(posts);

  console.log(`Inserting ${samplePosts.length} sample posts...`);
  await db.insert(posts).values(
    samplePosts.map((p) => ({ ...p, slug: slugify(p.title) })),
  );

  console.log('✅ Seed complete');
  await client.end();
}

main().catch((err) => {
  console.error('❌ Seed failed:', err);
  process.exit(1);
});
