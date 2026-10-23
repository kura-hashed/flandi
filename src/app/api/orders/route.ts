import { NextResponse } from "next/server";
import { readDb, writeDb } from "@/lib/db";
import { Order, OrderStatus } from "@/lib/types";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Partial<Order>;
    const db = readDb();

    const nextNumber = 1001 + db.orders.length;
    const code = body.code || `FL-${nextNumber}`;

    const newOrder: Order = {
      id: `ord-${Date.now()}`,
      code,
      source: body.source || "ONLINE",
      status: body.status || (body.source === "POS" ? "COMPLETED" : "PENDING"),
      customerName: body.customerName?.trim() || "Khách lẻ tại quầy",
      customerPhone: body.customerPhone?.trim() || "",
      customerAddress: body.customerAddress?.trim() || "",
      note: body.note?.trim() || "",
      items: body.items || [],
      subtotal: Number(body.subtotal) || 0,
      discount: Number(body.discount) || 0,
      shippingFee: Number(body.shippingFee) || 0,
      total: Number(body.total) || 0,
      paymentMethod: body.paymentMethod || "CASH",
      isPaid: body.isPaid ?? (body.source === "POS"),
      cashReceived: body.cashReceived,
      changeGiven: body.changeGiven,
      createdAt: new Date().toISOString(),
    };

    // Deduct stock for each item
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
    return NextResponse.json({ order: newOrder, db });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to create order", details: String(error) },
      { status: 400 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { orderId, status, isPaid } = body as {
      orderId: string;
      status?: OrderStatus;
      isPaid?: boolean;
    };

    const db = readDb();
    const order = db.orders.find((o) => o.id === orderId);
    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    const prevStatus = order.status;
    if (status && status !== prevStatus) {
      // If cancelling an active order, restore stock
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

    writeDb(db);
    return NextResponse.json({ order, db });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to update order", details: String(error) },
      { status: 400 }
    );
  }
}
