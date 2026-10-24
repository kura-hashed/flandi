"use client";

import React from "react";
import { Product, ShopSettings } from "@/lib/types";
import { Phone, Sparkles } from "lucide-react";

interface MenuPosterProps {
  products: Product[];
  settings?: ShopSettings | null;
  onSelectProduct?: (product: Product) => void;
  compact?: boolean;
}

export default function MenuPoster({
  products,
  settings,
  onSelectProduct,
  compact = false,
}: MenuPosterProps) {
  const displayProducts = products;

  const renderBadgeLines = (badgeText: string) => {
    const parts = badgeText.split("/");
    const top = parts[0]?.trim() || badgeText;
    const bottom = parts[1]?.trim();
    return { top, bottom };
  };

  return (
    <div
      className={`relative w-full overflow-hidden rounded-[2rem] sm:rounded-[2.5rem] border-4 border-[#F69D91] bg-[#FFF8F6] shadow-cute-lg select-none ${
        compact ? "p-4 sm:p-6" : "p-5 sm:p-8 md:p-10"
      }`}
      style={{
        backgroundImage:
          "linear-gradient(to right, rgba(244, 139, 126, 0.13) 1px, transparent 1px), linear-gradient(to bottom, rgba(244, 139, 126, 0.13) 1px, transparent 1px)",
        backgroundSize: compact ? "28px 28px" : "38px 38px",
      }}
    >
      {/* Decorative Watercolor Blobs & Twig Accents (matching the original Menu Poster) */}
      {/* Top-Left Peach Blob */}
      <div className="pointer-events-none absolute -top-12 -left-12 w-44 sm:w-64 h-36 sm:h-48 rounded-[60%_40%_70%_30%] bg-[#F7A38E]/55 blur-[2px]" />
      <div className="pointer-events-none absolute -top-6 -left-6 w-28 sm:w-40 h-24 sm:h-32 rounded-full bg-[#F58D7D]/45" />
      {/* Top-Left Hand-drawn Twig Line */}
      <svg
        viewBox="0 0 140 40"
        className="pointer-events-none absolute top-14 sm:top-20 left-0 w-24 sm:w-36 text-[#594346]/80"
        fill="none"
      >
        <path
          d="M-5 22 C30 26, 75 23, 125 16"
          stroke="currentColor"
          strokeWidth="5"
          strokeLinecap="round"
        />
      </svg>

      {/* Top-Right Pink Floral Blob & Branches */}
      <div className="pointer-events-none absolute -top-10 -right-12 w-40 sm:w-56 h-48 sm:h-64 rounded-[45%_55%_60%_40%] bg-[#FAD2D8]/80" />
      <svg
        viewBox="0 0 120 140"
        className="pointer-events-none absolute top-2 right-0 w-20 sm:w-28 text-[#594346]/75"
        fill="none"
      >
        <path
          d="M125 60 C95 50, 65 35, 35 12"
          stroke="currentColor"
          strokeWidth="4"
          strokeLinecap="round"
        />
        <path
          d="M75 40 C78 24, 86 14, 95 4"
          stroke="currentColor"
          strokeWidth="3.5"
          strokeLinecap="round"
        />
        <path
          d="M125 90 C98 88, 78 94, 58 104"
          stroke="currentColor"
          strokeWidth="4"
          strokeLinecap="round"
        />
      </svg>

      {/* Center-Right Soft Blush Circle */}
      <div className="pointer-events-none absolute top-1/3 -right-16 w-64 sm:w-96 h-64 sm:h-96 rounded-full bg-[#FDE4E1]/70" />

      {/* Bottom-Left Soft Pink Blob */}
      <div className="pointer-events-none absolute -bottom-14 -left-14 w-40 sm:w-56 h-48 sm:h-60 rounded-[50%_50%_40%_60%] bg-[#FAD2D8]/70" />

      {/* Bottom-Right Peach Blob & Twig */}
      <div className="pointer-events-none absolute -bottom-12 -right-10 w-44 sm:w-64 h-48 sm:h-64 rounded-[60%_40%_30%_70%] bg-[#F7A38E]/60" />
      <svg
        viewBox="0 0 120 60"
        className="pointer-events-none absolute bottom-24 sm:bottom-32 right-0 w-20 sm:w-28 text-[#594346]/80"
        fill="none"
      >
        <path
          d="M125 10 C90 22, 55 36, 20 52"
          stroke="currentColor"
          strokeWidth="5"
          strokeLinecap="round"
        />
      </svg>

      {/* Poster Header: Arched FLANDI + Tagline */}
      <div className="relative z-10 text-center pt-1 sm:pt-2 mb-5 sm:mb-8">
        {/* Arched FLANDI Title */}
        <div className="inline-flex items-end justify-center gap-0.5 sm:gap-1">
          {[
            { char: "F", rot: "-14deg", y: "6px" },
            { char: "L", rot: "-8deg", y: "2px" },
            { char: "A", rot: "-2deg", y: "0px" },
            { char: "N", rot: "3deg", y: "0px" },
            { char: "D", rot: "9deg", y: "2px" },
            { char: "I", rot: "15deg", y: "6px" },
          ].map((item, idx) => (
            <span
              key={idx}
              style={{
                transform: `translateY(${item.y}) rotate(${item.rot})`,
              }}
              className={`inline-block font-display text-sticker-lg tracking-wider leading-none ${
                compact
                  ? "text-3xl sm:text-4xl"
                  : "text-4xl sm:text-6xl md:text-7xl"
              }`}
            >
              {item.char}
            </span>
          ))}
        </div>

        <h3
          className={`font-display text-sticker leading-snug mt-2 sm:mt-3 px-2 ${
            compact
              ? "text-lg sm:text-xl"
              : "text-xl sm:text-3xl md:text-4xl"
          }`}
        >
          {settings?.tagline || "Muốn ăn hãy Flăn vào tớ"}
        </h3>
      </div>

      {/* Responsive 2-Column Product Poster Grid */}
      <div
        className={`relative z-10 grid grid-cols-2 ${
          compact
            ? "gap-x-3 gap-y-5 sm:gap-x-5 sm:gap-y-6"
            : "gap-x-4 gap-y-7 sm:gap-x-8 sm:gap-y-10 md:gap-x-12"
        } max-w-3xl mx-auto`}
      >
        {displayProducts.map((product) => {
          const primaryBadge = renderBadgeLines(product.badgeText);

          return (
            <div
              key={product.id}
              onClick={() => onSelectProduct && onSelectProduct(product)}
              className={`group flex flex-col items-center text-center ${
                onSelectProduct ? "cursor-pointer" : ""
              }`}
            >
              {/* Circular Dish Frame */}
              <div
                className={`relative rounded-full p-1.5 sm:p-2 bg-[#F69D91] shadow-cute transition-transform duration-300 group-hover:scale-105 ${
                  compact
                    ? "w-24 h-24 sm:w-28 sm:h-28"
                    : "w-32 h-32 sm:w-44 sm:h-44 md:w-48 md:h-48"
                }`}
              >
                <img
                  src={product.image}
                  alt={product.name}
                  className="w-full h-full object-cover rounded-full border-2 border-white/90"
                />

                {/* Top-Right Price Circle Badge */}
                <div
                  className={`absolute -top-1.5 -right-1.5 sm:-top-2 sm:-right-2 rounded-full bg-[#F69D91] text-white border-2 border-white/90 shadow-md flex flex-col items-center justify-center leading-tight ${
                    compact
                      ? "w-11 h-11 text-[9px]"
                      : "w-13 h-13 sm:w-16 sm:h-16 md:w-18 md:h-18"
                  }`}
                >
                  <span
                    className={`font-extrabold ${
                      compact ? "text-[10px]" : "text-xs sm:text-sm md:text-base"
                    }`}
                  >
                    {primaryBadge.top} /
                  </span>
                  {primaryBadge.bottom && (
                    <span
                      className={`font-bold ${
                        compact ? "text-[9px]" : "text-[10px] sm:text-xs md:text-sm"
                      }`}
                    >
                      {primaryBadge.bottom}
                    </span>
                  )}
                </div>
              </div>

              {/* Overlapping Outlined Sticker Product Title */}
              <div className="-mt-3 sm:-mt-4 z-10 px-1">
                <span
                  className={`font-display text-sticker-sm block leading-tight transition-transform group-hover:scale-105 ${
                    compact
                      ? "text-sm sm:text-base"
                      : "text-base sm:text-2xl md:text-[26px]"
                  }`}
                >
                  {product.name}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Poster Footer Pill */}
      <div className="relative z-10 mt-6 sm:mt-8 pt-3 border-t border-[#F69D91]/30 flex flex-wrap items-center justify-between gap-2 text-[11px] sm:text-xs font-extrabold text-flandi-coral">
        <span className="inline-flex items-center gap-1">
          <Sparkles className="w-3.5 h-3.5" />
          <span>100% Bánh Nhà Làm Mới Mỗi Ngày</span>
        </span>
        <span className="inline-flex items-center gap-1 bg-white/90 px-3 py-1 rounded-full border border-flandi-pink shadow-2xs">
          <Phone className="w-3 h-3" />
          <span>Đặt bánh / Zalo: {settings?.phone || "0703166903"}</span>
        </span>
      </div>
    </div>
  );
}
