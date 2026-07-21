import { cookies } from "next/headers";
import type { NextResponse } from "next/server";
import { getChatGPTUser } from "./chatgpt-auth";
import { createSession, deleteSession, ensureUser, getSessionUser, type Role } from "@/db/content";

const SESSION_COOKIE = "motai_session";
const SESSION_SECONDS = 60 * 60 * 24 * 30;
const encoder = new TextEncoder();

export type AppUser = {
  email: string;
  displayName: string;
  role: Role;
  provider: "email" | "chatgpt";
};

function toBase64Url(bytes: Uint8Array) {
  let value = "";
  for (const byte of bytes) value += String.fromCharCode(byte);
  return btoa(value).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromBase64Url(value: string) {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  const decoded = atob(padded);
  return Uint8Array.from(decoded, (character) => character.charCodeAt(0));
}

export async function hashPassword(password: string, salt = toBase64Url(crypto.getRandomValues(new Uint8Array(16)))) {
  const key = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: fromBase64Url(salt), iterations: 210_000 }, key, 256);
  return { hash: toBase64Url(new Uint8Array(bits)), salt };
}

export async function verifyPassword(password: string, expectedHash: string, salt: string) {
  const { hash } = await hashPassword(password, salt);
  const actual = encoder.encode(hash);
  const expected = encoder.encode(expectedHash);
  if (actual.length !== expected.length) return false;
  let difference = 0;
  for (let index = 0; index < actual.length; index += 1) difference |= actual[index] ^ expected[index];
  return difference === 0;
}

export async function hashSessionToken(token: string) {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(token));
  return toBase64Url(new Uint8Array(digest));
}

export async function startSession(email: string) {
  const token = toBase64Url(crypto.getRandomValues(new Uint8Array(32)));
  const expiresAt = new Date(Date.now() + SESSION_SECONDS * 1000).toISOString();
  await createSession(await hashSessionToken(token), email, expiresAt);
  return { token, maxAge: SESSION_SECONDS };
}

export function setSessionCookie(response: NextResponse, token: string, maxAge: number) {
  response.cookies.set({ name: SESSION_COOKIE, value: token, httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge });
}

export async function endEmailSession() {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) await deleteSession(await hashSessionToken(token));
}

export async function getCurrentUser(): Promise<AppUser | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) {
    const user = await getSessionUser(await hashSessionToken(token));
    if (user) return { ...user, provider: "email" };
  }
  const chatGPTUser = await getChatGPTUser();
  if (!chatGPTUser) return null;
  const role = await ensureUser(chatGPTUser);
  return { ...chatGPTUser, role, provider: "chatgpt" };
}

export const sessionCookieName = SESSION_COOKIE;
