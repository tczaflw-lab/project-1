import { NextResponse } from "next/server";
import { getChatGPTUser } from "@/app/chatgpt-auth";
import { ensureUser } from "@/db/content";

export async function GET() {
  const user = await getChatGPTUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const role = await ensureUser(user);
  return NextResponse.json({ user: { ...user, role } });
}
