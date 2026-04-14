import { NextRequest, NextResponse } from "next/server";
import { getAllItems, updateItem } from "@/lib/sheets";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const items = await getAllItems();
    const item = items.find((i) => i.id === id);

    if (!item) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }

    await updateItem(item.rowIndex, body);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to update item:", error);
    return NextResponse.json({ error: "Failed to update item" }, { status: 500 });
  }
}
