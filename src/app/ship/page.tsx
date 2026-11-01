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
  ChevronUp,
  ChevronsUpDown,
  User,
  ShoppingBag,
  Route,
  ArrowUpDown,
  Layers,
  Navigation2,
} from "lucide-react";
import { Order, OrderStatus, ShopSettings } from "@/lib/types";
import { useCustomerAuth } from "@/lib/customer-auth-context";
import { ROLE_META } from "@/lib/rbac";
import CustomerHeaderAuthButton from "@/components/CustomerHeaderAuthButton";
import CustomerAccountDrawer from "@/components/CustomerAccountDrawer";
import { copyToClipboardInstant } from "@/components/LiveChatWidget";

/**
 * Hàm trích xuất khu vực (Phường / Xã / Quận) từ chuỗi địa chỉ
 * Giúp shipper gom nhóm đơn theo tuyến đường hoặc địa bàn gần nhau
 */
function extractAddressZone(address?: string): string {
  if (!address || !address.trim()) return "Chưa có địa chỉ";
  const norm = address.trim();
  const lower = norm.toLowerCase();

  const knownZones = [
    { label: "Phú Cường", keys: ["phú cường", "phu cuong"] },
    { label: "Chánh Nghĩa", keys: ["chánh nghĩa", "chanh nghia"] },
    { label: "Phú Hòa", keys: ["phú hòa", "phu hoa"] },
    { label: "Hiệp Thành", keys: ["hiệp thành", "hiep thanh"] },
    { label: "Phú Lợi", keys: ["phú lợi", "phu loi"] },
    { label: "Định Hòa", keys: ["định hòa", "dinh hoa"] },
    { label: "Chánh Mỹ", keys: ["chánh mỹ", "chanh my"] },
    { label: "Phú Tân", keys: ["phú tân", "phu tan"] },
    { label: "Bến Nghé, Q1", keys: ["bến nghé", "ben nghe"] },
    { label: "Quận 1", keys: ["quận 1", "q1", "q.1"] },
    { label: "Bình Thạnh", keys: ["bình thạnh", "binh thanh"] },
    { label: "Thủ Đức", keys: ["thủ đức", "thu duc"] },
  ];

  for (const z of knownZones) {
    if (z.keys.some((k) => lower.includes(k))) {
      return z.label;
    }
  }

  // Tách theo dấu phẩy hoặc gạch nối
  const parts = norm.split(/[,–-]/).map((p) => p.trim()).filter(Boolean);
  if (parts.length >= 2) {
    return parts[parts.length - 2] || parts[parts.length - 1];
  }
  return parts[0] || "Khác";
}

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

  // View Mode: Thu gọn (Overview) vs Mở rộng toàn bộ (Detailed)
  const [isCompactView, setIsCompactView] = useState(true);
  const [expandedOrderIds, setExpandedOrderIds] = useState<Record<string, boolean>>({});

  // Chức năng gom chuyến: Danh sách ID các đơn được chọn vào chuyến giao
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);
  const [tripSequence, setTripSequence] = useState<string[]>([]); // Thứ tự chặng trong chuyến

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>("NEED_SHIP");
  const [paymentFilter, setPaymentFilter] = useState<"ALL" | "COD" | "PAID">("ALL");
  const [selectedZoneFilter, setSelectedZoneFilter] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  // Checklist kiểm đồ trong thùng hàng (lưu tạm trong session)
  const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>({});

  // Modal xem QR thu tiền của đơn cụ thể
  const [qrModalOrder, setQrModalOrder] = useState<Order | null>(null);

  // Trạng thái đang xử lý cập nhật đơn
  const [processingOrderId, setProcessingOrderId] = useState<string | null>(null);
  const [isBatchUpdating, setIsBatchUpdating] = useState(false);

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

  // Đồng bộ tripSequence khi selectedOrderIds thay đổi
  useEffect(() => {
    setTripSequence((prev) => {
      const next = prev.filter((id) => selectedOrderIds.includes(id));
      selectedOrderIds.forEach((id) => {
        if (!next.includes(id)) {
          next.push(id);
        }
      });
      return next;
    });
  }, [selectedOrderIds]);

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

  // Bắt đầu chuyến giao hàng loạt (cập nhật toàn bộ đơn đã chọn sang DELIVERING)
  const handleBatchStartTrip = async () => {
    if (selectedOrderIds.length === 0) return;
    setIsBatchUpdating(true);
    try {
      const promises = selectedOrderIds.map((id) =>
        fetch("/api/orders", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orderId: id, status: "DELIVERING" }),
        }).then((res) => res.json())
      );

      await Promise.all(promises);
      await fetchOrders(true);
      notify(`🛵 ĐÃ XUẤT PHÁT! Đã chuyển ${selectedOrderIds.length} đơn sang ĐANG ĐI GIAO.`);
    } catch (err: any) {
      notify("⚠️ Lỗi khi cập nhật hàng loạt chuyến giao!");
    } finally {
      setIsBatchUpdating(false);
    }
  };

  // Toggle chọn đơn vào chuyến giao
  const toggleSelectOrder = (orderId: string) => {
    setSelectedOrderIds((prev) =>
      prev.includes(orderId)
        ? prev.filter((id) => id !== orderId)
        : [...prev, orderId]
    );
  };

  // Toggle mở rộng chi tiết một đơn
  const toggleExpandOrder = (orderId: string) => {
    setExpandedOrderIds((prev) => ({
      ...prev,
      [orderId]: !prev[orderId],
    }));
  };

  // Mở rộng tất cả / Thu gọn tất cả
  const handleToggleExpandAll = (expand: boolean) => {
    setIsCompactView(!expand);
    if (!expand) {
      setExpandedOrderIds({});
    } else {
      const allExpanded: Record<string, boolean> = {};
      filteredOrders.forEach((o) => {
        allExpanded[o.id] = true;
      });
      setExpandedOrderIds(allExpanded);
    }
  };

  // Di chuyển thứ tự chặng trong chuyến giao (Lên / Xuống)
  const moveTripStop = (orderId: string, direction: "UP" | "DOWN") => {
    setTripSequence((prev) => {
      const idx = prev.indexOf(orderId);
      if (idx === -1) return prev;
      const targetIdx = direction === "UP" ? idx - 1 : idx + 1;
      if (targetIdx < 0 || targetIdx >= prev.length) return prev;
      const copy = [...prev];
      const temp = copy[idx];
      copy[idx] = copy[targetIdx];
      copy[targetIdx] = temp;
      return copy;
    });
  };

  // Tối ưu hoá thứ tự lộ trình (Routing Optimization Heuristic)
  const handleOptimizeRoute = () => {
    if (selectedOrderIds.length <= 1) {
      notify("💡 Vui lòng chọn từ 2 đơn trở lên để tối ưu lộ trình!");
      return;
    }

    const ordersMap = new Map(orders.map((o) => [o.id, o]));
    const selectedOrdersList = selectedOrderIds
      .map((id) => ordersMap.get(id))
      .filter(Boolean) as Order[];

    // Gom cụm theo khu vực và sắp xếp tuyến đường liên hoàn
    selectedOrdersList.sort((a, b) => {
      const zoneA = extractAddressZone(a.customerAddress);
      const zoneB = extractAddressZone(b.customerAddress);
      if (zoneA !== zoneB) {
        return zoneA.localeCompare(zoneB, "vi");
      }
      const addrA = (a.customerAddress || "").toLowerCase();
      const addrB = (b.customerAddress || "").toLowerCase();
      return addrA.localeCompare(addrB, "vi");
    });

    const newSeq = selectedOrdersList.map((o) => o.id);
    setTripSequence(newSeq);
    notify(`✨ Đã tự động tối ưu thứ tự ${newSeq.length} chặng theo tuyến đường liền kề!`);
  };

  // Danh sách các đơn trong chuyến giao đã được sắp xếp theo chặng
  const tripOrders = useMemo(() => {
    const ordersMap = new Map(orders.map((o) => [o.id, o]));
    return tripSequence
      .map((id) => ordersMap.get(id))
      .filter(Boolean) as Order[];
  }, [orders, tripSequence]);

  // Thống kê chuyến giao được chọn
  const tripStats = useMemo(() => {
    const count = tripOrders.length;
    const totalCakes = tripOrders.reduce(
      (sum, o) => sum + o.items.reduce((s, i) => s + i.quantity, 0),
      0
    );
    const totalCod = tripOrders.reduce(
      (sum, o) => (!o.isPaid ? sum + o.total : sum),
      0
    );
    return { count, totalCakes, totalCod };
  }, [tripOrders]);

  // Xây dựng Multi-Stop Google Maps Route URL
  const multiStopMapsUrl = useMemo(() => {
    if (tripOrders.length === 0) return "#";
    const shopAddr =
      settings?.address || "123/3 Nguyễn Hữu Cảnh, Thủ Dầu Một, Bình Dương";
    const origin = encodeURIComponent(shopAddr);

    const validStops = tripOrders
      .map((o) => o.customerAddress?.trim())
      .filter(Boolean) as string[];

    if (validStops.length === 0) return "#";

    if (validStops.length === 1) {
      return `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${encodeURIComponent(
        validStops[0]
      )}&travelmode=two_wheeler`;
    }

    const destination = encodeURIComponent(validStops[validStops.length - 1]);
    const waypoints = validStops
      .slice(0, validStops.length - 1)
      .map((s) => encodeURIComponent(s))
      .join("|");

    return `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}&waypoints=${waypoints}&travelmode=two_wheeler`;
  }, [tripOrders, settings]);

  // Sao chép lịch trình chuyến giao dạng text để gửi Zalo/ghi chú
  const handleCopyItinerary = () => {
    if (tripOrders.length === 0) return;
    const shopAddr =
      settings?.address || "123/3 Nguyễn Hữu Cảnh, Thủ Dầu Một, Bình Dương";
    const lines: string[] = [];
    lines.push(`🛵 LỘ TRÌNH GIAO HÀNG FLANDI (${tripOrders.length} ĐƠN)`);
    lines.push(`🏪 Xuất phát: ${shopAddr}`);
    lines.push("------------------------");
    tripOrders.forEach((o, idx) => {
      lines.push(
        `Chặng ${idx + 1}: #${o.code} - ${o.customerName} (${o.customerPhone})`
      );
      lines.push(`📍 ${o.customerAddress || "Chưa có địa chỉ"}`);
      lines.push(
        `💰 ${
          o.isPaid
            ? "ĐÃ THANH TOÁN (0đ thu hộ)"
            : `THU TIỀN MẶT COD: ${formatVND(o.total)}`
        }`
      );
      lines.push(
        `🍮 Món: ${o.items
          .map((i) => `${i.quantity}x ${i.productName}`)
          .join(", ")}`
      );
      if (o.note) lines.push(`📝 Ghi chú: ${o.note}`);
      lines.push("");
    });
    lines.push("------------------------");
    lines.push(`💵 TỔNG TIỀN MẶT COD CẦN THU VỀ: ${formatVND(tripStats.totalCod)}`);

    copyToClipboardInstant(lines.join("\n"));
    notify("📋 Đã copy lộ trình chuyến giao vào bộ nhớ tạm!");
  };

  // Gom cụm khu vực từ các đơn cần giao
  const zoneClusters = useMemo(() => {
    const clusterMap: Record<string, number> = {};
    const needShip = orders.filter(
      (o) =>
        o.status === "PENDING" ||
        o.status === "PREPARING" ||
        o.status === "DELIVERING"
    );

    needShip.forEach((o) => {
      const zone = extractAddressZone(o.customerAddress);
      clusterMap[zone] = (clusterMap[zone] || 0) + 1;
    });

    return Object.entries(clusterMap)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }, [orders]);

  // Lọc danh sách đơn hàng
  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      // 1. Trạng thái
      if (statusFilter === "NEED_SHIP") {
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

      // 2. Thanh toán
      if (paymentFilter === "COD") {
        if (order.isPaid || order.paymentMethod !== "COD") return false;
      } else if (paymentFilter === "PAID") {
        if (!order.isPaid) return false;
      }

      // 3. Khu vực
      if (selectedZoneFilter) {
        const orderZone = extractAddressZone(order.customerAddress);
        if (orderZone !== selectedZoneFilter) return false;
      }

      // 4. Tìm kiếm từ khoá
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchCode = order.code.toLowerCase().includes(q);
        const matchPhone = order.customerPhone.includes(q);
        const matchName = order.customerName.toLowerCase().includes(q);
        const matchAddress = (order.customerAddress || "")
          .toLowerCase()
          .includes(q);
        const matchItem = order.items.some(
          (i) =>
            i.productName.toLowerCase().includes(q) ||
            i.variantName.toLowerCase().includes(q)
        );
        if (
          !matchCode &&
          !matchPhone &&
          !matchName &&
          !matchAddress &&
          !matchItem
        ) {
          return false;
        }
      }

      return true;
    });
  }, [orders, statusFilter, paymentFilter, selectedZoneFilter, searchQuery]);

  // Thống kê đơn cần giao
  const stats = useMemo(() => {
    const needShipOrders = orders.filter(
      (o) =>
        o.status === "PENDING" ||
        o.status === "PREPARING" ||
        o.status === "DELIVERING"
    );

    const deliveringOrders = orders.filter((o) => o.status === "DELIVERING");

    const totalCodAmount = needShipOrders.reduce((sum, o) => {
      return !o.isPaid ? sum + o.total : sum;
    }, 0);

    let totalCakes = 0;
    const cakeBreakdown: Record<
      string,
      { name: string; variant: string; qty: number }
    > = {};

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

  // Chọn hoặc bỏ chọn toàn bộ đơn trong bộ lọc hiện tại
  const handleSelectAllFiltered = () => {
    const needShipFiltered = filteredOrders
      .filter((o) => o.status !== "COMPLETED" && o.status !== "CANCELLED")
      .map((o) => o.id);

    if (needShipFiltered.length === 0) return;

    const allSelected = needShipFiltered.every((id) =>
      selectedOrderIds.includes(id)
    );

    if (allSelected) {
      setSelectedOrderIds((prev) =>
        prev.filter((id) => !needShipFiltered.includes(id))
      );
    } else {
      setSelectedOrderIds((prev) => Array.from(new Set([...prev, ...needShipFiltered])));
    }
  };

  const toggleCheckItem = (key: string) => {
    setCheckedItems((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const buildMapsUrl = (address: string) => {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
      address
    )}`;
  };

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
              Khu vực này dành riêng cho nhân viên và chủ tiệm FLANDI để tổng hợp số lượng bánh, gom nhóm chuyến và tối ưu lộ trình giao hàng.
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
                👉 Vui lòng liên hệ Admin tiệm vào trang Quản trị để cấp quyền <strong>STAFF</strong>.
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
    <div className="min-h-screen bg-[#FDF8F7] text-flandi-dark flex flex-col pb-28">
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
                  ĐIỀU PHỐI & GIAO HÀNG
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
                Gom nhóm chuyến, tối ưu lộ trình & thu tiền COD
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
              href="/staff"
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white hover:bg-flandi-pink/40 text-flandi-dark border border-flandi-pink text-xs font-extrabold shadow-2xs"
            >
              <span>Staff</span>
            </Link>

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

        {/* TAB 1: LỘ TRÌNH ĐI GIAO HÀNG & GOM NHÓM */}
        {activeTab === "DELIVERY" && (
          <div className="space-y-3">
            {/* Zone Clusters Pill Row (Gom nhóm theo khu vực địa bàn) */}
            {zoneClusters.length > 0 && (
              <div className="bg-white p-3 rounded-2xl border border-flandi-pink shadow-2xs space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-extrabold text-flandi-muted flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-flandi-coral" />
                    <span>Gom cụm theo khu vực địa bàn:</span>
                  </span>
                  {selectedZoneFilter && (
                    <button
                      type="button"
                      onClick={() => setSelectedZoneFilter(null)}
                      className="text-flandi-coral font-bold hover:underline text-[11px] cursor-pointer"
                    >
                      Xem tất cả khu vực
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
                  <button
                    type="button"
                    onClick={() => setSelectedZoneFilter(null)}
                    className={`px-3 py-1 rounded-xl font-extrabold whitespace-nowrap transition cursor-pointer ${
                      selectedZoneFilter === null
                        ? "bg-flandi-coral text-white shadow-xs"
                        : "bg-flandi-bg text-flandi-dark hover:bg-flandi-pink/50"
                    }`}
                  >
                    Tất cả khu vực ({stats.needShipCount})
                  </button>

                  {zoneClusters.map((z, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() =>
                        setSelectedZoneFilter(
                          selectedZoneFilter === z.name ? null : z.name
                        )
                      }
                      className={`px-3 py-1 rounded-xl font-extrabold whitespace-nowrap transition flex items-center gap-1.5 cursor-pointer ${
                        selectedZoneFilter === z.name
                          ? "bg-flandi-coral text-white shadow-xs"
                          : "bg-flandi-bg text-flandi-dark hover:bg-flandi-pink/50"
                      }`}
                    >
                      <span>{z.name}</span>
                      <span
                        className={`text-[10px] px-1.5 py-0.2 rounded-full font-black ${
                          selectedZoneFilter === z.name
                            ? "bg-white text-flandi-coral"
                            : "bg-white text-flandi-muted border border-flandi-pink"
                        }`}
                      >
                        {z.count}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

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
                    className="w-5 h-5 rounded-full bg-gray-200 text-gray-600 flex items-center justify-center absolute right-2.5 top-2.5 text-xs hover:bg-gray-300 cursor-pointer"
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* View & Expand Controls Bar */}
              <div className="flex items-center justify-between gap-2 pt-2 border-t border-flandi-pink/70 flex-wrap text-xs">
                {/* Select All Checkbox */}
                <button
                  type="button"
                  onClick={handleSelectAllFiltered}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-flandi-bg hover:bg-flandi-pink/50 text-flandi-dark font-extrabold transition cursor-pointer"
                >
                  <CheckSquare className="w-3.5 h-3.5 text-flandi-coral" />
                  <span>
                    {filteredOrders.some(
                      (o) =>
                        selectedOrderIds.includes(o.id) &&
                        o.status !== "COMPLETED" &&
                        o.status !== "CANCELLED"
                    )
                      ? "Bỏ chọn các đơn này"
                      : `Chọn tất cả (${filteredOrders.filter((o) => o.status !== "COMPLETED" && o.status !== "CANCELLED").length} đơn)`}
                  </span>
                </button>

                {/* Expand / Collapse Toggle Buttons */}
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleToggleExpandAll(false)}
                    className={`px-2.5 py-1 rounded-lg font-extrabold transition flex items-center gap-1 cursor-pointer ${
                      isCompactView
                        ? "bg-flandi-coral/15 text-flandi-coral border border-flandi-salmon"
                        : "bg-flandi-bg text-flandi-muted hover:text-flandi-dark"
                    }`}
                    title="Chế độ thu gọn danh sách (Tổng quan)"
                  >
                    <ChevronUp className="w-3.5 h-3.5" />
                    <span>Thu gọn</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleToggleExpandAll(true)}
                    className={`px-2.5 py-1 rounded-lg font-extrabold transition flex items-center gap-1 cursor-pointer ${
                      !isCompactView
                        ? "bg-flandi-coral/15 text-flandi-coral border border-flandi-salmon"
                        : "bg-flandi-bg text-flandi-muted hover:text-flandi-dark"
                    }`}
                    title="Mở rộng chi tiết tất cả đơn"
                  >
                    <ChevronDown className="w-3.5 h-3.5" />
                    <span>Mở rộng</span>
                  </button>
                </div>
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
                    setSelectedZoneFilter(null);
                    setSearchQuery("");
                  }}
                  className="px-4 py-2 rounded-xl bg-flandi-bg hover:bg-flandi-pink/50 text-flandi-coral text-xs font-extrabold border border-flandi-pink transition cursor-pointer"
                >
                  Xoá bộ lọc tìm kiếm
                </button>
              </div>
            ) : (
              <div className="space-y-2.5">
                {filteredOrders.map((order) => {
                  const isDelivering = order.status === "DELIVERING";
                  const isCompleted = order.status === "COMPLETED";
                  const isCancelled = order.status === "CANCELLED";
                  const isSelected = selectedOrderIds.includes(order.id);
                  const isExpanded = !isCompactView || !!expandedOrderIds[order.id];

                  // Vị trí chặng trong chuyến giao (nếu được chọn)
                  const stopIndex = tripSequence.indexOf(order.id);
                  const stopNumber = stopIndex !== -1 ? stopIndex + 1 : null;
                  const zoneName = extractAddressZone(order.customerAddress);

                  return (
                    <article
                      key={order.id}
                      className={`bg-white rounded-2xl sm:rounded-3xl border transition shadow-2xs overflow-hidden ${
                        isSelected
                          ? "border-flandi-coral ring-2 ring-flandi-salmon/40 bg-[#FFFDFD]"
                          : isDelivering
                          ? "border-sky-300 ring-2 ring-sky-200"
                          : isCompleted
                          ? "border-gray-200 opacity-75"
                          : "border-flandi-pink hover:border-flandi-coral/60"
                      }`}
                    >
                      {/* COMPACT ROW / CARD HEADER */}
                      <div className="p-3 sm:p-3.5 flex items-center justify-between gap-2.5 flex-wrap">
                        {/* Left: Checkbox + Stop Number + Order Code */}
                        <div className="flex items-center gap-2 min-w-0">
                          {/* Checkbox gom chuyến */}
                          {!isCompleted && !isCancelled && (
                            <button
                              type="button"
                              onClick={() => toggleSelectOrder(order.id)}
                              className="text-flandi-coral hover:scale-110 transition shrink-0 cursor-pointer p-0.5"
                              title={isSelected ? "Bỏ chọn khỏi chuyến" : "Chọn vào chuyến giao này"}
                            >
                              {isSelected ? (
                                <CheckSquare className="w-5 h-5 text-flandi-coral fill-flandi-coral/20" />
                              ) : (
                                <Square className="w-5 h-5 text-flandi-muted" />
                              )}
                            </button>
                          )}

                          {/* Stop Number Badge if selected */}
                          {stopNumber !== null && (
                            <span className="w-6 h-6 rounded-full bg-flandi-coral text-white text-xs font-black flex items-center justify-center shrink-0 shadow-xs">
                              {stopNumber}
                            </span>
                          )}

                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-mono font-black text-sm sm:text-base text-flandi-dark">
                                #{order.code}
                              </span>
                              <span className="text-[11px] font-bold text-flandi-muted">
                                {new Date(order.createdAt).toLocaleTimeString("vi-VN", {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </span>
                              {zoneName && (
                                <span className="px-2 py-0.5 rounded-full bg-flandi-cream text-flandi-coral text-[10px] font-extrabold border border-flandi-pink">
                                  {zoneName}
                                </span>
                              )}
                            </div>

                            {/* Customer snippet in compact view */}
                            <p className="text-xs font-bold text-flandi-dark/90 truncate flex items-center gap-1 mt-0.5">
                              <span className="font-extrabold">{order.customerName}</span>
                              <span className="text-flandi-muted">•</span>
                              <a
                                href={`tel:${order.customerPhone}`}
                                className="font-mono text-flandi-coral hover:underline"
                                onClick={(e) => e.stopPropagation()}
                              >
                                {order.customerPhone}
                              </a>
                            </p>
                          </div>
                        </div>

                        {/* Right: Payment Callout + Status + Quick Expand Chevron */}
                        <div className="flex items-center gap-2 shrink-0">
                          {/* COD Amount Pill */}
                          {order.isPaid ? (
                            <span className="px-2 py-1 rounded-lg bg-emerald-100 text-emerald-800 text-[11px] font-black border border-emerald-300">
                              ĐÃ CK 0đ
                            </span>
                          ) : (
                            <span className="px-2.5 py-1 rounded-xl bg-gradient-to-r from-rose-500 to-flandi-coral text-white text-xs font-black shadow-2xs tabular-nums">
                              Thu COD: {formatVND(order.total)}
                            </span>
                          )}

                          {/* Status Badge */}
                          {isDelivering ? (
                            <span className="px-2 py-0.5 rounded-full bg-sky-100 text-sky-800 border border-sky-300 text-[10px] font-black flex items-center gap-1 animate-pulse">
                              <Bike className="w-3 h-3" />
                              <span className="hidden sm:inline">ĐANG GIAO</span>
                            </span>
                          ) : isCompleted ? (
                            <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 text-[10px] font-extrabold">
                              Xong
                            </span>
                          ) : isCancelled ? (
                            <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 border border-rose-300 text-[10px] font-extrabold">
                              Huỷ
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300 text-[10px] font-extrabold">
                              Chờ
                            </span>
                          )}

                          {/* Reordering Controls in Trip */}
                          {stopNumber !== null && tripOrders.length > 1 && (
                            <div className="flex items-center gap-0.5 bg-flandi-bg rounded-lg border border-flandi-pink p-0.5">
                              <button
                                type="button"
                                disabled={stopIndex === 0}
                                onClick={() => moveTripStop(order.id, "UP")}
                                className="w-5 h-5 rounded hover:bg-white text-flandi-dark disabled:opacity-30 flex items-center justify-center text-xs font-bold cursor-pointer"
                                title="Điểm này giao trước (đẩy lên)"
                              >
                                ▲
                              </button>
                              <button
                                type="button"
                                disabled={stopIndex === tripOrders.length - 1}
                                onClick={() => moveTripStop(order.id, "DOWN")}
                                className="w-5 h-5 rounded hover:bg-white text-flandi-dark disabled:opacity-30 flex items-center justify-center text-xs font-bold cursor-pointer"
                                title="Điểm này giao sau (đẩy xuống)"
                              >
                                ▼
                              </button>
                            </div>
                          )}

                          {/* Quick 1-Tap Round Icon Actions (Call, Maps, Zalo, QR) */}
                          <div className="flex items-center gap-1">
                            <a
                              href={`tel:${order.customerPhone}`}
                              className="w-8 h-8 rounded-full bg-rose-50 hover:bg-rose-100 text-flandi-coral border border-flandi-salmon flex items-center justify-center transition active:scale-95 shadow-2xs"
                              title={`Gọi cho ${order.customerName}`}
                            >
                              <Phone className="w-3.5 h-3.5" />
                            </a>

                            <a
                              href={buildMapsUrl(order.customerAddress || "")}
                              target="_blank"
                              rel="noreferrer"
                              className="w-8 h-8 rounded-full bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 flex items-center justify-center transition active:scale-95 shadow-2xs"
                              title="Chỉ đường Google Maps"
                            >
                              <Navigation className="w-3.5 h-3.5" />
                            </a>

                            <a
                              href={buildZaloUrl(order.customerPhone)}
                              target="_blank"
                              rel="noreferrer"
                              className="w-8 h-8 rounded-full bg-[#0068FF]/10 hover:bg-[#0068FF]/20 text-[#0068FF] border border-[#0068FF]/30 flex items-center justify-center transition active:scale-95 shadow-2xs"
                              title="Chat Zalo"
                            >
                              <MessageCircle className="w-3.5 h-3.5" />
                            </a>

                            <button
                              type="button"
                              onClick={() => setQrModalOrder(order)}
                              className="w-8 h-8 rounded-full bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 flex items-center justify-center transition active:scale-95 shadow-2xs cursor-pointer"
                              title="Mã QR TPBank thu tiền"
                            >
                              <QrCode className="w-3.5 h-3.5" />
                            </button>

                            {/* Expand / Collapse Button */}
                            <button
                              type="button"
                              onClick={() => toggleExpandOrder(order.id)}
                              className={`w-8 h-8 rounded-full flex items-center justify-center transition cursor-pointer ${
                                isExpanded
                                  ? "bg-flandi-dark text-white"
                                  : "bg-flandi-bg hover:bg-flandi-pink/50 text-flandi-muted"
                              }`}
                              title={isExpanded ? "Thu gọn chi tiết" : "Xem chi tiết bánh & địa chỉ"}
                            >
                              {isExpanded ? (
                                <ChevronUp className="w-4 h-4" />
                              ) : (
                                <ChevronDown className="w-4 h-4" />
                              )}
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Address snippet in Compact view (if not expanded) */}
                      {!isExpanded && (
                        <div className="px-3 pb-2.5 pt-0.5 flex items-center justify-between text-xs text-flandi-muted border-t border-dashed border-flandi-pink/50">
                          <p className="truncate flex-1 mr-2 font-medium">
                            📍 {order.customerAddress || "Khách ghé tiệm lấy"}
                          </p>
                          <span className="font-extrabold text-flandi-dark shrink-0">
                            {order.items.reduce((s, i) => s + i.quantity, 0)} bánh
                          </span>
                        </div>
                      )}

                      {/* EXPANDED DETAILED DRAWER */}
                      {isExpanded && (
                        <div className="p-3.5 sm:p-4 border-t border-flandi-pink/70 bg-[#FFFCFC] space-y-3 animate-in fade-in duration-150">
                          {/* Full Address & Note */}
                          <div className="space-y-1.5">
                            <div className="flex items-start gap-2 bg-[#FAF5F4] p-3 rounded-2xl border border-flandi-pink">
                              <MapPin className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                              <div className="text-xs sm:text-sm font-bold text-flandi-dark min-w-0 flex-1">
                                <p className="leading-snug">
                                  {order.customerAddress || "Khách ghé tiệm lấy bánh"}
                                </p>
                                {order.note && (
                                  <p className="text-xs text-amber-800 font-extrabold mt-1.5 bg-amber-100/70 p-2 rounded-xl">
                                    📝 Ghi chú: {order.note}
                                  </p>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Line items full breakdown */}
                          <div className="space-y-1.5">
                            <p className="text-[11px] font-bold text-flandi-muted uppercase tracking-wider">
                              Chi tiết món cần giao ({order.items.reduce((s, i) => s + i.quantity, 0)} phần):
                            </p>
                            <div className="flex flex-wrap gap-1.5">
                              {order.items.map((item, idx) => (
                                <span
                                  key={idx}
                                  className="px-2.5 py-1.5 rounded-xl bg-white border border-flandi-pink text-xs font-black text-flandi-dark shadow-2xs"
                                >
                                  {item.quantity}x {item.productName}{" "}
                                  <span className="font-normal text-flandi-muted text-[11px]">
                                    ({item.variantName})
                                  </span>
                                </span>
                              ))}
                            </div>
                          </div>

                          {/* Large State Transition Buttons */}
                          {!isCompleted && !isCancelled && (
                            <div className="pt-2 flex items-center gap-2 border-t border-flandi-pink/60">
                              {!isDelivering ? (
                                <button
                                  type="button"
                                  disabled={processingOrderId === order.id}
                                  onClick={() =>
                                    handleUpdateStatus(order.id, "DELIVERING")
                                  }
                                  className="flex-1 py-2.5 px-3 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-black text-xs sm:text-sm flex items-center justify-center gap-1.5 shadow-cute transition active:scale-95 cursor-pointer disabled:opacity-50"
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
                                  className="flex-1 py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs sm:text-sm flex items-center justify-center gap-1.5 shadow-cute transition active:scale-95 cursor-pointer disabled:opacity-50"
                                >
                                  <CheckCircle2 className="w-4 h-4" />
                                  <span>
                                    {processingOrderId === order.id
                                      ? "Đang lưu..."
                                      : "✅ Đã giao bánh & Thu đủ tiền"}
                                  </span>
                                </button>
                              )}

                              {/* Huỷ đơn */}
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
                                className="px-3 py-2.5 rounded-xl bg-gray-100 hover:bg-red-50 text-gray-600 hover:text-red-600 font-extrabold text-xs transition cursor-pointer"
                                title="Huỷ đơn này"
                              >
                                Huỷ
                              </button>
                            </div>
                          )}
                        </div>
                      )}
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
                className="px-3 py-1.5 rounded-xl bg-flandi-bg hover:bg-flandi-pink/40 text-flandi-coral text-xs font-extrabold border border-flandi-pink transition cursor-pointer"
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

      {/* STICKY FLOATING TRIP PLANNER BAR (XUẤT HIỆN KHI CHỌN GOM CHUYẾN) */}
      {selectedOrderIds.length > 0 && activeTab === "DELIVERY" && (
        <aside className="fixed bottom-3 inset-x-3 sm:inset-x-6 z-40 max-w-4xl mx-auto bg-flandi-dark/95 backdrop-blur-md text-white p-3 sm:p-4 rounded-3xl border border-white/20 shadow-2xl animate-in slide-in-from-bottom-5">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            {/* Trip Summary Stats */}
            <div className="flex items-center gap-3 sm:gap-4 w-full sm:w-auto justify-between sm:justify-start">
              <div className="flex items-center gap-2">
                <span className="w-7 h-7 rounded-xl bg-flandi-coral text-white font-black text-sm flex items-center justify-center shadow-xs">
                  {tripStats.count}
                </span>
                <div>
                  <p className="text-xs font-black text-white leading-tight">
                    Chuyến giao ({tripStats.count} đơn)
                  </p>
                  <p className="text-[11px] font-bold text-white/70">
                    {tripStats.totalCakes} bánh • COD: {formatVND(tripStats.totalCod)}
                  </p>
                </div>
              </div>

              {/* Reset selection */}
              <button
                type="button"
                onClick={() => setSelectedOrderIds([])}
                className="text-xs text-white/60 hover:text-white underline cursor-pointer"
              >
                Bỏ chọn
              </button>
            </div>

            {/* Action Buttons for Trip */}
            <div className="flex items-center gap-2 w-full sm:w-auto justify-end flex-wrap">
              {/* Tối ưu thứ tự chặng */}
              <button
                type="button"
                onClick={handleOptimizeRoute}
                className="py-2 px-3 rounded-xl bg-white/10 hover:bg-white/20 text-white font-extrabold text-xs flex items-center gap-1.5 transition active:scale-95 cursor-pointer border border-white/15"
                title="Tối ưu thứ tự giao theo tuyến đường gần nhất"
              >
                <Route className="w-3.5 h-3.5 text-flandi-salmon" />
                <span>Tối ưu lộ trình</span>
              </button>

              {/* Copy lộ trình */}
              <button
                type="button"
                onClick={handleCopyItinerary}
                className="py-2 px-3 rounded-xl bg-white/10 hover:bg-white/20 text-white font-extrabold text-xs flex items-center gap-1.5 transition active:scale-95 cursor-pointer border border-white/15"
                title="Sao chép danh sách chặng giao để gửi Zalo"
              >
                <Copy className="w-3.5 h-3.5 text-sky-400" />
                <span>Copy</span>
              </button>

              {/* Mở Multi-Stop Google Maps */}
              <a
                href={multiStopMapsUrl}
                target="_blank"
                rel="noreferrer"
                className="py-2 px-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-black text-xs flex items-center gap-1.5 shadow-xs transition active:scale-95 cursor-pointer"
                title="Mở bản đồ điều hướng liên hoàn qua tất cả các điểm"
              >
                <Navigation2 className="w-3.5 h-3.5" />
                <span>Bản đồ liên hoàn</span>
              </a>

              {/* Xuất phát chuyến (Batch Update to DELIVERING) */}
              <button
                type="button"
                disabled={isBatchUpdating}
                onClick={handleBatchStartTrip}
                className="py-2 px-3.5 rounded-xl bg-gradient-to-r from-flandi-coral to-flandi-salmon hover:opacity-95 text-white font-black text-xs flex items-center gap-1.5 shadow-cute transition active:scale-95 cursor-pointer disabled:opacity-50"
              >
                <Bike className="w-4 h-4" />
                <span>
                  {isBatchUpdating ? "Đang lưu..." : `Bắt đầu đi (${tripStats.count})`}
                </span>
              </button>
            </div>
          </div>
        </aside>
      )}

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
                className="py-2 px-3 rounded-xl bg-white border border-flandi-pink text-xs font-bold text-flandi-dark hover:bg-flandi-bg flex items-center justify-center gap-1.5 cursor-pointer"
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
                className="py-2 px-3 rounded-xl bg-white border border-flandi-pink text-xs font-bold text-flandi-dark hover:bg-flandi-bg flex items-center justify-center gap-1.5 cursor-pointer"
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
