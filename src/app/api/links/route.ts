import { NextResponse } from "next/server";
import { getLinks } from "@/lib/sheets";

export async function GET() {
  try {
    const links = await getLinks();
    return NextResponse.json(links);
  } catch (error) {
    console.error("Failed to fetch links:", error);
    return NextResponse.json({}, { status: 200 }); // 링크는 부가 정보 → 실패해도 빈 맵
  }
}
