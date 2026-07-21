import { index, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  email: text("email").primaryKey(),
  displayName: text("display_name").notNull(),
  role: text("role", { enum: ["admin", "editor"] }).notNull().default("editor"),
  createdAt: text("created_at").notNull(),
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
