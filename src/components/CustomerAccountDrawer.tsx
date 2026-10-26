"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import {
  X,
  Package,
  User,
  MapPin,
  Phone,
  Search,
  Clock,
  CheckCircle2,
  AlertCircle,
  Truck,
  RotateCcw,
  QrCode,
  MessageCircle,
  Copy,
  Check,
  LogOut,
  Save,
  Sparkles,
  ShoppingBag,
  ExternalLink,
} from "lucide-react";
import { useCustomerAuth } from "@/lib/customer-auth-context";
import { Order, OrderStatus } from "@/lib/types";

interface CustomerAccountDrawerProps {
  onReorder?: (items: { productId: string; quantity: number }[]) => void;
  shopPhone?: string;
  bankBin?: string;
  bankAccountNo?: string;
  shopName?: string;
}

export default function CustomerAccountDrawer({
  onReorder,
  shopPhone = "0703166903",
  bankBin = "970436",
  bankAccountNo = "1029384756",
  shopName = "FLANDI",
}: CustomerAccountDrawerProps) {
  const {
    user,
    isAccountDrawerOpen,
    setIsAccountDrawerOpen,
    accountDrawerTab,
    setAccountDrawerTab,
    logout,
    updateProfile,
    triggerGoogleSignIn,
  } = useCustomerAuth();

  // Tab State
  const [activeTab, setActiveTab] = useState<"orders" | "profile">(accountDrawerTab);

  // Profile Form State
  const [profileName, setProfileName] = useState("");
  const [profilePhone, setProfilePhone] = useState("");
  const [profileAddress, setProfileAddress] = useState("");
  const [profileNote, setProfileNote] = useState("");
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileSuccessToast, setProfileSuccessToast] = useState(false);

  // Orders State
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoadingOrders, setIsLoadingOrders] = useState(false);
  const [orderSearchQuery, setOrderSearchQuery] = useState("");
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // Selected Order for VietQR Modal
  const [qrOrder, setQrOrder] = useState<Order | null>(null);

  // Sync drawer tab from context
  useEffect(() => {
    setActiveTab(accountDrawerTab);
  }, [accountDrawerTab]);

  // Sync user profile fields into state
  useEffect(() => {
    if (user) {
      setProfileName(user.name || "");
      setProfilePhone(user.phone || "");
      setProfileAddress(user.address || "");
      setProfileNote(user.deliveryNote || "");
    }
  }, [user]);

  // Fetch orders when drawer opens
  const fetchOrders = async (phoneOrCode?: string) => {
    setIsLoadingOrders(true);
    try {
      const params = new URLSearchParams();
      if (phoneOrCode) {
        if (phoneOrCode.toUpperCase().startsWith("FL-")) {
          params.append("code", phoneOrCode.toUpperCase().trim());
        } else {
          params.append("phone", phoneOrCode.trim());
        }
      }
      const url = `/api/customer/orders${params.toString() ? `?${params.toString()}` : ""}`;
      const res = await fetch(url, { cache: "no-store" });
      const data = await res.json();
      if (data.orders) {
        setOrders(data.orders);
      }
    } catch (err) {
      console.error("Failed to load customer orders:", err);
    } finally {
      setIsLoadingOrders(false);
    }
  };

  useEffect(() => {
    if (isAccountDrawerOpen) {
      fetchOrders();
    }
  }, [isAccountDrawerOpen, user]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchOrders(orderSearchQuery);
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingProfile(true);
    const res = await updateProfile({
      name: profileName.trim(),
      phone: profilePhone.trim(),
      address: profileAddress.trim(),
      deliveryNote: profileNote.trim(),
    });
    setIsSavingProfile(false);
    if (res.success) {
      setProfileSuccessToast(true);
      setTimeout(() => setProfileSuccessToast(false), 3000);
    }
  };

  const handleCopy = (code: string) => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(code);
      setCopiedCode(code);
      setTimeout(() => setCopiedCode(null), 2000);
    }
  };

  const handleReorderClick = (order: Order) => {
    if (onReorder) {
      const itemsToReorder = order.items.map((i) => ({
        productId: i.productId,
        quantity: i.quantity,
      }));
      onReorder(itemsToReorder);
      setIsAccountDrawerOpen(false);
    } else {
      // Navigate to order page if on home
      if (typeof window !== "undefined") {
        window.location.href = "/order";
      }
    }
  };

  const formatVND = (num: number) => {
    const inK = num / 1000;
    return `${Number(inK.toFixed(1))}k`;
  };

  const getStatusBadge = (status: OrderStatus) => {
    switch (status) {
      case "PENDING":
        return {
          label: "Chờ xác nhận",
          bg: "bg-amber-100 text-amber-800 border-amber-300",
          icon: <Clock className="w-3 h-3" />,
        };
      case "PREPARING":
        return {
          label: "Đang làm bánh",
          bg: "bg-orange-100 text-orange-800 border-orange-300",
          icon: <Sparkles className="w-3 h-3" />,
        };
      case "COMPLETED":
        return {
          label: "Giao thành công",
          bg: "bg-emerald-100 text-emerald-800 border-emerald-300",
          icon: <CheckCircle2 className="w-3 h-3" />,
        };
      case "CANCELLED":
        return {
          label: "Đã huỷ",
          bg: "bg-rose-100 text-rose-800 border-rose-300",
          icon: <AlertCircle className="w-3 h-3" />,
        };
      default:
        return {
          label: status,
          bg: "bg-gray-100 text-gray-800 border-gray-300",
          icon: <Package className="w-3 h-3" />,
        };
    }
  };

  const filteredOrders = useMemo(() => {
    if (!orderSearchQuery.trim()) return orders;
    const q = orderSearchQuery.toLowerCase().trim();
    return orders.filter(
      (o) =>
        o.code.toLowerCase().includes(q) ||
        o.customerPhone.includes(q) ||
        o.customerName.toLowerCase().includes(q) ||
        o.items.some((i) => i.productName.toLowerCase().includes(q))
    );
  }, [orders, orderSearchQuery]);

  if (!isAccountDrawerOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex justify-end animate-in fade-in duration-200"
      onClick={() => setIsAccountDrawerOpen(false)}
    >
      <div
        className="w-full sm:max-w-md md:max-w-lg bg-white h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-200 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drawer Header */}
        <div className="bg-gradient-to-r from-flandi-cream via-[#FFF3EE] to-flandi-cream px-5 py-4 border-b border-flandi-pink/80 shrink-0">
          <div className="flex items-center justify-between gap-3">
            {user ? (
              <div className="flex items-center gap-3 min-w-0">
                <div className="relative shrink-0">
                  <img
                    src={user.picture || "https://api.dicebear.com/7.x/bottts/svg?seed=flandi"}
                    alt={user.name}
                    className="w-11 h-11 rounded-full object-cover border-2 border-flandi-salmon shadow-xs"
                  />
                  <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-white flex items-center justify-center shadow-2xs">
                    <svg className="w-3 h-3" viewBox="0 0 24 24">
                      <path
                        fill="#4285F4"
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      />
                      <path
                        fill="#34A853"
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      />
                      <path
                        fill="#FBBC05"
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                      />
                      <path
                        fill="#EA4335"
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                      />
                    </svg>
                  </div>
                </div>
                <div className="min-w-0">
                  <h3 className="font-display text-base font-black text-flandi-dark truncate">
                    {user.name}
                  </h3>
                  <p className="text-xs font-semibold text-flandi-muted truncate">
                    {user.email}
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-flandi-salmon/20 text-flandi-coral flex items-center justify-center border border-flandi-pink shrink-0 shadow-2xs">
                  <Package className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-display text-base font-black text-flandi-dark leading-tight">
                    Tra Cứu Đơn Hàng
                  </h3>
                  <p className="text-xs font-bold text-flandi-muted">
                    Xem lịch sử bánh & thông tin giao
                  </p>
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={() => setIsAccountDrawerOpen(false)}
              className="w-9 h-9 rounded-full bg-white hover:bg-flandi-pink/50 text-flandi-dark flex items-center justify-center transition border border-flandi-pink/70 shrink-0"
              title="Đóng"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Prompt to log in if not logged in */}
          {!user && (
            <div className="mt-3 p-3 rounded-2xl bg-white/90 border border-flandi-pink/80 flex items-center justify-between gap-2 shadow-2xs">
              <div className="text-xs min-w-0">
                <p className="font-black text-flandi-dark">Đăng nhập tài khoản Google?</p>
                <p className="text-[11px] font-semibold text-flandi-muted truncate">
                  Lưu sẵn thông tin giao hàng & theo dõi đơn dễ dàng
                </p>
              </div>
              <button
                type="button"
                onClick={triggerGoogleSignIn}
                className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-flandi-coral to-flandi-salmon text-white text-xs font-black shrink-0 shadow-2xs hover:opacity-95 transition cursor-pointer"
              >
                Đăng Nhập Google
              </button>
            </div>
          )}

          {/* Navigation Tabs */}
          <div className="flex items-center gap-2 mt-4 bg-white/70 p-1 rounded-2xl border border-flandi-pink/70">
            <button
              type="button"
              onClick={() => setActiveTab("orders")}
              className={`flex-1 py-2 px-3 rounded-xl text-xs font-black flex items-center justify-center gap-2 transition ${
                activeTab === "orders"
                  ? "bg-flandi-coral text-white shadow-2xs"
                  : "text-flandi-muted hover:text-flandi-dark hover:bg-white/50"
              }`}
            >
              <Package className="w-3.5 h-3.5" />
              <span>Đơn hàng của tôi</span>
              {orders.length > 0 && (
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                    activeTab === "orders" ? "bg-white/30 text-white" : "bg-flandi-pink/60 text-flandi-dark"
                  }`}
                >
                  {orders.length}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("profile")}
              className={`flex-1 py-2 px-3 rounded-xl text-xs font-black flex items-center justify-center gap-2 transition ${
                activeTab === "profile"
                  ? "bg-flandi-coral text-white shadow-2xs"
                  : "text-flandi-muted hover:text-flandi-dark hover:bg-white/50"
              }`}
            >
              <User className="w-3.5 h-3.5" />
              <span>Thông tin & Giao hàng</span>
            </button>
          </div>
        </div>

        {/* Tab 1: Orders Content */}
        {activeTab === "orders" && (
          <div className="flex-1 flex flex-col min-h-0 bg-[#FFFDFD]">
            {/* Search Bar */}
            <form onSubmit={handleSearchSubmit} className="p-3 sm:p-4 border-b border-flandi-pink/50">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Nhập mã đơn (#FL-...) hoặc Số điện thoại..."
                  value={orderSearchQuery}
                  onChange={(e) => setOrderSearchQuery(e.target.value)}
                  className="w-full text-xs font-bold text-flandi-dark bg-flandi-bg/60 border border-flandi-pink/80 rounded-2xl pl-9 pr-20 py-2.5 focus:outline-none focus:border-flandi-coral focus:bg-white transition"
                />
                <Search className="w-4 h-4 text-flandi-muted absolute left-3 top-3" />
                <button
                  type="submit"
                  className="absolute right-1.5 top-1.5 px-3 py-1.5 bg-flandi-coral text-white rounded-xl text-xs font-bold shadow-2xs hover:opacity-95 transition"
                >
                  Tra cứu
                </button>
              </div>
            </form>

            {/* Orders List */}
            <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3 no-scrollbar">
              {isLoadingOrders ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((n) => (
                    <div
                      key={n}
                      className="h-32 rounded-2xl bg-flandi-bg/60 border border-flandi-pink/50 animate-pulse"
                    />
                  ))}
                </div>
              ) : filteredOrders.length === 0 ? (
                <div className="h-64 flex flex-col items-center justify-center text-center p-6 rounded-3xl border-2 border-dashed border-flandi-pink/70 bg-flandi-bg/40 space-y-3">
                  <div className="w-14 h-14 rounded-full bg-flandi-salmon/20 text-flandi-coral flex items-center justify-center">
                    <ShoppingBag className="w-7 h-7" />
                  </div>
                  <div>
                    <h4 className="font-display text-base font-black text-flandi-dark">
                      Chưa tìm thấy đơn hàng nào
                    </h4>
                    <p className="text-xs font-bold text-flandi-muted mt-1 max-w-xs">
                      {user
                        ? "Bạn chưa có đơn đặt bánh nào với tài khoản này. Hãy chọn món và thưởng thức nhé!"
                        : "Nhập mã đơn hoặc số điện thoại bạn đã dùng khi đặt hàng để tra cứu tiến độ nha!"}
                    </p>
                  </div>
                  <Link
                    href="/order"
                    onClick={() => setIsAccountDrawerOpen(false)}
                    className="px-5 py-2.5 rounded-full bg-gradient-to-r from-flandi-coral to-flandi-salmon text-white text-xs font-black shadow-cute flex items-center gap-1.5 hover:opacity-95 transition active:scale-95"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Xem thực đơn & Đặt bánh ngay</span>
                  </Link>
                </div>
              ) : (
                filteredOrders.map((order) => {
                  const badge = getStatusBadge(order.status);
                  const dateStr = new Date(order.createdAt).toLocaleString("vi-VN", {
                    hour: "2-digit",
                    minute: "2-digit",
                    day: "2-digit",
                    month: "2-digit",
                    year: "numeric",
                  });

                  return (
                    <div
                      key={order.id}
                      className="rounded-2xl sm:rounded-3xl border border-flandi-pink/80 bg-white p-3.5 sm:p-4 shadow-2xs hover:shadow-cute transition space-y-3"
                    >
                      {/* Order Card Header */}
                      <div className="flex items-start justify-between gap-2 border-b border-flandi-pink/40 pb-2.5">
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="font-display text-sm font-black text-flandi-coral">
                              #{order.code}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleCopy(order.code)}
                              className="text-flandi-muted hover:text-flandi-dark p-0.5"
                              title="Copy mã đơn"
                            >
                              {copiedCode === order.code ? (
                                <Check className="w-3.5 h-3.5 text-emerald-600" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                            </button>
                          </div>
                          <span className="text-[11px] font-semibold text-flandi-muted block">
                            {dateStr}
                          </span>
                        </div>

                        <span
                          className={`px-2.5 py-1 rounded-full text-[11px] font-black border flex items-center gap-1 shrink-0 ${badge.bg}`}
                        >
                          {badge.icon}
                          <span>{badge.label}</span>
                        </span>
                      </div>

                      {/* Items List */}
                      <div className="space-y-1.5 text-xs">
                        {order.items.map((item, idx) => (
                          <div
                            key={idx}
                            className="flex items-center justify-between text-flandi-dark"
                          >
                            <span className="font-bold truncate flex-1 min-w-0 mr-2">
                              {item.quantity}x {item.productName}
                            </span>
                            <span className="font-extrabold text-flandi-muted shrink-0">
                              {formatVND(item.subtotal)}
                            </span>
                          </div>
                        ))}
                      </div>

                      {/* Total & Delivery Address */}
                      <div className="pt-2 border-t border-dashed border-flandi-pink/50 space-y-1.5 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-extrabold text-flandi-muted uppercase">
                            Tổng thanh toán ({order.paymentMethod}):
                          </span>
                          <span className="font-display text-base font-black text-flandi-coral">
                            {formatVND(order.total)}
                          </span>
                        </div>

                        {order.customerAddress && (
                          <div className="flex items-start gap-1.5 text-[11px] text-flandi-dark/80 bg-flandi-bg/60 p-2 rounded-xl">
                            <MapPin className="w-3.5 h-3.5 text-flandi-coral shrink-0 mt-0.5" />
                            <span className="truncate">{order.customerAddress}</span>
                          </div>
                        )}
                      </div>

                      {/* Order Actions */}
                      <div className="pt-1 flex items-center gap-2 flex-wrap">
                        <button
                          type="button"
                          onClick={() => handleReorderClick(order)}
                          className="flex-1 py-2 px-3 rounded-xl bg-flandi-cream hover:bg-flandi-salmon/20 text-flandi-coral border border-flandi-pink/80 font-black text-xs flex items-center justify-center gap-1.5 transition active:scale-95 shadow-2xs"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>Đặt lại đơn này</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setQrOrder(order)}
                          className="py-2 px-3 rounded-xl bg-white hover:bg-flandi-bg text-flandi-dark border border-flandi-pink/80 font-extrabold text-xs flex items-center gap-1.5 transition shadow-2xs"
                          title="Xem mã VietQR để thanh toán"
                        >
                          <QrCode className="w-3.5 h-3.5 text-flandi-coral" />
                          <span className="hidden sm:inline">Mã QR</span>
                        </button>

                        <a
                          href={`tel:${shopPhone}`}
                          className="p-2 rounded-xl bg-white hover:bg-flandi-bg text-flandi-muted hover:text-flandi-dark border border-flandi-pink/80 transition"
                          title="Gọi tiệm"
                        >
                          <Phone className="w-3.5 h-3.5 text-flandi-coral" />
                        </a>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* Tab 2: Profile & Delivery Information Content */}
        {activeTab === "profile" && (
          <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 no-scrollbar bg-[#FFFDFD]">
            {user ? (
              <form onSubmit={handleSaveProfile} className="space-y-4">
                {profileSuccessToast && (
                  <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center gap-2 animate-in fade-in">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Đã lưu thông tin giao hàng thành công! Đơn tiếp theo sẽ tự động điền.</span>
                  </div>
                )}

                {/* Google Account Tag */}
                <div className="p-3 rounded-2xl bg-flandi-cream/60 border border-flandi-pink/80 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-full bg-white flex items-center justify-center shadow-2xs">
                      <svg className="w-4 h-4" viewBox="0 0 24 24">
                        <path
                          fill="#4285F4"
                          d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                        />
                        <path
                          fill="#34A853"
                          d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                        />
                        <path
                          fill="#FBBC05"
                          d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                        />
                        <path
                          fill="#EA4335"
                          d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                        />
                      </svg>
                    </div>
                    <div>
                      <p className="text-[11px] font-extrabold text-flandi-dark leading-tight">
                        Tài khoản Google liên kết
                      </p>
                      <p className="text-[11px] text-flandi-muted font-semibold">
                        {user.email}
                      </p>
                    </div>
                  </div>
                  <span className="text-[10px] font-extrabold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full border border-emerald-300">
                    Đã xác minh
                  </span>
                </div>

                {/* Name */}
                <div>
                  <label className="text-xs font-bold text-flandi-dark block mb-1">
                    Họ và tên người nhận *
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      required
                      placeholder="Ví dụ: Nguyễn Mai Anh"
                      value={profileName}
                      onChange={(e) => setProfileName(e.target.value)}
                      className="w-full text-xs font-bold text-flandi-dark bg-white border border-flandi-pink rounded-xl pl-9 pr-3 py-2.5 focus:outline-none focus:border-flandi-coral"
                    />
                    <User className="w-4 h-4 text-flandi-coral absolute left-3 top-3" />
                  </div>
                </div>

                {/* Phone */}
                <div>
                  <label className="text-xs font-bold text-flandi-dark block mb-1">
                    Số điện thoại nhận bánh *
                  </label>
                  <div className="relative">
                    <input
                      type="tel"
                      required
                      placeholder="Ví dụ: 0901234567"
                      value={profilePhone}
                      onChange={(e) => setProfilePhone(e.target.value)}
                      className="w-full text-xs font-bold text-flandi-dark bg-white border border-flandi-pink rounded-xl pl-9 pr-3 py-2.5 focus:outline-none focus:border-flandi-coral"
                    />
                    <Phone className="w-4 h-4 text-flandi-coral absolute left-3 top-3" />
                  </div>
                  <p className="text-[10px] font-semibold text-flandi-muted mt-1">
                    Số điện thoại dùng để shipper gọi khi bánh đến nơi.
                  </p>
                </div>

                {/* Default Address */}
                <div>
                  <label className="text-xs font-bold text-flandi-dark block mb-1">
                    Địa chỉ nhận bánh mặc định *
                  </label>
                  <div className="relative">
                    <textarea
                      rows={2}
                      required
                      placeholder="Số nhà, tên đường, Phường/Xã, Quận/Huyện..."
                      value={profileAddress}
                      onChange={(e) => setProfileAddress(e.target.value)}
                      className="w-full text-xs font-bold text-flandi-dark bg-white border border-flandi-pink rounded-xl pl-9 pr-3 py-2.5 focus:outline-none focus:border-flandi-coral resize-none"
                    />
                    <MapPin className="w-4 h-4 text-flandi-coral absolute left-3 top-3" />
                  </div>
                </div>

                {/* Default Delivery Note */}
                <div>
                  <label className="text-xs font-bold text-flandi-dark block mb-1">
                    Ghi chú giao bánh quen thuộc (tuỳ chọn)
                  </label>
                  <input
                    type="text"
                    placeholder="Ví dụ: Gọi trước 10 phút, gửi bảo vệ tầng trệt..."
                    value={profileNote}
                    onChange={(e) => setProfileNote(e.target.value)}
                    className="w-full text-xs font-bold text-flandi-dark bg-white border border-flandi-pink rounded-xl px-3 py-2.5 focus:outline-none focus:border-flandi-coral"
                  />
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={isSavingProfile}
                    className="w-full py-3 px-4 rounded-2xl bg-gradient-to-r from-flandi-coral to-flandi-salmon hover:opacity-95 text-white font-black text-sm shadow-cute flex items-center justify-center gap-2 transition active:scale-98"
                  >
                    <Save className="w-4 h-4" />
                    <span>{isSavingProfile ? "Đang lưu..." : "Lưu Thông Tin Giao Hàng"}</span>
                  </button>
                </div>

                <div className="pt-4 border-t border-flandi-pink/50">
                  <button
                    type="button"
                    onClick={logout}
                    className="w-full py-2.5 px-3 rounded-xl border border-rose-200 text-rose-600 hover:bg-rose-50 text-xs font-extrabold flex items-center justify-center gap-2 transition"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>Đăng xuất tài khoản Google</span>
                  </button>
                </div>
              </form>
            ) : (
              <div className="text-center p-6 space-y-4 rounded-3xl bg-flandi-bg/50 border-2 border-dashed border-flandi-pink/80">
                <div className="w-14 h-14 rounded-full bg-white text-flandi-coral flex items-center justify-center mx-auto shadow-2xs">
                  <User className="w-7 h-7" />
                </div>
                <div>
                  <h4 className="font-display text-base font-black text-flandi-dark">
                    Chưa đăng nhập tài khoản
                  </h4>
                  <p className="text-xs font-bold text-flandi-muted mt-1 max-w-xs mx-auto">
                    Đăng nhập Google để lưu sẵn tên, số điện thoại và địa chỉ giao bánh. Mỗi lần đặt bánh chỉ cần 1 cú chạm!
                  </p>
                </div>
                <button
                  type="button"
                  onClick={triggerGoogleSignIn}
                  className="px-6 py-3 rounded-2xl bg-gradient-to-r from-flandi-coral to-flandi-salmon text-white text-xs font-black shadow-cute hover:opacity-95 transition inline-flex items-center gap-2 cursor-pointer"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>Đăng Nhập Với Google Ngay</span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* VietQR Modal Popup inside Drawer */}
        {qrOrder && (
          <div
            className="fixed inset-0 z-60 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in"
            onClick={() => setQrOrder(null)}
          >
            <div
              className="bg-white rounded-3xl p-5 max-w-sm w-full border-2 border-flandi-salmon shadow-cute-lg space-y-3.5 text-center animate-in zoom-in-95"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-flandi-pink pb-2">
                <span className="font-display text-sm font-black text-flandi-coral">
                  VietQR Đơn #{qrOrder.code}
                </span>
                <button
                  type="button"
                  onClick={() => setQrOrder(null)}
                  className="p-1 rounded-full bg-flandi-bg hover:bg-flandi-pink/50 text-flandi-dark"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-3 bg-flandi-cream/60 rounded-2xl border border-flandi-pink">
                <img
                  src={`https://img.vietqr.io/image/${bankBin}-${bankAccountNo}-compact2.png?amount=${qrOrder.total}&addInfo=${encodeURIComponent(
                    `FLANDI ${qrOrder.code}`
                  )}`}
                  alt="VietQR"
                  className="w-48 h-48 mx-auto rounded-xl bg-white border border-flandi-pink object-contain shadow-xs"
                />
                <div className="mt-2 text-xs space-y-0.5">
                  <p className="font-bold text-flandi-dark">Quét mã QR bằng App Ngân Hàng bất kỳ</p>
                  <p className="font-black text-flandi-coral text-sm mt-1">
                    Số tiền: {formatVND(qrOrder.total)}
                  </p>
                  <p className="text-[11px] text-flandi-muted">
                    Nội dung CK: <strong className="text-flandi-dark">FLANDI {qrOrder.code}</strong>
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setQrOrder(null)}
                className="w-full py-2.5 rounded-xl bg-flandi-coral text-white font-black text-xs shadow-cute"
              >
                Đóng mã QR
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
