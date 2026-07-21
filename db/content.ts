import { env } from "cloudflare:workers";
import type { ChatGPTUser } from "@/app/chatgpt-auth";

export type Role = "admin" | "editor";
export type PostStatus = "draft" | "published";

function db() {
  if (!env.DB) throw new Error("D1 binding DB is unavailable");
  return env.DB;
}

export async function ensureSchema() {
  const database = db();
  await database.batch([
    database.prepare(`CREATE TABLE IF NOT EXISTS users (
      email TEXT PRIMARY KEY,
      display_name TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'editor' CHECK(role IN ('admin','editor')),
      password_hash TEXT,
      password_salt TEXT,
      created_at TEXT NOT NULL
    )`),
    database.prepare(`CREATE TABLE IF NOT EXISTS posts (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      excerpt TEXT NOT NULL DEFAULT '',
      content TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','published')),
      author_email TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      published_at TEXT,
      FOREIGN KEY(author_email) REFERENCES users(email)
    )`),
    database.prepare("CREATE INDEX IF NOT EXISTS posts_author_idx ON posts(author_email)"),
    database.prepare("CREATE INDEX IF NOT EXISTS posts_status_idx ON posts(status)"),
    database.prepare(`CREATE TABLE IF NOT EXISTS sessions (
      token_hash TEXT PRIMARY KEY,
      user_email TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY(user_email) REFERENCES users(email) ON DELETE CASCADE
    )`),
    database.prepare("CREATE INDEX IF NOT EXISTS sessions_user_idx ON sessions(user_email)"),
    database.prepare("CREATE INDEX IF NOT EXISTS sessions_expiry_idx ON sessions(expires_at)"),
    database.prepare(`CREATE TABLE IF NOT EXISTS login_attempts (
      email TEXT PRIMARY KEY,
      attempts INTEGER NOT NULL DEFAULT 0,
      window_started_at TEXT NOT NULL
    )`),
  ]);
  const columns = await database.prepare("PRAGMA table_info(users)").all<{ name: string }>();
  const names = new Set(columns.results.map((column: { name: string }) => column.name));
  if (!names.has("password_hash")) await database.prepare("ALTER TABLE users ADD COLUMN password_hash TEXT").run();
  if (!names.has("password_salt")) await database.prepare("ALTER TABLE users ADD COLUMN password_salt TEXT").run();
}

export async function ensureUser(user: ChatGPTUser): Promise<Role> {
  await ensureSchema();
  const database = db();
  const existing = await database.prepare("SELECT role FROM users WHERE email = ?").bind(user.email).first<{ role: Role }>();
  if (existing) {
    await database.prepare("UPDATE users SET display_name = ? WHERE email = ?").bind(user.displayName, user.email).run();
    return existing.role;
  }
  const count = await database.prepare("SELECT COUNT(*) AS count FROM users").first<{ count: number }>();
  const role: Role = Number(count?.count ?? 0) === 0 ? "admin" : "editor";
  await database.prepare("INSERT INTO users (email, display_name, role, created_at) VALUES (?, ?, ?, ?)").bind(user.email, user.displayName, role, new Date().toISOString()).run();
  return role;
}

export async function createPasswordUser(email: string, displayName: string, passwordHash: string, passwordSalt: string) {
  await ensureSchema();
  const existing = await db().prepare("SELECT email FROM users WHERE email = ?").bind(email).first();
  if (existing) return false;
  const count = await db().prepare("SELECT COUNT(*) AS count FROM users").first<{ count: number }>();
  const role: Role = Number(count?.count ?? 0) === 0 ? "admin" : "editor";
  await db().prepare(`INSERT INTO users (email, display_name, role, password_hash, password_salt, created_at)
    VALUES (?, ?, ?, ?, ?, ?)`)
    .bind(email, displayName, role, passwordHash, passwordSalt, new Date().toISOString()).run();
  return true;
}

export async function getPasswordUser(email: string) {
  await ensureSchema();
  return db().prepare(`SELECT email, display_name AS displayName, role, password_hash AS passwordHash,
    password_salt AS passwordSalt FROM users WHERE email = ?`).bind(email).first<{
      email: string; displayName: string; role: Role; passwordHash: string | null; passwordSalt: string | null;
    }>();
}

export async function createSession(tokenHash: string, email: string, expiresAt: string) {
  await ensureSchema();
  await db().prepare("DELETE FROM sessions WHERE expires_at <= ?").bind(new Date().toISOString()).run();
  await db().prepare("INSERT INTO sessions (token_hash, user_email, expires_at, created_at) VALUES (?, ?, ?, ?)")
    .bind(tokenHash, email, expiresAt, new Date().toISOString()).run();
}

export async function getSessionUser(tokenHash: string) {
  await ensureSchema();
  return db().prepare(`SELECT u.email, u.display_name AS displayName, u.role
    FROM sessions s JOIN users u ON u.email = s.user_email
    WHERE s.token_hash = ? AND s.expires_at > ?`).bind(tokenHash, new Date().toISOString()).first<{
      email: string; displayName: string; role: Role;
    }>();
}

export async function deleteSession(tokenHash: string) {
  await ensureSchema();
  await db().prepare("DELETE FROM sessions WHERE token_hash = ?").bind(tokenHash).run();
}

export async function checkLoginLimit(email: string) {
  await ensureSchema();
  const record = await db().prepare("SELECT attempts, window_started_at AS windowStartedAt FROM login_attempts WHERE email = ?")
    .bind(email).first<{ attempts: number; windowStartedAt: string }>();
  if (!record) return true;
  const expired = Date.now() - new Date(record.windowStartedAt).getTime() > 15 * 60 * 1000;
  return expired || Number(record.attempts) < 6;
}

export async function recordLoginFailure(email: string) {
  await ensureSchema();
  const now = new Date();
  const record = await db().prepare("SELECT attempts, window_started_at AS windowStartedAt FROM login_attempts WHERE email = ?")
    .bind(email).first<{ attempts: number; windowStartedAt: string }>();
  const expired = !record || now.getTime() - new Date(record.windowStartedAt).getTime() > 15 * 60 * 1000;
  await db().prepare(`INSERT INTO login_attempts (email, attempts, window_started_at) VALUES (?, ?, ?)
    ON CONFLICT(email) DO UPDATE SET attempts = excluded.attempts, window_started_at = excluded.window_started_at`)
    .bind(email, expired ? 1 : Number(record.attempts) + 1, expired ? now.toISOString() : record.windowStartedAt).run();
}

export async function clearLoginFailures(email: string) {
  await ensureSchema();
  await db().prepare("DELETE FROM login_attempts WHERE email = ?").bind(email).run();
}

export async function listPosts(scope: "published" | "mine" | "all", email?: string) {
  await ensureSchema();
  const base = `SELECT p.id, p.title, p.excerpt, p.content, p.status, p.author_email AS authorEmail,
    u.display_name AS authorName, p.created_at AS createdAt, p.updated_at AS updatedAt
    FROM posts p JOIN users u ON u.email = p.author_email`;
  const query = scope === "published" ? `${base} WHERE p.status = 'published' ORDER BY p.updated_at DESC`
    : scope === "mine" ? `${base} WHERE p.author_email = ? ORDER BY p.updated_at DESC`
    : `${base} ORDER BY p.updated_at DESC`;
  const result = scope === "mine" ? await db().prepare(query).bind(email).all() : await db().prepare(query).all();
  return result.results;
}

export async function createPost(email: string, input: { title: string; excerpt?: string; content: string; status: PostStatus }) {
  const now = new Date().toISOString();
  const id = crypto.randomUUID();
  await db().prepare(`INSERT INTO posts (id,title,excerpt,content,status,author_email,created_at,updated_at,published_at)
    VALUES (?,?,?,?,?,?,?,?,?)`).bind(id, input.title, input.excerpt ?? "", input.content, input.status, email, now, now, input.status === "published" ? now : null).run();
  return id;
}

export async function getPostOwner(id: string) {
  return db().prepare("SELECT author_email AS authorEmail FROM posts WHERE id = ?").bind(id).first<{ authorEmail: string }>();
}

export async function updatePost(id: string, input: { title: string; excerpt?: string; content: string; status: PostStatus }) {
  const now = new Date().toISOString();
  await db().prepare(`UPDATE posts SET title=?, excerpt=?, content=?, status=?, updated_at=?,
    published_at=CASE WHEN ?='published' THEN COALESCE(published_at, ?) ELSE NULL END WHERE id=?`)
    .bind(input.title, input.excerpt ?? "", input.content, input.status, now, input.status, now, id).run();
}

export async function deletePost(id: string) { await db().prepare("DELETE FROM posts WHERE id = ?").bind(id).run(); }
export async function listUsers() { await ensureSchema(); return (await db().prepare("SELECT email, display_name AS displayName, role, created_at AS createdAt FROM users ORDER BY created_at").all()).results; }
export async function updateUserRole(email: string, role: Role) { await db().prepare("UPDATE users SET role = ? WHERE email = ?").bind(role, email).run(); }
