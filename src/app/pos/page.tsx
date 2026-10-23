"use client";

import React, { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import {
  Store,
  ShoppingBag,
  Plus,
  Minus,
  Trash2,
  Printer,
  Search,
  ArrowLeft,
  RefreshCw,
  QrCode,
  Banknote,
  Wallet,
  Sparkles,
  Settings,
  CheckCircle2,
  Clock,
} from "lucide-react";
import {
  Product,
  ProductVariant,
  Order,
  OrderStatus,
  OrderSource,
  PaymentMethod,
  ShopSettings,
} from "@/lib/types";

interface PosCartItem {
  product: Product;
  variant: ProductVariant;
  quantity: number;
}

export default function FlandiPosPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [settings, setSettings] = useState<ShopSettings | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [posView, setPosView] = useState<"COUNTER" | "RECENT_ORDERS">("COUNTER");

  // POS Ticket State
  const [posCategory, setPosCategory] = useState<string>("ALL");
  const [posSearch, setPosSearch] = useState("");
  const [posCart, setPosCart] = useState<PosCartItem[]>([]);
  const [posSource, setPosSource] = useState<OrderSource>("POS");
  const [posCustomerName, setPosCustomerName] = useState("");
  const [posCustomerPhone, setPosCustomerPhone] = useState("");
  const [posDiscount, setPosDiscount] = useState<number>(0);
  const [posShippingFee, setPosShippingFee] = useState<number>(0);
  const [posPaymentMethod, setPosPaymentMethod] =
    useState<PaymentMethod>("CASH");
  const [posCashReceived, setPosCashReceived] = useState<number>(0);
  const [posNote, setPosNote] = useState("");
  const [receiptOrder, setReceiptOrder] = useState<Order | null>(null);

  const notify = (msg: string) => {
    setToast(msg);
    setTimeout(() => {
      setToast((prev) => (prev === msg ? null : prev));
    }, 2800);
  };

  const formatVND = (n: number) =>
    new Intl.NumberFormat("vi-VN").format(Math.round(n || 0)) + "đ";

  const fetchPosData = async () => {
    try {
      const res = await fetch("/api/store", { cache: "no-store" });
      const data = await res.json();
      setProducts(
        (data.products || []).filter((p: Product) => p.isActive !== false)
      );
      setOrders(data.orders || []);
      setSettings(data.settings || null);
    } catch (err) {
      console.error("Failed to fetch POS data:", err);
    }
  };

  useEffect(() => {
    fetchPosData();
  }, []);

  const addToPosCart = (product: Product, variant: ProductVariant) => {
    if (product.stock < variant.stockDeduction) {
      notify(
        `⚠️ Món ${product.name} chỉ còn ${product.stock} ${product.stockUnit}!`
      );
      return;
    }
    setPosCart((prev) => {
      const idx = prev.findIndex(
        (i) => i.product.id === product.id && i.variant.id === variant.id
      );
      if (idx > -1) {
        const next = [...prev];
        next[idx] = { ...next[idx], quantity: next[idx].quantity + 1 };
        return next;
      }
      return [...prev, { product, variant, quantity: 1 }];
    });
  };

  const updatePosQty = (productId: string, variantId: string, delta: number) => {
    setPosCart((prev) =>
      prev
        .map((item) => {
          if (item.product.id === productId && item.variant.id === variantId) {
            const q = item.quantity + delta;
            return q > 0 ? { ...item, quantity: q } : null;
          }
          return item;
        })
        .filter(Boolean) as PosCartItem[]
    );
  };

  const posSubtotal = useMemo(
    () => posCart.reduce((s, i) => s + i.variant.price * i.quantity, 0),
    [posCart]
  );

  const posTotal = Math.max(0, posSubtotal - posDiscount + posShippingFee);
  const posChangeDue = Math.max(0, (posCashReceived || posTotal) - posTotal);

  const handleCompletePosOrder = async (shouldPrint: boolean) => {
    if (posCart.length === 0) {
      notify("Chưa có món nào trong đơn POS!");
      return;
    }

    try {
      const payload = {
        source: posSource,
        status: "COMPLETED" as OrderStatus,
        customerName: posCustomerName.trim() || "Khách lẻ tại quầy",
        customerPhone: posCustomerPhone.trim(),
        note: posNote.trim(),
        items: posCart.map((i) => ({
          productId: i.product.id,
          productName: i.product.name,
          variantId: i.variant.id,
          variantName: i.variant.name,
          quantity: i.quantity,
          unitPrice: i.variant.price,
          subtotal: i.variant.price * i.quantity,
          stockDeductionPerItem: i.variant.stockDeduction,
        })),
        subtotal: posSubtotal,
        discount: posDiscount,
        shippingFee: posShippingFee,
        total: posTotal,
        paymentMethod: posPaymentMethod,
        isPaid: true,
        cashReceived:
          posPaymentMethod === "CASH" ? posCashReceived || posTotal : posTotal,
        changeGiven: posPaymentMethod === "CASH" ? posChangeDue : 0,
      };

      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (res.ok && data.order) {
        notify(`✅ Đã tạo đơn #${data.order.code} & trừ kho tự động!`);
        setPosCart([]);
        setPosCustomerName("");
        setPosCustomerPhone("");
        setPosDiscount(0);
        setPosShippingFee(0);
        setPosCashReceived(0);
        setPosNote("");
        fetchPosData();

        if (shouldPrint) {
          setReceiptOrder(data.order);
        }
      }
    } catch (e) {
      console.error(e);
      notify("Lỗi khi lưu đơn POS!");
    }
  };

  const handleQuickCompleteOrder = async (orderId: string) => {
    try {
      const res = await fetch("/api/orders", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, status: "COMPLETED", isPaid: true }),
      });
      if (res.ok) {
        notify("Đã xác nhận hoàn tất & thu tiền đơn hàng!");
        fetchPosData();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const filteredPosProducts = useMemo(() => {
    return products.filter((p) => {
      const matchCat = posCategory === "ALL" || p.category === posCategory;
      const q = posSearch.trim().toLowerCase();
      const matchQ =
        !q ||
        p.name.toLowerCase().includes(q) ||
        p.subtitle.toLowerCase().includes(q);
      return matchCat && matchQ;
    });
  }, [products, posCategory, posSearch]);

  const pendingOrdersCount = useMemo(
    () =>
      orders.filter((o) => o.status === "PENDING" || o.status === "PREPARING")
        .length,
    [orders]
  );

  return (
    <div className="min-h-screen bg-[#FFF9F8] flex flex-col">
      {toast && (
        <div className="fixed bottom-5 right-5 z-50 bg-flandi-dark text-white px-5 py-3 rounded-2xl shadow-cute-lg flex items-center gap-2.5 animate-bounce">
          <Sparkles className="w-4 h-4 text-flandi-salmon" />
          <span className="text-xs sm:text-sm font-bold">{toast}</span>
        </div>
      )}

      {/* POS Header */}
      <header className="bg-white border-b border-flandi-pink sticky top-0 z-30 px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="p-2 rounded-full bg-flandi-bg hover:bg-flandi-pink/50 text-flandi-coral border border-flandi-pink transition"
            title="Về trang chủ khách hàng"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div className="flex items-center gap-2.5">
            <img
              src={
                settings?.brandKit?.mascotImage ||
                "/images/branding/flandi-mascot.png"
              }
              alt="FLANDI"
              className="w-9 h-9 rounded-full object-cover border-2 border-flandi-salmon"
            />
            <div>
              <h1 className="font-display text-xl text-sticker-sm leading-none">
                FLANDI POS TERMINAL
              </h1>
              <span className="text-[11px] font-bold text-flandi-muted block">
                Máy Bán Hàng Tại Quầy & In Hoá Đơn Nhanh (/pos)
              </span>
            </div>
          </div>
        </div>

        {/* Center Switch: Counter vs Recent Orders */}
        <div className="flex items-center gap-1.5 bg-flandi-bg p-1 rounded-xl border border-flandi-pink">
          <button
            type="button"
            onClick={() => setPosView("COUNTER")}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-extrabold flex items-center gap-1.5 transition ${
              posView === "COUNTER"
                ? "bg-flandi-coral text-white shadow-2xs"
                : "text-flandi-dark hover:bg-flandi-cream"
            }`}
          >
            <Store className="w-4 h-4" />
            <span>Màn Hình Thu Ngân</span>
          </button>

          <button
            type="button"
            onClick={() => setPosView("RECENT_ORDERS")}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-extrabold flex items-center gap-1.5 transition ${
              posView === "RECENT_ORDERS"
                ? "bg-flandi-coral text-white shadow-2xs"
                : "text-flandi-dark hover:bg-flandi-cream"
            }`}
          >
            <ShoppingBag className="w-4 h-4" />
            <span>Đơn Trong Ca ({orders.length})</span>
            {pendingOrdersCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-amber-400 text-flandi-dark text-[10px] font-black">
                {pendingOrdersCount} chờ
              </span>
            )}
          </button>
        </div>

        {/* Right Actions: Refresh + Link to /admin */}
        <div className="flex items-center gap-2">
          <button
            onClick={fetchPosData}
            className="p-2 rounded-xl border border-flandi-pink hover:bg-flandi-cream text-flandi-muted"
            title="Làm mới dữ liệu"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <Link
            href="/admin"
            className="px-3.5 py-2 rounded-xl bg-flandi-cream hover:bg-flandi-pink/60 text-flandi-coral border border-flandi-salmon font-extrabold text-xs flex items-center gap-1.5"
          >
            <Settings className="w-3.5 h-3.5" />
            <span>Trang Quản Trị (/admin)</span>
          </Link>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6">
        {posView === "COUNTER" ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left 7 Cols: Product Selection Grid */}
            <div className="lg:col-span-7 space-y-4">
              <div className="bg-white p-4 rounded-2xl border border-flandi-pink shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto">
                  {[
                    { id: "ALL", label: "Tất cả" },
                    { id: "Flan & Pudding", label: "Flan" },
                    { id: "Panna Cotta", label: "Panna Cotta" },
                    { id: "Rau Câu", label: "Rau Câu" },
                    { id: "Tàu Hũ & Yogurt", label: "Tàu Hũ & Yogurt" },
                  ].map((c) => (
                    <button
                      key={c.id}
                      onClick={() => setPosCategory(c.id)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-extrabold whitespace-nowrap transition ${
                        posCategory === c.id
                          ? "bg-flandi-coral text-white"
                          : "bg-flandi-bg text-flandi-dark hover:bg-flandi-pink/40"
                      }`}
                    >
                      {c.label}
                    </button>
                  ))}
                </div>

                <div className="relative w-full sm:w-56">
                  <Search className="w-4 h-4 text-flandi-muted absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={posSearch}
                    onChange={(e) => setPosSearch(e.target.value)}
                    placeholder="Tìm nhanh món..."
                    className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-flandi-pink text-xs font-semibold focus:border-flandi-coral focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {filteredPosProducts.map((product) => {
                  const isLow = product.stock <= product.lowStockThreshold;
                  return (
                    <div
                      key={product.id}
                      className="bg-white rounded-2xl border-2 border-flandi-pink hover:border-flandi-salmon p-4 shadow-xs transition flex flex-col justify-between gap-3"
                    >
                      <div className="flex items-center gap-3.5">
                        <div className="relative w-16 h-16 rounded-full p-1 bg-flandi-salmon shrink-0">
                          <img
                            src={product.image}
                            alt={product.name}
                            className="w-full h-full object-cover rounded-full border border-white"
                          />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-1">
                            <h3 className="font-extrabold text-base text-flandi-dark truncate">
                              {product.name}
                            </h3>
                            <span
                              className={`text-[11px] font-extrabold px-2 py-0.5 rounded-full shrink-0 ${
                                product.stock <= 0
                                  ? "bg-red-100 text-red-700"
                                  : isLow
                                  ? "bg-amber-100 text-amber-800"
                                  : "bg-emerald-50 text-emerald-700"
                              }`}
                            >
                              Kho: {product.stock} {product.stockUnit}
                            </span>
                          </div>
                          <p className="text-xs text-flandi-coral font-bold">
                            {product.badgeText}
                            {product.secondaryBadgeText
                              ? ` • ${product.secondaryBadgeText}`
                              : ""}
                          </p>
                        </div>
                      </div>

                      {/* Quick Variant Tap Buttons for Fast Cashier Entry */}
                      <div className="grid grid-cols-1 gap-1.5 pt-2 border-t border-flandi-pink/50">
                        {product.variants.map((v) => {
                          const disabled = product.stock < v.stockDeduction;
                          return (
                            <button
                              key={v.id}
                              disabled={disabled}
                              onClick={() => addToPosCart(product, v)}
                              className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center justify-between border transition ${
                                disabled
                                  ? "bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed"
                                  : "bg-flandi-bg hover:bg-flandi-salmon hover:text-white border-flandi-pink text-flandi-dark active:scale-98"
                              }`}
                            >
                              <span className="truncate">+ {v.name}</span>
                              <span className="font-extrabold shrink-0 ml-2">
                                {formatVND(v.price)}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Right 5 Cols: Active POS Ticket & Checkout */}
            <div className="lg:col-span-5 bg-white rounded-3xl border-2 border-flandi-salmon shadow-cute p-5 space-y-4 sticky top-20">
              <div className="flex items-center justify-between border-b border-flandi-pink pb-3">
                <div>
                  <h2 className="font-extrabold text-base text-flandi-dark flex items-center gap-2">
                    <Store className="w-5 h-5 text-flandi-coral" />
                    <span>Phiếu Bán Hàng POS</span>
                  </h2>
                  <p className="text-xs text-flandi-muted font-semibold">
                    Tự động trừ tồn kho khi hoàn tất thanh toán
                  </p>
                </div>
                {posCart.length > 0 && (
                  <button
                    onClick={() => setPosCart([])}
                    className="text-xs text-red-500 hover:underline font-bold flex items-center gap-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Xoá giỏ
                  </button>
                )}
              </div>

              {/* Order Source Tabs */}
              <div className="grid grid-cols-3 gap-1.5 p-1 bg-flandi-bg rounded-xl border border-flandi-pink">
                {(
                  [
                    { id: "POS", label: "🏪 Tại Quầy" },
                    { id: "ZALO", label: "💬 Đơn Zalo" },
                    { id: "GRAB_SHOPEE", label: "🛵 App Giao" },
                  ] as { id: OrderSource; label: string }[]
                ).map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setPosSource(s.id)}
                    className={`py-1.5 rounded-lg text-xs font-extrabold transition ${
                      posSource === s.id
                        ? "bg-flandi-coral text-white shadow-xs"
                        : "text-flandi-muted"
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>

              {/* Customer Info */}
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  value={posCustomerName}
                  onChange={(e) => setPosCustomerName(e.target.value)}
                  placeholder="Tên khách (tuỳ chọn)"
                  className="px-3 py-2 rounded-xl border border-flandi-pink text-xs font-semibold focus:border-flandi-coral focus:outline-none"
                />
                <input
                  type="tel"
                  value={posCustomerPhone}
                  onChange={(e) => setPosCustomerPhone(e.target.value)}
                  placeholder="SĐT khách (tuỳ chọn)"
                  className="px-3 py-2 rounded-xl border border-flandi-pink text-xs font-semibold focus:border-flandi-coral focus:outline-none"
                />
              </div>

              {/* Cart Items List */}
              <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
                {posCart.length === 0 ? (
                  <div className="py-10 text-center text-xs text-flandi-muted font-semibold border border-dashed border-flandi-pink rounded-2xl">
                    Chạm vào các món bên trái để lên đơn nhanh
                  </div>
                ) : (
                  posCart.map((item) => (
                    <div
                      key={`${item.product.id}-${item.variant.id}`}
                      className="p-2.5 rounded-xl bg-flandi-bg border border-flandi-pink flex items-center justify-between gap-2"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-extrabold text-xs text-flandi-dark truncate">
                          {item.product.name}
                        </p>
                        <p className="text-[11px] text-flandi-muted font-semibold truncate">
                          {item.variant.name} • {formatVND(item.variant.price)}
                        </p>
                      </div>

                      <div className="flex items-center gap-1.5 bg-white rounded-full px-2 py-0.5 border border-flandi-pink">
                        <button
                          onClick={() =>
                            updatePosQty(item.product.id, item.variant.id, -1)
                          }
                          className="w-5 h-5 flex items-center justify-center text-flandi-dark"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="text-xs font-extrabold w-5 text-center">
                          {item.quantity}
                        </span>
                        <button
                          onClick={() =>
                            updatePosQty(item.product.id, item.variant.id, 1)
                          }
                          className="w-5 h-5 flex items-center justify-center text-flandi-coral"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>

                      <span className="text-xs font-extrabold text-flandi-coral w-20 text-right">
                        {formatVND(item.variant.price * item.quantity)}
                      </span>
                    </div>
                  ))
                )}
              </div>

              {/* Discount & Shipping Adjustments */}
              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-flandi-pink">
                <div>
                  <label className="text-[11px] font-bold text-flandi-muted block mb-1">
                    Giảm giá (đ)
                  </label>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      min={0}
                      step={1000}
                      value={posDiscount || ""}
                      onChange={(e) =>
                        setPosDiscount(Number(e.target.value) || 0)
                      }
                      placeholder="0"
                      className="w-full px-2.5 py-1.5 rounded-xl border border-flandi-pink text-xs font-bold"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setPosDiscount(Math.round(posSubtotal * 0.1))
                      }
                      className="px-2 py-1.5 rounded-lg bg-flandi-cream text-flandi-coral text-[10px] font-extrabold shrink-0"
                    >
                      -10%
                    </button>
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-flandi-muted block mb-1">
                    Phí ship (đ)
                  </label>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      min={0}
                      step={1000}
                      value={posShippingFee || ""}
                      onChange={(e) =>
                        setPosShippingFee(Number(e.target.value) || 0)
                      }
                      placeholder="0"
                      className="w-full px-2.5 py-1.5 rounded-xl border border-flandi-pink text-xs font-bold"
                    />
                    <button
                      type="button"
                      onClick={() => setPosShippingFee(15000)}
                      className="px-2 py-1.5 rounded-lg bg-flandi-cream text-flandi-coral text-[10px] font-extrabold shrink-0"
                    >
                      +15k
                    </button>
                  </div>
                </div>
              </div>

              {/* Payment Method */}
              <div className="space-y-2">
                <label className="text-[11px] font-bold text-flandi-muted block">
                  Phương thức thanh toán
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(
                    [
                      { id: "CASH", label: "Tiền mặt", icon: Banknote },
                      { id: "VIETQR", label: "VietQR", icon: QrCode },
                      { id: "MOMO", label: "Ví MoMo", icon: Wallet },
                    ] as const
                  ).map((pm) => {
                    const Icon = pm.icon;
                    return (
                      <button
                        key={pm.id}
                        type="button"
                        onClick={() => setPosPaymentMethod(pm.id)}
                        className={`py-2 px-2.5 rounded-xl border text-xs font-extrabold flex items-center justify-center gap-1.5 transition ${
                          posPaymentMethod === pm.id
                            ? "border-flandi-coral bg-flandi-salmon/15 text-flandi-coral"
                            : "border-flandi-pink text-flandi-dark"
                        }`}
                      >
                        <Icon className="w-3.5 h-3.5" />
                        <span>{pm.label}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Cash Tender Quick Calculator */}
                {posPaymentMethod === "CASH" && posTotal > 0 && (
                  <div className="p-3 rounded-2xl bg-flandi-bg border border-flandi-pink space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-flandi-muted">
                        Khách đưa:
                      </span>
                      <input
                        type="number"
                        value={posCashReceived || ""}
                        onChange={(e) =>
                          setPosCashReceived(Number(e.target.value) || 0)
                        }
                        placeholder={String(posTotal)}
                        className="w-28 px-2.5 py-1 rounded-lg border border-flandi-pink text-right font-extrabold text-flandi-dark bg-white"
                      />
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {[posTotal, 50000, 100000, 200000, 500000].map(
                        (amt, i) => (
                          <button
                            key={i}
                            type="button"
                            onClick={() => setPosCashReceived(amt)}
                            className="px-2 py-1 rounded-lg bg-white border border-flandi-pink text-[11px] font-bold hover:border-flandi-coral"
                          >
                            {i === 0 ? "Đưa đủ" : `${amt / 1000}k`}
                          </button>
                        )
                      )}
                    </div>
                    <div className="flex items-center justify-between text-xs pt-1 border-t border-flandi-pink/60">
                      <span className="font-bold text-flandi-muted">
                        Tiền thối lại:
                      </span>
                      <span className="font-extrabold text-emerald-600 text-sm">
                        {formatVND(posChangeDue)}
                      </span>
                    </div>
                  </div>
                )}

                {/* Live VietQR Preview in POS */}
                {posPaymentMethod === "VIETQR" && posTotal > 0 && settings && (
                  <div className="p-3 rounded-2xl bg-flandi-bg border border-flandi-pink flex items-center gap-3">
                    <img
                      src={`https://img.vietqr.io/image/${settings.bankBin}-${settings.bankAccountNo}-compact2.png?amount=${posTotal}&addInfo=${encodeURIComponent(
                        "FLANDI POS"
                      )}`}
                      alt="VietQR"
                      className="w-20 h-20 rounded-lg border border-flandi-pink bg-white object-contain shrink-0"
                    />
                    <div className="text-xs space-y-1">
                      <p className="font-extrabold text-flandi-dark">
                        Quét mã VietQR ({settings.bankName})
                      </p>
                      <p className="text-flandi-muted font-semibold">
                        STK: {settings.bankAccountNo}
                      </p>
                      <p className="text-flandi-coral font-extrabold">
                        Số tiền: {formatVND(posTotal)}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Totals Summary */}
              <div className="pt-2 border-t border-flandi-pink space-y-1 text-xs">
                <div className="flex justify-between text-flandi-muted font-semibold">
                  <span>Tạm tính:</span>
                  <span>{formatVND(posSubtotal)}</span>
                </div>
                {posDiscount > 0 && (
                  <div className="flex justify-between text-emerald-600 font-bold">
                    <span>Giảm giá:</span>
                    <span>-{formatVND(posDiscount)}</span>
                  </div>
                )}
                {posShippingFee > 0 && (
                  <div className="flex justify-between text-flandi-muted font-semibold">
                    <span>Phí giao hàng:</span>
                    <span>+{formatVND(posShippingFee)}</span>
                  </div>
                )}
                <div className="flex justify-between text-lg font-extrabold text-flandi-dark pt-1">
                  <span>KHÁCH CẦN TRẢ:</span>
                  <span className="text-flandi-coral">
                    {formatVND(posTotal)}
                  </span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="grid grid-cols-2 gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={() => handleCompletePosOrder(false)}
                  disabled={posCart.length === 0}
                  className="py-3 rounded-2xl bg-flandi-cream hover:bg-flandi-pink/70 text-flandi-coral font-extrabold text-xs border border-flandi-salmon transition disabled:opacity-40"
                >
                  Thanh Toán Nhanh
                </button>
                <button
                  type="button"
                  onClick={() => handleCompletePosOrder(true)}
                  disabled={posCart.length === 0}
                  className="py-3 rounded-2xl bg-flandi-coral hover:bg-flandi-salmon text-white font-extrabold text-xs shadow-cute flex items-center justify-center gap-1.5 transition disabled:opacity-40"
                >
                  <Printer className="w-4 h-4" />
                  <span>Thu Tiền & In Bill</span>
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* Recent Orders in Shift View for Quick Receipt Reprint / Confirmation */
          <div className="space-y-3">
            {orders.slice(0, 20).map((order) => (
              <div
                key={order.id}
                className="bg-white rounded-2xl border-2 border-flandi-pink p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-extrabold text-sm text-flandi-coral">
                      #{order.code}
                    </span>
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-flandi-cream text-flandi-dark">
                      {order.source}
                    </span>
                    <span
                      className={`text-xs font-extrabold px-2 py-0.5 rounded-full ${
                        order.status === "COMPLETED"
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-amber-100 text-amber-800"
                      }`}
                    >
                      {order.status}
                    </span>
                    <span className="text-xs text-flandi-muted">
                      {new Date(order.createdAt).toLocaleTimeString("vi-VN")}
                    </span>
                  </div>
                  <p className="text-xs font-bold text-flandi-dark">
                    {order.customerName}{" "}
                    {order.customerPhone ? `• ${order.customerPhone}` : ""}
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {order.items.map((it, idx) => (
                      <span
                        key={idx}
                        className="text-[11px] bg-flandi-bg border border-flandi-pink px-2 py-0.5 rounded-md font-semibold"
                      >
                        {it.quantity}x {it.productName} ({it.variantName})
                      </span>
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="font-extrabold text-base text-flandi-coral mr-2">
                    {formatVND(order.total)}
                  </span>
                  {order.status !== "COMPLETED" &&
                    order.status !== "CANCELLED" && (
                      <button
                        type="button"
                        onClick={() => handleQuickCompleteOrder(order.id)}
                        className="px-3 py-2 rounded-xl bg-emerald-600 text-white text-xs font-extrabold flex items-center gap-1"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Hoàn tất</span>
                      </button>
                    )}
                  <button
                    type="button"
                    onClick={() => setReceiptOrder(order)}
                    className="px-3 py-2 rounded-xl bg-flandi-coral text-white text-xs font-extrabold flex items-center gap-1"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>In Bill</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Thermal Receipt Print Modal */}
      {receiptOrder && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-5 shadow-2xl space-y-4">
            <div
              id="printable-receipt"
              className="p-4 border border-dashed border-gray-300 rounded-xl text-xs font-mono text-black space-y-2.5 bg-white"
            >
              <div className="text-center border-b border-dashed border-gray-300 pb-2">
                <h3 className="font-bold text-base">
                  {settings?.shopName || "TIỆM BÁNH FLANDI"}
                </h3>
                <p className="text-[11px]">
                  “{settings?.tagline || "Muốn ăn hãy Flăn vào tớ"}”
                </p>
                <p className="text-[10px] text-gray-600">
                  SĐT/Zalo: {settings?.phone || "0366053058"}
                </p>
              </div>

              <div className="text-[11px] space-y-0.5">
                <p>
                  Mã HĐ: <strong>#{receiptOrder.code}</strong> (
                  {receiptOrder.source})
                </p>
                <p>
                  Ngày:{" "}
                  {new Date(receiptOrder.createdAt).toLocaleString("vi-VN")}
                </p>
                <p>Khách: {receiptOrder.customerName}</p>
                {receiptOrder.customerPhone && (
                  <p>SĐT: {receiptOrder.customerPhone}</p>
                )}
              </div>

              <div className="border-t border-b border-dashed border-gray-300 py-2 space-y-1.5">
                {receiptOrder.items.map((item, idx) => (
                  <div key={idx} className="flex justify-between gap-2">
                    <div>
                      <span className="font-bold">
                        {item.quantity}x {item.productName}
                      </span>
                      <span className="block text-[10px] text-gray-600">
                        ({item.variantName})
                      </span>
                    </div>
                    <span className="font-bold shrink-0">
                      {formatVND(item.subtotal)}
                    </span>
                  </div>
                ))}
              </div>

              <div className="space-y-1 text-[11px]">
                <div className="flex justify-between">
                  <span>Tạm tính:</span>
                  <span>{formatVND(receiptOrder.subtotal)}</span>
                </div>
                {receiptOrder.discount > 0 && (
                  <div className="flex justify-between">
                    <span>Giảm giá:</span>
                    <span>-{formatVND(receiptOrder.discount)}</span>
                  </div>
                )}
                {receiptOrder.shippingFee > 0 && (
                  <div className="flex justify-between">
                    <span>Phí giao hàng:</span>
                    <span>+{formatVND(receiptOrder.shippingFee)}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm font-bold pt-1 border-t border-dashed border-gray-300">
                  <span>TỔNG CỘNG:</span>
                  <span>{formatVND(receiptOrder.total)}</span>
                </div>
                <div className="flex justify-between text-[10px]">
                  <span>Thanh toán:</span>
                  <span>
                    {receiptOrder.paymentMethod} (
                    {receiptOrder.isPaid ? "Đã thanh toán" : "Thu hộ COD"})
                  </span>
                </div>
              </div>

              <div className="text-center pt-2 border-t border-dashed border-gray-300 text-[10px]">
                <p>Bảo quản lạnh 2-6°C để bánh ngon nhất!</p>
                <p className="font-bold">Cảm ơn bạn đã “Flăn” vào FLANDI ♥</p>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setReceiptOrder(null)}
                className="flex-1 py-2.5 rounded-xl bg-gray-100 text-gray-700 font-bold text-xs"
              >
                Đóng
              </button>
              <button
                onClick={() => window.print()}
                className="flex-1 py-2.5 rounded-xl bg-flandi-coral text-white font-extrabold text-xs flex items-center justify-center gap-1.5 shadow-cute"
              >
                <Printer className="w-4 h-4" />
                <span>In Hoá Đơn Ngay</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
