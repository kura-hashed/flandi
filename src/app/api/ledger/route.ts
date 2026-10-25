import { NextResponse } from "next/server";
import { readDb, writeDb } from "@/lib/db";
import { LedgerEntry, LedgerCategory } from "@/lib/types";
import {
  getClientIp,
  adminApiRateLimiter,
  createRateLimitErrorResponse,
  attachRateLimitHeaders,
} from "@/lib/rate-limit";
import { verifyAdminAuth, sanitizeString } from "@/lib/security";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const ip = getClientIp(request);

  // Sổ sách thu chi bắt buộc phải là Quản trị viên
  if (!verifyAdminAuth(request)) {
    return NextResponse.json(
      { error: "Yêu cầu quyền quản trị viên" },
      { status: 401 }
    );
  }

  const rateLimit = adminApiRateLimiter.check(`ledger-get-${ip}`);
  if (!rateLimit.allowed) {
    return createRateLimitErrorResponse(rateLimit);
  }

  const db = readDb();
  const response = NextResponse.json({ ledger: db.ledger || [] });
  attachRateLimitHeaders(response.headers, rateLimit);
  return response;
}

export async function POST(request: Request) {
  try {
    const ip = getClientIp(request);

    if (!verifyAdminAuth(request)) {
      return NextResponse.json(
        { error: "Yêu cầu quyền quản trị viên" },
        { status: 401 }
      );
    }

    const rateLimit = adminApiRateLimiter.check(`ledger-post-${ip}`);
    if (!rateLimit.allowed) {
      return createRateLimitErrorResponse(rateLimit);
    }

    const body = (await request.json()) as Partial<LedgerEntry>;
    const db = readDb();
    if (!db.ledger) db.ledger = [];

    const nextNum = 1001 + db.ledger.length;
    const validCategories: LedgerCategory[] = [
      "Nguyên liệu",
      "Bao bì & Hộp",
      "Vận chuyển / Ship",
      "Vận hành / Điện nước",
      "Doanh thu ngoài",
      "Sổ ghi chép / Kiểm ca",
      "Khác",
    ];
    const category: LedgerCategory = validCategories.includes(
      body.category as LedgerCategory
    )
      ? (body.category as LedgerCategory)
      : "Nguyên liệu";

    const newEntry: LedgerEntry = {
      id: `led-${Date.now()}`,
      code: sanitizeString(body.code || `SS-${nextNum}`, 30),
      type: body.type || "EXPENSE",
      category,
      title: sanitizeString(body.title || "Phiếu sổ sách / chứng từ", 150),
      amount: Math.max(0, Number(body.amount) || 0),
      paymentMethod: body.paymentMethod || "CASH",
      note: sanitizeString(body.note || "", 300),
      imageUrl: body.imageUrl ? sanitizeString(body.imageUrl, 250) : undefined,
      linkedOrderId: body.linkedOrderId ? sanitizeString(body.linkedOrderId, 50) : undefined,
      createdAt: new Date().toISOString(),
    };

    db.ledger.unshift(newEntry);
    writeDb(db);
    const response = NextResponse.json({ entry: newEntry, ledger: db.ledger });
    attachRateLimitHeaders(response.headers, rateLimit);
    return response;
  } catch (error) {
    return NextResponse.json(
      { error: "Không thể tạo bản ghi sổ sách", details: String(error) },
      { status: 400 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const ip = getClientIp(request);

    if (!verifyAdminAuth(request)) {
      return NextResponse.json(
        { error: "Yêu cầu quyền quản trị viên" },
        { status: 401 }
      );
    }

    const rateLimit = adminApiRateLimiter.check(`ledger-del-${ip}`);
    if (!rateLimit.allowed) {
      return createRateLimitErrorResponse(rateLimit);
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "Thiếu ID bản ghi sổ sách" }, { status: 400 });
    }

    const db = readDb();
    db.ledger = (db.ledger || []).filter((item) => item.id !== id);
    writeDb(db);

    const response = NextResponse.json({ ledger: db.ledger });
    attachRateLimitHeaders(response.headers, rateLimit);
    return response;
  } catch (error) {
    return NextResponse.json(
      { error: "Không thể xóa bản ghi sổ sách", details: String(error) },
      { status: 400 }
    );
  }
}
