import { NextResponse } from "next/server";
import { getAllItems } from "@/lib/sheets";

export async function GET() {
  try {
    const items = await getAllItems();
    return NextResponse.json(items);
  } catch (error) {
    console.error("Failed to fetch items:", error);
    return NextResponse.json({ error: "Failed to fetch items" }, { status: 500 });
  }
}
