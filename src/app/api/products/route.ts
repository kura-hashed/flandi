import { NextResponse } from "next/server";
import { readDb, writeDb } from "@/lib/db";
import { Product } from "@/lib/types";
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

    // 2. Rate limiting
    const rateLimit = adminApiRateLimiter.check(`product-post-${ip}`);
    if (!rateLimit.allowed) {
      return createRateLimitErrorResponse(rateLimit);
    }

    const body = (await request.json()) as Partial<Product>;
    const db = readDb();

    const price = Math.max(0, Number(body.price) || 0);
    const costPrice = Math.max(0, Number(body.costPrice) || 0);
    const stock = Math.max(0, Number(body.stock) || 0);
    const lowStockThreshold = Math.max(0, Number(body.lowStockThreshold) || 10);
    const unit = sanitizeString(body.unit || "cái", 20);

    const validCategories: Product["category"][] = [
      "Flan & Pudding",
      "Panna Cotta",
      "Rau Câu",
      "Tàu Hũ & Yogurt",
    ];
    const category: Product["category"] = validCategories.includes(
      body.category as Product["category"]
    )
      ? (body.category as Product["category"])
      : "Flan & Pudding";

    const newProduct: Product = {
      id: body.id || `prod-${Date.now()}`,
      name: sanitizeString(body.name || "Món mới", 100),
      subtitle: sanitizeString(body.subtitle || "Món tráng miệng nhà làm", 150),
      category,
      description: sanitizeString(body.description || "", 500),
      price,
      costPrice,
      unit,
      badgeText: sanitizeString(
        body.badgeText || `${Math.round(price / 1000)}k / ${unit}`,
        40
      ),
      secondaryBadgeText: sanitizeString(body.secondaryBadgeText || "", 40),
      image: sanitizeString(body.image || "/images/products/flan.png", 250),
      stock,
      stockUnit: sanitizeString(body.stockUnit || unit, 20),
      lowStockThreshold,
      isActive: body.isActive ?? true,
      isBestSeller: body.isBestSeller ?? false,
      variants:
        body.variants && body.variants.length > 0
          ? body.variants.map((v) => ({
              ...v,
              name: sanitizeString(v.name, 50),
              price: Math.max(0, Number(v.price) || price),
              unitLabel: sanitizeString(v.unitLabel || unit, 20),
              stockDeduction: Math.max(1, Number(v.stockDeduction) || 1),
            }))
          : [
              {
                id: `var-${Date.now()}`,
                name: `Tiêu chuẩn (${unit})`,
                price,
                unitLabel: unit,
                stockDeduction: 1,
              },
            ],
    };

    db.products.push(newProduct);
    writeDb(db);
    const response = NextResponse.json({ product: newProduct, products: db.products });
    attachRateLimitHeaders(response.headers, rateLimit);
    return response;
  } catch (error) {
    return NextResponse.json(
      { error: "Không thể tạo món mới", details: String(error) },
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

    const rateLimit = adminApiRateLimiter.check(`product-put-${ip}`);
    if (!rateLimit.allowed) {
      return createRateLimitErrorResponse(rateLimit);
    }

    const body = (await request.json()) as Product;
    const db = readDb();
    const index = db.products.findIndex((p) => p.id === body.id);
    if (index === -1) {
      return NextResponse.json({ error: "Không tìm thấy món" }, { status: 404 });
    }

    const existing = db.products[index];
    db.products[index] = {
      ...existing,
      ...body,
      name: body.name ? sanitizeString(body.name, 100) : existing.name,
      subtitle: body.subtitle ? sanitizeString(body.subtitle, 150) : existing.subtitle,
      description: body.description ? sanitizeString(body.description, 500) : existing.description,
      price: Math.max(0, Number(body.price) || 0),
      costPrice: Math.max(0, Number(body.costPrice) || 0),
      stock: Math.max(0, Number(body.stock) || 0),
      lowStockThreshold: Math.max(0, Number(body.lowStockThreshold) || 10),
    };

    writeDb(db);
    const response = NextResponse.json({ product: db.products[index], products: db.products });
    attachRateLimitHeaders(response.headers, rateLimit);
    return response;
  } catch (error) {
    return NextResponse.json(
      { error: "Không thể cập nhật món", details: String(error) },
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

    const rateLimit = adminApiRateLimiter.check(`product-del-${ip}`);
    if (!rateLimit.allowed) {
      return createRateLimitErrorResponse(rateLimit);
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "Thiếu ID món cần xóa" }, { status: 400 });
    }

    const db = readDb();
    db.products = db.products.filter((p) => p.id !== id);
    writeDb(db);

    const response = NextResponse.json({ products: db.products });
    attachRateLimitHeaders(response.headers, rateLimit);
    return response;
  } catch (error) {
    return NextResponse.json(
      { error: "Không thể xóa món", details: String(error) },
      { status: 400 }
    );
  }
}
