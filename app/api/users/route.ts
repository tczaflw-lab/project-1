import { NextResponse } from "next/server";
import { getChatGPTUser } from "@/app/chatgpt-auth";
import { ensureUser, listUsers } from "@/db/content";

export async function GET() {
  const user = await getChatGPTUser();
  if (!user || await ensureUser(user) !== "admin") return NextResponse.json({ error: "forbidden" }, { status: 403 });
  return NextResponse.json({ users: await listUsers() });
}
