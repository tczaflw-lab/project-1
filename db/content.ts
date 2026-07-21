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
  ]);
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
