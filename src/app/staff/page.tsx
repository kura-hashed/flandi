"use client";

import React, { useEffect, useState, useMemo, useCallback } from "react";
import Link from "next/link";
import {
  ShoppingBag,
  Store,
  Bike,
  Plus,
  Minus,
  Trash2,
  Search,
  ArrowLeft,
  RefreshCw,
  Edit3,
  Save,
  X,
  QrCode,
  Phone,
  MapPin,
  Clock,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  ChevronDown,
  ChevronUp,
  ChevronsUpDown,
  User,
  Navigation,
  MessageCircle,
  Copy,
  Check,
  Receipt,
  FileText,
  DollarSign,
  Layers,
  Filter,
  Lock,
  ArrowRight,
  ExternalLink,
} from "lucide-react";
import {
  Product,
  ProductVariant,
  Order,
  OrderItem,
  OrderStatus,
  OrderSource,
  PaymentMethod,
  ShopSettings,
} from "@/lib/types";
import { useCustomerAuth } from "@/lib/customer-auth-context";
import { ROLE_META } from "@/lib/rbac";
import CustomerHeaderAuthButton from "@/components/CustomerHeaderAuthButton";
import CustomerAccountDrawer from "@/components/CustomerAccountDrawer";

// Trích xuất khu vực địa bàn từ địa chỉ
function extractAddressZone(addr?: string): string {
  if (!addr || !addr.trim()) return "Chưa có địa chỉ";
  const clean = addr.replace(/\s+/g, " ").trim();
  const lower = clean.toLowerCase();

  const knownZones = [
    { key: "phú cường", label: "Phú Cường" },
    { key: "phú hòa", label: "Phú Hòa" },
    { key: "phú lợi", label: "Phú Lợi" },
    { key: "phú thọ", label: "Phú Thọ" },
    { key: "phú tân", label: "Phú Tân" },
    { key: "phú mỹ", label: "Phú Mỹ" },
    { key: "chánh nghĩa", label: "Chánh Nghĩa" },
    { key: "hiệp thành", label: "Hiệp Thành" },
    { key: "định hòa", label: "Định Hòa" },
    { key: "tương bình hiệp", label: "Tương Bình Hiệp" },
    { key: "tân an", label: "Tân An" },
    { key: "chánh mỹ", label: "Chánh Mỹ" },
    { key: "hòa phú", label: "Hòa Phú" },
    { key: "thuận giao", label: "Thuận Giao" },
    { key: "an phú", label: "An Phú" },
    { key: "bình chuẩn", label: "Bình Chuẩn" },
    { key: "lái thiêu", label: "Lái Thiêu" },
    { key: "dĩ an", label: "Dĩ An" },
    { key: "bình thạnh", label: "Bình Thạnh" },
    { key: "gò vấp", label: "Gò Vấp" },
    { key: "thủ đức", label: "Thủ Đức" },
    { key: "quận 1", label: "Quận 1" },
    { key: "quận 3", label: "Quận 3" },
  ];

  for (const zone of knownZones) {
    if (lower.includes(zone.key)) return zone.label;
  }

  const pMatch = clean.match(/(?:phường|p\.|xã|thị trấn|quận|q\.)\s*([a-zA-Z0-9À-ỹ\s]+?)(?:,|$)/i);
  if (pMatch && pMatch[1]) {
    const raw = pMatch[1].trim();
    return raw.length > 18 ? raw.slice(0, 18) + "..." : raw;
  }

  const parts = clean.split(",").map((s) => s.trim()).filter(Boolean);
  if (parts.length >= 2) {
    const candidate = parts[parts.length - 2];
    return candidate.length > 20 ? candidate.slice(0, 20) + "..." : candidate;
  }

  return clean.length > 22 ? clean.slice(0, 22) + "..." : clean;
}

const ORDER_STATUS_CONFIG: Record<
  OrderStatus,
  { label: string; badgeClass: string; borderClass: string; nextStatus?: OrderStatus; nextLabel?: string }
> = {
  PENDING: {
    label: "Chờ xác nhận",
    badgeClass: "bg-amber-100 text-amber-800 border-amber-300",
    borderClass: "border-amber-300",
    nextStatus: "PREPARING",
    nextLabel: "Nhận đơn & Làm bánh",
  },
  PREPARING: {
    label: "Đang làm bánh",
    badgeClass: "bg-orange-100 text-orange-800 border-orange-300",
    borderClass: "border-orange-300",
    nextStatus: "DELIVERING",
    nextLabel: "Chuyển đi giao",
  },
  DELIVERING: {
    label: "Đang giao hàng",
    badgeClass: "bg-sky-100 text-sky-800 border-sky-300",
    borderClass: "border-sky-300",
    nextStatus: "COMPLETED",
    nextLabel: "Hoàn thành đơn",
  },
  COMPLETED: {
    label: "Hoàn thành",
    badgeClass: "bg-emerald-100 text-emerald-800 border-emerald-300",
    borderClass: "border-emerald-300",
  },
  CANCELLED: {
    label: "Đã huỷ",
    badgeClass: "bg-zinc-100 text-zinc-500 border-zinc-200 line-through",
    borderClass: "border-zinc-200",
  },
};

interface CartItemDraft {
  product: Product;
  variant?: ProductVariant;
  quantity: number;
}

export default function StaffPortalPage() {
  const { user, role, can, loading: authLoading, triggerGoogleSignIn } = useCustomerAuth();
  const isAuthorized = role === "staff" || role === "admin" || can("orders:manage") || can("orders:create");

  // Tab State: "CREATE" (Lên đơn giùm khách) | "MANAGE" (Quản lý đơn hàng)
  const [activeTab, setActiveTab] = useState<"CREATE" | "MANAGE">("CREATE");

  // Main Data
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [settings, setSettings] = useState<ShopSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<string | null>(null);

  // -------------------------
  // TAB 1: LÊN ĐƠN DRAFT STATE
  // -------------------------
  const [orderSource, setOrderSource] = useState<OrderSource>("ZALO");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");
  const [deliveryTime, setDeliveryTime] = useState("");
  const [orderNote, setOrderNote] = useState("");
  const [cart, setCart] = useState<CartItemDraft[]>([]);
  const [customShippingFee, setCustomShippingFee] = useState<number>(0);
  const [customDiscount, setCustomDiscount] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("COD");
  const [isPaidDraft, setIsPaidDraft] = useState(false);
  const [menuSearch, setMenuSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");
  const [isSubmittingOrder, setIsSubmittingOrder] = useState(false);
  const [lastCreatedOrder, setLastCreatedOrder] = useState<Order | null>(null);

  // -------------------------
  // TAB 2: QUẢN LÝ ĐƠN STATE
  // -------------------------
  const [manageSearch, setManageSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [zoneFilter, setZoneFilter] = useState<string>("ALL");
  const [isCompactMode, setIsCompactMode] = useState(true);
  const [expandedOrderIds, setExpandedOrderIds] = useState<Set<string>>(new Set());

  // Modal Chỉnh Sửa Đơn Hàng (Edit Order Modal)
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [editCustomerName, setEditCustomerName] = useState("");
  const [editCustomerPhone, setEditCustomerPhone] = useState("");
  const [editCustomerAddress, setEditCustomerAddress] = useState("");
  const [editDeliveryTime, setEditDeliveryTime] = useState("");
  const [editNote, setEditNote] = useState("");
  const [editShippingFee, setEditShippingFee] = useState<number>(0);
  const [editDiscount, setEditDiscount] = useState<number>(0);
  const [editPaymentMethod, setEditPaymentMethod] = useState<PaymentMethod>("COD");
  const [editIsPaid, setEditIsPaid] = useState(false);
  const [editStatus, setEditStatus] = useState<OrderStatus>("PENDING");
  const [editItems, setEditItems] = useState<OrderItem[]>([]);
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // Modal QR Code thanh toán nhanh
  const [qrModalOrder, setQrModalOrder] = useState<Order | null>(null);

  const notify = (msg: string) => {
    setToast(msg);
    setTimeout(() => {
      setToast((prev) => (prev === msg ? null : prev));
    }, 3200);
  };

  const formatVND = (n: number) =>
    new Intl.NumberFormat("vi-VN").format(Math.round(n || 0)) + "đ";

  // Fetch initial data
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/store", { cache: "no-store" });
      const data = await res.json();
      setProducts((data.products || []).filter((p: Product) => p.isActive !== false));
      setOrders(data.orders || []);
      setSettings(data.settings || null);
    } catch (err) {
      console.error("Failed to fetch staff data:", err);
      notify("❌ Không thể nạp dữ liệu tiệm");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!authLoading && isAuthorized) {
      fetchData();
    }
  }, [authLoading, isAuthorized, fetchData]);

  // Danh mục sản phẩm
  const categories = useMemo(() => {
    const set = new Set<string>();
    products.forEach((p) => {
      if (p.category) set.add(p.category);
    });
    return ["ALL", ...Array.from(set)];
  }, [products]);

  // Lọc sản phẩm ở Menu lên đơn
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      if (selectedCategory !== "ALL" && p.category !== selectedCategory) return false;
      if (menuSearch.trim()) {
        const query = menuSearch.toLowerCase();
        return p.name.toLowerCase().includes(query) || (p.subtitle || "").toLowerCase().includes(query);
      }
      return true;
    });
  }, [products, selectedCategory, menuSearch]);

  // Thêm món vào giỏ lên đơn
  const addToCart = (product: Product, variant?: ProductVariant, quantity = 1) => {
    const requiredStock = (variant?.stockDeduction || 1) * quantity;
    if (product.stock < requiredStock) {
      notify(`⚠️ Món "${product.name}" chỉ còn ${product.stock} ${product.stockUnit}!`);
      return;
    }

    setCart((prev) => {
      const idx = prev.findIndex(
        (it) => it.product.id === product.id && it.variant?.id === variant?.id
      );
      if (idx > -1) {
        const next = [...prev];
        next[idx] = {
          ...next[idx],
          quantity: next[idx].quantity + quantity,
        };
        return next;
      }
      return [...prev, { product, variant, quantity }];
    });
    notify(` Đã thêm ${quantity} x ${product.name}`);
  };

  const updateCartQty = (idx: number, delta: number) => {
    setCart((prev) => {
      const next = [...prev];
      const newQty = next[idx].quantity + delta;
      if (newQty <= 0) {
        next.splice(idx, 1);
      } else {
        next[idx] = { ...next[idx], quantity: newQty };
      }
      return next;
    });
  };

  // Tính toán giỏ hàng Tab 1
  const cartSubtotal = useMemo(() => {
    return cart.reduce((sum, it) => {
      const price = it.variant?.price ?? it.product.price;
      return sum + price * it.quantity;
    }, 0);
  }, [cart]);

  const cartTotalBanh = useMemo(() => {
    return cart.reduce((sum, it) => {
      const mult = it.variant?.stockDeduction || 1;
      return sum + mult * it.quantity;
    }, 0);
  }, [cart]);

  const grandTotal = useMemo(() => {
    return Math.max(0, cartSubtotal - customDiscount + customShippingFee);
  }, [cartSubtotal, customDiscount, customShippingFee]);

  // Xử lý tạo đơn hàng giùm khách
  const handleCreateOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cart.length === 0) {
      notify("⚠️ Vui lòng chọn ít nhất 1 món bánh vào đơn!");
      return;
    }
    if (!customerName.trim()) {
      notify("⚠️ Vui lòng nhập tên khách hàng");
      return;
    }
    if (!customerPhone.trim() && orderSource !== "POS") {
      notify("⚠️ Vui lòng nhập số điện thoại nhận bánh");
      return;
    }

    setIsSubmittingOrder(true);
    try {
      const itemsPayload: OrderItem[] = cart.map((it) => {
        const unitPrice = it.variant?.price ?? it.product.price;
        return {
          productId: it.product.id,
          productName: it.product.name,
          variantId: it.variant?.id,
          variantName: it.variant?.name || it.product.unit || "cái",
          quantity: it.quantity,
          unitPrice,
          subtotal: unitPrice * it.quantity,
          stockDeductionPerItem: it.variant?.stockDeduction || 1,
        };
      });

      const payload = {
        source: orderSource,
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim() || "0900000000",
        customerAddress: customerAddress.trim() || undefined,
        deliveryTime: deliveryTime.trim() || undefined,
        note: orderNote.trim() || undefined,
        items: itemsPayload,
        shippingFee: customShippingFee,
        discount: customDiscount,
        paymentMethod,
        isPaid: isPaidDraft,
        createdById: user?.id,
        createdByEmail: user?.email,
        createdByRole: role,
      };

      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Không thể tạo đơn hàng");
      }

      const createdOrder: Order = data.order;
      setLastCreatedOrder(createdOrder);
      setOrders((prev) => [createdOrder, ...prev]);

      // Reset form
      setCart([]);
      setCustomerName("");
      setCustomerPhone("");
      setCustomerAddress("");
      setDeliveryTime("");
      setOrderNote("");
      setCustomDiscount(0);
      setCustomShippingFee(0);
      setIsPaidDraft(false);

      notify(`🎉 Đã lên đơn thành công #${createdOrder.code}!`);
    } catch (err: any) {
      notify(`❌ Lỗi tạo đơn: ${err.message || String(err)}`);
    } finally {
      setIsSubmittingOrder(false);
    }
  };

  // -------------------------
  // TAB 2: QUẢN LÝ ĐƠN HÀNG
  // -------------------------
  // Danh sách khu vực cho bộ lọc
  const zonesList = useMemo(() => {
    const set = new Set<string>();
    orders.forEach((o) => {
      const z = extractAddressZone(o.customerAddress);
      if (z && z !== "Chưa có địa chỉ") set.add(z);
    });
    return ["ALL", ...Array.from(set)];
  }, [orders]);

  // Lọc đơn hàng
  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      // Lọc trạng thái
      if (statusFilter !== "ALL" && order.status !== statusFilter) return false;

      // Lọc khu vực
      if (zoneFilter !== "ALL") {
        const z = extractAddressZone(order.customerAddress);
        if (z !== zoneFilter) return false;
      }

      // Tìm kiếm
      if (manageSearch.trim()) {
        const q = manageSearch.toLowerCase();
        const codeMatch = order.code.toLowerCase().includes(q);
        const nameMatch = order.customerName.toLowerCase().includes(q);
        const phoneMatch = order.customerPhone.includes(q);
        const addrMatch = (order.customerAddress || "").toLowerCase().includes(q);
        const noteMatch = (order.note || "").toLowerCase().includes(q);
        return codeMatch || nameMatch || phoneMatch || addrMatch || noteMatch;
      }

      return true;
    });
  }, [orders, statusFilter, zoneFilter, manageSearch]);

  // Thống kê nhanh
  const stats = useMemo(() => {
    const pending = orders.filter((o) => o.status === "PENDING").length;
    const preparing = orders.filter((o) => o.status === "PREPARING").length;
    const delivering = orders.filter((o) => o.status === "DELIVERING").length;
    const completed = orders.filter((o) => o.status === "COMPLETED").length;
    const totalRevenue = orders
      .filter((o) => o.status !== "CANCELLED")
      .reduce((s, o) => s + (o.total || 0), 0);
    return { pending, preparing, delivering, completed, totalRevenue, totalCount: orders.length };
  }, [orders]);

  // Toggle expand 1 đơn
  const toggleExpand = (id: string) => {
    setExpandedOrderIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Toggle expand tất cả
  const toggleExpandAll = () => {
    if (expandedOrderIds.size === filteredOrders.length) {
      setExpandedOrderIds(new Set());
    } else {
      setExpandedOrderIds(new Set(filteredOrders.map((o) => o.id)));
    }
  };

  // Đổi trạng thái nhanh 1 nốt nhạc
  const handleQuickStatusChange = async (order: Order, nextStatus: OrderStatus) => {
    try {
      const res = await fetch("/api/orders", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: order.id,
          status: nextStatus,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Không thể cập nhật trạng thái");

      setOrders((prev) =>
        prev.map((o) => (o.id === order.id ? { ...o, status: nextStatus } : o))
      );
      notify(` Đơn #${order.code} -> ${ORDER_STATUS_CONFIG[nextStatus].label}`);
    } catch (err: any) {
      notify(`❌ ${err.message || String(err)}`);
    }
  };

  // Mở modal chỉnh sửa chi tiết đơn hàng
  const handleOpenEditOrder = (order: Order) => {
    setEditingOrder(order);
    setEditCustomerName(order.customerName || "");
    setEditCustomerPhone(order.customerPhone || "");
    setEditCustomerAddress(order.customerAddress || "");
    setEditDeliveryTime(order.deliveryTime || "");
    setEditNote(order.note || "");
    setEditShippingFee(order.shippingFee || 0);
    setEditDiscount(order.discount || 0);
    setEditPaymentMethod(order.paymentMethod || "COD");
    setEditIsPaid(Boolean(order.isPaid));
    setEditStatus(order.status || "PENDING");
    setEditItems(JSON.parse(JSON.stringify(order.items || [])));
  };

  // Thay đổi số lượng món trong modal chỉnh sửa
  const updateEditItemQty = (idx: number, delta: number) => {
    setEditItems((prev) => {
      const next = [...prev];
      const newQty = next[idx].quantity + delta;
      if (newQty <= 0) {
        next.splice(idx, 1);
      } else {
        next[idx] = {
          ...next[idx],
          quantity: newQty,
          subtotal: next[idx].unitPrice * newQty,
        };
      }
      return next;
    });
  };

  // Thêm món mới vào đơn đang sửa
  const handleAddProductToEditOrder = (product: Product, variant?: ProductVariant) => {
    const unitPrice = variant?.price ?? product.price;
    setEditItems((prev) => {
      const idx = prev.findIndex(
        (it) => it.productId === product.id && it.variantId === variant?.id
      );
      if (idx > -1) {
        const next = [...prev];
        const newQty = next[idx].quantity + 1;
        next[idx] = {
          ...next[idx],
          quantity: newQty,
          subtotal: unitPrice * newQty,
        };
        return next;
      }
      return [
        ...prev,
        {
          productId: product.id,
          productName: product.name,
          variantId: variant?.id,
          variantName: variant?.name || product.unit || "cái",
          quantity: 1,
          unitPrice,
          subtotal: unitPrice,
          stockDeductionPerItem: variant?.stockDeduction || 1,
        },
      ];
    });
  };

  // Tính lại tổng tiền modal chỉnh sửa
  const editSubtotal = useMemo(() => {
    return editItems.reduce((sum, it) => sum + (it.subtotal || it.quantity * it.unitPrice || 0), 0);
  }, [editItems]);

  const editGrandTotal = useMemo(() => {
    return Math.max(0, editSubtotal - editDiscount + editShippingFee);
  }, [editSubtotal, editDiscount, editShippingFee]);

  // Lưu chỉnh sửa đơn hàng
  const handleSaveEditOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingOrder) return;
    if (editItems.length === 0) {
      notify("⚠️ Đơn hàng phải có ít nhất 1 món!");
      return;
    }

    setIsSavingEdit(true);
    try {
      const res = await fetch("/api/orders", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: editingOrder.id,
          customerName: editCustomerName.trim(),
          customerPhone: editCustomerPhone.trim(),
          customerAddress: editCustomerAddress.trim() || undefined,
          deliveryTime: editDeliveryTime.trim() || undefined,
          note: editNote.trim() || undefined,
          shippingFee: editShippingFee,
          discount: editDiscount,
          paymentMethod: editPaymentMethod,
          isPaid: editIsPaid,
          status: editStatus,
          items: editItems,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Lỗi lưu chỉnh sửa đơn hàng");

      const updatedOrder: Order = data.order;
      setOrders((prev) =>
        prev.map((o) => (o.id === updatedOrder.id ? updatedOrder : o))
      );
      setEditingOrder(null);
      notify(` Đã cập nhật thành công đơn #${updatedOrder.code}!`);
    } catch (err: any) {
      notify(`❌ ${err.message || String(err)}`);
    } finally {
      setIsSavingEdit(false);
    }
  };

  // Copy thông tin đơn hàng
  const copyOrderText = (order: Order) => {
    const itemsStr = order.items
      .map((it) => `- ${it.quantity}x ${it.productName} (${it.variantName})`)
      .join("\n");
    const text = `ĐƠN HÀNG FLANDI #${order.code}
Khách: ${order.customerName} - ${order.customerPhone}
Địa chỉ: ${order.customerAddress || "Khách ghé lấy"}
Giờ giao: ${order.deliveryTime || "Giao sớm"}
Ghi chú: ${order.note || "Không có"}
Món đặt:\n${itemsStr}
Tổng tiền: ${formatVND(order.total)} (${order.isPaid ? "Đã chuyển khoản" : "Thu COD"})`;

    navigator.clipboard.writeText(text);
    notify(`📋 Đã copy thông tin đơn #${order.code}!`);
  };

  // Google Maps URL
  const buildMapsUrl = (address: string) => {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
      address.trim()
    )}`;
  };

  // Kiểm tra quyền truy cập
  if (authLoading) {
    return (
      <div className="min-h-screen bg-flandi-bg flex items-center justify-center p-4">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-4 border-flandi-coral border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="font-display text-sm text-flandi-coral">Đang xác thực quyền nhân viên...</p>
        </div>
      </div>
    );
  }

  if (!isAuthorized) {
    return (
      <div className="min-h-screen bg-flandi-bg flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white/95 backdrop-blur-md rounded-3xl border-2 border-flandi-salmon/60 p-6 sm:p-8 text-center space-y-4 shadow-cute-lg">
          <div className="w-14 h-14 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center mx-auto shadow-2xs">
            <Lock className="w-7 h-7" />
          </div>
          <div>
            <h1 className="font-display text-xl text-flandi-dark">Kênh Dành Cho Nhân Viên</h1>
            <p className="text-xs sm:text-sm font-bold text-flandi-muted mt-1">
              Bạn cần đăng nhập tài khoản có quyền <b>Staff</b> hoặc <b>Admin</b> để lên đơn và quản lý đơn hàng.
            </p>
          </div>
          <div className="pt-2 flex flex-col gap-2.5">
            <button
              onClick={triggerGoogleSignIn}
              className="w-full py-3 rounded-2xl bg-flandi-coral hover:bg-flandi-salmon text-white font-black text-sm shadow-cute transition active:scale-95 cursor-pointer flex items-center justify-center gap-2"
            >
              <User className="w-4 h-4" />
              <span>Đăng nhập Google Staff</span>
            </button>
            <Link
              href="/order"
              className="w-full py-2.5 rounded-2xl bg-flandi-cream hover:bg-flandi-pink/60 text-flandi-coral font-extrabold text-xs border border-flandi-pink transition"
            >
              ← Về trang đặt bánh (/order)
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-flandi-bg flex flex-col text-flandi-dark font-sans selection:bg-flandi-coral selection:text-white">
      {/* Toast Notification */}
      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-2xl bg-flandi-dark text-white font-extrabold text-xs sm:text-sm shadow-xl flex items-center gap-2 animate-bounce">
          <Sparkles className="w-4 h-4 text-flandi-yellow shrink-0" />
          <span>{toast}</span>
        </div>
      )}

      {/* HEADER BAR */}
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-flandi-salmon/40 px-3 sm:px-6 py-2.5 shadow-2xs">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
          {/* Logo & Portal Title */}
          <div className="flex items-center gap-3">
            <Link
              href="/order"
              className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-flandi-coral text-white flex items-center justify-center shadow-2xs hover:scale-105 transition"
              title="Về trang khách đặt"
            >
              <Store className="w-5 h-5" />
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-display text-base sm:text-lg text-flandi-dark leading-tight">
                  KÊNH NHÂN VIÊN
                </h1>
                <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-black uppercase tracking-wider border border-emerald-300">
                  {ROLE_META[role]?.label || "Staff"}
                </span>
              </div>
              <p className="text-[11px] font-bold text-flandi-muted hidden sm:block">
                Lên đơn giùm khách • Quản lý & chỉnh sửa thông tin đơn
              </p>
            </div>
          </div>

          {/* Quick links & Auth */}
          <div className="flex items-center gap-2">
            <Link
              href="/ship"
              className="hidden md:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-sky-50 hover:bg-sky-100 text-sky-700 font-extrabold text-xs border border-sky-300 shadow-2xs transition"
              title="Khu vực điều phối & giao hàng"
            >
              <Bike className="w-3.5 h-3.5" />
              <span>Giao Hàng (/ship)</span>
            </Link>

            {role === "admin" && (
              <Link
                href="/admin"
                className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-flandi-cream hover:bg-flandi-pink/60 text-flandi-coral font-extrabold text-xs border border-flandi-pink shadow-2xs transition"
              >
                <span>Admin</span>
              </Link>
            )}

            <button
              onClick={fetchData}
              disabled={loading}
              className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-flandi-cream hover:bg-flandi-pink/60 text-flandi-coral border border-flandi-pink flex items-center justify-center transition active:scale-95 disabled:opacity-50 cursor-pointer"
              title="Làm mới dữ liệu"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            </button>

            <CustomerHeaderAuthButton />
          </div>
        </div>

        {/* 2 MAIN TABS BAR */}
        <div className="max-w-7xl mx-auto mt-2 pt-2 border-t border-flandi-pink/40 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            {/* Tab 1 Button */}
            <button
              onClick={() => setActiveTab("CREATE")}
              className={`px-3.5 sm:px-5 py-2 rounded-2xl font-display text-xs sm:text-sm flex items-center gap-2 transition cursor-pointer ${
                activeTab === "CREATE"
                  ? "bg-flandi-coral text-white shadow-cute"
                  : "bg-white hover:bg-flandi-cream text-flandi-muted border border-flandi-pink/60"
              }`}
            >
              <Plus className="w-4 h-4" />
              <span>Lên Đơn Giùm Khách</span>
              {cart.length > 0 && (
                <span className="w-5 h-5 rounded-full bg-white text-flandi-coral text-[11px] font-black flex items-center justify-center">
                  {cart.length}
                </span>
              )}
            </button>

            {/* Tab 2 Button */}
            <button
              onClick={() => setActiveTab("MANAGE")}
              className={`px-3.5 sm:px-5 py-2 rounded-2xl font-display text-xs sm:text-sm flex items-center gap-2 transition cursor-pointer ${
                activeTab === "MANAGE"
                  ? "bg-flandi-coral text-white shadow-cute"
                  : "bg-white hover:bg-flandi-cream text-flandi-muted border border-flandi-pink/60"
              }`}
            >
              <ShoppingBag className="w-4 h-4" />
              <span>Quản Lý Đơn ({orders.length})</span>
              {stats.pending > 0 && (
                <span className="px-1.5 py-0.5 rounded-full bg-amber-400 text-flandi-dark text-[10px] font-black animate-pulse">
                  {stats.pending} mới
                </span>
              )}
            </button>
          </div>

          {/* Quick tab info */}
          <div className="text-[11px] font-bold text-flandi-muted hidden sm:block">
            {activeTab === "CREATE" ? (
              <span>✨ Thực đơn: {products.length} món sẵn sàng</span>
            ) : (
              <span>🛵 Chờ giao: {stats.delivering + stats.preparing} đơn</span>
            )}
          </div>
        </div>
      </header>

      {/* BODY CONTENT BY TAB */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-6 py-4">
        {/* ======================================================== */}
        {/* TAB 1: LÊN ĐƠN GIÙM KHÁCH HÀNG (GIỐNG TRANG ORDER)        */}
        {/* ======================================================== */}
        {activeTab === "CREATE" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
            {/* CỘT TRÁI: THỰC ĐƠN BÁNH (7 CỘT TRÊN LG) */}
            <div className="lg:col-span-7 space-y-3.5">
              {/* Category Filter & Search */}
              <div className="bg-white/90 backdrop-blur-md rounded-3xl border border-flandi-salmon/40 p-3.5 shadow-2xs space-y-2.5">
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <Search className="w-4 h-4 text-flandi-muted absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Tìm món bánh nhanh (Flan, panna cotta, rau câu...)"
                      value={menuSearch}
                      onChange={(e) => setMenuSearch(e.target.value)}
                      className="w-full pl-9 pr-4 py-2 rounded-2xl bg-flandi-bg border border-flandi-pink text-xs font-bold text-flandi-dark placeholder:text-flandi-muted focus:outline-none focus:ring-2 focus:ring-flandi-coral"
                    />
                    {menuSearch && (
                      <button
                        onClick={() => setMenuSearch("")}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-flandi-muted hover:text-flandi-dark"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Categories chip list */}
                <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
                  {categories.map((cat) => (
                    <button
                      key={cat}
                      onClick={() => setSelectedCategory(cat)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-black whitespace-nowrap transition cursor-pointer ${
                        selectedCategory === cat
                          ? "bg-flandi-coral text-white shadow-2xs"
                          : "bg-flandi-cream hover:bg-flandi-pink/60 text-flandi-dark"
                      }`}
                    >
                      {cat === "ALL" ? "Tất cả món" : cat}
                    </button>
                  ))}
                </div>
              </div>

              {/* Product Cards Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {filteredProducts.map((product) => {
                  const hasVariants = product.variants && product.variants.length > 0;
                  return (
                    <div
                      key={product.id}
                      className="bg-white rounded-3xl border-2 border-flandi-pink/80 p-3 shadow-2xs hover:shadow-cute transition flex flex-col justify-between"
                    >
                      <div className="flex gap-2.5">
                        {/* Image */}
                        <div className="w-16 h-16 sm:w-18 sm:h-18 rounded-2xl overflow-hidden bg-flandi-cream border border-flandi-salmon/30 shrink-0 relative">
                          <img
                            src={product.image || "/images/banner-hero.png"}
                            alt={product.name}
                            className="w-full h-full object-cover"
                          />
                          {product.stock <= product.lowStockThreshold && (
                            <span className="absolute bottom-0 inset-x-0 bg-red-600/90 text-white text-[9px] font-black text-center py-0.5">
                              Còn {product.stock}
                            </span>
                          )}
                        </div>

                        {/* Title & Price */}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-1">
                            <h3 className="font-display text-sm text-flandi-dark leading-tight line-clamp-1">
                              {product.name}
                            </h3>
                          </div>
                          <p className="text-[11px] font-bold text-flandi-muted line-clamp-1">
                            {product.subtitle || product.category}
                          </p>
                          <div className="mt-1 flex items-baseline gap-1.5">
                            <span className="font-black text-sm text-flandi-coral">
                              {formatVND(product.price)}
                            </span>
                            <span className="text-[10px] font-bold text-flandi-muted">
                              /{product.unit || "cái"}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Quick Add Buttons */}
                      <div className="mt-2.5 pt-2 border-t border-flandi-pink/40 flex items-center justify-between gap-1.5">
                        {hasVariants ? (
                          <div className="w-full flex items-center gap-1 overflow-x-auto no-scrollbar">
                            {product.variants.map((variant) => (
                              <button
                                key={variant.id}
                                type="button"
                                onClick={() => addToCart(product, variant, 1)}
                                className="px-2 py-1 rounded-xl bg-flandi-cream hover:bg-flandi-pink text-flandi-coral text-[11px] font-black whitespace-nowrap border border-flandi-salmon/40 transition active:scale-95 cursor-pointer"
                              >
                                + {variant.name} ({formatVND(variant.price)})
                              </button>
                            ))}
                          </div>
                        ) : (
                          <div className="w-full flex items-center justify-between gap-1">
                            <button
                              type="button"
                              onClick={() => addToCart(product, undefined, 1)}
                              className="flex-1 py-1.5 rounded-xl bg-flandi-coral hover:bg-flandi-salmon text-white text-xs font-black shadow-2xs transition active:scale-95 cursor-pointer flex items-center justify-center gap-1"
                            >
                              <Plus className="w-3.5 h-3.5" />
                              <span>+1 cái</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => addToCart(product, undefined, 5)}
                              className="px-2.5 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-800 text-xs font-black border border-amber-300 transition active:scale-95 cursor-pointer"
                              title="Thêm 5 cái"
                            >
                              +5
                            </button>
                            <button
                              type="button"
                              onClick={() => addToCart(product, undefined, 10)}
                              className="px-2.5 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-black border border-emerald-300 transition active:scale-95 cursor-pointer"
                              title="Thêm 10 cái (1 chục)"
                            >
                              +10
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* CỘT PHẢI: FORM LÊN ĐƠN & HÓA ĐƠN (5 CỘT TRÊN LG) */}
            <div className="lg:col-span-5 bg-white/95 backdrop-blur-md rounded-3xl border-2 border-flandi-salmon shadow-cute-lg p-4 sm:p-5 space-y-4">
              {/* Header Bill */}
              <div className="flex items-center justify-between border-b border-flandi-pink pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-2xl bg-flandi-coral text-white flex items-center justify-center shadow-2xs">
                    <Receipt className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="font-display text-base sm:text-lg text-flandi-dark leading-tight">
                      Hóa Đơn Lên Giùm
                    </h2>
                    <p className="text-xs font-bold text-flandi-muted">
                      {cart.length > 0 ? `${cart.length} món • ${cartTotalBanh} bánh` : "Chưa chọn món nào"}
                    </p>
                  </div>
                </div>

                {cart.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setCart([])}
                    className="text-xs font-extrabold text-red-500 hover:text-red-700 flex items-center gap-1 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Xoá hết</span>
                  </button>
                )}
              </div>

              {/* Nguồn đơn (Zalo, Hotline, Fanpage, POS...) */}
              <div>
                <label className="text-[11px] font-black text-flandi-muted uppercase tracking-wider block mb-1.5">
                  Nguồn Khách Đặt
                </label>
                <div className="grid grid-cols-4 gap-1.5">
                  {[
                    { id: "ZALO", label: "💬 Zalo" },
                    { id: "ONLINE", label: "🌐 Fanpage" },
                    { id: "POS", label: "🏪 Tại quầy" },
                    { id: "GRAB_SHOPEE", label: "🛵 App ngoài" },
                  ].map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setOrderSource(s.id as OrderSource)}
                      className={`py-1.5 rounded-xl text-xs font-extrabold transition cursor-pointer ${
                        orderSource === s.id
                          ? "bg-flandi-coral text-white shadow-2xs"
                          : "bg-flandi-cream hover:bg-flandi-pink/60 text-flandi-dark"
                      }`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Thông tin khách hàng */}
              <div className="space-y-2.5 pt-1">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <label className="text-[11px] font-extrabold text-flandi-dark block mb-1">
                      Tên khách hàng <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      placeholder="Anh Nam, Chị Hương Zalo..."
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-flandi-bg border border-flandi-pink text-xs font-bold text-flandi-dark placeholder:text-flandi-muted focus:outline-none focus:ring-2 focus:ring-flandi-coral"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-extrabold text-flandi-dark block mb-1">
                      Số điện thoại <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="tel"
                      placeholder="0909xxxxxx"
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-flandi-bg border border-flandi-pink text-xs font-bold text-flandi-dark placeholder:text-flandi-muted focus:outline-none focus:ring-2 focus:ring-flandi-coral"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-extrabold text-flandi-dark block mb-1">
                    Địa chỉ nhận hàng (bỏ trống nếu ghé tiệm lấy)
                  </label>
                  <input
                    type="text"
                    placeholder="Số nhà, tên đường, phường / quận..."
                    value={customerAddress}
                    onChange={(e) => setCustomerAddress(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-flandi-bg border border-flandi-pink text-xs font-bold text-flandi-dark placeholder:text-flandi-muted focus:outline-none focus:ring-2 focus:ring-flandi-coral"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <label className="text-[11px] font-extrabold text-flandi-dark block mb-1">
                      ⏰ Thời gian hẹn giao bánh
                    </label>
                    <input
                      type="text"
                      placeholder="vd: 14h chiều nay, trước 11h..."
                      value={deliveryTime}
                      onChange={(e) => setDeliveryTime(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-flandi-bg border border-flandi-pink text-xs font-bold text-flandi-dark placeholder:text-flandi-muted focus:outline-none focus:ring-2 focus:ring-flandi-coral"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-extrabold text-flandi-dark block mb-1">
                      📝 Ghi chú đơn / tiệm dặn
                    </label>
                    <input
                      type="text"
                      placeholder="Thêm đá, ít cà phê, gọi trước..."
                      value={orderNote}
                      onChange={(e) => setOrderNote(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-flandi-bg border border-flandi-pink text-xs font-bold text-flandi-dark placeholder:text-flandi-muted focus:outline-none focus:ring-2 focus:ring-flandi-coral"
                    />
                  </div>
                </div>
              </div>

              {/* Danh sách món trong giỏ */}
              <div className="space-y-2 pt-2 border-t border-flandi-pink/60">
                <label className="text-[11px] font-black text-flandi-muted uppercase tracking-wider block">
                  Món Đã Chọn ({cart.length})
                </label>

                {cart.length === 0 ? (
                  <div className="py-6 text-center rounded-2xl border-2 border-dashed border-flandi-pink/80 bg-flandi-cream/30 text-flandi-muted text-xs font-bold">
                    👈 Bấm chọn các món từ Thực đơn bên trái
                  </div>
                ) : (
                  <div className="max-h-56 overflow-y-auto no-scrollbar space-y-1.5 pr-1">
                    {cart.map((it, idx) => {
                      const unitPrice = it.variant?.price ?? it.product.price;
                      return (
                        <div
                          key={`${it.product.id}-${it.variant?.id || "base"}`}
                          className="flex items-center justify-between gap-2 p-2 rounded-2xl bg-flandi-cream/50 border border-flandi-pink/60 text-xs"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="font-extrabold text-flandi-dark leading-tight line-clamp-1">
                              {it.product.name}
                            </p>
                            <p className="text-[10px] font-bold text-flandi-muted">
                              {it.variant?.name || it.product.unit || "cái"} • {formatVND(unitPrice)}
                            </p>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              type="button"
                              onClick={() => updateCartQty(idx, -1)}
                              className="w-6 h-6 rounded-lg bg-white hover:bg-flandi-pink text-flandi-coral flex items-center justify-center border border-flandi-pink transition cursor-pointer"
                            >
                              <Minus className="w-3 h-3" />
                            </button>
                            <span className="w-6 text-center font-black text-xs text-flandi-dark">
                              {it.quantity}
                            </span>
                            <button
                              type="button"
                              onClick={() => updateCartQty(idx, 1)}
                              className="w-6 h-6 rounded-lg bg-white hover:bg-flandi-pink text-flandi-coral flex items-center justify-center border border-flandi-pink transition cursor-pointer"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                            <span className="font-black text-xs text-flandi-coral w-18 text-right">
                              {formatVND(unitPrice * it.quantity)}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Chiết khấu & Phí ship & Thanh toán */}
              <div className="space-y-2 pt-2 border-t border-flandi-pink/60">
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <label className="text-[10px] font-bold text-flandi-muted block">
                      Phí ship (đ)
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="1000"
                      value={customShippingFee}
                      onChange={(e) => setCustomShippingFee(Math.max(0, Number(e.target.value) || 0))}
                      className="w-full px-2.5 py-1.5 rounded-xl bg-flandi-bg border border-flandi-pink text-xs font-bold text-flandi-dark"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-flandi-muted block">
                      Giảm giá / Ưu đãi (đ)
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="1000"
                      value={customDiscount}
                      onChange={(e) => setCustomDiscount(Math.max(0, Number(e.target.value) || 0))}
                      className="w-full px-2.5 py-1.5 rounded-xl bg-flandi-bg border border-flandi-pink text-xs font-bold text-flandi-dark"
                    />
                  </div>
                </div>

                {/* Phương thức thanh toán */}
                <div className="flex items-center gap-1.5">
                  {[
                    { id: "COD", label: "💵 Thu COD" },
                    { id: "VIETQR", label: "📱 Chuyển khoản" },
                    { id: "CASH", label: "💰 Tiền mặt" },
                  ].map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setPaymentMethod(p.id as PaymentMethod)}
                      className={`flex-1 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                        paymentMethod === p.id
                          ? "bg-flandi-dark text-white shadow-2xs"
                          : "bg-flandi-cream hover:bg-flandi-pink/60 text-flandi-dark"
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>

                <div className="flex items-center justify-between text-xs pt-1">
                  <label className="flex items-center gap-2 cursor-pointer font-bold text-flandi-dark">
                    <input
                      type="checkbox"
                      checked={isPaidDraft}
                      onChange={(e) => setIsPaidDraft(e.target.checked)}
                      className="w-4 h-4 rounded text-flandi-coral focus:ring-flandi-coral"
                    />
                    <span>Khách đã thanh toán xong</span>
                  </label>
                </div>

                {/* Tổng cộng */}
                <div className="pt-2 border-t border-flandi-salmon/40 flex items-center justify-between">
                  <div>
                    <p className="text-[11px] font-bold text-flandi-muted">Tổng cộng hóa đơn</p>
                    <p className="font-display text-xl sm:text-2xl text-flandi-coral">
                      {formatVND(grandTotal)}
                    </p>
                  </div>

                  <button
                    type="button"
                    disabled={isSubmittingOrder || cart.length === 0}
                    onClick={handleCreateOrder}
                    className="px-5 py-3 rounded-2xl bg-flandi-coral hover:bg-flandi-salmon text-white font-black text-sm shadow-cute transition active:scale-95 disabled:opacity-50 cursor-pointer flex items-center gap-2"
                  >
                    {isSubmittingOrder ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4" />
                    )}
                    <span>TẠO ĐƠN NGAY</span>
                  </button>
                </div>

                {lastCreatedOrder && (
                  <div className="mt-2 p-3 rounded-2xl bg-emerald-50 border border-emerald-300 flex items-center justify-between gap-2 text-xs">
                    <div>
                      <p className="font-black text-emerald-900">
                        🎉 Vừa tạo đơn #{lastCreatedOrder.code}
                      </p>
                      <p className="text-[11px] font-bold text-emerald-700">
                        {lastCreatedOrder.customerName} • {formatVND(lastCreatedOrder.total)}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setActiveTab("MANAGE");
                        setManageSearch(lastCreatedOrder.code);
                      }}
                      className="px-3 py-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-extrabold text-[11px] shadow-2xs transition"
                    >
                      Xem đơn →
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* TAB 2: QUẢN LÝ ĐƠN HÀNG (TỔNG QUAN, EXPAND, CHỈNH SỬA)   */}
        {/* ======================================================== */}
        {activeTab === "MANAGE" && (
          <div className="space-y-4">
            {/* THỐNG KÊ TỔNG QUAN (KPI TIỆM) */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
              <div
                onClick={() => setStatusFilter("ALL")}
                className={`p-3 rounded-2xl bg-white border-2 cursor-pointer transition ${
                  statusFilter === "ALL" ? "border-flandi-coral shadow-2xs" : "border-flandi-pink/60 hover:border-flandi-salmon"
                }`}
              >
                <p className="text-[10px] font-extrabold text-flandi-muted uppercase">Tất cả đơn</p>
                <p className="font-display text-lg text-flandi-dark">{stats.totalCount}</p>
              </div>

              <div
                onClick={() => setStatusFilter("PENDING")}
                className={`p-3 rounded-2xl bg-white border-2 cursor-pointer transition ${
                  statusFilter === "PENDING" ? "border-amber-400 bg-amber-50/50 shadow-2xs" : "border-flandi-pink/60 hover:border-amber-300"
                }`}
              >
                <p className="text-[10px] font-extrabold text-amber-800 uppercase">Chờ xác nhận</p>
                <p className="font-display text-lg text-amber-700">{stats.pending}</p>
              </div>

              <div
                onClick={() => setStatusFilter("PREPARING")}
                className={`p-3 rounded-2xl bg-white border-2 cursor-pointer transition ${
                  statusFilter === "PREPARING" ? "border-orange-400 bg-orange-50/50 shadow-2xs" : "border-flandi-pink/60 hover:border-orange-300"
                }`}
              >
                <p className="text-[10px] font-extrabold text-orange-800 uppercase">Đang làm bánh</p>
                <p className="font-display text-lg text-orange-700">{stats.preparing}</p>
              </div>

              <div
                onClick={() => setStatusFilter("DELIVERING")}
                className={`p-3 rounded-2xl bg-white border-2 cursor-pointer transition ${
                  statusFilter === "DELIVERING" ? "border-sky-400 bg-sky-50/50 shadow-2xs" : "border-flandi-pink/60 hover:border-sky-300"
                }`}
              >
                <p className="text-[10px] font-extrabold text-sky-800 uppercase">Đang đi ship</p>
                <p className="font-display text-lg text-sky-700">{stats.delivering}</p>
              </div>

              <div
                onClick={() => setStatusFilter("COMPLETED")}
                className={`p-3 rounded-2xl bg-white border-2 cursor-pointer transition ${
                  statusFilter === "COMPLETED" ? "border-emerald-400 bg-emerald-50/50 shadow-2xs" : "border-flandi-pink/60 hover:border-emerald-300"
                }`}
              >
                <p className="text-[10px] font-extrabold text-emerald-800 uppercase">Hoàn thành</p>
                <p className="font-display text-lg text-emerald-700">{stats.completed}</p>
              </div>

              <div className="p-3 rounded-2xl bg-flandi-coral/10 border-2 border-flandi-salmon/40">
                <p className="text-[10px] font-extrabold text-flandi-coral uppercase">Doanh thu ca</p>
                <p className="font-display text-base sm:text-lg text-flandi-coral leading-tight">
                  {formatVND(stats.totalRevenue)}
                </p>
              </div>
            </div>

            {/* THANH CÔNG CỤ TÌM KIẾM & BỘ LỌC */}
            <div className="bg-white/95 backdrop-blur-md rounded-3xl border border-flandi-salmon/40 p-3.5 shadow-2xs space-y-2.5">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
                {/* Ô tìm kiếm */}
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-flandi-muted absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Tìm theo Mã đơn (FL-...), Tên khách, SĐT, hoặc Địa chỉ..."
                    value={manageSearch}
                    onChange={(e) => setManageSearch(e.target.value)}
                    className="w-full pl-9 pr-8 py-2 rounded-2xl bg-flandi-bg border border-flandi-pink text-xs font-bold text-flandi-dark placeholder:text-flandi-muted focus:outline-none focus:ring-2 focus:ring-flandi-coral"
                  />
                  {manageSearch && (
                    <button
                      onClick={() => setManageSearch("")}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-flandi-muted hover:text-flandi-dark"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Mode Toggles */}
                <div className="flex items-center gap-1.5 self-end sm:self-auto">
                  <button
                    type="button"
                    onClick={() => setIsCompactMode(!isCompactMode)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-extrabold flex items-center gap-1.5 border transition cursor-pointer ${
                      isCompactMode
                        ? "bg-flandi-coral text-white border-flandi-coral shadow-2xs"
                        : "bg-white hover:bg-flandi-cream text-flandi-dark border-flandi-pink"
                    }`}
                    title="Chế độ xem tổng quan thu gọn"
                  >
                    <Layers className="w-3.5 h-3.5" />
                    <span>Thu gọn</span>
                  </button>

                  <button
                    type="button"
                    onClick={toggleExpandAll}
                    className="px-3 py-1.5 rounded-xl bg-white hover:bg-flandi-cream text-flandi-dark border border-flandi-pink text-xs font-extrabold flex items-center gap-1.5 transition cursor-pointer"
                    title="Mở rộng / Thu gọn toàn bộ"
                  >
                    <ChevronsUpDown className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">
                      {expandedOrderIds.size === filteredOrders.length ? "Đóng hết" : "Mở hết"}
                    </span>
                  </button>
                </div>
              </div>

              {/* Lọc Khu Vực Địa Bàn */}
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-1 border-t border-flandi-pink/30">
                <span className="text-[10px] font-black text-flandi-muted uppercase shrink-0">
                  Khu vực:
                </span>
                {zonesList.map((z) => (
                  <button
                    key={z}
                    type="button"
                    onClick={() => setZoneFilter(z)}
                    className={`px-2.5 py-1 rounded-xl text-[11px] font-extrabold whitespace-nowrap transition cursor-pointer ${
                      zoneFilter === z
                        ? "bg-sky-600 text-white shadow-2xs"
                        : "bg-sky-50 hover:bg-sky-100 text-sky-800 border border-sky-200"
                    }`}
                  >
                    {z === "ALL" ? "Tất cả khu vực" : z}
                  </button>
                ))}
              </div>
            </div>

            {/* DANH SÁCH ĐƠN HÀNG */}
            {filteredOrders.length === 0 ? (
              <div className="py-12 bg-white rounded-3xl border-2 border-dashed border-flandi-pink text-center space-y-2">
                <ShoppingBag className="w-10 h-10 text-flandi-muted mx-auto opacity-50" />
                <p className="font-display text-sm text-flandi-dark">Không tìm thấy đơn hàng nào</p>
                <p className="text-xs font-bold text-flandi-muted">
                  Thử tìm kiếm với từ khóa khác hoặc chuyển sang tab Lên Đơn
                </p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {filteredOrders.map((order) => {
                  const isExpanded = expandedOrderIds.has(order.id) || !isCompactMode;
                  const cfg = ORDER_STATUS_CONFIG[order.status] || ORDER_STATUS_CONFIG.PENDING;
                  const totalBanh = order.items.reduce(
                    (s, it) => s + (it.stockDeductionPerItem || 1) * it.quantity,
                    0
                  );
                  const zone = extractAddressZone(order.customerAddress);

                  return (
                    <div
                      key={order.id}
                      className={`bg-white rounded-3xl border-2 transition shadow-2xs hover:shadow-cute ${cfg.borderClass}`}
                    >
                      {/* CARD HEADER / COMPACT ROW */}
                      <div className="p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                        {/* Cột trái: Mã đơn, thời gian, tên khách, zone */}
                        <div
                          className="flex items-start sm:items-center gap-3 min-w-0 cursor-pointer flex-1"
                          onClick={() => toggleExpand(order.id)}
                        >
                          <button
                            type="button"
                            className="mt-0.5 sm:mt-0 p-1 rounded-lg hover:bg-flandi-cream text-flandi-muted transition"
                          >
                            {isExpanded ? (
                              <ChevronUp className="w-4 h-4 text-flandi-coral" />
                            ) : (
                              <ChevronDown className="w-4 h-4 text-flandi-muted" />
                            )}
                          </button>

                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-display text-sm sm:text-base text-flandi-dark">
                                #{order.code}
                              </span>
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-black border ${cfg.badgeClass}`}
                              >
                                {cfg.label}
                              </span>
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-black border ${
                                  order.isPaid
                                    ? "bg-emerald-50 text-emerald-700 border-emerald-300"
                                    : "bg-amber-50 text-amber-700 border-amber-300"
                                }`}
                              >
                                {order.isPaid ? " Đã CK" : " Thu COD"}
                              </span>
                              <span className="px-2 py-0.5 rounded-full bg-sky-50 text-sky-700 border border-sky-200 text-[10px] font-extrabold truncate max-w-[130px]">
                                📍 {zone}
                              </span>
                            </div>

                            <div className="mt-1 flex items-center gap-2 text-xs font-bold text-flandi-dark flex-wrap">
                              <span className="font-black text-flandi-coral">
                                {order.customerName}
                              </span>
                              <span className="text-flandi-muted">•</span>
                              <a
                                href={`tel:${order.customerPhone}`}
                                onClick={(e) => e.stopPropagation()}
                                className="text-flandi-dark hover:text-flandi-coral hover:underline"
                              >
                                📞 {order.customerPhone}
                              </a>
                              {order.deliveryTime && (
                                <>
                                  <span className="text-flandi-muted">•</span>
                                  <span className="text-orange-700 font-extrabold flex items-center gap-1">
                                    <Clock className="w-3 h-3" />
                                    <span>{order.deliveryTime}</span>
                                  </span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Cột phải: Tổng tiền & Các nút thao tác nhanh */}
                        <div className="flex items-center justify-between sm:justify-end gap-2.5 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-flandi-pink/30">
                          <div className="text-left sm:text-right">
                            <p className="font-display text-sm sm:text-base text-flandi-coral leading-tight">
                              {formatVND(order.total)}
                            </p>
                            <p className="text-[10px] font-bold text-flandi-muted">
                              {order.items.length} món ({totalBanh} bánh)
                            </p>
                          </div>

                          {/* Quick Action Buttons */}
                          <div className="flex items-center gap-1.5">
                            {/* Nút Next Status nếu có */}
                            {cfg.nextStatus && (
                              <button
                                type="button"
                                onClick={() => handleQuickStatusChange(order, cfg.nextStatus!)}
                                className="px-2.5 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 text-xs font-black shadow-2xs transition active:scale-95 cursor-pointer"
                                title={cfg.nextLabel}
                              >
                                {cfg.nextLabel}
                              </button>
                            )}

                            {/* Nút Chỉnh sửa chi tiết */}
                            <button
                              type="button"
                              onClick={() => handleOpenEditOrder(order)}
                              className="p-1.5 sm:px-2.5 sm:py-1.5 rounded-xl bg-flandi-cream hover:bg-flandi-pink/60 text-flandi-coral border border-flandi-pink text-xs font-black flex items-center gap-1 shadow-2xs transition active:scale-95 cursor-pointer"
                              title="Chỉnh sửa đơn hàng này"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                              <span className="hidden sm:inline">Sửa</span>
                            </button>

                            {/* Nút QR */}
                            <button
                              type="button"
                              onClick={() => setQrModalOrder(order)}
                              className="p-1.5 rounded-xl bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 transition cursor-pointer"
                              title="Mở mã QR TPBank nhận tiền"
                            >
                              <QrCode className="w-3.5 h-3.5" />
                            </button>

                            {/* Nút Copy */}
                            <button
                              type="button"
                              onClick={() => copyOrderText(order)}
                              className="p-1.5 rounded-xl bg-zinc-50 hover:bg-zinc-100 text-zinc-600 border border-zinc-200 transition cursor-pointer"
                              title="Copy thông tin đơn"
                            >
                              <Copy className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* EXPANDED CONTENT (CHI TIẾT MÓN, ĐỊA CHỈ, GHI CHÚ) */}
                      {isExpanded && (
                        <div className="px-4 pb-4 pt-2 border-t border-flandi-pink/40 space-y-3 bg-flandi-cream/15 rounded-b-3xl text-xs">
                          {/* Địa chỉ & Thời gian & Note */}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                            <div className="p-2.5 rounded-2xl bg-white border border-flandi-salmon/30 space-y-1">
                              <p className="text-[10px] font-black text-flandi-muted uppercase">
                                Địa chỉ nhận bánh:
                              </p>
                              <p className="font-extrabold text-flandi-dark leading-snug">
                                {order.customerAddress || " Khách ghé tiệm lấy trực tiếp"}
                              </p>
                              {order.customerAddress && (
                                <div className="pt-1 flex items-center gap-2">
                                  <a
                                    href={buildMapsUrl(order.customerAddress)}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="inline-flex items-center gap-1 text-[11px] font-extrabold text-sky-700 hover:underline"
                                  >
                                    <Navigation className="w-3 h-3" />
                                    <span>Mở Google Maps</span>
                                  </a>
                                  <span className="text-zinc-300">•</span>
                                  <a
                                    href={`https://zalo.me/${order.customerPhone.replace(/[^0-9]/g, "")}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="inline-flex items-center gap-1 text-[11px] font-extrabold text-blue-700 hover:underline"
                                  >
                                    <MessageCircle className="w-3 h-3" />
                                    <span>Zalo</span>
                                  </a>
                                </div>
                              )}
                            </div>

                            <div className="p-2.5 rounded-2xl bg-white border border-flandi-salmon/30 space-y-1">
                              <p className="text-[10px] font-black text-flandi-muted uppercase">
                                Ghi chú & Lịch giao:
                              </p>
                              <p className="font-bold text-flandi-dark">
                                ⏰ <b>Hẹn giao:</b> {order.deliveryTime || "Giao sớm nhất có thể"}
                              </p>
                              <p className="font-bold text-flandi-dark">
                                📝 <b>Ghi chú:</b> {order.note || "Không có ghi chú"}
                              </p>
                            </div>
                          </div>

                          {/* Bảng danh sách món */}
                          <div className="p-3 rounded-2xl bg-white border border-flandi-salmon/30 space-y-1.5">
                            <p className="text-[10px] font-black text-flandi-muted uppercase">
                              Chi tiết các món ({order.items.length}):
                            </p>
                            <div className="divide-y divide-flandi-pink/30">
                              {order.items.map((it, idx) => (
                                <div
                                  key={idx}
                                  className="py-1.5 flex items-center justify-between gap-2"
                                >
                                  <div>
                                    <span className="font-extrabold text-flandi-dark">
                                      {it.quantity}x {it.productName}
                                    </span>
                                    <span className="text-[11px] font-bold text-flandi-muted ml-1.5">
                                      ({it.variantName})
                                    </span>
                                  </div>
                                  <div className="text-right">
                                    <span className="font-black text-flandi-coral">
                                      {formatVND(it.subtotal || it.unitPrice * it.quantity)}
                                    </span>
                                    <span className="text-[10px] text-flandi-muted block">
                                      {formatVND(it.unitPrice)}/món
                                    </span>
                                  </div>
                                </div>
                              ))}
                            </div>

                            {/* Breakdown thanh toán */}
                            <div className="pt-2 border-t border-flandi-salmon/30 flex items-center justify-between font-bold text-[11px] text-flandi-muted">
                              <span>Tạm tính: {formatVND(order.subtotal || 0)}</span>
                              {order.shippingFee > 0 && (
                                <span>Phí ship: +{formatVND(order.shippingFee)}</span>
                              )}
                              {order.discount > 0 && (
                                <span>Giảm giá: -{formatVND(order.discount)}</span>
                              )}
                              <span className="font-black text-flandi-coral text-xs">
                                Tổng: {formatVND(order.total)}
                              </span>
                            </div>
                          </div>

                          {/* Nút sửa nhanh trạng thái */}
                          <div className="flex items-center justify-between gap-2 pt-1 flex-wrap">
                            <div className="flex items-center gap-1.5">
                              <span className="text-[11px] font-bold text-flandi-muted">
                                Đổi trạng thái:
                              </span>
                              {(
                                ["PENDING", "PREPARING", "DELIVERING", "COMPLETED", "CANCELLED"] as OrderStatus[]
                              ).map((st) => (
                                <button
                                  key={st}
                                  type="button"
                                  onClick={() => handleQuickStatusChange(order, st)}
                                  className={`px-2 py-1 rounded-xl text-[10px] font-black transition cursor-pointer ${
                                    order.status === st
                                      ? "bg-flandi-dark text-white"
                                      : "bg-white hover:bg-flandi-cream text-flandi-muted border border-flandi-pink"
                                  }`}
                                >
                                  {ORDER_STATUS_CONFIG[st].label}
                                </button>
                              ))}
                            </div>

                            <button
                              type="button"
                              onClick={() => handleOpenEditOrder(order)}
                              className="px-3 py-1.5 rounded-xl bg-flandi-coral hover:bg-flandi-salmon text-white text-xs font-black shadow-2xs transition active:scale-95 cursor-pointer flex items-center gap-1.5"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                              <span>Mở form chỉnh sửa toàn diện</span>
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </main>

      {/* ======================================================== */}
      {/* MODAL CHỈNH SỬA TOÀN DIỆN ĐƠN HÀNG (FULL ORDER EDITOR)   */}
      {/* ======================================================== */}
      {editingOrder && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl border-2 border-flandi-salmon max-w-2xl w-full p-4 sm:p-6 shadow-cute-lg space-y-4 my-auto max-h-[92vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-flandi-pink pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-flandi-coral text-white flex items-center justify-center shadow-2xs">
                  <Edit3 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-display text-base sm:text-lg text-flandi-dark leading-tight">
                    Chỉnh Sửa Đơn #{editingOrder.code}
                  </h3>
                  <p className="text-xs font-bold text-flandi-muted">
                    Cập nhật thông tin khách, địa chỉ, giờ giao, món & trạng thái
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setEditingOrder(null)}
                className="w-8 h-8 rounded-full bg-flandi-cream hover:bg-flandi-pink text-flandi-dark flex items-center justify-center transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Form Edit */}
            <form onSubmit={handleSaveEditOrder} className="space-y-4 text-xs font-sans">
              {/* Khối 1: Thông tin khách hàng */}
              <div className="p-3.5 rounded-2xl bg-flandi-cream/40 border border-flandi-pink/80 space-y-2.5">
                <p className="font-black text-flandi-coral uppercase text-[11px] tracking-wider">
                  1. Thông tin khách hàng
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <label className="font-bold text-flandi-dark block mb-1">
                      Tên khách hàng <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={editCustomerName}
                      onChange={(e) => setEditCustomerName(e.target.value)}
                      required
                      className="w-full px-3 py-2 rounded-xl bg-white border border-flandi-pink font-bold text-flandi-dark focus:ring-2 focus:ring-flandi-coral focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="font-bold text-flandi-dark block mb-1">
                      Số điện thoại <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="tel"
                      value={editCustomerPhone}
                      onChange={(e) => setEditCustomerPhone(e.target.value)}
                      required
                      className="w-full px-3 py-2 rounded-xl bg-white border border-flandi-pink font-bold text-flandi-dark focus:ring-2 focus:ring-flandi-coral focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Khối 2: Thông tin giao hàng & Ghi chú */}
              <div className="p-3.5 rounded-2xl bg-flandi-cream/40 border border-flandi-pink/80 space-y-2.5">
                <p className="font-black text-flandi-coral uppercase text-[11px] tracking-wider">
                  2. Địa chỉ & Thời gian ship
                </p>
                <div>
                  <label className="font-bold text-flandi-dark block mb-1">
                    Địa chỉ nhận hàng (để trống nếu ghé tiệm lấy)
                  </label>
                  <input
                    type="text"
                    value={editCustomerAddress}
                    onChange={(e) => setEditCustomerAddress(e.target.value)}
                    placeholder="Số nhà, đường, phường, quận..."
                    className="w-full px-3 py-2 rounded-xl bg-white border border-flandi-pink font-bold text-flandi-dark focus:ring-2 focus:ring-flandi-coral focus:outline-none"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <label className="font-bold text-flandi-dark block mb-1">
                      ⏰ Thời gian hẹn giao bánh
                    </label>
                    <input
                      type="text"
                      value={editDeliveryTime}
                      onChange={(e) => setEditDeliveryTime(e.target.value)}
                      placeholder="vd: 14:00 hôm nay, trước 11h..."
                      className="w-full px-3 py-2 rounded-xl bg-white border border-flandi-pink font-bold text-flandi-dark focus:ring-2 focus:ring-flandi-coral focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="font-bold text-flandi-dark block mb-1">
                      📝 Ghi chú đơn / tiệm dặn
                    </label>
                    <input
                      type="text"
                      value={editNote}
                      onChange={(e) => setEditNote(e.target.value)}
                      placeholder="Ghi chú giao bánh..."
                      className="w-full px-3 py-2 rounded-xl bg-white border border-flandi-pink font-bold text-flandi-dark focus:ring-2 focus:ring-flandi-coral focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Khối 3: Danh sách món trong đơn (Thêm / bớt / đổi số lượng) */}
              <div className="p-3.5 rounded-2xl bg-flandi-cream/40 border border-flandi-pink/80 space-y-2.5">
                <div className="flex items-center justify-between">
                  <p className="font-black text-flandi-coral uppercase text-[11px] tracking-wider">
                    3. Danh sách món ({editItems.length})
                  </p>
                  <span className="text-[11px] font-bold text-flandi-muted">
                    Tạm tính: {formatVND(editSubtotal)}
                  </span>
                </div>

                {/* Items in edit order */}
                <div className="space-y-1.5 max-h-44 overflow-y-auto no-scrollbar">
                  {editItems.map((it, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between gap-2 p-2 rounded-xl bg-white border border-flandi-pink"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-extrabold text-flandi-dark leading-tight line-clamp-1">
                          {it.productName}
                        </p>
                        <p className="text-[10px] font-bold text-flandi-muted">
                          {it.variantName} • {formatVND(it.unitPrice)}
                        </p>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => updateEditItemQty(idx, -1)}
                          className="w-6 h-6 rounded-lg bg-flandi-cream hover:bg-flandi-pink text-flandi-coral flex items-center justify-center transition cursor-pointer"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="w-6 text-center font-black text-xs text-flandi-dark">
                          {it.quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() => updateEditItemQty(idx, 1)}
                          className="w-6 h-6 rounded-lg bg-flandi-cream hover:bg-flandi-pink text-flandi-coral flex items-center justify-center transition cursor-pointer"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                        <span className="font-black text-xs text-flandi-coral w-18 text-right">
                          {formatVND(it.unitPrice * it.quantity)}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setEditItems((prev) => prev.filter((_, i) => i !== idx));
                          }}
                          className="p-1 text-red-500 hover:text-red-700"
                          title="Xóa món này"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Thêm món nhanh vào đơn */}
                <div className="pt-2 border-t border-flandi-pink/60">
                  <label className="text-[10px] font-bold text-flandi-muted block mb-1">
                    + Thêm món khác vào đơn:
                  </label>
                  <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
                    {products.slice(0, 8).map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => handleAddProductToEditOrder(p)}
                        className="px-2 py-1 rounded-xl bg-white hover:bg-flandi-pink/60 text-flandi-dark border border-flandi-pink text-[10px] font-bold whitespace-nowrap transition cursor-pointer"
                      >
                        + {p.name}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Khối 4: Thanh toán & Trạng thái */}
              <div className="p-3.5 rounded-2xl bg-flandi-cream/40 border border-flandi-pink/80 space-y-2.5">
                <p className="font-black text-flandi-coral uppercase text-[11px] tracking-wider">
                  4. Thanh toán & Trạng thái đơn
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <div>
                    <label className="font-bold text-flandi-dark block mb-1 text-[10px]">
                      Phí ship (đ)
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="1000"
                      value={editShippingFee}
                      onChange={(e) => setEditShippingFee(Math.max(0, Number(e.target.value) || 0))}
                      className="w-full px-2.5 py-1.5 rounded-xl bg-white border border-flandi-pink font-bold text-flandi-dark"
                    />
                  </div>
                  <div>
                    <label className="font-bold text-flandi-dark block mb-1 text-[10px]">
                      Giảm giá (đ)
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="1000"
                      value={editDiscount}
                      onChange={(e) => setEditDiscount(Math.max(0, Number(e.target.value) || 0))}
                      className="w-full px-2.5 py-1.5 rounded-xl bg-white border border-flandi-pink font-bold text-flandi-dark"
                    />
                  </div>
                  <div>
                    <label className="font-bold text-flandi-dark block mb-1 text-[10px]">
                      Hình thức
                    </label>
                    <select
                      value={editPaymentMethod}
                      onChange={(e) => setEditPaymentMethod(e.target.value as PaymentMethod)}
                      className="w-full px-2.5 py-1.5 rounded-xl bg-white border border-flandi-pink font-bold text-flandi-dark"
                    >
                      <option value="COD">Thu COD</option>
                      <option value="VIETQR">Chuyển khoản</option>
                      <option value="CASH">Tiền mặt</option>
                      <option value="MOMO">Ví MoMo</option>
                    </select>
                  </div>
                  <div>
                    <label className="font-bold text-flandi-dark block mb-1 text-[10px]">
                      Trạng thái đơn
                    </label>
                    <select
                      value={editStatus}
                      onChange={(e) => setEditStatus(e.target.value as OrderStatus)}
                      className="w-full px-2.5 py-1.5 rounded-xl bg-white border border-flandi-pink font-bold text-flandi-dark"
                    >
                      <option value="PENDING">Chờ xác nhận</option>
                      <option value="PREPARING">Đang làm bánh</option>
                      <option value="DELIVERING">Đang đi ship</option>
                      <option value="COMPLETED">Hoàn thành</option>
                      <option value="CANCELLED">Đã hủy đơn</option>
                    </select>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <label className="flex items-center gap-2 cursor-pointer font-bold text-flandi-dark">
                    <input
                      type="checkbox"
                      checked={editIsPaid}
                      onChange={(e) => setEditIsPaid(e.target.checked)}
                      className="w-4 h-4 rounded text-flandi-coral focus:ring-flandi-coral"
                    />
                    <span>Khách đã thanh toán đủ tiền</span>
                  </label>

                  <div className="text-right">
                    <span className="text-[11px] font-bold text-flandi-muted">Tổng sau sửa: </span>
                    <span className="font-display text-base text-flandi-coral">
                      {formatVND(editGrandTotal)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Submit Buttons */}
              <div className="pt-2 border-t border-flandi-pink flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setEditingOrder(null)}
                  className="px-4 py-2.5 rounded-2xl bg-zinc-100 hover:bg-zinc-200 text-zinc-700 font-extrabold text-xs transition cursor-pointer"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  disabled={isSavingEdit}
                  className="px-6 py-2.5 rounded-2xl bg-flandi-coral hover:bg-flandi-salmon text-white font-black text-xs shadow-cute transition active:scale-95 disabled:opacity-50 cursor-pointer flex items-center gap-2"
                >
                  {isSavingEdit ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Save className="w-3.5 h-3.5" />
                  )}
                  <span>LƯU THAY ĐỔI</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL QR CODE TPBANK THANH TOÁN                          */}
      {/* ======================================================== */}
      {qrModalOrder && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border-2 border-purple-300 max-w-sm w-full p-5 text-center space-y-3.5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-purple-100 pb-2.5">
              <div className="text-left">
                <h3 className="font-display text-base text-purple-950">
                  QR Nhận Tiền TPBank
                </h3>
                <p className="text-[11px] font-bold text-purple-700">
                  Đơn #{qrModalOrder.code} • {qrModalOrder.customerName}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setQrModalOrder(null)}
                className="w-7 h-7 rounded-full bg-purple-50 text-purple-700 flex items-center justify-center hover:bg-purple-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 bg-purple-50/60 rounded-2xl border border-purple-200">
              <img
                src="/images/payment-qr.png"
                alt="QR TPBank BUI VAN LOI"
                className="w-56 h-56 mx-auto object-contain rounded-xl shadow-2xs"
              />
            </div>

            <div className="space-y-1 text-xs">
              <p className="font-black text-lg text-purple-900">
                {formatVND(qrModalOrder.total)}
              </p>
              <p className="font-extrabold text-purple-800">
                BUI VAN LOI • 8386 0008 386
              </p>
              <p className="text-[11px] font-bold text-purple-600">
                Nội dung CK: <span className="font-black">FLANDI {qrModalOrder.code}</span>
              </p>
            </div>

            <button
              type="button"
              onClick={() => {
                handleQuickStatusChange(qrModalOrder, qrModalOrder.status);
                setOrders((prev) =>
                  prev.map((o) =>
                    o.id === qrModalOrder.id ? { ...o, isPaid: true } : o
                  )
                );
                notify(` Đã xác nhận thanh toán đơn #${qrModalOrder.code}!`);
                setQrModalOrder(null);
              }}
              className="w-full py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs shadow-cute transition"
            >
              ✓ Xác nhận khách đã chuyển khoản đủ
            </button>
          </div>
        </div>
      )}

      {/* Customer Account Drawer */}
      <CustomerAccountDrawer />
    </div>
  );
}
