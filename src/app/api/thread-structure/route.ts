import { NextRequest, NextResponse } from "next/server";
import { getThreadStructure, upsertThreadStructure, type ThreadStructureEntry } from "@/lib/sheets";
import { isOwner } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json(await getThreadStructure(), {
      headers: { "Cache-Control": "no-store, no-cache, must-revalidate" },
    });
  } catch (error) {
    console.error("Failed to fetch thread structure:", error);
    return NextResponse.json({ error: "Failed to fetch thread structure" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  if (!isOwner(request)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  try {
    const body = await request.json();
    const entries = Array.isArray(body?.entries) ? body.entries as ThreadStructureEntry[] : [];
    const valid = entries.every((entry) =>
      (entry.kind === "folder" || entry.kind === "thread") &&
      typeof entry.id === "string" && entry.id.length > 0 && entry.id.length <= 200 &&
      typeof entry.name === "string" && entry.name.trim().length > 0 && entry.name.length <= 100 &&
      typeof entry.parent_id === "string" && Number.isFinite(entry.sort_order)
    );
    if (!valid) return NextResponse.json({ error: "Invalid structure" }, { status: 400 });
    await upsertThreadStructure(entries);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to update thread structure:", error);
    return NextResponse.json({ error: "Failed to update thread structure" }, { status: 500 });
  }
}
