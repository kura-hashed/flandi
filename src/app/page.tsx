"use client";

import React, { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import {
  ShoppingBag,
  Sparkles,
  Phone,
  MapPin,
  Clock,
  Plus,
  Minus,
  Trash2,
  CheckCircle2,
  Heart,
  Star,
  Store,
  Search,
  X,
  ArrowRight,
  Copy,
  Check,
  QrCode,
  Truck,
  ShieldCheck,
  Image as ImageIcon,
} from "lucide-react";
import { Product, ProductVariant, Order, ShopSettings } from "@/lib/types";
import MenuPoster from "@/components/MenuPoster";
import LiveChatWidget from "@/components/LiveChatWidget";
import { FALLBACK_PAGE_CONFIG } from "@/components/PageManager";

interface CartItem {
  product: Product;
  variant: ProductVariant;
  quantity: number;
}

export default function FlandiLandingPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [settings, setSettings] = useState<ShopSettings | null>(null);
  const [pendingOrdersCount, setPendingOrdersCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedVariants, setSelectedVariants] = useState<Record<string, string>>({});
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [showPosterModal, setShowPosterModal] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Checkout state
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [deliveryType, setDeliveryType] = useState<"DELIVERY" | "PICKUP">("DELIVERY");
  const [customerAddress, setCustomerAddress] = useState("");
  const [orderNote, setOrderNote] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"VIETQR" | "COD">("VIETQR");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [completedOrder, setCompletedOrder] = useState<Order | null>(null);
  const [copiedOrderText, setCopiedOrderText] = useState(false);
  const [openChatTrigger, setOpenChatTrigger] = useState(0);

  const fetchStoreData = async () => {
    try {
      const res = await fetch("/api/store", { cache: "no-store" });
      const data = await res.json();
      const activeProducts: Product[] = (data.products || []).filter(
        (p: Product) => p.isActive
      );
      setProducts(activeProducts);
      setSettings(data.settings);
      const pending = (data.orders || []).filter(
        (o: Order) => o.status === "PENDING" || o.status === "PREPARING"
      ).length;
      setPendingOrdersCount(pending);

      const initialVars: Record<string, string> = {};
      activeProducts.forEach((p) => {
        if (p.variants?.length > 0) {
          initialVars[p.id] = p.variants[0].id;
        }
      });
      setSelectedVariants((prev) => ({ ...initialVars, ...prev }));
    } catch (err) {
      console.error("Failed to load store:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStoreData();
  }, []);

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? null : prev));
    }, 2600);
  };

  const formatVND = (amount: number) =>
    new Intl.NumberFormat("vi-VN").format(amount) + "đ";

  const categories = [
    { id: "ALL", label: "Tất cả món ngon" },
    { id: "Flan & Pudding", label: "Bánh Flan" },
    { id: "Panna Cotta", label: "Panna Cotta" },
    { id: "Rau Câu", label: "Rau Câu Dừa & Lá" },
    { id: "Tàu Hũ & Yogurt", label: "Tàu Hũ & Yogurt" },
  ];

  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const matchCat =
        selectedCategory === "ALL" || p.category === selectedCategory;
      const q = searchQuery.trim().toLowerCase();
      const matchSearch =
        !q ||
        p.name.toLowerCase().includes(q) ||
        p.subtitle.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q);
      return matchCat && matchSearch;
    });
  }, [products, selectedCategory, searchQuery]);

  const handleAddToCart = (product: Product, customVariant?: ProductVariant) => {
    const variantId = selectedVariants[product.id] || product.variants[0]?.id;
    const variant =
      customVariant ||
      product.variants.find((v) => v.id === variantId) ||
      product.variants[0];

    if (!variant) return;

    if (product.stock < variant.stockDeduction) {
      triggerToast(`Món ${product.name} hiện không đủ số lượng cho phân loại này!`);
      return;
    }

    setCart((prev) => {
      const existingIdx = prev.findIndex(
        (item) =>
          item.product.id === product.id && item.variant.id === variant.id
      );
      if (existingIdx > -1) {
        const updated = [...prev];
        updated[existingIdx] = {
          ...updated[existingIdx],
          quantity: updated[existingIdx].quantity + 1,
        };
        return updated;
      }
      return [...prev, { product, variant, quantity: 1 }];
    });

    triggerToast(`Đã thêm ${product.name} (${variant.name}) vào giỏ!`);
  };

  const updateCartQuantity = (productId: string, variantId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.product.id === productId && item.variant.id === variantId) {
            const nextQty = item.quantity + delta;
            return nextQty > 0 ? { ...item, quantity: nextQty } : null;
          }
          return item;
        })
        .filter(Boolean) as CartItem[]
    );
  };

  const cartCount = useMemo(
    () => cart.reduce((sum, item) => sum + item.quantity, 0),
    [cart]
  );

  const subtotal = useMemo(
    () =>
      cart.reduce((sum, item) => sum + item.variant.price * item.quantity, 0),
    [cart]
  );

  const freeShipMin = settings?.freeShipMinimum || 150000;
  const baseShipFee = settings?.defaultShippingFee || 15000;
  const shippingFee =
    deliveryType === "PICKUP" || subtotal === 0 || subtotal >= freeShipMin
      ? 0
      : baseShipFee;
  const orderTotal = subtotal + shippingFee;

  const handlePlaceOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cart.length === 0) return;
    if (!customerName.trim() || !customerPhone.trim()) {
      triggerToast("Vui lòng nhập tên và số điện thoại nhận bánh nha!");
      return;
    }
    if (deliveryType === "DELIVERY" && !customerAddress.trim()) {
      triggerToast("Vui lòng nhập địa chỉ giao hàng nha!");
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        source: "ONLINE",
        status: "PENDING",
        customerName,
        customerPhone,
        customerAddress:
          deliveryType === "PICKUP" ? "Nhận trực tiếp tại tiệm FLANDI" : customerAddress,
        note: orderNote,
        items: cart.map((item) => ({
          productId: item.product.id,
          productName: item.product.name,
          variantId: item.variant.id,
          variantName: item.variant.name,
          quantity: item.quantity,
          unitPrice: item.variant.price,
          subtotal: item.variant.price * item.quantity,
          stockDeductionPerItem: item.variant.stockDeduction,
        })),
        subtotal,
        discount: 0,
        shippingFee,
        total: orderTotal,
        paymentMethod,
        isPaid: false,
      };

      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (res.ok && data.order) {
        setCompletedOrder(data.order);
        setCart([]);
        setIsCartOpen(false);
        fetchStoreData();
      } else {
        triggerToast("Có lỗi xảy ra khi đặt đơn, vui lòng thử lại!");
      }
    } catch (error) {
      console.error(error);
      triggerToast("Không thể kết nối máy chủ!");
    } finally {
      setIsSubmitting(false);
    }
  };

  const buildOrderSummaryText = (order: Order) => {
    const lines = [
      `🍮 ĐƠN HÀNG FLANDI #${order.code}`,
      `Khách hàng: ${order.customerName} - ${order.customerPhone}`,
      `Nhận hàng: ${order.customerAddress || "Tại quầy"}`,
      `---`,
      ...order.items.map(
        (i) => `• ${i.quantity}x ${i.productName} (${i.variantName}): ${formatVND(i.subtotal)}`
      ),
      `---`,
      `Phí giao hàng: ${formatVND(order.shippingFee)}`,
      `Tổng thanh toán: ${formatVND(order.total)} (${
        order.paymentMethod === "VIETQR" ? "Chuyển khoản VietQR" : "Tiền mặt COD"
      })`,
    ];
    if (order.note) lines.push(`Ghi chú: ${order.note}`);
    return lines.join("\n");
  };

  const copyOrderSummary = (order: Order) => {
    navigator.clipboard.writeText(buildOrderSummaryText(order));
    setCopiedOrderText(true);
    setTimeout(() => setCopiedOrderText(false), 2500);
  };

  const pageConfig = settings?.pageConfig || FALLBACK_PAGE_CONFIG;

  return (
    <div className="min-h-screen bg-flandi-grid relative overflow-x-hidden">
      {/* Decorative Organic Pastel Blobs matching the Menu Poster */}
      <div className="pointer-events-none fixed -top-24 -left-24 w-96 h-96 rounded-full bg-flandi-salmon/25 blur-3xl z-0" />
      <div className="pointer-events-none fixed top-1/3 -right-28 w-[28rem] h-[28rem] rounded-full bg-flandi-pink/40 blur-3xl z-0" />
      <div className="pointer-events-none fixed -bottom-28 left-1/4 w-96 h-96 rounded-full bg-flandi-rose/25 blur-3xl z-0" />

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-flandi-dark text-white px-5 py-3 rounded-full shadow-cute-lg flex items-center gap-2.5 animate-bounce">
          <Sparkles className="w-4 h-4 text-flandi-salmon shrink-0" />
          <span className="text-sm font-bold">{toastMessage}</span>
        </div>
      )}

      {/* Top Announcement Ribbon */}
      {pageConfig.showAnnouncementBar && (
        <div className="bg-gradient-to-r from-flandi-coral via-flandi-salmon to-flandi-coral text-white text-xs sm:text-sm py-2 px-4 text-center font-semibold relative z-20 shadow-sm">
          <div className="max-w-6xl mx-auto flex items-center justify-center gap-2 flex-wrap">
            <Sparkles className="w-4 h-4 shrink-0" />
            <span>
              {settings?.announcement ||
                "Mẻ bánh Flan & Panna Cotta mới ra lò mỗi sáng — Freeship đơn từ 150k!"}
            </span>
          </div>
        </div>
      )}

      {/* Sticky Header */}
      <header className="sticky top-0 z-30 backdrop-blur-md bg-[#FFF9F8]/85 border-b border-flandi-pink/70">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-20 flex items-center justify-between gap-3">
          <a href="#" className="flex items-center gap-3 group">
            <div className="w-12 h-12 rounded-full bg-flandi-salmon/20 border-2 border-flandi-salmon flex items-center justify-center shadow-sm overflow-hidden group-hover:scale-105 transition">
              <img
                src={
                  pageConfig.headerLogoUrl ||
                  settings?.brandKit?.mascotImage ||
                  "/images/branding/flandi-mascot.png"
                }
                alt="FLANDI"
                className="w-full h-full object-cover"
              />
            </div>
            <div>
              <span className="font-display text-2xl sm:text-3xl tracking-wider text-sticker-sm block leading-none">
                {settings?.shopName || "FLANDI"}
              </span>
              <span className="text-xs font-bold text-flandi-coral block mt-1">
                {settings?.tagline || "Muốn ăn hãy Flăn vào tớ"}
              </span>
            </div>
          </a>

          <nav className="hidden md:flex items-center gap-6 text-sm font-bold text-flandi-dark/80">
            {pageConfig.showMenuSection && (
              <a href="#menu" className="hover:text-flandi-coral transition">
                Thực Đơn
              </a>
            )}
            {pageConfig.showMenuPosterButton && (
              <button
                onClick={() => setShowPosterModal(true)}
                className="hover:text-flandi-coral transition flex items-center gap-1.5"
              >
                <ImageIcon className="w-4 h-4 text-flandi-coral" />
                {pageConfig.heroSecondaryCtaText || "Menu Poster"}
              </button>
            )}
            {pageConfig.showStorySection && (
              <a href="#story" className="hover:text-flandi-coral transition">
                Điểm Khác Biệt
              </a>
            )}
            <a href="#contact" className="hover:text-flandi-coral transition">
              Liên Hệ & Đặt Tiệc
            </a>
          </nav>

          <div className="flex items-center gap-2">
            <Link
              href="/order"
              className="px-3.5 py-2 rounded-full bg-flandi-cream hover:bg-flandi-pink/70 text-flandi-coral border-2 border-flandi-salmon text-xs font-extrabold flex items-center gap-1.5 shadow-2xs transition"
              title="Trang mua hàng gọn trong 1 màn hình (/order)"
            >
              <Sparkles className="w-3.5 h-3.5 text-flandi-coral" />
              <span>Đặt Nhanh 1 Màn Hình</span>
            </Link>

            {pageConfig.showOwnerLinks && (
              <>
                <Link
                  href="/pos"
                  className="relative px-3 py-2 rounded-full bg-white border-2 border-flandi-pink hover:border-flandi-salmon text-flandi-dark text-xs font-bold flex items-center gap-1.5 shadow-sm transition"
                  title="Máy Bán Hàng Tại Quầy (/pos)"
                >
                  <Store className="w-3.5 h-3.5 text-flandi-coral" />
                  <span>POS</span>
                </Link>

                <Link
                  href="/admin"
                  className="relative px-3 py-2 rounded-full bg-white border-2 border-flandi-pink hover:border-flandi-salmon text-flandi-dark text-xs font-bold hidden sm:flex items-center gap-1.5 shadow-sm transition"
                  title="Quản Trị Cửa Hàng (/admin)"
                >
                  <span>Admin</span>
                  {pendingOrdersCount > 0 && (
                    <span className="ml-0.5 px-1.5 py-0.2 text-[10px] bg-flandi-coral text-white rounded-full font-extrabold">
                      {pendingOrdersCount}
                    </span>
                  )}
                </Link>
              </>
            )}

            <button
              onClick={() => setIsCartOpen(true)}
              className="relative px-4 py-2.5 rounded-full bg-flandi-coral hover:bg-flandi-salmon text-white font-bold text-xs sm:text-sm flex items-center gap-2 shadow-cute transition transform active:scale-95"
            >
              <ShoppingBag className="w-4 h-4" />
              <span>Giỏ bánh</span>
              <span className="bg-white text-flandi-coral px-2 py-0.5 rounded-full text-xs font-extrabold">
                {cartCount}
              </span>
            </button>
          </div>
        </div>
      </header>

      {/* Hero Section Inspired by the Original Menu */}
      {pageConfig.showHeroSection && (
        <section className="relative z-10 pt-8 pb-14 sm:pt-12 sm:pb-20 px-4 sm:px-6">
          <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
            {/* Left Column: Brand Story & CTA */}
            <div
              className={`${
                pageConfig.showHeroCollage
                  ? "lg:col-span-6 text-center lg:text-left"
                  : "lg:col-span-12 text-center max-w-3xl mx-auto"
              } space-y-5`}
            >
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-flandi-pink/50 border border-flandi-salmon/40 text-flandi-coral text-xs sm:text-sm font-bold">
                <Heart className="w-4 h-4 fill-flandi-coral text-flandi-coral" />
                <span>{pageConfig.heroBadgeText}</span>
              </div>

              <div className="space-y-2">
                <h1 className="font-display text-5xl sm:text-7xl tracking-wide text-sticker-lg leading-tight select-none">
                  {pageConfig.heroTitle}
                </h1>
                <p className="font-display text-2xl sm:text-4xl text-sticker leading-snug">
                  {pageConfig.heroSubtitle}
                </p>
              </div>

              <p className="text-flandi-dark/85 text-base sm:text-lg font-medium max-w-xl mx-auto lg:mx-0 leading-relaxed">
                {pageConfig.heroDescription}
              </p>

              {/* Quick Price Highlights matching the Menu */}
              <div className="flex flex-wrap justify-center lg:justify-start gap-2 pt-1">
                {products.slice(0, 6).map((p) => (
                  <Link
                    key={p.id}
                    href="/order"
                    className="px-3 py-1.5 rounded-full bg-white/90 border border-flandi-pink shadow-sm text-xs font-bold text-flandi-dark hover:border-flandi-coral hover:scale-105 transition flex items-center gap-1.5"
                  >
                    <span>{p.name}:</span>
                    <span className="text-flandi-coral font-extrabold">
                      {p.badgeText}
                    </span>
                  </Link>
                ))}
              </div>

              <div className="pt-3 flex flex-wrap items-center justify-center lg:justify-start gap-3.5">
                <Link
                  href="/order"
                  className="px-7 py-3.5 rounded-full bg-flandi-coral hover:bg-flandi-salmon text-white font-extrabold text-base shadow-cute-lg flex items-center gap-2 transition transform hover:-translate-y-0.5"
                >
                  <span>{pageConfig.heroPrimaryCtaText}</span>
                  <ArrowRight className="w-5 h-5" />
                </Link>
                {pageConfig.showMenuPosterButton && (
                  <button
                    onClick={() => setShowPosterModal(true)}
                    className="px-6 py-3.5 rounded-full bg-white hover:bg-flandi-cream text-flandi-coral border-2 border-flandi-salmon font-bold text-base shadow-sm flex items-center gap-2 transition"
                  >
                    <ImageIcon className="w-5 h-5" />
                    <span>{pageConfig.heroSecondaryCtaText}</span>
                  </button>
                )}
              </div>
            </div>

            {/* Right Column: Cute Interactive 6-Dish Menu Collage matching the uploaded poster */}
            {pageConfig.showHeroCollage && (
              <div className="lg:col-span-6">
                <div className="relative bg-white/75 backdrop-blur-md rounded-[2.5rem] p-5 sm:p-7 border-2 border-flandi-pink shadow-cute-lg">
                  <div className="text-center mb-5">
                    <span className="font-display text-2xl sm:text-3xl text-sticker-sm">
                      {pageConfig.heroCollageTitle}
                    </span>
                    <p className="text-xs font-bold text-flandi-muted mt-0.5">
                      {pageConfig.heroCollageSubtitle}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-5">
                    {products.slice(0, 6).map((item) => (
                      <button
                        key={item.id}
                        onClick={() => handleAddToCart(item)}
                        className="group relative flex flex-col items-center text-center focus:outline-none"
                      >
                        <div className="relative w-28 h-28 sm:w-32 sm:h-32 rounded-full p-1.5 bg-flandi-salmon shadow-cute group-hover:scale-105 transition duration-300">
                          <img
                            src={item.image}
                            alt={item.name}
                            className="w-full h-full object-cover rounded-full border-2 border-white"
                          />
                          {/* Primary Top-Right Price Circle just like the Menu Poster */}
                          <div className="absolute -top-2 -right-2 w-14 h-14 rounded-full bg-flandi-salmon text-white border-2 border-white shadow-md flex flex-col items-center justify-center leading-tight p-1">
                            <span className="text-[11px] font-extrabold">
                              {item.badgeText.split("/")[0]?.trim()}
                            </span>
                            <span className="text-[10px] font-semibold opacity-95">
                              / {item.badgeText.split("/")[1]?.trim()}
                            </span>
                          </div>
                        </div>

                        <span className="font-display text-lg sm:text-xl text-sticker-sm -mt-2.5 z-10 group-hover:scale-105 transition">
                          {item.name}
                        </span>
                        <span className="text-[11px] font-bold text-flandi-muted group-hover:text-flandi-coral transition mt-0.5">
                          + Thêm nhanh
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Interactive Menu Section */}
      {pageConfig.showMenuSection && (
        <section id="menu" className="relative z-10 py-12 px-4 sm:px-6 max-w-6xl mx-auto">
          <div className="text-center max-w-2xl mx-auto mb-8 space-y-2">
            <h2 className="font-display text-3xl sm:text-5xl text-sticker">
              {pageConfig.menuTitle}
            </h2>
            <p className="text-sm sm:text-base text-flandi-muted font-semibold">
              {pageConfig.menuSubtitle}
            </p>
          </div>

          {/* Category Filter & Search */}
          <div className="flex flex-col md:flex-row items-center justify-between gap-4 mb-9">
            <div className="flex items-center gap-2 overflow-x-auto pb-2 md:pb-0 w-full md:w-auto no-scrollbar">
              {categories.map((cat) => {
                const active = selectedCategory === cat.id;
                return (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedCategory(cat.id)}
                    className={`px-4 py-2 rounded-full text-xs sm:text-sm font-extrabold whitespace-nowrap transition ${
                      active
                        ? "bg-flandi-coral text-white shadow-cute"
                        : "bg-white text-flandi-dark border border-flandi-pink hover:border-flandi-salmon"
                    }`}
                  >
                    {cat.label}
                  </button>
                );
              })}
            </div>

            <div className="relative w-full md:w-72">
              <Search className="w-4 h-4 text-flandi-muted absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={pageConfig.menuSearchPlaceholder}
                className="w-full pl-10 pr-4 py-2 rounded-full bg-white border border-flandi-pink focus:border-flandi-coral focus:outline-none text-sm font-semibold text-flandi-dark"
              />
            </div>
          </div>

        {/* Product Grid */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-7">
            {[1, 2, 3, 4, 5, 6].map((n) => (
              <div
                key={n}
                className="h-96 rounded-3xl bg-white/60 border border-flandi-pink animate-pulse p-6"
              />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-7">
            {filteredProducts.map((product) => {
              const currentVarId =
                selectedVariants[product.id] || product.variants[0]?.id;
              const currentVariant =
                product.variants.find((v) => v.id === currentVarId) ||
                product.variants[0];
              const isOutOfStock =
                product.stock <= 0 ||
                (currentVariant && product.stock < currentVariant.stockDeduction);
              const isLowStock =
                !isOutOfStock && product.stock <= product.lowStockThreshold;

              return (
                <div
                  key={product.id}
                  className="bg-white/95 rounded-[2rem] border-2 border-flandi-pink hover:border-flandi-salmon shadow-cute hover:shadow-cute-lg transition-all duration-300 flex flex-col justify-between p-6 relative group"
                >
                  {/* Top Row: Stock status & Best seller tag */}
                  <div className="flex items-center justify-between gap-2 mb-2">
                    {product.isBestSeller ? (
                      <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-amber-100 text-amber-800 text-xs font-extrabold">
                        <Star className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
                        Best Seller
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-flandi-cream text-flandi-muted text-xs font-bold">
                        {product.category}
                      </span>
                    )}

                    <span
                      className={`text-xs font-extrabold px-2.5 py-1 rounded-full ${
                        isOutOfStock
                          ? "bg-red-100 text-red-700"
                          : isLowStock
                          ? "bg-orange-100 text-orange-700"
                          : "bg-emerald-50 text-emerald-700"
                      }`}
                    >
                      {isOutOfStock
                        ? "Tạm hết mẻ"
                        : `Còn ${product.stock} ${product.stockUnit}`}
                    </span>
                  </div>

                  {/* Center Circular Photo Frame + Price Badges */}
                  <div className="flex flex-col items-center my-2">
                    <div className="relative w-44 h-44 rounded-full p-2 bg-gradient-to-tr from-flandi-coral to-flandi-salmon shadow-cute group-hover:scale-105 transition duration-300">
                      <img
                        src={product.image}
                        alt={product.name}
                        className="w-full h-full object-cover rounded-full border-4 border-white"
                      />

                      {/* Floating Right Price Badge */}
                      <div className="absolute -top-2 -right-2 w-16 h-16 rounded-full bg-flandi-salmon text-white border-2 border-white shadow-md flex flex-col items-center justify-center leading-tight">
                        <span className="text-sm font-extrabold">
                          {product.badgeText.split("/")[0]?.trim()}
                        </span>
                        <span className="text-[11px] font-bold">
                          / {product.badgeText.split("/")[1]?.trim()}
                        </span>
                      </div>
                    </div>

                    <h3 className="font-display text-2xl sm:text-3xl text-sticker-sm -mt-3 z-10 text-center">
                      {product.name}
                    </h3>
                    <p className="text-xs font-extrabold text-flandi-coral mt-1 text-center">
                      {product.subtitle}
                    </p>
                    <p className="text-xs text-flandi-muted font-medium text-center mt-2 line-clamp-2 leading-relaxed">
                      {product.description}
                    </p>
                  </div>

                  {/* Variant Selector */}
                  <div className="mt-4 pt-3 border-t border-flandi-pink/60 space-y-3">
                    <div>
                      <label className="block text-[11px] font-extrabold uppercase tracking-wider text-flandi-muted mb-1.5">
                        Chọn vị / Quy cách:
                      </label>
                      <div className="flex flex-wrap gap-1.5">
                        {product.variants.map((v) => {
                          const isSelected = currentVariant?.id === v.id;
                          return (
                            <button
                              key={v.id}
                              type="button"
                              onClick={() =>
                                setSelectedVariants((prev) => ({
                                  ...prev,
                                  [product.id]: v.id,
                                }))
                              }
                              className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition border ${
                                isSelected
                                  ? "bg-flandi-salmon/15 border-flandi-coral text-flandi-coral shadow-sm"
                                  : "bg-flandi-bg border-flandi-pink/80 text-flandi-dark/80 hover:border-flandi-salmon"
                              }`}
                            >
                              {v.name} •{" "}
                              <span className="font-extrabold">
                                {Math.round(v.price / 1000)}k
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Price & Add to Cart Button */}
                    <div className="flex items-center justify-between gap-3 pt-1">
                      <div>
                        <span className="text-[11px] text-flandi-muted font-bold block">
                          Giá chọn:
                        </span>
                        <span className="text-lg font-extrabold text-flandi-coral">
                          {formatVND(currentVariant?.price || product.price)}
                        </span>
                        <span className="text-xs text-flandi-muted font-bold">
                          {" "}
                          / {currentVariant?.unitLabel || product.unit}
                        </span>
                      </div>

                      <button
                        type="button"
                        disabled={isOutOfStock}
                        onClick={() => handleAddToCart(product, currentVariant)}
                        className={`px-4 py-2.5 rounded-full font-extrabold text-xs sm:text-sm flex items-center gap-1.5 transition shadow-sm ${
                          isOutOfStock
                            ? "bg-gray-200 text-gray-500 cursor-not-allowed"
                            : "bg-flandi-coral hover:bg-flandi-salmon text-white shadow-cute active:scale-95"
                        }`}
                      >
                        <Plus className="w-4 h-4" />
                        <span>{isOutOfStock ? "Hết mẻ" : "Thêm vào giỏ"}</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
      )}

      {/* Why FLANDI & Original Menu Poster Section */}
      {pageConfig.showStorySection && (
      <section
        id="story"
        className="relative z-10 py-14 px-4 sm:px-6 max-w-6xl mx-auto"
      >
        <div className="bg-white/90 rounded-[2.5rem] border-2 border-flandi-pink p-6 sm:p-10 shadow-cute grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          <div className={`${pageConfig.showStoryPosterPreview ? "lg:col-span-7" : "lg:col-span-12"} space-y-5`}>
            <span className="inline-block px-3.5 py-1 rounded-full bg-flandi-pink/60 text-flandi-coral text-xs font-extrabold">
              {pageConfig.storyBadgeText}
            </span>
            <h2 className="font-display text-3xl sm:text-4xl text-sticker">
              {pageConfig.storyTitle}
            </h2>
            <p className="text-flandi-dark/85 text-sm sm:text-base font-medium leading-relaxed">
              {pageConfig.storyDescription}
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              {pageConfig.storyFeatures
                .filter((feat) => feat.enabled)
                .map((feat, idx) => {
                  const icons = [Sparkles, Truck, ShieldCheck, Heart];
                  const IconComp = icons[idx % icons.length];
                  return (
                    <div
                      key={feat.id}
                      className="p-4 rounded-2xl bg-flandi-bg border border-flandi-pink flex items-start gap-3"
                    >
                      <div className="w-10 h-10 rounded-xl bg-flandi-salmon/20 text-flandi-coral flex items-center justify-center shrink-0">
                        <IconComp className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="font-extrabold text-sm text-flandi-dark">
                          {feat.title}
                        </h4>
                        <p className="text-xs text-flandi-muted font-medium mt-0.5">
                          {feat.description}
                        </p>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>

          {pageConfig.showStoryPosterPreview && (
          <div className="lg:col-span-5 flex flex-col items-center w-full">
            <div className="w-full max-w-md relative group">
              <MenuPoster
                products={products}
                settings={settings}
                compact
                onSelectProduct={(p) => handleAddToCart(p)}
              />
              {pageConfig.showMenuPosterButton && (
              <div className="mt-3 text-center">
                <button
                  type="button"
                  onClick={() => setShowPosterModal(true)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-flandi-cream hover:bg-flandi-pink/60 text-flandi-coral border border-flandi-salmon font-extrabold text-xs shadow-xs transition"
                >
                  <ImageIcon className="w-3.5 h-3.5" />
                  <span>Phóng to Menu Poster</span>
                </button>
              </div>
              )}
            </div>
          </div>
          )}
        </div>
      </section>
      )}

      {/* Footer / Contact */}
      <footer
        id="contact"
        className="relative z-10 bg-white border-t-2 border-flandi-pink pt-12 pb-20 px-4 sm:px-6"
      >
        <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="space-y-3">
            <span className="font-display text-3xl text-sticker-sm block">
              {settings?.shopName || "FLANDI"}
            </span>
            <p className="text-sm font-bold text-flandi-coral">
              “{settings?.tagline || "Muốn ăn hãy Flăn vào tớ"}”
            </p>
            <p className="text-xs text-flandi-muted font-medium leading-relaxed">
              {pageConfig.footerDescription}
            </p>
          </div>

          <div className="space-y-2.5 text-sm">
            <h4 className="font-extrabold text-flandi-dark uppercase tracking-wider text-xs">
              Thông Tin Liên Hệ
            </h4>
            <p className="flex items-center gap-2 text-flandi-muted font-semibold">
              <Phone className="w-4 h-4 text-flandi-coral shrink-0" />
              <span>Hotline / Zalo: {settings?.phone || "0703166903"}</span>
            </p>
            <p className="flex items-center gap-2 text-flandi-muted font-semibold">
              <Clock className="w-4 h-4 text-flandi-coral shrink-0" />
              <span>Giờ mở cửa: {settings?.openHours || "08:00 – 21:30 mỗi ngày"}</span>
            </p>
            <p className="flex items-center gap-2 text-flandi-muted font-semibold">
              <MapPin className="w-4 h-4 text-flandi-coral shrink-0" />
              <span>{settings?.address || "TP. Hồ Chí Minh"}</span>
            </p>
          </div>

          {pageConfig.showOwnerLinks && (
          <div className="space-y-3">
            <h4 className="font-extrabold text-flandi-dark uppercase tracking-wider text-xs">
              Dành Cho Chủ Tiệm
            </h4>
            <p className="text-xs text-flandi-muted font-medium">
              Truy cập hệ thống POS bán hàng tại quầy, quản lý thực đơn, kiểm kho mẻ bánh và báo cáo doanh thu.
            </p>
            <div className="flex flex-wrap gap-2">
              <Link
                href="/pos"
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full bg-flandi-coral hover:bg-flandi-salmon text-white font-extrabold text-xs shadow-xs transition"
              >
                <Store className="w-4 h-4" />
                <span>Máy Bán Hàng (/pos)</span>
              </Link>
              <Link
                href="/admin"
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full bg-flandi-cream hover:bg-flandi-pink/60 text-flandi-coral border border-flandi-salmon font-extrabold text-xs transition"
              >
                <span>Quản Trị (/admin)</span>
              </Link>
              <Link
                href="/branding"
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full bg-white hover:bg-flandi-cream text-flandi-dark border border-flandi-pink font-extrabold text-xs transition"
              >
                <Sparkles className="w-4 h-4 text-flandi-coral" />
                <span>Bộ Nhận Diện HD</span>
              </Link>
            </div>
          </div>
          )}
        </div>
      </footer>

      {/* Responsive Coded Menu Poster Lightbox Modal */}
      {showPosterModal && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 overflow-y-auto"
          onClick={() => setShowPosterModal(false)}
        >
          <div
            className="relative max-w-2xl w-full my-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setShowPosterModal(false)}
              aria-label="Đóng Menu Poster"
              className="absolute -top-3 -right-2 sm:-top-4 sm:-right-4 z-30 w-10 h-10 rounded-full bg-flandi-coral hover:bg-flandi-salmon text-white flex items-center justify-center shadow-lg border-2 border-white transition"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="max-h-[90vh] overflow-y-auto rounded-[2rem] sm:rounded-[2.5rem]">
              <MenuPoster
                products={products}
                settings={settings}
                onSelectProduct={(p) => {
                  handleAddToCart(p);
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Slide-Over Cart & Quick Checkout Drawer */}
      {isCartOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-xs">
          <div className="w-full max-w-md bg-[#FFF9F8] h-full shadow-2xl flex flex-col justify-between overflow-hidden animate-in slide-in-from-right">
            {/* Drawer Header */}
            <div className="p-5 bg-white border-b border-flandi-pink flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-full bg-flandi-salmon/20 text-flandi-coral flex items-center justify-center">
                  <ShoppingBag className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-base text-flandi-dark">
                    Giỏ Bánh Của Bạn ({cartCount})
                  </h3>
                  <p className="text-xs text-flandi-muted font-semibold">
                    {subtotal >= freeShipMin
                      ? "🎉 Đơn của bạn đã được Freeship!"
                      : `Mua thêm ${formatVND(freeShipMin - subtotal)} để được Freeship`}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsCartOpen(false)}
                className="p-2 rounded-full hover:bg-flandi-cream text-flandi-muted"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Cart Items + Customer Form */}
            <div className="flex-1 overflow-y-auto p-5 space-y-6">
              {cart.length === 0 ? (
                <div className="text-center py-16 space-y-3">
                  <div className="w-20 h-20 rounded-full bg-flandi-pink/40 text-flandi-coral mx-auto flex items-center justify-center">
                    <ShoppingBag className="w-9 h-9" />
                  </div>
                  <p className="font-bold text-flandi-dark">
                    Giỏ bánh đang trống trơn nè!
                  </p>
                  <p className="text-xs text-flandi-muted">
                    Hãy “Flăn” vào menu chọn vài món tráng miệng mát lạnh nha.
                  </p>
                </div>
              ) : (
                <>
                  {/* Items list */}
                  <div className="space-y-3">
                    {cart.map((item) => (
                      <div
                        key={`${item.product.id}-${item.variant.id}`}
                        className="p-3.5 rounded-2xl bg-white border border-flandi-pink flex items-center gap-3 shadow-xs"
                      >
                        <img
                          src={item.product.image}
                          alt={item.product.name}
                          className="w-14 h-14 rounded-full object-cover border-2 border-flandi-salmon shrink-0"
                        />
                        <div className="flex-1 min-w-0">
                          <h4 className="font-extrabold text-sm text-flandi-dark truncate">
                            {item.product.name}
                          </h4>
                          <p className="text-xs text-flandi-muted font-semibold truncate">
                            {item.variant.name}
                          </p>
                          <p className="text-xs font-extrabold text-flandi-coral mt-0.5">
                            {formatVND(item.variant.price * item.quantity)}
                          </p>
                        </div>

                        <div className="flex items-center gap-1.5 bg-flandi-bg border border-flandi-pink rounded-full px-2 py-1">
                          <button
                            type="button"
                            onClick={() =>
                              updateCartQuantity(item.product.id, item.variant.id, -1)
                            }
                            className="w-6 h-6 rounded-full hover:bg-white flex items-center justify-center text-flandi-dark"
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                          <span className="text-xs font-extrabold w-5 text-center">
                            {item.quantity}
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              updateCartQuantity(item.product.id, item.variant.id, 1)
                            }
                            className="w-6 h-6 rounded-full hover:bg-white flex items-center justify-center text-flandi-coral"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Checkout Form */}
                  <form
                    id="checkout-form"
                    onSubmit={handlePlaceOrder}
                    className="space-y-3.5 bg-white p-4 rounded-2xl border border-flandi-pink"
                  >
                    <h4 className="font-extrabold text-xs uppercase tracking-wider text-flandi-coral">
                      Thông tin nhận bánh
                    </h4>

                    <div className="grid grid-cols-2 gap-2 p-1 bg-flandi-bg rounded-xl border border-flandi-pink">
                      <button
                        type="button"
                        onClick={() => setDeliveryType("DELIVERY")}
                        className={`py-2 rounded-lg text-xs font-extrabold transition ${
                          deliveryType === "DELIVERY"
                            ? "bg-flandi-coral text-white shadow-xs"
                            : "text-flandi-muted"
                        }`}
                      >
                        🛵 Giao tận nơi
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeliveryType("PICKUP")}
                        className={`py-2 rounded-lg text-xs font-extrabold transition ${
                          deliveryType === "PICKUP"
                            ? "bg-flandi-coral text-white shadow-xs"
                            : "text-flandi-muted"
                        }`}
                      >
                        🏠 Ghé tiệm lấy
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <div>
                        <label className="text-[11px] font-bold text-flandi-muted block mb-1">
                          Tên của bạn *
                        </label>
                        <input
                          type="text"
                          required
                          value={customerName}
                          onChange={(e) => setCustomerName(e.target.value)}
                          placeholder="VD: Minh Thư"
                          className="w-full px-3 py-2 rounded-xl border border-flandi-pink text-xs font-semibold focus:border-flandi-coral focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] font-bold text-flandi-muted block mb-1">
                          Số điện thoại / Zalo *
                        </label>
                        <input
                          type="tel"
                          required
                          value={customerPhone}
                          onChange={(e) => setCustomerPhone(e.target.value)}
                          placeholder="0366 053 058"
                          className="w-full px-3 py-2 rounded-xl border border-flandi-pink text-xs font-semibold focus:border-flandi-coral focus:outline-none"
                        />
                      </div>
                    </div>

                    {deliveryType === "DELIVERY" && (
                      <div>
                        <label className="text-[11px] font-bold text-flandi-muted block mb-1">
                          Địa chỉ nhận bánh *
                        </label>
                        <input
                          type="text"
                          required
                          value={customerAddress}
                          onChange={(e) => setCustomerAddress(e.target.value)}
                          placeholder="Số nhà, tên đường, phường/quận..."
                          className="w-full px-3 py-2 rounded-xl border border-flandi-pink text-xs font-semibold focus:border-flandi-coral focus:outline-none"
                        />
                      </div>
                    )}

                    <div>
                      <label className="text-[11px] font-bold text-flandi-muted block mb-1">
                        Ghi chú cho FLANDI
                      </label>
                      <input
                        type="text"
                        value={orderNote}
                        onChange={(e) => setOrderNote(e.target.value)}
                        placeholder="VD: Giao lúc 14h, lấy thêm muỗng..."
                        className="w-full px-3 py-2 rounded-xl border border-flandi-pink text-xs font-semibold focus:border-flandi-coral focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="text-[11px] font-bold text-flandi-muted block mb-1.5">
                        Phương thức thanh toán
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => setPaymentMethod("VIETQR")}
                          className={`p-2.5 rounded-xl border text-left transition flex items-center gap-2 ${
                            paymentMethod === "VIETQR"
                              ? "border-flandi-coral bg-flandi-salmon/10 text-flandi-coral"
                              : "border-flandi-pink text-flandi-dark"
                          }`}
                        >
                          <QrCode className="w-4 h-4 shrink-0" />
                          <span className="text-xs font-extrabold">
                            Chuyển khoản QR
                          </span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setPaymentMethod("COD")}
                          className={`p-2.5 rounded-xl border text-left transition flex items-center gap-2 ${
                            paymentMethod === "COD"
                              ? "border-flandi-coral bg-flandi-salmon/10 text-flandi-coral"
                              : "border-flandi-pink text-flandi-dark"
                          }`}
                        >
                          <CheckCircle2 className="w-4 h-4 shrink-0" />
                          <span className="text-xs font-extrabold">
                            Tiền mặt (COD)
                          </span>
                        </button>
                      </div>
                    </div>
                  </form>
                </>
              )}
            </div>

            {/* Drawer Footer */}
            {cart.length > 0 && (
              <div className="p-5 bg-white border-t border-flandi-pink space-y-3">
                <div className="space-y-1 text-xs font-semibold">
                  <div className="flex justify-between text-flandi-muted">
                    <span>Tạm tính ({cartCount} món):</span>
                    <span>{formatVND(subtotal)}</span>
                  </div>
                  <div className="flex justify-between text-flandi-muted">
                    <span>Phí giao hàng:</span>
                    <span>
                      {shippingFee === 0 ? (
                        <strong className="text-emerald-600">Miễn phí</strong>
                      ) : (
                        formatVND(shippingFee)
                      )}
                    </span>
                  </div>
                  <div className="flex justify-between text-base font-extrabold text-flandi-dark pt-1 border-t border-flandi-pink/60">
                    <span>Tổng cộng:</span>
                    <span className="text-flandi-coral">{formatVND(orderTotal)}</span>
                  </div>
                </div>

                <button
                  type="submit"
                  form="checkout-form"
                  disabled={isSubmitting}
                  className="w-full py-3.5 rounded-full bg-flandi-coral hover:bg-flandi-salmon text-white font-extrabold text-sm shadow-cute transition flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <span>
                    {isSubmitting ? "Đang gửi đơn..." : "Hoàn Tất Đặt Bánh Ngay"}
                  </span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Order Confirmation Modal (Synced to Admin POS + VietQR + Zalo copy) */}
      {completedOrder && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 border-2 border-flandi-salmon shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="text-center space-y-1">
              <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-600 mx-auto flex items-center justify-center">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h3 className="font-display text-2xl text-sticker-sm">
                Đặt Bánh Thành Công!
              </h3>
              <p className="text-xs font-bold text-flandi-muted">
                Mã đơn của bạn:{" "}
                <span className="text-flandi-coral font-extrabold">
                  #{completedOrder.code}
                </span>{" "}
                (Đã đồng bộ vào POS của tiệm)
              </p>
            </div>

            {completedOrder.paymentMethod === "VIETQR" && settings && (
              <div className="p-4 rounded-2xl bg-flandi-bg border border-flandi-pink text-center space-y-2">
                <p className="text-xs font-extrabold text-flandi-dark">
                  Quét mã VietQR để thanh toán nhanh
                </p>
                <img
                  src={`https://img.vietqr.io/image/${settings.bankBin}-${settings.bankAccountNo}-compact2.png?amount=${completedOrder.total}&addInfo=${encodeURIComponent(
                    `FLANDI ${completedOrder.code}`
                  )}&accountName=${encodeURIComponent(settings.bankAccountName)}`}
                  alt="VietQR"
                  className="w-48 h-48 mx-auto rounded-xl border border-flandi-pink bg-white p-1 object-contain"
                />
                <p className="text-[11px] text-flandi-muted font-semibold">
                  {settings.bankName} • {settings.bankAccountNo} •{" "}
                  {settings.bankAccountName}
                </p>
              </div>
            )}

            <div className="bg-flandi-bg p-3.5 rounded-2xl border border-flandi-pink text-xs space-y-1.5">
              {completedOrder.items.map((item, idx) => (
                <div key={idx} className="flex justify-between font-semibold">
                  <span>
                    {item.quantity}x {item.productName} ({item.variantName})
                  </span>
                  <span className="font-bold">{formatVND(item.subtotal)}</span>
                </div>
              ))}
              <div className="border-t border-flandi-pink pt-1.5 flex justify-between font-extrabold text-sm text-flandi-coral">
                <span>Tổng thanh toán:</span>
                <span>{formatVND(completedOrder.total)}</span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => copyOrderSummary(completedOrder)}
                className="py-2.5 px-3 rounded-full bg-flandi-cream hover:bg-flandi-pink/60 text-flandi-coral font-extrabold text-xs flex items-center justify-center gap-1.5 border border-flandi-salmon"
              >
                {copiedOrderText ? (
                  <>
                    <Check className="w-4 h-4 shrink-0" />
                    <span>Đã sao chép!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4 shrink-0" />
                    <span>Sao chép đơn</span>
                  </>
                )}
              </button>

              <a
                href={`https://zalo.me/${settings?.zaloPhone || "0703166903"}`}
                target="_blank"
                rel="noreferrer"
                className="py-2.5 px-3 rounded-full bg-[#0068FF] hover:bg-[#0056D6] text-white font-extrabold text-xs flex items-center justify-center gap-1.5"
              >
                <Phone className="w-3.5 h-3.5 shrink-0" />
                <span>Chat Zalo</span>
              </a>

              <button
                type="button"
                onClick={() => {
                  setCompletedOrder(null);
                  setOpenChatTrigger((n) => n + 1);
                }}
                className="py-2.5 px-3 rounded-full bg-gradient-to-r from-[#00B2FF] to-[#006AFF] hover:opacity-95 text-white font-extrabold text-xs flex items-center justify-center gap-1.5"
              >
                <span>Chat Messenger</span>
              </button>
            </div>

            <button
              type="button"
              onClick={() => setCompletedOrder(null)}
              className="w-full py-3 rounded-full bg-flandi-coral text-white font-extrabold text-xs"
            >
              Đóng cửa sổ
            </button>
          </div>
        </div>
      )}

      {/* Embedded On-Page Messenger Chat Widget & Zalo Button */}
      <LiveChatWidget
        settings={settings}
        cartCount={cartCount}
        externalOpenTrigger={openChatTrigger}
        cartSummaryText={
          cart.length > 0
            ? `🍮 Mình muốn đặt các món trong giỏ:\n${cart
                .map(
                  (i) =>
                    `• ${i.quantity}x ${i.product.name} (${i.variant.name}): ${formatVND(
                      i.variant.price * i.quantity
                    )}`
                )
                .join("\n")}\nTổng tạm tính: ${formatVND(subtotal)}`
            : undefined
        }
      />
    </div>
  );
}
