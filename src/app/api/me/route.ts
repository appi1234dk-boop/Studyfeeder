import { NextRequest, NextResponse } from "next/server";
import { isOwner } from "@/lib/auth";

export async function GET(request: NextRequest) {
  return NextResponse.json({ isOwner: isOwner(request) });
}
