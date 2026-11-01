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
  resolveRequestActor,
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

    const db = readDb();

    // 2. Kiểm tra phân quyền RBAC: Hiện tại chỉ cho phép tài khoản có quyền `orders:create` (Staff / Admin) lên đơn
    const actor = resolveRequestActor(request, db);
    if (!actor.permissions.includes("orders:create")) {
      const errorMsg =
        actor.role === "guest"
          ? "Chỉ nhân viên (Staff) mới được quyền lên đơn. Vui lòng đăng nhập tài khoản Staff / Admin!"
          : `Tài khoản (${actor.role.toUpperCase()}) chưa có quyền lên đơn. Vui lòng liên hệ Admin để cấp quyền Staff!`;
      return NextResponse.json(
        { error: errorMsg, role: actor.role },
        { status: 403 }
      );
    }

    // 3. Kiểm tra Rate Limiting đặt hàng (Chống spam và cạn kiệt tồn kho)
    const rateLimitResult = orderRateLimiter.check(`order-${ip}`);
    if (!rateLimitResult.allowed) {
      return createRateLimitErrorResponse(rateLimitResult);
    }

    const body = await request.json();

    // 4. Khử độc và xác thực đơn hàng trên Server-Side (Anti-Tampering)
    const verifiedResult = verifyAndSanitizeOrder(body, db);

    if (verifiedResult.isBot) {
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

    // Lưu dấu vết người lên đơn (Staff / Admin)
    newOrder.createdByRole = actor.role;
    if (actor.user) {
      newOrder.createdById = actor.user.id;
      newOrder.createdByEmail = actor.user.email;

      // Chỉ gắn customerId tự động khi tài khoản là khách lẻ tự đặt (role === "user")
      if (actor.role === "user") {
        newOrder.customerId = actor.user.id;
        newOrder.customerEmail = actor.user.email;
      } else {
        // Khi Staff/Admin lên đơn giúp khách, không ghi đè customerId của khách bằng ID nhân viên
        newOrder.customerId = undefined;
        newOrder.customerEmail = undefined;
      }
    }

    // 5. Trừ tồn kho an toàn cho từng món
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
          reason: `Đơn hàng ${newOrder.source} #${newOrder.code} (${item.quantity}x ${item.variantName})${
            newOrder.createdByEmail ? ` • bởi ${newOrder.createdByEmail}` : ""
          }`,
          createdAt: new Date().toISOString(),
        });
      }
    }

    db.orders.unshift(newOrder);
    writeDb(db);

    const canSeeFullStore = actor.permissions.includes("store:manage");
    const scopedDb = canSeeFullStore
      ? db
      : {
          products: db.products,
          settings: db.settings,
          orders: actor.permissions.includes("orders:manage") ? db.orders : [],
        };

    const response = NextResponse.json({ order: newOrder, db: scopedDb });
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

    if (!verifySameOrigin(request)) {
      return NextResponse.json(
        { error: "Forbidden: Nguồn gốc không hợp lệ" },
        { status: 403 }
      );
    }

    const db = readDb();
    const actor = resolveRequestActor(request, db);

    // 1. Kiểm tra quyền xử lý đơn trong ca (`orders:manage` — cho phép Staff & Admin)
    if (!actor.permissions.includes("orders:manage")) {
      return NextResponse.json(
        { error: "Yêu cầu quyền Staff hoặc Admin để cập nhật trạng thái đơn hàng" },
        { status: 403 }
      );
    }

    // 2. Kiểm tra Rate Limiting
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

    const order = db.orders.find((o) => o.id === orderId);
    if (!order) {
      return NextResponse.json({ error: "Không tìm thấy đơn hàng" }, { status: 404 });
    }

    const prevStatus = order.status;
    if (status && status !== prevStatus) {
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
    const canSeeFullStore = actor.permissions.includes("store:manage");
    const response = NextResponse.json({
      order,
      db: canSeeFullStore
        ? db
        : { products: db.products, settings: db.settings, orders: db.orders },
    });
    attachRateLimitHeaders(response.headers, rateLimit);
    return response;
  } catch (error) {
    return NextResponse.json(
      { error: "Lỗi cập nhật đơn hàng", details: String(error) },
      { status: 400 }
    );
  }
}
