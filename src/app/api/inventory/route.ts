import { NextResponse } from "next/server";
import { readDb, writeDb } from "@/lib/db";
import { IngredientItem, StockLog } from "@/lib/types";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { targetId, targetType, change, reason, setExact } = body as {
      targetId: string;
      targetType: "product" | "ingredient";
      change?: number;
      setExact?: number;
      reason: string;
    };

    const db = readDb();

    if (targetType === "product") {
      const product = db.products.find((p) => p.id === targetId);
      if (!product) {
        return NextResponse.json({ error: "Product not found" }, { status: 404 });
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
        reason: reason || "Điều chỉnh tồn kho",
        createdAt: new Date().toISOString(),
      };
      db.stockLogs.unshift(log);
    } else {
      const ing = db.ingredients.find((i) => i.id === targetId);
      if (!ing) {
        return NextResponse.json({ error: "Ingredient not found" }, { status: 404 });
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
        reason: reason || "Nhập / Xuất nguyên liệu",
        createdAt: new Date().toISOString(),
      };
      db.stockLogs.unshift(log);
    }

    writeDb(db);
    return NextResponse.json(db);
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to adjust inventory", details: String(error) },
      { status: 400 }
    );
  }
}

export async function PUT(request: Request) {
  try {
    const body = (await request.json()) as Partial<IngredientItem>;
    const db = readDb();

    if (body.id) {
      const idx = db.ingredients.findIndex((i) => i.id === body.id);
      if (idx !== -1) {
        db.ingredients[idx] = {
          ...db.ingredients[idx],
          ...body,
          quantity: Number(body.quantity ?? db.ingredients[idx].quantity),
          minThreshold: Number(body.minThreshold ?? db.ingredients[idx].minThreshold),
          costPerUnit: Number(body.costPerUnit ?? db.ingredients[idx].costPerUnit),
          lastUpdated: new Date().toISOString(),
        };
        writeDb(db);
        return NextResponse.json(db);
      }
    }

    const newIng: IngredientItem = {
      id: `ing-${Date.now()}`,
      name: body.name || "Nguyên liệu mới",
      category: body.category || "Nguyên liệu",
      quantity: Number(body.quantity) || 0,
      unit: body.unit || "kg",
      minThreshold: Number(body.minThreshold) || 5,
      costPerUnit: Number(body.costPerUnit) || 10000,
      lastUpdated: new Date().toISOString(),
    };
    db.ingredients.push(newIng);
    writeDb(db);
    return NextResponse.json(db);
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to save ingredient", details: String(error) },
      { status: 400 }
    );
  }
}
