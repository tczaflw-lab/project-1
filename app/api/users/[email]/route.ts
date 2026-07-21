import { NextRequest, NextResponse } from "next/server";
import { getChatGPTUser } from "@/app/chatgpt-auth";
import { ensureUser, updateUserRole, type Role } from "@/db/content";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ email: string }> }) {
  const user = await getChatGPTUser();
  if (!user || await ensureUser(user) !== "admin") return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const { email } = await params;
  const target = decodeURIComponent(email);
  if (target === user.email) return NextResponse.json({ error: "cannot change own role" }, { status: 400 });
  const body = await request.json() as { role?: Role };
  if (!body.role || !["admin", "editor"].includes(body.role)) return NextResponse.json({ error: "invalid role" }, { status: 400 });
  await updateUserRole(target, body.role);
  return NextResponse.json({ ok: true });
}
