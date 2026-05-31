import { NextRequest, NextResponse } from "next/server";
import { OWNER_COOKIE } from "@/lib/auth";

const ONE_YEAR = 60 * 60 * 24 * 365;

// 비밀번호 확인 후 소유자 쿠키 발급
export async function POST(request: NextRequest) {
  const key = process.env.OWNER_KEY;
  if (!key) {
    return NextResponse.json({ error: "OWNER_KEY not set" }, { status: 500 });
  }

  const body = await request.json().catch(() => ({}));
  const password = typeof body?.password === "string" ? body.password : "";

  if (password !== key) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(OWNER_COOKIE, key, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: ONE_YEAR,
  });
  return res;
}

// 잠금(로그아웃)
export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(OWNER_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return res;
}
