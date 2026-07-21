import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/app/auth";
import { updateUserRole, type Role } from "@/db/content";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ email: string }> }) {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const { email } = await params;
  const target = decodeURIComponent(email);
  if (target === user.email) return NextResponse.json({ error: "cannot change own role" }, { status: 400 });
  const body = await request.json() as { role?: Role };
  if (!body.role || !["admin", "editor"].includes(body.role)) return NextResponse.json({ error: "invalid role" }, { status: 400 });
  await updateUserRole(target, body.role);
  return NextResponse.json({ ok: true });
}
