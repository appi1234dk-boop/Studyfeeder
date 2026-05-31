import { NextRequest } from "next/server";

export const OWNER_COOKIE = "sf_owner";

// 쿠키 sf_owner 값이 OWNER_KEY와 일치하면 소유자.
// OWNER_KEY가 설정돼 있지 않으면(로컬 초기 상태 등) 항상 false.
export function isOwner(request: NextRequest): boolean {
  const key = process.env.OWNER_KEY;
  if (!key) return false;
  const cookie = request.cookies.get(OWNER_COOKIE)?.value;
  return cookie === key;
}
