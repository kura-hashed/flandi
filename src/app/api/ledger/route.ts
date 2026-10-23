import { NextResponse } from "next/server";
import { readDb, writeDb } from "@/lib/db";
import { LedgerEntry } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET() {
  const db = readDb();
  return NextResponse.json({ ledger: db.ledger || [] });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Partial<LedgerEntry>;
    const db = readDb();
    if (!db.ledger) db.ledger = [];

    const nextNum = 1001 + db.ledger.length;
    const newEntry: LedgerEntry = {
      id: `led-${Date.now()}`,
      code: body.code || `SS-${nextNum}`,
      type: body.type || "EXPENSE",
      category: body.category || "Nguyên liệu",
      title: body.title?.trim() || "Phiếu sổ sách / chứng từ",
      amount: Number(body.amount) || 0,
      paymentMethod: body.paymentMethod || "CASH",
      note: body.note?.trim() || "",
      imageUrl: body.imageUrl || undefined,
      linkedOrderId: body.linkedOrderId || undefined,
      createdAt: new Date().toISOString(),
    };

    db.ledger.unshift(newEntry);
    writeDb(db);
    return NextResponse.json({ entry: newEntry, ledger: db.ledger });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to create ledger entry", details: String(error) },
      { status: 400 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "Missing id" }, { status: 400 });
    }
    const db = readDb();
    db.ledger = (db.ledger || []).filter((item) => item.id !== id);
    writeDb(db);
    return NextResponse.json({ ledger: db.ledger });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to delete ledger entry", details: String(error) },
      { status: 400 }
    );
  }
}
