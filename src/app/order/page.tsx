"use client";

import React, { useEffect, useState, useMemo, useRef } from "react";
import Link from "next/link";
import {
  Plus,
  Minus,
  Trash2,
  Copy,
  Check,
  Sparkles,
  Send,
  MessageCircle,
  Phone,
  ShoppingBag,
  QrCode,
  CheckCircle2,
  X,
  Zap,
  Share2,
  ChevronUp,
  ChevronDown,
  Delete,
  User,
  MapPin,
  AlertCircle,
  Receipt,
  Download,
  Lock,
  Maximize2,
  Bike,
} from "lucide-react";
import { Product, ProductVariant, ShopSettings } from "@/lib/types";
import { ROLE_META } from "@/lib/rbac";
import {
  generateBillImage,
  preloadBillAssets,
  GeneratedBillImage,
  BillImageItem,
} from "@/lib/bill-image";
import LiveChatWidget, {
  copyToClipboardInstant,
} from "@/components/LiveChatWidget";
import { useCustomerAuth } from "@/lib/customer-auth-context";
import CustomerHeaderAuthButton from "@/components/CustomerHeaderAuthButton";
import CustomerAccountDrawer from "@/components/CustomerAccountDrawer";
import ShopContactModal from "@/components/ShopContactModal";

interface QuickLineItem {
  product: Product;
  variant: ProductVariant;
  quantity: number;
}

export default function QuickSingleScreenOrderPage() {
  const { user, role, can, triggerGoogleSignIn, openAccountDrawer } =
    useCustomerAuth();
  const canCreateOrder = can("orders:create");
  const [products, setProducts] = useState<Product[]>([]);
  const [settings, setSettings] = useState<ShopSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [isContactModalOpen, setIsContactModalOpen] = useState(false);

  // Cart keyed by productId
  const [cartMap, setCartMap] = useState<Record<string, QuickLineItem>>({});
  const [isExpanded, setIsExpanded] = useState(false);
  const isReadyToSaveCartRef = useRef(false);
  const isReadyToSaveCustRef = useRef(false);

  // Compact customer info
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [addressError, setAddressError] = useState<string | null>(null);
  const [honeypot, setHoneypot] = useState("");

  // Tự động điền thông tin từ tài khoản Google khi là khách lẻ (không ghi đè form khi Staff/Admin lên đơn giúp khách)
  useEffect(() => {
    if (user && role === "user") {
      if (!customerName && user.name) {
        setCustomerName(user.name);
      }
      if (!customerPhone && user.phone) {
        setCustomerPhone(user.phone);
      }
      if (!customerAddress && user.address) {
        setCustomerAddress(user.address);
      }
    }
  }, [user, role]);

  const [copied, setCopied] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [sendingChannel, setSendingChannel] = useState<
    "MESSENGER" | "ZALO" | "DIRECT" | null
  >(null);
  const [openChatTrigger, setOpenChatTrigger] = useState(0);
  const [chatRefreshTrigger, setChatRefreshTrigger] = useState(0);
  const [preferredChatChannel, setPreferredChatChannel] = useState<
    "MESSENGER" | "ZALO"
  >("MESSENGER");
  const [sentResultModal, setSentResultModal] = useState<{
    channel: "MESSENGER" | "ZALO" | "DIRECT";
    orderCode: string;
    orderText: string;
    items: BillImageItem[];
    subtotal: number;
    shippingFee: number;
    total: number;
    zaloWebUrl: string;
    messengerWebUrl: string;
    zaloPhone: string;
  } | null>(null);

  const [isSavingBillImage, setIsSavingBillImage] = useState(false);
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);
  const [billImageModal, setBillImageModal] = useState<
    (GeneratedBillImage & { autoCopied?: boolean }) | null
  >(null);
  const [previewProduct, setPreviewProduct] = useState<Product | null>(null);
  const preparedBillRef = useRef<{
    key: string;
    data: GeneratedBillImage;
  } | null>(null);
  const preparedSentBillRef = useRef<{
    orderCode: string;
    data: GeneratedBillImage;
  } | null>(null);

  const billTextareaRef = useRef<HTMLTextAreaElement | null>(null);

  const notify = (msg: string) => {
    setToast(msg);
    setTimeout(() => {
      setToast((prev) => (prev === msg ? null : prev));
    }, 3500);
  };

  const handleReorder = (items: { productId: string; quantity: number }[]) => {
    setCartMap((prev) => {
      const copy = { ...prev };
      for (const item of items) {
        const prod = products.find((p) => p.id === item.productId);
        if (prod) {
          copy[prod.id] = {
            product: prod,
            variant: getBaseVariant(prod),
            quantity: item.quantity,
          };
        }
      }
      return copy;
    });
      notify("🍮 Đã thêm lại đơn cũ!");
  };

  const formatVND = (n: number) => {
    const val = Number(n) || 0;
    const inK = val / 1000;
    if (Number.isInteger(inK)) {
      return `${inK}k`;
    }
    return `${Number(inK.toFixed(1))}k`;
  };

  const getBaseVariant = (product: Product): ProductVariant => {
    return (
      product.variants?.[0] || {
        id: `${product.id}-base`,
        name: product.name,
        price: product.price,
        unitLabel: product.unit || "cái",
        stockDeduction: 1,
      }
    );
  };

  // 1. Khôi phục giỏ hàng và thông tin khách từ localStorage sau khi mount (tránh SSR hydration mismatch)
  useEffect(() => {
    try {
      const savedName = localStorage.getItem("flandi_customer_name");
      const savedPhone = localStorage.getItem("flandi_customer_phone");
      const savedAddress = localStorage.getItem("flandi_customer_address");
      const savedCart = localStorage.getItem("flandi_order_cart");

      if (savedName) setCustomerName(savedName);
      if (savedPhone) setCustomerPhone(savedPhone);
      if (savedAddress) setCustomerAddress(savedAddress);

      if (savedCart) {
        const parsed = JSON.parse(savedCart);
        if (parsed && typeof parsed === "object" && Object.keys(parsed).length > 0) {
          const cleanCart: Record<string, QuickLineItem> = {};
          for (const [k, v] of Object.entries(parsed)) {
            const item = v as any;
            if (
              item &&
              item.product &&
              typeof item.product.price === "number" &&
              item.quantity > 0
            ) {
              cleanCart[k] = item;
            }
          }
          if (Object.keys(cleanCart).length > 0) {
            setCartMap(cleanCart);
          }
        }
      }
    } catch (e) {
      console.error("Failed to restore cart from localStorage:", e);
    }
  }, []);

  // 2. Lưu giỏ hàng vào localStorage mỗi khi thay đổi (bỏ qua lượt chạy khởi tạo đầu tiên)
  useEffect(() => {
    if (!isReadyToSaveCartRef.current) {
      isReadyToSaveCartRef.current = true;
      return;
    }
    try {
      if (Object.keys(cartMap).length > 0) {
        localStorage.setItem("flandi_order_cart", JSON.stringify(cartMap));
      } else {
        localStorage.removeItem("flandi_order_cart");
      }
    } catch (e) {
      console.error("Failed to save cart to localStorage:", e);
    }
  }, [cartMap]);

  // 3. Tự động lưu thông tin khách hàng để khi lỡ tay refresh không phải nhập lại
  useEffect(() => {
    if (!isReadyToSaveCustRef.current) {
      isReadyToSaveCustRef.current = true;
      return;
    }
    try {
      if (customerName) {
        localStorage.setItem("flandi_customer_name", customerName);
      } else {
        localStorage.removeItem("flandi_customer_name");
      }
      if (customerPhone) {
        localStorage.setItem("flandi_customer_phone", customerPhone);
      } else {
        localStorage.removeItem("flandi_customer_phone");
      }
      if (customerAddress) {
        localStorage.setItem("flandi_customer_address", customerAddress);
      } else {
        localStorage.removeItem("flandi_customer_address");
      }
    } catch {}
  }, [customerName, customerPhone, customerAddress]);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch("/api/store", { cache: "no-store" });
        const data = await res.json();
        const activeProds: Product[] = (data.products || []).filter(
          (p: Product) => p.isActive !== false
        );
        activeProds.sort((a, b) => {
          if (a.price !== b.price) {
            return a.price - b.price;
          }
          return a.name.localeCompare(b.name, "vi");
        });
        setProducts(activeProds);
        setSettings(data.settings || null);

        // Đồng bộ dữ liệu món trong giỏ với danh sách sản phẩm mới nhất từ tiệm
        setCartMap((prevCart) => {
          if (!prevCart || Object.keys(prevCart).length === 0) return prevCart;
          let changed = false;
          const updated: Record<string, QuickLineItem> = {};
          for (const [id, item] of Object.entries(prevCart)) {
            const freshProd = activeProds.find((p) => p.id === id);
            if (freshProd && item.quantity > 0) {
              const freshVariant = getBaseVariant(freshProd);
              updated[id] = {
                product: freshProd,
                variant: freshVariant,
                quantity: item.quantity,
              };
              changed = true;
            } else if (item && item.quantity > 0) {
              // Giữ nguyên sản phẩm đã chọn nếu chưa tìm thấy trong activeProds
              updated[id] = item;
            }
          }
          return changed ? updated : prevCart;
        });
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const getQtyForProduct = (productId: string): number => {
    return cartMap[productId]?.quantity || 0;
  };

  const updateQty = (product: Product, delta: number) => {
    const variant = getBaseVariant(product);
    setCartMap((prev) => {
      const current = prev[product.id]?.quantity || 0;
      const nextQty = Math.max(0, current + delta);
      const copy = { ...prev };
      if (nextQty <= 0) {
        delete copy[product.id];
      } else {
        copy[product.id] = { product, variant, quantity: nextQty };
      }
      return copy;
    });
  };

  const setExactQty = (product: Product, qty: number) => {
    const variant = getBaseVariant(product);
    setCartMap((prev) => {
      const copy = { ...prev };
      if (qty <= 0) {
        delete copy[product.id];
      } else {
        copy[product.id] = { product, variant, quantity: qty };
      }
      return copy;
    });
  };

  const removeFromBill = (productId: string) => {
    setCartMap((prev) => {
      const copy = { ...prev };
      delete copy[productId];
      return copy;
    });
  };

  // Custom numeric keypad state & methods (chỉ có số kèm nút xóa và clear)
  const [keypadProduct, setKeypadProduct] = useState<Product | null>(null);
  const [keypadDraftQty, setKeypadDraftQty] = useState<number>(0);
  const [isFreshKeypadInput, setIsFreshKeypadInput] = useState<boolean>(true);

  const openKeypad = (product: Product) => {
    setKeypadProduct(product);
    setKeypadDraftQty(getQtyForProduct(product.id));
    setIsFreshKeypadInput(true);
  };

  const cancelKeypad = () => {
    setKeypadProduct(null);
    setIsFreshKeypadInput(true);
  };

  const confirmKeypad = () => {
    if (keypadProduct) {
      setExactQty(keypadProduct, keypadDraftQty);
    }
    setKeypadProduct(null);
    setIsFreshKeypadInput(true);
  };

  const handleKeypadDigit = (digit: number) => {
    if (!keypadProduct) return;
    let nextVal: number;
    if (isFreshKeypadInput) {
      nextVal = digit;
      setIsFreshKeypadInput(false);
    } else {
      if (keypadDraftQty === 0) {
        nextVal = digit;
      } else {
        nextVal = Math.min(parseInt(`${keypadDraftQty}${digit}`, 10) || 0, 999);
      }
    }
    setKeypadDraftQty(nextVal);
  };

  const handleKeypadBackspace = () => {
    if (!keypadProduct) return;
    setIsFreshKeypadInput(false);
    const str = keypadDraftQty.toString();
    if (str.length <= 1) {
      setKeypadDraftQty(0);
    } else {
      const nextStr = str.slice(0, -1);
      setKeypadDraftQty(parseInt(nextStr, 10) || 0);
    }
  };

  const handleKeypadClear = () => {
    if (!keypadProduct) return;
    setIsFreshKeypadInput(false);
    setKeypadDraftQty(0);
  };

  // Physical keyboard support for custom keypad
  useEffect(() => {
    if (!keypadProduct) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key >= "0" && e.key <= "9") {
        e.preventDefault();
        handleKeypadDigit(parseInt(e.key, 10));
      } else if (e.key === "Backspace") {
        e.preventDefault();
        handleKeypadBackspace();
      } else if (e.key === "Enter") {
        e.preventDefault();
        confirmKeypad();
      } else if (e.key === "Escape") {
        e.preventDefault();
        cancelKeypad();
      } else if (e.key === "c" || e.key === "C") {
        e.preventDefault();
        handleKeypadClear();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [keypadProduct, isFreshKeypadInput, keypadDraftQty]);

  const sortedProducts = useMemo(() => {
    return [...products].sort((a, b) => {
      if (a.price !== b.price) {
        return a.price - b.price;
      }
      return a.name.localeCompare(b.name, "vi");
    });
  }, [products]);

  const unselectedProducts = useMemo(
    () => sortedProducts.filter((p) => getQtyForProduct(p.id) === 0),
    [sortedProducts, cartMap]
  );

  const selectedProducts = useMemo(
    () => sortedProducts.filter((p) => getQtyForProduct(p.id) > 0),
    [sortedProducts, cartMap]
  );

  const cartItems = useMemo(
    () =>
      Object.values(cartMap).filter(
        (item): item is QuickLineItem =>
          Boolean(item && item.product && typeof item.product.price === "number")
      ),
    [cartMap]
  );

  const subtotal = useMemo(
    () => cartItems.reduce((s, i) => s + i.product.price * i.quantity, 0),
    [cartItems]
  );

  const freeShipMin = settings?.freeShipMinimum ?? 0;
  const defaultShipFee = settings?.defaultShippingFee ?? 0;
  const shippingFee =
    subtotal === 0
      ? 0
      : freeShipMin === 0 || defaultShipFee === 0 || subtotal >= freeShipMin
      ? 0
      : defaultShipFee;
  const grandTotal = subtotal + shippingFee;

  // Build formatted text message for Messenger / Zalo (clean, without extra category/variant labels)
  const buildOrderMessageText = (code?: string) => {
    const lines: string[] = [];
    lines.push(
      `🍮 ĐƠN ĐẶT BÁNH FLANDI ${code ? `(#${code})` : ""}`.trim()
    );
    lines.push("------------------------");
    cartItems.forEach((item, idx) => {
      lines.push(
        `${idx + 1}. ${item.product.name}: ${formatVND(
          item.product.price
        )} x ${item.quantity} = ${formatVND(
          item.product.price * item.quantity
        )}`
      );
    });
    lines.push("------------------------");
    lines.push(`• Tạm tính: ${formatVND(subtotal)}`);
    lines.push(
      `• Phí ship: ${
        shippingFee === 0 ? "FREESHIP" : formatVND(shippingFee)
      }`
    );
    lines.push(`💰 THÀNH TIỀN: ${formatVND(grandTotal)}`);
    if (customerName.trim() || customerPhone.trim()) {
      lines.push(
        `👤 Khách: ${customerName.trim() || "Khách đặt nhanh"}${
          customerPhone.trim() ? ` - SĐT: ${customerPhone.trim()}` : ""
        }`
      );
    }
    if (customerAddress.trim()) {
      lines.push(`📍 Địa chỉ nhận: ${customerAddress.trim()}`);
    }
    return lines.join("\n");
  };

  const liveOrderPreviewText = useMemo(
    () => (cartItems.length > 0 ? buildOrderMessageText() : ""),
    [
      cartItems,
      subtotal,
      shippingFee,
      grandTotal,
      customerName,
      customerPhone,
      customerAddress,
    ]
  );

  const closeBillImageModal = () => {
    setBillImageModal((prev) => {
      if (prev?.objectUrl) {
        URL.revokeObjectURL(prev.objectUrl);
      }
      return null;
    });
  };

  const triggerBillDownload = (imgData: GeneratedBillImage) => {
    const a = document.createElement("a");
    a.href = imgData.objectUrl;
    a.download = imgData.fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleCopyBillImage = async (imgData: GeneratedBillImage) => {
    try {
      if (
        typeof navigator !== "undefined" &&
        navigator.clipboard?.write &&
        typeof ClipboardItem !== "undefined"
      ) {
        await navigator.clipboard.write([
          new ClipboardItem({ [imgData.blob.type]: imgData.blob }),
        ]);
        setBillImageModal((prev) =>
          prev ? { ...prev, autoCopied: true } : prev
        );
        notify("📋 Đã copy ảnh bill!");
        return;
      }
    } catch {
      // Fallback below if clipboard image write is blocked
    }
    triggerBillDownload(imgData);
    notify("📥 Đã lưu ảnh bill!");
  };

  const handleShareBillImage = async (imgData: GeneratedBillImage) => {
    try {
      const file = new File([imgData.blob], imgData.fileName, {
        type: "image/png",
        lastModified: Date.now(),
      });
      if (
        typeof navigator !== "undefined" &&
        typeof navigator.share === "function" &&
        (!navigator.canShare || navigator.canShare({ files: [file] }))
      ) {
        // Pass ONLY { files: [file] } (no title/text) so iOS UIActivityViewController & Android show Messenger, Threads, Zalo, Instagram
        await navigator.share({ files: [file] });
        return;
      }
    } catch (err) {
      if ((err as Error)?.name === "AbortError") {
        return;
      }
    }
    notify("ℹ️ Trình duyệt chưa hỗ trợ Share.");
  };

  const handleShareBillViaPlatform = async (
    platform: "ZALO" | "MESSENGER",
    imgData: GeneratedBillImage
  ) => {
    if (
      typeof navigator !== "undefined" &&
      navigator.clipboard?.write &&
      typeof ClipboardItem !== "undefined"
    ) {
      try {
        await navigator.clipboard.write([
          new ClipboardItem({ [imgData.blob.type]: imgData.blob }),
        ]);
        setBillImageModal((prev) =>
          prev ? { ...prev, autoCopied: true } : prev
        );
      } catch {
        // Keep previously copied clipboard item if any
      }
    }

    const zaloPhone = settings?.zaloPhone || settings?.phone || "0703166903";
    const targetUrl =
      platform === "ZALO"
        ? `https://zalo.me/${zaloPhone}`
        : settings?.messengerUrl ||
          settings?.facebookUrl ||
          "https://www.facebook.com/tiem.flandi";

    window.open(targetUrl, "_blank", "noopener,noreferrer");
    notify(
      platform === "ZALO"
        ? "📋 Đã copy ảnh! Dán (Ctrl+V) vào Zalo."
        : "📋 Đã copy ảnh! Dán (Ctrl+V) vào Messenger."
    );
  };

  const currentCartBillKey = useMemo(() => {
    if (cartItems.length === 0) return "";
    const itemsPart = cartItems
      .map((i) => `${i.product.id}:${i.quantity}:${i.product.price}`)
      .join("|");
    return `${itemsPart}__${subtotal}__${shippingFee}__${grandTotal}__${customerName.trim()}__${customerPhone.trim()}__${customerAddress.trim()}`;
  }, [
    cartItems,
    subtotal,
    shippingFee,
    grandTotal,
    customerName,
    customerPhone,
    customerAddress,
  ]);

  // Preload fonts + mascot + product images on mount so Canvas draws in ~15ms
  useEffect(() => {
    if (products.length === 0) return;
    const mascotUrl =
      settings?.pageConfig?.headerLogoUrl ||
      settings?.brandKit?.mascotImage ||
      "/images/branding/flandi-mascot.png";
    preloadBillAssets([mascotUrl, ...products.map((p) => p.image)]);
  }, [products, settings]);

  // Pre-warm bill PNG immediately so Phone Share Bill has File ready in RAM at t = 0ms
  useEffect(() => {
    if (!currentCartBillKey || cartItems.length === 0) {
      if (preparedBillRef.current?.data.objectUrl) {
        URL.revokeObjectURL(preparedBillRef.current.data.objectUrl);
      }
      preparedBillRef.current = null;
      return;
    }

    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const generated = await generateBillImage({
          items: cartItems.map((i) => ({
            name: i.product.name,
            badgeText: i.product.badgeText,
            image: i.product.image,
            unit: i.product.unit || "cái",
            price: i.product.price,
            quantity: i.quantity,
          })),
          subtotal,
          shippingFee,
          grandTotal,
          customerName,
          customerPhone,
          customerAddress,
          shopName: settings?.shopName || "Tiệm bánh Flandi",
          tagline: settings?.tagline || "Muốn ăn hãy Flăn vào tớ",
          mascotUrl:
            settings?.pageConfig?.headerLogoUrl ||
            settings?.brandKit?.mascotImage ||
            "/images/branding/flandi-mascot.png",
          shopPhone: settings?.zaloPhone || settings?.phone || "0703166903",
          shopAddress:
            settings?.address ||
            "123/3 Nguyễn Hữu Cảnh, Thủ Dầu Một, TP Hồ Chí Minh",
        });

        if (cancelled) {
          URL.revokeObjectURL(generated.objectUrl);
          return;
        }
        if (preparedBillRef.current?.data.objectUrl) {
          URL.revokeObjectURL(preparedBillRef.current.data.objectUrl);
        }
        preparedBillRef.current = {
          key: currentCartBillKey,
          data: generated,
        };
      } catch {
        // Silent warm-up failure; click handler generates on-demand
      }
    }, 30);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [
    currentCartBillKey,
    cartItems,
    subtotal,
    shippingFee,
    grandTotal,
    customerName,
    customerPhone,
    customerAddress,
    settings,
  ]);

  // Pre-warm post-checkout sentResultModal bill PNG immediately when modal opens
  useEffect(() => {
    if (!sentResultModal) {
      if (preparedSentBillRef.current?.data.objectUrl) {
        URL.revokeObjectURL(preparedSentBillRef.current.data.objectUrl);
      }
      preparedSentBillRef.current = null;
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const generated = await generateBillImage({
          orderCode: sentResultModal.orderCode,
          items: sentResultModal.items,
          subtotal: sentResultModal.subtotal,
          shippingFee: sentResultModal.shippingFee,
          grandTotal: sentResultModal.total,
          customerName,
          customerPhone,
          customerAddress,
          shopName: settings?.shopName || "Tiệm bánh Flandi",
          tagline: settings?.tagline || "Muốn ăn hãy Flăn vào tớ",
          mascotUrl:
            settings?.pageConfig?.headerLogoUrl ||
            settings?.brandKit?.mascotImage ||
            "/images/branding/flandi-mascot.png",
          shopPhone: settings?.zaloPhone || settings?.phone || "0703166903",
          shopAddress:
            settings?.address ||
            "123/3 Nguyễn Hữu Cảnh, Thủ Dầu Một, TP Hồ Chí Minh",
        });
        if (cancelled) {
          URL.revokeObjectURL(generated.objectUrl);
          return;
        }
        if (preparedSentBillRef.current?.data.objectUrl) {
          URL.revokeObjectURL(preparedSentBillRef.current.data.objectUrl);
        }
        preparedSentBillRef.current = {
          orderCode: sentResultModal.orderCode,
          data: generated,
        };
      } catch {
        // Handled on-demand if needed
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    sentResultModal,
    customerName,
    customerPhone,
    customerAddress,
    settings,
  ]);

  // Close product description or share bill modal on Escape key
  useEffect(() => {
    if (!previewProduct && !billImageModal) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (previewProduct) setPreviewProduct(null);
        else if (billImageModal) closeBillImageModal();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [previewProduct, billImageModal]);

  const handleOpenShareBill = async (overrideSnapshot?: {
    orderCode?: string;
    items: BillImageItem[];
    subtotal: number;
    shippingFee: number;
    total: number;
  }) => {
    const itemsToExport: BillImageItem[] = overrideSnapshot
      ? overrideSnapshot.items
      : cartItems.map((i) => ({
          name: i.product.name,
          badgeText: i.product.badgeText,
          image: i.product.image,
          unit: i.product.unit || "cái",
          price: i.product.price,
          quantity: i.quantity,
        }));

    if (itemsToExport.length === 0) {
      notify("🍮 Chọn ít nhất 1 món trước nha!");
      return;
    }

    const isPhoneUI =
      typeof window !== "undefined" &&
      (window.innerWidth < 1024 ||
        /iPhone|iPad|iPod|Android/i.test(navigator.userAgent));

    // PHONE FLOW: Copy ảnh vào clipboard + Mở cửa sổ Share của hệ điều hành (Messenger, Threads, Zalo...)
    if (isPhoneUI) {
      const fallbackText = overrideSnapshot
        ? sentResultModal?.orderText || buildOrderMessageText(overrideSnapshot.orderCode)
        : liveOrderPreviewText;

      if (typeof window !== "undefined" && !window.isSecureContext) {
        copyToClipboardInstant(fallbackText);
        notify("🔒 Cần HTTPS để Share & copy ảnh!");
        return;
      }

      const warmMatch = overrideSnapshot?.orderCode
        ? preparedSentBillRef.current?.orderCode === overrideSnapshot.orderCode
          ? preparedSentBillRef.current.data
          : null
        : preparedBillRef.current?.key === currentCartBillKey
        ? preparedBillRef.current.data
        : null;

      if (warmMatch) {
        // 1. Copy PNG image into clipboard synchronously inside the user gesture
        if (
          typeof navigator !== "undefined" &&
          navigator.clipboard?.write &&
          typeof ClipboardItem !== "undefined"
        ) {
          try {
            navigator.clipboard
              .write([new ClipboardItem({ "image/png": warmMatch.blob })])
              .catch(() => {
                copyToClipboardInstant(fallbackText);
              });
          } catch {
            copyToClipboardInstant(fallbackText);
          }
        } else {
          copyToClipboardInstant(fallbackText);
        }

        // 2. Open OS Share Sheet synchronously with ONLY { files: [file] } so Messenger, Threads, Zalo all appear
        const file = new File([warmMatch.blob], warmMatch.fileName, {
          type: "image/png",
          lastModified: Date.now(),
        });

        if (
          typeof navigator !== "undefined" &&
          typeof navigator.share === "function"
        ) {
          try {
            if (!navigator.canShare || navigator.canShare({ files: [file] })) {
              await navigator.share({ files: [file] });
            } else {
              await navigator.share({ text: fallbackText });
            }
            return;
          } catch (err) {
            if ((err as Error)?.name === "AbortError") {
              notify("📋 Đã copy ảnh bill!");
              return;
            }
          }
        }

        notify("📋 Đã copy ảnh bill!");
        return;
      }

      // On-demand path if tapped within <30ms before warm cache finished
      setIsSavingBillImage(true);
      try {
        const genPromise = generateBillImage({
          orderCode: overrideSnapshot?.orderCode,
          items: itemsToExport,
          subtotal: overrideSnapshot ? overrideSnapshot.subtotal : subtotal,
          shippingFee: overrideSnapshot
            ? overrideSnapshot.shippingFee
            : shippingFee,
          grandTotal: overrideSnapshot ? overrideSnapshot.total : grandTotal,
          customerName,
          customerPhone,
          customerAddress,
          shopName: settings?.shopName || "Tiệm bánh Flandi",
          tagline: settings?.tagline || "Muốn ăn hãy Flăn vào tớ",
          mascotUrl:
            settings?.pageConfig?.headerLogoUrl ||
            settings?.brandKit?.mascotImage ||
            "/images/branding/flandi-mascot.png",
          shopPhone: settings?.zaloPhone || settings?.phone || "0703166903",
          shopAddress:
            settings?.address ||
            "123/3 Nguyễn Hữu Cảnh, Thủ Dầu Một, TP Hồ Chí Minh",
        });

        if (
          typeof navigator !== "undefined" &&
          navigator.clipboard?.write &&
          typeof ClipboardItem !== "undefined"
        ) {
          try {
            navigator.clipboard
              .write([
                new ClipboardItem({
                  "image/png": genPromise.then((g) => g.blob),
                }),
              ])
              .catch(() => {});
          } catch {
            // Handled below
          }
        }

        const generated = await genPromise;
        try {
          const file = new File([generated.blob], generated.fileName, {
            type: "image/png",
            lastModified: Date.now(),
          });
          if (
            typeof navigator !== "undefined" &&
            typeof navigator.share === "function"
          ) {
            if (!navigator.canShare || navigator.canShare({ files: [file] })) {
              await navigator.share({ files: [file] });
            } else {
              await navigator.share({ text: fallbackText });
            }
            return;
          }
          notify("📋 Đã copy ảnh bill!");
        } catch (err) {
          if ((err as Error)?.name === "AbortError") {
            notify("📋 Đã copy ảnh bill!");
          } else {
            notify("📋 Đã copy ảnh bill!");
          }
        } finally {
          setTimeout(() => URL.revokeObjectURL(generated.objectUrl), 5000);
        }
      } catch (err) {
        console.error("Failed to share bill on phone:", err);
        notify("⚠️ Lỗi tạo ảnh bill, thử lại nhé!");
      } finally {
        setIsSavingBillImage(false);
      }
      return;
    }

    // WEB FLOW: Tự động copy ảnh & mở popup Share Bill clean
    setIsSavingBillImage(true);
    try {
      const genPromise = generateBillImage({
        orderCode: overrideSnapshot?.orderCode,
        items: itemsToExport,
        subtotal: overrideSnapshot ? overrideSnapshot.subtotal : subtotal,
        shippingFee: overrideSnapshot
          ? overrideSnapshot.shippingFee
          : shippingFee,
        grandTotal: overrideSnapshot ? overrideSnapshot.total : grandTotal,
        customerName,
        customerPhone,
        customerAddress,
        shopName: settings?.shopName || "Tiệm bánh Flandi",
        tagline: settings?.tagline || "Muốn ăn hãy Flăn vào tớ",
        mascotUrl:
          settings?.pageConfig?.headerLogoUrl ||
          settings?.brandKit?.mascotImage ||
          "/images/branding/flandi-mascot.png",
        shopPhone: settings?.zaloPhone || settings?.phone || "0703166903",
        shopAddress:
          settings?.address ||
          "123/3 Nguyễn Hữu Cảnh, Thủ Dầu Một, TP Hồ Chí Minh",
      });

      // Synchronously register ClipboardItem(Promise<Blob>) inside the user click gesture
      let syncCopyPromise: Promise<boolean> = Promise.resolve(false);
      if (
        typeof navigator !== "undefined" &&
        navigator.clipboard?.write &&
        typeof ClipboardItem !== "undefined"
      ) {
        try {
          const item = new ClipboardItem({
            "image/png": genPromise.then((g) => g.blob),
          });
          syncCopyPromise = navigator.clipboard
            .write([item])
            .then(() => true)
            .catch(() => false);
        } catch {
          syncCopyPromise = Promise.resolve(false);
        }
      }

      const generated = await genPromise;
      let autoCopied = await syncCopyPromise;

      if (
        !autoCopied &&
        typeof navigator !== "undefined" &&
        navigator.clipboard?.write &&
        typeof ClipboardItem !== "undefined"
      ) {
        try {
          await navigator.clipboard.write([
            new ClipboardItem({ [generated.blob.type]: generated.blob }),
          ]);
          autoCopied = true;
        } catch {
          autoCopied = false;
        }
      }

      setBillImageModal((prev) => {
        if (prev?.objectUrl) {
          URL.revokeObjectURL(prev.objectUrl);
        }
        return { ...generated, autoCopied };
      });
    } catch (err) {
      console.error("Failed to generate bill image:", err);
      notify("⚠️ Lỗi tạo ảnh bill, thử lại nhé!");
    } finally {
      setIsSavingBillImage(false);
    }
  };

  const validateOrder = (): boolean => {
    // 1. Kiểm tra giỏ hàng
    if (cartItems.length === 0) {
      notify("🍮 Chọn ít nhất 1 món trước nha!");
      return false;
    }

    let valid = true;

    // 2. Kiểm tra số điện thoại (bắt buộc, 10 số hợp lệ tại VN)
    const rawPhone = customerPhone.trim();
    const cleanPhone = rawPhone.replace(/[\s.-]/g, "");
    const phoneRegex = /^(0|\+84|84)(3|5|7|8|9)[0-9]{8}$/;

    if (!rawPhone) {
      setPhoneError("Nhập số điện thoại");
      notify("📞 Nhập số điện thoại nhận bánh nhé!");
      valid = false;
    } else if (!phoneRegex.test(cleanPhone)) {
      setPhoneError("SĐT cần đủ 10 số");
      notify("⚠️ Số điện thoại cần đủ 10 số!");
      valid = false;
    } else {
      setPhoneError(null);
    }

    // 3. Kiểm tra địa chỉ nhận bánh / giờ ghé lấy
    const rawAddress = customerAddress.trim();
    if (!rawAddress) {
      setAddressError("Nhập địa chỉ / giờ lấy");
      if (valid) {
        notify("📍 Nhập địa chỉ hoặc giờ ghé lấy nhé!");
      }
      valid = false;
    } else if (rawAddress.length < 3) {
      setAddressError("Địa chỉ quá ngắn");
      if (valid) {
        notify("📍 Ghi rõ địa chỉ hoặc giờ lấy nhé!");
      }
      valid = false;
    } else {
      setAddressError(null);
    }

    if (!valid) {
      setTimeout(() => {
        const invalidInput = document.querySelector<HTMLInputElement>(
          "input[data-invalid='true']"
        );
        invalidInput?.focus();
      }, 50);
    }

    return valid;
  };

  const handleSendOrderVia = async (
    channel: "MESSENGER" | "ZALO" | "DIRECT"
  ) => {
    if (!canCreateOrder) {
      notify("🔒 Chỉ nhân viên (Staff) hoặc Admin được quyền lên đơn!");
      return;
    }

    if (!validateOrder()) {
      return;
    }

    // 1. Copy to clipboard SYNCHRONOUSLY (0ms) inside the user click gesture!
    const generatedCode = `FL-${Math.floor(1000 + Math.random() * 9000)}`;
    const billText = buildOrderMessageText(generatedCode);
    copyToClipboardInstant(billText);
    setCopied(true);
    setTimeout(() => setCopied(false), 3500);

    const zaloPhone = settings?.zaloPhone || settings?.phone || "0703166903";
    const fbUrl =
      settings?.facebookUrl || "https://www.facebook.com/tiem.flandi";

    const zaloWebUrl = "https://chat.zalo.me";
    const messengerWebUrl = fbUrl;

    if (channel === "ZALO" || channel === "MESSENGER") {
      setPreferredChatChannel(channel);
    }

    setSendingChannel(channel);

    try {
      // 2. Save order to backend database (/api/orders)
      const orderPayload = {
        code: generatedCode,
        source: channel === "ZALO" ? "ZALO" : "ONLINE",
        status: "PENDING",
        customerId: user?.id,
        customerEmail: user?.email,
        customerName:
          customerName.trim() ||
          (channel === "MESSENGER"
            ? "Khách đặt qua Messenger"
            : channel === "ZALO"
            ? "Khách đặt qua Zalo"
            : "Khách đặt nhanh"),
        customerPhone: customerPhone.trim(),
        customerAddress: customerAddress.trim(),
        note: `[Đặt nhanh qua ${channel}]`,
        items: cartItems.map((i) => ({
          productId: i.product.id,
          productName: i.product.name,
          variantId: i.variant.id,
          variantName: i.product.unit || "cái",
          quantity: i.quantity,
          unitPrice: i.product.price,
          subtotal: i.product.price * i.quantity,
          stockDeductionPerItem: 1,
        })),
        subtotal,
        discount: 0,
        shippingFee,
        total: grandTotal,
        paymentMethod: "COD",
        isPaid: false,
        _hp_company: honeypot,
      };

      const orderRes = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(orderPayload),
      });

      if (!orderRes.ok) {
        const errData = await orderRes.json().catch(() => ({}));
        if (orderRes.status === 429) {
          notify(`⏱️ ${errData.error || "Thao tác quá nhanh, thử lại sau ít phút!"}`);
          return;
        }
        notify(`⚠️ ${errData.error || "Lỗi tạo đơn, kiểm tra lại thông tin!"}`);
        return;
      }

      // 3. Send the order text directly into the on-page Messenger / Zalo Chat (/api/chat)
      const storedSession =
        typeof window !== "undefined"
          ? localStorage.getItem("flandi_chat_session_id")
          : null;
      const sessionId = storedSession || `chat-${Date.now()}`;
      if (typeof window !== "undefined" && !storedSession) {
        localStorage.setItem("flandi_chat_session_id", sessionId);
      }
      await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          customerName:
            customerName.trim() ||
            (channel === "ZALO" ? "Khách Zalo Web" : "Khách Messenger Web"),
          customerPhone: customerPhone.trim(),
          sender: "CUSTOMER",
          text: billText,
          _hp_website: honeypot,
        }),
      });

      // Giữ bản chụp món trong đơn trước khi xoá giỏ hàng để khách lưu ảnh Hóa Đơn sau chốt đơn
      const snapshotItems: BillImageItem[] = cartItems.map((i) => ({
        name: i.product.name,
        badgeText: i.product.badgeText,
        image: i.product.image,
        unit: i.product.unit || "cái",
        price: i.product.price,
        quantity: i.quantity,
      }));
      const snapshotSubtotal = subtotal;
      const snapshotShippingFee = shippingFee;

      // Xoá giỏ hàng sau khi chốt đơn thành công
      setCartMap({});
      setIsExpanded(false);
      try {
        localStorage.removeItem("flandi_order_cart");
      } catch {}

      setChatRefreshTrigger((n) => n + 1);

      if (channel === "MESSENGER" || channel === "ZALO") {
        setOpenChatTrigger((n) => n + 1);
        notify(
          channel === "ZALO"
            ? `✅ Đã gửi đơn #${generatedCode} qua Chat Zalo!`
            : `✅ Đã gửi đơn #${generatedCode} qua Chat Messenger!`
        );
      } else {
        setSentResultModal({
          channel,
          orderCode: generatedCode,
          orderText: billText,
          items: snapshotItems,
          subtotal: snapshotSubtotal,
          shippingFee: snapshotShippingFee,
          total: grandTotal,
          zaloWebUrl,
          messengerWebUrl,
          zaloPhone,
        });
      }
    } catch (err) {
      console.error(err);
      notify("📋 Đã copy đơn!");
    } finally {
      setSendingChannel(null);
    }
  };

  const renderProductCard = (product: Product, isDesktopMenu = false) => {
    const currentQty = getQtyForProduct(product.id);
    const unitLabel = product.unit || "cái";
    const isSelected = currentQty > 0;
    const isKeypadTarget = keypadProduct?.id === product.id;

    return (
      <div
        key={product.id}
        onClick={() => openKeypad(product)}
        className={`rounded-2xl border transition-all duration-200 overflow-hidden flex items-center justify-between px-3 sm:px-4 lg:px-4.5 xl:px-5 py-1.5 sm:py-2.5 lg:py-2.5 xl:py-3 cursor-pointer select-none gap-2.5 sm:gap-4 shrink-0 ${
          isDesktopMenu
            ? "lg:h-[76px] xl:h-[82px] lg:min-h-[76px] xl:min-h-[82px]"
            : "min-h-[48px] sm:min-h-[58px]"
        } ${
          isKeypadTarget
            ? "bg-white border-flandi-coral shadow-cute ring-2 ring-flandi-coral/60"
            : isSelected
            ? "bg-white border-flandi-coral shadow-cute ring-1.5 ring-flandi-salmon/40 hover:border-flandi-coral"
            : "bg-white/95 border-flandi-pink/70 hover:border-flandi-salmon/70 shadow-2xs hover:bg-white"
        }`}
      >
        {/* Left: Product image (click opens description popup) + Product Name + Price badge */}
        <div className="flex items-center gap-2.5 sm:gap-3.5 min-w-0 flex-1">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setPreviewProduct(product);
            }}
            title={`Xem mô tả ${product.name}`}
            aria-label={`Xem mô tả ${product.name}`}
            className="relative w-10 h-10 sm:w-13 sm:h-13 lg:w-15 lg:h-15 xl:w-16 xl:h-16 rounded-xl lg:rounded-2xl p-0.5 bg-gradient-to-tr from-flandi-coral to-flandi-salmon shrink-0 shadow-2xs cursor-pointer hover:scale-105 active:scale-95 transition-transform focus:outline-none focus:ring-2 focus:ring-flandi-coral/50"
          >
            <img
              src={product.image}
              alt={product.name}
              className="w-full h-full object-cover rounded-[10px] lg:rounded-xl border border-white"
            />
          </button>

          <div className="min-w-0 flex flex-col justify-center">
            <h2 className="font-display text-[15px] sm:text-base lg:text-[17px] text-flandi-dark leading-snug truncate">
              {product.name}
            </h2>
            <div className="flex items-center gap-1.5 sm:gap-2 mt-0.5 flex-wrap">
              <span className="text-[13px] sm:text-sm lg:text-[15px] font-extrabold text-flandi-coral leading-tight tracking-tight tabular-nums">
                {product.badgeText}
              </span>
              {isSelected && (
                <span className="text-xs sm:text-[13px] font-extrabold text-flandi-coral bg-flandi-cream px-2 py-0.5 rounded-md sm:rounded-lg border border-flandi-pink/80 shadow-2xs tabular-nums">
                  = {formatVND(product.price * currentQty)}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Right: Chọn nhanh +5, +10 ngay ngoài Menu (1 chạm) + nút Khác mở bàn phím số */}
        <div
          className="flex items-center gap-1 sm:gap-1.5 lg:gap-2 shrink-0"
          onClick={(e) => e.stopPropagation()}
        >
          {[5, 10].map((presetQty) => (
            <button
              key={presetQty}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setExactQty(product, presetQty);
              }}
              title={`Chọn nhanh ${presetQty} ${unitLabel}`}
              className="h-8 sm:h-9 lg:h-10 px-2 sm:px-3 lg:px-3.5 min-w-[36px] sm:min-w-[44px] lg:min-w-[50px] rounded-xl lg:rounded-2xl border border-flandi-salmon/85 bg-flandi-cream/90 hover:bg-flandi-coral hover:border-flandi-coral text-flandi-coral hover:text-white text-[13px] sm:text-sm lg:text-[15px] font-black tabular-nums shadow-2xs hover:shadow-cute transition-all active:scale-95 flex items-center justify-center cursor-pointer"
            >
              +{presetQty}
            </button>
          ))}

          {/* Ô nhập số lượng trực tiếp (mặc định 0) thay cho ô Khác */}
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            value={currentQty}
            onFocus={(e) => e.target.select()}
            onChange={(e) => {
              const val = e.target.value.replace(/[^0-9]/g, "");
              const num = parseInt(val, 10) || 0;
              setExactQty(product, Math.min(num, 999));
            }}
            onClick={(e) => e.stopPropagation()}
            className={`h-8 sm:h-9 lg:h-10 w-12 sm:w-14 lg:w-16 text-center font-black text-xs sm:text-sm lg:text-[15px] rounded-xl lg:rounded-2xl border-2 transition-all tabular-nums focus:outline-none focus:ring-2 focus:ring-flandi-coral/30 cursor-text ${
              isSelected
                ? "bg-flandi-cream/90 border-flandi-coral text-flandi-coral shadow-2xs"
                : "bg-white border-flandi-pink/90 hover:border-flandi-salmon text-flandi-dark/70"
            }`}
            title="Nhập số lượng trực tiếp (mặc định 0)"
            aria-label={`Số lượng ${product.name}`}
          />
        </div>
      </div>
    );
  };

  const renderBillItemRow = (
    item: QuickLineItem,
    variant: "desktop" | "mobile" = "mobile"
  ) => {
    const isDesktop = variant === "desktop";
    const isSingleQty = item.quantity <= 1;

    return (
      <div
        key={item.product.id}
        className={`${
          isDesktop ? "py-2" : "py-1.5"
        } flex items-center justify-between gap-2.5 sm:gap-3`}
      >
        {/* Left: Thumbnail + Tên món · Đơn giá */}
        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1">
          <button
            type="button"
            onClick={() => setPreviewProduct(item.product)}
            title={`Xem mô tả ${item.product.name}`}
            aria-label={`Xem mô tả ${item.product.name}`}
            className={`relative ${
              isDesktop
                ? "w-10 h-10 xl:w-11 xl:h-11"
                : "w-9 h-9 sm:w-10 sm:h-10"
            } rounded-xl p-0.5 bg-gradient-to-tr from-flandi-coral to-flandi-salmon shrink-0 shadow-2xs hover:scale-105 active:scale-95 transition-transform cursor-pointer`}
          >
            <img
              src={item.product.image}
              alt={item.product.name}
              className="w-full h-full object-cover rounded-[10px] border border-white"
            />
          </button>

          <button
            type="button"
            onClick={() => openKeypad(item.product)}
            title="Chạm để nhập nhanh số lượng"
            className="min-w-0 flex-1 text-left group cursor-pointer"
          >
            <div className="flex items-baseline gap-1.5 min-w-0">
              <span className="font-display text-sm sm:text-[15px] text-flandi-dark group-hover:text-flandi-coral leading-snug truncate transition">
                {item.product.name}
              </span>
              <span className="text-[13.5px] sm:text-sm font-extrabold text-flandi-coral tabular-nums whitespace-nowrap shrink-0">
                {formatVND(item.product.price)}
              </span>
            </div>
          </button>
        </div>

        {/* Right: Cụm [- số lượng +] giữ đúng tông màu cũ + Thành tiền thẳng cột phải */}
        <div className="flex items-center gap-2.5 sm:gap-3 shrink-0">
          <div
            className={`flex items-center ${
              isDesktop
                ? "bg-white border border-flandi-pink rounded-xl p-0.5 shadow-2xs"
                : "bg-flandi-bg rounded-xl border border-flandi-pink/70 p-0.5"
            }`}
          >
            <button
              type="button"
              onClick={() => {
                const next = item.quantity - 1;
                if (next <= 0) {
                  removeFromBill(item.product.id);
                } else {
                  setCartMap((prev) => ({
                    ...prev,
                    [item.product.id]: { ...item, quantity: next },
                  }));
                }
              }}
              className={`${
                isDesktop ? "w-6.5 h-6.5 rounded-lg" : "w-6 h-6 rounded-lg"
              } ${
                isSingleQty
                  ? "text-rose-400 hover:text-rose-600 hover:bg-rose-50"
                  : isDesktop
                  ? "text-slate-500 hover:bg-flandi-cream hover:text-flandi-coral"
                  : "text-slate-500 hover:text-flandi-coral"
              } flex items-center justify-center font-black transition active:scale-95 cursor-pointer`}
              title={isSingleQty ? "Bỏ món khỏi hóa đơn" : "Giảm 1"}
              aria-label={
                isSingleQty
                  ? `Bỏ ${item.product.name} khỏi hóa đơn`
                  : "Giảm 1"
              }
            >
              {isSingleQty ? (
                <Trash2 className={isDesktop ? "w-3.5 h-3.5" : "w-3 h-3"} />
              ) : (
                <Minus className={isDesktop ? "w-3.5 h-3.5" : "w-3 h-3"} />
              )}
            </button>

            <button
              type="button"
              onClick={() => openKeypad(item.product)}
              className="px-1.5 min-w-[28px] sm:min-w-[32px] text-center text-sm sm:text-[15px] font-black text-flandi-coral hover:bg-flandi-cream/80 rounded-md py-0.5 leading-none tabular-nums transition cursor-pointer"
              title="Chạm để nhập số lượng"
            >
              {item.quantity}
            </button>

            <button
              type="button"
              onClick={() => {
                setCartMap((prev) => ({
                  ...prev,
                  [item.product.id]: {
                    ...item,
                    quantity: item.quantity + 1,
                  },
                }));
              }}
              className={`${
                isDesktop ? "w-6.5 h-6.5 rounded-lg" : "w-6 h-6 rounded-lg"
              } hover:bg-flandi-cream flex items-center justify-center text-flandi-coral font-black transition active:scale-95 cursor-pointer`}
              title="Tăng 1"
            >
              <Plus className={isDesktop ? "w-3.5 h-3.5" : "w-3 h-3"} />
            </button>
          </div>

          <span className="text-sm sm:text-[15px] font-black text-flandi-dark min-w-[46px] sm:min-w-[52px] text-right leading-none tabular-nums">
            {formatVND(item.product.price * item.quantity)}
          </span>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-dvh h-dvh flex flex-col bg-[#FFF9F8] bg-grid-pattern relative overflow-hidden">
      {/* Toast Notification */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-flandi-dark text-white px-4 py-3 rounded-2xl shadow-cute-lg flex items-center gap-2.5 max-w-md animate-bounce">
          <Sparkles className="w-4 h-4 text-flandi-salmon shrink-0" />
          <span className="text-[13px] sm:text-sm font-extrabold leading-snug">{toast}</span>
        </div>
      )}

      {/* Header with comfortable breathing room */}
      <header className="bg-white/95 backdrop-blur-md border-b border-flandi-pink/80 px-3.5 sm:px-6 py-2.5 sm:py-3.5 flex items-center justify-between gap-2 shrink-0 z-20 shadow-xs">
        <Link
          href="/"
          className="flex items-center gap-2.5 sm:gap-3 group transition min-w-0"
          title="Về trang chủ FLANDI"
        >
          <img
            src={
              settings?.pageConfig?.headerLogoUrl ||
              settings?.brandKit?.mascotImage ||
              "/images/branding/flandi-mascot.png"
            }
            alt="FLANDI"
            className="w-9 h-9 sm:w-10 sm:h-10 rounded-full object-cover border-2 border-flandi-salmon shadow-xs shrink-0 group-hover:scale-105 transition-transform"
          />
          <div className="min-w-0">
            <h1 className="font-display text-[15px] sm:text-lg lg:text-xl text-sticker-sm leading-snug whitespace-nowrap group-hover:text-flandi-coral transition-colors">
              ĐẶT BÁNH NHANH
            </h1>
            <p className="text-[11px] sm:text-xs font-bold text-flandi-muted leading-tight truncate">
              {settings?.tagline || "Muốn ăn hãy Flăn vào tớ"}
            </p>
          </div>
        </Link>

        <div className="flex items-center gap-2 text-xs sm:text-[13px] shrink-0">
          {(role === "staff" || role === "admin") && (
            <>
              <Link
                href="/staff"
                className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-flandi-cream hover:bg-flandi-pink/60 text-flandi-coral font-extrabold border border-flandi-pink shadow-2xs transition active:scale-95"
                title="Màn hình lên đơn & quản lý đơn cho Staff"
              >
                <span>Màn hình Staff</span>
              </Link>
              <Link
                href="/ship"
                className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-sky-50 hover:bg-sky-100 text-sky-700 font-extrabold border border-sky-300 shadow-2xs transition active:scale-95"
                title="Khu vực điều phối & giao hàng"
              >
                <Bike className="w-3.5 h-3.5" />
                <span>Giao Hàng</span>
              </Link>
            </>
          )}
          <CustomerHeaderAuthButton />
          <span className="hidden md:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-flandi-cream text-flandi-coral font-extrabold border border-flandi-pink/80 shadow-2xs">
            <Sparkles className="w-3.5 h-3.5" />
            {freeShipMin === 0 || defaultShipFee === 0
              ? "Freeship tất cả đơn"
              : `Freeship từ ${formatVND(freeShipMin)}`}
          </span>
          <button
            type="button"
            onClick={() => setIsContactModalOpen(true)}
            className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-white hover:bg-flandi-pink/40 text-flandi-coral border border-flandi-pink flex items-center justify-center shadow-2xs transition active:scale-95 cursor-pointer shrink-0"
            title="Liên hệ tiệm"
            aria-label="Liên hệ tiệm"
          >
            <Phone className="w-4 h-4 text-flandi-coral" />
          </button>
        </div>
      </header>

      {/* Main Product Cards Workspace (Strictly 1 screen without scrolling) */}
      <main className="flex-1 min-h-0 max-w-2xl lg:max-w-6xl w-full mx-auto px-3 sm:px-6 lg:px-8 py-2 sm:py-3 flex flex-col overflow-hidden">
        {loading ? (
          <div className="flex-1 flex flex-col gap-2 min-h-0">
            {[1, 2, 3, 4, 5, 6, 7].map((n) => (
              <div
                key={n}
                className="h-16 rounded-2xl bg-white/70 border border-flandi-pink animate-pulse"
              />
            ))}
          </div>
        ) : (
          <>
            {/* DESKTOP 2-COLUMN LAYOUT (lg: screens) — 2 Sections: Thực Đơn (Menu) & Hóa Đơn (Bill) */}
            <div className="hidden lg:grid lg:grid-cols-12 gap-6 h-full min-h-0 overflow-hidden">
              {/* CỘT TRÁI: THỰC ĐƠN (MENU - chỉ hiển thị món chưa chọn) */}
              <div className="lg:col-span-7 flex flex-col min-h-0">
                <div className="flex items-center justify-between px-1 pb-2 shrink-0">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-flandi-salmon" />
                    <h2 className="font-display text-base text-flandi-muted uppercase tracking-wider">
                      Thực Đơn ({unselectedProducts.length})
                    </h2>
                  </div>
                </div>

                {unselectedProducts.length === 0 ? (
                  <div className="flex-1 flex flex-col items-center justify-center text-center p-8 rounded-3xl border-2 border-dashed border-emerald-300 bg-emerald-50/60 space-y-2">
                    <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center shadow-2xs">
                      <CheckCircle2 className="w-6 h-6" />
                    </div>
                    <p className="text-base font-extrabold text-emerald-900">
                      🎉 Đã chọn hết món!
                    </p>
                    <p className="text-[13px] font-bold text-emerald-700/80">
                      Chỉnh số lượng ở Hóa Đơn bên phải.
                    </p>
                  </div>
                ) : (
                  <div className="flex-1 flex flex-col gap-2 xl:gap-2.5 min-h-0 overflow-y-auto no-scrollbar pr-1 py-0.5">
                    {unselectedProducts.map((p) => renderProductCard(p, true))}
                  </div>
                )}
              </div>

              {/* CỘT PHẢI: HÓA ĐƠN (BILL) & THÔNG TIN CHỐT ĐƠN (5 cột) */}
              <div className="lg:col-span-5 flex flex-col min-h-0 bg-white/95 backdrop-blur-md rounded-3xl border-2 border-flandi-salmon shadow-cute-lg p-5 overflow-hidden">
                {/* Header Hóa Đơn */}
                <div className="flex items-center justify-between border-b border-flandi-pink pb-2.5 shrink-0">
                  <div className="flex items-center gap-2.5">
                    <div className="w-10 h-10 rounded-2xl bg-flandi-coral text-white flex items-center justify-center shrink-0 shadow-2xs">
                      <Receipt className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-display text-[17px] lg:text-lg text-flandi-dark leading-tight">
                        Hóa Đơn
                      </h3>
                      <p className="text-xs font-bold text-flandi-muted">
                        {cartItems.length > 0
                          ? `${cartItems.length} món`
                          : "Trống"}
                      </p>
                    </div>
                  </div>

                  {cartItems.length > 0 && (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={isSavingBillImage}
                        onClick={() => handleOpenShareBill()}
                        className="px-2.5 py-1.5 rounded-xl bg-flandi-cream hover:bg-flandi-pink/60 text-flandi-coral border border-flandi-pink text-xs font-extrabold flex items-center gap-1 shadow-2xs transition active:scale-95 disabled:opacity-50 cursor-pointer"
                        title="Share ảnh Hóa Đơn"
                      >
                        <Share2 className="w-3.5 h-3.5" />
                        <span>
                          {isSavingBillImage ? "..." : "Share"}
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setCartMap({})}
                        className="text-xs font-extrabold text-red-500 hover:text-red-600 hover:underline flex items-center gap-1 transition cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Xoá hết</span>
                      </button>
                    </div>
                  )}
                </div>

                {/* Danh Sách Món Trong Hóa Đơn */}
                <div className="flex-1 overflow-y-auto py-2 space-y-2 min-h-0">
                  {cartItems.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center p-4 rounded-2xl border-2 border-dashed border-flandi-pink/70 bg-flandi-bg/50 space-y-1.5">
                      <div className="w-12 h-12 rounded-full bg-flandi-salmon/20 text-flandi-coral flex items-center justify-center">
                        <Receipt className="w-6 h-6" />
                      </div>
                      <p className="text-[15px] font-extrabold text-flandi-dark">
                        Chưa chọn món
                      </p>
                      <p className="text-[13px] font-bold text-flandi-muted">
                        Chạm món bên trái để thêm 🍮
                      </p>
                    </div>
                  ) : (
                    <div className="divide-y divide-flandi-pink/30">
                      {cartItems.map((item) =>
                        renderBillItemRow(item, "desktop")
                      )}
                    </div>
                  )}
                </div>

                {/* Phần Tổng Tiền & Form Chốt Đơn */}
                <div className="border-t-2 border-dashed border-flandi-pink/80 pt-2.5 space-y-2.5 shrink-0">
                  {/* Chi tiết tiền */}
                  <div className="space-y-1 text-[13px] sm:text-sm font-bold text-flandi-muted tabular-nums">
                    <div className="flex items-center justify-between">
                      <span>Tạm tính</span>
                      <span className="font-extrabold text-flandi-dark">{formatVND(subtotal)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Phí ship</span>
                      <span className={shippingFee === 0 ? "font-black text-emerald-700" : "font-extrabold text-flandi-dark"}>
                        {shippingFee === 0 ? "FREESHIP" : formatVND(shippingFee)}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-baseline justify-between pt-1.5 border-t border-dashed border-flandi-pink">
                    <span className="text-[13px] sm:text-sm font-black text-flandi-dark uppercase tracking-wider">
                      THÀNH TIỀN
                    </span>
                    <span className="text-2xl sm:text-[26px] font-black text-flandi-coral tracking-tight leading-none tabular-nums">
                      {formatVND(grandTotal)}
                    </span>
                  </div>

                  {canCreateOrder ? (
                    <>
                      {/* Form Nhập Thông Tin Khách (Chỉ dành cho tài khoản có quyền lên đơn) */}
                      <div className="space-y-2">
                        <input
                          type="text"
                          name="_hp_company"
                          value={honeypot}
                          onChange={(e) => setHoneypot(e.target.value)}
                          tabIndex={-1}
                          autoComplete="off"
                          className="hidden"
                          aria-hidden="true"
                        />

                        {user && (
                          <div className="flex items-center justify-between px-3 py-1.5 bg-emerald-50 border border-emerald-200/80 rounded-xl text-xs text-emerald-800">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0"></span>
                              <strong className="truncate">{user.name}</strong>
                              <span
                                className={`text-[10px] font-black px-1.5 py-0.5 rounded-full border shrink-0 ${ROLE_META[role].badgeClass}`}
                              >
                                {ROLE_META[role].shortLabel}
                              </span>
                            </div>
                            <Link
                              href="/pos"
                              className="text-emerald-700 underline hover:text-emerald-900 font-bold shrink-0 ml-1.5 text-xs"
                            >
                              Mở POS
                            </Link>
                          </div>
                        )}

                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <input
                              type="text"
                              value={customerName}
                              onChange={(e) => setCustomerName(e.target.value)}
                              placeholder="Tên khách"
                              autoComplete="name"
                              spellCheck={false}
                              suppressHydrationWarning
                              className="w-full px-3 py-2 rounded-xl border border-flandi-pink text-[13px] sm:text-sm font-bold placeholder:text-[13px] sm:placeholder:text-sm focus:border-flandi-coral focus:outline-none bg-white transition shadow-2xs"
                            />
                          </div>
                          <div>
                            <input
                              type="tel"
                              value={customerPhone}
                              onChange={(e) => {
                                setCustomerPhone(e.target.value);
                                if (phoneError) setPhoneError(null);
                              }}
                              placeholder="Số điện thoại *"
                              autoComplete="tel"
                              spellCheck={false}
                              suppressHydrationWarning
                              data-invalid={phoneError ? "true" : undefined}
                              className={`w-full px-3 py-2 rounded-xl border text-[13px] sm:text-sm font-bold placeholder:text-[13px] sm:placeholder:text-sm focus:outline-none bg-white transition shadow-2xs ${
                                phoneError
                                  ? "border-red-500 ring-2 ring-red-200 bg-red-50/20 text-red-900"
                                  : "border-flandi-pink focus:border-flandi-coral"
                              }`}
                            />
                            {phoneError && (
                              <span className="text-[11px] font-bold text-red-500 flex items-center gap-1 mt-0.5 animate-in fade-in">
                                <AlertCircle className="w-3 h-3 shrink-0" />
                                <span>{phoneError}</span>
                              </span>
                            )}
                          </div>
                        </div>
                        <div>
                          <input
                            type="text"
                            value={customerAddress}
                            onChange={(e) => {
                              setCustomerAddress(e.target.value);
                              if (addressError) setAddressError(null);
                            }}
                            placeholder="Địa chỉ / giờ ghé lấy *"
                            autoComplete="street-address"
                            spellCheck={false}
                            suppressHydrationWarning
                            data-invalid={addressError ? "true" : undefined}
                            className={`w-full px-3 py-2 rounded-xl border text-[13px] sm:text-sm font-bold placeholder:text-[13px] sm:placeholder:text-sm focus:outline-none bg-white transition shadow-2xs ${
                              addressError
                                ? "border-red-500 ring-2 ring-red-200 bg-red-50/20 text-red-900"
                                : "border-flandi-pink focus:border-flandi-coral"
                            }`}
                          />
                          {addressError && (
                            <span className="text-[11px] font-bold text-red-500 flex items-center gap-1 mt-0.5 animate-in fade-in">
                              <AlertCircle className="w-3 h-3 shrink-0" />
                              <span>{addressError}</span>
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Các Nút Gửi Đơn */}
                      <div className="space-y-2 pt-0.5">
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            disabled={cartItems.length === 0 || sendingChannel !== null}
                            onClick={() => handleSendOrderVia("MESSENGER")}
                            className="py-2.5 px-3 rounded-xl bg-gradient-to-r from-[#006AFF] to-[#0084FF] hover:opacity-95 text-white font-extrabold text-[13px] sm:text-sm shadow-sm flex items-center justify-center gap-1.5 transition active:scale-95 disabled:opacity-40"
                          >
                            <MessageCircle className="w-4 h-4" />
                            <span>{sendingChannel === "MESSENGER" ? "Đang gửi..." : "Gửi Messenger"}</span>
                          </button>
                          <button
                            type="button"
                            disabled={cartItems.length === 0 || sendingChannel !== null}
                            onClick={() => handleSendOrderVia("ZALO")}
                            className="py-2.5 px-3 rounded-xl bg-[#0068FF] hover:bg-[#0052CC] text-white font-extrabold text-[13px] sm:text-sm shadow-sm flex items-center justify-center gap-1.5 transition active:scale-95 disabled:opacity-40"
                          >
                            <Phone className="w-4 h-4" />
                            <span>{sendingChannel === "ZALO" ? "Đang gửi..." : "Gửi Zalo"}</span>
                          </button>
                        </div>
                        <button
                          type="button"
                          disabled={cartItems.length === 0 || sendingChannel !== null}
                          onClick={() => handleSendOrderVia("DIRECT")}
                          className="w-full py-2.5 px-3 rounded-xl bg-flandi-coral hover:bg-flandi-salmon text-white font-extrabold text-sm shadow-cute flex items-center justify-center gap-1.5 transition active:scale-95 disabled:opacity-40"
                        >
                          <Zap className="w-4 h-4" />
                          <span>Chốt Đơn & Mã QR</span>
                        </button>
                      </div>
                    </>
                  ) : (
                    <div className="rounded-2xl border border-flandi-pink bg-flandi-cream/65 px-3.5 py-3 text-center space-y-2">
                      <div className="inline-flex items-center gap-1.5 text-flandi-coral font-extrabold text-[13px]">
                        <Lock className="w-3.5 h-3.5 shrink-0" />
                        <span>Chỉ Staff được quyền lên đơn</span>
                      </div>
                      <p className="text-xs font-semibold text-flandi-dark/75 leading-relaxed">
                        {role === "guest"
                          ? "Bạn vẫn chọn món, xem tiền & bấm Share gửi bill. Nhân viên đăng nhập để chốt đơn."
                          : `Tài khoản ${user?.email || ""} hiện là User. Bấm Share để gửi ảnh bill hoặc liên hệ Admin cấp quyền Staff.`}
                      </p>
                      {role === "guest" && (
                        <button
                          type="button"
                          onClick={triggerGoogleSignIn}
                          className="w-full py-2 px-3 rounded-xl bg-white hover:bg-flandi-cream border border-flandi-salmon text-flandi-coral font-extrabold text-xs shadow-2xs transition active:scale-95 cursor-pointer"
                        >
                          Đăng nhập Staff / Admin
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* MOBILE LAYOUT (< lg screens): Thực Đơn ở trên, toàn bộ Hóa Đơn gộp gọn vào ô THÀNH TIỀN ở dưới */}
            <div className="lg:hidden flex-1 flex flex-col min-h-0 overflow-y-auto no-scrollbar py-0.5">
              {/* THỰC ĐƠN (MENU - các món chưa chọn) */}
              <section className="flex flex-col shrink-0">
                <div className="flex items-center justify-between px-1 pb-1.5">
                  <div className="flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-flandi-salmon" />
                    <h2 className="font-display text-[13px] sm:text-sm text-flandi-muted uppercase tracking-wider">
                      Thực Đơn ({unselectedProducts.length})
                    </h2>
                  </div>
                </div>

                {unselectedProducts.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-emerald-300 bg-emerald-50/70 px-3 py-3 text-center">
                    <p className="text-[13px] sm:text-sm font-extrabold text-emerald-800">
                      🎉 Đã chọn hết món!
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-1.5">
                    {unselectedProducts.map((p) => renderProductCard(p, false))}
                  </div>
                )}
              </section>
            </div>
          </>
        )}
      </main>

      {/* Ô THÀNH TIỀN trên Mobile (< lg): Gộp toàn bộ nội dung Hóa Đơn vào chung 1 ô duy nhất */}
      <div className="lg:hidden">
        <footer className="shrink-0 z-20 px-3 sm:px-6 pb-2 sm:pb-3 pt-1 pointer-events-auto">
          <div className="max-w-2xl mx-auto w-full bg-white/95 backdrop-blur-md rounded-2xl sm:rounded-3xl border-2 border-flandi-salmon shadow-cute-lg overflow-hidden">
            {cartItems.length > 0 && (
              <>
                {/* Thanh tiêu đề món đã chọn + Share + Xoá hết */}
                <div className="bg-flandi-bg/80 px-3.5 sm:px-5 py-2 border-b border-flandi-pink/60 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <Receipt className="w-4 h-4 text-flandi-coral shrink-0" />
                    <span className="font-display text-[13px] sm:text-sm text-flandi-dark truncate">
                      Đã chọn ({cartItems.length})
                    </span>
                  </div>
                  <div className="flex items-center gap-2.5 shrink-0">
                    <button
                      type="button"
                      disabled={isSavingBillImage}
                      onClick={() => handleOpenShareBill()}
                      className="px-2.5 py-1 rounded-lg bg-flandi-cream hover:bg-flandi-pink/60 text-flandi-coral border border-flandi-pink text-xs font-extrabold flex items-center gap-1 shadow-2xs transition active:scale-95 disabled:opacity-50 cursor-pointer"
                    >
                      <Share2 className="w-3.5 h-3.5" />
                      <span>
                        {isSavingBillImage ? "..." : "Share"}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setCartMap({})}
                      className="text-xs font-extrabold text-red-500 hover:text-red-600 flex items-center gap-1 transition cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Xoá hết</span>
                    </button>
                  </div>
                </div>

                {/* Danh sách món đã chọn */}
                <div className="divide-y divide-flandi-pink/25 px-3.5 sm:px-5 max-h-[24vh] sm:max-h-[28vh] overflow-y-auto no-scrollbar">
                  {cartItems.map((item) =>
                    renderBillItemRow(item, "mobile")
                  )}
                </div>

                {/* Đường rãnh xé hóa đơn */}
                <div className="px-3.5 sm:px-5">
                  <div className="border-t border-dashed border-flandi-pink/70" />
                </div>

                {/* Chi tiết Tạm tính & Phí giao hàng */}
                <div className="px-3.5 sm:px-5 pt-2 pb-1 space-y-0.5 bg-flandi-bg/35 tabular-nums">
                  <div className="flex items-center justify-between text-[13px] sm:text-sm font-bold text-flandi-muted">
                    <span>Tạm tính</span>
                    <span className="font-extrabold text-flandi-dark">
                      {formatVND(subtotal)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[13px] sm:text-sm font-bold text-flandi-muted">
                    <span>Phí ship</span>
                    <span
                      className={
                        shippingFee === 0
                          ? "font-black text-emerald-700"
                          : "font-extrabold text-flandi-dark"
                      }
                    >
                      {shippingFee === 0 ? "FREESHIP" : formatVND(shippingFee)}
                    </span>
                  </div>
                </div>
              </>
            )}

            {/* Dòng THÀNH TIỀN & Nút Gửi đơn */}
            <div
              onClick={() => setIsExpanded(true)}
              className={`px-3.5 py-2.5 sm:px-5 sm:py-3 flex items-center justify-between gap-3 cursor-pointer hover:bg-flandi-cream/30 transition select-none ${
                cartItems.length > 0
                  ? "bg-flandi-bg/35 border-t border-flandi-pink/50"
                  : ""
              }`}
            >
              <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                {cartItems.length === 0 && (
                  <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-flandi-coral text-white flex items-center justify-center shrink-0 shadow-2xs">
                    <ShoppingBag className="w-5 h-5" />
                  </div>
                )}
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[13px] sm:text-sm font-black text-flandi-dark uppercase tracking-wider">
                      THÀNH TIỀN
                    </span>
                    {cartItems.length === 0 ? (
                      <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 text-[11px] sm:text-xs font-extrabold shadow-2xs">
                        {freeShipMin === 0 || defaultShipFee === 0
                          ? "FREESHIP"
                          : `+${formatVND(defaultShipFee)} ship`}
                      </span>
                    ) : shippingFee === 0 ? (
                      <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 text-[11px] sm:text-xs font-extrabold shadow-2xs">
                        FREESHIP
                      </span>
                    ) : null}
                  </div>
                  <div className="text-2xl sm:text-[26px] font-black text-flandi-coral tracking-tight leading-tight tabular-nums">
                    {formatVND(grandTotal)}
                  </div>
                </div>
              </div>

              {canCreateOrder ? (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsExpanded(true);
                  }}
                  className={`px-4 sm:px-5 py-2.5 sm:py-3 rounded-xl sm:rounded-2xl font-extrabold text-[13px] sm:text-sm flex items-center gap-1.5 shadow-cute transition active:scale-95 shrink-0 cursor-pointer ${
                    cartItems.length > 0
                      ? "bg-flandi-coral hover:bg-flandi-salmon text-white"
                      : "bg-flandi-bg hover:bg-flandi-pink/50 text-flandi-dark border border-flandi-pink"
                  }`}
                >
                  <span>Gửi đơn</span>
                  <ChevronUp className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsExpanded(true);
                  }}
                  className="px-3.5 py-2.5 rounded-xl font-extrabold text-xs sm:text-[13px] flex items-center gap-1.5 bg-flandi-cream/80 hover:bg-flandi-cream text-flandi-coral border border-flandi-salmon/80 shadow-2xs transition active:scale-95 shrink-0 cursor-pointer"
                  title="Chỉ nhân viên (Staff) được quyền lên đơn"
                >
                  <Lock className="w-3.5 h-3.5 shrink-0" />
                  <span>Chỉ Staff</span>
                </button>
              )}
            </div>
          </div>
        </footer>

        {/* EXPANDED BOTTOM SHEET (NHẬP THÔNG TIN GIAO BÁNH & CHỐT ĐƠN) */}
        {isExpanded && (
          <div className="fixed inset-0 z-50 flex flex-col justify-end">
            {/* Backdrop overlay */}
            <div
              className="absolute inset-0 bg-black/60 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
              onClick={() => setIsExpanded(false)}
            />

            {/* Bottom Sheet Container */}
            <div
              className="relative w-full max-w-lg mx-auto bg-white rounded-t-[28px] border-t-2 border-x-2 border-flandi-salmon shadow-2xl flex flex-col max-h-[92vh] overflow-hidden animate-in slide-in-from-bottom duration-200"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Drag Handle Bar */}
              <div
                className="pt-2 pb-0.5 flex justify-center cursor-pointer shrink-0"
                onClick={() => setIsExpanded(false)}
              >
                <div className="w-10 h-1 rounded-full bg-slate-300 hover:bg-flandi-coral/50 transition" />
              </div>

              {/* Sheet Header */}
              <div className="px-4 py-2.5 flex items-center justify-between border-b border-flandi-pink/60 shrink-0">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-flandi-coral/15 text-flandi-coral flex items-center justify-center shadow-2xs">
                    <ShoppingBag className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-display text-base text-flandi-dark leading-tight">
                      Thông Tin Nhận Bánh
                    </h3>
                    <p className="text-xs font-bold text-flandi-muted">
                      {cartItems.length > 0
                        ? `${cartItems.length} món • ${
                            shippingFee === 0
                              ? "FREESHIP"
                              : `Ship ${formatVND(shippingFee)}`
                          }`
                        : "Chưa chọn món"}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {cartItems.length > 0 && (
                    <button
                      type="button"
                      disabled={isSavingBillImage}
                      onClick={() => handleOpenShareBill()}
                      className="px-2.5 py-1.5 rounded-xl bg-flandi-cream hover:bg-flandi-pink/60 text-flandi-coral border border-flandi-pink text-xs font-extrabold flex items-center gap-1 shadow-2xs transition active:scale-95 disabled:opacity-50 cursor-pointer"
                    >
                      <Share2 className="w-3.5 h-3.5" />
                      <span>
                        {isSavingBillImage ? "..." : "Share"}
                      </span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setIsExpanded(false)}
                    className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center transition active:scale-95"
                    title="Đóng"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Sheet Scrollable Body */}
              <div className="p-3.5 sm:p-4 space-y-3 overflow-y-auto no-scrollbar">
                {/* Tóm tắt gọn Thành Tiền */}
                {cartItems.length > 0 && (
                  <div className="bg-flandi-bg/70 rounded-2xl border border-flandi-pink/80 px-4 py-2.5 flex items-center justify-between gap-2">
                    <span className="text-[13px] sm:text-sm font-black text-flandi-dark uppercase tracking-wider">
                      THÀNH TIỀN
                    </span>
                    <span className="text-2xl font-black text-flandi-coral leading-none tabular-nums">
                      {formatVND(grandTotal)}
                    </span>
                  </div>
                )}

                {canCreateOrder ? (
                  <>
                    {/* 3. Form Thông Tin Nhận Bánh */}
                    <div className="space-y-2">
                      <input
                        type="text"
                        name="_hp_company"
                        value={honeypot}
                        onChange={(e) => setHoneypot(e.target.value)}
                        tabIndex={-1}
                        autoComplete="off"
                        className="hidden"
                        aria-hidden="true"
                      />

                      {user && (
                        <div className="flex items-center justify-between px-3 py-1.5 bg-emerald-50 border border-emerald-200/80 rounded-xl text-xs text-emerald-800">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0"></span>
                            <strong className="truncate">{user.name}</strong>
                            <span
                              className={`text-[10px] font-black px-1.5 py-0.5 rounded-full border shrink-0 ${ROLE_META[role].badgeClass}`}
                            >
                              {ROLE_META[role].shortLabel}
                            </span>
                          </div>
                          <Link
                            href="/pos"
                            className="text-emerald-700 underline hover:text-emerald-900 font-bold shrink-0 ml-1.5 text-xs"
                          >
                            Mở POS
                          </Link>
                        </div>
                      )}

                      <div className="grid grid-cols-12 gap-2">
                        {/* Số điện thoại (Bắt buộc) - 7 cột */}
                        <div className="col-span-7">
                          <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-flandi-coral">
                              <Phone className="w-4 h-4" />
                            </div>
                            <input
                              type="tel"
                              value={customerPhone}
                              onChange={(e) => {
                                setCustomerPhone(e.target.value);
                                if (phoneError) setPhoneError(null);
                              }}
                              placeholder="Số điện thoại *"
                              autoComplete="tel"
                              suppressHydrationWarning
                              data-invalid={phoneError ? "true" : undefined}
                              className={`w-full pl-9 pr-3 py-2.5 rounded-xl border text-[13px] sm:text-sm font-bold placeholder:text-[13px] sm:placeholder:text-sm placeholder:text-slate-400 focus:outline-none bg-white shadow-2xs transition ${
                                phoneError
                                  ? "border-red-500 ring-2 ring-red-200 bg-red-50/20 text-red-900"
                                  : "border-flandi-pink focus:border-flandi-coral focus:ring-1 focus:ring-flandi-coral/30"
                              }`}
                            />
                          </div>
                          {phoneError && (
                            <span className="text-[11px] font-bold text-red-500 flex items-center gap-1 mt-0.5 px-1 animate-in fade-in">
                              <AlertCircle className="w-3 h-3 shrink-0" />
                              <span>{phoneError}</span>
                            </span>
                          )}
                        </div>

                        {/* Tên khách (Tuỳ chọn) - 5 cột */}
                        <div className="col-span-5 relative">
                          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-flandi-muted">
                            <User className="w-4 h-4" />
                          </div>
                          <input
                            type="text"
                            value={customerName}
                            onChange={(e) => setCustomerName(e.target.value)}
                            placeholder="Tên khách"
                            autoComplete="name"
                            suppressHydrationWarning
                            className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-flandi-pink text-[13px] sm:text-sm font-bold placeholder:text-[13px] sm:placeholder:text-sm placeholder:text-slate-400 focus:border-flandi-coral focus:ring-1 focus:ring-flandi-coral/30 focus:outline-none bg-white shadow-2xs"
                          />
                        </div>
                      </div>

                      {/* Địa chỉ giao hàng - Full width */}
                      <div>
                        <div className="relative">
                          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-flandi-coral">
                            <MapPin className="w-4 h-4" />
                          </div>
                          <input
                            type="text"
                            value={customerAddress}
                            onChange={(e) => {
                              setCustomerAddress(e.target.value);
                              if (addressError) setAddressError(null);
                            }}
                            placeholder="Địa chỉ / giờ ghé lấy *"
                            autoComplete="street-address"
                            suppressHydrationWarning
                            data-invalid={addressError ? "true" : undefined}
                            className={`w-full pl-9 pr-3 py-2.5 rounded-xl border text-[13px] sm:text-sm font-bold placeholder:text-[13px] sm:placeholder:text-sm placeholder:text-slate-400 focus:outline-none bg-white shadow-2xs transition ${
                              addressError
                                ? "border-red-500 ring-2 ring-red-200 bg-red-50/20 text-red-900"
                                : "border-flandi-pink focus:border-flandi-coral focus:ring-1 focus:ring-flandi-coral/30"
                            }`}
                          />
                        </div>
                        {addressError && (
                          <span className="text-[11px] font-bold text-red-500 flex items-center gap-1 mt-0.5 px-1 animate-in fade-in">
                            <AlertCircle className="w-3 h-3 shrink-0" />
                            <span>{addressError}</span>
                          </span>
                        )}
                      </div>
                    </div>

                    {/* 4. Các Nút Gửi Đơn (Zalo, Messenger, QR) */}
                    <div className="space-y-2 pt-0.5 pb-2">
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          disabled={cartItems.length === 0 || sendingChannel !== null}
                          onClick={() => handleSendOrderVia("ZALO")}
                          className="py-2.5 sm:py-3 px-3 rounded-2xl bg-[#0068FF] hover:bg-[#0056D6] text-white font-extrabold text-[13px] sm:text-sm shadow-md flex items-center justify-center gap-1.5 transition active:scale-95 disabled:opacity-40"
                        >
                          <Send className="w-4 h-4 shrink-0" />
                          <span>{sendingChannel === "ZALO" ? "Đang gửi..." : "Gửi Zalo"}</span>
                        </button>

                        <button
                          type="button"
                          disabled={cartItems.length === 0 || sendingChannel !== null}
                          onClick={() => handleSendOrderVia("MESSENGER")}
                          className="py-2.5 sm:py-3 px-3 rounded-2xl bg-gradient-to-r from-[#00B2FF] to-[#006AFF] hover:opacity-95 text-white font-extrabold text-[13px] sm:text-sm shadow-md flex items-center justify-center gap-1.5 transition active:scale-95 disabled:opacity-40"
                        >
                          <MessageCircle className="w-4 h-4 shrink-0" />
                          <span>{sendingChannel === "MESSENGER" ? "Đang gửi..." : "Gửi Messenger"}</span>
                        </button>
                      </div>

                      <button
                        type="button"
                        disabled={cartItems.length === 0 || sendingChannel !== null}
                        onClick={() => handleSendOrderVia("DIRECT")}
                        className="w-full py-3 px-3 rounded-2xl bg-gradient-to-r from-flandi-coral to-flandi-salmon hover:opacity-95 text-white font-extrabold text-sm shadow-cute flex items-center justify-center gap-1.5 transition active:scale-95 disabled:opacity-40"
                      >
                        <QrCode className="w-4 h-4 shrink-0" />
                        <span>Chốt Đơn & Mã QR</span>
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="rounded-2xl border border-flandi-pink bg-flandi-cream/65 p-4 text-center space-y-2.5 mb-2">
                    <div className="inline-flex items-center gap-1.5 text-flandi-coral font-extrabold text-sm">
                      <Lock className="w-4 h-4 shrink-0" />
                      <span>Chỉ nhân viên (Staff) được quyền lên đơn</span>
                    </div>
                    <p className="text-xs font-semibold text-flandi-dark/75 leading-relaxed">
                      {role === "guest"
                        ? "Khách vẫn xem menu, tính tiền & bấm Share để gửi ảnh bill. Nhân viên vui lòng đăng nhập để chốt đơn."
                        : `Tài khoản ${user?.email || ""} hiện đang ở nhóm User. Nhờ Admin cấp quyền Staff để lên đơn trực tiếp.`}
                    </p>
                    <div className="flex items-center gap-2 pt-0.5">
                      {cartItems.length > 0 && (
                        <button
                          type="button"
                          disabled={isSavingBillImage}
                          onClick={() => handleOpenShareBill()}
                          className="flex-1 py-2.5 px-3 rounded-xl bg-white hover:bg-flandi-cream border border-flandi-salmon text-flandi-coral font-extrabold text-xs flex items-center justify-center gap-1.5 shadow-2xs disabled:opacity-50 cursor-pointer"
                        >
                          <Share2 className="w-3.5 h-3.5" />
                          <span>Share ảnh bill</span>
                        </button>
                      )}
                      {role === "guest" && (
                        <button
                          type="button"
                          onClick={() => {
                            setIsExpanded(false);
                            triggerGoogleSignIn();
                          }}
                          className="flex-1 py-2.5 px-3 rounded-xl bg-flandi-coral hover:bg-flandi-salmon text-white font-extrabold text-xs shadow-cute cursor-pointer"
                        >
                          Đăng nhập Staff
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Embedded On-Page Messenger & Zalo Chat Widget */}
      <LiveChatWidget
        settings={settings}
        cartCount={cartItems.length}
        externalOpenTrigger={openChatTrigger}
        preferredChannel={preferredChatChannel}
        refreshTrigger={chatRefreshTrigger}
        cartSummaryText={liveOrderPreviewText || undefined}
        hideFloatingButton={isExpanded}
        hideFloatingOnMobile
      />

      {/* Custom Virtual Numeric Keypad Modal (Bàn phím ảo nhập số lượng) */}
      {keypadProduct && (
        <div
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200"
          onClick={cancelKeypad}
        >
          <div
            className="w-full max-w-sm sm:max-w-md bg-white rounded-t-3xl sm:rounded-3xl shadow-cute-lg border-2 border-flandi-salmon overflow-hidden animate-in slide-in-from-bottom-8 sm:zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Keypad Header */}
            <div className="bg-gradient-to-r from-flandi-cream via-[#FFF3EE] to-flandi-cream px-4 py-3 border-b border-flandi-pink/80 flex items-center justify-between">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-11 h-11 rounded-xl p-0.5 bg-gradient-to-tr from-flandi-coral to-flandi-salmon shrink-0 shadow-2xs">
                  <img
                    src={keypadProduct.image}
                    alt={keypadProduct.name}
                    className="w-full h-full object-cover rounded-[10px] border border-white"
                  />
                </div>
                <div className="min-w-0">
                  <h3 className="font-display text-base sm:text-lg text-flandi-dark truncate">
                    {keypadProduct.name}
                  </h3>
                  <p className="text-[13px] sm:text-sm font-extrabold text-flandi-coral tabular-nums">
                    {keypadProduct.badgeText}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={cancelKeypad}
                className="w-8 h-8 rounded-full bg-white/80 hover:bg-white text-flandi-muted hover:text-flandi-dark flex items-center justify-center border border-flandi-pink shadow-2xs transition active:scale-90 cursor-pointer"
                title="Đóng"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Live Quantity Display & Subtotal */}
            <div className="px-5 py-2.5 sm:py-3 bg-white border-b border-flandi-pink/40 flex items-center justify-between">
              <div>
                <span className="text-[11px] font-extrabold text-flandi-muted uppercase tracking-wider block">
                  Số lượng
                </span>
                <div className="flex items-baseline gap-1.5 mt-0.5">
                  <span className="text-3xl sm:text-4xl font-black text-flandi-coral tracking-tight tabular-nums leading-none">
                    {keypadDraftQty}
                  </span>
                  <span className="text-sm font-bold text-flandi-dark/70">
                    {keypadProduct.unit || "cái"}
                  </span>
                </div>
              </div>

              <div className="text-right">
                <span className="text-[11px] font-extrabold text-flandi-muted uppercase tracking-wider block">
                  Thành tiền
                </span>
                <span className="text-xl sm:text-2xl font-black text-flandi-dark mt-0.5 block tabular-nums leading-none">
                  {formatVND(keypadProduct.price * keypadDraftQty)}
                </span>
              </div>
            </div>

            {/* Numeric Keypad Grid */}
            <div className="p-3.5 sm:p-5 bg-flandi-bg/40 space-y-3">
              <div className="grid grid-cols-3 gap-2 sm:gap-2.5">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                  <button
                    key={num}
                    type="button"
                    onClick={() => handleKeypadDigit(num)}
                    className="h-12 sm:h-13 rounded-2xl bg-white hover:bg-flandi-cream active:bg-flandi-coral active:text-white border-2 border-flandi-pink/70 text-flandi-dark text-xl sm:text-2xl font-black shadow-2xs transition active:scale-95 flex items-center justify-center select-none cursor-pointer tabular-nums"
                  >
                    {num}
                  </button>
                ))}

                {/* Nút Xoá hết */}
                <button
                  type="button"
                  onClick={handleKeypadClear}
                  className="h-12 sm:h-13 rounded-2xl bg-amber-50 hover:bg-amber-100 active:bg-amber-200 border-2 border-amber-200/80 text-amber-700 font-extrabold text-[13px] sm:text-sm shadow-2xs transition active:scale-95 flex items-center justify-center select-none cursor-pointer"
                  title="Xoá hết về 0"
                >
                  Xoá hết
                </button>

                {/* Phím số 0 */}
                <button
                  type="button"
                  onClick={() => handleKeypadDigit(0)}
                  className="h-12 sm:h-13 rounded-2xl bg-white hover:bg-flandi-cream active:bg-flandi-coral active:text-white border-2 border-flandi-pink/70 text-flandi-dark text-xl sm:text-2xl font-black shadow-2xs transition active:scale-95 flex items-center justify-center select-none cursor-pointer tabular-nums"
                >
                  0
                </button>

                {/* Nút Xóa lùi 1 số */}
                <button
                  type="button"
                  onClick={handleKeypadBackspace}
                  className="h-12 sm:h-13 rounded-2xl bg-rose-50 hover:bg-rose-100 active:bg-rose-200 border-2 border-rose-200/80 text-rose-600 font-extrabold text-[13px] sm:text-sm shadow-2xs transition active:scale-95 flex items-center justify-center gap-1 select-none cursor-pointer"
                  title="Xóa lùi 1 số"
                >
                  <Delete className="w-4.5 h-4.5" />
                  <span>Xóa</span>
                </button>
              </div>

              {/* Confirm / Done Button */}
              <button
                type="button"
                onClick={confirmKeypad}
                className="w-full py-3 sm:py-3.5 rounded-2xl bg-gradient-to-r from-flandi-coral to-flandi-salmon hover:opacity-95 text-white text-[15px] sm:text-base font-extrabold shadow-cute transition active:scale-98 flex items-center justify-center gap-2 select-none cursor-pointer"
              >
                <Check className="w-5 h-5" />
                <span>
                  {keypadDraftQty > 0
                    ? "Xác nhận"
                    : getQtyForProduct(keypadProduct.id) > 0
                    ? "Bỏ món"
                    : "Đóng"}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation & Pre-Copied Order Modal */}
      {sentResultModal && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setSentResultModal(null)}
        >
          <div
            className="bg-white rounded-3xl max-w-md w-full p-5 border-2 border-flandi-salmon shadow-2xl space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-2 border-b border-flandi-pink pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-display text-base sm:text-lg text-flandi-dark">
                    Đơn #{sentResultModal.orderCode}
                  </h3>
                  <p className="text-xs sm:text-[13px] text-emerald-700 font-extrabold">
                    ✓ Đã gửi tiệm & copy đơn
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSentResultModal(null)}
                className="p-1.5 rounded-full bg-flandi-bg hover:bg-flandi-pink/50"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 rounded-2xl bg-flandi-bg border border-flandi-pink space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[13px] font-extrabold text-flandi-dark">
                  Nội dung đơn
                </span>
                <button
                  type="button"
                  onClick={() => {
                    copyToClipboardInstant(sentResultModal.orderText);
                    notify("📋 Đã copy đơn!");
                  }}
                  className="px-2.5 py-1 rounded-lg bg-flandi-coral text-white text-xs font-extrabold flex items-center gap-1 shadow-2xs"
                >
                  <Copy className="w-3 h-3" />
                  <span>Copy</span>
                </button>
              </div>
              <textarea
                readOnly
                rows={5}
                value={sentResultModal.orderText}
                onClick={(e) => {
                  e.currentTarget.select();
                  copyToClipboardInstant(sentResultModal.orderText);
                  notify("📋 Đã copy đơn!");
                }}
                className="w-full text-xs font-semibold text-flandi-dark bg-white p-2.5 rounded-xl border border-flandi-pink resize-none focus:outline-none"
              />
            </div>

            {/* Optional VietQR for instant transfer */}
            {settings && (
              <div className="p-3 rounded-2xl bg-flandi-cream/60 border border-flandi-pink space-y-2">
                <div
                  onClick={() => setIsQrModalOpen(true)}
                  className="flex items-center gap-3 cursor-pointer group"
                >
                  <div className="relative shrink-0">
                    <img
                      src={`https://img.vietqr.io/image/${settings.bankBin}-${settings.bankAccountNo.replace(/\s+/g, "")}-compact2.png?amount=${sentResultModal.total}&addInfo=${encodeURIComponent(
                        `FLANDI ${sentResultModal.orderCode}`
                      )}`}
                      onError={(e) => {
                        e.currentTarget.onerror = null;
                        e.currentTarget.src = "/images/payment-qr.png";
                      }}
                      alt="VietQR TPBank"
                      className="w-20 h-20 rounded-xl bg-white border border-flandi-pink object-contain shrink-0 group-hover:scale-105 transition shadow-2xs"
                    />
                    <span className="absolute -bottom-1 -right-1 bg-flandi-coral text-white text-[9px] font-black px-1.5 py-0.5 rounded-full shadow-xs">
                      Phóng to
                    </span>
                  </div>
                  <div className="text-[13px] space-y-0.5 flex-1 min-w-0">
                    <p className="font-extrabold text-flandi-dark flex items-center gap-1">
                      <QrCode className="w-3.5 h-3.5 text-flandi-coral" />
                      <span>Quét VietQR thanh toán</span>
                    </p>
                    <p className="text-xs text-flandi-muted font-semibold truncate">
                      {settings.bankName} • {settings.bankAccountNo}
                    </p>
                    <p className="text-[11px] text-flandi-dark/80 font-bold truncate">
                      Chủ TK: {settings.bankAccountName || "BUI VAN LOI"}
                    </p>
                    <p className="text-base font-black text-flandi-coral tabular-nums">
                      {formatVND(sentResultModal.total)}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-1.5 pt-1.5 border-t border-dashed border-flandi-pink/80">
                  <button
                    type="button"
                    onClick={() => {
                      copyToClipboardInstant(settings.bankAccountNo.replace(/\s+/g, ""));
                      notify("📋 Đã sao chép số tài khoản!");
                    }}
                    className="py-1 px-2 rounded-lg bg-white border border-flandi-pink text-[11px] font-bold text-flandi-dark hover:bg-flandi-bg flex items-center justify-center gap-1 cursor-pointer transition active:scale-95"
                  >
                    <Copy className="w-3 h-3 text-flandi-coral" />
                    <span>Copy STK</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsQrModalOpen(true)}
                    className="py-1 px-2 rounded-lg bg-flandi-coral/10 hover:bg-flandi-coral/20 text-flandi-coral text-[11px] font-extrabold flex items-center justify-center gap-1 cursor-pointer transition active:scale-95"
                  >
                    <Maximize2 className="w-3 h-3" />
                    <span>Xem thẻ QR</span>
                  </button>
                </div>
              </div>
            )}

            <button
              type="button"
              disabled={isSavingBillImage}
              onClick={() =>
                handleOpenShareBill({
                  orderCode: sentResultModal.orderCode,
                  items: sentResultModal.items,
                  subtotal: sentResultModal.subtotal,
                  shippingFee: sentResultModal.shippingFee,
                  total: sentResultModal.total,
                })
              }
              className="w-full py-2.5 px-3 rounded-xl bg-flandi-coral hover:bg-flandi-salmon text-white font-extrabold text-[13px] sm:text-sm flex items-center justify-center gap-1.5 shadow-cute transition active:scale-95 disabled:opacity-50 cursor-pointer"
            >
              <Share2 className="w-4 h-4" />
              <span>
                {isSavingBillImage ? "..." : "Share"}
              </span>
            </button>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  setSentResultModal(null);
                  setPreferredChatChannel("ZALO");
                  setOpenChatTrigger((n) => n + 1);
                }}
                className="py-2.5 px-3 rounded-xl bg-[#0068FF] hover:bg-[#0056D6] text-white font-extrabold text-[13px] sm:text-sm flex items-center justify-center gap-1.5 shadow-md"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Chat Zalo</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setSentResultModal(null);
                  setPreferredChatChannel("MESSENGER");
                  setOpenChatTrigger((n) => n + 1);
                }}
                className="py-2.5 px-3 rounded-xl bg-[#006AFF] hover:opacity-95 text-white font-extrabold text-[13px] sm:text-sm flex items-center justify-center gap-1.5 shadow-md"
              >
                <MessageCircle className="w-3.5 h-3.5" />
                <span>Chat Messenger</span>
              </button>
            </div>

            {typeof navigator !== "undefined" && "share" in navigator && (
              <button
                type="button"
                onClick={async () => {
                  try {
                    await navigator.share({
                      title: `Đơn bánh FLANDI #${sentResultModal.orderCode}`,
                      text: sentResultModal.orderText,
                    });
                  } catch {
                    // User cancelled share sheet
                  }
                }}
                className="w-full py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-[13px] sm:text-sm flex items-center justify-center gap-1.5 shadow-sm"
              >
                <Share2 className="w-3.5 h-3.5" />
                <span>Chia sẻ qua App khác</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                setCartMap({});
                setSentResultModal(null);
              }}
              className="w-full py-2.5 px-4 rounded-xl bg-gray-100 hover:bg-gray-200 text-flandi-dark font-extrabold text-[13px] sm:text-sm"
            >
              Đặt đơn mới
            </button>
          </div>
        </div>
      )}

      {/* Modal Phóng to Thẻ QR Ngân hàng TPBank */}
      {isQrModalOpen && settings && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-[80] bg-black/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150"
          onClick={() => setIsQrModalOpen(false)}
        >
          <div
            className="bg-white rounded-3xl p-4 sm:p-5 max-w-sm w-full border-2 border-flandi-salmon shadow-cute-lg space-y-3 text-center animate-in zoom-in-95 duration-150 max-h-[95vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-flandi-pink pb-2">
              <div className="text-left">
                <h3 className="font-display text-sm sm:text-base font-black text-flandi-coral leading-tight">
                  Mã QR Thanh Toán {settings.bankName}
                </h3>
                <p className="text-[11px] font-bold text-flandi-muted">
                  {settings.bankAccountName || "BUI VAN LOI"} • {settings.bankAccountNo}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsQrModalOpen(false)}
                className="w-8 h-8 rounded-full bg-flandi-bg hover:bg-flandi-pink/50 text-flandi-dark flex items-center justify-center cursor-pointer shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* The high-res cropped QR card */}
            <div className="relative mx-auto w-full max-w-[260px] sm:max-w-[280px] aspect-[74/102] rounded-2xl overflow-hidden bg-[#1E112E] shadow-cute border border-[#3E2356] flex items-center justify-center p-1">
              <img
                src="/images/payment-qr.png"
                alt={`Mã QR ${settings.bankName} ${settings.bankAccountName}`}
                className="w-full h-full object-contain rounded-xl"
              />
            </div>

            {sentResultModal && (
              <div className="p-2.5 rounded-xl bg-flandi-cream/70 border border-flandi-pink text-xs space-y-1 text-left">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-flandi-muted">Số tiền cần chuyển:</span>
                  <span className="font-black text-flandi-coral text-sm tabular-nums">
                    {formatVND(sentResultModal.total)}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="font-bold text-flandi-muted">Nội dung CK:</span>
                  <span className="font-extrabold text-flandi-dark font-mono">
                    FLANDI {sentResultModal.orderCode}
                  </span>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  copyToClipboardInstant(settings.bankAccountNo.replace(/\s+/g, ""));
                  notify("📋 Đã sao chép STK!");
                }}
                className="py-2 px-3 rounded-xl bg-white border border-flandi-pink text-xs font-bold text-flandi-dark hover:bg-flandi-bg flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 transition"
              >
                <Copy className="w-3.5 h-3.5 text-flandi-coral" />
                <span>Copy STK</span>
              </button>
              {sentResultModal && (
                <button
                  type="button"
                  onClick={() => {
                    copyToClipboardInstant(`FLANDI ${sentResultModal.orderCode}`);
                    notify("📋 Đã sao chép nội dung!");
                  }}
                  className="py-2 px-3 rounded-xl bg-white border border-flandi-pink text-xs font-bold text-flandi-dark hover:bg-flandi-bg flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 transition"
                >
                  <Copy className="w-3.5 h-3.5 text-flandi-coral" />
                  <span>Copy Nội Dung</span>
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={() => setIsQrModalOpen(false)}
              className="w-full py-2.5 rounded-xl bg-flandi-coral text-white font-extrabold text-xs shadow-cute cursor-pointer hover:bg-flandi-salmon transition active:scale-95"
            >
              Đóng mã QR
            </button>
          </div>
        </div>
      )}

      {/* Product Description Popup (when clicking product image on Menu/Bill) */}
      {previewProduct && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Mô tả ${previewProduct.name}`}
          className="fixed inset-0 z-[75] bg-black/60 backdrop-blur-xs flex items-center justify-center p-3.5 sm:p-4 animate-in fade-in duration-150"
          onClick={() => setPreviewProduct(null)}
        >
          <div
            className="bg-white rounded-3xl max-w-sm sm:max-w-md w-full overflow-hidden border border-flandi-pink shadow-2xl animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Product Hero Photo */}
            <div className="relative h-52 sm:h-60 w-full bg-flandi-cream">
              <img
                src={previewProduct.image}
                alt={previewProduct.name}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-x-0 top-0 p-3 flex items-center justify-between gap-2 bg-gradient-to-b from-black/35 to-transparent">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="px-2.5 py-1 rounded-full bg-white/95 backdrop-blur-xs text-flandi-dark text-xs font-extrabold shadow-xs">
                    {previewProduct.category}
                  </span>
                  {previewProduct.isBestSeller && (
                    <span className="px-2.5 py-1 rounded-full bg-flandi-coral text-white text-xs font-extrabold shadow-xs">
                      ★ Best Seller
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setPreviewProduct(null)}
                  className="w-8 h-8 rounded-full bg-white/95 hover:bg-white text-flandi-dark flex items-center justify-center shadow-sm transition active:scale-95 cursor-pointer"
                  title="Đóng"
                  aria-label="Đóng"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Product Details */}
            <div className="p-4 sm:p-5 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="font-display text-lg sm:text-xl text-flandi-dark leading-tight">
                    {previewProduct.name}
                  </h3>
                  {previewProduct.subtitle && (
                    <p className="text-[13px] sm:text-sm font-extrabold text-flandi-muted mt-0.5">
                      {previewProduct.subtitle}
                    </p>
                  )}
                </div>
                <span className="px-3 py-1 rounded-xl bg-flandi-cream border border-flandi-pink text-flandi-coral text-sm sm:text-[15px] font-black shrink-0 shadow-2xs tabular-nums">
                  {previewProduct.badgeText}
                </span>
              </div>

              <p className="text-[13px] sm:text-sm font-semibold text-flandi-dark/90 leading-relaxed">
                {previewProduct.description ||
                  "Bánh thủ công làm mới mỗi sáng, ngọt thanh, không chất bảo quản."}
              </p>

              {previewProduct.variants && previewProduct.variants.length > 1 && (
                <div className="flex flex-wrap gap-1.5 pt-0.5">
                  {previewProduct.variants.map((v) => (
                    <span
                      key={v.id}
                      className="px-2.5 py-1 rounded-lg bg-flandi-bg border border-flandi-pink/70 text-xs font-bold text-flandi-dark"
                    >
                      {v.name}
                    </span>
                  ))}
                </div>
              )}

              <div className="px-3 py-2 rounded-xl bg-flandi-bg/80 border border-flandi-pink/60 flex items-start gap-2 text-xs font-bold text-flandi-muted">
                <Sparkles className="w-3.5 h-3.5 text-flandi-coral shrink-0 mt-0.5" />
                <span>
                  {settings?.brandKit?.storageInstruction ||
                    "Làm mới mỗi sáng • Bảo quản lạnh 2–6°C (2–3 ngày)."}
                </span>
              </div>

              <button
                type="button"
                onClick={() => {
                  const target = previewProduct;
                  setPreviewProduct(null);
                  openKeypad(target);
                }}
                className="w-full py-2.5 px-4 rounded-2xl bg-flandi-coral hover:bg-flandi-salmon text-white font-extrabold text-sm shadow-cute transition active:scale-95 cursor-pointer"
              >
                {getQtyForProduct(previewProduct.id) > 0
                  ? `Đổi số lượng (${getQtyForProduct(previewProduct.id)} ${
                      previewProduct.unit || "cái"
                    })`
                  : "Chọn số lượng"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Web-Only Clean Share Popup (Phone skips popup and shares directly) */}
      {billImageModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Share FLANDI"
          className="hidden lg:flex fixed inset-0 z-[70] bg-black/55 backdrop-blur-xs items-center justify-center p-4 animate-in fade-in duration-150"
          onClick={closeBillImageModal}
        >
          <div
            className="bg-white rounded-3xl max-w-[400px] w-full max-h-[90vh] flex flex-col border border-flandi-pink shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Clean Minimal Header */}
            <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between gap-2 shrink-0">
              <div className="flex items-center gap-2 min-w-0">
                <h3 className="font-display text-base sm:text-lg text-flandi-dark">
                  Share
                </h3>
                {billImageModal.autoCopied && (
                  <span className="px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-bold flex items-center gap-1 shrink-0">
                    <Check className="w-3 h-3 stroke-[3]" />
                    <span>Đã copy ảnh</span>
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={closeBillImageModal}
                className="w-7 h-7 rounded-full hover:bg-slate-100 text-slate-400 hover:text-flandi-dark flex items-center justify-center transition cursor-pointer"
                title="Đóng"
                aria-label="Đóng"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Clean Centered Receipt Preview */}
            <div className="flex-1 overflow-y-auto p-3.5 bg-flandi-bg/50 flex items-center justify-center min-h-0">
              <img
                src={billImageModal.objectUrl}
                alt="Tiệm bánh FLANDI - Hóa đơn"
                className="max-h-[54vh] w-auto max-w-full object-contain rounded-2xl border border-flandi-pink/70 shadow-sm select-auto"
              />
            </div>

            {/* Clean, Harmonious Action Footer */}
            <div className="p-3.5 border-t border-slate-100 bg-white space-y-2.5 shrink-0">
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    triggerBillDownload(billImageModal);
                    notify("📥 Đã lưu ảnh bill!");
                  }}
                  className="py-2.5 px-3 rounded-xl bg-flandi-coral hover:bg-flandi-salmon text-white font-extrabold text-[13px] sm:text-sm flex items-center justify-center gap-1.5 shadow-xs transition active:scale-95 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Lưu ảnh</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleCopyBillImage(billImageModal)}
                  className="py-2.5 px-3 rounded-xl bg-flandi-bg hover:bg-flandi-pink/40 text-flandi-dark border border-flandi-pink font-extrabold text-[13px] sm:text-sm flex items-center justify-center gap-1.5 transition active:scale-95 cursor-pointer"
                >
                  <Copy className="w-3.5 h-3.5 text-flandi-coral" />
                  <span>Copy ảnh</span>
                </button>
              </div>

              <div className="flex items-center gap-2">
                <div className="h-px flex-1 bg-slate-100" />
                <span className="text-[11px] font-bold text-flandi-muted">
                  Mở nhanh & dán (Ctrl+V)
                </span>
                <div className="h-px flex-1 bg-slate-100" />
              </div>

              <div
                className={`grid ${
                  typeof navigator !== "undefined" && "share" in navigator
                    ? "grid-cols-3"
                    : "grid-cols-2"
                } gap-2`}
              >
                <button
                  type="button"
                  onClick={() =>
                    handleShareBillViaPlatform("ZALO", billImageModal)
                  }
                  className="py-2 px-2.5 rounded-xl bg-white hover:bg-blue-50/60 border border-slate-200 hover:border-[#0068FF]/40 text-flandi-dark font-extrabold text-xs sm:text-[13px] flex items-center justify-center gap-1.5 transition active:scale-95 cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5 text-[#0068FF]" />
                  <span>Zalo</span>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    handleShareBillViaPlatform("MESSENGER", billImageModal)
                  }
                  className="py-2 px-2.5 rounded-xl bg-white hover:bg-blue-50/60 border border-slate-200 hover:border-[#006AFF]/40 text-flandi-dark font-extrabold text-xs sm:text-[13px] flex items-center justify-center gap-1.5 transition active:scale-95 cursor-pointer"
                >
                  <MessageCircle className="w-3.5 h-3.5 text-[#006AFF]" />
                  <span>Messenger</span>
                </button>

                {typeof navigator !== "undefined" && "share" in navigator && (
                  <button
                    type="button"
                    onClick={() => handleShareBillImage(billImageModal)}
                    className="py-2 px-2.5 rounded-xl bg-white hover:bg-flandi-cream/70 border border-slate-200 hover:border-flandi-salmon text-flandi-dark font-extrabold text-xs sm:text-[13px] flex items-center justify-center gap-1.5 transition active:scale-95 cursor-pointer"
                  >
                    <Share2 className="w-3.5 h-3.5 text-flandi-coral" />
                    <span>Khác</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Customer Account & Order Lookup Drawer */}
      <CustomerAccountDrawer
        onReorder={handleReorder}
        shopPhone={settings?.phone}
        shopName={settings?.shopName}
        bankBin={settings?.bankBin}
        bankAccountNo={settings?.bankAccountNo}
      />

      {/* Shop Contact & Address Popup Modal */}
      <ShopContactModal
        isOpen={isContactModalOpen}
        onClose={() => setIsContactModalOpen(false)}
        phone={settings?.phone || "0703166903"}
        zaloPhone={settings?.zaloPhone || settings?.phone || "0703166903"}
        messengerUrl={settings?.messengerUrl}
        facebookUrl={settings?.facebookUrl || "https://www.facebook.com/tiem.flandi"}
        googleMapsUrl={settings?.googleMapsUrl || "https://maps.app.goo.gl/8eTbXKBdtogUjvUU7"}
        address={settings?.address || "123/3 Nguyễn Hữu Cảnh, Thủ Dầu Một, TP Hồ Chí Minh"}
        openHours={settings?.openHours || "08:00 – 21:30 mỗi ngày"}
      />
    </div>
  );
}
