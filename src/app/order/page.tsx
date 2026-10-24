"use client";

import React, { useEffect, useState, useMemo, useRef } from "react";
import {
  Plus,
  Minus,
  Trash2,
  Copy,
  Check,
  Sparkles,
  Send,
  MessageCircle,
  Phone,
  ShoppingBag,
  QrCode,
  CheckCircle2,
  X,
  Zap,
  Share2,
  ChevronUp,
  ChevronDown,
} from "lucide-react";
import { Product, ProductVariant, ShopSettings } from "@/lib/types";
import LiveChatWidget, {
  copyToClipboardInstant,
} from "@/components/LiveChatWidget";

interface QuickLineItem {
  product: Product;
  variant: ProductVariant;
  quantity: number;
}

export default function QuickSingleScreenOrderPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [settings, setSettings] = useState<ShopSettings | null>(null);
  const [loading, setLoading] = useState(true);

  // Cart keyed by productId
  const [cartMap, setCartMap] = useState<Record<string, QuickLineItem>>({});
  const [isExpanded, setIsExpanded] = useState(false);
  const [expandedProductIds, setExpandedProductIds] = useState<Record<string, boolean>>({});

  const toggleProductExpand = (id: string) => {
    setExpandedProductIds((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

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
  const [openChatTrigger, setOpenChatTrigger] = useState(0);
  const [chatRefreshTrigger, setChatRefreshTrigger] = useState(0);
  const [preferredChatChannel, setPreferredChatChannel] = useState<
    "MESSENGER" | "ZALO"
  >("MESSENGER");
  const [sentResultModal, setSentResultModal] = useState<{
    channel: "MESSENGER" | "ZALO" | "DIRECT";
    orderCode: string;
    orderText: string;
    total: number;
    zaloWebUrl: string;
    messengerWebUrl: string;
    zaloPhone: string;
  } | null>(null);

  const billTextareaRef = useRef<HTMLTextAreaElement | null>(null);

  const notify = (msg: string) => {
    setToast(msg);
    setTimeout(() => {
      setToast((prev) => (prev === msg ? null : prev));
    }, 3500);
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
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const getBaseVariant = (product: Product): ProductVariant => {
    return (
      product.variants?.[0] || {
        id: `${product.id}-base`,
        name: product.name,
        price: product.price,
        unitLabel: product.unit || "cái",
        stockDeduction: 1,
      }
    );
  };

  const getQtyForProduct = (productId: string): number => {
    return cartMap[productId]?.quantity || 0;
  };

  const updateQty = (product: Product, delta: number) => {
    const variant = getBaseVariant(product);
    setCartMap((prev) => {
      const current = prev[product.id]?.quantity || 0;
      const nextQty = Math.max(0, current + delta);
      const copy = { ...prev };
      if (nextQty <= 0) {
        delete copy[product.id];
      } else {
        copy[product.id] = { product, variant, quantity: nextQty };
      }
      return copy;
    });
  };

  const setExactQty = (product: Product, qty: number) => {
    const variant = getBaseVariant(product);
    setCartMap((prev) => {
      const copy = { ...prev };
      if (qty <= 0) {
        delete copy[product.id];
      } else {
        copy[product.id] = { product, variant, quantity: qty };
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
    () => cartItems.reduce((s, i) => s + i.product.price * i.quantity, 0),
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

  // Build formatted text message for Messenger / Zalo (clean, without extra category/variant labels)
  const buildOrderMessageText = (code?: string) => {
    const lines: string[] = [];
    lines.push(
      `🍮 ĐƠN ĐẶT BÁNH FLANDI ${code ? `(#${code})` : ""}`.trim()
    );
    lines.push("------------------------");
    cartItems.forEach((item, idx) => {
      lines.push(
        `${idx + 1}. ${item.product.name}: ${item.quantity} ${
          item.product.unit || "cái"
        } x ${formatVND(item.product.price)} = ${formatVND(
          item.product.price * item.quantity
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

  const liveOrderPreviewText = useMemo(
    () => (cartItems.length > 0 ? buildOrderMessageText() : ""),
    [
      cartItems,
      subtotal,
      shippingFee,
      grandTotal,
      customerName,
      customerPhone,
      customerAddress,
      customerNote,
    ]
  );

  const handleCopyBillText = () => {
    if (cartItems.length === 0) {
      notify("Bạn hãy chọn số lượng ít nhất 1 món bánh nhé!");
      return;
    }
    const text = buildOrderMessageText();
    copyToClipboardInstant(text);
    setCopied(true);
    notify(
      "📋 Đã tự động Copy đơn hàng! Bạn chỉ cần bấm Ctrl+V (hoặc Dán) vào khung chat Zalo/Messenger."
    );
    setTimeout(() => setCopied(false), 2500);
  };

  const handleSendOrderVia = async (
    channel: "MESSENGER" | "ZALO" | "DIRECT"
  ) => {
    if (cartItems.length === 0) {
      notify("🍮 Bạn hãy chọn số lượng món bánh trước khi gửi đơn nha!");
      return;
    }

    // 1. Copy to clipboard SYNCHRONOUSLY (0ms) inside the user click gesture!
    const generatedCode = `FL-${Math.floor(1000 + Math.random() * 9000)}`;
    const billText = buildOrderMessageText(generatedCode);
    copyToClipboardInstant(billText);
    setCopied(true);
    setTimeout(() => setCopied(false), 3500);

    const zaloPhone = settings?.zaloPhone || settings?.phone || "0703166903";
    const fbUrl =
      settings?.facebookUrl || "https://www.facebook.com/tiem.flandi";

    const zaloWebUrl = "https://chat.zalo.me";
    const messengerWebUrl = fbUrl;

    if (channel === "ZALO" || channel === "MESSENGER") {
      setPreferredChatChannel(channel);
    }

    setSendingChannel(channel);

    try {
      // 2. Save order to backend database (/api/orders)
      const orderPayload = {
        code: generatedCode,
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
          variantName: i.product.unit || "cái",
          quantity: i.quantity,
          unitPrice: i.product.price,
          subtotal: i.product.price * i.quantity,
          stockDeductionPerItem: 1,
        })),
        subtotal,
        discount: 0,
        shippingFee,
        total: grandTotal,
        paymentMethod: "COD",
        isPaid: false,
      };

      await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(orderPayload),
      });

      // 3. Send the order text directly into the on-page Messenger / Zalo Chat (/api/chat)
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
          customerName:
            customerName.trim() ||
            (channel === "ZALO" ? "Khách Zalo Web" : "Khách Messenger Web"),
          customerPhone: customerPhone.trim(),
          sender: "CUSTOMER",
          text: billText,
        }),
      });

      setChatRefreshTrigger((n) => n + 1);

      if (channel === "MESSENGER" || channel === "ZALO") {
        setOpenChatTrigger((n) => n + 1);
        notify(
          channel === "ZALO"
            ? `✅ Đã tự động dán & gửi đơn #${generatedCode} vào khung Chat Zalo trực tiếp trên trang!`
            : `✅ Đã tự động dán & gửi đơn #${generatedCode} vào khung Chat Messenger trực tiếp trên trang!`
        );
      } else {
        setSentResultModal({
          channel,
          orderCode: generatedCode,
          orderText: billText,
          total: grandTotal,
          zaloWebUrl,
          messengerWebUrl,
          zaloPhone,
        });
      }
    } catch (err) {
      console.error(err);
      notify("Đã copy đơn vào bộ nhớ tạm!");
    } finally {
      setSendingChannel(null);
    }
  };

  return (
    <div className="min-h-dvh bg-[#FFF9F8] bg-grid-pattern flex flex-col justify-start relative">
      {/* Toast Notification */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-flandi-dark text-white px-4 py-3 rounded-2xl shadow-cute-lg flex items-center gap-2.5 max-w-md animate-bounce">
          <Sparkles className="w-4 h-4 text-flandi-salmon shrink-0" />
          <span className="text-xs font-extrabold leading-snug">{toast}</span>
        </div>
      )}

      {/* Compact Top Header (No back-to-home button) */}
      <header className="bg-white/95 backdrop-blur-md border-b border-flandi-pink px-3 sm:px-6 h-13 flex items-center justify-between shrink-0 z-20 sticky top-0">
        <div className="flex items-center gap-2.5">
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
              ĐẶT BÁNH NHANH
            </h1>
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

      {/* Main Product Cards Workspace (Minimalist 1-screen rows with inline expand) */}
      <main className="flex-1 max-w-2xl w-full mx-auto p-2 sm:p-3 pb-24 sm:pb-28">
        {loading ? (
          <div className="flex flex-col gap-1.5">
            {[1, 2, 3, 4, 5, 6, 7].map((n) => (
              <div
                key={n}
                className="h-12 rounded-2xl bg-white/70 border border-flandi-pink animate-pulse"
              />
            ))}
          </div>
        ) : (
          <div className="flex flex-col gap-1.5 sm:gap-2">
            {products.map((product) => {
              const currentQty = getQtyForProduct(product.id);
              const unitLabel = product.unit || "cái";
              const isBoxProduct =
                unitLabel.toLowerCase() === "hộp" ||
                product.id === "prod-rau-cau-la";
              const preset1 = isBoxProduct ? 1 : 5;
              const preset2 = isBoxProduct ? 2 : 10;

              const isSelected = currentQty > 0;
              const isCardExpanded = !!expandedProductIds[product.id];

              return (
                <div
                  key={product.id}
                  className={`rounded-2xl border transition-all duration-200 overflow-hidden ${
                    isSelected
                      ? "bg-white border-flandi-coral shadow-cute ring-1.5 ring-flandi-salmon/40"
                      : "bg-white/95 border-flandi-pink/50 hover:border-flandi-salmon/60 shadow-2xs"
                  }`}
                >
                  {/* Collapsed Header Row (Always visible, tap to toggle expand) */}
                  <div
                    onClick={() => toggleProductExpand(product.id)}
                    className="px-2.5 py-1.5 sm:px-3 sm:py-2 flex items-center justify-between gap-2.5 cursor-pointer select-none hover:bg-flandi-cream/25 transition"
                  >
                    {/* Left: Mini product image + Product Name + Price badge */}
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="relative w-10 h-10 sm:w-11 sm:h-11 rounded-full p-0.5 bg-gradient-to-tr from-flandi-coral to-flandi-salmon shrink-0 shadow-2xs">
                        <img
                          src={product.image}
                          alt={product.name}
                          className="w-full h-full object-cover rounded-full border border-white"
                        />
                      </div>

                      <div className="min-w-0 flex flex-col justify-center">
                        <h2 className="font-display text-sm sm:text-base text-flandi-dark leading-tight truncate">
                          {product.name}
                        </h2>
                        <span className="text-[11px] font-extrabold text-flandi-coral leading-tight">
                          {product.badgeText}
                        </span>
                      </div>
                    </div>

                    {/* Right: Selected quantity status badge + Expand / Collapse button */}
                    <div className="flex items-center gap-2 shrink-0">
                      {isSelected ? (
                        <span className="px-2.5 py-1 rounded-full bg-flandi-coral text-white text-[11px] font-black shadow-2xs">
                          {currentQty} {unitLabel} • {formatVND(product.price * currentQty)}
                        </span>
                      ) : (
                        <span className="px-2.5 py-1 rounded-xl bg-flandi-cream text-flandi-coral text-xs font-extrabold border border-flandi-pink/70">
                          + Chọn
                        </span>
                      )}

                      <div
                        className={`w-7 h-7 rounded-xl flex items-center justify-center transition-transform duration-200 ${
                          isCardExpanded
                            ? "rotate-180 bg-flandi-cream text-flandi-coral"
                            : "bg-flandi-bg text-flandi-muted"
                        }`}
                      >
                        <ChevronDown className="w-4 h-4" />
                      </div>
                    </div>
                  </div>

                  {/* Expanded Quantity Controls Section */}
                  {isCardExpanded && (
                    <div className="px-3 pb-2.5 pt-1.5 border-t border-flandi-pink/40 bg-flandi-cream/15">
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() =>
                            setExactQty(
                              product,
                              currentQty === preset1 ? 0 : preset1
                            )
                          }
                          className={`shrink-0 h-8 px-2.5 rounded-xl text-xs font-extrabold border transition whitespace-nowrap ${
                            currentQty === preset1
                              ? "bg-flandi-coral text-white border-flandi-coral shadow-2xs"
                              : "bg-white hover:bg-flandi-cream text-flandi-dark border-flandi-pink"
                          }`}
                        >
                          {isBoxProduct ? "1 hộp" : "5 cái"}
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            setExactQty(
                              product,
                              currentQty === preset2 ? 0 : preset2
                            )
                          }
                          className={`shrink-0 h-8 px-2.5 rounded-xl text-xs font-extrabold border transition whitespace-nowrap ${
                            currentQty === preset2
                              ? "bg-flandi-coral text-white border-flandi-coral shadow-2xs"
                              : "bg-white hover:bg-flandi-cream text-flandi-dark border-flandi-pink"
                          }`}
                        >
                          {isBoxProduct ? "2 hộp" : "10 cái"}
                        </button>

                        {/* Direct Quantity Input on the same row (placeholder "0") */}
                        <div className="flex-1 min-w-0 h-8 flex items-center bg-white rounded-xl px-1 border border-flandi-pink">
                          <button
                            type="button"
                            onClick={() => updateQty(product, -1)}
                            disabled={currentQty <= 0}
                            className="w-6 h-6 rounded-lg bg-flandi-bg hover:bg-flandi-pink/50 text-flandi-dark disabled:opacity-35 flex items-center justify-center shadow-2xs transition active:scale-90 shrink-0"
                          >
                            <Minus className="w-3 h-3" />
                          </button>

                          <input
                            type="number"
                            min={0}
                            value={currentQty || ""}
                            placeholder="0"
                            onChange={(e) =>
                              setExactQty(
                                product,
                                parseInt(e.target.value, 10) || 0
                              )
                            }
                            className="w-full min-w-0 mx-1 text-center font-extrabold text-xs text-flandi-coral bg-transparent h-6 px-1 placeholder:text-xs placeholder:font-bold placeholder:text-flandi-muted focus:outline-none"
                          />

                          <button
                            type="button"
                            onClick={() => updateQty(product, 1)}
                            className="w-6 h-6 rounded-lg bg-flandi-coral hover:bg-flandi-salmon text-white flex items-center justify-center shadow-2xs transition active:scale-90 shrink-0"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>

                        {/* Trash button to clear quantity of this product */}
                        {currentQty > 0 && (
                          <button
                            type="button"
                            onClick={() => setExactQty(product, 0)}
                            title="Xoá số lượng món này"
                            className="shrink-0 w-8 h-8 rounded-xl border border-red-200 bg-red-50 hover:bg-red-100 text-red-500 flex items-center justify-center transition active:scale-90"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Backdrop when expanded */}
      {isExpanded && (
        <div
          className="fixed inset-0 z-30 bg-black/40 backdrop-blur-xs transition-opacity"
          onClick={() => setIsExpanded(false)}
        />
      )}

      {/* Fixed Bottom Order Bar (Collapse / Expand) */}
      <div className="fixed bottom-0 left-0 right-0 z-30 p-2 sm:p-3 pointer-events-none">
        <div className="max-w-4xl mx-auto w-full pointer-events-auto bg-white/95 backdrop-blur-md rounded-2xl sm:rounded-3xl border-2 border-flandi-salmon shadow-cute-lg overflow-hidden transition-all duration-300">
          {!isExpanded ? (
            /* COLLAPSED STATE: Chỉ hiện thông tin đã chọn, thành tiền và nút expand ở cuối */
            <div
              onClick={() => setIsExpanded(true)}
              className="px-3.5 py-2.5 sm:px-5 sm:py-3 flex items-center justify-between gap-3 cursor-pointer hover:bg-flandi-cream/30 transition select-none"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-flandi-coral text-white flex items-center justify-center shrink-0 shadow-2xs">
                  <ShoppingBag className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-extrabold text-flandi-dark truncate">
                      {totalItemsCount > 0
                        ? `Đã chọn: ${totalItemsCount} phần`
                        : "Chưa chọn món nào"}
                    </span>
                    {subtotal > 0 && subtotal >= freeShipMin && (
                      <span className="hidden sm:inline-block px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-black">
                        Freeship
                      </span>
                    )}
                  </div>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-[11px] text-flandi-muted font-bold">
                      Thành tiền:
                    </span>
                    <span className="text-base sm:text-lg font-black text-flandi-coral">
                      {formatVND(grandTotal)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Nút expand ở cuối */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsExpanded(true);
                }}
                className={`px-3.5 sm:px-4 py-2 rounded-xl sm:rounded-2xl font-extrabold text-xs flex items-center gap-1.5 shadow-cute transition active:scale-95 shrink-0 ${
                  totalItemsCount > 0
                    ? "bg-flandi-coral hover:bg-flandi-salmon text-white"
                    : "bg-flandi-bg hover:bg-flandi-pink/50 text-flandi-dark border border-flandi-pink"
                }`}
              >
                <span>{totalItemsCount > 0 ? "Gửi đơn" : "Xem thêm"}</span>
                <ChevronUp className="w-4 h-4" />
              </button>
            </div>
          ) : (
            /* EXPANDED STATE: Hiển thị thêm thông tin (nhập tên, SĐT, địa chỉ, ghi chú, các nút gửi) */
            <div className="p-3.5 sm:p-5 space-y-3 max-h-[85vh] overflow-y-auto">
              {/* Header của trạng thái expand: Thông tin tóm tắt + nút collapse ở cuối */}
              <div className="flex items-center justify-between border-b border-flandi-pink pb-2.5">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-flandi-coral text-white flex items-center justify-center shrink-0">
                    <ShoppingBag className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-extrabold text-flandi-dark">
                        Đã chọn: {totalItemsCount} phần
                      </span>
                      {cartItems.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setCartMap({})}
                          className="text-[11px] font-extrabold text-red-500 hover:underline flex items-center gap-0.5"
                        >
                          <Trash2 className="w-3 h-3" />
                          <span>Xoá tất cả</span>
                        </button>
                      )}
                    </div>
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-[11px] text-flandi-muted font-bold">
                        Tổng thanh toán:
                      </span>
                      <span className="text-base sm:text-lg font-black text-flandi-coral">
                        {formatVND(grandTotal)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Nút collapse ở cuối */}
                <button
                  type="button"
                  onClick={() => setIsExpanded(false)}
                  className="px-3 py-1.5 rounded-xl bg-flandi-bg hover:bg-flandi-pink/50 text-flandi-dark border border-flandi-pink font-extrabold text-xs flex items-center gap-1 transition"
                >
                  <span>Thu gọn</span>
                  <ChevronDown className="w-4 h-4" />
                </button>
              </div>

              {/* Freeship Progress */}
              {subtotal > 0 && subtotal < freeShipMin && (
                <div className="px-3 py-1.5 rounded-xl bg-flandi-cream text-flandi-coral text-[11px] font-extrabold flex items-center justify-between border border-flandi-pink/60">
                  <span>+{formatVND(freeShipMin - subtotal)} để Freeship!</span>
                  <span>Phí ship: {formatVND(shippingFee)}</span>
                </div>
              )}

              {/* Customer Info Inputs */}
              <div className="space-y-1.5">
                <div className="grid grid-cols-2 gap-1.5">
                  <input
                    type="text"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="Tên của bạn (tuỳ chọn)"
                    className="px-2.5 py-2 rounded-xl border border-flandi-pink text-xs font-semibold focus:border-flandi-coral focus:outline-none bg-white"
                  />
                  <input
                    type="tel"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    placeholder="Số điện thoại nhận bánh"
                    className="px-2.5 py-2 rounded-xl border border-flandi-pink text-xs font-semibold focus:border-flandi-coral focus:outline-none bg-white"
                  />
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  <input
                    type="text"
                    value={customerAddress}
                    onChange={(e) => setCustomerAddress(e.target.value)}
                    placeholder="Địa chỉ giao / Giờ lấy"
                    className="px-2.5 py-2 rounded-xl border border-flandi-pink text-xs font-semibold focus:border-flandi-coral focus:outline-none bg-white"
                  />
                  <input
                    type="text"
                    value={customerNote}
                    onChange={(e) => setCustomerNote(e.target.value)}
                    placeholder="Ghi chú (ít ngọt, lấy muỗng...)"
                    className="px-2.5 py-2 rounded-xl border border-flandi-pink text-xs font-semibold focus:border-flandi-coral focus:outline-none bg-white"
                  />
                </div>
              </div>

              {/* Primary Action Buttons: Send via Messenger & Send via Zalo */}
              <div className="space-y-1.5 pt-1">
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    disabled={cartItems.length === 0 || sendingChannel !== null}
                    onClick={() => handleSendOrderVia("MESSENGER")}
                    className="py-2.5 px-3 rounded-2xl bg-gradient-to-r from-[#00B2FF] to-[#006AFF] hover:opacity-95 text-white font-extrabold text-xs shadow-md flex items-center justify-center gap-1.5 transition active:scale-98 disabled:opacity-40"
                  >
                    <MessageCircle className="w-4 h-4 fill-white/20 shrink-0" />
                    <span>Gửi qua Messenger</span>
                  </button>

                  <button
                    type="button"
                    disabled={cartItems.length === 0 || sendingChannel !== null}
                    onClick={() => handleSendOrderVia("ZALO")}
                    className="py-2.5 px-3 rounded-2xl bg-[#0068FF] hover:bg-[#0056D6] text-white font-extrabold text-xs shadow-md flex items-center justify-center gap-1.5 transition active:scale-98 disabled:opacity-40"
                  >
                    <Send className="w-4 h-4 shrink-0" />
                    <span>Gửi qua Zalo</span>
                  </button>
                </div>

                <button
                  type="button"
                  disabled={cartItems.length === 0 || sendingChannel !== null}
                  onClick={() => handleSendOrderVia("DIRECT")}
                  className="w-full py-2 px-3 rounded-2xl bg-flandi-coral hover:bg-flandi-salmon text-white font-extrabold text-xs shadow-cute flex items-center justify-center gap-1.5 transition active:scale-98 disabled:opacity-40"
                >
                  <Zap className="w-3.5 h-3.5" />
                  <span>Chốt Đơn Trực Tiếp & Hiện Mã QR</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Embedded On-Page Messenger & Zalo Chat Widget */}
      <LiveChatWidget
        settings={settings}
        cartCount={totalItemsCount}
        externalOpenTrigger={openChatTrigger}
        preferredChannel={preferredChatChannel}
        refreshTrigger={chatRefreshTrigger}
        cartSummaryText={liveOrderPreviewText || undefined}
      />

      {/* Confirmation & Pre-Copied Order Modal */}
      {sentResultModal && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setSentResultModal(null)}
        >
          <div
            className="bg-white rounded-3xl max-w-md w-full p-5 border-2 border-flandi-salmon shadow-2xl space-y-3.5"
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
                  <p className="text-xs text-emerald-700 font-extrabold">
                    ✓ Đã đồng bộ vào tiệm & Copy sẵn đơn hàng!
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
                  Nội dung đơn hàng đã Copy:
                </span>
                <button
                  type="button"
                  onClick={() => {
                    copyToClipboardInstant(sentResultModal.orderText);
                    notify("📋 Đã Copy lại nội dung đơn hàng!");
                  }}
                  className="px-2.5 py-1 rounded-lg bg-flandi-coral text-white text-[11px] font-extrabold flex items-center gap-1 shadow-2xs"
                >
                  <Copy className="w-3 h-3" />
                  <span>Bấm Copy Lại</span>
                </button>
              </div>
              <textarea
                readOnly
                rows={5}
                value={sentResultModal.orderText}
                onClick={(e) => {
                  e.currentTarget.select();
                  copyToClipboardInstant(sentResultModal.orderText);
                  notify("📋 Đã Copy nội dung đơn hàng!");
                }}
                className="w-full text-[11px] font-semibold text-flandi-dark bg-white p-2.5 rounded-xl border border-flandi-pink resize-none focus:outline-none"
              />
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

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  setSentResultModal(null);
                  setPreferredChatChannel("ZALO");
                  setOpenChatTrigger((n) => n + 1);
                }}
                className="py-2.5 px-3 rounded-xl bg-[#0068FF] hover:bg-[#0056D6] text-white font-extrabold text-xs flex items-center justify-center gap-1.5 shadow-md"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Mở Chat Zalo Trực Tiếp</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setSentResultModal(null);
                  setPreferredChatChannel("MESSENGER");
                  setOpenChatTrigger((n) => n + 1);
                }}
                className="py-2.5 px-3 rounded-xl bg-[#006AFF] hover:opacity-95 text-white font-extrabold text-xs flex items-center justify-center gap-1.5 shadow-md"
              >
                <MessageCircle className="w-3.5 h-3.5" />
                <span>Mở Chat Messenger Trực Tiếp</span>
              </button>
            </div>

            {typeof navigator !== "undefined" && "share" in navigator && (
              <button
                type="button"
                onClick={async () => {
                  try {
                    await navigator.share({
                      title: `Đơn bánh FLANDI #${sentResultModal.orderCode}`,
                      text: sentResultModal.orderText,
                    });
                  } catch {
                    // User cancelled share sheet
                  }
                }}
                className="w-full py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs flex items-center justify-center gap-1.5 shadow-sm"
              >
                <Share2 className="w-3.5 h-3.5" />
                <span>Chia sẻ vào App Zalo / Messenger trên máy</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                setCartMap({});
                setSentResultModal(null);
              }}
              className="w-full py-2.5 px-4 rounded-xl bg-gray-100 hover:bg-gray-200 text-flandi-dark font-extrabold text-xs"
            >
              Hoàn tất & Đặt đơn mới
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
