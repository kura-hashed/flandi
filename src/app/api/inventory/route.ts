import { NextResponse } from "next/server";
import { readDb, writeDb } from "@/lib/db";
import { IngredientItem, StockLog } from "@/lib/types";
import {
  getClientIp,
  adminApiRateLimiter,
  createRateLimitErrorResponse,
  attachRateLimitHeaders,
} from "@/lib/rate-limit";
import { verifyAdminAuth, sanitizeString } from "@/lib/security";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const ip = getClientIp(request);

    // 1. Kiểm tra quyền Quản trị viên
    if (!verifyAdminAuth(request)) {
      return NextResponse.json(
        { error: "Yêu cầu quyền quản trị viên" },
        { status: 401 }
      );
    }

    // 2. Rate limit
    const rateLimit = adminApiRateLimiter.check(`inv-post-${ip}`);
    if (!rateLimit.allowed) {
      return createRateLimitErrorResponse(rateLimit);
    }

    const body = await request.json();
    const { targetId, targetType, change, reason, setExact } = body as {
      targetId: string;
      targetType: "product" | "ingredient";
      change?: number;
      setExact?: number;
      reason: string;
    };

    const sanitizedReason = sanitizeString(reason || "Điều chỉnh tồn kho", 200);
    const db = readDb();

    if (targetType === "product") {
      const product = db.products.find((p) => p.id === targetId);
      if (!product) {
        return NextResponse.json({ error: "Không tìm thấy món" }, { status: 404 });
      }
      const prev = product.stock;
      const nextStock =
        typeof setExact === "number"
          ? Math.max(0, setExact)
          : Math.max(0, prev + (Number(change) || 0));
      const delta = nextStock - prev;
      product.stock = nextStock;

      const log: StockLog = {
        id: `log-${Date.now()}`,
        targetId: product.id,
        targetName: product.name,
        targetType: "product",
        change: delta,
        previousStock: prev,
        newStock: nextStock,
        reason: sanitizedReason,
        createdAt: new Date().toISOString(),
      };
      db.stockLogs.unshift(log);
    } else {
      const ing = db.ingredients.find((i) => i.id === targetId);
      if (!ing) {
        return NextResponse.json({ error: "Không tìm thấy nguyên liệu" }, { status: 404 });
      }
      const prev = ing.quantity;
      const nextStock =
        typeof setExact === "number"
          ? Math.max(0, setExact)
          : Math.max(0, Number((prev + (Number(change) || 0)).toFixed(2)));
      const delta = Number((nextStock - prev).toFixed(2));
      ing.quantity = nextStock;
      ing.lastUpdated = new Date().toISOString();

      const log: StockLog = {
        id: `log-${Date.now()}`,
        targetId: ing.id,
        targetName: ing.name,
        targetType: "ingredient",
        change: delta,
        previousStock: prev,
        newStock: nextStock,
        reason: sanitizedReason,
        createdAt: new Date().toISOString(),
      };
      db.stockLogs.unshift(log);
    }

    writeDb(db);
    const response = NextResponse.json({ db });
    attachRateLimitHeaders(response.headers, rateLimit);
    return response;
  } catch (error) {
    return NextResponse.json(
      { error: "Lỗi cập nhật kho", details: String(error) },
      { status: 400 }
    );
  }
}

export async function PUT(request: Request) {
  try {
    const ip = getClientIp(request);

    if (!verifyAdminAuth(request)) {
      return NextResponse.json(
        { error: "Yêu cầu quyền quản trị viên" },
        { status: 401 }
      );
    }

    const rateLimit = adminApiRateLimiter.check(`inv-put-${ip}`);
    if (!rateLimit.allowed) {
      return createRateLimitErrorResponse(rateLimit);
    }

    const body = (await request.json()) as IngredientItem;
    const db = readDb();
    const index = db.ingredients.findIndex((i) => i.id === body.id);
    if (index === -1) {
      return NextResponse.json({ error: "Không tìm thấy nguyên liệu" }, { status: 404 });
    }

    db.ingredients[index] = {
      ...db.ingredients[index],
      ...body,
      name: sanitizeString(body.name, 100),
      quantity: Math.max(0, Number(body.quantity) || 0),
      minThreshold: Math.max(0, Number(body.minThreshold) || 0),
      costPerUnit: Math.max(0, Number(body.costPerUnit) || 0),
      lastUpdated: new Date().toISOString(),
    };

    writeDb(db);
    const response = NextResponse.json({ ingredient: db.ingredients[index], db });
    attachRateLimitHeaders(response.headers, rateLimit);
    return response;
  } catch (error) {
    return NextResponse.json(
      { error: "Lỗi cập nhật thông tin nguyên liệu", details: String(error) },
      { status: 400 }
    );
  }
}
