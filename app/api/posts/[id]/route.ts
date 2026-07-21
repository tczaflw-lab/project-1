import { NextRequest, NextResponse } from "next/server";
import { getChatGPTUser } from "@/app/chatgpt-auth";
import { deletePost, ensureUser, getPostOwner, updatePost, type PostStatus } from "@/db/content";

async function authorize(id: string) {
  const user = await getChatGPTUser();
  if (!user) return null;
  const role = await ensureUser(user);
  const owner = await getPostOwner(id);
  if (!owner || (owner.authorEmail !== user.email && role !== "admin")) return null;
  return user;
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!await authorize(id)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const body = await request.json() as { title?: string; excerpt?: string; content?: string; status?: PostStatus };
  if (!body.title?.trim() || !body.content?.trim() || !["draft", "published"].includes(body.status ?? "")) return NextResponse.json({ error: "invalid input" }, { status: 400 });
  await updatePost(id, { title: body.title.trim(), excerpt: body.excerpt?.trim(), content: body.content, status: body.status! });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!await authorize(id)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  await deletePost(id);
  return NextResponse.json({ ok: true });
}
