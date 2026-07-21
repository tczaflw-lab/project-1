import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  email: text("email").primaryKey(),
  displayName: text("display_name").notNull(),
  role: text("role", { enum: ["admin", "editor"] }).notNull().default("editor"),
  passwordHash: text("password_hash"),
  passwordSalt: text("password_salt"),
  createdAt: text("created_at").notNull(),
});

export const sessions = sqliteTable("sessions", {
  tokenHash: text("token_hash").primaryKey(),
  userEmail: text("user_email").notNull().references(() => users.email),
  expiresAt: text("expires_at").notNull(),
  createdAt: text("created_at").notNull(),
}, (table) => [index("sessions_user_idx").on(table.userEmail), index("sessions_expiry_idx").on(table.expiresAt)]);

export const loginAttempts = sqliteTable("login_attempts", {
  email: text("email").primaryKey(),
  attempts: integer("attempts").notNull().default(0),
  windowStartedAt: text("window_started_at").notNull(),
});

export const posts = sqliteTable("posts", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  excerpt: text("excerpt").notNull().default(""),
  content: text("content").notNull(),
  status: text("status", { enum: ["draft", "published"] }).notNull().default("draft"),
  authorEmail: text("author_email").notNull().references(() => users.email),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
  publishedAt: text("published_at"),
}, (table) => [index("posts_author_idx").on(table.authorEmail), index("posts_status_idx").on(table.status)]);
