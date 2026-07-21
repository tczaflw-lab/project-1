import { NextResponse } from "next/server";
import { getCurrentUser } from "@/app/auth";
import { listUsers } from "@/db/content";

export async function GET() {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") return NextResponse.json({ error: "forbidden" }, { status: 403 });
  return NextResponse.json({ users: await listUsers() });
}
