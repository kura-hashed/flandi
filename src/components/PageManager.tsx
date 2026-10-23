"use client";

import React, { useState } from "react";
import {
  PageConfig,
  Product,
  ShopSettings,
  StoryFeatureItem,
  MediaResourceItem,
} from "@/lib/types";
import {
  Layout,
  Eye,
  EyeOff,
  FileText,
  Image as ImageIcon,
  Save,
  Plus,
  Trash2,
  Copy,
  Check,
  Sparkles,
  Upload,
  ExternalLink,
  RotateCcw,
} from "lucide-react";

interface PageManagerProps {
  settings: ShopSettings;
  products: Product[];
  onSaveSettings: (nextSettings: ShopSettings) => Promise<void>;
  onUpdateProductImage?: (product: Product, newImageUrl: string) => Promise<void>;
  notify: (msg: string) => void;
}

export const FALLBACK_PAGE_CONFIG: PageConfig = {
  showAnnouncementBar: true,
  showHeroSection: true,
  showHeroCollage: true,
  showMenuPosterButton: true,
  showMenuSection: true,
  showStorySection: true,
  showStoryPosterPreview: true,
  showFloatingZalo: true,
  showFloatingMessenger: true,
  showOwnerLinks: true,

  headerLogoUrl: "/images/branding/flandi-mascot.png",
  heroBadgeText: "Tiệm Tráng Miệng Thủ Công Tươi Mới Mỗi Ngày",
  heroTitle: "FLANDI",
  heroSubtitle: "Muốn ăn hãy Flăn vào tớ",
  heroDescription:
    "Từ những chiếc Bánh Flan trứng sữa mềm mịn, Panna Cotta sốt trái cây tươi chua ngọt, đến Rau Câu Dừa Nhân Flan, Rau Câu Lá, Tàu Hũ Singapore & Yogurt nhà làm béo thanh!",
  heroPrimaryCtaText: "Flăn vào chọn món ngay",
  heroSecondaryCtaText: "Menu Poster",
  heroCollageTitle: "Menu Nhà FLANDI",
  heroCollageSubtitle: "Chạm vào món bất kỳ để thêm nhanh vào giỏ bánh!",

  menuTitle: "Thực Đơn Ngọt Ngào",
  menuSubtitle:
    "Chọn vị yêu thích, đặt theo cái lẻ hoặc theo chục/hộp siêu tiết kiệm!",
  menuSearchPlaceholder: "Tìm Flan, Panna Cotta, Rau câu...",

  storyBadgeText: "CÂU CHUYỆN BẾP NHÀ FLANDI",
  storyTitle: "Ngọt Dịu Tự Nhiên — Làm Mới Mỗi Sáng",
  storyDescription:
    "Tại FLANDI, mỗi hũ bánh Flan, Panna Cotta, Tàu Hũ Singapore hay từng chiếc lá Rau Câu đều được tụi mình tự tay chuẩn bị mỗi sáng sớm. Công thức giảm ngọt vừa vặn để bạn ăn hoài không ngán!",
  storyFeatures: [
    {
      id: "feat-1",
      icon: "SPARKLES",
      title: "100% Nguyên Liệu Tươi",
      description:
        "Trứng gà ta, sữa tươi, nước dừa xiêm, lá dứa tươi & trái cây thật.",
      enabled: true,
    },
    {
      id: "feat-2",
      icon: "TRUCK",
      title: "Giữ Lạnh Chuẩn Vị Khi Giao",
      description:
        "Đóng gói cẩn thận kèm đá gel giữ lạnh để bánh luôn mát mịn.",
      enabled: true,
    },
    {
      id: "feat-3",
      icon: "SHIELD",
      title: "Không Chất Bảo Quản",
      description:
        "Mẻ bánh làm mới trong ngày, an toàn cho cả bé nhỏ & gia đình.",
      enabled: true,
    },
    {
      id: "feat-4",
      icon: "HEART",
      title: "Nhận Đặt Tiệc & Liên Hoan",
      description:
        "Ưu đãi hấp dẫn cho đơn đặt tiệc sinh nhật, họp mặt, trà chiều công ty.",
      enabled: true,
    },
  ],

  footerDescription:
    "Tiệm bánh Flan, Panna Cotta, Rau câu dừa, Rau câu lá, Tàu hũ Singapore & Sữa chua nhà làm.",

  resources: [
    {
      id: "res-mascot",
      name: "Logo Mascot FLANDI (1080p)",
      url: "/images/branding/flandi-mascot.png",
      category: "LOGO",
    },
    {
      id: "res-flan",
      name: "Ảnh Bánh Flan Truyền Thống",
      url: "/images/products/flan.png",
      category: "PRODUCT",
    },
    {
      id: "res-pc",
      name: "Ảnh Panna Cotta Trái Cây",
      url: "/images/products/panna-cotta.png",
      category: "PRODUCT",
    },
    {
      id: "res-rcd",
      name: "Ảnh Rau Câu Dừa (Flan)",
      url: "/images/products/rau-cau-dua.png",
      category: "PRODUCT",
    },
    {
      id: "res-rcl",
      name: "Ảnh Rau Câu Lá Dứa Cà Phê",
      url: "/images/products/rau-cau-la.png",
      category: "PRODUCT",
    },
    {
      id: "res-th",
      name: "Ảnh Tàu Hũ Singapore",
      url: "/images/products/tau-hu-singapore.png",
      category: "PRODUCT",
    },
    {
      id: "res-yg",
      name: "Ảnh Sữa Chua Nhà Làm (Yogurt)",
      url: "/images/products/yogurt.png",
      category: "PRODUCT",
    },
  ],
};

export default function PageManager({
  settings,
  products,
  onSaveSettings,
  onUpdateProductImage,
  notify,
}: PageManagerProps) {
  const [config, setConfig] = useState<PageConfig>(
    settings.pageConfig || FALLBACK_PAGE_CONFIG
  );
  const [announcement, setAnnouncement] = useState<string>(
    settings.announcement || ""
  );
  const [subTab, setSubTab] = useState<"TOGGLES" | "CONTENT" | "RESOURCES">(
    "TOGGLES"
  );
  const [isSaving, setIsSaving] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);

  // New resource state
  const [newResName, setNewResName] = useState("");
  const [newResUrl, setNewResUrl] = useState("");
  const [newResCategory, setNewResCategory] = useState<
    "LOGO" | "PRODUCT" | "BANNER"
  >("PRODUCT");
  const [assignProductTargets, setAssignProductTargets] = useState<
    Record<string, string>
  >({});

  const handleSaveAll = async (customConfig?: PageConfig) => {
    const cfgToSave = customConfig || config;
    setIsSaving(true);
    try {
      await onSaveSettings({
        ...settings,
        announcement,
        pageConfig: cfgToSave,
      });
      notify("✅ Đã cập nhật cấu hình & nội dung trang chủ thành công!");
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleKey = async (key: keyof PageConfig) => {
    const nextConfig = {
      ...config,
      [key]: !config[key],
    };
    setConfig(nextConfig);
    await handleSaveAll(nextConfig);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const newItem: MediaResourceItem = {
        id: `res-${Date.now()}`,
        name: newResName.trim() || file.name.replace(/\.[^/.]+$/, ""),
        url: dataUrl,
        category: newResCategory,
      };
      const nextConfig = {
        ...config,
        resources: [newItem, ...(config.resources || [])],
      };
      setConfig(nextConfig);
      setNewResName("");
      notify(`Đã tải lên tài nguyên "${newItem.name}"! Bấm Lưu để áp dụng.`);
    };
    reader.readAsDataURL(file);
  };

  const handleAddUrlResource = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newResUrl.trim()) return;
    const newItem: MediaResourceItem = {
      id: `res-${Date.now()}`,
      name: newResName.trim() || "Hình ảnh mới",
      url: newResUrl.trim(),
      category: newResCategory,
    };
    setConfig({
      ...config,
      resources: [newItem, ...(config.resources || [])],
    });
    setNewResName("");
    setNewResUrl("");
    notify(`Đã thêm tài nguyên "${newItem.name}"!`);
  };

  const toggleItems: {
    key: keyof PageConfig;
    title: string;
    desc: string;
  }[] = [
    {
      key: "showAnnouncementBar",
      title: "Thanh Thông Báo Đầu Trang (Top Announcement)",
      desc: "Hiển thị dải băng thông báo ưu đãi / Freeship chạy ngang trên cùng trang web.",
    },
    {
      key: "showHeroSection",
      title: "Khu Vực Banner Chính (Hero Section)",
      desc: "Hiển thị tiêu đề lớn FLANDI, Slogan, giới thiệu nhanh và nút kêu gọi đặt món.",
    },
    {
      key: "showHeroCollage",
      title: "Khung 6 Món Bánh Nổi Bật Ở Đầu Trang",
      desc: "Hiển thị bảng 6 hình tròn món bánh phía bên phải khu vực Hero để khách bấm thêm nhanh.",
    },
    {
      key: "showMenuPosterButton",
      title: "Nút Xem Menu Poster",
      desc: "Hiển thị nút mở hộp thoại xem Menu Poster thiết kế trên thanh điều hướng và Hero.",
    },
    {
      key: "showMenuSection",
      title: "Khu Vực Thực Đơn & Chọn Vị Đặt Hàng (#menu)",
      desc: "Hiển thị bộ lọc danh mục, ô tìm kiếm và danh sách thẻ đặt bánh của tiệm.",
    },
    {
      key: "showStorySection",
      title: "Khu Vực Câu Chuyện Bếp Nhà FLANDI (#story)",
      desc: "Hiển thị phần giới thiệu nguyên liệu tươi, quy trình làm bánh mỗi sáng và cam kết chất lượng.",
    },
    {
      key: "showStoryPosterPreview",
      title: "Khung Menu Poster Thu Nhỏ Trong Phần Câu Chuyện",
      desc: "Hiển thị bản xem trước Menu Poster nằm cạnh 4 thẻ cam kết chất lượng.",
    },
    {
      key: "showFloatingMessenger",
      title: "Nút Nổi & Khung Chat Messenger Trực Tiếp Trên Trang",
      desc: "Cho phép khách bấm mở cửa sổ chat trực tiếp trên web mà không cần chuyển trang.",
    },
    {
      key: "showFloatingZalo",
      title: "Nút Nổi Chat Zalo Góc Phải Dưới",
      desc: "Hiển thị nút tròn Zalo màu xanh để khách nhắn Zalo nhanh.",
    },
    {
      key: "showOwnerLinks",
      title: "Nút Lối Tắt POS & Admin Trên Trang Khách",
      desc: "Bật để dễ dàng chuyển trang khi quản lý; tắt đi nếu bạn muốn ẩn lối tắt Admin đối với khách hàng.",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-white rounded-3xl border-2 border-flandi-salmon p-6 shadow-cute flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-flandi-pink/50 text-flandi-coral text-xs font-extrabold">
            <Layout className="w-3.5 h-3.5" />
            <span>QUẢN LÝ TRANG WEB & TÀI NGUYÊN (PAGE CMS)</span>
          </div>
          <h2 className="font-extrabold text-xl sm:text-2xl text-flandi-dark">
            Tuỳ Chỉnh Hiển Thị, Nội Dung & Hình Ảnh Trang Chủ
          </h2>
          <p className="text-xs text-flandi-muted font-semibold">
            Bật/tắt từng phân khu trên trang khách, thay đổi câu chữ, nút bấm và quản lý kho hình ảnh/logo ngay lập tức.
          </p>
        </div>

        <div className="flex items-center gap-2.5 self-start md:self-auto">
          <a
            href="/"
            target="_blank"
            rel="noreferrer"
            className="px-4 py-2.5 rounded-2xl bg-flandi-bg hover:bg-flandi-pink/50 text-flandi-dark border border-flandi-pink font-extrabold text-xs flex items-center gap-1.5"
          >
            <ExternalLink className="w-4 h-4 text-flandi-coral" />
            <span>Xem Trang Chủ</span>
          </a>
          <button
            type="button"
            onClick={() => handleSaveAll()}
            disabled={isSaving}
            className="px-5 py-2.5 rounded-2xl bg-flandi-coral hover:bg-flandi-salmon text-white font-extrabold text-xs sm:text-sm shadow-cute flex items-center gap-2 transition"
          >
            <Save className="w-4 h-4" />
            <span>{isSaving ? "Đang lưu..." : "Lưu Thay Đổi Trang"}</span>
          </button>
        </div>
      </div>

      {/* Sub-navigation Pills */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        <button
          type="button"
          onClick={() => setSubTab("TOGGLES")}
          className={`px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-extrabold flex items-center gap-2 transition ${
            subTab === "TOGGLES"
              ? "bg-flandi-coral text-white shadow-cute"
              : "bg-white text-flandi-dark border border-flandi-pink hover:border-flandi-salmon"
          }`}
        >
          <Eye className="w-4 h-4" />
          <span>1. Bật / Tắt Khu Vực Trang (10 mục)</span>
        </button>

        <button
          type="button"
          onClick={() => setSubTab("CONTENT")}
          className={`px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-extrabold flex items-center gap-2 transition ${
            subTab === "CONTENT"
              ? "bg-flandi-coral text-white shadow-cute"
              : "bg-white text-flandi-dark border border-flandi-pink hover:border-flandi-salmon"
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>2. Sửa Nội Dung & Văn Bản (Content)</span>
        </button>

        <button
          type="button"
          onClick={() => setSubTab("RESOURCES")}
          className={`px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-extrabold flex items-center gap-2 transition ${
            subTab === "RESOURCES"
              ? "bg-flandi-coral text-white shadow-cute"
              : "bg-white text-flandi-dark border border-flandi-pink hover:border-flandi-salmon"
          }`}
        >
          <ImageIcon className="w-4 h-4" />
          <span>
            3. Kho Hình Ảnh & Tài Nguyên ({config.resources?.length || 0})
          </span>
        </button>
      </div>

      {/* ==================== SUB-TAB 1: VISIBILITY TOGGLES ==================== */}
      {subTab === "TOGGLES" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {toggleItems.map((item) => {
            const isEnabled = Boolean(config[item.key]);
            return (
              <div
                key={item.key}
                className={`p-5 rounded-2xl border-2 transition flex items-center justify-between gap-4 ${
                  isEnabled
                    ? "bg-white border-flandi-pink"
                    : "bg-gray-50 border-gray-200 opacity-75"
                }`}
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span
                      className={`w-2.5 h-2.5 rounded-full ${
                        isEnabled ? "bg-emerald-500" : "bg-gray-400"
                      }`}
                    />
                    <h4 className="font-extrabold text-sm text-flandi-dark">
                      {item.title}
                    </h4>
                  </div>
                  <p className="text-xs text-flandi-muted font-medium leading-relaxed">
                    {item.desc}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => handleToggleKey(item.key)}
                  className={`px-4 py-2 rounded-full text-xs font-extrabold flex items-center gap-1.5 shrink-0 transition ${
                    isEnabled
                      ? "bg-emerald-100 text-emerald-800 hover:bg-emerald-200"
                      : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                  }`}
                >
                  {isEnabled ? (
                    <>
                      <Eye className="w-3.5 h-3.5" />
                      <span>Đang Bật</span>
                    </>
                  ) : (
                    <>
                      <EyeOff className="w-3.5 h-3.5" />
                      <span>Đang Tắt</span>
                    </>
                  )}
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* ==================== SUB-TAB 2: PAGE CONTENT EDITOR ==================== */}
      {subTab === "CONTENT" && (
        <div className="space-y-6">
          {/* Top Announcement & Hero Content */}
          <div className="bg-white rounded-3xl border border-flandi-pink p-6 space-y-4">
            <h3 className="font-extrabold text-base text-flandi-coral border-b border-flandi-pink pb-2">
              A. Nội Dung Đầu Trang & Khu Vực Hero Banner
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="sm:col-span-2">
                <label className="font-bold text-flandi-muted block mb-1">
                  Dòng thông báo chạy trên cùng (Announcement Bar)
                </label>
                <input
                  type="text"
                  value={announcement}
                  onChange={(e) => setAnnouncement(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-flandi-pink font-bold"
                />
              </div>

              <div>
                <label className="font-bold text-flandi-muted block mb-1">
                  Nhãn nhỏ phía trên tiêu đề Hero (Badge)
                </label>
                <input
                  type="text"
                  value={config.heroBadgeText}
                  onChange={(e) =>
                    setConfig({ ...config, heroBadgeText: e.target.value })
                  }
                  className="w-full px-3.5 py-2 rounded-xl border border-flandi-pink font-bold"
                />
              </div>

              <div>
                <label className="font-bold text-flandi-muted block mb-1">
                  Tiêu đề chính Hero (Chữ Sticker lớn)
                </label>
                <input
                  type="text"
                  value={config.heroTitle}
                  onChange={(e) =>
                    setConfig({ ...config, heroTitle: e.target.value })
                  }
                  className="w-full px-3.5 py-2 rounded-xl border border-flandi-pink font-extrabold"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="font-bold text-flandi-muted block mb-1">
                  Slogan Hero (Dòng chữ Sticker thứ 2)
                </label>
                <input
                  type="text"
                  value={config.heroSubtitle}
                  onChange={(e) =>
                    setConfig({ ...config, heroSubtitle: e.target.value })
                  }
                  className="w-full px-3.5 py-2 rounded-xl border border-flandi-pink font-extrabold"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="font-bold text-flandi-muted block mb-1">
                  Đoạn văn mô tả giới thiệu món ở Hero
                </label>
                <textarea
                  rows={2}
                  value={config.heroDescription}
                  onChange={(e) =>
                    setConfig({ ...config, heroDescription: e.target.value })
                  }
                  className="w-full px-3.5 py-2 rounded-xl border border-flandi-pink font-semibold"
                />
              </div>

              <div>
                <label className="font-bold text-flandi-muted block mb-1">
                  Chữ trên nút chính (Primary CTA)
                </label>
                <input
                  type="text"
                  value={config.heroPrimaryCtaText}
                  onChange={(e) =>
                    setConfig({ ...config, heroPrimaryCtaText: e.target.value })
                  }
                  className="w-full px-3.5 py-2 rounded-xl border border-flandi-pink font-bold"
                />
              </div>

              <div>
                <label className="font-bold text-flandi-muted block mb-1">
                  Chữ trên nút phụ (Secondary CTA)
                </label>
                <input
                  type="text"
                  value={config.heroSecondaryCtaText}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      heroSecondaryCtaText: e.target.value,
                    })
                  }
                  className="w-full px-3.5 py-2 rounded-xl border border-flandi-pink font-bold"
                />
              </div>

              <div>
                <label className="font-bold text-flandi-muted block mb-1">
                  Tiêu đề khung 6 món bên phải Hero
                </label>
                <input
                  type="text"
                  value={config.heroCollageTitle}
                  onChange={(e) =>
                    setConfig({ ...config, heroCollageTitle: e.target.value })
                  }
                  className="w-full px-3.5 py-2 rounded-xl border border-flandi-pink font-bold"
                />
              </div>

              <div>
                <label className="font-bold text-flandi-muted block mb-1">
                  Ghi chú phụ khung 6 món Hero
                </label>
                <input
                  type="text"
                  value={config.heroCollageSubtitle}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      heroCollageSubtitle: e.target.value,
                    })
                  }
                  className="w-full px-3.5 py-2 rounded-xl border border-flandi-pink font-bold"
                />
              </div>
            </div>
          </div>

          {/* Menu Section & Footer Content */}
          <div className="bg-white rounded-3xl border border-flandi-pink p-6 space-y-4">
            <h3 className="font-extrabold text-base text-flandi-coral border-b border-flandi-pink pb-2">
              B. Nội Dung Khu Vực Thực Đơn & Chân Trang (Footer)
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
              <div>
                <label className="font-bold text-flandi-muted block mb-1">
                  Tiêu đề khu vực Thực Đơn
                </label>
                <input
                  type="text"
                  value={config.menuTitle}
                  onChange={(e) =>
                    setConfig({ ...config, menuTitle: e.target.value })
                  }
                  className="w-full px-3.5 py-2 rounded-xl border border-flandi-pink font-bold"
                />
              </div>

              <div>
                <label className="font-bold text-flandi-muted block mb-1">
                  Mô tả phụ dưới tiêu đề Thực Đơn
                </label>
                <input
                  type="text"
                  value={config.menuSubtitle}
                  onChange={(e) =>
                    setConfig({ ...config, menuSubtitle: e.target.value })
                  }
                  className="w-full px-3.5 py-2 rounded-xl border border-flandi-pink font-bold"
                />
              </div>

              <div>
                <label className="font-bold text-flandi-muted block mb-1">
                  Gợi ý ô tìm kiếm món (Placeholder)
                </label>
                <input
                  type="text"
                  value={config.menuSearchPlaceholder}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      menuSearchPlaceholder: e.target.value,
                    })
                  }
                  className="w-full px-3.5 py-2 rounded-xl border border-flandi-pink font-bold"
                />
              </div>

              <div className="sm:col-span-3">
                <label className="font-bold text-flandi-muted block mb-1">
                  Mô tả giới thiệu tiệm ở Chân Trang (Footer)
                </label>
                <input
                  type="text"
                  value={config.footerDescription}
                  onChange={(e) =>
                    setConfig({ ...config, footerDescription: e.target.value })
                  }
                  className="w-full px-3.5 py-2 rounded-xl border border-flandi-pink font-semibold"
                />
              </div>
            </div>
          </div>

          {/* Story Section & 4 Feature Cards */}
          <div className="bg-white rounded-3xl border border-flandi-pink p-6 space-y-4">
            <h3 className="font-extrabold text-base text-flandi-coral border-b border-flandi-pink pb-2">
              C. Khu Vực Câu Chuyện Bếp Nhà FLANDI & 4 Thẻ Cam Kết
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="font-bold text-flandi-muted block mb-1">
                  Nhãn nhỏ phần Câu chuyện (Badge)
                </label>
                <input
                  type="text"
                  value={config.storyBadgeText}
                  onChange={(e) =>
                    setConfig({ ...config, storyBadgeText: e.target.value })
                  }
                  className="w-full px-3.5 py-2 rounded-xl border border-flandi-pink font-bold"
                />
              </div>

              <div>
                <label className="font-bold text-flandi-muted block mb-1">
                  Tiêu đề lớn phần Câu chuyện
                </label>
                <input
                  type="text"
                  value={config.storyTitle}
                  onChange={(e) =>
                    setConfig({ ...config, storyTitle: e.target.value })
                  }
                  className="w-full px-3.5 py-2 rounded-xl border border-flandi-pink font-bold"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="font-bold text-flandi-muted block mb-1">
                  Đoạn văn câu chuyện tiệm bánh
                </label>
                <textarea
                  rows={2}
                  value={config.storyDescription}
                  onChange={(e) =>
                    setConfig({ ...config, storyDescription: e.target.value })
                  }
                  className="w-full px-3.5 py-2 rounded-xl border border-flandi-pink font-semibold"
                />
              </div>
            </div>

            <div className="pt-2 space-y-3">
              <label className="text-xs font-extrabold text-flandi-dark block">
                Danh sách 4 Thẻ Điểm Khác Biệt (Có thể bật/tắt hoặc sửa nội dung từng thẻ):
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {(config.storyFeatures || []).map((feat, idx) => (
                  <div
                    key={feat.id}
                    className={`p-4 rounded-2xl border space-y-2.5 text-xs ${
                      feat.enabled
                        ? "bg-flandi-bg border-flandi-pink"
                        : "bg-gray-50 border-gray-200 opacity-65"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-extrabold text-flandi-coral">
                        Thẻ #{idx + 1}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          const next = [...config.storyFeatures];
                          next[idx] = { ...feat, enabled: !feat.enabled };
                          setConfig({ ...config, storyFeatures: next });
                        }}
                        className={`px-2.5 py-1 rounded-full text-[11px] font-extrabold ${
                          feat.enabled
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-gray-200 text-gray-600"
                        }`}
                      >
                        {feat.enabled ? "Đang hiển thị" : "Đang ẩn"}
                      </button>
                    </div>

                    <input
                      type="text"
                      value={feat.title}
                      onChange={(e) => {
                        const next = [...config.storyFeatures];
                        next[idx] = { ...feat, title: e.target.value };
                        setConfig({ ...config, storyFeatures: next });
                      }}
                      placeholder="Tiêu đề thẻ"
                      className="w-full px-3 py-1.5 rounded-xl border border-flandi-pink bg-white font-extrabold"
                    />
                    <input
                      type="text"
                      value={feat.description}
                      onChange={(e) => {
                        const next = [...config.storyFeatures];
                        next[idx] = { ...feat, description: e.target.value };
                        setConfig({ ...config, storyFeatures: next });
                      }}
                      placeholder="Mô tả ngắn"
                      className="w-full px-3 py-1.5 rounded-xl border border-flandi-pink bg-white font-semibold"
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end pt-3">
              <button
                type="button"
                onClick={() => handleSaveAll()}
                className="px-6 py-3 rounded-2xl bg-flandi-coral hover:bg-flandi-salmon text-white font-extrabold text-xs sm:text-sm shadow-cute flex items-center gap-2"
              >
                <Save className="w-4 h-4" />
                <span>Lưu Toàn Bộ Nội Dung Trang</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================== SUB-TAB 3: MEDIA & RESOURCES MANAGER ==================== */}
      {subTab === "RESOURCES" && (
        <div className="space-y-6">
          {/* Upload / Add New Resource Box */}
          <div className="bg-white rounded-3xl border-2 border-flandi-pink p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
            <form
              onSubmit={handleAddUrlResource}
              className="lg:col-span-7 space-y-3 text-xs"
            >
              <h3 className="font-extrabold text-sm text-flandi-dark flex items-center gap-2">
                <Plus className="w-4 h-4 text-flandi-coral" />
                <span>Thêm Tài Nguyên Hình Ảnh Mới (URL hoặc Tải File Lên)</span>
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <input
                  type="text"
                  value={newResName}
                  onChange={(e) => setNewResName(e.target.value)}
                  placeholder="Tên gợi nhớ (VD: Flan Matcha)"
                  className="px-3 py-2 rounded-xl border border-flandi-pink font-bold"
                />
                <input
                  type="text"
                  value={newResUrl}
                  onChange={(e) => setNewResUrl(e.target.value)}
                  placeholder="Đường dẫn ảnh (/images/... hoặc https://...)"
                  className="px-3 py-2 rounded-xl border border-flandi-pink font-semibold"
                />
                <div className="flex gap-2">
                  <select
                    value={newResCategory}
                    onChange={(e) =>
                      setNewResCategory(
                        e.target.value as "LOGO" | "PRODUCT" | "BANNER"
                      )
                    }
                    className="px-2.5 py-2 rounded-xl border border-flandi-pink font-bold bg-white"
                  >
                    <option value="PRODUCT">Ảnh Món</option>
                    <option value="LOGO">Logo</option>
                    <option value="BANNER">Banner</option>
                  </select>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-xl bg-flandi-coral text-white font-extrabold shrink-0"
                  >
                    + Thêm
                  </button>
                </div>
              </div>
            </form>

            {/* Upload from computer */}
            <div className="lg:col-span-5 flex flex-col sm:flex-row items-center justify-between gap-3 p-4 rounded-2xl bg-flandi-bg border border-dashed border-flandi-salmon">
              <div className="text-xs">
                <p className="font-extrabold text-flandi-dark">
                  Tải ảnh trực tiếp từ máy tính
                </p>
                <p className="text-[11px] text-flandi-muted font-semibold">
                  Hỗ trợ PNG, JPG, WEBP — dùng ngay cho Logo hoặc Món bánh
                </p>
              </div>
              <label className="cursor-pointer px-4 py-2.5 rounded-xl bg-white hover:bg-flandi-cream text-flandi-coral border border-flandi-salmon font-extrabold text-xs flex items-center gap-1.5 shrink-0 shadow-2xs">
                <Upload className="w-4 h-4" />
                <span>Chọn file ảnh</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
            </div>
          </div>

          {/* Current Header Logo Selector */}
          <div className="bg-white rounded-2xl border border-flandi-pink p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <img
                src={config.headerLogoUrl || "/images/branding/flandi-mascot.png"}
                alt="Header Logo"
                className="w-12 h-12 rounded-full object-cover border-2 border-flandi-salmon"
              />
              <div className="text-xs">
                <p className="font-extrabold text-flandi-dark">
                  Logo đang hiển thị trên Header Trang Chủ
                </p>
                <p className="text-flandi-muted font-semibold truncate max-w-md">
                  {config.headerLogoUrl}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="text"
                value={config.headerLogoUrl}
                onChange={(e) =>
                  setConfig({ ...config, headerLogoUrl: e.target.value })
                }
                className="px-3 py-1.5 rounded-xl border border-flandi-pink text-xs font-semibold w-56"
              />
              <button
                type="button"
                onClick={() => handleSaveAll()}
                className="px-3.5 py-1.5 rounded-xl bg-flandi-coral text-white font-extrabold text-xs"
              >
                Áp dụng
              </button>
            </div>
          </div>

          {/* Resource Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {(config.resources || []).map((res) => (
              <div
                key={res.id}
                className="bg-white rounded-3xl border-2 border-flandi-pink p-4 flex flex-col justify-between gap-3 shadow-xs"
              >
                <div className="space-y-2">
                  <div className="aspect-square rounded-2xl bg-flandi-grid border border-flandi-pink overflow-hidden flex items-center justify-center p-2 relative">
                    <img
                      src={res.url}
                      alt={res.name}
                      className="w-36 h-36 rounded-full object-cover border-2 border-flandi-salmon shadow"
                    />
                    <span className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-white/90 border border-flandi-pink text-[10px] font-extrabold text-flandi-coral">
                      {res.category}
                    </span>
                  </div>

                  <div>
                    <h4 className="font-extrabold text-xs text-flandi-dark truncate">
                      {res.name}
                    </h4>
                    <p className="text-[10px] text-flandi-muted truncate">
                      {res.url.startsWith("data:")
                        ? "Ảnh tải lên trực tiếp (Data URL)"
                        : res.url}
                    </p>
                  </div>
                </div>

                <div className="space-y-1.5 pt-2 border-t border-flandi-pink/60 text-xs">
                  <div className="flex gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(res.url);
                        setCopiedUrl(res.id);
                        notify("Đã sao chép đường dẫn tài nguyên!");
                        setTimeout(() => setCopiedUrl(null), 2000);
                      }}
                      className="flex-1 py-1.5 rounded-xl bg-flandi-bg hover:bg-flandi-pink/50 text-flandi-dark font-bold text-[11px] flex items-center justify-center gap-1 border border-flandi-pink"
                    >
                      {copiedUrl === res.id ? (
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                      ) : (
                        <Copy className="w-3.5 h-3.5 text-flandi-coral" />
                      )}
                      <span>Copy Link</span>
                    </button>

                    <button
                      type="button"
                      onClick={async () => {
                        const nextConfig = {
                          ...config,
                          headerLogoUrl: res.url,
                        };
                        setConfig(nextConfig);
                        await handleSaveAll(nextConfig);
                      }}
                      className="flex-1 py-1.5 rounded-xl bg-flandi-cream hover:bg-flandi-pink/60 text-flandi-coral font-extrabold text-[11px] border border-flandi-salmon"
                    >
                      Đặt làm Logo
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setConfig({
                          ...config,
                          resources: config.resources.filter(
                            (r) => r.id !== res.id
                          ),
                        });
                      }}
                      className="p-1.5 rounded-xl bg-red-50 text-red-600 hover:bg-red-100"
                      title="Xoá khỏi thư viện"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Quick Assign Image to Product */}
                  {onUpdateProductImage && (
                    <div className="flex items-center gap-1 pt-1">
                      <select
                        value={assignProductTargets[res.id] || ""}
                        onChange={(e) =>
                          setAssignProductTargets((prev) => ({
                            ...prev,
                            [res.id]: e.target.value,
                          }))
                        }
                        className="flex-1 px-2 py-1 rounded-lg border border-flandi-pink text-[11px] font-semibold bg-white"
                      >
                        <option value="">Gán ảnh cho món...</option>
                        {products.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        disabled={!assignProductTargets[res.id]}
                        onClick={async () => {
                          const targetProd = products.find(
                            (p) => p.id === assignProductTargets[res.id]
                          );
                          if (targetProd) {
                            await onUpdateProductImage(targetProd, res.url);
                          }
                        }}
                        className="px-2.5 py-1 rounded-lg bg-flandi-coral text-white font-extrabold text-[11px] disabled:opacity-40"
                      >
                        Gán
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
