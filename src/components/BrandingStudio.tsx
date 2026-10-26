"use client";

import React, { useState } from "react";
import { Product, ShopSettings, BrandKit } from "@/lib/types";
import {
  Palette,
  Download,
  Sparkles,
  Save,
  Copy,
  Check,
  Image as ImageIcon,
  Type,
  Layers,
  QrCode,
  Heart,
  Phone,
  RefreshCw,
  Eye,
  CheckCircle2,
  Printer,
} from "lucide-react";
import MenuPoster from "./MenuPoster";

interface BrandingStudioProps {
  products: Product[];
  settings: ShopSettings;
  onUpdateSettings: (nextSettings: ShopSettings) => Promise<void>;
  notify: (msg: string) => void;
}

type AssetTemplateId =
  | "COVER_1920x1080"
  | "MENU_POSTER_1440x2048"
  | "CUP_STICKER_1080x1080"
  | "SOCIAL_POST_1080x1080"
  | "STORY_STANDEE_1080x1920"
  | "THANK_YOU_CARD_1920x1080";

const DEFAULT_FALLBACK_KIT: BrandKit = {
  brandName: "FLANDI",
  tagline: "Muốn ăn hãy Flăn vào tớ",
  subTagline: "Tiệm Tráng Miệng Thủ Công Tươi Mới Mỗi Ngày",
  brandStory:
    "FLANDI mang đến những mẻ bánh Flan trứng sữa, Panna Cotta trái cây tươi, Rau câu dừa nhân Flan, Rau câu lá dứa cà phê, Tàu hũ Singapore và Yogurt nhà làm ngọt dịu tự nhiên mỗi sáng.",
  logoStyle: "MASCOT_EMBLEM",
  mascotImage: "/images/branding/flandi-mascot.png",
  primaryColor: "#E86F5F",
  secondaryColor: "#F48B7E",
  accentColor: "#FFD6D1",
  bgColor: "#FFF9F8",
  darkColor: "#4A2E2B",
  headingFont: "Coiny (Display Sticker)",
  bodyFont: "Quicksand (Rounded Sans)",
  stickerNote: "100% Làm Mới Mỗi Sáng • Không Chất Bảo Quản",
  thankYouTitle: "Cảm ơn bạn đã “Flăn” vào FLANDI ♥",
  thankYouMessage:
    "Mỗi chiếc bánh đều được bếp nhà FLANDI chuẩn bị tỉ mỉ với nguyên liệu tươi mới trong ngày. Chúc bạn có một bữa tráng miệng ngọt ngào và mát lành nha!",
  storageInstruction:
    "Bảo quản ngăn mát tủ lạnh (2°C – 6°C) ngay khi nhận bánh. Ngon nhất khi dùng trong vòng 2 – 3 ngày.",
  promoHeadline: "MẺ BÁNH MỚI RA LÒ MỖI SÁNG!",
  promoSubheadline: "Freeship đơn từ 100k • Đặt nhanh qua Zalo 0703166903",
  colors: [
    {
      id: "col-coral",
      name: "Flandi Coral (Chủ đạo)",
      hex: "#E86F5F",
      usage: "Viền chữ Sticker, Nút kêu gọi hành động (CTA), Điểm nhấn chính",
    },
    {
      id: "col-salmon",
      name: "Pastel Salmon (Màu thương hiệu)",
      hex: "#F48B7E",
      usage: "Khung tròn sản phẩm, Nhãn giá tròn, Badge nổi bật",
    },
    {
      id: "col-pink",
      name: "Soft Blush Pink (Màu bổ trợ)",
      hex: "#FFD6D1",
      usage: "Viền thẻ bài, Mảng màu nước trang trí, Tag phân loại",
    },
    {
      id: "col-cream",
      name: "Cream Grid (Nền đặc trưng)",
      hex: "#FFF9F8",
      usage: "Nền giấy kẻ ô vuông nhẹ nhàng tạo cảm giác tiệm bánh thủ công",
    },
    {
      id: "col-caramel",
      name: "Caramel Amber (Sốt bánh Flan)",
      hex: "#D97724",
      usage: "Chi tiết minh hoạ caramel, Nhãn Best Seller",
    },
    {
      id: "col-dark",
      name: "Cocoa Brown (Văn bản)",
      hex: "#4A2E2B",
      usage: "Chữ nội dung chính dễ đọc, ấm áp hơn màu đen thuần",
    },
  ],
};

export default function BrandingStudio({
  products,
  settings,
  onUpdateSettings,
  notify,
}: BrandingStudioProps) {
  const [brandKit, setBrandKit] = useState<BrandKit>(
    settings.brandKit || DEFAULT_FALLBACK_KIT
  );
  const [selectedAsset, setSelectedAsset] =
    useState<AssetTemplateId>("COVER_1920x1080");
  const [copiedHex, setCopiedHex] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isExporting, setIsExporting] = useState<string | null>(null);

  const handleCopyHex = (hex: string) => {
    navigator.clipboard.writeText(hex);
    setCopiedHex(hex);
    notify(`Đã sao chép mã màu ${hex}`);
    setTimeout(() => setCopiedHex(null), 2000);
  };

  const handleSaveBrandKit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setIsSaving(true);
    try {
      await onUpdateSettings({
        ...settings,
        shopName: brandKit.brandName,
        tagline: brandKit.tagline,
        brandKit,
      });
      notify("✅ Đã lưu Bộ Nhận Diện Thương Hiệu FLANDI!");
    } finally {
      setIsSaving(false);
    }
  };

  // Helper to load an image for Canvas rendering
  const loadImage = (src: string): Promise<HTMLImageElement | null> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = src;
    });
  };

  // Draw pastel grid + watercolor blobs on any Full HD canvas
  const drawFlandiBackground = (
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number
  ) => {
    ctx.fillStyle = brandKit.bgColor || "#FFF9F8";
    ctx.fillRect(0, 0, w, h);

    // Subtle grid lines
    ctx.strokeStyle = "rgba(244, 139, 126, 0.14)";
    ctx.lineWidth = 2;
    const step = 64;
    for (let x = 0; x < w; x += step) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    for (let y = 0; y < h; y += step) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    // Soft pastel blobs in corners
    ctx.save();
    ctx.fillStyle = "rgba(244, 139, 126, 0.25)";
    ctx.beginPath();
    ctx.arc(80, 80, Math.min(w, h) * 0.22, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "rgba(255, 214, 209, 0.55)";
    ctx.beginPath();
    ctx.arc(w - 60, 120, Math.min(w, h) * 0.24, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "rgba(244, 139, 126, 0.22)";
    ctx.beginPath();
    ctx.arc(w - 80, h - 80, Math.min(w, h) * 0.22, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "rgba(255, 214, 209, 0.45)";
    ctx.beginPath();
    ctx.arc(100, h - 100, Math.min(w, h) * 0.18, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Outer frame border
    ctx.strokeStyle = brandKit.secondaryColor || "#F48B7E";
    ctx.lineWidth = 16;
    ctx.strokeRect(24, 24, w - 48, h - 48);
  };

  // Draw Sticker Outlined Text on Canvas
  const drawStickerText = (
    ctx: CanvasRenderingContext2D,
    text: string,
    x: number,
    y: number,
    fontSize: number,
    strokeWidth: number = 14
  ) => {
    ctx.save();
    ctx.font = `900 ${fontSize}px Coiny, Fredoka, Quicksand, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.lineJoin = "round";
    ctx.miterLimit = 2;

    // Shadow
    ctx.shadowColor = "rgba(232, 111, 95, 0.28)";
    ctx.shadowBlur = 18;
    ctx.shadowOffsetY = 6;

    // Coral stroke
    ctx.strokeStyle = brandKit.primaryColor || "#E86F5F";
    ctx.lineWidth = strokeWidth;
    ctx.strokeText(text, x, y);

    // White fill
    ctx.shadowColor = "transparent";
    ctx.fillStyle = "#FFFFFF";
    ctx.fillText(text, x, y);
    ctx.restore();
  };

  // Draw circular product photo with salmon ring & price badge
  const drawCircularDish = (
    ctx: CanvasRenderingContext2D,
    img: HTMLImageElement | null,
    cx: number,
    cy: number,
    radius: number,
    name: string,
    badgeText: string,
    secondaryBadgeText?: string
  ) => {
    // Outer salmon circle
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, radius + 10, 0, Math.PI * 2);
    ctx.fillStyle = brandKit.secondaryColor || "#F48B7E";
    ctx.shadowColor = "rgba(232, 111, 95, 0.25)";
    ctx.shadowBlur = 20;
    ctx.fill();
    ctx.restore();

    // White inner border
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, radius + 3, 0, Math.PI * 2);
    ctx.fillStyle = "#FFFFFF";
    ctx.fill();
    ctx.restore();

    // Clipped dish photo
    if (img) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.clip();
      ctx.drawImage(img, cx - radius, cy - radius, radius * 2, radius * 2);
      ctx.restore();
    }

    // Top-right price badge
    const drawBadge = (bx: number, by: number, text: string, bg: string) => {
      const br = Math.round(radius * 0.36);
      ctx.save();
      ctx.beginPath();
      ctx.arc(bx, by, br, 0, Math.PI * 2);
      ctx.fillStyle = bg;
      ctx.fill();
      ctx.lineWidth = 4;
      ctx.strokeStyle = "#FFFFFF";
      ctx.stroke();

      const parts = text.split("/");
      ctx.fillStyle = "#FFFFFF";
      ctx.textAlign = "center";
      ctx.font = `800 ${Math.round(br * 0.42)}px Quicksand, sans-serif`;
      ctx.fillText(`${parts[0]?.trim() || text} /`, bx, by - br * 0.14);
      if (parts[1]) {
        ctx.font = `700 ${Math.round(br * 0.38)}px Quicksand, sans-serif`;
        ctx.fillText(parts[1].trim(), bx, by + br * 0.32);
      }
      ctx.restore();
    };

    drawBadge(
      cx + radius * 0.72,
      cy - radius * 0.68,
      badgeText,
      brandKit.secondaryColor || "#F48B7E"
    );

    if (secondaryBadgeText) {
      drawBadge(
        cx - radius * 0.72,
        cy - radius * 0.68,
        secondaryBadgeText,
        brandKit.primaryColor || "#E86F5F"
      );
    }

    // Dish name sticker at bottom
    drawStickerText(
      ctx,
      name,
      cx,
      cy + radius + 16,
      Math.round(radius * 0.34),
      Math.round(radius * 0.1)
    );
  };

  // Export any template as a True Full HD PNG
  const exportFullHdAsset = async (templateId: AssetTemplateId) => {
    setIsExporting(templateId);
    try {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const mascotImg = await loadImage(brandKit.mascotImage);
      const prodImages = await Promise.all(
        products.slice(0, 6).map((p) => loadImage(p.image))
      );

      if (templateId === "COVER_1920x1080") {
        canvas.width = 1920;
        canvas.height = 1080;
        drawFlandiBackground(ctx, 1920, 1080);

        // Left side: Mascot + Brand Headline
        if (mascotImg) {
          ctx.save();
          ctx.beginPath();
          ctx.arc(360, 340, 170, 0, Math.PI * 2);
          ctx.clip();
          ctx.drawImage(mascotImg, 190, 170, 340, 340);
          ctx.restore();
        }

        drawStickerText(ctx, brandKit.brandName, 360, 600, 110, 20);
        drawStickerText(ctx, brandKit.tagline, 360, 710, 48, 12);

        ctx.fillStyle = brandKit.darkColor || "#4A2E2B";
        ctx.font = "700 28px Quicksand, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(brandKit.subTagline, 360, 795);

        // Pill CTA
        ctx.fillStyle = brandKit.primaryColor || "#E86F5F";
        ctx.beginPath();
        ctx.roundRect(110, 845, 500, 74, 37);
        ctx.fill();
        ctx.fillStyle = "#FFFFFF";
        ctx.font = "800 30px Quicksand, sans-serif";
        ctx.fillText(`📞 Đặt bánh / Zalo: ${settings.phone}`, 360, 892);

        // Right side: 6 Dishes (3x2 grid)
        const coords = [
          { x: 930, y: 290 },
          { x: 1310, y: 290 },
          { x: 1690, y: 290 },
          { x: 930, y: 720 },
          { x: 1310, y: 720 },
          { x: 1690, y: 720 },
        ];
        products.slice(0, 6).forEach((p, idx) => {
          const pos = coords[idx];
          if (!pos) return;
          drawCircularDish(
            ctx,
            prodImages[idx],
            pos.x,
            pos.y,
            130,
            p.name,
            p.badgeText,
            p.secondaryBadgeText
          );
        });
      } else if (templateId === "MENU_POSTER_1440x2048") {
        canvas.width = 1440;
        canvas.height = 2048;
        drawFlandiBackground(ctx, 1440, 2048);

        drawStickerText(ctx, brandKit.brandName, 720, 175, 135, 24);
        drawStickerText(ctx, brandKit.tagline, 720, 320, 72, 16);

        const coords = [
          { x: 410, y: 650 },
          { x: 1030, y: 650 },
          { x: 410, y: 1170 },
          { x: 1030, y: 1170 },
          { x: 410, y: 1690 },
          { x: 1030, y: 1690 },
        ];
        products.slice(0, 6).forEach((p, idx) => {
          const pos = coords[idx];
          if (!pos) return;
          drawCircularDish(
            ctx,
            prodImages[idx],
            pos.x,
            pos.y,
            175,
            p.name,
            p.badgeText,
            p.secondaryBadgeText
          );
        });

        // Footer contact bar
        ctx.fillStyle = brandKit.primaryColor || "#E86F5F";
        ctx.beginPath();
        ctx.roundRect(220, 1925, 1000, 72, 36);
        ctx.fill();
        ctx.fillStyle = "#FFFFFF";
        ctx.textAlign = "center";
        ctx.font = "800 32px Quicksand, sans-serif";
        ctx.fillText(
          `${brandKit.stickerNote} • Zalo: ${settings.phone}`,
          720,
          1970
        );
      } else if (templateId === "CUP_STICKER_1080x1080") {
        canvas.width = 1080;
        canvas.height = 1080;
        ctx.clearRect(0, 0, 1080, 1080);

        // Outer circular sticker base
        ctx.save();
        ctx.beginPath();
        ctx.arc(540, 540, 500, 0, Math.PI * 2);
        ctx.fillStyle = brandKit.bgColor || "#FFF9F8";
        ctx.fill();
        ctx.lineWidth = 24;
        ctx.strokeStyle = brandKit.primaryColor || "#E86F5F";
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(540, 540, 468, 0, Math.PI * 2);
        ctx.lineWidth = 6;
        ctx.setLineDash([18, 14]);
        ctx.strokeStyle = brandKit.secondaryColor || "#F48B7E";
        ctx.stroke();
        ctx.restore();

        if (mascotImg) {
          ctx.save();
          ctx.beginPath();
          ctx.arc(540, 410, 220, 0, Math.PI * 2);
          ctx.clip();
          ctx.drawImage(mascotImg, 320, 190, 440, 440);
          ctx.restore();
        }

        drawStickerText(ctx, brandKit.brandName, 540, 680, 96, 18);
        drawStickerText(ctx, brandKit.tagline, 540, 775, 42, 10);

        ctx.fillStyle = brandKit.darkColor || "#4A2E2B";
        ctx.textAlign = "center";
        ctx.font = "800 26px Quicksand, sans-serif";
        ctx.fillText(brandKit.stickerNote, 540, 845);

        ctx.fillStyle = brandKit.primaryColor || "#E86F5F";
        ctx.font = "900 32px Quicksand, sans-serif";
        ctx.fillText(`📞 Zalo Đặt Bánh: ${settings.phone}`, 540, 905);
      } else if (templateId === "SOCIAL_POST_1080x1080") {
        canvas.width = 1080;
        canvas.height = 1080;
        drawFlandiBackground(ctx, 1080, 1080);

        drawStickerText(ctx, brandKit.brandName, 540, 120, 96, 18);
        drawStickerText(ctx, brandKit.promoHeadline, 540, 215, 44, 10);

        const coords = [
          { x: 310, y: 460 },
          { x: 770, y: 460 },
          { x: 310, y: 800 },
          { x: 770, y: 800 },
        ];
        products.slice(0, 4).forEach((p, idx) => {
          const pos = coords[idx];
          if (!pos) return;
          drawCircularDish(
            ctx,
            prodImages[idx],
            pos.x,
            pos.y,
            125,
            p.name,
            p.badgeText,
            p.secondaryBadgeText
          );
        });

        ctx.fillStyle = brandKit.primaryColor || "#E86F5F";
        ctx.beginPath();
        ctx.roundRect(140, 975, 800, 64, 32);
        ctx.fill();
        ctx.fillStyle = "#FFFFFF";
        ctx.textAlign = "center";
        ctx.font = "800 26px Quicksand, sans-serif";
        ctx.fillText(brandKit.promoSubheadline, 540, 1016);
      } else if (templateId === "STORY_STANDEE_1080x1920") {
        canvas.width = 1080;
        canvas.height = 1920;
        drawFlandiBackground(ctx, 1080, 1920);

        if (mascotImg) {
          ctx.save();
          ctx.beginPath();
          ctx.arc(540, 240, 140, 0, Math.PI * 2);
          ctx.clip();
          ctx.drawImage(mascotImg, 400, 100, 280, 280);
          ctx.restore();
        }

        drawStickerText(ctx, brandKit.brandName, 540, 450, 110, 20);
        drawStickerText(ctx, brandKit.tagline, 540, 555, 52, 12);

        const coords = [
          { x: 310, y: 820 },
          { x: 770, y: 820 },
          { x: 310, y: 1220 },
          { x: 770, y: 1220 },
        ];
        products.slice(0, 4).forEach((p, idx) => {
          const pos = coords[idx];
          if (!pos) return;
          drawCircularDish(
            ctx,
            prodImages[idx],
            pos.x,
            pos.y,
            135,
            p.name,
            p.badgeText,
            p.secondaryBadgeText
          );
        });

        // Bottom VietQR & Contact Box
        ctx.fillStyle = "#FFFFFF";
        ctx.beginPath();
        ctx.roundRect(110, 1470, 860, 360, 40);
        ctx.fill();
        ctx.lineWidth = 6;
        ctx.strokeStyle = brandKit.secondaryColor || "#F48B7E";
        ctx.stroke();

        const qrUrl = `https://img.vietqr.io/image/${settings.bankBin}-${settings.bankAccountNo}-compact2.png?addInfo=${encodeURIComponent(
          "FLANDI"
        )}&accountName=${encodeURIComponent(settings.bankAccountName)}`;
        const qrImg = await loadImage(qrUrl);
        if (qrImg) {
          ctx.drawImage(qrImg, 150, 1500, 300, 300);
        }

        ctx.textAlign = "left";
        ctx.fillStyle = brandKit.primaryColor || "#E86F5F";
        ctx.font = "900 38px Quicksand, sans-serif";
        ctx.fillText("QUÉT QR THANH TOÁN", 480, 1565);

        ctx.fillStyle = brandKit.darkColor || "#4A2E2B";
        ctx.font = "800 30px Quicksand, sans-serif";
        ctx.fillText(`Ngân hàng: ${settings.bankName}`, 480, 1625);
        ctx.fillText(`STK: ${settings.bankAccountNo}`, 480, 1675);
        ctx.fillText(`Chủ TK: ${settings.bankAccountName}`, 480, 1725);

        ctx.fillStyle = brandKit.primaryColor || "#E86F5F";
        ctx.font = "900 32px Quicksand, sans-serif";
        ctx.fillText(`📞 Zalo: ${settings.phone}`, 480, 1785);
      } else if (templateId === "THANK_YOU_CARD_1920x1080") {
        canvas.width = 1920;
        canvas.height = 1080;
        drawFlandiBackground(ctx, 1920, 1080);

        if (mascotImg) {
          ctx.save();
          ctx.beginPath();
          ctx.arc(960, 250, 145, 0, Math.PI * 2);
          ctx.clip();
          ctx.drawImage(mascotImg, 815, 105, 290, 290);
          ctx.restore();
        }

        drawStickerText(ctx, brandKit.thankYouTitle, 960, 475, 76, 16);

        ctx.fillStyle = brandKit.darkColor || "#4A2E2B";
        ctx.textAlign = "center";
        ctx.font = "700 34px Quicksand, sans-serif";
        ctx.fillText(brandKit.thankYouMessage.slice(0, 95), 960, 575);
        if (brandKit.thankYouMessage.length > 95) {
          ctx.fillText(brandKit.thankYouMessage.slice(95), 960, 625);
        }

        // Storage instruction box
        ctx.fillStyle = "#FFFFFF";
        ctx.beginPath();
        ctx.roundRect(260, 690, 1400, 170, 36);
        ctx.fill();
        ctx.lineWidth = 5;
        ctx.strokeStyle = brandKit.secondaryColor || "#F48B7E";
        ctx.stroke();

        ctx.fillStyle = brandKit.primaryColor || "#E86F5F";
        ctx.font = "900 32px Quicksand, sans-serif";
        ctx.fillText("❄️ HƯỚNG DẪN BẢO QUẢN BÁNH NGON NHẤT", 960, 750);

        ctx.fillStyle = brandKit.darkColor || "#4A2E2B";
        ctx.font = "700 28px Quicksand, sans-serif";
        ctx.fillText(brandKit.storageInstruction, 960, 810);

        ctx.fillStyle = brandKit.primaryColor || "#E86F5F";
        ctx.font = "900 34px Quicksand, sans-serif";
        ctx.fillText(
          `FLANDI — ${brandKit.tagline} • Hotline/Zalo: ${settings.phone}`,
          960,
          950
        );
      }

      const dataUrl = canvas.toDataURL("image/png", 1.0);
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = `FLANDI-${templateId}-FullHD.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      notify(`🎉 Đã tải xuống ${templateId} chuẩn Full HD (.PNG)!`);
    } catch (err) {
      console.error(err);
      notify("Có lỗi khi xuất file PNG Full HD!");
    } finally {
      setIsExporting(null);
    }
  };

  const assetTemplates: {
    id: AssetTemplateId;
    title: string;
    resolution: string;
    ratio: string;
    desc: string;
  }[] = [
    {
      id: "COVER_1920x1080",
      title: "1. Banner Cover Facebook / Web Full HD",
      resolution: "1920 × 1080 px (Full HD)",
      ratio: "16:9 Ngang",
      desc: "Ảnh bìa Fanpage, Zalo OA, Hero Banner Website kèm đủ 6 món & Hotline.",
    },
    {
      id: "MENU_POSTER_1440x2048",
      title: "2. Menu Poster Chuẩn In Ấn & Đăng Bài",
      resolution: "1440 × 2048 px (Ultra HD)",
      ratio: "Dọc A4/Poster",
      desc: "Menu Poster chuẩn thiết kế gốc, tự động đồng bộ giá & món từ hệ thống.",
    },
    {
      id: "CUP_STICKER_1080x1080",
      title: "3. Logo Mascot & Tem Tròn Dán Hũ Bánh",
      resolution: "1080 × 1080 px (HD 1:1)",
      ratio: "1:1 Tròn",
      desc: "Tem decal tròn dán nắp hũ Flan, Panna Cotta, Tàu hũ, Sữa chua nhà làm.",
    },
    {
      id: "SOCIAL_POST_1080x1080",
      title: "4. Bài Đăng Quảng Cáo Vuông (Social Post)",
      resolution: "1080 × 1080 px (HD 1:1)",
      ratio: "1:1 Vuông",
      desc: "Ảnh đăng bài Facebook / Instagram giới thiệu mẻ bánh mới ra lò mỗi sáng.",
    },
    {
      id: "STORY_STANDEE_1080x1920",
      title: "5. Standee Quầy POS & Story Quét Mã VietQR",
      resolution: "1080 × 1920 px (Full HD Dọc)",
      ratio: "9:16 Dọc",
      desc: "Standee để bàn thu ngân tích hợp mã VietQR ngân hàng & SĐT Zalo.",
    },
    {
      id: "THANK_YOU_CARD_1920x1080",
      title: "6. Thẻ Cảm Ơn & Hướng Dẫn Bảo Quản Lạnh",
      resolution: "1920 × 1080 px (Full HD)",
      ratio: "16:9 Thẻ ngang",
      desc: "Thẻ in bỏ vào túi giao bánh kèm lời cảm ơn và hướng dẫn giữ lạnh 2–6°C.",
    },
  ];

  return (
    <div className="space-y-8">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-flandi-coral via-flandi-salmon to-flandi-coral rounded-3xl p-6 text-white shadow-cute flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/20 text-xs font-extrabold">
            <Sparkles className="w-3.5 h-3.5" />
            <span>FLANDI BRAND IDENTITY & FULL HD STUDIO</span>
          </div>
          <h2 className="font-display text-2xl sm:text-3xl tracking-wide">
            Bộ Nhận Diện Thương Hiệu FLANDI (Full HD)
          </h2>
          <p className="text-xs sm:text-sm text-white/90 font-semibold max-w-2xl">
            Quản lý tập trung Logo Mascot, Bảng màu, Font chữ, Tem dán hũ bánh, Thẻ cảm ơn, Standee VietQR và xuất file ảnh PNG độ phân giải chuẩn Full HD (1920×1080 / 1440×2048) chỉ với 1 cú nhấp chuột!
          </p>
        </div>

        <button
          type="button"
          onClick={() => handleSaveBrandKit()}
          disabled={isSaving}
          className="px-5 py-3 rounded-2xl bg-white text-flandi-coral hover:bg-flandi-cream font-extrabold text-xs sm:text-sm shadow-lg flex items-center gap-2 shrink-0 self-start md:self-auto transition"
        >
          <Save className="w-4 h-4" />
          <span>{isSaving ? "Đang lưu..." : "Lưu Cấu Hình Branding"}</span>
        </button>
      </div>

      {/* Section 1: Logos, Colors & Typography Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left 5 cols: Official Logos & Mascot */}
        <div className="lg:col-span-5 bg-white rounded-3xl border-2 border-flandi-pink p-6 space-y-5 shadow-xs">
          <h3 className="font-extrabold text-base text-flandi-dark flex items-center gap-2">
            <ImageIcon className="w-5 h-5 text-flandi-coral" />
            <span>Hệ Thống Logo & Linh Vật (Mascot HD)</span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Mascot Emblem Card */}
            <div className="p-4 rounded-2xl bg-flandi-grid border-2 border-flandi-salmon flex flex-col items-center text-center space-y-2.5">
              <img
                src={brandKit.mascotImage}
                alt="FLANDI Mascot Emblem"
                className="w-32 h-32 rounded-full object-cover shadow-cute border-2 border-white"
              />
              <div>
                <p className="font-extrabold text-xs text-flandi-dark">
                  Logo Linh Vật (Mascot Emblem)
                </p>
                <p className="text-[11px] text-flandi-muted font-semibold">
                  1080 × 1080 px • PNG Chuẩn In
                </p>
              </div>
              <a
                href={brandKit.mascotImage}
                download="FLANDI-Mascot-Logo-1080x1080.png"
                className="w-full py-2 rounded-xl bg-flandi-coral text-white font-extrabold text-xs flex items-center justify-center gap-1.5 shadow-xs hover:bg-flandi-salmon transition"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Tải Logo Mascot HD</span>
              </a>
            </div>

            {/* Wordmark Sticker Logo Card */}
            <div className="p-4 rounded-2xl bg-flandi-grid border-2 border-flandi-pink flex flex-col items-center justify-between text-center space-y-2.5">
              <div className="py-6 flex flex-col items-center justify-center">
                <div className="inline-flex items-end justify-center gap-0.5">
                  {["F", "L", "A", "N", "D", "I"].map((ch, i) => (
                    <span
                      key={i}
                      className="font-display text-3xl text-sticker-sm"
                    >
                      {ch}
                    </span>
                  ))}
                </div>
                <span className="font-display text-sm text-sticker-sm mt-1">
                  {brandKit.tagline}
                </span>
              </div>
              <div>
                <p className="font-extrabold text-xs text-flandi-dark">
                  Wordmark Sticker (Chữ Nổi)
                </p>
                <p className="text-[11px] text-flandi-muted font-semibold">
                  Font Coiny • Viền Coral #E86F5F
                </p>
              </div>
              <button
                type="button"
                onClick={() => exportFullHdAsset("CUP_STICKER_1080x1080")}
                className="w-full py-2 rounded-xl bg-flandi-cream text-flandi-coral border border-flandi-salmon font-extrabold text-xs flex items-center justify-center gap-1.5 hover:bg-flandi-pink/50 transition"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Xuất Tem Tròn 1080p</span>
              </button>
            </div>
          </div>

          {/* Typography Box */}
          <div className="p-4 rounded-2xl bg-flandi-bg border border-flandi-pink space-y-2">
            <div className="flex items-center gap-2 text-xs font-extrabold text-flandi-coral">
              <Type className="w-4 h-4" />
              <span>BỘ FONT CHỮ THƯƠNG HIỆU (VIETNAMESE SUPPORT)</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div className="p-3 rounded-xl bg-white border border-flandi-pink">
                <span className="text-[10px] font-bold text-flandi-muted uppercase">
                  Tiêu đề & Tên bánh
                </span>
                <p className="font-display text-xl text-sticker-sm mt-0.5">
                  Coiny Regular
                </p>
                <p className="text-[11px] text-flandi-muted font-semibold mt-0.5">
                  Bo tròn mập mạp, tạo hiệu ứng chữ kem/bánh núng nính.
                </p>
              </div>
              <div className="p-3 rounded-xl bg-white border border-flandi-pink">
                <span className="text-[10px] font-bold text-flandi-muted uppercase">
                  Nội dung & Giá tiền
                </span>
                <p className="font-sans font-extrabold text-lg text-flandi-dark mt-0.5">
                  Quicksand Bold
                </p>
                <p className="text-[11px] text-flandi-muted font-semibold mt-0.5">
                  Hiện đại, nét tròn thân thiện, hiển thị số & dấu tiếng Việt rõ nét.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Right 7 cols: Brand Color Palette & Editable Brand Voice */}
        <div className="lg:col-span-7 bg-white rounded-3xl border-2 border-flandi-pink p-6 space-y-5 shadow-xs">
          <div className="flex items-center justify-between">
            <h3 className="font-extrabold text-base text-flandi-dark flex items-center gap-2">
              <Palette className="w-5 h-5 text-flandi-coral" />
              <span>Bảng Màu Chuẩn Thương Hiệu (Chạm Để Copy Mã HEX)</span>
            </h3>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {brandKit.colors.map((c, idx) => (
              <div
                key={c.id}
                className="p-3 rounded-2xl border border-flandi-pink bg-flandi-bg/60 flex flex-col justify-between gap-2"
              >
                <div className="flex items-center justify-between gap-2">
                  <div
                    className="w-10 h-10 rounded-xl border-2 border-white shadow-sm shrink-0"
                    style={{ backgroundColor: c.hex }}
                  />
                  <input
                    type="color"
                    value={c.hex}
                    onChange={(e) => {
                      const nextColors = [...brandKit.colors];
                      nextColors[idx] = { ...c, hex: e.target.value.toUpperCase() };
                      setBrandKit({ ...brandKit, colors: nextColors });
                    }}
                    className="w-7 h-7 rounded cursor-pointer border-0 bg-transparent"
                    title="Đổi màu"
                  />
                  <button
                    type="button"
                    onClick={() => handleCopyHex(c.hex)}
                    className="px-2.5 py-1 rounded-lg bg-white border border-flandi-pink text-xs font-extrabold text-flandi-dark flex items-center gap-1 hover:border-flandi-coral"
                  >
                    {copiedHex === c.hex ? (
                      <Check className="w-3 h-3 text-emerald-600" />
                    ) : (
                      <Copy className="w-3 h-3 text-flandi-coral" />
                    )}
                    <span>{c.hex}</span>
                  </button>
                </div>
                <div>
                  <p className="font-extrabold text-xs text-flandi-dark">
                    {c.name}
                  </p>
                  <p className="text-[11px] text-flandi-muted font-medium leading-snug mt-0.5">
                    {c.usage}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* Editable Brand Content Form */}
          <form
            onSubmit={handleSaveBrandKit}
            className="pt-3 border-t border-flandi-pink space-y-3 text-xs"
          >
            <h4 className="font-extrabold text-xs uppercase tracking-wider text-flandi-coral">
              Tuỳ Chỉnh Nội Dung Bộ Nhận Diện & Ấn Phẩm In Ấn
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="font-bold text-flandi-muted block mb-1">
                  Tên thương hiệu (Brand Name)
                </label>
                <input
                  type="text"
                  value={brandKit.brandName}
                  onChange={(e) =>
                    setBrandKit({ ...brandKit, brandName: e.target.value })
                  }
                  className="w-full px-3 py-2 rounded-xl border border-flandi-pink font-extrabold"
                />
              </div>
              <div>
                <label className="font-bold text-flandi-muted block mb-1">
                  Slogan chính (Tagline)
                </label>
                <input
                  type="text"
                  value={brandKit.tagline}
                  onChange={(e) =>
                    setBrandKit({ ...brandKit, tagline: e.target.value })
                  }
                  className="w-full px-3 py-2 rounded-xl border border-flandi-pink font-extrabold"
                />
              </div>
              <div>
                <label className="font-bold text-flandi-muted block mb-1">
                  Dòng cam kết trên Tem Dán Hũ Bánh
                </label>
                <input
                  type="text"
                  value={brandKit.stickerNote}
                  onChange={(e) =>
                    setBrandKit({ ...brandKit, stickerNote: e.target.value })
                  }
                  className="w-full px-3 py-2 rounded-xl border border-flandi-pink font-bold"
                />
              </div>
              <div>
                <label className="font-bold text-flandi-muted block mb-1">
                  Tiêu đề Bài Quảng Cáo (Social Promo)
                </label>
                <input
                  type="text"
                  value={brandKit.promoHeadline}
                  onChange={(e) =>
                    setBrandKit({ ...brandKit, promoHeadline: e.target.value })
                  }
                  className="w-full px-3 py-2 rounded-xl border border-flandi-pink font-bold"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="font-bold text-flandi-muted block mb-1">
                  Lời nhắn trên Thẻ Cảm Ơn (Thank You Card)
                </label>
                <input
                  type="text"
                  value={brandKit.thankYouMessage}
                  onChange={(e) =>
                    setBrandKit({ ...brandKit, thankYouMessage: e.target.value })
                  }
                  className="w-full px-3 py-2 rounded-xl border border-flandi-pink font-semibold"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="font-bold text-flandi-muted block mb-1">
                  Hướng dẫn bảo quản lạnh trên Thẻ & Tem
                </label>
                <input
                  type="text"
                  value={brandKit.storageInstruction}
                  onChange={(e) =>
                    setBrandKit({
                      ...brandKit,
                      storageInstruction: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 rounded-xl border border-flandi-pink font-semibold"
                />
              </div>
            </div>
          </form>
        </div>
      </div>

      {/* Section 2: Full HD Asset Generator & Live Preview Studio */}
      <div className="bg-white rounded-3xl border-2 border-flandi-salmon p-6 shadow-cute space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-flandi-pink pb-4">
          <div>
            <h3 className="font-extrabold text-lg text-flandi-dark flex items-center gap-2">
              <Layers className="w-5 h-5 text-flandi-coral" />
              <span>Studio Xuất Ấn Phẩm Thương Hiệu Chuẩn Full HD (6 Mẫu)</span>
            </h3>
            <p className="text-xs text-flandi-muted font-semibold">
              Chọn mẫu ấn phẩm bên dưới để xem trước trực tiếp và tải về file PNG sắc nét độ phân giải Full HD
            </p>
          </div>

          <button
            type="button"
            onClick={() => exportFullHdAsset(selectedAsset)}
            disabled={isExporting !== null}
            className="px-5 py-3 rounded-2xl bg-flandi-coral hover:bg-flandi-salmon text-white font-extrabold text-xs sm:text-sm shadow-cute flex items-center gap-2 self-start sm:self-auto transition"
          >
            <Download className="w-4 h-4" />
            <span>
              {isExporting
                ? "Đang kết xuất Full HD..."
                : "Tải Mẫu Đang Chọn (.PNG Full HD)"}
            </span>
          </button>
        </div>

        {/* 6 Template Selector Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {assetTemplates.map((tpl) => {
            const active = selectedAsset === tpl.id;
            return (
              <div
                key={tpl.id}
                onClick={() => setSelectedAsset(tpl.id)}
                className={`cursor-pointer p-4 rounded-2xl border-2 transition flex flex-col justify-between gap-3 ${
                  active
                    ? "border-flandi-coral bg-flandi-salmon/10 shadow-sm"
                    : "border-flandi-pink bg-flandi-bg/50 hover:border-flandi-salmon"
                }`}
              >
                <div className="space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="px-2.5 py-0.5 rounded-full bg-white border border-flandi-pink text-[10px] font-extrabold text-flandi-coral">
                      {tpl.resolution}
                    </span>
                    <span className="text-[10px] font-bold text-flandi-muted">
                      {tpl.ratio}
                    </span>
                  </div>
                  <h4 className="font-extrabold text-sm text-flandi-dark pt-1">
                    {tpl.title}
                  </h4>
                  <p className="text-xs text-flandi-muted font-medium leading-relaxed">
                    {tpl.desc}
                  </p>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-flandi-pink/60">
                  <span className="text-xs font-extrabold text-flandi-coral flex items-center gap-1">
                    <Eye className="w-3.5 h-3.5" />
                    <span>{active ? "Đang xem trước" : "Xem mẫu này"}</span>
                  </span>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      exportFullHdAsset(tpl.id);
                    }}
                    className="px-3 py-1.5 rounded-xl bg-flandi-coral hover:bg-flandi-salmon text-white font-extrabold text-xs flex items-center gap-1 shadow-2xs"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Tải Full HD</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Live Interactive Responsive Preview Canvas Box */}
        <div className="p-4 sm:p-8 rounded-3xl bg-flandi-bg border-2 border-dashed border-flandi-salmon">
          <div className="text-center mb-4">
            <span className="px-3.5 py-1 rounded-full bg-white border border-flandi-pink text-xs font-extrabold text-flandi-coral">
              BẢN XEM TRƯỚC TRỰC TIẾP (LIVE RESPONSIVE PREVIEW)
            </span>
          </div>

          {/* PREVIEW 1: 1920x1080 COVER BANNER */}
          {selectedAsset === "COVER_1920x1080" && (
            <div className="max-w-5xl mx-auto aspect-video rounded-3xl border-4 border-flandi-salmon bg-flandi-grid p-6 sm:p-10 shadow-cute-lg relative overflow-hidden flex flex-col lg:flex-row items-center justify-between gap-6">
              <div className="lg:w-5/12 text-center flex flex-col items-center space-y-3 z-10">
                <img
                  src={brandKit.mascotImage}
                  alt="Mascot"
                  className="w-28 h-28 sm:w-36 sm:h-36 rounded-full object-cover border-4 border-white shadow-cute"
                />
                <h2 className="font-display text-4xl sm:text-5xl text-sticker-lg leading-none">
                  {brandKit.brandName}
                </h2>
                <p className="font-display text-xl sm:text-2xl text-sticker-sm">
                  {brandKit.tagline}
                </p>
                <p className="text-xs font-bold text-flandi-dark">
                  {brandKit.subTagline}
                </p>
                <div className="px-5 py-2 rounded-full bg-flandi-coral text-white font-extrabold text-xs sm:text-sm shadow">
                  📞 Đặt bánh / Zalo: {settings.phone}
                </div>
              </div>

              <div className="lg:w-7/12 grid grid-cols-3 gap-4 z-10">
                {products.slice(0, 6).map((p) => (
                  <div
                    key={p.id}
                    className="flex flex-col items-center text-center"
                  >
                    <div className="relative w-20 h-20 sm:w-28 sm:h-28 rounded-full p-1.5 bg-flandi-salmon shadow-cute">
                      <img
                        src={p.image}
                        alt={p.name}
                        className="w-full h-full rounded-full object-cover border-2 border-white"
                      />
                      <span className="absolute -top-1 -right-1 px-2 py-0.5 rounded-full bg-flandi-coral text-white text-[10px] font-extrabold border border-white">
                        {p.badgeText}
                      </span>
                    </div>
                    <span className="font-display text-sm sm:text-base text-sticker-sm -mt-2">
                      {p.name}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* PREVIEW 2: MENU POSTER 1440x2048 */}
          {selectedAsset === "MENU_POSTER_1440x2048" && (
            <div className="max-w-xl mx-auto">
              <MenuPoster products={products} settings={settings} />
            </div>
          )}

          {/* PREVIEW 3: CUP STICKER 1080x1080 */}
          {selectedAsset === "CUP_STICKER_1080x1080" && (
            <div className="max-w-md mx-auto aspect-square rounded-full border-8 border-flandi-coral bg-flandi-grid p-6 shadow-cute-lg flex flex-col items-center justify-center text-center relative">
              <div className="absolute inset-3 rounded-full border-2 border-dashed border-flandi-salmon pointer-events-none" />
              <img
                src={brandKit.mascotImage}
                alt="Mascot"
                className="w-36 h-36 sm:w-44 sm:h-44 rounded-full object-cover border-4 border-white shadow-md"
              />
              <h3 className="font-display text-3xl sm:text-4xl text-sticker mt-2">
                {brandKit.brandName}
              </h3>
              <p className="font-display text-base sm:text-lg text-sticker-sm">
                {brandKit.tagline}
              </p>
              <p className="text-[11px] sm:text-xs font-extrabold text-flandi-dark mt-2 max-w-xs">
                {brandKit.stickerNote}
              </p>
              <div className="mt-2 px-4 py-1 rounded-full bg-flandi-coral text-white font-extrabold text-xs">
                Zalo: {settings.phone}
              </div>
            </div>
          )}

          {/* PREVIEW 4: SOCIAL POST 1080x1080 */}
          {selectedAsset === "SOCIAL_POST_1080x1080" && (
            <div className="max-w-lg mx-auto aspect-square rounded-3xl border-4 border-flandi-salmon bg-flandi-grid p-6 shadow-cute-lg flex flex-col justify-between text-center">
              <div>
                <h3 className="font-display text-4xl text-sticker">
                  {brandKit.brandName}
                </h3>
                <p className="font-display text-lg sm:text-xl text-sticker-sm mt-1">
                  {brandKit.promoHeadline}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4 my-auto py-4">
                {products.slice(0, 4).map((p) => (
                  <div
                    key={p.id}
                    className="flex flex-col items-center text-center"
                  >
                    <div className="relative w-24 h-24 sm:w-28 sm:h-28 rounded-full p-1.5 bg-flandi-salmon shadow">
                      <img
                        src={p.image}
                        alt={p.name}
                        className="w-full h-full rounded-full object-cover border-2 border-white"
                      />
                      <span className="absolute -top-1 -right-1 px-2 py-0.5 rounded-full bg-flandi-coral text-white text-[10px] font-extrabold border border-white">
                        {p.badgeText}
                      </span>
                    </div>
                    <span className="font-display text-base text-sticker-sm -mt-2">
                      {p.name}
                    </span>
                  </div>
                ))}
              </div>

              <div className="py-2.5 px-4 rounded-full bg-flandi-coral text-white font-extrabold text-xs sm:text-sm">
                {brandKit.promoSubheadline}
              </div>
            </div>
          )}

          {/* PREVIEW 5: STORY / STANDEE 1080x1920 */}
          {selectedAsset === "STORY_STANDEE_1080x1920" && (
            <div className="max-w-sm mx-auto rounded-[2.5rem] border-4 border-flandi-salmon bg-flandi-grid p-6 shadow-cute-lg flex flex-col items-center text-center space-y-5">
              <img
                src={brandKit.mascotImage}
                alt="Mascot"
                className="w-24 h-24 rounded-full object-cover border-2 border-white shadow"
              />
              <div>
                <h3 className="font-display text-4xl text-sticker">
                  {brandKit.brandName}
                </h3>
                <p className="font-display text-lg text-sticker-sm">
                  {brandKit.tagline}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4 w-full">
                {products.slice(0, 4).map((p) => (
                  <div key={p.id} className="flex flex-col items-center">
                    <img
                      src={p.image}
                      alt={p.name}
                      className="w-20 h-20 rounded-full object-cover border-2 border-flandi-salmon"
                    />
                    <span className="font-display text-sm text-sticker-sm -mt-2">
                      {p.name}
                    </span>
                  </div>
                ))}
              </div>

              <div className="w-full bg-white p-4 rounded-2xl border-2 border-flandi-pink flex items-center gap-3 text-left">
                <img
                  src={`https://img.vietqr.io/image/${settings.bankBin}-${settings.bankAccountNo}-compact2.png?addInfo=FLANDI`}
                  alt="VietQR"
                  className="w-24 h-24 rounded-xl border border-flandi-pink object-contain shrink-0"
                />
                <div className="text-xs space-y-1">
                  <p className="font-extrabold text-flandi-coral">
                    QUÉT QR THANH TOÁN
                  </p>
                  <p className="font-bold text-flandi-dark">
                    {settings.bankName}
                  </p>
                  <p className="font-extrabold text-flandi-dark">
                    STK: {settings.bankAccountNo}
                  </p>
                  <p className="font-bold text-flandi-muted">
                    Zalo: {settings.phone}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* PREVIEW 6: THANK YOU CARD 1920x1080 */}
          {selectedAsset === "THANK_YOU_CARD_1920x1080" && (
            <div className="max-w-3xl mx-auto rounded-3xl border-4 border-flandi-salmon bg-flandi-grid p-6 sm:p-10 shadow-cute-lg text-center space-y-4">
              <img
                src={brandKit.mascotImage}
                alt="Mascot"
                className="w-24 h-24 rounded-full object-cover mx-auto border-4 border-white shadow"
              />
              <h3 className="font-display text-2xl sm:text-4xl text-sticker">
                {brandKit.thankYouTitle}
              </h3>
              <p className="text-xs sm:text-sm font-bold text-flandi-dark max-w-xl mx-auto leading-relaxed">
                {brandKit.thankYouMessage}
              </p>
              <div className="bg-white p-4 rounded-2xl border-2 border-flandi-pink max-w-xl mx-auto space-y-1">
                <p className="text-xs font-extrabold text-flandi-coral">
                  ❄️ HƯỚNG DẪN BẢO QUẢN BÁNH NGON NHẤT
                </p>
                <p className="text-xs font-semibold text-flandi-dark">
                  {brandKit.storageInstruction}
                </p>
              </div>
              <p className="text-xs font-extrabold text-flandi-coral pt-1">
                {brandKit.brandName} — “{brandKit.tagline}” • Hotline/Zalo:{" "}
                {settings.phone}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
