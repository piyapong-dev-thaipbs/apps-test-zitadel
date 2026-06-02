# Blog Platform — NestJS + Drizzle + Postgres + Next.js + ZITADEL

เว็บบล็อกที่ประกอบด้วย 2 ส่วน:

- **`@apps/apps`** (NestJS, พอร์ต `4000`) — REST API + Drizzle ORM ต่อ PostgreSQL
  ทำหน้าที่เป็น **OAuth resource server** (validate ZITADEL bearer token แบบ JWKS)
- **`@apps/web`** (Next.js, พอร์ต `3000`) — หน้าเว็บอ่านบล็อก (สาธารณะ) + หน้า admin
  ทำหน้าที่เป็น **OAuth client** (Auth.js v5 + PKCE, ถือ token แล้วแนบไปกับ API)

```
Browser ──login(PKCE)──▶ ZITADEL ──tokens──▶ Next.js (web:3000) ──Bearer──▶ NestJS (api:4000) ──▶ Postgres
```

## API endpoints

| Method | Path                    | Auth            | คำอธิบาย                       |
| ------ | ----------------------- | --------------- | ------------------------------ |
| GET    | `/api/posts`            | —               | รายการบทความที่เผยแพร่         |
| GET    | `/api/posts/:slug`      | —               | อ่านบทความตาม slug             |
| GET    | `/api/posts/admin/all`  | admin           | ทุกบทความ (รวม draft)          |
| GET    | `/api/posts/admin/:id`  | admin           | บทความตาม id                   |
| POST   | `/api/posts`            | admin           | สร้างบทความ                    |
| PATCH  | `/api/posts/:id`        | admin           | แก้ไขบทความ                    |
| DELETE | `/api/posts/:id`        | admin           | ลบบทความ                       |
| GET    | `/api/me`               | login           | echo ข้อมูลผู้ใช้ (ทดสอบ token) |

หน้าเว็บ: `/` (รายการ), `/posts/[slug]` (อ่าน), `/admin` (จัดการ), `/admin/new`, `/admin/[id]/edit`

---

## 1. ตั้งค่า ZITADEL Console

สร้าง **1 โปรเจกต์** ที่มี **2 applications**:

1. **Web app** (type **Web**, auth method **PKCE**)
   - Redirect URI: `http://localhost:3000/api/auth/callback/zitadel`
   - Post-logout redirect URI: `http://localhost:3000`
   - เปิด **Dev Mode** (สำหรับ HTTP บน localhost)
   - **Token Settings**: ตั้ง access token เป็น **JWT** (จำเป็นสำหรับ JWKS), เปิด **refresh token**
2. **API app** (type **API**, auth method **JWT** หรือจด Client ID ไว้)

จากนั้นในโปรเจกต์ สร้าง **role ชื่อ `admin`** แล้ว grant ให้ผู้ใช้ที่จะเข้าหน้า admin

คัดลอกค่าเหล่านี้: instance domain (issuer), Web Client ID, API Client ID, Project ID

---

## 2. ตั้งค่า Environment

**Backend** — คัดลอก `apps/apps/.env.example` → `apps/apps/.env` แล้วกรอก:

```
DATABASE_URL=postgres://user:password@localhost:5432/blog
ZITADEL_DOMAIN=https://your-instance.zitadel.cloud
ZITADEL_API_CLIENT_ID=your-api-app-client-id
FRONTEND_ORIGIN=http://localhost:3000
PORT=4000
```

> backend จะ **ไม่ boot** ถ้าขาด `DATABASE_URL`, `ZITADEL_DOMAIN`, `ZITADEL_API_CLIENT_ID` (fail-fast)

**Frontend** — คัดลอก `apps/web/.env.local.example` → `apps/web/.env.local` แล้วกรอก
(สร้าง `AUTH_SECRET` ด้วย `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`)

```
ZITADEL_DOMAIN=https://your-instance.zitadel.cloud
ZITADEL_CLIENT_ID=your-frontend-client-id
ZITADEL_CLIENT_SECRET=generate-a-random-secret
ZITADEL_PROJECT_ID=your-project-id
AUTH_SECRET=<32-byte-hex>
NEXTAUTH_URL=http://localhost:3000
NEXT_PUBLIC_API_BASE_URL=http://localhost:4000
```

---

## 3. Database: migration + seed

ใช้ Postgres ที่มีอยู่ (ต้องมีสิทธิ์ `CREATE TABLE`; ฟังก์ชัน `gen_random_uuid()` มีใน Postgres 13+):

```sh
npx nx db:migrate @apps/apps   # สร้างตารางจาก apps/apps/drizzle/*.sql
npx nx db:seed @apps/apps      # ใส่บทความตัวอย่าง (3 published + 1 draft)
```

แก้ schema เมื่อไรให้ `npx nx db:generate @apps/apps` เพื่อสร้าง migration ใหม่ แล้ว `db:migrate` อีกครั้ง

---

## 4. รันโปรเจกต์

```sh
npx nx serve @apps/apps   # API → http://localhost:4000/api
npx nx dev   @apps/web    # Web → http://localhost:3000
```

---

## 5. ทดสอบ

```sh
curl http://localhost:4000/api/posts            # 200 + รายการบทความ published
curl -i http://localhost:4000/api/me            # 401 (ไม่มี token)
curl -i -X POST http://localhost:4000/api/posts # 401 (ไม่มี token)
```

- เปิด `http://localhost:3000` → เห็นรายการบทความ, คลิกเข้าอ่านได้ (ไม่ต้อง login)
- กด **เข้าสู่ระบบ** หรือเข้า `/admin` → redirect ไป ZITADEL → login → กลับมาหน้า admin
- สร้าง/แก้ไข/ลบบทความ แล้วหน้าแรกอัปเดตตาม

---

## โครงสร้างไฟล์หลัก

**Backend** (`apps/apps/src/`)
- `db/schema.ts` — ตาราง `posts` (Drizzle)
- `db/drizzle.module.ts` — provider `DRIZZLE` (`@Global`)
- `db/seed.ts` — seed บทความตัวอย่าง
- `auth/jwt.strategy.ts` — JWKS validation, `audience = ZITADEL_API_CLIENT_ID`
- `auth/jwt-auth.guard.ts`, `auth/roles.guard.ts`, `auth/roles.decorator.ts`
- `posts/` — `posts.service.ts` (CRUD ผ่าน Drizzle), `posts.controller.ts`, `dto/`
- `drizzle.config.ts`, `drizzle/` — config + migration SQL

**Frontend** (`apps/web/src/`)
- `auth.ts` — Auth.js + ZITADEL provider (scope รวม `...:aud` + roles)
- `app/api/auth/[...nextauth]/route.ts`, `middleware.ts` (กัน `/admin`)
- `lib/api.ts` — `apiFetch` แนบ Bearer token (server-side); `lib/posts.ts` — typed helpers
- `app/page.tsx`, `app/posts/[slug]/page.tsx` — หน้าอ่าน
- `app/admin/` — list / new / edit + `actions.ts` (Server Actions)
- `components/` — `AuthButtons`, `PostForm`, `DeletePostButton`

---

## Troubleshooting

- **API คืน `401` ทั้งที่ login แล้ว** → token ไม่มี audience ของ API
  ตรวจว่า scope ฝั่ง frontend มี `urn:zitadel:iam:org:project:id:<PROJECT_ID>:aud`
  (ดู `apps/web/src/auth.ts`) และ `ZITADEL_PROJECT_ID` ถูกต้อง
- **`jwt malformed` / signature error** → access token ไม่ใช่ JWT
  ตั้ง Token Settings ของ Web app เป็น **JWT** ใน ZITADEL Console
- **`audience invalid`** → ลอง log ค่า `aud` ที่ ZITADEL ใส่มา แล้วปรับ `audience`
  ใน `apps/apps/src/auth/jwt.strategy.ts` (อาจเป็น API Client ID หรือ Project ID)
- **`403 Requires ... roles: admin`** → ยังไม่ได้ grant role `admin` ให้ user ใน ZITADEL
- **issuer mismatch** → `ZITADEL_DOMAIN` ฝั่ง front/back ต้องตรงกันเป๊ะ (ระวัง trailing slash)
