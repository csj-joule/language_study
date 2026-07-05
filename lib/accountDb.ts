import { neon } from '@neondatabase/serverless'
import crypto from 'node:crypto'

// 관리자 계정을 (env 변수 대신) Neon Postgres로 관리한다.
// DATABASE_URL이 없으면 이 계층 전체가 비활성화되고, app/api/login/route.ts가
// 기존처럼 ADMIN_USERNAME/ADMIN_PASSWORD 환경변수로 폴백한다.

export type AdminUser = {
  id: number
  username: string
  createdAt: string
}

export function isAccountDbEnabled(): boolean {
  return !!process.env.DATABASE_URL
}

function getSql() {
  const url = process.env.DATABASE_URL
  if (!url) return null
  return neon(url)
}

function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex')
  const hash = crypto.scryptSync(password, salt, 64).toString('hex')
  return `${salt}:${hash}`
}

function verifyPasswordHash(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(':')
  if (!salt || !hash) return false
  const candidate = crypto.scryptSync(password, salt, 64)
  const expected = Buffer.from(hash, 'hex')
  if (candidate.length !== expected.length) return false
  return crypto.timingSafeEqual(candidate, expected)
}

let schemaReady: Promise<void> | null = null

async function ensureSchema(): Promise<void> {
  const sql = getSql()
  if (!sql) return
  if (!schemaReady) {
    schemaReady = (async () => {
      await sql`
        CREATE TABLE IF NOT EXISTS admin_users (
          id SERIAL PRIMARY KEY,
          username TEXT UNIQUE NOT NULL,
          password_hash TEXT NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
      `
      // 계정이 하나도 없으면 기본 관리자 계정을 만들어 잠기는 것을 방지한다.
      const existing = await sql`SELECT COUNT(*)::int AS count FROM admin_users`
      const count = (existing[0] as { count: number }).count
      if (count === 0) {
        const defaultUsername = process.env.ADMIN_USERNAME || 'admin'
        const defaultPassword = process.env.ADMIN_PASSWORD || 'joule1709!'
        const hash = hashPassword(defaultPassword)
        await sql`
          INSERT INTO admin_users (username, password_hash)
          VALUES (${defaultUsername}, ${hash})
          ON CONFLICT (username) DO NOTHING
        `
      }
    })()
  }
  await schemaReady
}

export async function verifyAdminCredentials(
  username: string,
  password: string
): Promise<boolean> {
  const sql = getSql()
  if (!sql) return false
  await ensureSchema()

  const rows = await sql`
    SELECT password_hash FROM admin_users WHERE username = ${username}
  `
  if (rows.length === 0) return false
  return verifyPasswordHash(
    password,
    (rows[0] as { password_hash: string }).password_hash
  )
}

export async function listAdminUsers(): Promise<AdminUser[]> {
  const sql = getSql()
  if (!sql) return []
  await ensureSchema()

  const rows = await sql`
    SELECT id, username, created_at FROM admin_users ORDER BY created_at ASC
  `
  return (
    rows as { id: number; username: string; created_at: string }[]
  ).map((r) => ({ id: r.id, username: r.username, createdAt: r.created_at }))
}

export async function createAdminUser(
  username: string,
  password: string
): Promise<void> {
  const sql = getSql()
  if (!sql) throw new Error('DATABASE_URL이 설정되어 있지 않습니다')
  await ensureSchema()

  const hash = hashPassword(password)
  try {
    await sql`
      INSERT INTO admin_users (username, password_hash) VALUES (${username}, ${hash})
    `
  } catch (err) {
    if (err instanceof Error && /duplicate key|unique constraint/i.test(err.message)) {
      throw new Error('이미 존재하는 아이디입니다')
    }
    throw err
  }
}

export async function deleteAdminUser(id: number): Promise<void> {
  const sql = getSql()
  if (!sql) throw new Error('DATABASE_URL이 설정되어 있지 않습니다')
  await ensureSchema()

  const remaining = await sql`SELECT COUNT(*)::int AS count FROM admin_users`
  if ((remaining[0] as { count: number }).count <= 1) {
    throw new Error('마지막 남은 계정은 삭제할 수 없습니다')
  }
  await sql`DELETE FROM admin_users WHERE id = ${id}`
}

export async function updateAdminPassword(
  id: number,
  password: string
): Promise<void> {
  const sql = getSql()
  if (!sql) throw new Error('DATABASE_URL이 설정되어 있지 않습니다')
  await ensureSchema()

  const hash = hashPassword(password)
  await sql`UPDATE admin_users SET password_hash = ${hash} WHERE id = ${id}`
}
