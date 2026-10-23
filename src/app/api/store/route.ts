import { NextResponse } from "next/server";
import { readDb, writeDb } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const db = readDb();
  return NextResponse.json(db);
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const db = readDb();
    if (body.settings) {
      db.settings = { ...db.settings, ...body.settings };
    }
    writeDb(db);
    return NextResponse.json(db);
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to update settings", details: String(error) },
      { status: 400 }
    );
  }
}
