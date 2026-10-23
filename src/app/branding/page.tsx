"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Store, Sparkles } from "lucide-react";
import { Product, ShopSettings } from "@/lib/types";
import BrandingStudio from "@/components/BrandingStudio";

export default function FlandiBrandingPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [settings, setSettings] = useState<ShopSettings | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const notify = (msg: string) => {
    setToast(msg);
    setTimeout(() => {
      setToast((prev) => (prev === msg ? null : prev));
    }, 2800);
  };

  const fetchData = async () => {
    try {
      const res = await fetch("/api/store", { cache: "no-store" });
      const data = await res.json();
      setProducts(data.products || []);
      setSettings(data.settings || null);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  return (
    <div className="min-h-screen bg-flandi-grid flex flex-col">
      {toast && (
        <div className="fixed bottom-5 right-5 z-50 bg-flandi-dark text-white px-5 py-3 rounded-2xl shadow-cute-lg flex items-center gap-2.5 animate-bounce">
          <Sparkles className="w-4 h-4 text-flandi-salmon" />
          <span className="text-xs sm:text-sm font-bold">{toast}</span>
        </div>
      )}

      <header className="bg-white/90 backdrop-blur-md border-b border-flandi-pink sticky top-0 z-30 px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="p-2 rounded-full bg-flandi-bg hover:bg-flandi-pink/50 text-flandi-coral border border-flandi-pink transition"
            title="Về trang chủ"
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
                FLANDI BRANDING KIT
              </h1>
              <span className="text-[11px] font-bold text-flandi-muted block">
                Bộ Nhận Diện Thương Hiệu & Xuất Ấn Phẩm Full HD
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/"
            className="px-3.5 py-2 rounded-xl bg-flandi-bg hover:bg-flandi-pink/50 text-flandi-dark font-bold text-xs border border-flandi-pink"
          >
            Trang Chủ Khách
          </Link>
          <Link
            href="/admin"
            className="px-3.5 py-2 rounded-xl bg-flandi-coral hover:bg-flandi-salmon text-white font-extrabold text-xs flex items-center gap-1.5 shadow-xs"
          >
            <Store className="w-3.5 h-3.5" />
            <span>Mở Quản Trị & POS</span>
          </Link>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6">
        {settings ? (
          <BrandingStudio
            products={products}
            settings={settings}
            notify={notify}
            onUpdateSettings={async (nextSettings) => {
              const res = await fetch("/api/store", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ settings: nextSettings }),
              });
              if (res.ok) {
                await fetchData();
              }
            }}
          />
        ) : (
          <div className="p-12 text-center text-sm font-bold text-flandi-muted">
            Đang tải Bộ Nhận Diện Thương Hiệu FLANDI...
          </div>
        )}
      </main>
    </div>
  );
}
