import { NextRequest, NextResponse } from "next/server";
import { hashPassword, setSessionCookie, startSession } from "@/app/auth";
import { createPasswordUser } from "@/db/content";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u;

export async function POST(request: NextRequest) {
  const body = await request.json() as { email?: string; password?: string; displayName?: string };
  const email = body.email?.trim().toLowerCase() ?? "";
  const displayName = body.displayName?.trim() ?? "";
  const password = body.password ?? "";
  if (!emailPattern.test(email) || email.length > 254) return NextResponse.json({ error: "请输入有效的邮箱地址" }, { status: 400 });
  if (displayName.length < 2 || displayName.length > 40) return NextResponse.json({ error: "昵称需要 2—40 个字符" }, { status: 400 });
  if (password.length < 8 || password.length > 72) return NextResponse.json({ error: "密码需要 8—72 个字符" }, { status: 400 });
  const credentials = await hashPassword(password);
  if (!await createPasswordUser(email, displayName, credentials.hash, credentials.salt)) {
    return NextResponse.json({ error: "该邮箱已经注册，请直接登录" }, { status: 409 });
  }
  const session = await startSession(email);
  const response = NextResponse.json({ ok: true }, { status: 201 });
  setSessionCookie(response, session.token, session.maxAge);
  return response;
}
