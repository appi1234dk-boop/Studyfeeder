import { NextRequest, NextResponse } from "next/server";
import { deleteThreadStructureEntry, getThreadStructure, renameThreadStructureEntry, upsertThreadStructure, type ThreadStructureEntry } from "@/lib/sheets";
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

export async function PATCH(request: NextRequest) {
  if (!isOwner(request)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  try {
    const body = await request.json();
    const id = typeof body?.id === "string" ? body.id : "";
    const name = typeof body?.name === "string" ? body.name.trim() : "";
    if (!id || id.length > 200 || !name || name.length > 100) {
      return NextResponse.json({ error: "Invalid rename request" }, { status: 400 });
    }
    const result = await renameThreadStructureEntry(id, name);
    if (result.status === "not_found") return NextResponse.json({ error: "Entry not found" }, { status: 404 });
    if (result.status === "duplicate") return NextResponse.json({ error: "Duplicate name" }, { status: 409 });
    return NextResponse.json(result);
  } catch (error) {
    console.error("Failed to rename thread structure entry:", error);
    return NextResponse.json({ error: "Failed to rename entry" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  if (!isOwner(request)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  try {
    const body = await request.json();
    const id = typeof body?.id === "string" ? body.id : "";
    if (!id || id.length > 200) return NextResponse.json({ error: "Invalid delete request" }, { status: 400 });
    const result = await deleteThreadStructureEntry(id);
    if (result.status === "not_found") return NextResponse.json({ error: "Entry not found" }, { status: 404 });
    return NextResponse.json(result);
  } catch (error) {
    console.error("Failed to delete thread structure entry:", error);
    return NextResponse.json({ error: "Failed to delete entry" }, { status: 500 });
  }
}
