import { NextResponse } from "next/server";
import { endEmailSession, sessionCookieName } from "@/app/auth";

export async function POST() {
  await endEmailSession();
  const response = NextResponse.json({ ok: true });
  response.cookies.set({ name: sessionCookieName, value: "", httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 0 });
  return response;
}
