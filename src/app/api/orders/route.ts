import { NextResponse } from "next/server";
import { readDb, writeDb } from "@/lib/db";
import { OrderStatus } from "@/lib/types";
import {
  getClientIp,
  orderRateLimiter,
  adminApiRateLimiter,
  createRateLimitErrorResponse,
  attachRateLimitHeaders,
} from "@/lib/rate-limit";
import {
  verifyAndSanitizeOrder,
  verifyAdminAuth,
  verifySameOrigin,
} from "@/lib/security";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const ip = getClientIp(request);

    // 1. Kiểm tra Same Origin (chống CSRF từ web lạ)
    if (!verifySameOrigin(request)) {
      return NextResponse.json(
        { error: "Forbidden: Yêu cầu bị từ chối do nguồn gốc không hợp lệ" },
        { status: 403 }
      );
    }

    // 2. Kiểm tra Rate Limiting đặt hàng (Chống spam và cạn kiệt tồn kho)
    const rateLimitResult = orderRateLimiter.check(`order-${ip}`);
    if (!rateLimitResult.allowed) {
      return createRateLimitErrorResponse(rateLimitResult);
    }

    const body = await request.json();
    const db = readDb();

    // 3. Khử độc và xác thực đơn hàng trên Server-Side (Anti-Tampering)
    const verifiedResult = verifyAndSanitizeOrder(body, db);

    if (verifiedResult.isBot) {
      // Bẫy Honeypot: Giả lập thành công để bot không phát hiện nhưng không lưu DB
      return NextResponse.json(
        {
          order: { id: "ord-fake", code: "FL-9999", total: 0 },
          message: "Order placed",
        },
        { status: 200 }
      );
    }

    if (!verifiedResult.valid || !verifiedResult.order) {
      return NextResponse.json(
        { error: verifiedResult.error || "Thông tin đơn hàng không hợp lệ" },
        { status: 400 }
      );
    }

    const newOrder = verifiedResult.order;

    // 4. Trừ tồn kho an toàn cho từng món
    for (const item of newOrder.items) {
      const product = db.products.find((p) => p.id === item.productId);
      if (product) {
        const deduction = (item.stockDeductionPerItem || 1) * item.quantity;
        const prev = product.stock;
        const nextStock = Math.max(0, prev - deduction);
        product.stock = nextStock;

        db.stockLogs.unshift({
          id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          targetId: product.id,
          targetName: product.name,
          targetType: "product",
          change: -(prev - nextStock),
          previousStock: prev,
          newStock: nextStock,
          reason: `Đơn hàng ${newOrder.source} #${newOrder.code} (${item.quantity}x ${item.variantName})`,
          createdAt: new Date().toISOString(),
        });
      }
    }

    db.orders.unshift(newOrder);
    writeDb(db);

    const response = NextResponse.json({ order: newOrder, db });
    attachRateLimitHeaders(response.headers, rateLimitResult);
    return response;
  } catch (error) {
    return NextResponse.json(
      { error: "Không thể tạo đơn hàng", details: String(error) },
      { status: 400 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const ip = getClientIp(request);

    // 1. Kiểm tra quyền Quản trị viên
    if (!verifyAdminAuth(request)) {
      return NextResponse.json(
        { error: "Yêu cầu quyền quản trị viên (Admin authentication required)" },
        { status: 401 }
      );
    }

    // 2. Kiểm tra Rate Limiting quản trị
    const rateLimit = adminApiRateLimiter.check(`admin-order-patch-${ip}`);
    if (!rateLimit.allowed) {
      return createRateLimitErrorResponse(rateLimit);
    }

    const body = await request.json();
    const { orderId, status, isPaid, attachmentImage, note } = body as {
      orderId: string;
      status?: OrderStatus;
      isPaid?: boolean;
      attachmentImage?: string;
      note?: string;
    };

    const db = readDb();
    const order = db.orders.find((o) => o.id === orderId);
    if (!order) {
      return NextResponse.json({ error: "Không tìm thấy đơn hàng" }, { status: 404 });
    }

    const prevStatus = order.status;
    if (status && status !== prevStatus) {
      // Nếu hủy đơn hàng đang mở -> hoàn lại tồn kho
      if (status === "CANCELLED" && prevStatus !== "CANCELLED") {
        for (const item of order.items) {
          const product = db.products.find((p) => p.id === item.productId);
          if (product) {
            const restore = (item.stockDeductionPerItem || 1) * item.quantity;
            const prev = product.stock;
            product.stock = prev + restore;
            db.stockLogs.unshift({
              id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
              targetId: product.id,
              targetName: product.name,
              targetType: "product",
              change: restore,
              previousStock: prev,
              newStock: product.stock,
              reason: `Hoàn kho do huỷ đơn #${order.code}`,
              createdAt: new Date().toISOString(),
            });
          }
        }
      }
      order.status = status;
    }

    if (typeof isPaid === "boolean") {
      order.isPaid = isPaid;
    }
    if (typeof attachmentImage === "string") {
      order.attachmentImage = attachmentImage || undefined;
    }
    if (typeof note === "string") {
      order.note = note.slice(0, 300);
    }

    writeDb(db);
    const response = NextResponse.json({ order, db });
    attachRateLimitHeaders(response.headers, rateLimit);
    return response;
  } catch (error) {
    return NextResponse.json(
      { error: "Lỗi cập nhật đơn hàng", details: String(error) },
      { status: 400 }
    );
  }
}
