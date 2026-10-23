import { NextResponse } from "next/server";
import { readDb, writeDb } from "@/lib/db";
import { Product } from "@/lib/types";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Partial<Product>;
    const db = readDb();

    const newProduct: Product = {
      id: body.id || `prod-${Date.now()}`,
      name: body.name || "Món mới",
      subtitle: body.subtitle || "Món tráng miệng nhà làm",
      category: body.category || "Flan & Pudding",
      description: body.description || "",
      price: Number(body.price) || 10000,
      costPrice: Number(body.costPrice) || 5000,
      unit: body.unit || "cái",
      badgeText: body.badgeText || `${Math.round((Number(body.price) || 10000) / 1000)}k / ${body.unit || "cái"}`,
      secondaryBadgeText: body.secondaryBadgeText || "",
      image: body.image || "/images/products/flan.png",
      stock: Number(body.stock) ?? 50,
      stockUnit: body.stockUnit || body.unit || "cái",
      lowStockThreshold: Number(body.lowStockThreshold) ?? 10,
      isActive: body.isActive ?? true,
      isBestSeller: body.isBestSeller ?? false,
      variants:
        body.variants && body.variants.length > 0
          ? body.variants
          : [
              {
                id: `var-${Date.now()}`,
                name: `Tiêu chuẩn (${body.unit || "cái"})`,
                price: Number(body.price) || 10000,
                unitLabel: body.unit || "cái",
                stockDeduction: 1,
              },
            ],
    };

    db.products.push(newProduct);
    writeDb(db);
    return NextResponse.json({ product: newProduct, products: db.products });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to create product", details: String(error) },
      { status: 400 }
    );
  }
}

export async function PUT(request: Request) {
  try {
    const body = (await request.json()) as Product;
    const db = readDb();
    const index = db.products.findIndex((p) => p.id === body.id);
    if (index === -1) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }
    db.products[index] = {
      ...db.products[index],
      ...body,
      price: Number(body.price),
      costPrice: Number(body.costPrice),
      stock: Number(body.stock),
      lowStockThreshold: Number(body.lowStockThreshold),
    };
    writeDb(db);
    return NextResponse.json({ product: db.products[index], products: db.products });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to update product", details: String(error) },
      { status: 400 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "Missing product id" }, { status: 400 });
    }
    const db = readDb();
    db.products = db.products.filter((p) => p.id !== id);
    writeDb(db);
    return NextResponse.json({ products: db.products });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to delete product", details: String(error) },
      { status: 400 }
    );
  }
}
