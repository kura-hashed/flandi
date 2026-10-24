"use client";

import React, { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import {
  Sparkles,
  Phone,
  MapPin,
  Clock,
  Heart,
  Star,
  Search,
  ArrowRight,
  Truck,
  ShieldCheck,
} from "lucide-react";
import { Product, ShopSettings } from "@/lib/types";
import LiveChatWidget from "@/components/LiveChatWidget";
import { FALLBACK_PAGE_CONFIG } from "@/components/PageManager";

export default function FlandiLandingPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [settings, setSettings] = useState<ShopSettings | null>(null);
  const [loading, setLoading] = useState(true);

  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedVariants, setSelectedVariants] = useState<Record<string, string>>({});
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [openChatTrigger, setOpenChatTrigger] = useState(0);
  const [preferredChatChannel, setPreferredChatChannel] = useState<
    "MESSENGER" | "ZALO"
  >("MESSENGER");

  const fetchStoreData = async () => {
    try {
      const res = await fetch("/api/store", { cache: "no-store" });
      const data = await res.json();
      const activeProducts: Product[] = (data.products || []).filter(
        (p: Product) => p.isActive
      );
      setProducts(activeProducts);
      setSettings(data.settings);

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
    Math.round(amount || 0)
      .toString()
      .replace(/\B(?=(\d{3})+(?!\d))/g, ".") + "đ";

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
              className="px-5 py-2.5 rounded-full bg-flandi-coral hover:bg-flandi-salmon text-white font-extrabold text-xs sm:text-sm flex items-center gap-2 shadow-cute transition transform hover:-translate-y-0.5 active:scale-95"
              title="Đặt hàng trực tiếp (/order)"
            >
              <Sparkles className="w-4 h-4" />
              <span>ĐẶT BÁNH NHANH</span>
            </Link>
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
                    {products.map((item) => (
                      <Link
                        key={item.id}
                        href="/order"
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
                          Đặt món →
                        </span>
                      </Link>
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
                autoComplete="off"
                spellCheck={false}
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

                      <Link
                        href="/order"
                        className="px-5 py-2.5 rounded-full font-black text-xs sm:text-sm flex items-center gap-1.5 transition bg-flandi-coral hover:bg-flandi-salmon text-white shadow-cute hover:-translate-y-0.5 active:scale-95"
                      >
                        <Sparkles className="w-4 h-4" />
                        <span>Order</span>
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
      )}

      {/* Why FLANDI Section */}
      {pageConfig.showStorySection && (
      <section
        id="story"
        className="relative z-10 py-14 px-4 sm:px-6 max-w-6xl mx-auto"
      >
        <div className="bg-white/90 rounded-[2.5rem] border-2 border-flandi-pink p-6 sm:p-10 shadow-cute">
          <div className="max-w-4xl mx-auto space-y-5 text-center">
            <span className="inline-block px-3.5 py-1 rounded-full bg-flandi-pink/60 text-flandi-coral text-xs font-extrabold">
              {pageConfig.storyBadgeText}
            </span>
            <h2 className="font-display text-3xl sm:text-4xl text-sticker">
              {pageConfig.storyTitle}
            </h2>
            <p className="text-flandi-dark/85 text-sm sm:text-base font-medium leading-relaxed max-w-2xl mx-auto">
              {pageConfig.storyDescription}
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-4 text-left">
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
        </div>
      </section>
      )}

      {/* Footer / Contact */}
      <footer
        id="contact"
        className="relative z-10 bg-white border-t-2 border-flandi-pink pt-12 pb-20 px-4 sm:px-6"
      >
        <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-8">
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
        </div>
      </footer>

      {/* Embedded On-Page Messenger Chat Widget & Zalo Button */}
      <LiveChatWidget
        settings={settings}
        cartCount={0}
        externalOpenTrigger={openChatTrigger}
        preferredChannel={preferredChatChannel}
      />
    </div>
  );
}
