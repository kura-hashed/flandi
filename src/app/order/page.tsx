"use client";

import React, { useEffect, useState, useMemo, useRef } from "react";
import Link from "next/link";
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
    Math.round(n || 0)
      .toString()
      .replace(/\B(?=(\d{3})+(?!\d))/g, ".") + "đ";

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

  const unselectedProducts = useMemo(
    () => sortedProducts.filter((p) => getQtyForProduct(p.id) === 0),
    [sortedProducts, cartMap]
  );

  const selectedProducts = useMemo(
    () => sortedProducts.filter((p) => getQtyForProduct(p.id) > 0),
    [sortedProducts, cartMap]
  );

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
        note: `[Đặt nhanh qua ${channel}]`,
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

  const renderProductCard = (product: Product, isDesktopMenu = false) => {
    const currentQty = getQtyForProduct(product.id);
    const unitLabel = product.unit || "cái";
    const isSelected = currentQty > 0;
    const isKeypadTarget = keypadProduct?.id === product.id;

    return (
      <div
        key={product.id}
        onClick={() => openKeypad(product)}
        className={`rounded-xl sm:rounded-2xl border transition-all duration-200 overflow-hidden flex items-center justify-between px-3 sm:px-4 py-2 sm:py-2.5 cursor-pointer select-none gap-3 shrink-0 ${
          isDesktopMenu
            ? "lg:h-[70px] lg:min-h-[70px]"
            : "flex-1 min-h-[48px] sm:min-h-[54px] max-h-[64px] sm:max-h-[74px]"
        } ${
          isKeypadTarget
            ? "bg-white border-flandi-coral shadow-cute ring-2 ring-flandi-coral/60"
            : isSelected
            ? "bg-white border-flandi-coral shadow-cute ring-1.5 ring-flandi-salmon/40 hover:border-flandi-coral"
            : "bg-white/95 border-flandi-pink/60 hover:border-flandi-salmon/60 shadow-2xs hover:bg-white"
        }`}
      >
        {/* Left: Product image + Product Name + Price badge */}
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className="relative w-11 h-11 sm:w-13 sm:h-13 lg:w-14 lg:h-14 rounded-xl lg:rounded-2xl p-0.5 bg-gradient-to-tr from-flandi-coral to-flandi-salmon shrink-0 shadow-2xs">
            <img
              src={product.image}
              alt={product.name}
              className="w-full h-full object-cover rounded-[10px] lg:rounded-xl border border-white"
            />
          </div>

          <div className="min-w-0 flex flex-col justify-center">
            <h2 className="font-display text-sm sm:text-base lg:text-lg font-black text-flandi-dark leading-tight truncate">
              {product.name}
            </h2>
            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
              <span className="text-xs sm:text-sm lg:text-base font-black text-flandi-coral leading-tight tracking-tight">
                {product.badgeText}
              </span>
              {isSelected && (
                <span className="text-xs sm:text-xs lg:text-sm font-extrabold text-flandi-coral bg-flandi-cream px-2 py-0.5 rounded-md border border-flandi-pink/80 shadow-2xs">
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
          className={`h-9 sm:h-10 lg:h-11 px-3 sm:px-3.5 lg:px-4 rounded-xl lg:rounded-2xl border-2 transition-all cursor-pointer select-none flex items-center justify-center gap-1 shadow-2xs hover:shadow-cute active:scale-95 shrink-0 ${
            isSelected
              ? "bg-flandi-coral border-flandi-coral text-white shadow-cute ring-1.5 ring-flandi-salmon/40"
              : "bg-white/95 border-flandi-pink/80 hover:border-flandi-coral text-flandi-dark/70 hover:text-flandi-coral"
          }`}
          title="Nhấn để nhập số lượng"
        >
          <span className="font-display text-base sm:text-lg lg:text-xl font-black leading-none">
            {currentQty}
          </span>
          <span
            className={`text-xs sm:text-xs lg:text-sm font-bold leading-none ${
              isSelected ? "text-white/90" : "text-flandi-muted"
            }`}
          >
            {unitLabel}
          </span>
        </div>
      </div>
    );
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
        <Link
          href="/"
          className="flex items-center gap-3 group transition"
          title="Về trang chủ FLANDI"
        >
          <img
            src={
              settings?.pageConfig?.headerLogoUrl ||
              settings?.brandKit?.mascotImage ||
              "/images/branding/flandi-mascot.png"
            }
            alt="FLANDI"
            className="w-9 h-9 sm:w-10 sm:h-10 rounded-full object-cover border-2 border-flandi-salmon shadow-xs shrink-0 group-hover:scale-105 transition-transform"
          />
          <div>
            <h1 className="font-display text-lg sm:text-xl text-sticker-sm leading-snug group-hover:text-flandi-coral transition-colors">
              ĐẶT BÁNH NHANH
            </h1>
            <p className="text-[10px] sm:text-[11px] font-bold text-flandi-muted leading-tight">
              {settings?.tagline || "Muốn ăn hãy Flăn vào tớ"}
            </p>
          </div>
        </Link>

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

      {/* Main Product Cards Workspace (Strictly 1 screen without scrolling) */}
      <main className="flex-1 min-h-0 max-w-2xl lg:max-w-6xl w-full mx-auto px-3 sm:px-6 lg:px-8 py-1.5 sm:py-2.5 flex flex-col justify-between overflow-hidden">
        {loading ? (
          <div className="flex-1 flex flex-col justify-between gap-2 min-h-0">
            {[1, 2, 3, 4, 5, 6, 7].map((n) => (
              <div
                key={n}
                className="flex-1 min-h-[48px] rounded-2xl bg-white/70 border border-flandi-pink animate-pulse"
              />
            ))}
          </div>
        ) : (
          <>
            {/* DESKTOP 2-COLUMN LAYOUT (lg: screens) */}
            <div className="hidden lg:grid lg:grid-cols-12 gap-6 h-full min-h-0 overflow-hidden">
              {/* CỘT TRÁI: THỰC ĐƠN (7 cột) */}
              <div className="lg:col-span-7 flex flex-col min-h-0 justify-between">
                <div className="flex items-center justify-between px-1 pb-1.5 shrink-0">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-flandi-salmon" />
                    <h2 className="font-display text-base font-black text-flandi-muted uppercase tracking-wider">
                      Thực Đơn ({sortedProducts.length} món)
                    </h2>
                  </div>
                  <span className="text-xs font-bold text-flandi-muted/80">
                    Chạm món để chọn số lượng
                  </span>
                </div>

                <div className="flex-1 flex flex-col justify-between gap-2 min-h-0">
                  {sortedProducts.map((p) => renderProductCard(p, true))}
                </div>
              </div>

              {/* CỘT PHẢI: LÊN ĐƠN & THÔNG TIN CHỐT ĐƠN (5 cột) */}
              <div className="lg:col-span-5 flex flex-col min-h-0 bg-white/95 backdrop-blur-md rounded-3xl border-2 border-flandi-salmon shadow-cute-lg p-5 justify-between overflow-hidden">
                {/* Header Cột Phải */}
                <div className="flex items-center justify-between border-b border-flandi-pink pb-2.5 shrink-0">
                  <div className="flex items-center gap-2.5">
                    <div className="w-10 h-10 rounded-2xl bg-flandi-coral text-white flex items-center justify-center shrink-0 shadow-2xs">
                      <ShoppingBag className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-display text-base lg:text-lg font-black text-flandi-dark leading-tight">
                        Lên Đơn
                      </h3>
                      <p className="text-xs font-bold text-flandi-muted">
                        {totalItemsCount > 0
                          ? `${cartItems.length} món • ${totalItemsCount} phần`
                          : "Chưa chọn món nào"}
                      </p>
                    </div>
                  </div>

                  {cartItems.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setCartMap({})}
                      className="text-xs font-extrabold text-red-500 hover:text-red-600 hover:underline flex items-center gap-1 transition"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Xoá hết</span>
                    </button>
                  )}
                </div>

                {/* Danh Sách Món Đã Chọn */}
                <div className="flex-1 overflow-y-auto py-2 space-y-2 min-h-0">
                  {cartItems.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center p-4 rounded-2xl border-2 border-dashed border-flandi-pink/70 bg-flandi-bg/50 space-y-2">
                      <div className="w-12 h-12 rounded-full bg-flandi-salmon/20 text-flandi-coral flex items-center justify-center">
                        <ShoppingBag className="w-6 h-6" />
                      </div>
                      <p className="text-sm font-extrabold text-flandi-dark">
                        Chưa chọn món nào
                      </p>
                      <p className="text-xs font-bold text-flandi-muted max-w-[200px]">
                        Bấm vào món bất kỳ bên thực đơn để chọn số lượng nha 🍮
                      </p>
                    </div>
                  ) : (
                    cartItems.map((item) => (
                      <div
                        key={item.product.id}
                        className="p-2.5 rounded-2xl bg-flandi-bg border border-flandi-pink flex items-center justify-between gap-3 shadow-2xs"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <img
                            src={item.product.image}
                            alt={item.product.name}
                            className="w-10 h-10 rounded-xl object-cover border border-white shrink-0"
                          />
                          <div className="min-w-0">
                            <h4 className="text-xs font-black text-flandi-dark truncate">
                              {item.product.name}
                            </h4>
                            <span className="text-[11px] font-bold text-flandi-muted">
                              {formatVND(item.product.price)} / {item.product.unit || "cái"}
                            </span>
                          </div>
                        </div>

                        {/* Stepper +/- */}
                        <div className="flex items-center gap-2 shrink-0">
                          <div className="flex items-center bg-white border border-flandi-pink rounded-xl p-0.5 shadow-2xs">
                            <button
                              type="button"
                              onClick={() => {
                                const next = item.quantity - 1;
                                if (next <= 0) {
                                  setCartMap((prev) => {
                                    const copy = { ...prev };
                                    delete copy[item.product.id];
                                    return copy;
                                  });
                                } else {
                                  setCartMap((prev) => ({
                                    ...prev,
                                    [item.product.id]: { ...item, quantity: next },
                                  }));
                                }
                              }}
                              className="w-7 h-7 rounded-lg hover:bg-flandi-cream flex items-center justify-center text-flandi-dark font-black transition"
                            >
                              <Minus className="w-3.5 h-3.5" />
                            </button>
                            <span className="w-7 text-center text-xs font-black text-flandi-coral">
                              {item.quantity}
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                setCartMap((prev) => ({
                                  ...prev,
                                  [item.product.id]: {
                                    ...item,
                                    quantity: item.quantity + 1,
                                  },
                                }));
                              }}
                              className="w-7 h-7 rounded-lg hover:bg-flandi-cream flex items-center justify-center text-flandi-coral font-black transition"
                            >
                              <Plus className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          <span className="text-xs font-black text-flandi-dark min-w-[55px] text-right">
                            {formatVND(item.product.price * item.quantity)}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Phần Tổng Tiền & Form Chốt Đơn */}
                <div className="border-t border-flandi-pink/80 pt-2.5 space-y-2.5 shrink-0">
                  {/* Tạm tính & Freeship */}
                  <div className="space-y-1">
                    {subtotal > 0 && subtotal < freeShipMin ? (
                      <div className="px-3 py-1.5 rounded-xl bg-flandi-cream text-flandi-coral text-xs font-extrabold flex items-center justify-between border border-flandi-pink/60">
                        <span>+{formatVND(freeShipMin - subtotal)} để Freeship!</span>
                        <span>Phí ship: {formatVND(shippingFee)}</span>
                      </div>
                    ) : subtotal >= freeShipMin ? (
                      <div className="px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-800 text-xs font-extrabold flex items-center justify-between border border-emerald-200">
                        <span>🎉 Đơn của bạn được FREESHIP!</span>
                        <span>0đ</span>
                      </div>
                    ) : null}

                    {/* Thành tiền 2 dòng */}
                    <div className="flex items-center justify-between pt-0.5">
                      <div>
                        <span className="text-xs font-extrabold text-flandi-muted block leading-none mb-1">
                          Thành tiền
                        </span>
                        <span className="text-2xl font-black text-flandi-coral tracking-tight leading-none">
                          {formatVND(grandTotal)}
                        </span>
                      </div>
                      {subtotal >= freeShipMin && (
                        <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-black">
                          Freeship
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Form Nhập Thông Tin Khách */}
                  <div className="space-y-1.5">
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="text"
                        value={customerName}
                        onChange={(e) => setCustomerName(e.target.value)}
                        placeholder="Tên của bạn (tuỳ chọn)"
                        autoComplete="off"
                        spellCheck={false}
                        className="px-3 py-2 rounded-xl border border-flandi-pink text-xs font-bold placeholder:text-xs focus:border-flandi-coral focus:outline-none bg-white"
                      />
                      <input
                        type="tel"
                        value={customerPhone}
                        onChange={(e) => setCustomerPhone(e.target.value)}
                        placeholder="Số điện thoại nhận bánh"
                        autoComplete="off"
                        spellCheck={false}
                        className="px-3 py-2 rounded-xl border border-flandi-pink text-xs font-bold placeholder:text-xs focus:border-flandi-coral focus:outline-none bg-white"
                      />
                    </div>
                    <div>
                      <input
                        type="text"
                        value={customerAddress}
                        onChange={(e) => setCustomerAddress(e.target.value)}
                        placeholder="Địa chỉ giao nhận bánh (hoặc giờ lấy)"
                        autoComplete="off"
                        spellCheck={false}
                        className="w-full px-3 py-2 rounded-xl border border-flandi-pink text-xs font-bold placeholder:text-xs focus:border-flandi-coral focus:outline-none bg-white"
                      />
                    </div>
                  </div>

                  {/* Các Nút Gửi Đơn */}
                  <div className="space-y-1.5 pt-0.5">
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        disabled={cartItems.length === 0 || sendingChannel !== null}
                        onClick={() => handleSendOrderVia("MESSENGER")}
                        className="py-2.5 px-3 rounded-xl bg-gradient-to-r from-[#006AFF] to-[#0084FF] hover:opacity-95 text-white font-black text-xs shadow-sm flex items-center justify-center gap-1.5 transition active:scale-95 disabled:opacity-40"
                      >
                        <MessageCircle className="w-4 h-4" />
                        <span>{sendingChannel === "MESSENGER" ? "Đang gửi..." : "Gửi Messenger"}</span>
                      </button>
                      <button
                        type="button"
                        disabled={cartItems.length === 0 || sendingChannel !== null}
                        onClick={() => handleSendOrderVia("ZALO")}
                        className="py-2.5 px-3 rounded-xl bg-[#0068FF] hover:bg-[#0052CC] text-white font-black text-xs shadow-sm flex items-center justify-center gap-1.5 transition active:scale-95 disabled:opacity-40"
                      >
                        <Phone className="w-4 h-4" />
                        <span>{sendingChannel === "ZALO" ? "Đang gửi..." : "Gửi qua Zalo"}</span>
                      </button>
                    </div>
                    <button
                      type="button"
                      disabled={cartItems.length === 0 || sendingChannel !== null}
                      onClick={() => handleSendOrderVia("DIRECT")}
                      className="w-full py-2.5 px-3 rounded-xl bg-flandi-coral hover:bg-flandi-salmon text-white font-black text-xs shadow-cute flex items-center justify-center gap-1.5 transition active:scale-95 disabled:opacity-40"
                    >
                      <Zap className="w-4 h-4" />
                      <span>Chốt Đơn Trực Tiếp & Mã QR</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* MOBILE LAYOUT (< lg screens) */}
            <div className="lg:hidden flex-1 flex flex-col justify-between gap-1.5 sm:gap-2 min-h-0">
              {/* PHẦN 1: THỰC ĐƠN (Các món chưa chọn) */}
              <div className="flex-1 flex flex-col min-h-0">
                <div className="flex items-center justify-between px-1 pb-1 shrink-0">
                  <div className="flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-flandi-salmon" />
                    <h2 className="font-display text-xs sm:text-sm font-black text-flandi-muted uppercase tracking-wider">
                      Thực Đơn ({unselectedProducts.length})
                    </h2>
                  </div>
                  <span className="text-xs font-bold text-flandi-muted/80">
                    Chạm món để chọn số lượng
                  </span>
                </div>

                {unselectedProducts.length === 0 ? (
                  <div className="flex-1 flex items-center justify-center rounded-xl border border-dashed border-emerald-300 bg-emerald-50/50 p-2 text-center min-h-[38px]">
                    <p className="text-xs font-black text-emerald-800">
                      🎉 Đã chọn tất cả món trong thực đơn!
                    </p>
                  </div>
                ) : (
                  <div className="flex-1 flex flex-col justify-between gap-1.5 min-h-0">
                    {unselectedProducts.map((p) => renderProductCard(p))}
                  </div>
                )}
              </div>

              {/* PHẦN 2: LÊN ĐƠN (Các món đã chốt số lượng > 0) */}
              {selectedProducts.length > 0 && (
                <div className="flex flex-col min-h-0 pt-1.5 border-t border-flandi-pink/50 shrink-0">
                  <div className="flex items-center justify-between px-1 pb-1 shrink-0">
                    <div className="flex items-center gap-1.5">
                      <ShoppingBag className="w-3.5 h-3.5 text-flandi-coral" />
                      <h2 className="font-display text-xs sm:text-sm font-black text-flandi-coral uppercase tracking-wider">
                        Lên Đơn ({selectedProducts.length} món • {totalItemsCount} phần)
                      </h2>
                    </div>
                    <button
                      type="button"
                      onClick={() => setCartMap({})}
                      className="text-xs font-extrabold text-red-500 hover:text-red-600 hover:underline flex items-center gap-1 transition"
                    >
                      <Trash2 className="w-3 h-3" />
                      <span>Xoá hết</span>
                    </button>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    {selectedProducts.map((p) => renderProductCard(p))}
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </main>

      {/* Footer bar chỉ hiện trên Mobile (< lg) vì Desktop đã có cột phải trực tiếp */}
      <div className="lg:hidden">
        {/* Backdrop when expanded */}
        {isExpanded && (
          <div
            className="fixed inset-0 z-30 bg-black/40 backdrop-blur-xs transition-opacity"
            onClick={() => setIsExpanded(false)}
          />
        )}

        {/* Bottom Order Bar: In-flow shrink-0 when collapsed, fixed bottom drawer when expanded */}
        <footer
          className={`${
            isExpanded
              ? "fixed bottom-0 left-0 right-0 z-40 p-2 sm:p-3 pointer-events-auto"
              : "shrink-0 z-20 px-3 sm:px-4 pb-2 sm:pb-3 pt-1 pointer-events-auto"
          }`}
        >
          <div className="max-w-4xl mx-auto w-full bg-white/95 backdrop-blur-md rounded-2xl sm:rounded-3xl border-2 border-flandi-salmon shadow-cute-lg overflow-hidden transition-all duration-300">
            {!isExpanded ? (
              /* COLLAPSED STATE: Chỉ hiện thành tiền (2 dòng) và nút expand ở cuối */
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
                      <span className="text-xs sm:text-sm font-extrabold text-flandi-muted">
                        Thành tiền
                      </span>
                      {subtotal > 0 && subtotal >= freeShipMin && (
                        <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] sm:text-xs font-black">
                          Freeship
                        </span>
                      )}
                    </div>
                    <div className="text-lg sm:text-xl md:text-2xl font-black text-flandi-coral tracking-tight leading-tight">
                      {formatVND(grandTotal)}
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
                {/* Header của trạng thái expand: Thành tiền 2 dòng + icon collapse ở cuối */}
                <div className="flex items-center justify-between border-b border-flandi-pink pb-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-flandi-coral text-white flex items-center justify-center shrink-0 shadow-2xs">
                      <ShoppingBag className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs sm:text-sm font-extrabold text-flandi-muted">
                          Thành tiền
                        </span>
                        {subtotal > 0 && subtotal >= freeShipMin && (
                          <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] sm:text-xs font-black">
                            Freeship
                          </span>
                        )}
                      </div>
                      <div className="text-lg sm:text-xl md:text-2xl font-black text-flandi-coral tracking-tight leading-tight">
                        {formatVND(grandTotal)}
                      </div>
                    </div>
                  </div>

                  {/* Nút collapse icon ở cuối */}
                  <button
                    type="button"
                    onClick={() => setIsExpanded(false)}
                    aria-label="Thu gọn"
                    title="Thu gọn"
                    className="w-10 h-10 rounded-xl sm:rounded-2xl bg-flandi-bg hover:bg-flandi-pink/50 text-flandi-dark border border-flandi-pink flex items-center justify-center transition active:scale-95 shrink-0"
                  >
                    <ChevronDown className="w-5 h-5" />
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
                      autoComplete="off"
                      spellCheck={false}
                      className="px-3.5 py-2.5 sm:py-3 rounded-xl sm:rounded-2xl border border-flandi-pink text-xs sm:text-sm font-bold placeholder:text-xs sm:placeholder:text-sm focus:border-flandi-coral focus:outline-none bg-white"
                    />
                    <input
                      type="tel"
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                      placeholder="Số điện thoại nhận bánh"
                      autoComplete="off"
                      spellCheck={false}
                      className="px-3.5 py-2.5 sm:py-3 rounded-xl sm:rounded-2xl border border-flandi-pink text-xs sm:text-sm font-bold placeholder:text-xs sm:placeholder:text-sm focus:border-flandi-coral focus:outline-none bg-white"
                    />
                  </div>
                  <div>
                    <input
                      type="text"
                      value={customerAddress}
                      onChange={(e) => setCustomerAddress(e.target.value)}
                      placeholder="Địa chỉ giao nhận bánh (hoặc giờ lấy)"
                      autoComplete="off"
                      spellCheck={false}
                      className="w-full px-3.5 py-2.5 sm:py-3 rounded-xl sm:rounded-2xl border border-flandi-pink text-xs sm:text-sm font-bold placeholder:text-xs sm:placeholder:text-sm focus:border-flandi-coral focus:outline-none bg-white"
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
        </footer>
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
