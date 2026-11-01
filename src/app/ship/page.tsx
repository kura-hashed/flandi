"use client";

import React, { useEffect, useState, useMemo, useCallback } from "react";
import Link from "next/link";
import {
  Bike,
  Truck,
  Phone,
  MapPin,
  Navigation,
  MessageCircle,
  QrCode,
  CheckCircle2,
  Clock,
  AlertCircle,
  Sparkles,
  RefreshCw,
  Search,
  Check,
  X,
  ArrowLeft,
  Store,
  ExternalLink,
  Copy,
  Box,
  CheckSquare,
  Square,
  DollarSign,
  Filter,
  Lock,
  ChevronDown,
  User,
  ShoppingBag,
} from "lucide-react";
import { Order, OrderStatus, ShopSettings } from "@/lib/types";
import { useCustomerAuth } from "@/lib/customer-auth-context";
import { ROLE_META } from "@/lib/rbac";
import CustomerHeaderAuthButton from "@/components/CustomerHeaderAuthButton";
import CustomerAccountDrawer from "@/components/CustomerAccountDrawer";
import { copyToClipboardInstant } from "@/components/LiveChatWidget";

export default function ShippingDispatchPage() {
  const { user, role, can, loading: authLoading, triggerGoogleSignIn } =
    useCustomerAuth();

  const isStaffOrAdmin =
    role === "staff" || role === "admin" || can("orders:manage");

  const [orders, setOrders] = useState<Order[]>([]);
  const [settings, setSettings] = useState<ShopSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // Tab: "DELIVERY" (Lộ trình đi giao) hoặc "SUMMARY" (Tổng hợp thùng hàng trước khi đi)
  const [activeTab, setActiveTab] = useState<"DELIVERY" | "SUMMARY">("DELIVERY");

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>("NEED_SHIP");
  const [paymentFilter, setPaymentFilter] = useState<"ALL" | "COD" | "PAID">("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  // Checklist kiểm đồ trong thùng hàng (lưu tạm trong session)
  const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>({});

  // Modal xem QR thu tiền của đơn cụ thể
  const [qrModalOrder, setQrModalOrder] = useState<Order | null>(null);

  // Modal cập nhật trạng thái đơn
  const [processingOrderId, setProcessingOrderId] = useState<string | null>(null);

  const notify = (msg: string) => {
    setToast(msg);
    setTimeout(() => {
      setToast((prev) => (prev === msg ? null : prev));
    }, 2800);
  };

  const formatVND = (n: number) =>
    new Intl.NumberFormat("vi-VN").format(Math.round(n || 0)) + "đ";

  const fetchOrders = useCallback(async (isSilent = false) => {
    if (!isSilent) setIsRefreshing(true);
    try {
      const res = await fetch("/api/store", { cache: "no-store" });
      const data = await res.json();
      setOrders(data.orders || []);
      setSettings(data.settings || null);
    } catch (err) {
      console.error("Lỗi tải danh sách đơn giao:", err);
      notify("⚠️ Không thể tải dữ liệu đơn hàng");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (!authLoading && isStaffOrAdmin) {
      fetchOrders();
    }
  }, [authLoading, isStaffOrAdmin, fetchOrders]);

  // Tự động làm mới đơn mỗi 45 giây để shipper bắt kịp đơn mới
  useEffect(() => {
    if (!isStaffOrAdmin) return;
    const interval = setInterval(() => {
      fetchOrders(true);
    }, 45000);
    return () => clearInterval(interval);
  }, [isStaffOrAdmin, fetchOrders]);

  // Cập nhật trạng thái đơn (Ví dụ: Đi giao / Giao thành công / Đã thu tiền)
  const handleUpdateStatus = async (
    orderId: string,
    newStatus: OrderStatus,
    markPaid?: boolean
  ) => {
    setProcessingOrderId(orderId);
    try {
      const payload: {
        orderId: string;
        status?: OrderStatus;
        isPaid?: boolean;
      } = { orderId, status: newStatus };

      if (typeof markPaid === "boolean") {
        payload.isPaid = markPaid;
      }

      const res = await fetch("/api/orders", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Lỗi cập nhật đơn hàng");
      }

      const result = await res.json();
      setOrders((prev) =>
        prev.map((o) => (o.id === orderId ? result.order : o))
      );

      if (newStatus === "DELIVERING") {
        notify("🛵 Đã chuyển trạng thái: ĐANG ĐI GIAO!");
      } else if (newStatus === "COMPLETED") {
        notify("🎉 ĐÃ GIAO THÀNH CÔNG & CHỐT ĐƠN!");
      } else {
        notify("✓ Đã cập nhật trạng thái đơn!");
      }
    } catch (err: any) {
      console.error("Error updating order:", err);
      notify(err.message || "Lỗi khi cập nhật đơn hàng");
    } finally {
      setProcessingOrderId(null);
      if (qrModalOrder?.id === orderId) {
        setQrModalOrder(null);
      }
    }
  };

  // Lọc đơn hàng
  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      // 1. Lọc theo trạng thái
      if (statusFilter === "NEED_SHIP") {
        // Các đơn cần shipper xử lý: Chờ xác nhận, Đang chuẩn bị, hoặc Đang đi giao
        if (
          order.status !== "PENDING" &&
          order.status !== "PREPARING" &&
          order.status !== "DELIVERING"
        ) {
          return false;
        }
      } else if (statusFilter === "DELIVERING") {
        if (order.status !== "DELIVERING") return false;
      } else if (statusFilter === "COMPLETED") {
        if (order.status !== "COMPLETED") return false;
      } else if (statusFilter === "CANCELLED") {
        if (order.status !== "CANCELLED") return false;
      }

      // 2. Lọc theo thanh toán
      if (paymentFilter === "COD") {
        if (order.isPaid || order.paymentMethod !== "COD") return false;
      } else if (paymentFilter === "PAID") {
        if (!order.isPaid) return false;
      }

      // 3. Lọc theo từ khoá tìm kiếm
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchCode = order.code.toLowerCase().includes(q);
        const matchPhone = order.customerPhone.includes(q);
        const matchName = order.customerName.toLowerCase().includes(q);
        const matchAddress = (order.customerAddress || "").toLowerCase().includes(q);
        const matchItem = order.items.some(
          (i) =>
            i.productName.toLowerCase().includes(q) ||
            i.variantName.toLowerCase().includes(q)
        );
        if (!matchCode && !matchPhone && !matchName && !matchAddress && !matchItem) {
          return false;
        }
      }

      return true;
    });
  }, [orders, statusFilter, paymentFilter, searchQuery]);

  // Thống kê đơn cần giao
  const stats = useMemo(() => {
    const needShipOrders = orders.filter(
      (o) =>
        o.status === "PENDING" ||
        o.status === "PREPARING" ||
        o.status === "DELIVERING"
    );

    const deliveringOrders = orders.filter((o) => o.status === "DELIVERING");

    // Tổng tiền COD cần thu hộ từ các đơn chưa thanh toán
    const totalCodAmount = needShipOrders.reduce((sum, o) => {
      return !o.isPaid ? sum + o.total : sum;
    }, 0);

    // Tổng số lượng bánh cần mang theo
    let totalCakes = 0;
    const cakeBreakdown: Record<string, { name: string; variant: string; qty: number }> =
      {};

    needShipOrders.forEach((o) => {
      o.items.forEach((item) => {
        totalCakes += item.quantity;
        const key = `${item.productId}_${item.variantName}`;
        if (!cakeBreakdown[key]) {
          cakeBreakdown[key] = {
            name: item.productName,
            variant: item.variantName,
            qty: 0,
          };
        }
        cakeBreakdown[key].qty += item.quantity;
      });
    });

    const sortedCakeList = Object.values(cakeBreakdown).sort(
      (a, b) => b.qty - a.qty
    );

    return {
      needShipCount: needShipOrders.length,
      deliveringCount: deliveringOrders.length,
      totalCodAmount,
      totalCakes,
      sortedCakeList,
    };
  }, [orders]);

  // Toggle checklist kiểm hàng
  const toggleCheckItem = (key: string) => {
    setCheckedItems((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  // Link Google Maps
  const buildMapsUrl = (address: string) => {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
      address
    )}`;
  };

  // Link Zalo Chat
  const buildZaloUrl = (phone: string) => {
    const cleanPhone = phone.replace(/[\s.-]/g, "").trim();
    return `https://zalo.me/${cleanPhone}`;
  };

  // Màn hình loading auth
  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#FFF9F8] flex flex-col items-center justify-center p-4">
        <div className="w-10 h-10 border-4 border-flandi-pink border-t-flandi-coral rounded-full animate-spin mb-3" />
        <p className="text-xs font-extrabold text-flandi-coral">
          Đang kiểm tra quyền giao hàng (Staff / Admin)...
        </p>
      </div>
    );
  }

  // Màn hình chặn truy cập nếu không phải Staff / Admin
  if (!isStaffOrAdmin) {
    return (
      <div className="min-h-screen bg-[#FFF9F8] flex flex-col items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-3xl border-2 border-flandi-pink p-6 sm:p-8 shadow-cute-lg text-center space-y-4">
          <div className="w-16 h-16 mx-auto rounded-3xl bg-flandi-cream border border-flandi-salmon flex items-center justify-center text-flandi-coral shadow-xs">
            <Bike className="w-8 h-8" />
          </div>

          <div>
            <span className="px-3 py-1 rounded-full text-[11px] font-extrabold bg-amber-100 text-amber-800 border border-amber-300">
              YÊU CẦU QUYỀN STAFF / ADMIN
            </span>
            <h1 className="font-display text-2xl text-sticker-sm leading-tight mt-2">
              ĐIỀU PHỐI & GIAO HÀNG
            </h1>
            <p className="text-xs font-semibold text-flandi-muted mt-2">
              Khu vực này dành riêng cho nhân viên và chủ tiệm FLANDI để tổng hợp số lượng bánh, kiểm đếm thùng xốp giữ nhiệt và đi giao bánh cho khách.
            </p>
          </div>

          {user ? (
            <div className="p-3 bg-flandi-bg rounded-2xl border border-flandi-pink text-xs text-left space-y-1">
              <p className="font-bold text-flandi-dark">Tài khoản hiện tại:</p>
              <p className="font-mono text-flandi-muted">{user.email}</p>
              <p className="text-[11px] text-flandi-coral font-bold">
                Vai trò: {role.toUpperCase()} (Chưa được cấp quyền Staff)
              </p>
              <p className="text-[11px] text-flandi-muted mt-1">
                👉 Vui lòng liên hệ Admin tiệm vào trang Quản trị để nâng cấp vai trò của bạn thành <strong>STAFF</strong>.
              </p>
            </div>
          ) : (
            <button
              type="button"
              onClick={triggerGoogleSignIn}
              className="w-full py-3 rounded-2xl bg-gradient-to-r from-flandi-coral to-flandi-salmon text-white font-extrabold text-sm shadow-cute hover:opacity-95 transition flex items-center justify-center gap-2 cursor-pointer"
            >
              <User className="w-4 h-4" />
              <span>Đăng nhập tài khoản Staff</span>
            </button>
          )}

          <div className="flex gap-2 pt-2">
            <Link
              href="/"
              className="flex-1 py-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-flandi-dark font-extrabold text-xs text-center"
            >
              Về Trang Chủ
            </Link>
            <Link
              href="/order"
              className="flex-1 py-2.5 rounded-xl bg-flandi-coral/10 hover:bg-flandi-coral/20 text-flandi-coral font-extrabold text-xs text-center"
            >
              Xem Menu
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FDF8F7] text-flandi-dark flex flex-col pb-16">
      {/* Toast Notification */}
      {toast && (
        <div className="fixed top-3 left-1/2 -translate-x-1/2 z-[90] px-4 py-2.5 rounded-2xl bg-flandi-dark/95 backdrop-blur-md text-white text-xs font-black shadow-cute-lg border border-white/20 animate-in fade-in slide-in-from-top-4">
          {toast}
        </div>
      )}

      {/* Header Bar */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-flandi-pink/80 px-3 sm:px-6 py-2.5 shadow-2xs">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-2">
          {/* Brand & Title */}
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <Link
              href="/"
              className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-gradient-to-br from-flandi-coral to-flandi-salmon text-white flex items-center justify-center shadow-cute shrink-0 group transition active:scale-95"
              title="Về trang chủ"
            >
              <Bike className="w-5 h-5 group-hover:scale-110 transition-transform" />
            </Link>

            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <h1 className="font-display text-base sm:text-lg font-black text-flandi-dark tracking-tight leading-tight whitespace-nowrap">
                  GIAO HÀNG FLANDI
                </h1>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-black border uppercase ${
                    role === "admin"
                      ? "bg-flandi-coral text-white border-flandi-coral"
                      : "bg-emerald-100 text-emerald-800 border-emerald-300"
                  }`}
                >
                  {role === "admin" ? "Admin" : "Staff"}
                </span>
              </div>
              <p className="text-[11px] text-flandi-muted font-bold truncate">
                Tổng hợp đơn, kiểm thùng hàng & đi giao
              </p>
            </div>
          </div>

          {/* Quick Hub Navigation & Refresh Button */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <button
              type="button"
              onClick={() => fetchOrders()}
              disabled={isRefreshing}
              className="p-2 sm:px-3 sm:py-2 rounded-xl bg-flandi-bg hover:bg-flandi-pink/50 text-flandi-coral border border-flandi-pink font-extrabold text-xs flex items-center gap-1.5 transition active:scale-95 cursor-pointer disabled:opacity-60"
              title="Làm mới dữ liệu đơn"
            >
              <RefreshCw
                className={`w-4 h-4 ${isRefreshing ? "animate-spin" : ""}`}
              />
              <span className="hidden sm:inline">Làm mới</span>
            </button>

            <Link
              href="/pos"
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white hover:bg-flandi-pink/40 text-flandi-dark border border-flandi-pink text-xs font-extrabold shadow-2xs"
            >
              <Store className="w-3.5 h-3.5 text-flandi-coral" />
              <span>POS Quầy</span>
            </Link>

            <Link
              href="/order"
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white hover:bg-flandi-pink/40 text-flandi-dark border border-flandi-pink text-xs font-extrabold shadow-2xs"
            >
              <ShoppingBag className="w-3.5 h-3.5 text-flandi-coral" />
              <span>Lên Đơn</span>
            </Link>

            <CustomerHeaderAuthButton />
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-6xl w-full mx-auto px-3 sm:px-6 pt-3 sm:pt-4 space-y-3 sm:space-y-4">
        {/* Shipper Quick Metrics Banner */}
        <section className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
          {/* Stat 1: Cần giao */}
          <div className="bg-white p-3 sm:p-4 rounded-2xl border border-flandi-pink shadow-2xs flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center shrink-0">
              <Clock className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-bold text-flandi-muted">Cần giao</p>
              <p className="text-xl sm:text-2xl font-black text-flandi-dark leading-tight">
                {stats.needShipCount}{" "}
                <span className="text-xs font-bold text-flandi-muted">đơn</span>
              </p>
            </div>
          </div>

          {/* Stat 2: Đang trên đường */}
          <div className="bg-white p-3 sm:p-4 rounded-2xl border border-flandi-pink shadow-2xs flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-sky-50 border border-sky-200 text-sky-600 flex items-center justify-center shrink-0">
              <Bike className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-bold text-flandi-muted">Đang đi giao</p>
              <p className="text-xl sm:text-2xl font-black text-sky-600 leading-tight">
                {stats.deliveringCount}{" "}
                <span className="text-xs font-bold text-flandi-muted">đơn</span>
              </p>
            </div>
          </div>

          {/* Stat 3: Tổng bánh cần mang */}
          <div
            onClick={() => setActiveTab("SUMMARY")}
            className="bg-white p-3 sm:p-4 rounded-2xl border border-flandi-pink shadow-2xs flex items-center gap-3 cursor-pointer hover:border-flandi-coral transition group"
            title="Bấm để xem danh sách soạn bánh"
          >
            <div className="w-10 h-10 rounded-xl bg-rose-50 border border-rose-200 text-flandi-coral flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
              <Box className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-bold text-flandi-muted flex items-center gap-1">
                <span>Soạn bánh</span>
                <span className="text-[9px] font-extrabold text-flandi-coral bg-rose-100 px-1 rounded">
                  Xem
                </span>
              </p>
              <p className="text-xl sm:text-2xl font-black text-flandi-coral leading-tight">
                {stats.totalCakes}{" "}
                <span className="text-xs font-bold text-flandi-muted">hũ/cái</span>
              </p>
            </div>
          </div>

          {/* Stat 4: Tiền mặt COD cần thu */}
          <div className="bg-white p-3 sm:p-4 rounded-2xl border border-flandi-pink shadow-2xs flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center shrink-0">
              <DollarSign className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-bold text-flandi-muted">Tiền COD cần thu</p>
              <p className="text-lg sm:text-xl font-black text-emerald-700 leading-tight tabular-nums">
                {formatVND(stats.totalCodAmount)}
              </p>
            </div>
          </div>
        </section>

        {/* View Mode Switcher (2 Tabs: Lộ trình giao vs Tổng hợp thùng hàng) */}
        <div className="flex items-center gap-2 p-1.5 bg-white rounded-2xl border border-flandi-pink shadow-2xs">
          <button
            type="button"
            onClick={() => setActiveTab("DELIVERY")}
            className={`flex-1 py-2 sm:py-2.5 px-3 rounded-xl font-black text-xs sm:text-sm flex items-center justify-center gap-2 transition cursor-pointer ${
              activeTab === "DELIVERY"
                ? "bg-flandi-coral text-white shadow-cute"
                : "text-flandi-muted hover:text-flandi-dark hover:bg-flandi-bg"
            }`}
          >
            <Bike className="w-4 h-4" />
            <span>Lộ Trình Giao Hàng ({filteredOrders.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("SUMMARY")}
            className={`flex-1 py-2 sm:py-2.5 px-3 rounded-xl font-black text-xs sm:text-sm flex items-center justify-center gap-2 transition cursor-pointer ${
              activeTab === "SUMMARY"
                ? "bg-flandi-coral text-white shadow-cute"
                : "text-flandi-muted hover:text-flandi-dark hover:bg-flandi-bg"
            }`}
          >
            <Box className="w-4 h-4" />
            <span>Soạn Thùng Giữ Nhiệt ({stats.totalCakes} bánh)</span>
          </button>
        </div>

        {/* TAB 1: LỘ TRÌNH ĐI GIAO HÀNG */}
        {activeTab === "DELIVERY" && (
          <div className="space-y-3">
            {/* Filter & Search Bar */}
            <div className="bg-white p-3 rounded-2xl border border-flandi-pink shadow-2xs space-y-2.5">
              {/* Quick Status Filters */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
                {[
                  { id: "NEED_SHIP", label: "🛵 Cần giao ngay" },
                  { id: "DELIVERING", label: "Đang trên đường" },
                  { id: "ALL", label: "Tất cả đơn" },
                  { id: "COMPLETED", label: "Đã giao xong" },
                ].map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setStatusFilter(f.id)}
                    className={`px-3 py-1.5 rounded-xl font-extrabold whitespace-nowrap transition cursor-pointer ${
                      statusFilter === f.id
                        ? "bg-flandi-dark text-white shadow-xs"
                        : "bg-flandi-bg text-flandi-muted hover:bg-flandi-pink/40"
                    }`}
                  >
                    {f.label}
                  </button>
                ))}

                <div className="h-4 w-px bg-flandi-pink shrink-0 mx-1" />

                {/* COD vs Paid Filter */}
                {[
                  { id: "ALL", label: "Mọi thanh toán" },
                  { id: "COD", label: "💰 Chỉ đơn COD" },
                  { id: "PAID", label: "✓ Đã CK 0đ" },
                ].map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setPaymentFilter(p.id as any)}
                    className={`px-2.5 py-1.5 rounded-xl text-[11px] font-extrabold whitespace-nowrap transition cursor-pointer ${
                      paymentFilter === p.id
                        ? "bg-emerald-600 text-white shadow-xs"
                        : "bg-flandi-bg text-flandi-muted hover:bg-flandi-pink/40"
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>

              {/* Search input */}
              <div className="relative">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Tìm theo tên khách, SĐT, số nhà, tên đường hoặc mã đơn..."
                  className="w-full pl-9 pr-8 py-2 rounded-xl border border-flandi-pink text-xs font-bold text-flandi-dark bg-flandi-bg/40 focus:bg-white focus:border-flandi-coral focus:outline-none transition"
                />
                <Search className="w-4 h-4 text-flandi-muted absolute left-3 top-2.5" />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    className="w-5 h-5 rounded-full bg-gray-200 text-gray-600 flex items-center justify-center absolute right-2.5 top-2.5 text-xs hover:bg-gray-300"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>

            {/* Orders List */}
            {isLoading ? (
              <div className="py-12 text-center text-flandi-muted font-bold text-xs space-y-2">
                <div className="w-8 h-8 border-4 border-flandi-pink border-t-flandi-coral rounded-full animate-spin mx-auto" />
                <p>Đang tải danh sách đơn đi giao...</p>
              </div>
            ) : filteredOrders.length === 0 ? (
              <div className="bg-white rounded-3xl border border-flandi-pink p-8 text-center space-y-3 shadow-2xs">
                <div className="w-14 h-14 mx-auto rounded-2xl bg-flandi-cream text-flandi-coral flex items-center justify-center">
                  <CheckCircle2 className="w-7 h-7" />
                </div>
                <h3 className="font-display text-lg font-black text-flandi-dark">
                  Hiện không có đơn nào khớp với bộ lọc
                </h3>
                <p className="text-xs font-semibold text-flandi-muted max-w-sm mx-auto">
                  Tất cả đơn trong ca đã được giao hoàn tất hoặc chưa có đơn hàng mới phát sinh.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setStatusFilter("ALL");
                    setPaymentFilter("ALL");
                    setSearchQuery("");
                  }}
                  className="px-4 py-2 rounded-xl bg-flandi-bg hover:bg-flandi-pink/50 text-flandi-coral text-xs font-extrabold border border-flandi-pink transition"
                >
                  Xoá bộ lọc tìm kiếm
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredOrders.map((order) => {
                  const isDelivering = order.status === "DELIVERING";
                  const isCompleted = order.status === "COMPLETED";
                  const isCancelled = order.status === "CANCELLED";

                  return (
                    <article
                      key={order.id}
                      className={`bg-white rounded-2xl sm:rounded-3xl border transition shadow-2xs overflow-hidden ${
                        isDelivering
                          ? "border-sky-300 ring-2 ring-sky-200"
                          : isCompleted
                          ? "border-gray-200 opacity-80"
                          : "border-flandi-pink hover:border-flandi-coral/60"
                      }`}
                    >
                      {/* Top Header of Card */}
                      <div className="p-3 sm:p-4 bg-gradient-to-r from-flandi-cream/40 via-white to-transparent border-b border-flandi-pink/60 flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-black text-base sm:text-lg text-flandi-coral">
                            #{order.code}
                          </span>
                          <span className="text-[11px] font-bold text-flandi-muted">
                            {new Date(order.createdAt).toLocaleTimeString("vi-VN", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                          <span className="px-2 py-0.5 rounded-md bg-flandi-bg border border-flandi-pink text-[10px] font-extrabold text-flandi-muted">
                            {order.source === "ONLINE"
                              ? "Web"
                              : order.source === "ZALO"
                              ? "Zalo"
                              : order.source === "POS"
                              ? "POS"
                              : "App"}
                          </span>
                        </div>

                        {/* Status Badge */}
                        <div className="flex items-center gap-1.5">
                          {isDelivering ? (
                            <span className="px-2.5 py-1 rounded-full bg-sky-100 text-sky-800 border border-sky-300 text-xs font-black flex items-center gap-1 animate-pulse">
                              <Bike className="w-3.5 h-3.5" />
                              <span>ĐANG ĐI GIAO</span>
                            </span>
                          ) : isCompleted ? (
                            <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 text-xs font-extrabold flex items-center gap-1">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>ĐÃ GIAO XONG</span>
                            </span>
                          ) : isCancelled ? (
                            <span className="px-2.5 py-1 rounded-full bg-rose-100 text-rose-800 border border-rose-300 text-xs font-extrabold">
                              ĐÃ HUỶ
                            </span>
                          ) : (
                            <span className="px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 border border-amber-300 text-xs font-extrabold flex items-center gap-1">
                              <Clock className="w-3.5 h-3.5" />
                              <span>CHỜ GIAO</span>
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Card Body */}
                      <div className="p-3 sm:p-4 space-y-3">
                        {/* Customer Info & Address */}
                        <div className="space-y-1.5">
                          <div className="flex items-baseline justify-between gap-2">
                            <h3 className="font-extrabold text-base sm:text-lg text-flandi-dark leading-tight flex items-center gap-1.5">
                              <User className="w-4 h-4 text-flandi-coral shrink-0" />
                              <span>{order.customerName || "Khách nhận bánh"}</span>
                            </h3>

                            <a
                              href={`tel:${order.customerPhone}`}
                              className="font-mono font-black text-sm sm:text-base text-flandi-coral bg-rose-50 hover:bg-rose-100 border border-flandi-salmon px-2.5 py-1 rounded-xl flex items-center gap-1 shrink-0"
                              title="Bấm gọi ngay"
                            >
                              <Phone className="w-3.5 h-3.5" />
                              <span>{order.customerPhone}</span>
                            </a>
                          </div>

                          {/* Delivery Address */}
                          <div className="flex items-start gap-2 bg-[#FAF5F4] p-2.5 rounded-xl border border-flandi-pink/80">
                            <MapPin className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                            <div className="text-xs sm:text-sm font-bold text-flandi-dark min-w-0 flex-1">
                              <p className="leading-snug">
                                {order.customerAddress || "Khách ghé tiệm lấy"}
                              </p>
                              {order.note && (
                                <p className="text-xs text-amber-800 font-extrabold mt-1 bg-amber-100/70 p-1 rounded">
                                  📝 Ghi chú: {order.note}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Items Breakdown */}
                        <div className="space-y-1 pt-1">
                          <p className="text-[11px] font-bold text-flandi-muted uppercase tracking-wider">
                            Món cần giao ({order.items.reduce((s, i) => s + i.quantity, 0)} phần):
                          </p>
                          <div className="flex flex-wrap gap-1.5">
                            {order.items.map((item, idx) => (
                              <span
                                key={idx}
                                className="px-2.5 py-1 rounded-lg bg-flandi-bg border border-flandi-pink text-xs font-black text-flandi-dark"
                              >
                                {item.quantity}x {item.productName}{" "}
                                <span className="font-normal text-flandi-muted text-[11px]">
                                  ({item.variantName})
                                </span>
                              </span>
                            ))}
                          </div>
                        </div>

                        {/* Payment Status & COD Callout */}
                        <div className="pt-2 border-t border-flandi-pink/80 flex items-center justify-between gap-2 flex-wrap">
                          <div>
                            <span className="text-[11px] font-bold text-flandi-muted block">
                              Thanh toán ({order.paymentMethod}):
                            </span>
                            {order.isPaid ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-800 border border-emerald-300 text-xs font-black">
                                <Check className="w-3.5 h-3.5" />
                                <span>ĐÃ THANH TOÁN (0đ THU HỘ)</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-gradient-to-r from-rose-500 to-flandi-coral text-white text-sm font-black shadow-xs">
                                <span>THU TIỀN MẶT COD:</span>
                                <span className="tabular-nums underline decoration-2">
                                  {formatVND(order.total)}
                                </span>
                              </span>
                            )}
                          </div>

                          <div className="text-right">
                            <span className="text-[11px] font-bold text-flandi-muted block">
                              Tổng tiền đơn
                            </span>
                            <span className="font-black text-base sm:text-lg text-flandi-dark tabular-nums">
                              {formatVND(order.total)}
                            </span>
                          </div>
                        </div>

                        {/* 4 Action Buttons for Shipper (Call, Maps, Zalo, QR) */}
                        <div className="grid grid-cols-4 gap-1.5 sm:gap-2 pt-2">
                          {/* 1. Gọi điện */}
                          <a
                            href={`tel:${order.customerPhone}`}
                            className="py-2.5 px-2 rounded-xl bg-rose-50 hover:bg-rose-100 border border-flandi-salmon text-flandi-coral font-black text-xs flex flex-col sm:flex-row items-center justify-center gap-1 text-center transition active:scale-95 shadow-2xs"
                          >
                            <Phone className="w-4 h-4 shrink-0" />
                            <span>Gọi điện</span>
                          </a>

                          {/* 2. Chỉ đường Google Maps */}
                          <a
                            href={buildMapsUrl(order.customerAddress || "")}
                            target="_blank"
                            rel="noreferrer"
                            className="py-2.5 px-2 rounded-xl bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-700 font-black text-xs flex flex-col sm:flex-row items-center justify-center gap-1 text-center transition active:scale-95 shadow-2xs"
                          >
                            <Navigation className="w-4 h-4 shrink-0" />
                            <span>Chỉ đường</span>
                          </a>

                          {/* 3. Nhắn Zalo */}
                          <a
                            href={buildZaloUrl(order.customerPhone)}
                            target="_blank"
                            rel="noreferrer"
                            className="py-2.5 px-2 rounded-xl bg-[#0068FF]/10 hover:bg-[#0068FF]/20 border border-[#0068FF]/30 text-[#0068FF] font-black text-xs flex flex-col sm:flex-row items-center justify-center gap-1 text-center transition active:scale-95 shadow-2xs"
                          >
                            <MessageCircle className="w-4 h-4 shrink-0" />
                            <span>Zalo</span>
                          </a>

                          {/* 4. Quét QR TPBank nếu khách muốn chuyển khoản */}
                          <button
                            type="button"
                            onClick={() => setQrModalOrder(order)}
                            className="py-2.5 px-2 rounded-xl bg-purple-50 hover:bg-purple-100 border border-purple-200 text-purple-700 font-black text-xs flex flex-col sm:flex-row items-center justify-center gap-1 text-center transition active:scale-95 shadow-2xs cursor-pointer"
                          >
                            <QrCode className="w-4 h-4 shrink-0" />
                            <span>Mã QR</span>
                          </button>
                        </div>

                        {/* Big State Transition Buttons */}
                        {!isCompleted && !isCancelled && (
                          <div className="pt-2 flex items-center gap-2">
                            {!isDelivering ? (
                              <button
                                type="button"
                                disabled={processingOrderId === order.id}
                                onClick={() =>
                                  handleUpdateStatus(order.id, "DELIVERING")
                                }
                                className="flex-1 py-3 px-4 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-black text-xs sm:text-sm flex items-center justify-center gap-2 shadow-cute transition active:scale-95 cursor-pointer disabled:opacity-50"
                              >
                                <Bike className="w-4 h-4" />
                                <span>
                                  {processingOrderId === order.id
                                    ? "Đang lưu..."
                                    : "🛵 Bắt đầu đi giao"}
                                </span>
                              </button>
                            ) : (
                              <button
                                type="button"
                                disabled={processingOrderId === order.id}
                                onClick={() =>
                                  handleUpdateStatus(order.id, "COMPLETED", true)
                                }
                                className="flex-1 py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs sm:text-sm flex items-center justify-center gap-2 shadow-cute transition active:scale-95 cursor-pointer disabled:opacity-50 animate-bounce-subtle"
                              >
                                <CheckCircle2 className="w-4 h-4" />
                                <span>
                                  {processingOrderId === order.id
                                    ? "Đang lưu..."
                                    : "✅ Đã giao bánh & Thu đủ tiền"}
                                </span>
                              </button>
                            )}

                            {/* Nút huỷ đơn phòng trường hợp khách không nhận */}
                            <button
                              type="button"
                              onClick={() => {
                                if (
                                  confirm(
                                    `Bạn có chắc chắn muốn huỷ đơn #${order.code}? (Hệ thống sẽ hoàn số lượng bánh về lại kho tiệm)`
                                  )
                                ) {
                                  handleUpdateStatus(order.id, "CANCELLED");
                                }
                              }}
                              className="px-3 py-3 rounded-xl bg-gray-100 hover:bg-red-50 text-gray-600 hover:text-red-600 font-extrabold text-xs transition"
                              title="Huỷ đơn này"
                            >
                              Huỷ
                            </button>
                          </div>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: SOẠN BÁNH VÀO THÙNG XỐP GIỮ NHIỆT TRƯỚC KHI ĐI */}
        {activeTab === "SUMMARY" && (
          <div className="bg-white rounded-3xl border border-flandi-pink p-4 sm:p-6 shadow-2xs space-y-4">
            <div className="flex items-center justify-between border-b border-flandi-pink pb-3 flex-wrap gap-2">
              <div>
                <h2 className="font-display text-lg sm:text-xl font-black text-flandi-dark flex items-center gap-2">
                  <Box className="w-5 h-5 text-flandi-coral" />
                  <span>Danh Sách Soạn Thùng Giữ Nhiệt</span>
                </h2>
                <p className="text-xs font-semibold text-flandi-muted mt-0.5">
                  Tổng hợp từ {stats.needShipCount} đơn hàng cần giao trong ca • Tổng cộng {stats.totalCakes} phần bánh
                </p>
              </div>

              <button
                type="button"
                onClick={() => setCheckedItems({})}
                className="px-3 py-1.5 rounded-xl bg-flandi-bg hover:bg-flandi-pink/40 text-flandi-coral text-xs font-extrabold border border-flandi-pink transition"
              >
                Đặt lại Checklist
              </button>
            </div>

            {/* Checklist từng loại bánh */}
            {stats.sortedCakeList.length === 0 ? (
              <p className="py-8 text-center text-xs font-bold text-flandi-muted">
                Hiện không có đơn nào cần soạn bánh.
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {stats.sortedCakeList.map((item, idx) => {
                  const itemKey = `${item.name}_${item.variant}`;
                  const isDone = !!checkedItems[itemKey];

                  return (
                    <div
                      key={idx}
                      onClick={() => toggleCheckItem(itemKey)}
                      className={`p-3.5 rounded-2xl border flex items-center justify-between gap-3 cursor-pointer transition select-none ${
                        isDone
                          ? "bg-emerald-50/70 border-emerald-300 opacity-60"
                          : "bg-flandi-bg/40 border-flandi-pink hover:border-flandi-coral"
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {isDone ? (
                          <CheckSquare className="w-5 h-5 text-emerald-600 shrink-0" />
                        ) : (
                          <Square className="w-5 h-5 text-flandi-muted shrink-0" />
                        )}
                        <div className="min-w-0">
                          <p
                            className={`font-black text-sm text-flandi-dark truncate ${
                              isDone ? "line-through text-flandi-muted" : ""
                            }`}
                          >
                            {item.name}
                          </p>
                          <p className="text-[11px] font-bold text-flandi-muted truncate">
                            Phân loại: {item.variant}
                          </p>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <span
                          className={`text-lg font-black tabular-nums px-2.5 py-1 rounded-xl border ${
                            isDone
                              ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                              : "bg-white text-flandi-coral border-flandi-salmon shadow-2xs"
                          }`}
                        >
                          x {item.qty}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Lưu ý đóng thùng hàng */}
            <div className="p-4 rounded-2xl bg-flandi-cream/70 border border-flandi-salmon text-xs space-y-2">
              <p className="font-black text-flandi-coral flex items-center gap-1.5">
                <Sparkles className="w-4 h-4" />
                <span>Quy Chuẩn Giữ Lạnh Khi Giao Hàng:</span>
              </p>
              <ul className="list-disc pl-4 space-y-1 font-semibold text-flandi-dark/80">
                <li>Đặt <strong>đá gel lạnh</strong> ở đáy thùng và chèn xung quanh hũ bánh để giữ nhiệt 2°C – 6°C suốt quãng đường.</li>
                <li>Xếp bánh Flan và Rau câu ở dưới, Panna Cotta có sốt trái cây tươi xếp phía trên để tránh bị nghiêng đổ sốt.</li>
                <li>Kiểm tra đủ thìa muỗng và túi đựng trước khi xuất phát.</li>
              </ul>
            </div>

            <button
              type="button"
              onClick={() => setActiveTab("DELIVERY")}
              className="w-full py-3 rounded-2xl bg-flandi-coral hover:bg-flandi-salmon text-white font-black text-sm shadow-cute transition flex items-center justify-center gap-2 cursor-pointer"
            >
              <Bike className="w-4 h-4" />
              <span>Đã Xong Thùng Hàng • Chuyển Sang Lộ Trình Giao</span>
            </button>
          </div>
        )}
      </main>

      {/* MODAL MÃ QR THU TIỀN TẠI CHỖ CHO KHÁCH (TPBANK BÙI VĂN LỢI) */}
      {qrModalOrder && settings && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in"
          onClick={() => setQrModalOrder(null)}
        >
          <div
            className="bg-white rounded-3xl p-5 max-w-sm w-full border-2 border-flandi-salmon shadow-cute-lg space-y-3.5 text-center animate-in zoom-in-95 max-h-[95vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-flandi-pink pb-2">
              <div className="text-left">
                <h3 className="font-display text-base font-black text-flandi-coral">
                  Quét Mã QR Chuyển Khoản
                </h3>
                <p className="text-xs font-bold text-flandi-muted">
                  Đơn #{qrModalOrder.code} • {qrModalOrder.customerName}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setQrModalOrder(null)}
                className="w-8 h-8 rounded-full bg-flandi-bg hover:bg-flandi-pink/50 text-flandi-dark flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Thẻ QR TPBank hoàn chỉnh */}
            <div className="relative mx-auto w-full max-w-[270px] aspect-[74/102] rounded-2xl overflow-hidden bg-[#1E112E] shadow-cute border border-[#3E2356] flex items-center justify-center p-1">
              <img
                src="/images/payment-qr.png"
                alt="Mã QR TPBank Bùi Văn Lợi"
                className="w-full h-full object-contain rounded-xl"
              />
            </div>

            <div className="p-3 bg-flandi-cream/70 rounded-2xl border border-flandi-pink text-xs space-y-1 text-left">
              <div className="flex justify-between items-center">
                <span className="font-bold text-flandi-muted">Số tiền cần thu:</span>
                <span className="text-lg font-black text-flandi-coral tabular-nums">
                  {formatVND(qrModalOrder.total)}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="font-bold text-flandi-muted">Ngân hàng:</span>
                <span className="font-extrabold text-flandi-dark">{settings.bankName}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="font-bold text-flandi-muted">Chủ tài khoản:</span>
                <span className="font-extrabold text-flandi-dark">
                  {settings.bankAccountName || "BUI VAN LOI"}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="font-bold text-flandi-muted">Số tài khoản:</span>
                <span className="font-mono font-black text-flandi-coral">
                  {settings.bankAccountNo}
                </span>
              </div>
              <div className="flex justify-between items-center pt-1 border-t border-dashed border-flandi-pink">
                <span className="font-bold text-flandi-muted">Nội dung CK:</span>
                <span className="font-mono font-black text-flandi-dark">
                  FLANDI {qrModalOrder.code}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  copyToClipboardInstant(settings.bankAccountNo.replace(/\s+/g, ""));
                  notify("📋 Đã sao chép STK!");
                }}
                className="py-2 px-3 rounded-xl bg-white border border-flandi-pink text-xs font-bold text-flandi-dark hover:bg-flandi-bg flex items-center justify-center gap-1.5"
              >
                <Copy className="w-3.5 h-3.5 text-flandi-coral" />
                <span>Copy STK</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  copyToClipboardInstant(`FLANDI ${qrModalOrder.code}`);
                  notify("📋 Đã sao chép nội dung!");
                }}
                className="py-2 px-3 rounded-xl bg-white border border-flandi-pink text-xs font-bold text-flandi-dark hover:bg-flandi-bg flex items-center justify-center gap-1.5"
              >
                <Copy className="w-3.5 h-3.5 text-flandi-coral" />
                <span>Copy Nội Dung</span>
              </button>
            </div>

            {/* Nút xác nhận đã nhận tiền và hoàn tất đơn */}
            <button
              type="button"
              disabled={processingOrderId === qrModalOrder.id}
              onClick={() =>
                handleUpdateStatus(qrModalOrder.id, "COMPLETED", true)
              }
              className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs shadow-cute cursor-pointer transition flex items-center justify-center gap-2"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>
                {processingOrderId === qrModalOrder.id
                  ? "Đang xử lý..."
                  : "Khách Đã Chuyển Khoản Xong • Hoàn Tất Đơn"}
              </span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
