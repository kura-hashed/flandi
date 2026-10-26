"use client";

import React, { useState } from "react";
import {
  X,
  Phone,
  MapPin,
  Clock,
  Copy,
  Check,
  ExternalLink,
  MessageCircle,
} from "lucide-react";
import { copyToClipboardInstant } from "@/components/LiveChatWidget";

interface ShopContactModalProps {
  isOpen: boolean;
  onClose: () => void;
  phone?: string;
  zaloPhone?: string;
  address?: string;
  openHours?: string;
}

export default function ShopContactModal({
  isOpen,
  onClose,
  phone = "0703166903",
  zaloPhone = "0703166903",
  address = "123/3 Nguyễn Hữu Cảnh, Thủ Dầu Một, TP Hồ Chí Minh",
  openHours = "08:00 – 21:30 mỗi ngày",
}: ShopContactModalProps) {
  const [copiedField, setCopiedField] = useState<"phone" | "address" | null>(null);

  if (!isOpen) return null;

  const handleCopy = (text: string, field: "phone" | "address") => {
    copyToClipboardInstant(text);
    setCopiedField(field);
    setTimeout(() => {
      setCopiedField(null);
    }, 2000);
  };

  const cleanZalo = zaloPhone.replace(/\D/g, "");
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    address
  )}`;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm bg-white rounded-3xl border-2 border-flandi-salmon shadow-cute-lg overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-flandi-cream via-[#FFF3EE] to-flandi-cream px-5 py-4 border-b border-flandi-pink/80 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white border border-flandi-pink/80 shadow-2xs flex items-center justify-center shrink-0 text-flandi-coral">
              <Phone className="w-5 h-5 fill-flandi-coral/20 text-flandi-coral" />
            </div>
            <div>
              <h3 className="font-display text-base font-extrabold text-flandi-dark leading-tight">
                Liên Hệ Tiệm FLANDI
              </h3>
              <p className="text-[11px] font-bold text-flandi-muted">
                Hotline Zalo & Địa chỉ tiệm bánh
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/80 hover:bg-flandi-pink/50 text-flandi-dark flex items-center justify-center transition border border-flandi-pink/60 cursor-pointer"
            title="Đóng"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4">
          {/* 1. SỐ ĐIỆN THOẠI & ZALO */}
          <div className="p-3.5 bg-flandi-bg/60 rounded-2xl border border-flandi-pink/80 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-extrabold text-flandi-muted uppercase tracking-wider flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5 text-flandi-coral" />
                <span>Số Điện Thoại / Zalo</span>
              </span>
              <button
                type="button"
                onClick={() => handleCopy(zaloPhone, "phone")}
                className="text-[11px] font-bold text-flandi-coral hover:text-flandi-dark flex items-center gap-1 cursor-pointer transition"
              >
                {copiedField === "phone" ? (
                  <>
                    <Check className="w-3 h-3 text-emerald-600" />
                    <span className="text-emerald-700">Đã sao chép</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3" />
                    <span>Sao chép</span>
                  </>
                )}
              </button>
            </div>

            <div className="flex items-baseline justify-between">
              <span className="font-display text-2xl font-black text-flandi-dark tracking-wide">
                {zaloPhone}
              </span>
              <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full">
                Hỗ trợ 24/7
              </span>
            </div>

            {/* Quick Actions for Phone */}
            <div className="grid grid-cols-2 gap-2 pt-1">
              <a
                href={`tel:${phone}`}
                className="py-2 px-3 rounded-xl bg-white hover:bg-flandi-cream/60 border border-flandi-pink text-flandi-dark font-extrabold text-xs flex items-center justify-center gap-1.5 shadow-2xs transition active:scale-95"
              >
                <Phone className="w-3.5 h-3.5 text-flandi-coral" />
                <span>Gọi điện</span>
              </a>

              <a
                href={`https://zalo.me/${cleanZalo}`}
                target="_blank"
                rel="noreferrer"
                className="py-2 px-3 rounded-xl bg-[#0068FF] hover:bg-[#0056D6] text-white font-extrabold text-xs flex items-center justify-center gap-1.5 shadow-2xs transition active:scale-95"
              >
                <MessageCircle className="w-3.5 h-3.5" />
                <span>Nhắn Zalo</span>
              </a>
            </div>
          </div>

          {/* 2. ĐỊA CHỈ TIỆM */}
          <div className="p-3.5 bg-flandi-bg/60 rounded-2xl border border-flandi-pink/80 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-extrabold text-flandi-muted uppercase tracking-wider flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-flandi-coral" />
                <span>Địa Chỉ Tiệm Bánh</span>
              </span>
              <button
                type="button"
                onClick={() => handleCopy(address, "address")}
                className="text-[11px] font-bold text-flandi-coral hover:text-flandi-dark flex items-center gap-1 cursor-pointer transition"
              >
                {copiedField === "address" ? (
                  <>
                    <Check className="w-3 h-3 text-emerald-600" />
                    <span className="text-emerald-700">Đã sao chép</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3" />
                    <span>Sao chép</span>
                  </>
                )}
              </button>
            </div>

            <p className="text-xs font-bold text-flandi-dark leading-relaxed">
              {address}
            </p>

            {/* Quick Action for Map */}
            <div className="pt-1">
              <a
                href={mapsUrl}
                target="_blank"
                rel="noreferrer"
                className="w-full py-2 px-3 rounded-xl bg-white hover:bg-flandi-cream/60 border border-flandi-pink text-flandi-dark font-extrabold text-xs flex items-center justify-center gap-1.5 shadow-2xs transition active:scale-95"
              >
                <MapPin className="w-3.5 h-3.5 text-flandi-coral" />
                <span>Mở trên Google Maps</span>
                <ExternalLink className="w-3 h-3 text-flandi-muted ml-0.5" />
              </a>
            </div>
          </div>

          {/* 3. GIỜ MỞ CỬA & GHI CHÚ */}
          <div className="p-3 rounded-2xl bg-flandi-cream/60 border border-flandi-pink/60 flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-white border border-flandi-pink flex items-center justify-center text-flandi-coral shrink-0">
              <Clock className="w-4 h-4" />
            </div>
            <div className="text-xs min-w-0">
              <p className="font-extrabold text-flandi-dark">{openHours}</p>
              <p className="text-[11px] font-semibold text-flandi-muted">
                Mẻ bánh mới ra lò mỗi sáng • Giao tận nơi & ghé lấy
              </p>
            </div>
          </div>

          {/* Footer close button */}
          <button
            type="button"
            onClick={onClose}
            className="w-full py-2.5 rounded-2xl bg-gray-100 hover:bg-gray-200 text-flandi-dark font-extrabold text-xs transition cursor-pointer"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
}
