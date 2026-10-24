"use client";

import React, { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import {
  Plus,
  Minus,
  Trash2,
  Copy,
  Check,
  Sparkles,
  ArrowLeft,
  Send,
  MessageCircle,
  Phone,
  ShoppingBag,
  QrCode,
  CheckCircle2,
  X,
  Zap,
} from "lucide-react";
import { Product, ProductVariant, ShopSettings, Order } from "@/lib/types";

interface QuickLineItem {
  product: Product;
  variant: ProductVariant;
  quantity: number;
}

export default function QuickSingleScreenOrderPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [settings, setSettings] = useState<ShopSettings | null>(null);
  const [loading, setLoading] = useState(true);

  // Selected variant per product ID
  const [selectedVariantByProd, setSelectedVariantByProd] = useState<
    Record<string, string>
  >({});

  // Cart keyed by `${productId}__${variantId}`
  const [cartMap, setCartMap] = useState<Record<string, QuickLineItem>>({});

  // Compact customer info
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");
  const [customerNote, setCustomerNote] = useState("");

  const [copied, setCopied] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [sendingChannel, setSendingChannel] = useState<
    "MESSENGER" | "ZALO" | "DIRECT" | null
  >(null);
  const [sentResultModal, setSentResultModal] = useState<{
    channel: "MESSENGER" | "ZALO" | "DIRECT";
    orderCode: string;
    orderText: string;
    total: number;
    targetUrl?: string;
  } | null>(null);

  const notify = (msg: string) => {
    setToast(msg);
    setTimeout(() => {
      setToast((prev) => (prev === msg ? null : prev));
    }, 3200);
  };

  const formatVND = (n: number) =>
    new Intl.NumberFormat("vi-VN").format(Math.round(n || 0)) + "đ";

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch("/api/store", { cache: "no-store" });
        const data = await res.json();
        const activeProds: Product[] = (data.products || []).filter(
          (p: Product) => p.isActive !== false
        );
        setProducts(activeProds);
        setSettings(data.settings || null);

        const defaultVars: Record<string, string> = {};
        activeProds.forEach((p) => {
          if (p.variants?.[0]) {
            defaultVars[p.id] = p.variants[0].id;
          }
        });
        setSelectedVariantByProd(defaultVars);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const getActiveVariant = (product: Product): ProductVariant => {
    const vId = selectedVariantByProd[product.id];
    return (
      product.variants.find((v) => v.id === vId) || product.variants[0]
    );
  };

  const getQtyFor = (productId: string, variantId: string): number => {
    return cartMap[`${productId}__${variantId}`]?.quantity || 0;
  };

  const getTotalQtyForProduct = (productId: string): number => {
    return Object.values(cartMap)
      .filter((item) => item.product.id === productId)
      .reduce((s, item) => s + item.quantity, 0);
  };

  const updateQty = (
    product: Product,
    variant: ProductVariant,
    delta: number
  ) => {
    const key = `${product.id}__${variant.id}`;
    setCartMap((prev) => {
      const current = prev[key]?.quantity || 0;
      const nextQty = Math.max(0, current + delta);
      const copy = { ...prev };
      if (nextQty <= 0) {
        delete copy[key];
      } else {
        copy[key] = { product, variant, quantity: nextQty };
      }
      return copy;
    });
  };

  const setExactQty = (
    product: Product,
    variant: ProductVariant,
    qty: number
  ) => {
    const key = `${product.id}__${variant.id}`;
    setCartMap((prev) => {
      const copy = { ...prev };
      if (qty <= 0) {
        delete copy[key];
      } else {
        copy[key] = { product, variant, quantity: qty };
      }
      return copy;
    });
  };

  const cartItems = useMemo(() => Object.values(cartMap), [cartMap]);

  const totalItemsCount = useMemo(
    () => cartItems.reduce((s, i) => s + i.quantity, 0),
    [cartItems]
  );

  const subtotal = useMemo(
    () => cartItems.reduce((s, i) => s + i.variant.price * i.quantity, 0),
    [cartItems]
  );

  const freeShipMin = settings?.freeShipMinimum || 150000;
  const shippingFee =
    subtotal === 0
      ? 0
      : subtotal >= freeShipMin
      ? 0
      : settings?.defaultShippingFee || 15000;
  const grandTotal = subtotal + shippingFee;

  // Build formatted text message for Messenger / Zalo
  const buildOrderMessageText = (code?: string) => {
    const lines: string[] = [];
    lines.push(
      `🍮 ĐƠN ĐẶT BÁNH FLANDI ${code ? `(#${code})` : ""}`.trim()
    );
    lines.push("------------------------");
    cartItems.forEach((item, idx) => {
      lines.push(
        `${idx + 1}. ${item.product.name} (${item.variant.name}): ${
          item.quantity
        } x ${formatVND(item.variant.price)} = ${formatVND(
          item.variant.price * item.quantity
        )}`
      );
    });
    lines.push("------------------------");
    lines.push(`• Tạm tính: ${formatVND(subtotal)}`);
    lines.push(
      `• Phí ship: ${
        shippingFee === 0 ? "FREESHIP (0đ)" : formatVND(shippingFee)
      }`
    );
    lines.push(`💰 TỔNG CỘNG: ${formatVND(grandTotal)}`);
    if (customerName.trim() || customerPhone.trim()) {
      lines.push(
        `👤 Khách: ${customerName.trim() || "Khách đặt nhanh"}${
          customerPhone.trim() ? ` - SĐT: ${customerPhone.trim()}` : ""
        }`
      );
    }
    if (customerAddress.trim()) {
      lines.push(`📍 Địa chỉ nhận: ${customerAddress.trim()}`);
    }
    if (customerNote.trim()) {
      lines.push(`📝 Ghi chú: ${customerNote.trim()}`);
    }
    return lines.join("\n");
  };

  const handleCopyBillText = async () => {
    if (cartItems.length === 0) {
      notify("Bạn hãy chọn số lượng ít nhất 1 món bánh nhé!");
      return;
    }
    const text = buildOrderMessageText();
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      notify("📋 Đã sao chép nội dung đơn hàng!");
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      console.error(e);
    }
  };

  const handleSendOrderVia = async (
    channel: "MESSENGER" | "ZALO" | "DIRECT"
  ) => {
    if (cartItems.length === 0) {
      notify("🍮 Bạn hãy bấm (+) chọn số lượng món bánh trước khi gửi đơn nha!");
      return;
    }

    setSendingChannel(channel);
    let createdOrderCode = `FL-${Math.floor(1000 + Math.random() * 9000)}`;

    try {
      // 1. Save order to backend database so shop owner sees it immediately in /pos and /admin
      const orderPayload = {
        source: channel === "ZALO" ? "ZALO" : "ONLINE",
        status: "PENDING",
        customerName:
          customerName.trim() ||
          (channel === "MESSENGER"
            ? "Khách đặt qua Messenger"
            : channel === "ZALO"
            ? "Khách đặt qua Zalo"
            : "Khách đặt nhanh"),
        customerPhone: customerPhone.trim(),
        customerAddress: customerAddress.trim(),
        note: `[Đặt nhanh qua ${channel}] ${customerNote.trim()}`.trim(),
        items: cartItems.map((i) => ({
          productId: i.product.id,
          productName: i.product.name,
          variantId: i.variant.id,
          variantName: i.variant.name,
          quantity: i.quantity,
          unitPrice: i.variant.price,
          subtotal: i.variant.price * i.quantity,
          stockDeductionPerItem: i.variant.stockDeduction,
        })),
        subtotal,
        discount: 0,
        shippingFee,
        total: grandTotal,
        paymentMethod: "COD",
        isPaid: false,
      };

      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(orderPayload),
      });
      const data = await res.json();
      if (res.ok && data?.order?.code) {
        createdOrderCode = data.order.code;
      }

      const finalBillText = buildOrderMessageText(createdOrderCode);

      // 2. Copy to clipboard so customer can paste in 1 second inside Messenger / Zalo
      try {
        await navigator.clipboard.writeText(finalBillText);
      } catch {
        // Ignore clipboard permission errors on restricted webviews
      }

      // 3. Also send into built-in web chat inbox (/api/chat) so admin has the message in web inbox
      try {
        const storedSession =
          typeof window !== "undefined"
            ? localStorage.getItem("flandi_chat_session_id")
            : null;
        const sessionId = storedSession || `chat-${Date.now()}`;
        if (typeof window !== "undefined" && !storedSession) {
          localStorage.setItem("flandi_chat_session_id", sessionId);
        }
        await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId,
            customerName: customerName.trim() || "Khách đặt bánh",
            customerPhone: customerPhone.trim(),
            sender: "CUSTOMER",
            text: finalBillText,
          }),
        });
      } catch {
        // Non-blocking
      }

      const zaloPhone = settings?.zaloPhone || settings?.phone || "0703166903";
      const fbUrl =
        settings?.facebookUrl || "https://www.facebook.com/tiem.flandi";
      // Convert facebook page url to m.me link for direct Messenger thread
      const fbSlug = fbUrl
        .replace(/^https?:\/\/(www\.)?facebook\.com\//i, "")
        .replace(/\/.*$/, "")
        .trim();
      const messengerDirectUrl = fbSlug
        ? `https://m.me/${fbSlug}?text=${encodeURIComponent(finalBillText)}`
        : fbUrl;
      const zaloDirectUrl = `https://zalo.me/${zaloPhone}`;

      const targetUrl =
        channel === "MESSENGER"
          ? messengerDirectUrl
          : channel === "ZALO"
          ? zaloDirectUrl
          : undefined;

      setSentResultModal({
        channel,
        orderCode: createdOrderCode,
        orderText: finalBillText,
        total: grandTotal,
        targetUrl,
      });

      if (targetUrl) {
        window.open(targetUrl, "_blank", "noopener,noreferrer");
      }
    } catch (err) {
      console.error(err);
      notify("Lỗi khi tạo đơn, vui lòng thử lại!");
    } finally {
      setSendingChannel(null);
    }
  };

  return (
    <div className="min-h-dvh lg:h-dvh lg:overflow-hidden bg-[#FFF9F8] bg-grid-pattern flex flex-col justify-between">
      {/* Toast Notification */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-flandi-dark text-white px-4 py-2.5 rounded-2xl shadow-cute-lg flex items-center gap-2 animate-bounce">
          <Sparkles className="w-4 h-4 text-flandi-salmon shrink-0" />
          <span className="text-xs font-extrabold">{toast}</span>
        </div>
      )}

      {/* Compact Top Header (52px) */}
      <header className="bg-white/95 backdrop-blur-md border-b border-flandi-pink px-3 sm:px-6 h-13 flex items-center justify-between shrink-0 z-20">
        <div className="flex items-center gap-2.5">
          <Link
            href="/"
            className="px-2.5 py-1.5 rounded-full bg-flandi-bg hover:bg-flandi-pink/50 text-flandi-coral border border-flandi-pink text-xs font-extrabold flex items-center gap-1 transition"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Trang chủ</span>
          </Link>
          <div className="flex items-center gap-2">
            <img
              src={
                settings?.pageConfig?.headerLogoUrl ||
                settings?.brandKit?.mascotImage ||
                "/images/branding/flandi-mascot.png"
              }
              alt="FLANDI"
              className="w-8 h-8 rounded-full object-cover border-2 border-flandi-salmon"
            />
            <div>
              <h1 className="font-display text-lg sm:text-xl text-sticker-sm leading-none">
                FLANDI — ĐẶT BÁNH NHANH 1 MÀN HÌNH
              </h1>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <span className="hidden md:inline-flex items-center gap-1 px-3 py-1 rounded-full bg-flandi-cream text-flandi-coral font-extrabold border border-flandi-pink">
            <Sparkles className="w-3.5 h-3.5" />
            Freeship đơn từ {formatVND(freeShipMin)}
          </span>
          <a
            href={`tel:${settings?.phone || "0703166903"}`}
            className="px-3 py-1.5 rounded-full bg-flandi-bg hover:bg-flandi-pink/50 text-flandi-dark font-extrabold border border-flandi-pink flex items-center gap-1.5"
          >
            <Phone className="w-3.5 h-3.5 text-flandi-coral" />
            <span>{settings?.phone || "0703166903"}</span>
          </a>
        </div>
      </header>

      {/* Main 1-Screen Workspace */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-2.5 sm:p-4 lg:overflow-hidden grid grid-cols-1 lg:grid-cols-12 gap-3 sm:gap-4 items-stretch">
        {/* Left 8 Columns: All 6 Desserts in a Compact 2x3 / 3x2 Grid */}
        <div className="lg:col-span-8 flex flex-col justify-between lg:overflow-y-auto pr-0.5">
          {loading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 h-full">
              {[1, 2, 3, 4, 5, 6].map((n) => (
                <div
                  key={n}
                  className="rounded-3xl bg-white/70 border border-flandi-pink animate-pulse p-4"
                />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 sm:gap-3.5 h-full content-between">
              {products.map((product) => {
                const activeVar = getActiveVariant(product);
                const currentQty = activeVar
                  ? getQtyFor(product.id, activeVar.id)
                  : 0;
                const totalProdQty = getTotalQtyForProduct(product.id);

                return (
                  <div
                    key={product.id}
                    className={`rounded-3xl border-2 p-2.5 sm:p-3.5 transition-all flex flex-col justify-between relative ${
                      totalProdQty > 0
                        ? "bg-white border-flandi-coral shadow-cute ring-2 ring-flandi-salmon/30"
                        : "bg-white/95 border-flandi-pink hover:border-flandi-salmon shadow-2xs"
                    }`}
                  >
                    {/* Selected Count Ribbon */}
                    {totalProdQty > 0 && (
                      <span className="absolute -top-2 -left-2 z-20 px-2.5 py-0.5 rounded-full bg-flandi-coral text-white text-[11px] font-black shadow-sm border border-white">
                        Đã chọn: {totalProdQty}
                      </span>
                    )}

                    {/* Top Row: Circular Image + Name + Price Badge */}
                    <div className="flex items-center gap-2.5">
                      <div
                        onClick={() =>
                          activeVar && updateQty(product, activeVar, 1)
                        }
                        className="cursor-pointer relative w-14 h-14 sm:w-16 sm:h-16 rounded-full p-1 bg-gradient-to-tr from-flandi-coral to-flandi-salmon shrink-0 group"
                        title="Chạm để +1 nhanh"
                      >
                        <img
                          src={product.image}
                          alt={product.name}
                          className="w-full h-full object-cover rounded-full border-2 border-white group-hover:scale-105 transition"
                        />
                      </div>

                      <div className="min-w-0 flex-1">
                        <span className="inline-block px-2 py-0.5 rounded-full bg-flandi-salmon text-white text-[10px] sm:text-[11px] font-extrabold shadow-2xs mb-0.5">
                          {product.badgeText}
                        </span>
                        <h2 className="font-display text-base sm:text-lg text-sticker-sm leading-tight truncate">
                          {product.name}
                        </h2>
                        <p className="text-[10px] sm:text-[11px] text-flandi-muted font-bold truncate">
                          {activeVar
                            ? `${formatVND(activeVar.price)} / ${activeVar.unitLabel}`
                            : product.subtitle}
                        </p>
                      </div>
                    </div>

                    {/* Middle Row: Compact Variant / Flavor Selector Pills */}
                    {product.variants.length > 1 && (
                      <div className="my-2 flex flex-wrap gap-1">
                        {product.variants.map((v) => {
                          const isSelected = activeVar?.id === v.id;
                          const vQty = getQtyFor(product.id, v.id);
                          const shortName = v.name
                            .replace(/\(.*?\)/g, "")
                            .replace("Vị ", "")
                            .replace(" — ", " ")
                            .trim();

                          return (
                            <button
                              key={v.id}
                              type="button"
                              onClick={() =>
                                setSelectedVariantByProd((prev) => ({
                                  ...prev,
                                  [product.id]: v.id,
                                }))
                              }
                              className={`px-2 py-0.5 rounded-lg text-[10px] font-extrabold border transition flex items-center gap-1 ${
                                isSelected
                                  ? "bg-flandi-coral text-white border-flandi-coral"
                                  : vQty > 0
                                  ? "bg-flandi-cream text-flandi-coral border-flandi-salmon"
                                  : "bg-flandi-bg text-flandi-dark border-flandi-pink hover:border-flandi-salmon"
                              }`}
                            >
                              <span className="truncate max-w-[95px]">
                                {shortName}
                              </span>
                              {vQty > 0 && (
                                <span
                                  className={`px-1 rounded-full text-[9px] font-black ${
                                    isSelected
                                      ? "bg-white text-flandi-coral"
                                      : "bg-flandi-coral text-white"
                                  }`}
                                >
                                  {vQty}
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    )}

                    {/* Bottom Row: Quantity Stepper [-][Qty][+] + Quick Presets */}
                    {activeVar && (
                      <div className="pt-1.5 border-t border-flandi-pink/60 flex items-center justify-between gap-1.5 mt-auto">
                        <div className="flex items-center gap-1 bg-flandi-bg rounded-full p-0.5 border border-flandi-pink">
                          <button
                            type="button"
                            onClick={() => updateQty(product, activeVar, -1)}
                            disabled={currentQty <= 0}
                            className="w-7 h-7 rounded-full bg-white hover:bg-flandi-pink/50 text-flandi-dark disabled:opacity-35 flex items-center justify-center shadow-2xs transition active:scale-90"
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                          <input
                            type="number"
                            min={0}
                            value={currentQty || ""}
                            placeholder="0"
                            onChange={(e) =>
                              setExactQty(
                                product,
                                activeVar,
                                parseInt(e.target.value, 10) || 0
                              )
                            }
                            className="w-8 text-center font-extrabold text-xs sm:text-sm text-flandi-dark bg-transparent focus:outline-none"
                          />
                          <button
                            type="button"
                            onClick={() => updateQty(product, activeVar, 1)}
                            className="w-7 h-7 rounded-full bg-flandi-coral hover:bg-flandi-salmon text-white flex items-center justify-center shadow-2xs transition active:scale-90"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        {/* Quick +5 / +10 buttons */}
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => updateQty(product, activeVar, 5)}
                            className="px-2 py-1 rounded-lg bg-flandi-cream hover:bg-flandi-salmon hover:text-white text-flandi-coral border border-flandi-pink text-[10px] font-extrabold transition"
                          >
                            +5
                          </button>
                          <button
                            type="button"
                            onClick={() => updateQty(product, activeVar, 10)}
                            className="px-2 py-1 rounded-lg bg-flandi-cream hover:bg-flandi-salmon hover:text-white text-flandi-coral border border-flandi-pink text-[10px] font-extrabold transition"
                          >
                            +10
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right 4 Columns: Live Order Ticket & Send via Messenger / Zalo */}
        <div className="lg:col-span-4 bg-white rounded-3xl border-2 border-flandi-salmon shadow-cute p-3.5 sm:p-4 flex flex-col justify-between lg:overflow-hidden">
          {/* Top Header of Ticket */}
          <div className="flex items-center justify-between border-b border-flandi-pink pb-2.5 shrink-0">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-flandi-coral text-white flex items-center justify-center">
                <ShoppingBag className="w-4 h-4" />
              </div>
              <div>
                <h2 className="font-extrabold text-sm text-flandi-dark">
                  Phiếu Đặt Bánh ({totalItemsCount} phần)
                </h2>
                <p className="text-[11px] text-flandi-muted font-semibold">
                  Chọn món bên trái → Bấm gửi qua Messenger / Zalo
                </p>
              </div>
            </div>

            {cartItems.length > 0 && (
              <button
                type="button"
                onClick={() => setCartMap({})}
                className="text-[11px] font-extrabold text-red-500 hover:underline flex items-center gap-1"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Làm mới</span>
              </button>
            )}
          </div>

          {/* Selected Items Scrollable List */}
          <div className="flex-1 overflow-y-auto my-2.5 space-y-1.5 pr-1 max-h-48 lg:max-h-none">
            {cartItems.length === 0 ? (
              <div className="h-full min-h-[110px] rounded-2xl border border-dashed border-flandi-pink bg-flandi-bg/60 flex flex-col items-center justify-center p-4 text-center">
                <Sparkles className="w-6 h-6 text-flandi-salmon mb-1" />
                <p className="text-xs font-extrabold text-flandi-dark">
                  Chưa có món bánh nào được chọn
                </p>
                <p className="text-[11px] text-flandi-muted font-medium mt-0.5">
                  Chạm vào ảnh bánh hoặc nút (+) bên trái để chọn số lượng
                </p>
              </div>
            ) : (
              cartItems.map((item) => (
                <div
                  key={`${item.product.id}__${item.variant.id}`}
                  className="p-2 rounded-xl bg-flandi-bg border border-flandi-pink flex items-center justify-between gap-2"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-extrabold text-xs text-flandi-dark truncate">
                      {item.product.name}
                    </p>
                    <p className="text-[10px] text-flandi-muted font-bold truncate">
                      {item.variant.name} • {formatVND(item.variant.price)}
                    </p>
                  </div>

                  <div className="flex items-center gap-1 bg-white rounded-full px-1.5 py-0.5 border border-flandi-pink">
                    <button
                      type="button"
                      onClick={() => updateQty(item.product, item.variant, -1)}
                      className="w-4 h-4 flex items-center justify-center text-flandi-dark"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="text-xs font-extrabold w-5 text-center">
                      {item.quantity}
                    </span>
                    <button
                      type="button"
                      onClick={() => updateQty(item.product, item.variant, 1)}
                      className="w-4 h-4 flex items-center justify-center text-flandi-coral"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>

                  <span className="text-xs font-extrabold text-flandi-coral w-16 text-right">
                    {formatVND(item.variant.price * item.quantity)}
                  </span>
                </div>
              ))
            )}
          </div>

          {/* Compact Customer Info Inputs */}
          <div className="space-y-1.5 pt-2 border-t border-flandi-pink shrink-0">
            <div className="grid grid-cols-2 gap-1.5">
              <input
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Tên của bạn (tuỳ chọn)"
                className="px-2.5 py-1.5 rounded-xl border border-flandi-pink text-xs font-semibold focus:border-flandi-coral focus:outline-none"
              />
              <input
                type="tel"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                placeholder="Số điện thoại nhận bánh"
                className="px-2.5 py-1.5 rounded-xl border border-flandi-pink text-xs font-semibold focus:border-flandi-coral focus:outline-none"
              />
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              <input
                type="text"
                value={customerAddress}
                onChange={(e) => setCustomerAddress(e.target.value)}
                placeholder="Địa chỉ giao / Giờ lấy"
                className="px-2.5 py-1.5 rounded-xl border border-flandi-pink text-xs font-semibold focus:border-flandi-coral focus:outline-none"
              />
              <input
                type="text"
                value={customerNote}
                onChange={(e) => setCustomerNote(e.target.value)}
                placeholder="Ghi chú (ít ngọt, lấy muỗng...)"
                className="px-2.5 py-1.5 rounded-xl border border-flandi-pink text-xs font-semibold focus:border-flandi-coral focus:outline-none"
              />
            </div>
          </div>

          {/* Totals + Freeship Progress */}
          <div className="pt-2 mt-2 border-t border-flandi-pink space-y-1 text-xs shrink-0">
            {subtotal > 0 && subtotal < freeShipMin ? (
              <div className="px-2.5 py-1 rounded-lg bg-flandi-cream text-flandi-coral text-[11px] font-bold flex items-center justify-between">
                <span>
                  Mua thêm <strong>{formatVND(freeShipMin - subtotal)}</strong>{" "}
                  để được <strong>FREESHIP</strong>!
                </span>
              </div>
            ) : subtotal >= freeShipMin ? (
              <div className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 text-[11px] font-extrabold">
                🎉 Đơn của bạn đã được Miễn Phí Giao Hàng!
              </div>
            ) : null}

            <div className="flex items-center justify-between pt-0.5">
              <div>
                <span className="text-[11px] text-flandi-muted font-bold block">
                  Tổng thanh toán{" "}
                  {shippingFee > 0 ? `(gồm ship ${formatVND(shippingFee)})` : ""}:
                </span>
                <span className="text-xl font-extrabold text-flandi-coral">
                  {formatVND(grandTotal)}
                </span>
              </div>

              <button
                type="button"
                onClick={handleCopyBillText}
                disabled={cartItems.length === 0}
                className="px-2.5 py-1.5 rounded-xl bg-flandi-bg hover:bg-flandi-pink/50 text-flandi-dark border border-flandi-pink text-[11px] font-extrabold flex items-center gap-1 disabled:opacity-40 transition"
                title="Sao chép nội dung đơn hàng"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                    <span className="text-emerald-700">Đã chép đơn</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 text-flandi-coral" />
                    <span>Copy đơn</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Primary Action Buttons: Send via Messenger & Send via Zalo */}
          <div className="pt-2.5 space-y-2 shrink-0">
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                disabled={cartItems.length === 0 || sendingChannel !== null}
                onClick={() => handleSendOrderVia("MESSENGER")}
                className="py-3 px-3 rounded-2xl bg-gradient-to-r from-[#00B2FF] to-[#006AFF] hover:opacity-95 text-white font-extrabold text-xs shadow-md flex items-center justify-center gap-1.5 transition active:scale-98 disabled:opacity-40"
              >
                <MessageCircle className="w-4 h-4 fill-white/20 shrink-0" />
                <span>Gửi qua Messenger</span>
              </button>

              <button
                type="button"
                disabled={cartItems.length === 0 || sendingChannel !== null}
                onClick={() => handleSendOrderVia("ZALO")}
                className="py-3 px-3 rounded-2xl bg-[#0068FF] hover:bg-[#0056D6] text-white font-extrabold text-xs shadow-md flex items-center justify-center gap-1.5 transition active:scale-98 disabled:opacity-40"
              >
                <Send className="w-4 h-4 shrink-0" />
                <span>Gửi qua Zalo</span>
              </button>
            </div>

            <button
              type="button"
              disabled={cartItems.length === 0 || sendingChannel !== null}
              onClick={() => handleSendOrderVia("DIRECT")}
              className="w-full py-2.5 px-3 rounded-2xl bg-flandi-coral hover:bg-flandi-salmon text-white font-extrabold text-xs shadow-cute flex items-center justify-center gap-1.5 transition active:scale-98 disabled:opacity-40"
            >
              <Zap className="w-4 h-4" />
              <span>Chốt Đơn Nhanh Trên Web & Hiện Mã QR</span>
            </button>
          </div>
        </div>
      </main>

      {/* Confirmation & Pre-Copied Order Modal */}
      {sentResultModal && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setSentResultModal(null)}
        >
          <div
            className="bg-white rounded-3xl max-w-md w-full p-5 border-2 border-flandi-salmon shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-2 border-b border-flandi-pink pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-extrabold text-base text-flandi-dark">
                    Đã Tạo Đơn #{sentResultModal.orderCode}!
                  </h3>
                  <p className="text-xs text-emerald-700 font-bold">
                    ✓ Nội dung đơn đã được tự động Copy vào bộ nhớ tạm
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSentResultModal(null)}
                className="p-1.5 rounded-full bg-flandi-bg hover:bg-flandi-pink/50"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 rounded-2xl bg-flandi-bg border border-flandi-pink space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold text-flandi-dark">
                  Nội dung đơn hàng (Dán vào khung chat):
                </span>
                <button
                  type="button"
                  onClick={async () => {
                    await navigator.clipboard.writeText(
                      sentResultModal.orderText
                    );
                    notify("📋 Đã sao chép lại nội dung đơn!");
                  }}
                  className="px-2.5 py-1 rounded-lg bg-white border border-flandi-pink text-[11px] font-extrabold text-flandi-coral flex items-center gap-1"
                >
                  <Copy className="w-3 h-3" />
                  <span>Copy lại</span>
                </button>
              </div>
              <pre className="text-[11px] font-semibold text-flandi-dark whitespace-pre-wrap font-sans bg-white p-2.5 rounded-xl border border-flandi-pink max-h-40 overflow-y-auto">
                {sentResultModal.orderText}
              </pre>
            </div>

            {/* Optional VietQR for instant transfer */}
            {settings && (
              <div className="p-3 rounded-2xl bg-flandi-cream/60 border border-flandi-pink flex items-center gap-3">
                <img
                  src={`https://img.vietqr.io/image/${settings.bankBin}-${settings.bankAccountNo}-compact2.png?amount=${sentResultModal.total}&addInfo=${encodeURIComponent(
                    `FLANDI ${sentResultModal.orderCode}`
                  )}`}
                  alt="VietQR"
                  className="w-20 h-20 rounded-xl bg-white border border-flandi-pink object-contain shrink-0"
                />
                <div className="text-xs space-y-0.5">
                  <p className="font-extrabold text-flandi-dark flex items-center gap-1">
                    <QrCode className="w-3.5 h-3.5 text-flandi-coral" />
                    <span>Quét VietQR thanh toán (tuỳ chọn)</span>
                  </p>
                  <p className="text-[11px] text-flandi-muted font-semibold">
                    {settings.bankName} • {settings.bankAccountNo}
                  </p>
                  <p className="text-xs font-extrabold text-flandi-coral">
                    Số tiền: {formatVND(sentResultModal.total)}
                  </p>
                </div>
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-2">
              {sentResultModal.targetUrl && (
                <a
                  href={sentResultModal.targetUrl}
                  target="_blank"
                  rel="noreferrer"
                  className={`flex-1 py-2.5 px-4 rounded-xl text-white font-extrabold text-xs flex items-center justify-center gap-1.5 shadow-md ${
                    sentResultModal.channel === "MESSENGER"
                      ? "bg-[#006AFF]"
                      : "bg-[#0068FF]"
                  }`}
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>
                    Mở lại{" "}
                    {sentResultModal.channel === "MESSENGER"
                      ? "Messenger"
                      : "Zalo"}{" "}
                    & Dán đơn
                  </span>
                </a>
              )}
              <button
                type="button"
                onClick={() => {
                  setCartMap({});
                  setSentResultModal(null);
                }}
                className="py-2.5 px-4 rounded-xl bg-gray-100 hover:bg-gray-200 text-flandi-dark font-extrabold text-xs"
              >
                Hoàn tất & Đặt đơn mới
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
