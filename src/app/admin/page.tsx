"use client";

import React, { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import {
  Store,
  ShoppingBag,
  Package,
  Layers,
  BarChart3,
  Settings,
  Plus,
  Minus,
  Trash2,
  Printer,
  CheckCircle2,
  Clock,
  XCircle,
  AlertTriangle,
  Search,
  ArrowLeft,
  RefreshCw,
  Edit3,
  Save,
  X,
  QrCode,
  Banknote,
  Wallet,
  Sparkles,
  TrendingUp,
  History,
  Check,
  ChefHat,
  Palette,
  MessageCircle,
  Send,
} from "lucide-react";
import {
  Product,
  ProductVariant,
  IngredientItem,
  Order,
  OrderStatus,
  OrderSource,
  PaymentMethod,
  StockLog,
  ShopSettings,
  ChatSession,
} from "@/lib/types";
import BrandingStudio from "@/components/BrandingStudio";

type AdminTab =
  | "POS"
  | "ORDERS"
  | "CHAT"
  | "PRODUCTS"
  | "INVENTORY"
  | "BRANDING"
  | "ANALYTICS";

interface PosCartItem {
  product: Product;
  variant: ProductVariant;
  quantity: number;
}

export default function FlandiAdminPage() {
  const [activeTab, setActiveTab] = useState<AdminTab>("POS");
  const [products, setProducts] = useState<Product[]>([]);
  const [ingredients, setIngredients] = useState<IngredientItem[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [stockLogs, setStockLogs] = useState<StockLog[]>([]);
  const [settings, setSettings] = useState<ShopSettings | null>(null);
  const [chats, setChats] = useState<ChatSession[]>([]);
  const [selectedChatId, setSelectedChatId] = useState<string>("");
  const [adminReplyText, setAdminReplyText] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<string | null>(null);

  // POS State
  const [posCategory, setPosCategory] = useState<string>("ALL");
  const [posSearch, setPosSearch] = useState("");
  const [posCart, setPosCart] = useState<PosCartItem[]>([]);
  const [posSource, setPosSource] = useState<OrderSource>("POS");
  const [posCustomerName, setPosCustomerName] = useState("");
  const [posCustomerPhone, setPosCustomerPhone] = useState("");
  const [posDiscount, setPosDiscount] = useState<number>(0);
  const [posShippingFee, setPosShippingFee] = useState<number>(0);
  const [posPaymentMethod, setPosPaymentMethod] = useState<PaymentMethod>("CASH");
  const [posCashReceived, setPosCashReceived] = useState<number>(0);
  const [posNote, setPosNote] = useState("");
  const [receiptOrder, setReceiptOrder] = useState<Order | null>(null);

  // Orders Filter State
  const [orderStatusFilter, setOrderStatusFilter] = useState<string>("ALL");
  const [orderSearch, setOrderSearch] = useState("");

  // Product Modal State
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [isNewProduct, setIsNewProduct] = useState(false);

  // Inventory Modal State
  const [stockModalTarget, setStockModalTarget] = useState<{
    id: string;
    name: string;
    type: "product" | "ingredient";
    current: number;
    unit: string;
  } | null>(null);
  const [stockChangeAmount, setStockChangeAmount] = useState<number>(20);
  const [stockReason, setStockReason] = useState<string>("Mẻ bánh mới ra lò");

  const [newIngredientModal, setNewIngredientModal] = useState(false);
  const [newIngForm, setNewIngForm] = useState<Partial<IngredientItem>>({
    name: "",
    category: "Nguyên liệu",
    quantity: 10,
    unit: "kg",
    minThreshold: 3,
    costPerUnit: 25000,
  });

  const notify = (msg: string) => {
    setToast(msg);
    setTimeout(() => {
      setToast((prev) => (prev === msg ? null : prev));
    }, 2800);
  };

  const formatVND = (n: number) =>
    new Intl.NumberFormat("vi-VN").format(Math.round(n || 0)) + "đ";

  const fetchAll = async () => {
    try {
      const res = await fetch("/api/store", { cache: "no-store" });
      const data = await res.json();
      setProducts(data.products || []);
      setIngredients(data.ingredients || []);
      setOrders(data.orders || []);
      setStockLogs(data.stockLogs || []);
      setSettings(data.settings || null);
      const loadedChats: ChatSession[] = data.chats || [];
      setChats(loadedChats);
      setSelectedChatId((prev) => prev || loadedChats[0]?.id || "");
    } catch (err) {
      console.error("Failed to fetch store:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
  }, []);

  // --- POS Helpers ---
  const addToPosCart = (product: Product, variant: ProductVariant) => {
    if (product.stock < variant.stockDeduction) {
      notify(`⚠️ Món ${product.name} chỉ còn ${product.stock} ${product.stockUnit}!`);
      return;
    }
    setPosCart((prev) => {
      const idx = prev.findIndex(
        (i) => i.product.id === product.id && i.variant.id === variant.id
      );
      if (idx > -1) {
        const next = [...prev];
        next[idx] = { ...next[idx], quantity: next[idx].quantity + 1 };
        return next;
      }
      return [...prev, { product, variant, quantity: 1 }];
    });
  };

  const updatePosQty = (productId: string, variantId: string, delta: number) => {
    setPosCart((prev) =>
      prev
        .map((item) => {
          if (item.product.id === productId && item.variant.id === variantId) {
            const q = item.quantity + delta;
            return q > 0 ? { ...item, quantity: q } : null;
          }
          return item;
        })
        .filter(Boolean) as PosCartItem[]
    );
  };

  const posSubtotal = useMemo(
    () => posCart.reduce((s, i) => s + i.variant.price * i.quantity, 0),
    [posCart]
  );

  const posTotal = Math.max(0, posSubtotal - posDiscount + posShippingFee);
  const posChangeDue = Math.max(0, (posCashReceived || posTotal) - posTotal);

  const handleCompletePosOrder = async (shouldPrint: boolean) => {
    if (posCart.length === 0) {
      notify("Chưa có món nào trong đơn POS!");
      return;
    }

    try {
      const payload = {
        source: posSource,
        status: "COMPLETED" as OrderStatus,
        customerName: posCustomerName.trim() || "Khách lẻ tại quầy",
        customerPhone: posCustomerPhone.trim(),
        note: posNote.trim(),
        items: posCart.map((i) => ({
          productId: i.product.id,
          productName: i.product.name,
          variantId: i.variant.id,
          variantName: i.variant.name,
          quantity: i.quantity,
          unitPrice: i.variant.price,
          subtotal: i.variant.price * i.quantity,
          stockDeductionPerItem: i.variant.stockDeduction,
        })),
        subtotal: posSubtotal,
        discount: posDiscount,
        shippingFee: posShippingFee,
        total: posTotal,
        paymentMethod: posPaymentMethod,
        isPaid: true,
        cashReceived: posPaymentMethod === "CASH" ? posCashReceived || posTotal : posTotal,
        changeGiven: posPaymentMethod === "CASH" ? posChangeDue : 0,
      };

      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (res.ok && data.order) {
        notify(`✅ Đã tạo đơn #${data.order.code} & trừ kho tự động!`);
        setPosCart([]);
        setPosCustomerName("");
        setPosCustomerPhone("");
        setPosDiscount(0);
        setPosShippingFee(0);
        setPosCashReceived(0);
        setPosNote("");
        fetchAll();

        if (shouldPrint) {
          setReceiptOrder(data.order);
        }
      }
    } catch (e) {
      console.error(e);
      notify("Lỗi khi lưu đơn POS!");
    }
  };

  // --- Order Management Helpers ---
  const handleUpdateOrderStatus = async (
    orderId: string,
    status?: OrderStatus,
    isPaid?: boolean
  ) => {
    try {
      const res = await fetch("/api/orders", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, status, isPaid }),
      });
      if (res.ok) {
        notify("Đã cập nhật trạng thái đơn hàng!");
        fetchAll();
      }
    } catch (e) {
      console.error(e);
    }
  };

  // --- Product Helpers ---
  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProduct) return;

    try {
      const method = isNewProduct ? "POST" : "PUT";
      const res = await fetch("/api/products", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editingProduct),
      });
      if (res.ok) {
        notify(
          isNewProduct
            ? `Đã thêm món "${editingProduct.name}"!`
            : `Đã cập nhật món "${editingProduct.name}"!`
        );
        setEditingProduct(null);
        fetchAll();
      }
    } catch (err) {
      console.error(err);
      notify("Lỗi khi lưu sản phẩm!");
    }
  };

  const handleToggleProductActive = async (product: Product) => {
    try {
      await fetch("/api/products", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...product, isActive: !product.isActive }),
      });
      notify(
        !product.isActive
          ? `Đã mở bán lại ${product.name}`
          : `Đã tạm ẩn ${product.name} trên trang khách`
      );
      fetchAll();
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteProduct = async (product: Product) => {
    if (!confirm(`Bạn có chắc muốn xoá món "${product.name}"?`)) return;
    try {
      await fetch(`/api/products?id=${product.id}`, { method: "DELETE" });
      notify(`Đã xoá món ${product.name}`);
      fetchAll();
    } catch (e) {
      console.error(e);
    }
  };

  // --- Inventory Helpers ---
  const quickAdjustStock = async (
    targetId: string,
    targetType: "product" | "ingredient",
    change: number,
    reason: string
  ) => {
    try {
      const res = await fetch("/api/inventory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetId, targetType, change, reason }),
      });
      if (res.ok) {
        notify(
          `Đã cập nhật tồn kho (${change > 0 ? `+${change}` : change}): ${reason}`
        );
        fetchAll();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleConfirmStockModal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stockModalTarget) return;
    await quickAdjustStock(
      stockModalTarget.id,
      stockModalTarget.type,
      stockChangeAmount,
      stockReason
    );
    setStockModalTarget(null);
  };

  const handleAddIngredient = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch("/api/inventory", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newIngForm),
      });
      if (res.ok) {
        notify(`Đã thêm nguyên liệu "${newIngForm.name}"!`);
        setNewIngredientModal(false);
        setNewIngForm({
          name: "",
          category: "Nguyên liệu",
          quantity: 10,
          unit: "kg",
          minThreshold: 3,
          costPerUnit: 25000,
        });
        fetchAll();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settings) return;
    try {
      const res = await fetch("/api/store", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings }),
      });
      if (res.ok) {
        notify("Đã lưu cài đặt cửa hàng FLANDI!");
        fetchAll();
      }
    } catch (e) {
      console.error(e);
    }
  };

  // --- Computed Analytics ---
  const validOrders = useMemo(
    () => orders.filter((o) => o.status !== "CANCELLED"),
    [orders]
  );

  const pendingOrdersCount = useMemo(
    () =>
      orders.filter((o) => o.status === "PENDING" || o.status === "PREPARING")
        .length,
    [orders]
  );

  const lowStockCount = useMemo(() => {
    const lowProds = products.filter((p) => p.stock <= p.lowStockThreshold).length;
    const lowIngs = ingredients.filter((i) => i.quantity <= i.minThreshold).length;
    return lowProds + lowIngs;
  }, [products, ingredients]);

  const analytics = useMemo(() => {
    let totalRevenue = 0;
    let estimatedCost = 0;
    const productSales: Record<
      string,
      { name: string; image: string; qty: number; revenue: number }
    > = {};

    validOrders.forEach((o) => {
      totalRevenue += o.total;
      o.items.forEach((item) => {
        const prod = products.find((p) => p.id === item.productId);
        const unitCost = prod ? prod.costPrice : item.unitPrice * 0.5;
        estimatedCost +=
          unitCost * (item.stockDeductionPerItem || 1) * item.quantity;

        if (!productSales[item.productId]) {
          productSales[item.productId] = {
            name: item.productName,
            image: prod?.image || "/images/products/flan.png",
            qty: 0,
            revenue: 0,
          };
        }
        productSales[item.productId].qty += item.quantity;
        productSales[item.productId].revenue += item.subtotal;
      });
    });

    const bestSellers = Object.values(productSales).sort(
      (a, b) => b.revenue - a.revenue
    );

    return {
      totalRevenue,
      estimatedProfit: Math.max(0, totalRevenue - estimatedCost),
      totalOrders: validOrders.length,
      avgOrderValue:
        validOrders.length > 0 ? totalRevenue / validOrders.length : 0,
      bestSellers,
    };
  }, [validOrders, products]);

  const filteredPosProducts = useMemo(() => {
    return products.filter((p) => {
      const matchCat = posCategory === "ALL" || p.category === posCategory;
      const q = posSearch.trim().toLowerCase();
      const matchQ =
        !q ||
        p.name.toLowerCase().includes(q) ||
        p.subtitle.toLowerCase().includes(q);
      return matchCat && matchQ;
    });
  }, [products, posCategory, posSearch]);

  const filteredOrders = useMemo(() => {
    return orders.filter((o) => {
      const matchStatus =
        orderStatusFilter === "ALL" || o.status === orderStatusFilter;
      const q = orderSearch.trim().toLowerCase();
      const matchQ =
        !q ||
        o.code.toLowerCase().includes(q) ||
        o.customerName.toLowerCase().includes(q) ||
        o.customerPhone.toLowerCase().includes(q);
      return matchStatus && matchQ;
    });
  }, [orders, orderStatusFilter, orderSearch]);

  return (
    <div className="min-h-screen bg-[#FFF9F8] flex flex-col">
      {/* Toast */}
      {toast && (
        <div className="fixed bottom-5 right-5 z-50 bg-flandi-dark text-white px-5 py-3 rounded-2xl shadow-cute-lg flex items-center gap-2.5 animate-bounce">
          <Sparkles className="w-4 h-4 text-flandi-salmon" />
          <span className="text-xs sm:text-sm font-bold">{toast}</span>
        </div>
      )}

      {/* Top Admin Header */}
      <header className="bg-white border-b border-flandi-pink sticky top-0 z-30 px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="p-2 rounded-full bg-flandi-bg hover:bg-flandi-pink/50 text-flandi-coral border border-flandi-pink transition"
            title="Về trang chủ khách hàng"
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
                FLANDI POS & ADMIN
              </h1>
              <span className="text-[11px] font-bold text-flandi-muted block">
                Hệ thống Quản lý Bán hàng, Thực đơn & Kho bánh
              </span>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav className="flex items-center gap-1.5 overflow-x-auto py-1">
          <button
            onClick={() => setActiveTab("POS")}
            className={`px-3.5 py-2 rounded-xl text-xs font-extrabold flex items-center gap-1.5 transition whitespace-nowrap ${
              activeTab === "POS"
                ? "bg-flandi-coral text-white shadow-sm"
                : "text-flandi-dark hover:bg-flandi-cream"
            }`}
          >
            <Store className="w-4 h-4" />
            <span>Bán Hàng (POS)</span>
          </button>

          <button
            onClick={() => setActiveTab("ORDERS")}
            className={`px-3.5 py-2 rounded-xl text-xs font-extrabold flex items-center gap-1.5 transition whitespace-nowrap ${
              activeTab === "ORDERS"
                ? "bg-flandi-coral text-white shadow-sm"
                : "text-flandi-dark hover:bg-flandi-cream"
            }`}
          >
            <ShoppingBag className="w-4 h-4" />
            <span>Đơn Hàng ({orders.length})</span>
            {pendingOrdersCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-amber-400 text-flandi-dark text-[10px] font-black">
                {pendingOrdersCount} mới
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab("CHAT")}
            className={`px-3.5 py-2 rounded-xl text-xs font-extrabold flex items-center gap-1.5 transition whitespace-nowrap ${
              activeTab === "CHAT"
                ? "bg-flandi-coral text-white shadow-sm"
                : "text-flandi-dark hover:bg-flandi-cream"
            }`}
          >
            <MessageCircle className="w-4 h-4" />
            <span>Tin Nhắn Web ({chats.length})</span>
            {chats.reduce((s, c) => s + (c.unreadForAdmin || 0), 0) > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-[#006AFF] text-white text-[10px] font-black">
                {chats.reduce((s, c) => s + (c.unreadForAdmin || 0), 0)} mới
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab("PRODUCTS")}
            className={`px-3.5 py-2 rounded-xl text-xs font-extrabold flex items-center gap-1.5 transition whitespace-nowrap ${
              activeTab === "PRODUCTS"
                ? "bg-flandi-coral text-white shadow-sm"
                : "text-flandi-dark hover:bg-flandi-cream"
            }`}
          >
            <Package className="w-4 h-4" />
            <span>Thực Đơn ({products.length})</span>
          </button>

          <button
            onClick={() => setActiveTab("INVENTORY")}
            className={`px-3.5 py-2 rounded-xl text-xs font-extrabold flex items-center gap-1.5 transition whitespace-nowrap ${
              activeTab === "INVENTORY"
                ? "bg-flandi-coral text-white shadow-sm"
                : "text-flandi-dark hover:bg-flandi-cream"
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>Kho Bánh & Nguyên Liệu</span>
            {lowStockCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-red-500 text-white text-[10px] font-black">
                {lowStockCount} sắp hết
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab("BRANDING")}
            className={`px-3.5 py-2 rounded-xl text-xs font-extrabold flex items-center gap-1.5 transition whitespace-nowrap ${
              activeTab === "BRANDING"
                ? "bg-flandi-coral text-white shadow-sm"
                : "text-flandi-dark hover:bg-flandi-cream"
            }`}
          >
            <Palette className="w-4 h-4" />
            <span>Bộ Nhận Diện HD</span>
          </button>

          <button
            onClick={() => setActiveTab("ANALYTICS")}
            className={`px-3.5 py-2 rounded-xl text-xs font-extrabold flex items-center gap-1.5 transition whitespace-nowrap ${
              activeTab === "ANALYTICS"
                ? "bg-flandi-coral text-white shadow-sm"
                : "text-flandi-dark hover:bg-flandi-cream"
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            <span>Doanh Thu & Cài Đặt</span>
          </button>
        </nav>

        <div className="hidden lg:flex items-center gap-2">
          <button
            onClick={fetchAll}
            className="p-2 rounded-xl border border-flandi-pink hover:bg-flandi-cream text-flandi-muted"
            title="Làm mới dữ liệu"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <Link
            href="/"
            className="px-3.5 py-2 rounded-xl bg-flandi-cream hover:bg-flandi-pink/60 text-flandi-coral font-extrabold text-xs"
          >
            Xem Web Khách
          </Link>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6">
        {/* ==================== TAB 1: POS COUNTER ==================== */}
        {activeTab === "POS" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left 7 Cols: Product Selection Grid */}
            <div className="lg:col-span-7 space-y-4">
              <div className="bg-white p-4 rounded-2xl border border-flandi-pink shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto">
                  {[
                    { id: "ALL", label: "Tất cả" },
                    { id: "Flan & Pudding", label: "Flan" },
                    { id: "Panna Cotta", label: "Panna Cotta" },
                    { id: "Rau Câu", label: "Rau Câu" },
                    { id: "Tàu Hũ & Yogurt", label: "Tàu Hũ & Yogurt" },
                  ].map((c) => (
                    <button
                      key={c.id}
                      onClick={() => setPosCategory(c.id)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-extrabold whitespace-nowrap transition ${
                        posCategory === c.id
                          ? "bg-flandi-coral text-white"
                          : "bg-flandi-bg text-flandi-dark hover:bg-flandi-pink/40"
                      }`}
                    >
                      {c.label}
                    </button>
                  ))}
                </div>

                <div className="relative w-full sm:w-56">
                  <Search className="w-4 h-4 text-flandi-muted absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={posSearch}
                    onChange={(e) => setPosSearch(e.target.value)}
                    placeholder="Tìm nhanh món..."
                    className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-flandi-pink text-xs font-semibold focus:border-flandi-coral focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {filteredPosProducts.map((product) => {
                  const isLow = product.stock <= product.lowStockThreshold;
                  return (
                    <div
                      key={product.id}
                      className="bg-white rounded-2xl border-2 border-flandi-pink hover:border-flandi-salmon p-4 shadow-xs transition flex flex-col justify-between gap-3"
                    >
                      <div className="flex items-center gap-3.5">
                        <div className="relative w-16 h-16 rounded-full p-1 bg-flandi-salmon shrink-0">
                          <img
                            src={product.image}
                            alt={product.name}
                            className="w-full h-full object-cover rounded-full border border-white"
                          />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-1">
                            <h3 className="font-extrabold text-base text-flandi-dark truncate">
                              {product.name}
                            </h3>
                            <span
                              className={`text-[11px] font-extrabold px-2 py-0.5 rounded-full shrink-0 ${
                                product.stock <= 0
                                  ? "bg-red-100 text-red-700"
                                  : isLow
                                  ? "bg-amber-100 text-amber-800"
                                  : "bg-emerald-50 text-emerald-700"
                              }`}
                            >
                              Kho: {product.stock} {product.stockUnit}
                            </span>
                          </div>
                          <p className="text-xs text-flandi-coral font-bold">
                            {product.badgeText}
                            {product.secondaryBadgeText
                              ? ` • ${product.secondaryBadgeText}`
                              : ""}
                          </p>
                        </div>
                      </div>

                      {/* Quick Variant Tap Buttons for Fast Cashier Entry */}
                      <div className="grid grid-cols-1 gap-1.5 pt-2 border-t border-flandi-pink/50">
                        {product.variants.map((v) => {
                          const disabled = product.stock < v.stockDeduction;
                          return (
                            <button
                              key={v.id}
                              disabled={disabled}
                              onClick={() => addToPosCart(product, v)}
                              className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center justify-between border transition ${
                                disabled
                                  ? "bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed"
                                  : "bg-flandi-bg hover:bg-flandi-salmon hover:text-white border-flandi-pink text-flandi-dark active:scale-98"
                              }`}
                            >
                              <span className="truncate">+ {v.name}</span>
                              <span className="font-extrabold shrink-0 ml-2">
                                {formatVND(v.price)}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Right 5 Cols: Active POS Ticket & Checkout */}
            <div className="lg:col-span-5 bg-white rounded-3xl border-2 border-flandi-salmon shadow-cute p-5 space-y-4 sticky top-20">
              <div className="flex items-center justify-between border-b border-flandi-pink pb-3">
                <div>
                  <h2 className="font-extrabold text-base text-flandi-dark flex items-center gap-2">
                    <Store className="w-5 h-5 text-flandi-coral" />
                    <span>Phiếu Bán Hàng POS</span>
                  </h2>
                  <p className="text-xs text-flandi-muted font-semibold">
                    Tự động trừ tồn kho khi hoàn tất thanh toán
                  </p>
                </div>
                {posCart.length > 0 && (
                  <button
                    onClick={() => setPosCart([])}
                    className="text-xs text-red-500 hover:underline font-bold flex items-center gap-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Xoá giỏ
                  </button>
                )}
              </div>

              {/* Order Source Tabs */}
              <div className="grid grid-cols-3 gap-1.5 p-1 bg-flandi-bg rounded-xl border border-flandi-pink">
                {(
                  [
                    { id: "POS", label: "🏪 Tại Quầy" },
                    { id: "ZALO", label: "💬 Đơn Zalo" },
                    { id: "GRAB_SHOPEE", label: "🛵 App Giao" },
                  ] as { id: OrderSource; label: string }[]
                ).map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setPosSource(s.id)}
                    className={`py-1.5 rounded-lg text-xs font-extrabold transition ${
                      posSource === s.id
                        ? "bg-flandi-coral text-white shadow-xs"
                        : "text-flandi-muted"
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>

              {/* Customer Info */}
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  value={posCustomerName}
                  onChange={(e) => setPosCustomerName(e.target.value)}
                  placeholder="Tên khách (tuỳ chọn)"
                  className="px-3 py-2 rounded-xl border border-flandi-pink text-xs font-semibold focus:border-flandi-coral focus:outline-none"
                />
                <input
                  type="tel"
                  value={posCustomerPhone}
                  onChange={(e) => setPosCustomerPhone(e.target.value)}
                  placeholder="SĐT khách (tuỳ chọn)"
                  className="px-3 py-2 rounded-xl border border-flandi-pink text-xs font-semibold focus:border-flandi-coral focus:outline-none"
                />
              </div>

              {/* Cart Items List */}
              <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
                {posCart.length === 0 ? (
                  <div className="py-10 text-center text-xs text-flandi-muted font-semibold border border-dashed border-flandi-pink rounded-2xl">
                    Chạm vào các món bên trái để lên đơn nhanh
                  </div>
                ) : (
                  posCart.map((item) => (
                    <div
                      key={`${item.product.id}-${item.variant.id}`}
                      className="p-2.5 rounded-xl bg-flandi-bg border border-flandi-pink flex items-center justify-between gap-2"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-extrabold text-xs text-flandi-dark truncate">
                          {item.product.name}
                        </p>
                        <p className="text-[11px] text-flandi-muted font-semibold truncate">
                          {item.variant.name} • {formatVND(item.variant.price)}
                        </p>
                      </div>

                      <div className="flex items-center gap-1.5 bg-white rounded-full px-2 py-0.5 border border-flandi-pink">
                        <button
                          onClick={() =>
                            updatePosQty(item.product.id, item.variant.id, -1)
                          }
                          className="w-5 h-5 flex items-center justify-center text-flandi-dark"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="text-xs font-extrabold w-5 text-center">
                          {item.quantity}
                        </span>
                        <button
                          onClick={() =>
                            updatePosQty(item.product.id, item.variant.id, 1)
                          }
                          className="w-5 h-5 flex items-center justify-center text-flandi-coral"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>

                      <span className="text-xs font-extrabold text-flandi-coral w-20 text-right">
                        {formatVND(item.variant.price * item.quantity)}
                      </span>
                    </div>
                  ))
                )}
              </div>

              {/* Discount & Shipping Adjustments */}
              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-flandi-pink">
                <div>
                  <label className="text-[11px] font-bold text-flandi-muted block mb-1">
                    Giảm giá (đ)
                  </label>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      min={0}
                      step={1000}
                      value={posDiscount || ""}
                      onChange={(e) => setPosDiscount(Number(e.target.value) || 0)}
                      placeholder="0"
                      className="w-full px-2.5 py-1.5 rounded-xl border border-flandi-pink text-xs font-bold"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setPosDiscount(Math.round(posSubtotal * 0.1))
                      }
                      className="px-2 py-1.5 rounded-lg bg-flandi-cream text-flandi-coral text-[10px] font-extrabold shrink-0"
                    >
                      -10%
                    </button>
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-flandi-muted block mb-1">
                    Phí ship (đ)
                  </label>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      min={0}
                      step={1000}
                      value={posShippingFee || ""}
                      onChange={(e) =>
                        setPosShippingFee(Number(e.target.value) || 0)
                      }
                      placeholder="0"
                      className="w-full px-2.5 py-1.5 rounded-xl border border-flandi-pink text-xs font-bold"
                    />
                    <button
                      type="button"
                      onClick={() => setPosShippingFee(15000)}
                      className="px-2 py-1.5 rounded-lg bg-flandi-cream text-flandi-coral text-[10px] font-extrabold shrink-0"
                    >
                      +15k
                    </button>
                  </div>
                </div>
              </div>

              {/* Payment Method */}
              <div className="space-y-2">
                <label className="text-[11px] font-bold text-flandi-muted block">
                  Phương thức thanh toán
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(
                    [
                      { id: "CASH", label: "Tiền mặt", icon: Banknote },
                      { id: "VIETQR", label: "VietQR", icon: QrCode },
                      { id: "MOMO", label: "Ví MoMo", icon: Wallet },
                    ] as const
                  ).map((pm) => {
                    const Icon = pm.icon;
                    return (
                      <button
                        key={pm.id}
                        type="button"
                        onClick={() => setPosPaymentMethod(pm.id)}
                        className={`py-2 px-2.5 rounded-xl border text-xs font-extrabold flex items-center justify-center gap-1.5 transition ${
                          posPaymentMethod === pm.id
                            ? "border-flandi-coral bg-flandi-salmon/15 text-flandi-coral"
                            : "border-flandi-pink text-flandi-dark"
                        }`}
                      >
                        <Icon className="w-3.5 h-3.5" />
                        <span>{pm.label}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Cash Tender Quick Calculator */}
                {posPaymentMethod === "CASH" && posTotal > 0 && (
                  <div className="p-3 rounded-2xl bg-flandi-bg border border-flandi-pink space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-flandi-muted">
                        Khách đưa:
                      </span>
                      <input
                        type="number"
                        value={posCashReceived || ""}
                        onChange={(e) =>
                          setPosCashReceived(Number(e.target.value) || 0)
                        }
                        placeholder={String(posTotal)}
                        className="w-28 px-2.5 py-1 rounded-lg border border-flandi-pink text-right font-extrabold text-flandi-dark bg-white"
                      />
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {[posTotal, 50000, 100000, 200000, 500000].map((amt, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => setPosCashReceived(amt)}
                          className="px-2 py-1 rounded-lg bg-white border border-flandi-pink text-[11px] font-bold hover:border-flandi-coral"
                        >
                          {i === 0 ? "Đưa đủ" : `${amt / 1000}k`}
                        </button>
                      ))}
                    </div>
                    <div className="flex items-center justify-between text-xs pt-1 border-t border-flandi-pink/60">
                      <span className="font-bold text-flandi-muted">
                        Tiền thối lại:
                      </span>
                      <span className="font-extrabold text-emerald-600 text-sm">
                        {formatVND(posChangeDue)}
                      </span>
                    </div>
                  </div>
                )}

                {/* Live VietQR Preview in POS */}
                {posPaymentMethod === "VIETQR" && posTotal > 0 && settings && (
                  <div className="p-3 rounded-2xl bg-flandi-bg border border-flandi-pink flex items-center gap-3">
                    <img
                      src={`https://img.vietqr.io/image/${settings.bankBin}-${settings.bankAccountNo}-compact2.png?amount=${posTotal}&addInfo=${encodeURIComponent(
                        "FLANDI POS"
                      )}`}
                      alt="VietQR"
                      className="w-20 h-20 rounded-lg border border-flandi-pink bg-white object-contain shrink-0"
                    />
                    <div className="text-xs space-y-1">
                      <p className="font-extrabold text-flandi-dark">
                        Quét mã VietQR ({settings.bankName})
                      </p>
                      <p className="text-flandi-muted font-semibold">
                        STK: {settings.bankAccountNo}
                      </p>
                      <p className="text-flandi-coral font-extrabold">
                        Số tiền: {formatVND(posTotal)}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Totals Summary */}
              <div className="pt-2 border-t border-flandi-pink space-y-1 text-xs">
                <div className="flex justify-between text-flandi-muted font-semibold">
                  <span>Tạm tính:</span>
                  <span>{formatVND(posSubtotal)}</span>
                </div>
                {posDiscount > 0 && (
                  <div className="flex justify-between text-emerald-600 font-bold">
                    <span>Giảm giá:</span>
                    <span>-{formatVND(posDiscount)}</span>
                  </div>
                )}
                {posShippingFee > 0 && (
                  <div className="flex justify-between text-flandi-muted font-semibold">
                    <span>Phí giao hàng:</span>
                    <span>+{formatVND(posShippingFee)}</span>
                  </div>
                )}
                <div className="flex justify-between text-lg font-extrabold text-flandi-dark pt-1">
                  <span>KHÁCH CẦN TRẢ:</span>
                  <span className="text-flandi-coral">{formatVND(posTotal)}</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="grid grid-cols-2 gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={() => handleCompletePosOrder(false)}
                  disabled={posCart.length === 0}
                  className="py-3 rounded-2xl bg-flandi-cream hover:bg-flandi-pink/70 text-flandi-coral font-extrabold text-xs border border-flandi-salmon transition disabled:opacity-40"
                >
                  Thanh Toán Nhanh
                </button>
                <button
                  type="button"
                  onClick={() => handleCompletePosOrder(true)}
                  disabled={posCart.length === 0}
                  className="py-3 rounded-2xl bg-flandi-coral hover:bg-flandi-salmon text-white font-extrabold text-xs shadow-cute flex items-center justify-center gap-1.5 transition disabled:opacity-40"
                >
                  <Printer className="w-4 h-4" />
                  <span>Thu Tiền & In Bill</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ==================== TAB 2: ORDERS MANAGEMENT ==================== */}
        {activeTab === "ORDERS" && (
          <div className="space-y-5">
            <div className="bg-white p-4 rounded-2xl border border-flandi-pink flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto">
                {[
                  { id: "ALL", label: "Tất cả đơn" },
                  { id: "PENDING", label: "⏳ Chờ xác nhận" },
                  { id: "PREPARING", label: "🍮 Đang chuẩn bị" },
                  { id: "COMPLETED", label: "✅ Hoàn thành" },
                  { id: "CANCELLED", label: "❌ Đã huỷ" },
                ].map((st) => (
                  <button
                    key={st.id}
                    onClick={() => setOrderStatusFilter(st.id)}
                    className={`px-3.5 py-2 rounded-xl text-xs font-extrabold whitespace-nowrap transition ${
                      orderStatusFilter === st.id
                        ? "bg-flandi-coral text-white"
                        : "bg-flandi-bg text-flandi-dark hover:bg-flandi-pink/40"
                    }`}
                  >
                    {st.label}
                  </button>
                ))}
              </div>

              <div className="relative w-full sm:w-64">
                <Search className="w-4 h-4 text-flandi-muted absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={orderSearch}
                  onChange={(e) => setOrderSearch(e.target.value)}
                  placeholder="Mã đơn, tên khách, SĐT..."
                  className="w-full pl-9 pr-3 py-2 rounded-xl border border-flandi-pink text-xs font-semibold"
                />
              </div>
            </div>

            <div className="space-y-3">
              {filteredOrders.map((order) => (
                <div
                  key={order.id}
                  className="bg-white rounded-2xl border-2 border-flandi-pink p-5 shadow-xs flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4"
                >
                  <div className="space-y-1.5 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-extrabold text-base text-flandi-coral">
                        #{order.code}
                      </span>
                      <span className="px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-flandi-cream text-flandi-dark border border-flandi-pink">
                        {order.source === "ONLINE"
                          ? "🌐 Đặt trên Web"
                          : order.source === "POS"
                          ? "🏪 Tại quầy POS"
                          : order.source}
                      </span>
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[11px] font-extrabold ${
                          order.status === "COMPLETED"
                            ? "bg-emerald-100 text-emerald-700"
                            : order.status === "PENDING"
                            ? "bg-amber-100 text-amber-800"
                            : order.status === "PREPARING"
                            ? "bg-blue-100 text-blue-700"
                            : "bg-red-100 text-red-700"
                        }`}
                      >
                        {order.status === "COMPLETED"
                          ? "Hoàn thành"
                          : order.status === "PENDING"
                          ? "Chờ xác nhận"
                          : order.status === "PREPARING"
                          ? "Đang chuẩn bị"
                          : "Đã huỷ (Đã hoàn kho)"}
                      </span>
                      <span className="text-xs text-flandi-muted font-semibold">
                        {new Date(order.createdAt).toLocaleString("vi-VN")}
                      </span>
                    </div>

                    <p className="text-xs font-bold text-flandi-dark">
                      Khách: {order.customerName}{" "}
                      {order.customerPhone ? `• 📞 ${order.customerPhone}` : ""}{" "}
                      {order.customerAddress ? `• 📍 ${order.customerAddress}` : ""}
                    </p>

                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {order.items.map((item, i) => (
                        <span
                          key={i}
                          className="px-2.5 py-1 rounded-lg bg-flandi-bg border border-flandi-pink text-xs font-bold text-flandi-dark"
                        >
                          {item.quantity}x {item.productName} ({item.variantName})
                        </span>
                      ))}
                    </div>

                    {order.note && (
                      <p className="text-xs text-amber-800 bg-amber-50 px-3 py-1 rounded-lg inline-block font-semibold">
                        📝 Ghi chú: {order.note}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-wrap sm:flex-nowrap items-center gap-3 w-full lg:w-auto justify-between lg:justify-end border-t lg:border-t-0 pt-3 lg:pt-0 border-flandi-pink">
                    <div className="text-left lg:text-right">
                      <span className="text-lg font-extrabold text-flandi-coral block">
                        {formatVND(order.total)}
                      </span>
                      <button
                        onClick={() =>
                          handleUpdateOrderStatus(
                            order.id,
                            undefined,
                            !order.isPaid
                          )
                        }
                        className={`text-[11px] font-extrabold px-2 py-0.5 rounded-md ${
                          order.isPaid
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-orange-100 text-orange-700"
                        }`}
                      >
                        {order.paymentMethod} •{" "}
                        {order.isPaid ? "Đã thu tiền" : "Chưa thu (Bấm để thu)"}
                      </button>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {order.status === "PENDING" && (
                        <button
                          onClick={() =>
                            handleUpdateOrderStatus(order.id, "PREPARING")
                          }
                          className="px-3 py-2 rounded-xl bg-blue-600 text-white text-xs font-extrabold hover:bg-blue-700"
                        >
                          Nhận đơn
                        </button>
                      )}
                      {(order.status === "PENDING" ||
                        order.status === "PREPARING") && (
                        <button
                          onClick={() =>
                            handleUpdateOrderStatus(order.id, "COMPLETED", true)
                          }
                          className="px-3 py-2 rounded-xl bg-emerald-600 text-white text-xs font-extrabold hover:bg-emerald-700"
                        >
                          Hoàn thành
                        </button>
                      )}
                      {order.status !== "CANCELLED" && (
                        <button
                          onClick={() =>
                            handleUpdateOrderStatus(order.id, "CANCELLED")
                          }
                          className="px-2.5 py-2 rounded-xl bg-red-50 text-red-600 hover:bg-red-100 text-xs font-bold"
                          title="Huỷ đơn & Hoàn kho"
                        >
                          Huỷ
                        </button>
                      )}
                      <button
                        onClick={() => setReceiptOrder(order)}
                        className="p-2 rounded-xl bg-flandi-cream text-flandi-coral hover:bg-flandi-pink/60"
                        title="In hoá đơn"
                      >
                        <Printer className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ==================== TAB 3: PRODUCTS & MENU MANAGEMENT ==================== */}
        {activeTab === "PRODUCTS" && (
          <div className="space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-5 rounded-2xl border border-flandi-pink">
              <div>
                <h2 className="font-extrabold text-lg text-flandi-dark">
                  Quản Lý Thực Đơn & Bảng Giá FLANDI
                </h2>
                <p className="text-xs text-flandi-muted font-semibold">
                  Chỉnh sửa tên món, giá theo cái / chục / hộp, phân loại vị và trạng thái mở bán
                </p>
              </div>
              <button
                onClick={() => {
                  setIsNewProduct(true);
                  setEditingProduct({
                    id: `prod-${Date.now()}`,
                    name: "",
                    subtitle: "",
                    category: "Flan & Pudding",
                    description: "",
                    price: 10000,
                    costPrice: 5000,
                    unit: "cái",
                    badgeText: "10k / cái",
                    secondaryBadgeText: "",
                    image: "/images/products/flan.png",
                    stock: 50,
                    stockUnit: "cái",
                    lowStockThreshold: 10,
                    isActive: true,
                    isBestSeller: false,
                    variants: [
                      {
                        id: `var-${Date.now()}`,
                        name: "Tiêu chuẩn (1 cái)",
                        price: 10000,
                        unitLabel: "cái",
                        stockDeduction: 1,
                      },
                    ],
                  });
                }}
                className="px-4 py-2.5 rounded-xl bg-flandi-coral hover:bg-flandi-salmon text-white font-extrabold text-xs flex items-center gap-1.5 shadow-cute self-start sm:self-auto"
              >
                <Plus className="w-4 h-4" />
                <span>Thêm Món Tráng Miệng Mới</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {products.map((p) => (
                <div
                  key={p.id}
                  className={`bg-white rounded-3xl border-2 p-5 shadow-xs flex flex-col justify-between gap-4 ${
                    p.isActive ? "border-flandi-pink" : "border-gray-200 opacity-75"
                  }`}
                >
                  <div>
                    <div className="flex items-center gap-3.5">
                      <img
                        src={p.image}
                        alt={p.name}
                        className="w-16 h-16 rounded-full object-cover border-2 border-flandi-salmon shrink-0"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <h3 className="font-extrabold text-base text-flandi-dark truncate">
                            {p.name}
                          </h3>
                          {p.isBestSeller && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-extrabold">
                              HOT
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-flandi-muted font-semibold truncate">
                          {p.subtitle}
                        </p>
                        <div className="flex items-center gap-1.5 mt-1">
                          <span className="text-xs font-extrabold text-flandi-coral bg-flandi-cream px-2 py-0.5 rounded-md">
                            {p.badgeText}
                          </span>
                          {p.secondaryBadgeText && (
                            <span className="text-xs font-extrabold text-white bg-flandi-coral px-2 py-0.5 rounded-md">
                              {p.secondaryBadgeText}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="mt-3 pt-3 border-t border-flandi-pink/60 space-y-1.5">
                      <p className="text-[11px] font-extrabold uppercase text-flandi-muted">
                        Các phân loại & Giá bán ({p.variants.length}):
                      </p>
                      {p.variants.map((v) => (
                        <div
                          key={v.id}
                          className="flex justify-between text-xs bg-flandi-bg px-2.5 py-1 rounded-lg font-semibold"
                        >
                          <span>{v.name}</span>
                          <span className="font-extrabold text-flandi-coral">
                            {formatVND(v.price)} (-{v.stockDeduction} {p.stockUnit})
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t border-flandi-pink/60 gap-2">
                    <button
                      onClick={() => handleToggleProductActive(p)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-extrabold ${
                        p.isActive
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-gray-200 text-gray-700"
                      }`}
                    >
                      {p.isActive ? "Đang mở bán" : "Đang tạm ẩn"}
                    </button>

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => {
                          setIsNewProduct(false);
                          setEditingProduct(JSON.parse(JSON.stringify(p)));
                        }}
                        className="px-3 py-1.5 rounded-xl bg-flandi-cream hover:bg-flandi-pink/60 text-flandi-coral font-extrabold text-xs flex items-center gap-1"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>Sửa món</span>
                      </button>
                      <button
                        onClick={() => handleDeleteProduct(p)}
                        className="p-1.5 rounded-xl bg-red-50 hover:bg-red-100 text-red-600"
                        title="Xoá món"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ==================== TAB 4: INVENTORY & BATCH STOCK ==================== */}
        {activeTab === "INVENTORY" && (
          <div className="space-y-8">
            {/* Section A: Finished Dessert Batch Stock */}
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-white p-5 rounded-2xl border border-flandi-pink">
                <div>
                  <h2 className="font-extrabold text-lg text-flandi-dark flex items-center gap-2">
                    <ChefHat className="w-5 h-5 text-flandi-coral" />
                    <span>Tồn Kho Mẻ Bánh Thành Phẩm Hôm Nay</span>
                  </h2>
                  <p className="text-xs text-flandi-muted font-semibold">
                    Tự động trừ khi có đơn POS hoặc đơn khách đặt online. Bấm “+ Mẻ mới” khi bánh vừa ra lò!
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {products.map((p) => {
                  const isLow = p.stock <= p.lowStockThreshold;
                  return (
                    <div
                      key={p.id}
                      className={`bg-white rounded-2xl border-2 p-4 space-y-3 ${
                        isLow ? "border-amber-400" : "border-flandi-pink"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <img
                            src={p.image}
                            alt={p.name}
                            className="w-12 h-12 rounded-full object-cover border border-flandi-salmon"
                          />
                          <div>
                            <h3 className="font-extrabold text-sm text-flandi-dark">
                              {p.name}
                            </h3>
                            <p className="text-[11px] text-flandi-muted font-semibold">
                              Định mức cảnh báo: {p.lowStockThreshold} {p.stockUnit}
                            </p>
                          </div>
                        </div>

                        <div className="text-right">
                          <span
                            className={`text-xl font-black ${
                              p.stock === 0
                                ? "text-red-600"
                                : isLow
                                ? "text-amber-600"
                                : "text-emerald-600"
                            }`}
                          >
                            {p.stock}
                          </span>
                          <span className="text-xs font-bold text-flandi-muted block">
                            {p.stockUnit}
                          </span>
                        </div>
                      </div>

                      {isLow && (
                        <div className="px-3 py-1.5 rounded-xl bg-amber-50 text-amber-800 text-xs font-bold flex items-center gap-1.5">
                          <AlertTriangle className="w-4 h-4 shrink-0" />
                          <span>Sắp hết mẻ bánh! Cần làm thêm mẻ mới.</span>
                        </div>
                      )}

                      <div className="flex items-center gap-1.5 pt-1">
                        <button
                          onClick={() =>
                            quickAdjustStock(
                              p.id,
                              "product",
                              10,
                              "Ra lò thêm +10 " + p.stockUnit
                            )
                          }
                          className="flex-1 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-extrabold text-xs"
                        >
                          +10 {p.stockUnit}
                        </button>
                        <button
                          onClick={() =>
                            quickAdjustStock(
                              p.id,
                              "product",
                              30,
                              "Ra lò mẻ mới +30 " + p.stockUnit
                            )
                          }
                          className="flex-1 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs"
                        >
                          +30 Mẻ mới
                        </button>
                        <button
                          onClick={() => {
                            setStockModalTarget({
                              id: p.id,
                              name: p.name,
                              type: "product",
                              current: p.stock,
                              unit: p.stockUnit,
                            });
                            setStockChangeAmount(20);
                            setStockReason("Nhập mẻ bánh mới");
                          }}
                          className="px-3 py-2 rounded-xl bg-flandi-bg hover:bg-flandi-pink/50 text-flandi-dark font-bold text-xs border border-flandi-pink"
                        >
                          Tuỳ chỉnh
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Section B: Raw Ingredients & Packaging Inventory */}
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-white p-5 rounded-2xl border border-flandi-pink">
                <div>
                  <h2 className="font-extrabold text-lg text-flandi-dark">
                    Kho Nguyên Liệu Bếp & Bao Bì Hũ Nhựa
                  </h2>
                  <p className="text-xs text-flandi-muted font-semibold">
                    Theo dõi trứng gà, sữa tươi, kem tươi whipping, nước dừa, sốt trái cây và hũ đựng
                  </p>
                </div>
                <button
                  onClick={() => setNewIngredientModal(true)}
                  className="px-4 py-2 rounded-xl bg-flandi-coral text-white font-extrabold text-xs flex items-center gap-1.5 self-start sm:self-auto"
                >
                  <Plus className="w-4 h-4" />
                  <span>Thêm Nguyên Liệu / Bao Bì</span>
                </button>
              </div>

              <div className="bg-white rounded-2xl border border-flandi-pink overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-flandi-bg border-b border-flandi-pink text-flandi-muted font-extrabold uppercase">
                        <th className="p-3.5">Tên Nguyên Liệu / Bao Bì</th>
                        <th className="p-3.5">Nhóm</th>
                        <th className="p-3.5">Tồn Kho Hiện Tại</th>
                        <th className="p-3.5">Đơn Giá Nhập</th>
                        <th className="p-3.5">Trạng Thái</th>
                        <th className="p-3.5 text-right">Thao Tác Nhanh</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-flandi-pink/60 font-semibold">
                      {ingredients.map((ing) => {
                        const low = ing.quantity <= ing.minThreshold;
                        return (
                          <tr key={ing.id} className="hover:bg-flandi-bg/50">
                            <td className="p-3.5 font-extrabold text-flandi-dark">
                              {ing.name}
                            </td>
                            <td className="p-3.5">
                              <span className="px-2.5 py-0.5 rounded-full bg-flandi-cream text-flandi-coral font-bold">
                                {ing.category}
                              </span>
                            </td>
                            <td className="p-3.5 font-extrabold text-sm">
                              {ing.quantity} {ing.unit}
                            </td>
                            <td className="p-3.5 text-flandi-muted">
                              {formatVND(ing.costPerUnit)} / {ing.unit}
                            </td>
                            <td className="p-3.5">
                              {low ? (
                                <span className="px-2.5 py-0.5 rounded-full bg-red-100 text-red-700 font-extrabold">
                                  Sắp hết (Dưới {ing.minThreshold} {ing.unit})
                                </span>
                              ) : (
                                <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-extrabold">
                                  Đủ dùng
                                </span>
                              )}
                            </td>
                            <td className="p-3.5 text-right space-x-1.5">
                              <button
                                onClick={() =>
                                  quickAdjustStock(
                                    ing.id,
                                    "ingredient",
                                    5,
                                    "Nhập thêm nguyên liệu"
                                  )
                                }
                                className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 font-extrabold hover:bg-emerald-100"
                              >
                                +5
                              </button>
                              <button
                                onClick={() =>
                                  quickAdjustStock(
                                    ing.id,
                                    "ingredient",
                                    -1,
                                    "Xuất bếp làm bánh"
                                  )
                                }
                                className="px-2.5 py-1 rounded-lg bg-amber-50 text-amber-800 font-extrabold hover:bg-amber-100"
                              >
                                -1
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Section C: Stock Audit History */}
            <div className="bg-white rounded-2xl border border-flandi-pink p-5 space-y-3">
              <h3 className="font-extrabold text-sm text-flandi-dark flex items-center gap-2">
                <History className="w-4 h-4 text-flandi-coral" />
                <span>Lịch Sử Nhập / Xuất & Trừ Kho Tự Động Gần Đây</span>
              </h3>
              <div className="max-h-64 overflow-y-auto divide-y divide-flandi-pink/50 text-xs">
                {stockLogs.slice(0, 25).map((log) => (
                  <div
                    key={log.id}
                    className="py-2.5 flex items-center justify-between gap-2"
                  >
                    <div>
                      <span className="font-extrabold text-flandi-dark">
                        {log.targetName}
                      </span>{" "}
                      <span className="text-flandi-muted font-semibold">
                        — {log.reason}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span
                        className={`font-extrabold ${
                          log.change >= 0 ? "text-emerald-600" : "text-red-600"
                        }`}
                      >
                        {log.change >= 0 ? `+${log.change}` : log.change} (Tồn:{" "}
                        {log.newStock})
                      </span>
                      <span className="text-flandi-muted text-[11px]">
                        {new Date(log.createdAt).toLocaleTimeString("vi-VN", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ==================== TAB 5: ANALYTICS & SHOP SETTINGS ==================== */}
        {activeTab === "ANALYTICS" && (
          <div className="space-y-8">
            {/* KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white p-5 rounded-2xl border-2 border-flandi-pink space-y-1">
                <span className="text-xs font-bold text-flandi-muted">
                  Tổng Doanh Thu (Đơn hợp lệ)
                </span>
                <p className="text-2xl font-black text-flandi-coral">
                  {formatVND(analytics.totalRevenue)}
                </p>
                <span className="text-[11px] text-emerald-600 font-bold block">
                  +100% đồng bộ POS & Online
                </span>
              </div>

              <div className="bg-white p-5 rounded-2xl border-2 border-flandi-pink space-y-1">
                <span className="text-xs font-bold text-flandi-muted">
                  Lợi Nhuận Gộp Ước Tính
                </span>
                <p className="text-2xl font-black text-emerald-600">
                  {formatVND(analytics.estimatedProfit)}
                </p>
                <span className="text-[11px] text-flandi-muted font-semibold block">
                  Đã trừ giá vốn nguyên liệu
                </span>
              </div>

              <div className="bg-white p-5 rounded-2xl border-2 border-flandi-pink space-y-1">
                <span className="text-xs font-bold text-flandi-muted">
                  Tổng Số Đơn Hàng
                </span>
                <p className="text-2xl font-black text-flandi-dark">
                  {analytics.totalOrders} đơn
                </p>
                <span className="text-[11px] text-flandi-muted font-semibold block">
                  Đang chờ xử lý: {pendingOrdersCount} đơn
                </span>
              </div>

              <div className="bg-white p-5 rounded-2xl border-2 border-flandi-pink space-y-1">
                <span className="text-xs font-bold text-flandi-muted">
                  Giá Trị Đơn Trung Bình
                </span>
                <p className="text-2xl font-black text-flandi-salmon">
                  {formatVND(analytics.avgOrderValue)}
                </p>
                <span className="text-[11px] text-flandi-muted font-semibold block">
                  Trung bình mỗi lượt khách
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Best Sellers Ranking */}
              <div className="lg:col-span-6 bg-white p-6 rounded-3xl border border-flandi-pink space-y-4">
                <h3 className="font-extrabold text-base text-flandi-dark flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-flandi-coral" />
                  <span>Xếp Hạng Món Bán Chạy Nhất</span>
                </h3>
                <div className="space-y-3">
                  {analytics.bestSellers.map((item, idx) => (
                    <div
                      key={item.name}
                      className="flex items-center justify-between gap-3 p-3 rounded-2xl bg-flandi-bg border border-flandi-pink"
                    >
                      <div className="flex items-center gap-3">
                        <span className="w-6 h-6 rounded-full bg-flandi-coral text-white text-xs font-extrabold flex items-center justify-center">
                          {idx + 1}
                        </span>
                        <img
                          src={item.image}
                          alt={item.name}
                          className="w-10 h-10 rounded-full object-cover border border-flandi-salmon"
                        />
                        <div>
                          <p className="font-extrabold text-sm text-flandi-dark">
                            {item.name}
                          </p>
                          <p className="text-xs text-flandi-muted font-semibold">
                            Đã bán: {item.qty} phần
                          </p>
                        </div>
                      </div>
                      <span className="font-extrabold text-sm text-flandi-coral">
                        {formatVND(item.revenue)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Shop Settings Form */}
              {settings && (
                <form
                  onSubmit={handleSaveSettings}
                  className="lg:col-span-6 bg-white p-6 rounded-3xl border border-flandi-pink space-y-4"
                >
                  <h3 className="font-extrabold text-base text-flandi-dark flex items-center gap-2">
                    <Settings className="w-5 h-5 text-flandi-coral" />
                    <span>Cài Đặt Cửa Hàng & Tài Khoản VietQR</span>
                  </h3>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div>
                      <label className="font-bold text-flandi-muted block mb-1">
                        Tên tiệm
                      </label>
                      <input
                        type="text"
                        value={settings.shopName}
                        onChange={(e) =>
                          setSettings({ ...settings, shopName: e.target.value })
                        }
                        className="w-full px-3 py-2 rounded-xl border border-flandi-pink font-bold"
                      />
                    </div>
                    <div>
                      <label className="font-bold text-flandi-muted block mb-1">
                        Slogan
                      </label>
                      <input
                        type="text"
                        value={settings.tagline}
                        onChange={(e) =>
                          setSettings({ ...settings, tagline: e.target.value })
                        }
                        className="w-full px-3 py-2 rounded-xl border border-flandi-pink font-bold"
                      />
                    </div>
                    <div>
                      <label className="font-bold text-flandi-muted block mb-1">
                        Hotline hiển thị
                      </label>
                      <input
                        type="text"
                        value={settings.phone}
                        onChange={(e) =>
                          setSettings({ ...settings, phone: e.target.value })
                        }
                        className="w-full px-3 py-2 rounded-xl border border-flandi-pink font-bold"
                      />
                    </div>
                    <div>
                      <label className="font-bold text-flandi-muted block mb-1">
                        SĐT gắn nút Chat Zalo (không khoảng trắng)
                      </label>
                      <input
                        type="text"
                        value={settings.zaloPhone || ""}
                        onChange={(e) =>
                          setSettings({ ...settings, zaloPhone: e.target.value })
                        }
                        placeholder="0366053058"
                        className="w-full px-3 py-2 rounded-xl border border-flandi-pink font-bold"
                      />
                    </div>
                    <div>
                      <label className="font-bold text-flandi-muted block mb-1">
                        Link Facebook / Messenger (nút nổi)
                      </label>
                      <input
                        type="text"
                        value={settings.facebookUrl || ""}
                        onChange={(e) =>
                          setSettings({
                            ...settings,
                            facebookUrl: e.target.value,
                          })
                        }
                        placeholder="https://www.facebook.com/tiem.flandi"
                        className="w-full px-3 py-2 rounded-xl border border-flandi-pink font-bold"
                      />
                    </div>
                    <div>
                      <label className="font-bold text-flandi-muted block mb-1">
                        Đơn tối thiểu Freeship (đ)
                      </label>
                      <input
                        type="number"
                        value={settings.freeShipMinimum}
                        onChange={(e) =>
                          setSettings({
                            ...settings,
                            freeShipMinimum: Number(e.target.value) || 0,
                          })
                        }
                        className="w-full px-3 py-2 rounded-xl border border-flandi-pink font-bold"
                      />
                    </div>
                    <div>
                      <label className="font-bold text-flandi-muted block mb-1">
                        Ngân hàng nhận QR
                      </label>
                      <input
                        type="text"
                        value={settings.bankName}
                        onChange={(e) =>
                          setSettings({ ...settings, bankName: e.target.value })
                        }
                        className="w-full px-3 py-2 rounded-xl border border-flandi-pink font-bold"
                      />
                    </div>
                    <div>
                      <label className="font-bold text-flandi-muted block mb-1">
                        Số tài khoản ngân hàng
                      </label>
                      <input
                        type="text"
                        value={settings.bankAccountNo}
                        onChange={(e) =>
                          setSettings({
                            ...settings,
                            bankAccountNo: e.target.value,
                          })
                        }
                        className="w-full px-3 py-2 rounded-xl border border-flandi-pink font-bold"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-flandi-muted block mb-1">
                      Thông báo chạy đầu trang Web
                    </label>
                    <input
                      type="text"
                      value={settings.announcement}
                      onChange={(e) =>
                        setSettings({ ...settings, announcement: e.target.value })
                      }
                      className="w-full px-3 py-2 rounded-xl border border-flandi-pink text-xs font-bold"
                    />
                  </div>

                  <button
                    type="submit"
                    className="px-5 py-2.5 rounded-xl bg-flandi-coral hover:bg-flandi-salmon text-white font-extrabold text-xs flex items-center gap-2 shadow-cute"
                  >
                    <Save className="w-4 h-4" />
                    <span>Lưu Cài Đặt Cửa Hàng</span>
                  </button>
                </form>
              )}
            </div>
          </div>
        )}

        {/* ==================== TAB 6: BRANDING STUDIO FULL HD ==================== */}
        {activeTab === "BRANDING" && settings && (
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
                await fetchAll();
              }
            }}
          />
        )}

        {/* ==================== TAB 7: LIVE MESSENGER CHAT INBOX ==================== */}
        {activeTab === "CHAT" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-[74vh] min-h-[520px]">
            {/* Left 4 cols: Customer Conversation List */}
            <div className="lg:col-span-4 bg-white rounded-3xl border-2 border-flandi-pink flex flex-col overflow-hidden">
              <div className="p-4 border-b border-flandi-pink flex items-center justify-between">
                <div>
                  <h3 className="font-extrabold text-sm text-flandi-dark">
                    Hộp Thư Khách Nhắn Trực Tiếp
                  </h3>
                  <p className="text-[11px] text-flandi-muted font-semibold">
                    Tin nhắn từ khung Messenger trên trang chủ
                  </p>
                </div>
                <button
                  type="button"
                  onClick={fetchAll}
                  className="p-2 rounded-xl bg-flandi-bg hover:bg-flandi-pink/50 text-flandi-coral"
                  title="Làm mới tin nhắn"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto divide-y divide-flandi-pink/60">
                {chats.map((c) => {
                  const lastMsg = c.messages[c.messages.length - 1];
                  const active = selectedChatId === c.id;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={async () => {
                        setSelectedChatId(c.id);
                        if (c.unreadForAdmin > 0) {
                          await fetch("/api/chat", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                              sessionId: c.id,
                              markReadForAdmin: true,
                            }),
                          });
                          fetchAll();
                        }
                      }}
                      className={`w-full p-4 text-left transition flex items-start justify-between gap-2 ${
                        active ? "bg-flandi-salmon/15" : "hover:bg-flandi-bg"
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-extrabold text-xs text-flandi-dark truncate">
                            {c.customerName}
                          </span>
                          {c.customerPhone && (
                            <span className="text-[10px] font-bold text-flandi-coral">
                              • {c.customerPhone}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-flandi-muted font-medium truncate mt-1">
                          {lastMsg ? lastMsg.text : "Chưa có tin nhắn"}
                        </p>
                      </div>
                      {c.unreadForAdmin > 0 && (
                        <span className="px-2 py-0.5 rounded-full bg-[#006AFF] text-white text-[10px] font-extrabold shrink-0">
                          {c.unreadForAdmin} mới
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Right 8 cols: Active Chat Thread & Reply Input */}
            <div className="lg:col-span-8 bg-white rounded-3xl border-2 border-flandi-salmon flex flex-col overflow-hidden">
              {(() => {
                const activeChat =
                  chats.find((c) => c.id === selectedChatId) || chats[0];
                if (!activeChat) {
                  return (
                    <div className="m-auto text-center text-xs text-flandi-muted font-bold p-8">
                      Chưa có cuộc trò chuyện nào.
                    </div>
                  );
                }
                return (
                  <>
                    <div className="p-4 bg-flandi-bg border-b border-flandi-pink flex items-center justify-between">
                      <div>
                        <h4 className="font-extrabold text-sm text-flandi-dark">
                          {activeChat.customerName}
                        </h4>
                        <p className="text-xs text-flandi-muted font-semibold">
                          {activeChat.customerPhone
                            ? `SĐT / Zalo: ${activeChat.customerPhone}`
                            : "Khách đang trực tuyến trên Website"}
                        </p>
                      </div>
                    </div>

                    <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#FFF9F8]">
                      {activeChat.messages.map((m) => {
                        const isCustomer = m.sender === "CUSTOMER";
                        return (
                          <div
                            key={m.id}
                            className={`flex flex-col ${
                              isCustomer ? "items-start" : "items-end"
                            }`}
                          >
                            <div
                              className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-xs whitespace-pre-line shadow-2xs ${
                                isCustomer
                                  ? "bg-white border border-flandi-pink text-flandi-dark font-semibold"
                                  : m.sender === "SHOP"
                                  ? "bg-flandi-coral text-white font-semibold"
                                  : "bg-flandi-cream text-flandi-dark border border-flandi-pink font-medium"
                              }`}
                            >
                              <span className="block text-[10px] font-extrabold opacity-75 mb-0.5">
                                {isCustomer
                                  ? activeChat.customerName
                                  : m.sender === "SHOP"
                                  ? "Bạn (Chủ tiệm FLANDI)"
                                  : "Trợ lý tự động FLANDI"}
                              </span>
                              {m.text}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <form
                      onSubmit={async (e) => {
                        e.preventDefault();
                        if (!adminReplyText.trim()) return;
                        const text = adminReplyText.trim();
                        setAdminReplyText("");
                        await fetch("/api/chat", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            sessionId: activeChat.id,
                            sender: "SHOP",
                            text,
                          }),
                        });
                        notify(`Đã gửi phản hồi cho ${activeChat.customerName}!`);
                        fetchAll();
                      }}
                      className="p-3 bg-white border-t border-flandi-pink flex items-center gap-2"
                    >
                      <input
                        type="text"
                        value={adminReplyText}
                        onChange={(e) => setAdminReplyText(e.target.value)}
                        placeholder={`Nhập phản hồi gửi trực tiếp tới ${activeChat.customerName} trên web...`}
                        className="flex-1 px-4 py-2.5 rounded-full bg-flandi-bg border border-flandi-pink text-xs font-semibold focus:border-flandi-coral focus:outline-none"
                      />
                      <button
                        type="submit"
                        className="px-5 py-2.5 rounded-full bg-flandi-coral hover:bg-flandi-salmon text-white font-extrabold text-xs flex items-center gap-1.5 shadow-cute"
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span>Gửi phản hồi</span>
                      </button>
                    </form>
                  </>
                );
              })()}
            </div>
          </div>
        )}
      </main>

      {/* ==================== MODAL: EDIT / CREATE PRODUCT ==================== */}
      {editingProduct && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <form
            onSubmit={handleSaveProduct}
            className="bg-white rounded-3xl max-w-2xl w-full p-6 border-2 border-flandi-salmon shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between border-b border-flandi-pink pb-3">
              <h3 className="font-extrabold text-base text-flandi-dark">
                {isNewProduct
                  ? "Thêm Món Tráng Miệng Mới"
                  : `Chỉnh Sửa Món: ${editingProduct.name}`}
              </h3>
              <button
                type="button"
                onClick={() => setEditingProduct(null)}
                className="p-1.5 rounded-full hover:bg-flandi-cream"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <label className="font-bold text-flandi-muted block mb-1">
                  Tên món hiển thị trên Menu *
                </label>
                <input
                  type="text"
                  required
                  value={editingProduct.name}
                  onChange={(e) =>
                    setEditingProduct({ ...editingProduct, name: e.target.value })
                  }
                  className="w-full px-3 py-2 rounded-xl border border-flandi-pink font-bold"
                />
              </div>

              <div>
                <label className="font-bold text-flandi-muted block mb-1">
                  Danh mục
                </label>
                <select
                  value={editingProduct.category}
                  onChange={(e) =>
                    setEditingProduct({
                      ...editingProduct,
                      category: e.target.value as Product["category"],
                    })
                  }
                  className="w-full px-3 py-2 rounded-xl border border-flandi-pink font-bold bg-white"
                >
                  <option value="Flan & Pudding">Flan & Pudding</option>
                  <option value="Panna Cotta">Panna Cotta</option>
                  <option value="Rau Câu">Rau Câu</option>
                  <option value="Tàu Hũ & Yogurt">Tàu Hũ & Yogurt</option>
                </select>
              </div>

              <div>
                <label className="font-bold text-flandi-muted block mb-1">
                  Nhãn giá tròn trên ảnh (VD: 60k / chục) *
                </label>
                <input
                  type="text"
                  required
                  value={editingProduct.badgeText}
                  onChange={(e) =>
                    setEditingProduct({
                      ...editingProduct,
                      badgeText: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 rounded-xl border border-flandi-pink font-bold"
                />
              </div>

              <div>
                <label className="font-bold text-flandi-muted block mb-1">
                  Nhãn giá phụ thứ 2 (VD: 80k / chục)
                </label>
                <input
                  type="text"
                  value={editingProduct.secondaryBadgeText || ""}
                  onChange={(e) =>
                    setEditingProduct({
                      ...editingProduct,
                      secondaryBadgeText: e.target.value,
                    })
                  }
                  placeholder="Để trống nếu chỉ có 1 nhãn giá"
                  className="w-full px-3 py-2 rounded-xl border border-flandi-pink font-bold"
                />
              </div>

              <div>
                <label className="font-bold text-flandi-muted block mb-1">
                  Giá hiển thị mặc định (VND)
                </label>
                <input
                  type="number"
                  value={editingProduct.price}
                  onChange={(e) =>
                    setEditingProduct({
                      ...editingProduct,
                      price: Number(e.target.value) || 0,
                    })
                  }
                  className="w-full px-3 py-2 rounded-xl border border-flandi-pink font-bold"
                />
              </div>

              <div>
                <label className="font-bold text-flandi-muted block mb-1">
                  Tồn kho hiện tại ({editingProduct.stockUnit})
                </label>
                <input
                  type="number"
                  value={editingProduct.stock}
                  onChange={(e) =>
                    setEditingProduct({
                      ...editingProduct,
                      stock: Number(e.target.value) || 0,
                    })
                  }
                  className="w-full px-3 py-2 rounded-xl border border-flandi-pink font-bold"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="font-bold text-flandi-muted block mb-1">
                  Chọn ảnh sản phẩm
                </label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {[
                    "/images/products/flan.png",
                    "/images/products/panna-cotta.png",
                    "/images/products/rau-cau-dua.png",
                    "/images/products/rau-cau-la.png",
                    "/images/products/tau-hu-singapore.png",
                    "/images/products/yogurt.png",
                  ].map((imgPath) => (
                    <button
                      key={imgPath}
                      type="button"
                      onClick={() =>
                        setEditingProduct({ ...editingProduct, image: imgPath })
                      }
                      className={`p-1 rounded-full border-2 ${
                        editingProduct.image === imgPath
                          ? "border-flandi-coral scale-105"
                          : "border-transparent opacity-70"
                      }`}
                    >
                      <img
                        src={imgPath}
                        alt="preset"
                        className="w-10 h-10 rounded-full object-cover"
                      />
                    </button>
                  ))}
                </div>
                <input
                  type="text"
                  value={editingProduct.image}
                  onChange={(e) =>
                    setEditingProduct({ ...editingProduct, image: e.target.value })
                  }
                  className="w-full px-3 py-1.5 rounded-xl border border-flandi-pink font-semibold"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="font-bold text-flandi-muted block mb-1">
                  Mô tả hương vị
                </label>
                <textarea
                  rows={2}
                  value={editingProduct.description}
                  onChange={(e) =>
                    setEditingProduct({
                      ...editingProduct,
                      description: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 rounded-xl border border-flandi-pink font-semibold"
                />
              </div>
            </div>

            {/* Variants Editor */}
            <div className="space-y-2 pt-2 border-t border-flandi-pink">
              <div className="flex items-center justify-between">
                <label className="text-xs font-extrabold text-flandi-dark">
                  Các Phân Loại Vị / Quy Cách Bán (Cái, Chục, Hộp)
                </label>
                <button
                  type="button"
                  onClick={() =>
                    setEditingProduct({
                      ...editingProduct,
                      variants: [
                        ...editingProduct.variants,
                        {
                          id: `var-${Date.now()}`,
                          name: "Phân loại mới",
                          price: editingProduct.price,
                          unitLabel: editingProduct.unit,
                          stockDeduction: 1,
                        },
                      ],
                    })
                  }
                  className="text-xs font-extrabold text-flandi-coral hover:underline flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Thêm phân loại
                </button>
              </div>

              <div className="space-y-2">
                {editingProduct.variants.map((v, idx) => (
                  <div
                    key={v.id}
                    className="grid grid-cols-12 gap-2 items-center bg-flandi-bg p-2 rounded-xl border border-flandi-pink text-xs"
                  >
                    <input
                      type="text"
                      value={v.name}
                      onChange={(e) => {
                        const next = [...editingProduct.variants];
                        next[idx] = { ...v, name: e.target.value };
                        setEditingProduct({ ...editingProduct, variants: next });
                      }}
                      placeholder="Tên vị / quy cách"
                      className="col-span-5 px-2.5 py-1.5 rounded-lg border border-flandi-pink font-bold bg-white"
                    />
                    <input
                      type="number"
                      value={v.price}
                      onChange={(e) => {
                        const next = [...editingProduct.variants];
                        next[idx] = { ...v, price: Number(e.target.value) || 0 };
                        setEditingProduct({ ...editingProduct, variants: next });
                      }}
                      placeholder="Giá bán"
                      className="col-span-3 px-2.5 py-1.5 rounded-lg border border-flandi-pink font-bold bg-white"
                    />
                    <div className="col-span-3 flex items-center gap-1">
                      <span className="text-[10px] text-flandi-muted font-bold">
                        Trừ kho:
                      </span>
                      <input
                        type="number"
                        min={1}
                        value={v.stockDeduction}
                        onChange={(e) => {
                          const next = [...editingProduct.variants];
                          next[idx] = {
                            ...v,
                            stockDeduction: Number(e.target.value) || 1,
                          };
                          setEditingProduct({
                            ...editingProduct,
                            variants: next,
                          });
                        }}
                        className="w-full px-2 py-1.5 rounded-lg border border-flandi-pink font-bold bg-white"
                      />
                    </div>
                    <button
                      type="button"
                      disabled={editingProduct.variants.length <= 1}
                      onClick={() => {
                        const next = editingProduct.variants.filter(
                          (_, i) => i !== idx
                        );
                        setEditingProduct({ ...editingProduct, variants: next });
                      }}
                      className="col-span-1 text-red-500 hover:text-red-700 disabled:opacity-30 flex justify-center"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-flandi-pink">
              <button
                type="button"
                onClick={() => setEditingProduct(null)}
                className="px-4 py-2 rounded-xl bg-gray-100 text-gray-700 font-bold text-xs"
              >
                Huỷ
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-xl bg-flandi-coral text-white font-extrabold text-xs shadow-cute"
              >
                Lưu Sản Phẩm
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ==================== MODAL: CUSTOM STOCK ADJUSTMENT ==================== */}
      {stockModalTarget && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <form
            onSubmit={handleConfirmStockModal}
            className="bg-white rounded-3xl max-w-sm w-full p-6 border-2 border-flandi-salmon shadow-2xl space-y-4"
          >
            <h3 className="font-extrabold text-base text-flandi-dark">
              Điều chỉnh kho: {stockModalTarget.name}
            </h3>
            <p className="text-xs text-flandi-muted font-semibold">
              Tồn hiện tại: {stockModalTarget.current} {stockModalTarget.unit}
            </p>

            <div>
              <label className="text-xs font-bold text-flandi-muted block mb-1">
                Số lượng thay đổi (Nhập số dương để cộng, số âm để trừ)
              </label>
              <input
                type="number"
                required
                value={stockChangeAmount}
                onChange={(e) => setStockChangeAmount(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-xl border border-flandi-pink text-sm font-extrabold"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-flandi-muted block mb-1">
                Lý do
              </label>
              <input
                type="text"
                required
                value={stockReason}
                onChange={(e) => setStockReason(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-flandi-pink text-xs font-semibold"
              />
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setStockModalTarget(null)}
                className="px-4 py-2 rounded-xl bg-gray-100 text-xs font-bold"
              >
                Đóng
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-flandi-coral text-white text-xs font-extrabold"
              >
                Xác nhận
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ==================== MODAL: ADD NEW INGREDIENT ==================== */}
      {newIngredientModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <form
            onSubmit={handleAddIngredient}
            className="bg-white rounded-3xl max-w-sm w-full p-6 border-2 border-flandi-salmon shadow-2xl space-y-3.5 text-xs"
          >
            <h3 className="font-extrabold text-base text-flandi-dark">
              Thêm Nguyên Liệu / Bao Bì Mới
            </h3>
            <div>
              <label className="font-bold text-flandi-muted block mb-1">
                Tên nguyên liệu / bao bì *
              </label>
              <input
                type="text"
                required
                value={newIngForm.name || ""}
                onChange={(e) =>
                  setNewIngForm({ ...newIngForm, name: e.target.value })
                }
                placeholder="VD: Lá dứa tươi, Hộp nhựa..."
                className="w-full px-3 py-2 rounded-xl border border-flandi-pink font-bold"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="font-bold text-flandi-muted block mb-1">
                  Nhóm
                </label>
                <select
                  value={newIngForm.category}
                  onChange={(e) =>
                    setNewIngForm({
                      ...newIngForm,
                      category: e.target.value as IngredientItem["category"],
                    })
                  }
                  className="w-full px-3 py-2 rounded-xl border border-flandi-pink font-bold bg-white"
                >
                  <option value="Nguyên liệu">Nguyên liệu</option>
                  <option value="Bao bì">Bao bì</option>
                  <option value="Topping">Topping</option>
                </select>
              </div>
              <div>
                <label className="font-bold text-flandi-muted block mb-1">
                  Đơn vị tính
                </label>
                <input
                  type="text"
                  required
                  value={newIngForm.unit || ""}
                  onChange={(e) =>
                    setNewIngForm({ ...newIngForm, unit: e.target.value })
                  }
                  placeholder="kg, lít, cái..."
                  className="w-full px-3 py-2 rounded-xl border border-flandi-pink font-bold"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="font-bold text-flandi-muted block mb-1">
                  Số lượng ban đầu
                </label>
                <input
                  type="number"
                  value={newIngForm.quantity}
                  onChange={(e) =>
                    setNewIngForm({
                      ...newIngForm,
                      quantity: Number(e.target.value) || 0,
                    })
                  }
                  className="w-full px-3 py-2 rounded-xl border border-flandi-pink font-bold"
                />
              </div>
              <div>
                <label className="font-bold text-flandi-muted block mb-1">
                  Giá nhập / đơn vị
                </label>
                <input
                  type="number"
                  value={newIngForm.costPerUnit}
                  onChange={(e) =>
                    setNewIngForm({
                      ...newIngForm,
                      costPerUnit: Number(e.target.value) || 0,
                    })
                  }
                  className="w-full px-3 py-2 rounded-xl border border-flandi-pink font-bold"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setNewIngredientModal(false)}
                className="px-4 py-2 rounded-xl bg-gray-100 font-bold"
              >
                Huỷ
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-flandi-coral text-white font-extrabold"
              >
                Lưu vào kho
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ==================== MODAL: THERMAL RECEIPT PRINT PREVIEW ==================== */}
      {receiptOrder && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-5 shadow-2xl space-y-4">
            <div
              id="printable-receipt"
              className="p-4 border border-dashed border-gray-300 rounded-xl text-xs font-mono text-black space-y-2.5 bg-white"
            >
              <div className="text-center border-b border-dashed border-gray-300 pb-2">
                <h3 className="font-bold text-base">
                  {settings?.shopName || "TIỆM BÁNH FLANDI"}
                </h3>
                <p className="text-[11px]">
                  “{settings?.tagline || "Muốn ăn hãy Flăn vào tớ"}”
                </p>
                <p className="text-[10px] text-gray-600">
                  SĐT/Zalo: {settings?.phone || "0366053058"}
                </p>
              </div>

              <div className="text-[11px] space-y-0.5">
                <p>
                  Mã HĐ: <strong>#{receiptOrder.code}</strong> ({receiptOrder.source})
                </p>
                <p>
                  Ngày:{" "}
                  {new Date(receiptOrder.createdAt).toLocaleString("vi-VN")}
                </p>
                <p>Khách: {receiptOrder.customerName}</p>
                {receiptOrder.customerPhone && (
                  <p>SĐT: {receiptOrder.customerPhone}</p>
                )}
              </div>

              <div className="border-t border-b border-dashed border-gray-300 py-2 space-y-1.5">
                {receiptOrder.items.map((item, idx) => (
                  <div key={idx} className="flex justify-between gap-2">
                    <div>
                      <span className="font-bold">
                        {item.quantity}x {item.productName}
                      </span>
                      <span className="block text-[10px] text-gray-600">
                        ({item.variantName})
                      </span>
                    </div>
                    <span className="font-bold shrink-0">
                      {formatVND(item.subtotal)}
                    </span>
                  </div>
                ))}
              </div>

              <div className="space-y-1 text-[11px]">
                <div className="flex justify-between">
                  <span>Tạm tính:</span>
                  <span>{formatVND(receiptOrder.subtotal)}</span>
                </div>
                {receiptOrder.discount > 0 && (
                  <div className="flex justify-between">
                    <span>Giảm giá:</span>
                    <span>-{formatVND(receiptOrder.discount)}</span>
                  </div>
                )}
                {receiptOrder.shippingFee > 0 && (
                  <div className="flex justify-between">
                    <span>Phí giao hàng:</span>
                    <span>+{formatVND(receiptOrder.shippingFee)}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm font-bold pt-1 border-t border-dashed border-gray-300">
                  <span>TỔNG CỘNG:</span>
                  <span>{formatVND(receiptOrder.total)}</span>
                </div>
                <div className="flex justify-between text-[10px]">
                  <span>Thanh toán:</span>
                  <span>
                    {receiptOrder.paymentMethod} (
                    {receiptOrder.isPaid ? "Đã thanh toán" : "Thu hộ COD"})
                  </span>
                </div>
              </div>

              <div className="text-center pt-2 border-t border-dashed border-gray-300 text-[10px]">
                <p>Bảo quản lạnh 2-6°C để bánh ngon nhất!</p>
                <p className="font-bold">Cảm ơn bạn đã “Flăn” vào FLANDI ♥</p>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setReceiptOrder(null)}
                className="flex-1 py-2.5 rounded-xl bg-gray-100 text-gray-700 font-bold text-xs"
              >
                Đóng
              </button>
              <button
                onClick={() => window.print()}
                className="flex-1 py-2.5 rounded-xl bg-flandi-coral text-white font-extrabold text-xs flex items-center justify-center gap-1.5 shadow-cute"
              >
                <Printer className="w-4 h-4" />
                <span>In Hoá Đơn Ngay</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
