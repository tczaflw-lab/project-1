import { NextRequest, NextResponse } from "next/server";
import { getChatGPTUser } from "@/app/chatgpt-auth";
import { createPost, ensureUser, listPosts, type PostStatus } from "@/db/content";

export async function GET(request: NextRequest) {
  const user = await getChatGPTUser();
  const scope = request.nextUrl.searchParams.get("scope") ?? "published";
  if (!user) return NextResponse.json({ posts: await listPosts("published") });
  const role = await ensureUser(user);
  const safeScope = scope === "all" && role === "admin" ? "all" : scope === "mine" ? "mine" : "published";
  return NextResponse.json({ posts: await listPosts(safeScope, user.email) });
}

export async function POST(request: NextRequest) {
  const user = await getChatGPTUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  await ensureUser(user);
  const body = await request.json() as { title?: string; excerpt?: string; content?: string; status?: PostStatus };
  if (!body.title?.trim() || !body.content?.trim() || !["draft", "published"].includes(body.status ?? "")) return NextResponse.json({ error: "invalid input" }, { status: 400 });
  const id = await createPost(user.email, { title: body.title.trim(), excerpt: body.excerpt?.trim(), content: body.content, status: body.status! });
  return NextResponse.json({ id }, { status: 201 });
}
