"use client";

import React, { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import {
  Store,
  ShoppingBag,
  Plus,
  Minus,
  Trash2,
  Printer,
  Search,
  ArrowLeft,
  RefreshCw,
  QrCode,
  Banknote,
  Wallet,
  Sparkles,
  Settings,
  CheckCircle2,
  Camera,
  BookOpen,
  Upload,
  Eye,
  X,
  Wand2,
  Image as ImageIcon,
  Lock,
  KeyRound,
  ScanLine,
  Loader2,
  Check,
  FileText,
  AlertTriangle,
  Clipboard,
  Smartphone,
} from "lucide-react";
import {
  Product,
  ProductVariant,
  Order,
  OrderStatus,
  OrderSource,
  PaymentMethod,
  ShopSettings,
  LedgerEntry,
} from "@/lib/types";
import LedgerBookManager, {
  compressImageFile,
} from "@/components/LedgerBookManager";
import { useCustomerAuth } from "@/lib/customer-auth-context";
import { ROLE_META } from "@/lib/rbac";
import CustomerHeaderAuthButton from "@/components/CustomerHeaderAuthButton";
import CustomerAccountDrawer from "@/components/CustomerAccountDrawer";
import {
  parseOrderText,
  ParsedOrderResult,
  ParsedItemMatch,
} from "@/lib/order-ocr-parser";

interface PosCartItem {
  product: Product;
  variant: ProductVariant;
  quantity: number;
}

export default function FlandiPosPage() {
  const {
    user,
    role,
    can,
    loading: authLoading,
    triggerGoogleSignIn,
  } = useCustomerAuth();
  const canCreateOrder = can("orders:create");
  const canManageStore = can("store:manage");

  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);
  const [settings, setSettings] = useState<ShopSettings | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [posView, setPosView] = useState<
    "COUNTER" | "RECENT_ORDERS" | "LEDGER"
  >("COUNTER");

  // POS Ticket State
  const [posCategory, setPosCategory] = useState<string>("ALL");
  const [posSearch, setPosSearch] = useState("");
  const [posCart, setPosCart] = useState<PosCartItem[]>([]);
  const [posSource, setPosSource] = useState<OrderSource>("POS");
  const [posCustomerName, setPosCustomerName] = useState("");
  const [posCustomerPhone, setPosCustomerPhone] = useState("");
  const [posDiscount, setPosDiscount] = useState<number>(0);
  const [posShippingFee, setPosShippingFee] = useState<number>(0);
  const [posPaymentMethod, setPosPaymentMethod] =
    useState<PaymentMethod>("CASH");
  const [posCashReceived, setPosCashReceived] = useState<number>(0);
  const [posNote, setPosNote] = useState("");
  const [posOrderImage, setPosOrderImage] = useState<string>("");
  const [showImageOrderHelper, setShowImageOrderHelper] = useState(false);
  const [quickParseText, setQuickParseText] = useState("");
  const [receiptOrder, setReceiptOrder] = useState<Order | null>(null);
  const [lightboxImage, setLightboxImage] = useState<{
    url: string;
    title: string;
  } | null>(null);

  // --- AI OCR & Order Import State ---
  const [isScanningOcr, setIsScanningOcr] = useState(false);
  const [ocrConfidence, setOcrConfidence] = useState<number | null>(null);
  const [parsedOcrResult, setParsedOcrResult] = useState<ParsedOrderResult | null>(null);
  const [ocrActiveTab, setOcrActiveTab] = useState<"ITEMS" | "CUSTOMER" | "RAW_TEXT">("ITEMS");
  const [autoApplyToCart, setAutoApplyToCart] = useState(true);
  const [isDragOverDropzone, setIsDragOverDropzone] = useState(false);

  const notify = (msg: string) => {
    setToast(msg);
    setTimeout(() => {
      setToast((prev) => (prev === msg ? null : prev));
    }, 2800);
  };

  const formatVND = (n: number) =>
    new Intl.NumberFormat("vi-VN").format(Math.round(n || 0)) + "đ";

  const fetchPosData = async () => {
    try {
      const res = await fetch("/api/store", { cache: "no-store" });
      const data = await res.json();
      setProducts(
        (data.products || []).filter((p: Product) => p.isActive !== false)
      );
      setOrders(data.orders || []);
      setLedger(data.ledger || []);
      setSettings(data.settings || null);
    } catch (err) {
      console.error("Failed to fetch POS data:", err);
    }
  };

  useEffect(() => {
    if (!authLoading && canCreateOrder) {
      fetchPosData();
    }
  }, [authLoading, canCreateOrder]);

  useEffect(() => {
    if (!canManageStore && posView === "LEDGER") {
      setPosView("COUNTER");
    }
  }, [canManageStore, posView]);

  const addToPosCart = (
    product: Product,
    variant: ProductVariant,
    qtyToAdd = 1
  ) => {
    if (product.stock < variant.stockDeduction * qtyToAdd) {
      notify(
        `⚠️ Món ${product.name} chỉ còn ${product.stock} ${product.stockUnit}!`
      );
      return;
    }
    setPosCart((prev) => {
      const idx = prev.findIndex(
        (i) => i.product.id === product.id && i.variant.id === variant.id
      );
      if (idx > -1) {
        const next = [...prev];
        next[idx] = {
          ...next[idx],
          quantity: next[idx].quantity + qtyToAdd,
        };
        return next;
      }
      return [...prev, { product, variant, quantity: qtyToAdd }];
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

  // --- AI OCR Image Processing & Intelligent Parser ---
  const processImageForOcr = async (fileOrDataUrl: File | string) => {
    setIsScanningOcr(true);
    setShowImageOrderHelper(true);
    setOcrConfidence(null);
    try {
      let dataUrl = "";
      if (typeof fileOrDataUrl === "string") {
        dataUrl = fileOrDataUrl;
      } else {
        dataUrl = await compressImageFile(fileOrDataUrl, 1600);
      }
      setPosOrderImage(dataUrl);

      // Gọi API OCR Server-side (Tesseract.js + sharp)
      const res = await fetch("/api/pos/ocr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: dataUrl }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "Không thể quét ảnh");
      }

      const data = await res.json();
      const rawText = data.rawText || "";
      setQuickParseText(rawText);
      setOcrConfidence(data.confidence ?? null);

      const parsed: ParsedOrderResult =
        data.parsed || parseOrderText(rawText, products);
      setParsedOcrResult(parsed);

      // Tự động điền thông tin khách vào phiếu POS nếu phát hiện được
      if (parsed.customerPhone && !posCustomerPhone) {
        setPosCustomerPhone(parsed.customerPhone);
      }
      if (parsed.customerName && !posCustomerName) {
        setPosCustomerName(parsed.customerName);
      }
      if (parsed.customerAddress || parsed.note) {
        const extraNote = [parsed.customerAddress, parsed.note]
          .filter(Boolean)
          .join(" • ");
        if (extraNote && !posNote) {
          setPosNote(extraNote);
        }
      }

      if (parsed.items.length > 0) {
        setOcrActiveTab("ITEMS");
        if (autoApplyToCart) {
          parsed.items.forEach((item) => {
            addToPosCart(item.product, item.variant, item.quantity);
          });
          notify(
            `🎉 Đã nhận diện và tự động nạp ${parsed.items.length} món vào giỏ POS!`
          );
        } else {
          notify(
            `✨ Nhận diện thành công ${parsed.items.length} món từ ảnh. Bấm "Nạp Vào Giỏ" để thêm!`
          );
        }
      } else if (rawText.trim()) {
        setOcrActiveTab("RAW_TEXT");
        notify(
          "⚠️ Đã đọc được chữ nhưng chưa khớp với món trong menu. Bạn kiểm tra tab Văn bản gốc nhé!"
        );
      } else {
        notify("⚠️ Ảnh quá mờ hoặc không có chữ. Bạn có thể gõ nhanh nội dung món.");
      }
    } catch (err: any) {
      console.error("POS OCR Error:", err);
      notify(err.message || "Lỗi khi nhận diện ảnh đơn hàng!");
    } finally {
      setIsScanningOcr(false);
    }
  };

  const handleUploadPosOrderImage = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await processImageForOcr(file);
    e.target.value = "";
  };

  // Re-parse when staff edits the raw text manually in textarea
  const reParseCurrentText = () => {
    const raw = quickParseText.trim();
    if (!raw) {
      notify("Vui lòng nhập hoặc dán nội dung món!");
      return;
    }
    const parsed = parseOrderText(raw, products);
    setParsedOcrResult(parsed);

    if (parsed.customerPhone && !posCustomerPhone) {
      setPosCustomerPhone(parsed.customerPhone);
    }
    if (parsed.customerName && !posCustomerName) {
      setPosCustomerName(parsed.customerName);
    }
    if (parsed.customerAddress || parsed.note) {
      const extraNote = [parsed.customerAddress, parsed.note]
        .filter(Boolean)
        .join(" • ");
      if (extraNote && !posNote) {
        setPosNote(extraNote);
      }
    }

    if (parsed.items.length > 0) {
      setOcrActiveTab("ITEMS");
      notify(`✨ Đã phân tích lại: khớp ${parsed.items.length} món!`);
    } else {
      notify("⚠️ Chưa khớp được món nào trong thực đơn.");
    }
  };

  // Nạp toàn bộ món đã nhận diện vào giỏ POS
  const applyParsedItemsToCart = () => {
    if (!parsedOcrResult || parsedOcrResult.items.length === 0) {
      notify("Chưa có món nào để nạp vào giỏ!");
      return;
    }

    parsedOcrResult.items.forEach((item) => {
      addToPosCart(item.product, item.variant, item.quantity);
    });

    if (parsedOcrResult.customerPhone && !posCustomerPhone) {
      setPosCustomerPhone(parsedOcrResult.customerPhone);
    }
    if (parsedOcrResult.customerName && !posCustomerName) {
      setPosCustomerName(parsedOcrResult.customerName);
    }
    if (
      (parsedOcrResult.customerAddress || parsedOcrResult.note) &&
      !posNote
    ) {
      setPosNote(
        [parsedOcrResult.customerAddress, parsedOcrResult.note]
          .filter(Boolean)
          .join(" • ")
      );
    }

    notify(`✅ Đã nạp ${parsedOcrResult.items.length} món vào phiếu bán hàng!`);
  };

  const updateParsedItemQty = (index: number, delta: number) => {
    if (!parsedOcrResult) return;
    setParsedOcrResult((prev) => {
      if (!prev) return prev;
      const nextItems = [...prev.items];
      const cur = nextItems[index];
      if (!cur) return prev;
      const nextQty = cur.quantity + delta;
      if (nextQty <= 0) {
        nextItems.splice(index, 1);
      } else {
        nextItems[index] = { ...cur, quantity: nextQty };
      }
      return { ...prev, items: nextItems };
    });
  };

  const removeParsedItem = (index: number) => {
    if (!parsedOcrResult) return;
    setParsedOcrResult((prev) => {
      if (!prev) return prev;
      const nextItems = prev.items.filter((_, i) => i !== index);
      return { ...prev, items: nextItems };
    });
  };

  const updateParsedItemVariant = (index: number, variantId: string) => {
    if (!parsedOcrResult) return;
    setParsedOcrResult((prev) => {
      if (!prev) return prev;
      const nextItems = [...prev.items];
      const cur = nextItems[index];
      if (!cur) return prev;
      const newV = cur.product.variants.find((v) => v.id === variantId);
      if (!newV) return prev;
      nextItems[index] = { ...cur, variant: newV };
      return { ...prev, items: nextItems };
    });
  };

  // Lắng nghe tổ hợp phím Paste (Ctrl+V / Cmd+V) để dán ảnh chụp màn hình trực tiếp vào POS
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const activeEl = document.activeElement as HTMLElement | null;
      if (
        activeEl &&
        (activeEl.tagName === "INPUT" || activeEl.tagName === "TEXTAREA") &&
        activeEl.getAttribute("type") !== "file"
      ) {
        // Cho phép paste text bình thường trong input / textarea
        return;
      }

      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        if (items[i].type.startsWith("image/")) {
          const file = items[i].getAsFile();
          if (file) {
            e.preventDefault();
            notify("📋 Đã nhận ảnh từ bộ nhớ tạm! Đang quét OCR...");
            processImageForOcr(file);
            break;
          }
        }
      }
    };

    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, [products, posCustomerName, posCustomerPhone, posNote, autoApplyToCart]);

  // Attach / Update Photo on an Existing Order in Shift
  const handleAttachPhotoToExistingOrder = async (
    orderId: string,
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const compressed = await compressImageFile(file);
      const res = await fetch("/api/orders", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, attachmentImage: compressed }),
      });
      if (res.ok) {
        notify("📸 Đã đính kèm ảnh chứng từ vào đơn hàng!");
        fetchPosData();
      }
    } catch (err) {
      console.error(err);
    }
    e.target.value = "";
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
        attachmentImage: posOrderImage || undefined,
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
        cashReceived:
          posPaymentMethod === "CASH" ? posCashReceived || posTotal : posTotal,
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
        setPosOrderImage("");
        setQuickParseText("");
        setShowImageOrderHelper(false);
        fetchPosData();

        if (shouldPrint) {
          setReceiptOrder(data.order);
        }
      }
    } catch (e) {
      console.error(e);
      notify("Lỗi khi lưu đơn POS!");
    }
  };

  const handleQuickCompleteOrder = async (orderId: string) => {
    try {
      const res = await fetch("/api/orders", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, status: "COMPLETED", isPaid: true }),
      });
      if (res.ok) {
        notify("Đã xác nhận hoàn tất & thu tiền đơn hàng!");
        fetchPosData();
      }
    } catch (e) {
      console.error(e);
    }
  };

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

  const pendingOrdersCount = useMemo(
    () =>
      orders.filter((o) => o.status === "PENDING" || o.status === "PREPARING")
        .length,
    [orders]
  );

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#FFF9F8] flex flex-col items-center justify-center p-4">
        <div className="w-10 h-10 border-4 border-flandi-pink border-t-flandi-coral rounded-full animate-spin mb-3" />
        <p className="text-xs font-extrabold text-flandi-coral">
          Đang kiểm tra quyền truy cập POS...
        </p>
      </div>
    );
  }

  if (!canCreateOrder) {
    return (
      <div className="min-h-screen bg-[#FFF9F8] flex flex-col items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-3xl border-2 border-flandi-pink p-6 sm:p-8 shadow-cute-lg text-center space-y-4">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-flandi-cream border border-flandi-salmon flex items-center justify-center text-flandi-coral">
            <Lock className="w-7 h-7" />
          </div>
          <div>
            <h1 className="font-display text-2xl text-sticker-sm leading-tight">
              KHU VỰC MÁY POS
            </h1>
            <p className="text-xs sm:text-sm font-semibold text-flandi-dark/75 mt-1.5 leading-relaxed">
              {role === "guest"
                ? "Chỉ tài khoản Nhân viên (Staff) hoặc Quản trị (Admin) mới được phép lên đơn tại quầy POS."
                : `Tài khoản ${user?.email || ""} hiện đang ở nhóm User (chưa có quyền lên đơn).`}
            </p>
          </div>

          <div className="space-y-2.5 pt-1">
            <button
              type="button"
              onClick={triggerGoogleSignIn}
              className="w-full py-3 px-4 rounded-2xl bg-flandi-coral hover:bg-flandi-salmon text-white font-extrabold text-sm shadow-cute transition active:scale-95 cursor-pointer"
            >
              {role === "guest"
                ? "Đăng nhập Google (Staff / Admin)"
                : "Đổi sang tài khoản Staff / Admin"}
            </button>

            <Link
              href="/admin"
              className="w-full py-2.5 px-4 rounded-2xl bg-flandi-cream hover:bg-flandi-pink/60 border border-flandi-salmon text-flandi-coral font-extrabold text-xs sm:text-sm flex items-center justify-center gap-1.5 transition"
            >
              <KeyRound className="w-4 h-4" />
              <span>Mở khóa bằng mã PIN Chủ tiệm (/admin)</span>
            </Link>

            <Link
              href="/order"
              className="inline-flex items-center gap-1 text-xs font-extrabold text-flandi-dark/70 hover:text-flandi-coral pt-1"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Quay lại Thực đơn (/order)</span>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FFF9F8] flex flex-col">
      {toast && (
        <div className="fixed bottom-5 right-5 z-50 bg-flandi-dark text-white px-5 py-3 rounded-2xl shadow-cute-lg flex items-center gap-2.5 animate-bounce">
          <Sparkles className="w-4 h-4 text-flandi-salmon" />
          <span className="text-xs sm:text-sm font-bold">{toast}</span>
        </div>
      )}

      {/* POS Header */}
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
              <div className="flex items-center gap-2">
                <h1 className="font-display text-xl text-sticker-sm leading-none">
                  FLANDI POS TERMINAL
                </h1>
                <span
                  className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${ROLE_META[role].badgeClass}`}
                >
                  {ROLE_META[role].shortLabel}
                </span>
              </div>
              <span className="text-[11px] font-bold text-flandi-muted hidden sm:block">
                Máy Bán Hàng & Xử Lý Đơn Trong Ca (/pos)
              </span>
            </div>
          </div>
        </div>

        {/* Center Switch: Counter vs Recent Orders vs Ledger (Admin only) */}
        <div className="flex items-center gap-1.5 bg-flandi-bg p-1 rounded-xl border border-flandi-pink overflow-x-auto">
          <button
            type="button"
            onClick={() => setPosView("COUNTER")}
            className={`px-3 py-1.5 rounded-lg text-xs font-extrabold flex items-center gap-1.5 transition whitespace-nowrap ${
              posView === "COUNTER"
                ? "bg-flandi-coral text-white shadow-2xs"
                : "text-flandi-dark hover:bg-flandi-cream"
            }`}
          >
            <Store className="w-4 h-4" />
            <span>Màn Hình Thu Ngân</span>
          </button>

          <button
            type="button"
            onClick={() => setPosView("RECENT_ORDERS")}
            className={`px-3 py-1.5 rounded-lg text-xs font-extrabold flex items-center gap-1.5 transition whitespace-nowrap ${
              posView === "RECENT_ORDERS"
                ? "bg-flandi-coral text-white shadow-2xs"
                : "text-flandi-dark hover:bg-flandi-cream"
            }`}
          >
            <ShoppingBag className="w-4 h-4" />
            <span>Đơn Trong Ca ({orders.length})</span>
            {pendingOrdersCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-amber-400 text-flandi-dark text-[10px] font-black">
                {pendingOrdersCount} chờ
              </span>
            )}
          </button>

          {canManageStore && (
            <button
              type="button"
              onClick={() => setPosView("LEDGER")}
              className={`px-3 py-1.5 rounded-lg text-xs font-extrabold flex items-center gap-1.5 transition whitespace-nowrap ${
                posView === "LEDGER"
                  ? "bg-flandi-coral text-white shadow-2xs"
                  : "text-flandi-dark hover:bg-flandi-cream"
              }`}
            >
              <BookOpen className="w-4 h-4" />
              <span>Sổ Sách & Up Ảnh ({ledger.length})</span>
            </button>
          )}
        </div>

        {/* Right Actions: Refresh + Link to /admin + Account */}
        <div className="flex items-center gap-2">
          <button
            onClick={fetchPosData}
            className="p-2 rounded-xl border border-flandi-pink hover:bg-flandi-cream text-flandi-muted"
            title="Làm mới dữ liệu"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <Link
            href="/admin"
            className="px-3.5 py-2 rounded-xl bg-flandi-cream hover:bg-flandi-pink/60 text-flandi-coral border border-flandi-salmon font-extrabold text-xs hidden md:flex items-center gap-1.5"
          >
            <Settings className="w-3.5 h-3.5" />
            <span>{canManageStore ? "Quản Trị (/admin)" : "Đơn Ca (/admin)"}</span>
          </Link>
          <CustomerHeaderAuthButton />
        </div>
      </header>
      <CustomerAccountDrawer />

      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6">
        {posView === "COUNTER" ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left 7 Cols: Image-to-Order Assistant + Product Selection Grid */}
            <div className="lg:col-span-7 space-y-4">
              {/* Smart Image-to-Order AI OCR Assistant */}
              <div
                className={`bg-white rounded-3xl border-2 transition shadow-cute p-4 sm:p-5 space-y-4 ${
                  isDragOverDropzone
                    ? "border-flandi-coral ring-4 ring-flandi-coral/20 bg-flandi-cream/30"
                    : "border-flandi-salmon"
                }`}
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragOverDropzone(true);
                }}
                onDragLeave={() => setIsDragOverDropzone(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDragOverDropzone(false);
                  const file = e.dataTransfer.files?.[0];
                  if (file && file.type.startsWith("image/")) {
                    processImageForOcr(file);
                  }
                }}
              >
                {/* Header Banner */}
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-flandi-coral to-flandi-salmon text-white flex items-center justify-center shrink-0 shadow-2xs">
                      <ScanLine className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-extrabold text-sm sm:text-base text-flandi-dark leading-snug">
                          Import Đơn Từ Ảnh Bằng AI OCR
                        </h3>
                        <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                          Tự động nhận diện món
                        </span>
                      </div>
                      <p className="text-xs text-flandi-muted font-semibold mt-0.5">
                        Quét ảnh chụp tin nhắn Zalo/Messenger, toa viết tay hoặc bill giấy để tự động nạp giỏ hàng
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    {/* Chụp ảnh trực tiếp từ camera (tiện cho điện thoại/máy tính bảng tại quầy) */}
                    <label className="cursor-pointer px-3 py-2 rounded-xl bg-white hover:bg-flandi-cream text-flandi-coral border border-flandi-salmon font-extrabold text-xs flex items-center gap-1.5 shadow-2xs transition">
                      <Camera className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Chụp Ảnh</span>
                      <input
                        type="file"
                        accept="image/*"
                        capture="environment"
                        onChange={handleUploadPosOrderImage}
                        className="hidden"
                      />
                    </label>

                    {/* Tải ảnh từ máy / điện thoại */}
                    <label className="cursor-pointer px-3.5 py-2 rounded-xl bg-flandi-coral hover:bg-flandi-salmon text-white font-extrabold text-xs flex items-center gap-1.5 shadow-2xs transition">
                      <Upload className="w-3.5 h-3.5" />
                      <span>{posOrderImage ? "Đổi Ảnh" : "Tải Ảnh / Bill"}</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleUploadPosOrderImage}
                        className="hidden"
                      />
                    </label>

                    {/* Mở rộng / thu gọn */}
                    <button
                      type="button"
                      onClick={() =>
                        setShowImageOrderHelper(!showImageOrderHelper)
                      }
                      className="px-3 py-2 rounded-xl bg-flandi-cream hover:bg-flandi-pink/60 text-flandi-coral border border-flandi-salmon font-extrabold text-xs flex items-center gap-1"
                      title={showImageOrderHelper ? "Thu gọn bảng" : "Mở rộng bảng quét ảnh"}
                    >
                      <Wand2 className="w-3.5 h-3.5" />
                      <span>{showImageOrderHelper ? "Thu gọn" : "Chi tiết"}</span>
                    </button>
                  </div>
                </div>

                {/* Expanded OCR Workspace */}
                {(showImageOrderHelper || posOrderImage || isScanningOcr) && (
                  <div className="pt-3 border-t border-flandi-pink space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start">
                      {/* Cột Trái (5 cột): Khung ảnh & Quét trực tiếp */}
                      <div className="md:col-span-5 space-y-2">
                        {posOrderImage ? (
                          <div className="relative rounded-2xl border-2 border-flandi-salmon overflow-hidden bg-flandi-bg p-2 space-y-2 shadow-2xs">
                            <div className="relative h-56 rounded-xl overflow-hidden bg-black/5 flex items-center justify-center">
                              <img
                                src={posOrderImage}
                                alt="Ảnh đơn hàng"
                                className={`w-full h-full object-contain transition duration-300 ${
                                  isScanningOcr ? "brightness-75 blur-2xs" : ""
                                }`}
                              />

                              {/* Hiệu ứng radar scanner đang quét chữ */}
                              {isScanningOcr && (
                                <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/40 text-white p-4">
                                  <Loader2 className="w-8 h-8 animate-spin text-flandi-salmon mb-2" />
                                  <p className="font-extrabold text-xs sm:text-sm text-center">
                                    Đang nhận diện chữ & đọc đơn hàng...
                                  </p>
                                  <div className="w-32 h-1 bg-white/30 rounded-full mt-2 overflow-hidden">
                                    <div className="w-full h-full bg-flandi-coral animate-pulse" />
                                  </div>
                                </div>
                              )}

                              {/* Nút phóng to & xoá */}
                              {!isScanningOcr && (
                                <>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setLightboxImage({
                                        url: posOrderImage,
                                        title: "Ảnh đơn hàng đang lên",
                                      })
                                    }
                                    className="absolute bottom-2 right-2 px-2.5 py-1.5 rounded-lg bg-black/75 hover:bg-black text-white text-[11px] font-bold flex items-center gap-1 shadow cursor-pointer"
                                  >
                                    <Eye className="w-3.5 h-3.5" />
                                    <span>Xem ảnh lớn</span>
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => {
                                      setPosOrderImage("");
                                      setParsedOcrResult(null);
                                      setQuickParseText("");
                                      setOcrConfidence(null);
                                    }}
                                    className="absolute top-2 right-2 w-7 h-7 rounded-full bg-red-600 hover:bg-red-700 text-white flex items-center justify-center shadow cursor-pointer"
                                    title="Xoá ảnh hiện tại"
                                  >
                                    <X className="w-4 h-4" />
                                  </button>
                                </>
                              )}
                            </div>

                            <div className="flex items-center justify-between text-[11px] px-1 font-bold">
                              <span className="text-emerald-700 flex items-center gap-1">
                                <Check className="w-3.5 h-3.5" />
                                <span>Lưu làm chứng từ đơn</span>
                              </span>
                              {ocrConfidence !== null && (
                                <span className="text-flandi-coral bg-flandi-cream px-2 py-0.5 rounded-full border border-flandi-pink">
                                  Độ tin cậy: {ocrConfidence}%
                                </span>
                              )}
                            </div>
                          </div>
                        ) : (
                          /* Dropzone khi chưa có ảnh */
                          <label
                            className={`cursor-pointer h-56 rounded-2xl border-2 border-dashed flex flex-col items-center justify-center p-5 text-center transition ${
                              isDragOverDropzone
                                ? "border-flandi-coral bg-flandi-cream"
                                : "border-flandi-pink hover:border-flandi-coral bg-flandi-bg"
                            }`}
                          >
                            <div className="w-12 h-12 rounded-2xl bg-flandi-cream text-flandi-coral flex items-center justify-center mb-2 shadow-2xs">
                              <ImageIcon className="w-6 h-6" />
                            </div>
                            <span className="text-xs font-black text-flandi-dark">
                              Kéo thả ảnh hoặc Chạm để tải lên
                            </span>
                            <span className="text-[11px] text-flandi-muted font-medium mt-1 leading-relaxed">
                              Hỗ trợ ảnh chụp toa viết tay, màn hình chat Zalo/Messenger, hóa đơn giấy
                            </span>
                            <span className="mt-2.5 px-2.5 py-1 rounded-lg bg-white border border-flandi-pink text-[10px] font-extrabold text-flandi-coral flex items-center gap-1">
                              <Clipboard className="w-3 h-3" />
                              <span>Phím tắt: Nhấn Ctrl+V để dán ảnh</span>
                            </span>
                            <input
                              type="file"
                              accept="image/*"
                              onChange={handleUploadPosOrderImage}
                              className="hidden"
                            />
                          </label>
                        )}

                        {/* Mẹo phím tắt dán ảnh từ clipboard */}
                        <div className="p-2.5 rounded-xl bg-flandi-cream/60 border border-flandi-pink text-[11px] text-flandi-dark/80 flex items-start gap-2">
                          <Sparkles className="w-4 h-4 text-flandi-coral shrink-0 mt-0.5" />
                          <p className="leading-snug">
                            <strong>Mẹo nhanh:</strong> Copy ảnh trên Zalo/Facebook rồi bấm{" "}
                            <kbd className="px-1 py-0.5 rounded bg-white border text-[10px] font-bold">
                              Ctrl+V
                            </kbd>{" "}
                            trực tiếp vào quầy, hệ thống sẽ tự quét và nạp món ngay lập tức.
                          </p>
                        </div>
                      </div>

                      {/* Cột Phải (7 cột): Kết quả nhận diện & Quản lý món bóc tách */}
                      <div className="md:col-span-7 space-y-3">
                        {/* Subtabs: Món Đã Nhận Diện vs Thông Tin Khách vs Văn Bản Gốc */}
                        <div className="flex items-center gap-1.5 p-1 bg-flandi-bg rounded-xl border border-flandi-pink">
                          <button
                            type="button"
                            onClick={() => setOcrActiveTab("ITEMS")}
                            className={`flex-1 py-1.5 rounded-lg text-xs font-extrabold flex items-center justify-center gap-1.5 transition ${
                              ocrActiveTab === "ITEMS"
                                ? "bg-flandi-coral text-white shadow-2xs"
                                : "text-flandi-muted hover:text-flandi-dark"
                            }`}
                          >
                            <ShoppingBag className="w-3.5 h-3.5" />
                            <span>Món Đã Quét ({parsedOcrResult?.items.length || 0})</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => setOcrActiveTab("CUSTOMER")}
                            className={`flex-1 py-1.5 rounded-lg text-xs font-extrabold flex items-center justify-center gap-1.5 transition ${
                              ocrActiveTab === "CUSTOMER"
                                ? "bg-flandi-coral text-white shadow-2xs"
                                : "text-flandi-muted hover:text-flandi-dark"
                            }`}
                          >
                            <Store className="w-3.5 h-3.5" />
                            <span>Khách & Ghi Chú</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => setOcrActiveTab("RAW_TEXT")}
                            className={`flex-1 py-1.5 rounded-lg text-xs font-extrabold flex items-center justify-center gap-1.5 transition ${
                              ocrActiveTab === "RAW_TEXT"
                                ? "bg-flandi-coral text-white shadow-2xs"
                                : "text-flandi-muted hover:text-flandi-dark"
                            }`}
                          >
                            <FileText className="w-3.5 h-3.5" />
                            <span>Văn Bản Gốc</span>
                          </button>
                        </div>

                        {/* TAB 1: Danh sách món đã nhận diện */}
                        {ocrActiveTab === "ITEMS" && (
                          <div className="space-y-2.5">
                            {isScanningOcr ? (
                              <div className="py-12 text-center space-y-2 border border-dashed border-flandi-pink rounded-2xl bg-white">
                                <Loader2 className="w-7 h-7 text-flandi-coral animate-spin mx-auto" />
                                <p className="text-xs font-extrabold text-flandi-dark">
                                  AI đang quét chữ và đối chiếu với thực đơn tiệm...
                                </p>
                              </div>
                            ) : parsedOcrResult && parsedOcrResult.items.length > 0 ? (
                              <div className="space-y-2">
                                <div className="max-h-56 overflow-y-auto space-y-1.5 pr-1">
                                  {parsedOcrResult.items.map((item, idx) => (
                                    <div
                                      key={idx}
                                      className="p-2.5 rounded-xl bg-flandi-bg border border-flandi-pink flex items-center justify-between gap-2 shadow-2xs"
                                    >
                                      <div className="flex items-center gap-2 min-w-0 flex-1">
                                        <img
                                          src={item.product.image}
                                          alt={item.product.name}
                                          className="w-9 h-9 rounded-full object-cover border border-white shrink-0"
                                        />
                                        <div className="min-w-0 flex-1">
                                          <p className="font-extrabold text-xs text-flandi-dark truncate">
                                            {item.product.name}
                                          </p>
                                          {/* Dropdown đổi vị / variant nếu nhận diện chưa đúng */}
                                          {item.product.variants.length > 1 ? (
                                            <select
                                              value={item.variant.id}
                                              onChange={(e) =>
                                                updateParsedItemVariant(
                                                  idx,
                                                  e.target.value
                                                )
                                              }
                                              className="text-[11px] font-bold text-flandi-coral bg-white border border-flandi-pink rounded px-1.5 py-0.5 mt-0.5"
                                            >
                                              {item.product.variants.map((v) => (
                                                <option key={v.id} value={v.id}>
                                                  {v.name} ({formatVND(v.price)})
                                                </option>
                                              ))}
                                            </select>
                                          ) : (
                                            <p className="text-[11px] font-bold text-flandi-coral">
                                              {formatVND(item.variant.price)} / {item.product.unit || "cái"}
                                            </p>
                                          )}
                                        </div>
                                      </div>

                                      {/* Stepper số lượng */}
                                      <div className="flex items-center gap-1 bg-white rounded-full px-2 py-0.5 border border-flandi-pink shrink-0">
                                        <button
                                          type="button"
                                          onClick={() => updateParsedItemQty(idx, -1)}
                                          className="w-5 h-5 flex items-center justify-center text-flandi-dark hover:text-flandi-coral"
                                        >
                                          <Minus className="w-3 h-3" />
                                        </button>
                                        <span className="text-xs font-black w-6 text-center text-flandi-dark">
                                          {item.quantity}
                                        </span>
                                        <button
                                          type="button"
                                          onClick={() => updateParsedItemQty(idx, 1)}
                                          className="w-5 h-5 flex items-center justify-center text-flandi-coral"
                                        >
                                          <Plus className="w-3 h-3" />
                                        </button>
                                      </div>

                                      <button
                                        type="button"
                                        onClick={() => removeParsedItem(idx)}
                                        className="text-red-500 hover:text-red-700 p-1 shrink-0"
                                        title="Bỏ món này"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                  ))}
                                </div>

                                {/* Nút nạp toàn bộ vào giỏ POS */}
                                <div className="pt-2 border-t border-flandi-pink flex items-center justify-between gap-2 flex-wrap">
                                  <label className="flex items-center gap-1.5 text-[11px] font-bold text-flandi-muted select-none cursor-pointer">
                                    <input
                                      type="checkbox"
                                      checked={autoApplyToCart}
                                      onChange={(e) =>
                                        setAutoApplyToCart(e.target.checked)
                                      }
                                      className="rounded text-flandi-coral"
                                    />
                                    <span>Tự động nạp giỏ khi quét xong</span>
                                  </label>

                                  <button
                                    type="button"
                                    onClick={applyParsedItemsToCart}
                                    className="px-4 py-2 rounded-xl bg-gradient-to-r from-flandi-coral to-flandi-salmon hover:opacity-95 text-white font-black text-xs flex items-center gap-1.5 shadow-cute transition cursor-pointer"
                                  >
                                    <ShoppingBag className="w-3.5 h-3.5" />
                                    <span>
                                      Nạp {parsedOcrResult.items.length} Món Vào Giỏ POS
                                    </span>
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div className="py-8 text-center space-y-2 border border-dashed border-flandi-pink rounded-2xl bg-flandi-cream/30 p-4">
                                <p className="text-xs font-bold text-flandi-dark">
                                  Chưa có món nào được nhận diện
                                </p>
                                <p className="text-[11px] text-flandi-muted">
                                  Tải ảnh lên hoặc bấm sang tab <strong>Văn Bản Gốc</strong> để dán nội dung đơn
                                </p>
                              </div>
                            )}

                            {/* Cảnh báo các dòng chưa khớp món (nếu có) */}
                            {parsedOcrResult &&
                              parsedOcrResult.unmatchedLines.length > 0 && (
                                <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-[11px] space-y-1">
                                  <div className="flex items-center gap-1 font-bold">
                                    <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                                    <span>Các dòng chưa khớp được với menu:</span>
                                  </div>
                                  <ul className="list-disc pl-4 space-y-0.5 font-medium text-amber-800">
                                    {parsedOcrResult.unmatchedLines.map((line, i) => (
                                      <li key={i}>{line}</li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                          </div>
                        )}

                        {/* TAB 2: Thông tin khách hàng & Ghi chú */}
                        {ocrActiveTab === "CUSTOMER" && (
                          <div className="space-y-2.5 bg-flandi-bg/60 p-3 rounded-2xl border border-flandi-pink">
                            <p className="text-[11px] font-bold text-flandi-muted">
                              Thông tin khách nhận diện được từ ảnh (tự động điền vào phiếu bán hàng):
                            </p>
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <label className="text-[10px] font-black text-flandi-dark block mb-0.5">
                                  Tên khách
                                </label>
                                <input
                                  type="text"
                                  value={posCustomerName}
                                  onChange={(e) => setPosCustomerName(e.target.value)}
                                  placeholder="Chưa có tên"
                                  className="w-full px-2.5 py-1.5 rounded-xl border border-flandi-pink text-xs font-bold bg-white"
                                />
                              </div>
                              <div>
                                <label className="text-[10px] font-black text-flandi-dark block mb-0.5">
                                  Số điện thoại
                                </label>
                                <input
                                  type="tel"
                                  value={posCustomerPhone}
                                  onChange={(e) => setPosCustomerPhone(e.target.value)}
                                  placeholder="Chưa có SĐT"
                                  className="w-full px-2.5 py-1.5 rounded-xl border border-flandi-pink text-xs font-bold bg-white"
                                />
                              </div>
                            </div>
                            <div>
                              <label className="text-[10px] font-black text-flandi-dark block mb-0.5">
                                Địa chỉ nhận / Ghi chú đơn
                              </label>
                              <textarea
                                rows={2}
                                value={posNote}
                                onChange={(e) => setPosNote(e.target.value)}
                                placeholder="Ghi chú giao bánh..."
                                className="w-full px-2.5 py-1.5 rounded-xl border border-flandi-pink text-xs font-semibold bg-white"
                              />
                            </div>
                          </div>
                        )}

                        {/* TAB 3: Văn bản OCR thô & Chỉnh sửa thủ công */}
                        {ocrActiveTab === "RAW_TEXT" && (
                          <div className="space-y-2">
                            <label className="text-xs font-extrabold text-flandi-dark block">
                              Văn bản trích xuất từ ảnh (bạn có thể sửa trực tiếp):
                            </label>
                            <textarea
                              rows={4}
                              value={quickParseText}
                              onChange={(e) => setQuickParseText(e.target.value)}
                              placeholder="Nội dung chữ trích xuất từ ảnh hoặc tin nhắn khách đặt..."
                              className="w-full px-3 py-2 rounded-xl border border-flandi-pink text-xs font-semibold focus:border-flandi-coral focus:outline-none"
                            />
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setQuickParseText(
                                      "1 chục flan, 2 panna chanh dây, 1 rau câu dừa flan, 2 tàu hũ\nKhách: Chị Lan 0912345678\nĐịa chỉ: 45 Lê Lợi, Q1"
                                    );
                                  }}
                                  className="text-[11px] font-bold text-flandi-coral hover:underline"
                                >
                                  + Mẫu đơn tin nhắn
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setQuickParseText(
                                      "FLANDI\n1. Flan: 10 cái x 6k = 60k\n2. Yogurt: 5 cái x 5k = 25k\n3. Panna việt quất: 2 cái = 20k\nKhách: Anh Nam 0909888999"
                                    );
                                  }}
                                  className="text-[11px] font-bold text-flandi-coral hover:underline"
                                >
                                  + Mẫu bill giấy
                                </button>
                              </div>

                              <button
                                type="button"
                                onClick={reParseCurrentText}
                                className="px-3.5 py-1.5 rounded-xl bg-flandi-dark hover:bg-flandi-coral text-white font-extrabold text-xs flex items-center gap-1.5 transition shadow-xs"
                              >
                                <Wand2 className="w-3.5 h-3.5" />
                                <span>Phân Tích Lại Nội Dung</span>
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Category Filter & Search */}
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

              {/* Customer Info & Note */}
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

              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={posNote}
                  onChange={(e) => setPosNote(e.target.value)}
                  placeholder="Ghi chú đơn (VD: Ít đá, giao lúc 15h...)"
                  className="flex-1 px-3 py-2 rounded-xl border border-flandi-pink text-xs font-semibold focus:border-flandi-coral focus:outline-none"
                />
                <label
                  className={`cursor-pointer px-3 py-2 rounded-xl border text-xs font-extrabold flex items-center gap-1.5 shrink-0 transition ${
                    posOrderImage
                      ? "bg-emerald-50 border-emerald-400 text-emerald-700"
                      : "bg-flandi-bg border-flandi-pink text-flandi-coral hover:bg-flandi-pink/40"
                  }`}
                  title="Đính kèm ảnh chụp đơn hàng hoặc bill chuyển khoản"
                >
                  <Camera className="w-3.5 h-3.5" />
                  <span>{posOrderImage ? "Có ảnh" : "Đính ảnh"}</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleUploadPosOrderImage}
                    className="hidden"
                  />
                </label>
              </div>

              {/* Cart Items List */}
              <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
                {posCart.length === 0 ? (
                  <div className="py-10 text-center text-xs text-flandi-muted font-semibold border border-dashed border-flandi-pink rounded-2xl">
                    Chạm vào các món bên trái hoặc Up Ảnh Lên Đơn để thêm món
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
                      onChange={(e) =>
                        setPosDiscount(Number(e.target.value) || 0)
                      }
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
                      {[posTotal, 50000, 100000, 200000, 500000].map(
                        (amt, i) => (
                          <button
                            key={i}
                            type="button"
                            onClick={() => setPosCashReceived(amt)}
                            className="px-2 py-1 rounded-lg bg-white border border-flandi-pink text-[11px] font-bold hover:border-flandi-coral"
                          >
                            {i === 0 ? "Đưa đủ" : `${amt / 1000}k`}
                          </button>
                        )
                      )}
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
                  <span className="text-flandi-coral">
                    {formatVND(posTotal)}
                  </span>
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
        ) : posView === "RECENT_ORDERS" ? (
          /* Recent Orders in Shift View with Photo Evidence & Quick Actions */
          <div className="space-y-3">
            {orders.slice(0, 30).map((order) => (
              <div
                key={order.id}
                className="bg-white rounded-2xl border-2 border-flandi-pink p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div className="flex items-start gap-3.5 min-w-0 flex-1">
                  {order.attachmentImage && (
                    <button
                      type="button"
                      onClick={() =>
                        setLightboxImage({
                          url: order.attachmentImage!,
                          title: `Ảnh đơn hàng / Bill #${order.code} (${order.customerName})`,
                        })
                      }
                      className="relative w-16 h-16 rounded-2xl overflow-hidden border-2 border-flandi-salmon shrink-0 group bg-flandi-bg"
                      title="Bấm để xem ảnh đơn hàng / bill"
                    >
                      <img
                        src={order.attachmentImage}
                        alt={order.code}
                        className="w-full h-full object-cover"
                      />
                      <span className="absolute inset-0 bg-black/35 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition">
                        <Eye className="w-4 h-4" />
                      </span>
                    </button>
                  )}

                  <div className="space-y-1 min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-extrabold text-sm text-flandi-coral">
                        #{order.code}
                      </span>
                      <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-flandi-cream text-flandi-dark">
                        {order.source}
                      </span>
                      <span
                        className={`text-xs font-extrabold px-2 py-0.5 rounded-full ${
                          order.status === "COMPLETED"
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-amber-100 text-amber-800"
                        }`}
                      >
                        {order.status}
                      </span>
                      <span className="text-xs text-flandi-muted">
                        {new Date(order.createdAt).toLocaleTimeString("vi-VN")}
                      </span>
                    </div>
                    <p className="text-xs font-bold text-flandi-dark">
                      {order.customerName}{" "}
                      {order.customerPhone ? `• ${order.customerPhone}` : ""}
                    </p>
                    {order.note && (
                      <p className="text-[11px] text-flandi-muted font-medium">
                        Ghi chú: {order.note}
                      </p>
                    )}
                    <div className="flex flex-wrap gap-1">
                      {order.items.map((it, idx) => (
                        <span
                          key={idx}
                          className="text-[11px] bg-flandi-bg border border-flandi-pink px-2 py-0.5 rounded-md font-semibold"
                        >
                          {it.quantity}x {it.productName} ({it.variantName})
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <span className="font-extrabold text-base text-flandi-coral mr-2">
                    {formatVND(order.total)}
                  </span>

                  <label className="cursor-pointer px-3 py-2 rounded-xl bg-flandi-bg hover:bg-flandi-pink/50 text-flandi-dark border border-flandi-pink text-xs font-bold flex items-center gap-1">
                    <Camera className="w-3.5 h-3.5 text-flandi-coral" />
                    <span>
                      {order.attachmentImage ? "Đổi ảnh" : "Up ảnh Bill"}
                    </span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) =>
                        handleAttachPhotoToExistingOrder(order.id, e)
                      }
                      className="hidden"
                    />
                  </label>

                  {order.status !== "COMPLETED" &&
                    order.status !== "CANCELLED" && (
                      <button
                        type="button"
                        onClick={() => handleQuickCompleteOrder(order.id)}
                        className="px-3 py-2 rounded-xl bg-emerald-600 text-white text-xs font-extrabold flex items-center gap-1"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Hoàn tất</span>
                      </button>
                    )}
                  <button
                    type="button"
                    onClick={() => setReceiptOrder(order)}
                    className="px-3 py-2 rounded-xl bg-flandi-coral text-white text-xs font-extrabold flex items-center gap-1"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>In Bill</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* Sổ Sách & Up Ảnh Chứng Từ View */
          <LedgerBookManager
            ledger={ledger}
            orders={orders}
            notify={notify}
            onRefresh={fetchPosData}
            onSendImageToPosOrder={(imgUrl, titleText) => {
              if (titleText && !posNote) {
                setPosNote(`Từ ảnh sổ sách: ${titleText}`);
              }
              setPosView("COUNTER");
              processImageForOcr(imgUrl);
            }}
          />
        )}
      </main>

      {/* Lightbox Modal for Order Photo */}
      {lightboxImage && (
        <div
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setLightboxImage(null)}
        >
          <div
            className="bg-white rounded-3xl max-w-2xl w-full p-4 space-y-3 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-flandi-pink pb-2">
              <h4 className="font-extrabold text-sm text-flandi-dark truncate">
                {lightboxImage.title}
              </h4>
              <button
                type="button"
                onClick={() => setLightboxImage(null)}
                className="p-1.5 rounded-full bg-flandi-bg hover:bg-flandi-pink/50"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="max-h-[75vh] overflow-auto rounded-2xl bg-black/5 flex items-center justify-center">
              <img
                src={lightboxImage.url}
                alt={lightboxImage.title}
                className="max-w-full max-h-[72vh] object-contain"
              />
            </div>
          </div>
        </div>
      )}

      {/* Thermal Receipt Print Modal */}
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
                  SĐT/Zalo: {settings?.phone || "0703166903"}
                </p>
              </div>

              <div className="text-[11px] space-y-0.5">
                <p>
                  Mã HĐ: <strong>#{receiptOrder.code}</strong> (
                  {receiptOrder.source})
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
