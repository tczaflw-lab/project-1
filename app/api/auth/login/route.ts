import { NextRequest, NextResponse } from "next/server";
import { setSessionCookie, startSession, verifyPassword } from "@/app/auth";
import { checkLoginLimit, clearLoginFailures, getPasswordUser, recordLoginFailure } from "@/db/content";

export async function POST(request: NextRequest) {
  const body = await request.json() as { email?: string; password?: string };
  const email = body.email?.trim().toLowerCase() ?? "";
  const password = body.password ?? "";
  if (!email || !password) return NextResponse.json({ error: "请输入邮箱和密码" }, { status: 400 });
  if (!await checkLoginLimit(email)) return NextResponse.json({ error: "尝试次数过多，请 15 分钟后再试" }, { status: 429 });
  const user = await getPasswordUser(email);
  const valid = Boolean(user?.passwordHash && user.passwordSalt && await verifyPassword(password, user.passwordHash, user.passwordSalt));
  if (!valid) {
    await recordLoginFailure(email);
    return NextResponse.json({ error: "邮箱或密码不正确" }, { status: 401 });
  }
  await clearLoginFailures(email);
  const session = await startSession(email);
  const response = NextResponse.json({ ok: true });
  setSessionCookie(response, session.token, session.maxAge);
  return response;
}
