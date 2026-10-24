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
  Delete,
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
        activeProds.sort((a, b) => {
          if (a.price !== b.price) {
            return a.price - b.price;
          }
          return a.name.localeCompare(b.name, "vi");
        });
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

  // Custom numeric keypad state & methods (chỉ có số kèm nút xóa và clear)
  const [keypadProduct, setKeypadProduct] = useState<Product | null>(null);
  const [isFreshKeypadInput, setIsFreshKeypadInput] = useState<boolean>(true);

  const openKeypad = (product: Product) => {
    setKeypadProduct(product);
    setIsFreshKeypadInput(true);
  };

  const closeKeypad = () => {
    setKeypadProduct(null);
    setIsFreshKeypadInput(true);
  };

  const handleKeypadDigit = (digit: number) => {
    if (!keypadProduct) return;
    const current = getQtyForProduct(keypadProduct.id);
    let nextVal: number;
    if (isFreshKeypadInput) {
      nextVal = digit;
      setIsFreshKeypadInput(false);
    } else {
      if (current === 0) {
        nextVal = digit;
      } else {
        nextVal = Math.min(parseInt(`${current}${digit}`, 10) || 0, 999);
      }
    }
    setExactQty(keypadProduct, nextVal);
  };

  const handleKeypadBackspace = () => {
    if (!keypadProduct) return;
    setIsFreshKeypadInput(false);
    const current = getQtyForProduct(keypadProduct.id);
    const str = current.toString();
    if (str.length <= 1) {
      setExactQty(keypadProduct, 0);
    } else {
      const nextStr = str.slice(0, -1);
      setExactQty(keypadProduct, parseInt(nextStr, 10) || 0);
    }
  };

  const handleKeypadClear = () => {
    if (!keypadProduct) return;
    setIsFreshKeypadInput(false);
    setExactQty(keypadProduct, 0);
  };

  // Physical keyboard support for custom keypad
  useEffect(() => {
    if (!keypadProduct) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key >= "0" && e.key <= "9") {
        e.preventDefault();
        handleKeypadDigit(parseInt(e.key, 10));
      } else if (e.key === "Backspace") {
        e.preventDefault();
        handleKeypadBackspace();
      } else if (e.key === "Escape" || e.key === "Enter") {
        e.preventDefault();
        closeKeypad();
      } else if (e.key === "c" || e.key === "C") {
        e.preventDefault();
        handleKeypadClear();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [keypadProduct, isFreshKeypadInput, cartMap]);

  const sortedProducts = useMemo(() => {
    return [...products].sort((a, b) => {
      if (a.price !== b.price) {
        return a.price - b.price;
      }
      return a.name.localeCompare(b.name, "vi");
    });
  }, [products]);

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
    <div className="min-h-dvh h-dvh flex flex-col bg-[#FFF9F8] bg-grid-pattern relative overflow-hidden">
      {/* Toast Notification */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-flandi-dark text-white px-4 py-3 rounded-2xl shadow-cute-lg flex items-center gap-2.5 max-w-md animate-bounce">
          <Sparkles className="w-4 h-4 text-flandi-salmon shrink-0" />
          <span className="text-xs font-extrabold leading-snug">{toast}</span>
        </div>
      )}

      {/* Header with comfortable breathing room */}
      <header className="bg-white/95 backdrop-blur-md border-b border-flandi-pink/80 px-4 sm:px-6 py-3 sm:py-3.5 flex items-center justify-between shrink-0 z-20 shadow-xs">
        <div className="flex items-center gap-3">
          <img
            src={
              settings?.pageConfig?.headerLogoUrl ||
              settings?.brandKit?.mascotImage ||
              "/images/branding/flandi-mascot.png"
            }
            alt="FLANDI"
            className="w-9 h-9 sm:w-10 sm:h-10 rounded-full object-cover border-2 border-flandi-salmon shadow-xs shrink-0"
          />
          <div>
            <h1 className="font-display text-lg sm:text-xl text-sticker-sm leading-snug">
              ĐẶT BÁNH NHANH
            </h1>
            <p className="text-[10px] sm:text-[11px] font-bold text-flandi-muted leading-tight">
              {settings?.tagline || "Muốn ăn hãy Flăn vào tớ"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <span className="hidden md:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-flandi-cream text-flandi-coral font-extrabold border border-flandi-pink/80 shadow-2xs">
            <Sparkles className="w-3.5 h-3.5" />
            Freeship đơn từ {formatVND(freeShipMin)}
          </span>
          <a
            href={`tel:${settings?.phone || "0703166903"}`}
            className="px-3.5 py-1.5 rounded-full bg-flandi-bg hover:bg-flandi-pink/50 text-flandi-dark font-extrabold border border-flandi-pink flex items-center gap-1.5 shadow-2xs transition"
          >
            <Phone className="w-3.5 h-3.5 text-flandi-coral" />
            <span>{settings?.phone || "0703166903"}</span>
          </a>
        </div>
      </header>

      {/* Main Product Cards Workspace (Scales harmoniously with available vertical height) */}
      <main className="flex-1 max-w-2xl sm:max-w-3xl w-full mx-auto px-3 sm:px-4 py-2 sm:py-3 pb-24 sm:pb-28 flex flex-col justify-start overflow-y-auto">
        {loading ? (
          <div className="flex-1 flex flex-col justify-between gap-2 sm:gap-2.5 min-h-0">
            {[1, 2, 3, 4, 5, 6, 7].map((n) => (
              <div
                key={n}
                className="flex-1 min-h-[58px] sm:min-h-[68px] md:min-h-[78px] max-h-[88px] sm:max-h-[100px] md:max-h-[110px] rounded-2xl bg-white/70 border border-flandi-pink animate-pulse"
              />
            ))}
          </div>
        ) : (
          <div className="flex-1 flex flex-col justify-between gap-2 sm:gap-2.5 min-h-0">
            {sortedProducts.map((product) => {
              const currentQty = getQtyForProduct(product.id);
              const unitLabel = product.unit || "cái";
              const isSelected = currentQty > 0;
              const isKeypadTarget = keypadProduct?.id === product.id;

              return (
                <div
                  key={product.id}
                  onClick={() => openKeypad(product)}
                  className={`rounded-2xl border transition-all duration-200 overflow-hidden flex items-center justify-between px-3 sm:px-4 py-2 sm:py-2.5 md:py-3 cursor-pointer select-none gap-3 flex-1 min-h-[58px] sm:min-h-[68px] md:min-h-[78px] max-h-[88px] sm:max-h-[100px] md:max-h-[110px] ${
                    isKeypadTarget
                      ? "bg-white border-flandi-coral shadow-cute ring-2 ring-flandi-coral/60"
                      : isSelected
                      ? "bg-white border-flandi-coral/90 shadow-cute ring-1.5 ring-flandi-salmon/30"
                      : "bg-white/95 border-flandi-pink/60 hover:border-flandi-salmon/60 shadow-2xs hover:bg-white"
                  }`}
                >
                  {/* Left: Product image + Product Name + Price badge */}
                  <div className="flex items-center gap-3 sm:gap-3.5 min-w-0 flex-1">
                    <div className="relative w-14 h-14 sm:w-16 sm:h-16 md:w-[72px] md:h-[72px] rounded-2xl p-0.5 bg-gradient-to-tr from-flandi-coral to-flandi-salmon shrink-0 shadow-2xs">
                      <img
                        src={product.image}
                        alt={product.name}
                        className="w-full h-full object-cover rounded-[14px] border border-white"
                      />
                    </div>

                    <div className="min-w-0 flex flex-col justify-center">
                      <h2 className="font-display text-base sm:text-lg md:text-xl text-flandi-dark leading-tight truncate">
                        {product.name}
                      </h2>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        <span className="text-sm sm:text-base md:text-lg font-black text-flandi-coral leading-tight tracking-tight">
                          {product.badgeText}
                        </span>
                        {isSelected && (
                          <span className="text-xs sm:text-sm font-black text-flandi-coral bg-flandi-cream px-2.5 py-0.5 rounded-lg border border-flandi-pink/80 shadow-2xs">
                            = {formatVND(product.price * currentQty)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right: Ô chọn số (Bỏ chữ số lượng, để chữ cái/hộp ở sau) */}
                  <div
                    onClick={(e) => {
                      e.stopPropagation();
                      openKeypad(product);
                    }}
                    className={`h-10 sm:h-11 md:h-12 px-3.5 sm:px-4 rounded-xl sm:rounded-2xl border-2 transition-all cursor-pointer select-none flex items-center justify-center gap-1.5 shadow-2xs hover:shadow-cute active:scale-95 shrink-0 ${
                      isSelected
                        ? "bg-flandi-coral border-flandi-coral text-white shadow-cute ring-1.5 ring-flandi-salmon/40"
                        : "bg-white/95 border-flandi-pink/80 hover:border-flandi-coral text-flandi-dark/70 hover:text-flandi-coral"
                    }`}
                    title="Nhấn để nhập số lượng"
                  >
                    <span className="font-display text-base sm:text-lg md:text-xl font-black leading-none">
                      {currentQty}
                    </span>
                    <span
                      className={`text-xs sm:text-sm font-extrabold leading-none ${
                        isSelected ? "text-white/90" : "text-flandi-muted"
                      }`}
                    >
                      {unitLabel}
                    </span>
                  </div>
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
              className="px-4 py-3 sm:px-6 sm:py-3.5 flex items-center justify-between gap-3 cursor-pointer hover:bg-flandi-cream/30 transition select-none"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-flandi-coral text-white flex items-center justify-center shrink-0 shadow-2xs">
                  <ShoppingBag className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm sm:text-base font-black text-flandi-dark truncate">
                      {totalItemsCount > 0
                        ? `Đã chọn: ${totalItemsCount} phần`
                        : "Chưa chọn món nào"}
                    </span>
                    {subtotal > 0 && subtotal >= freeShipMin && (
                      <span className="hidden sm:inline-block px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-xs font-black">
                        Freeship
                      </span>
                    )}
                  </div>
                  <div className="flex items-baseline gap-1.5 mt-0.5">
                    <span className="text-xs sm:text-sm text-flandi-muted font-extrabold">
                      Thành tiền:
                    </span>
                    <span className="text-lg sm:text-xl md:text-2xl font-black text-flandi-coral tracking-tight">
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
                className={`px-4 sm:px-5 py-2.5 sm:py-3 rounded-xl sm:rounded-2xl font-black text-xs sm:text-sm flex items-center gap-1.5 shadow-cute transition active:scale-95 shrink-0 ${
                  totalItemsCount > 0
                    ? "bg-flandi-coral hover:bg-flandi-salmon text-white"
                    : "bg-flandi-bg hover:bg-flandi-pink/50 text-flandi-dark border border-flandi-pink"
                }`}
              >
                <span>{totalItemsCount > 0 ? "Gửi đơn" : "Xem thêm"}</span>
                <ChevronUp className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
              </button>
            </div>
          ) : (
            /* EXPANDED STATE: Hiển thị thêm thông tin (nhập tên, SĐT, địa chỉ, ghi chú, các nút gửi) */
            <div className="p-4 sm:p-6 space-y-3.5 max-h-[85vh] overflow-y-auto">
              {/* Header của trạng thái expand: Thông tin tóm tắt + nút collapse ở cuối */}
              <div className="flex items-center justify-between border-b border-flandi-pink pb-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-flandi-coral text-white flex items-center justify-center shrink-0 shadow-2xs">
                    <ShoppingBag className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm sm:text-base font-black text-flandi-dark">
                        Đã chọn: {totalItemsCount} phần
                      </span>
                      {cartItems.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setCartMap({})}
                          className="text-xs sm:text-sm font-extrabold text-red-500 hover:underline flex items-center gap-0.5 ml-1"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Xoá tất cả</span>
                        </button>
                      )}
                    </div>
                    <div className="flex items-baseline gap-1.5 mt-0.5">
                      <span className="text-xs sm:text-sm text-flandi-muted font-extrabold">
                        Tổng thanh toán:
                      </span>
                      <span className="text-lg sm:text-xl md:text-2xl font-black text-flandi-coral tracking-tight">
                        {formatVND(grandTotal)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Nút collapse ở cuối */}
                <button
                  type="button"
                  onClick={() => setIsExpanded(false)}
                  className="px-3.5 py-2 rounded-xl bg-flandi-bg hover:bg-flandi-pink/50 text-flandi-dark border border-flandi-pink font-black text-xs sm:text-sm flex items-center gap-1 transition"
                >
                  <span>Thu gọn</span>
                  <ChevronDown className="w-4 h-4" />
                </button>
              </div>

              {/* Freeship Progress */}
              {subtotal > 0 && subtotal < freeShipMin && (
                <div className="px-3.5 py-2 rounded-xl bg-flandi-cream text-flandi-coral text-xs sm:text-sm font-extrabold flex items-center justify-between border border-flandi-pink/60">
                  <span>+{formatVND(freeShipMin - subtotal)} để Freeship!</span>
                  <span>Phí ship: {formatVND(shippingFee)}</span>
                </div>
              )}

              {/* Customer Info Inputs */}
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="Tên của bạn (tuỳ chọn)"
                    className="px-3.5 py-2.5 sm:py-3 rounded-xl sm:rounded-2xl border border-flandi-pink text-xs sm:text-sm font-bold placeholder:text-xs sm:placeholder:text-sm focus:border-flandi-coral focus:outline-none bg-white"
                  />
                  <input
                    type="tel"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    placeholder="Số điện thoại nhận bánh"
                    className="px-3.5 py-2.5 sm:py-3 rounded-xl sm:rounded-2xl border border-flandi-pink text-xs sm:text-sm font-bold placeholder:text-xs sm:placeholder:text-sm focus:border-flandi-coral focus:outline-none bg-white"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    value={customerAddress}
                    onChange={(e) => setCustomerAddress(e.target.value)}
                    placeholder="Địa chỉ giao / Giờ lấy"
                    className="px-3.5 py-2.5 sm:py-3 rounded-xl sm:rounded-2xl border border-flandi-pink text-xs sm:text-sm font-bold placeholder:text-xs sm:placeholder:text-sm focus:border-flandi-coral focus:outline-none bg-white"
                  />
                  <input
                    type="text"
                    value={customerNote}
                    onChange={(e) => setCustomerNote(e.target.value)}
                    placeholder="Ghi chú (ít ngọt, lấy muỗng...)"
                    className="px-3.5 py-2.5 sm:py-3 rounded-xl sm:rounded-2xl border border-flandi-pink text-xs sm:text-sm font-bold placeholder:text-xs sm:placeholder:text-sm focus:border-flandi-coral focus:outline-none bg-white"
                  />
                </div>
              </div>

              {/* Primary Action Buttons: Send via Messenger & Send via Zalo */}
              <div className="space-y-2 pt-1">
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    disabled={cartItems.length === 0 || sendingChannel !== null}
                    onClick={() => handleSendOrderVia("MESSENGER")}
                    className="py-3 sm:py-3.5 px-3.5 sm:px-4 rounded-2xl bg-gradient-to-r from-[#00B2FF] to-[#006AFF] hover:opacity-95 text-white font-black text-xs sm:text-sm shadow-md flex items-center justify-center gap-2 transition active:scale-98 disabled:opacity-40"
                  >
                    <MessageCircle className="w-4.5 h-4.5 fill-white/20 shrink-0" />
                    <span>Gửi qua Messenger</span>
                  </button>

                  <button
                    type="button"
                    disabled={cartItems.length === 0 || sendingChannel !== null}
                    onClick={() => handleSendOrderVia("ZALO")}
                    className="py-3 sm:py-3.5 px-3.5 sm:px-4 rounded-2xl bg-[#0068FF] hover:bg-[#0056D6] text-white font-black text-xs sm:text-sm shadow-md flex items-center justify-center gap-2 transition active:scale-98 disabled:opacity-40"
                  >
                    <Send className="w-4.5 h-4.5 shrink-0" />
                    <span>Gửi qua Zalo</span>
                  </button>
                </div>

                <button
                  type="button"
                  disabled={cartItems.length === 0 || sendingChannel !== null}
                  onClick={() => handleSendOrderVia("DIRECT")}
                  className="w-full py-2.5 sm:py-3 px-4 rounded-2xl bg-flandi-coral hover:bg-flandi-salmon text-white font-black text-xs sm:text-sm shadow-cute flex items-center justify-center gap-2 transition active:scale-98 disabled:opacity-40"
                >
                  <Zap className="w-4 h-4" />
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

      {/* Custom Virtual Numeric Keypad Modal (Bàn phím ảo nhập số lượng) */}
      {keypadProduct && (
        <div
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200"
          onClick={closeKeypad}
        >
          <div
            className="w-full max-w-sm sm:max-w-md bg-white rounded-t-3xl sm:rounded-3xl shadow-cute-lg border-2 border-flandi-salmon overflow-hidden animate-in slide-in-from-bottom-8 sm:zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Keypad Header */}
            <div className="bg-gradient-to-r from-flandi-cream via-[#FFF3EE] to-flandi-cream px-4 py-3 border-b border-flandi-pink/80 flex items-center justify-between">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-11 h-11 rounded-xl p-0.5 bg-gradient-to-tr from-flandi-coral to-flandi-salmon shrink-0 shadow-2xs">
                  <img
                    src={keypadProduct.image}
                    alt={keypadProduct.name}
                    className="w-full h-full object-cover rounded-[10px] border border-white"
                  />
                </div>
                <div className="min-w-0">
                  <h3 className="font-display text-base font-extrabold text-flandi-dark truncate">
                    {keypadProduct.name}
                  </h3>
                  <p className="text-xs font-bold text-flandi-coral">
                    {keypadProduct.badgeText}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={closeKeypad}
                className="w-8 h-8 rounded-full bg-white/80 hover:bg-white text-flandi-muted hover:text-flandi-dark flex items-center justify-center border border-flandi-pink shadow-2xs transition active:scale-90"
                title="Đóng"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Live Quantity Display & Subtotal */}
            <div className="px-5 py-3.5 bg-white border-b border-flandi-pink/40 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-extrabold text-flandi-muted uppercase tracking-wider block">
                  Số lượng đang chọn:
                </span>
                <div className="flex items-baseline gap-1.5 mt-0.5">
                  <span className="font-display text-3xl sm:text-4xl font-black text-flandi-coral tracking-tight">
                    {getQtyForProduct(keypadProduct.id)}
                  </span>
                  <span className="text-sm font-bold text-flandi-dark/70">
                    {keypadProduct.unit || "cái"}
                  </span>
                </div>
              </div>

              <div className="text-right">
                <span className="text-[10px] font-extrabold text-flandi-muted uppercase tracking-wider block">
                  Thành tiền món này:
                </span>
                <span className="font-display text-lg sm:text-xl font-black text-flandi-dark mt-0.5 block">
                  {formatVND(keypadProduct.price * getQtyForProduct(keypadProduct.id))}
                </span>
              </div>
            </div>

            {/* Numeric Keypad Grid (Chỉ có số kèm nút xóa và clear) */}
            <div className="p-4 sm:p-5 bg-flandi-bg/40">
              <div className="grid grid-cols-3 gap-2 sm:gap-2.5">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                  <button
                    key={num}
                    type="button"
                    onClick={() => handleKeypadDigit(num)}
                    className="h-12 sm:h-14 rounded-2xl bg-white hover:bg-flandi-cream active:bg-flandi-coral active:text-white border-2 border-flandi-pink/70 text-flandi-dark font-display text-2xl font-black shadow-2xs transition active:scale-95 flex items-center justify-center select-none"
                  >
                    {num}
                  </button>
                ))}

                {/* Nút Clear (Xóa hết về 0) */}
                <button
                  type="button"
                  onClick={handleKeypadClear}
                  className="h-12 sm:h-14 rounded-2xl bg-amber-50 hover:bg-amber-100 active:bg-amber-200 border-2 border-amber-200/80 text-amber-700 font-extrabold text-sm sm:text-base shadow-2xs transition active:scale-95 flex flex-col items-center justify-center leading-tight select-none"
                  title="Xóa hết về 0"
                >
                  <span className="font-black text-xs sm:text-sm">Clear</span>
                  <span className="text-[10px] font-bold text-amber-600/80">Xóa hết</span>
                </button>

                {/* Phím số 0 */}
                <button
                  type="button"
                  onClick={() => handleKeypadDigit(0)}
                  className="h-12 sm:h-14 rounded-2xl bg-white hover:bg-flandi-cream active:bg-flandi-coral active:text-white border-2 border-flandi-pink/70 text-flandi-dark font-display text-2xl font-black shadow-2xs transition active:scale-95 flex items-center justify-center select-none"
                >
                  0
                </button>

                {/* Nút Xóa (Backspace - xóa lùi 1 ký tự) */}
                <button
                  type="button"
                  onClick={handleKeypadBackspace}
                  className="h-12 sm:h-14 rounded-2xl bg-rose-50 hover:bg-rose-100 active:bg-rose-200 border-2 border-rose-200/80 text-rose-600 font-extrabold text-sm sm:text-base shadow-2xs transition active:scale-95 flex items-center justify-center gap-1.5 select-none"
                  title="Xóa lùi 1 số"
                >
                  <Delete className="w-5 h-5" />
                  <span className="font-black text-xs sm:text-sm">Xóa</span>
                </button>
              </div>

              {/* Confirm / Done Button */}
              <button
                type="button"
                onClick={closeKeypad}
                className="w-full mt-3 py-3 sm:py-3.5 rounded-2xl bg-gradient-to-r from-flandi-coral to-flandi-salmon hover:opacity-95 text-white font-display text-base sm:text-lg font-black shadow-cute transition active:scale-98 flex items-center justify-center gap-2 select-none"
              >
                <Check className="w-5 h-5" />
                <span>
                  Xác nhận ({getQtyForProduct(keypadProduct.id)} {keypadProduct.unit || "cái"})
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

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
