import { NextRequest, NextResponse } from "next/server";
import { getAllItems, appendToObsidianQueue } from "@/lib/sheets";
import { isOwner } from "@/lib/auth";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!isOwner(request)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const memo = typeof body?.memo === "string" ? body.memo.trim() : "";

    if (!memo) {
      return NextResponse.json({ error: "memo is required" }, { status: 400 });
    }

    const items = await getAllItems();
    const item = items.find((i) => i.id === id);
    if (!item) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }

    await appendToObsidianQueue({
      source: "web",
      itemId: item.id,
      title: item.title,
      url: item.url,
      memo,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to enqueue obsidian sync:", error);
    return NextResponse.json({ error: "Failed to enqueue" }, { status: 500 });
  }
}
