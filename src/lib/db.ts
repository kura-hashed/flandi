import fs from "fs";
import path from "path";
import { StoreDatabase, Product, IngredientItem, Order, StockLog, BrandKit, PageConfig, LedgerEntry } from "./types";

const DATA_DIR = path.join(process.cwd(), "data");
const DB_PATH = path.join(DATA_DIR, "store.json");

export const DEFAULT_BRAND_KIT: BrandKit = {
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
  promoSubheadline: "Freeship đơn từ 150k • Đặt nhanh qua Zalo 0703166903",
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

export const DEFAULT_PAGE_CONFIG: PageConfig = {
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

const INITIAL_PRODUCTS: Product[] = [
  {
    id: "prod-flan",
    name: "Flan",
    subtitle: "Bánh Flan Trứng Sữa Caramel Mềm Mịn",
    category: "Flan & Pudding",
    description:
      "Bánh flan truyền thống làm từ trứng gà tươi, sữa kem béo ngậy và lớp sốt caramel đắng nhẹ thơm lừng. Mềm mịn tan ngay trong miệng!",
    price: 6000,
    costPrice: 3500,
    unit: "cái",
    badgeText: "6k / cái",
    image: "/images/products/flan.png",
    stock: 120,
    stockUnit: "cái",
    lowStockThreshold: 30,
    isActive: true,
    isBestSeller: true,
    variants: [
      {
        id: "var-flan-1",
        name: "Lẻ 1 cái",
        price: 6000,
        unitLabel: "cái",
        stockDeduction: 1,
      },
      {
        id: "var-flan-5",
        name: "Set 5 cái",
        price: 30000,
        unitLabel: "set 5",
        stockDeduction: 5,
      },
      {
        id: "var-flan-10",
        name: "1 Chục (10 cái)",
        price: 60000,
        unitLabel: "chục",
        stockDeduction: 10,
      },
    ],
  },
  {
    id: "prod-panna-cotta",
    name: "Panna Cotta",
    subtitle: "Panna Cotta Kem Tươi Sốt Trái Cây Tươi",
    category: "Panna Cotta",
    description:
      "Cốt kem sữa Ý núng nính béo thanh, kết hợp cùng lớp sốt trái cây tươi nấu thủ công chua ngọt bắt vị: Chanh dây, Dâu tây, Xoài, Việt quất.",
    price: 8000,
    costPrice: 4500,
    unit: "cái",
    badgeText: "8k / cái",
    image: "/images/products/panna-cotta.png",
    stock: 65,
    stockUnit: "cái",
    lowStockThreshold: 15,
    isActive: true,
    isBestSeller: true,
    variants: [
      {
        id: "var-pc-passion",
        name: "Vị Chanh Dây",
        price: 8000,
        unitLabel: "cái",
        stockDeduction: 1,
      },
      {
        id: "var-pc-strawberry",
        name: "Vị Dâu Tây",
        price: 8000,
        unitLabel: "cái",
        stockDeduction: 1,
      },
      {
        id: "var-pc-mango",
        name: "Vị Xoài Tươi",
        price: 8000,
        unitLabel: "cái",
        stockDeduction: 1,
      },
      {
        id: "var-pc-blueberry",
        name: "Vị Việt Quất",
        price: 8000,
        unitLabel: "cái",
        stockDeduction: 1,
      },
    ],
  },
  {
    id: "prod-rau-cau-dua",
    name: "Rau Câu Dừa",
    subtitle: "Rau Câu Nước Dừa Tươi Cốt Dừa Béo Ngậy",
    category: "Rau Câu",
    description:
      "Rau câu nấu từ 100% nước dừa xiêm ngọt mát tự nhiên kết hợp lớp cốt dừa béo ngậy phía trên, giòn mát giải nhiệt.",
    price: 6000,
    costPrice: 3500,
    unit: "cái",
    badgeText: "6k / cái",
    image: "/images/products/rau-cau-dua.png",
    stock: 80,
    stockUnit: "cái",
    lowStockThreshold: 20,
    isActive: true,
    isBestSeller: true,
    variants: [
      {
        id: "var-rcd-plain-1",
        name: "Rau Câu Dừa",
        price: 6000,
        unitLabel: "cái",
        stockDeduction: 1,
      },
    ],
  },
  {
    id: "prod-rau-cau-flan",
    name: "Rau Câu Flan",
    subtitle: "Rau Câu Nước Dừa Nhân Bánh Flan Béo Mịn",
    category: "Rau Câu",
    description:
      "Sự kết hợp hoàn hảo giữa lớp rau câu nước dừa xiêm giòn mát bên ngoài và nhân bánh Flan trứng sữa mềm mịn béo thơm bên trong.",
    price: 8000,
    costPrice: 4500,
    unit: "cái",
    badgeText: "8k / cái",
    image: "/images/products/rau-cau-dua.png",
    stock: 60,
    stockUnit: "cái",
    lowStockThreshold: 15,
    isActive: true,
    isBestSeller: true,
    variants: [
      {
        id: "var-rcd-flan-1",
        name: "Rau Câu Flan",
        price: 8000,
        unitLabel: "cái",
        stockDeduction: 1,
      },
    ],
  },
  {
    id: "prod-rau-cau-la",
    name: "Rau Câu Lá",
    subtitle: "Rau Câu Lá Dứa & Cà Phê Cốt Dừa",
    category: "Rau Câu",
    description:
      "Những chiếc lá rau câu giòn sần sật, đổ nhiều lớp tỉ mỉ từ nước cốt lá dứa tươi tự nhiên, cốt dừa béo ngậy và cà phê thơm lừng.",
    price: 40000,
    costPrice: 22000,
    unit: "hộp",
    badgeText: "40k / hộp",
    image: "/images/products/rau-cau-la.png",
    stock: 18,
    stockUnit: "hộp",
    lowStockThreshold: 5,
    isActive: true,
    isBestSeller: false,
    variants: [
      {
        id: "var-rcl-box",
        name: "Mix Lá Dứa & Cà Phê",
        price: 40000,
        unitLabel: "hộp",
        stockDeduction: 1,
      },
      {
        id: "var-rcl-pandan",
        name: "Chuyên Lá Dứa Cốt Dừa",
        price: 40000,
        unitLabel: "hộp",
        stockDeduction: 1,
      },
    ],
  },
  {
    id: "prod-tau-hu",
    name: "Tàu Hũ Singapore",
    subtitle: "Tàu Hũ Lạnh Mềm Mướt Tan Ngay",
    category: "Tàu Hũ & Yogurt",
    description:
      "Tàu hũ lạnh kiểu Singapore siêu mềm mướt, thơm dịu hương đậu nành non và lá dứa tươi, ít ngọt, thanh mát giải nhiệt cực đã.",
    price: 8000,
    costPrice: 4000,
    unit: "cái",
    badgeText: "8k / cái",
    image: "/images/products/tau-hu-singapore.png",
    stock: 48,
    stockUnit: "cái",
    lowStockThreshold: 12,
    isActive: true,
    isBestSeller: false,
    variants: [
      {
        id: "var-th-pandan",
        name: "Vị Lá Dứa",
        price: 8000,
        unitLabel: "cái",
        stockDeduction: 1,
      },
      {
        id: "var-th-soy",
        name: "Vị Truyền Thống",
        price: 8000,
        unitLabel: "cái",
        stockDeduction: 1,
      },
    ],
  },
  {
    id: "prod-yogurt",
    name: "Yogurt",
    subtitle: "Sữa Chua Nhà Làm Dẻo Mịn Chuẩn Vị",
    category: "Tàu Hũ & Yogurt",
    description:
      "Sữa chua ủ men tự nhiên theo công thức nhà Flandi, chất sánh dẻo mịn không bị dăm đá, chua dịu ngọt thanh tốt cho tiêu hoá.",
    price: 5000,
    costPrice: 2800,
    unit: "cái",
    badgeText: "5k / cái",
    image: "/images/products/yogurt.png",
    stock: 90,
    stockUnit: "cái",
    lowStockThreshold: 20,
    isActive: true,
    isBestSeller: false,
    variants: [
      {
        id: "var-yg-1",
        name: "Sữa Chua Nhà Làm",
        price: 5000,
        unitLabel: "cái",
        stockDeduction: 1,
      },
    ],
  },
];

const INITIAL_INGREDIENTS: IngredientItem[] = [
  {
    id: "ing-1",
    name: "Trứng gà ta tươi",
    category: "Nguyên liệu",
    quantity: 180,
    unit: "quả",
    minThreshold: 60,
    costPerUnit: 3200,
    lastUpdated: new Date().toISOString(),
  },
  {
    id: "ing-2",
    name: "Sữa tươi nguyên kem",
    category: "Nguyên liệu",
    quantity: 14,
    unit: "lít",
    minThreshold: 6,
    costPerUnit: 34000,
    lastUpdated: new Date().toISOString(),
  },
  {
    id: "ing-3",
    name: "Kem tươi Whipping Cream",
    category: "Nguyên liệu",
    quantity: 4,
    unit: "hộp 1L",
    minThreshold: 3,
    costPerUnit: 135000,
    lastUpdated: new Date().toISOString(),
  },
  {
    id: "ing-4",
    name: "Nước dừa xiêm tươi",
    category: "Nguyên liệu",
    quantity: 12,
    unit: "lít",
    minThreshold: 5,
    costPerUnit: 25000,
    lastUpdated: new Date().toISOString(),
  },
  {
    id: "ing-5",
    name: "Sốt Chanh dây & Dâu tây tươi",
    category: "Topping",
    quantity: 2.5,
    unit: "kg",
    minThreshold: 2,
    costPerUnit: 85000,
    lastUpdated: new Date().toISOString(),
  },
  {
    id: "ing-6",
    name: "Hũ nhựa nắp bật (Flan / Panna Cotta)",
    category: "Bao bì",
    quantity: 340,
    unit: "cái",
    minThreshold: 100,
    costPerUnit: 650,
    lastUpdated: new Date().toISOString(),
  },
  {
    id: "ing-7",
    name: "Hũ Sữa chua nắp vặn",
    category: "Bao bì",
    quantity: 85,
    unit: "hũ",
    minThreshold: 100,
    costPerUnit: 900,
    lastUpdated: new Date().toISOString(),
  },
];

const INITIAL_ORDERS: Order[] = [
  {
    id: "ord-1001",
    code: "FL-1001",
    source: "POS",
    status: "COMPLETED",
    customerName: "Chị Minh Thư",
    customerPhone: "0908123456",
    note: "Lấy nhiều đá khô giữ lạnh",
    items: [
      {
        productId: "prod-flan",
        productName: "Flan",
        variantId: "var-flan-10",
        variantName: "1 Chục (10 cái)",
        quantity: 1,
        unitPrice: 60000,
        subtotal: 60000,
        stockDeductionPerItem: 10,
      },
      {
        productId: "prod-panna-cotta",
        productName: "Panna Cotta",
        variantId: "var-pc-passion",
        variantName: "Vị Chanh Dây (Passion Fruit)",
        quantity: 4,
        unitPrice: 10000,
        subtotal: 40000,
        stockDeductionPerItem: 1,
      },
    ],
    subtotal: 100000,
    discount: 0,
    shippingFee: 0,
    total: 100000,
    paymentMethod: "VIETQR",
    isPaid: true,
    createdAt: new Date(Date.now() - 1000 * 60 * 95).toISOString(),
  },
  {
    id: "ord-1002",
    code: "FL-1002",
    source: "ONLINE",
    status: "COMPLETED",
    customerName: "Bạn Ngọc Hân",
    customerPhone: "0932888999",
    customerAddress: "128 Nguyễn Gia Trí, Q. Bình Thạnh",
    note: "Giao giờ nghỉ trưa giúp mình nha",
    items: [
      {
        productId: "prod-rau-cau-dua",
        productName: "Rau Câu Dừa (Flan)",
        variantId: "var-rcd-flan-10",
        variantName: "Nhân Flan — 1 Chục (10 hũ)",
        quantity: 1,
        unitPrice: 80000,
        subtotal: 80000,
        stockDeductionPerItem: 10,
      },
      {
        productId: "prod-rau-cau-la",
        productName: "Rau Câu Lá",
        variantId: "var-rcl-box",
        variantName: "Hộp Mix Lá Dứa & Cà Phê",
        quantity: 1,
        unitPrice: 40000,
        subtotal: 40000,
        stockDeductionPerItem: 1,
      },
      {
        productId: "prod-tau-hu",
        productName: "Tàu Hũ Singapore",
        variantId: "var-th-pandan",
        variantName: "Vị Lá Dứa (Pandan)",
        quantity: 5,
        unitPrice: 8000,
        subtotal: 40000,
        stockDeductionPerItem: 1,
      },
    ],
    subtotal: 160000,
    discount: 0,
    shippingFee: 0,
    total: 160000,
    paymentMethod: "VIETQR",
    isPaid: true,
    createdAt: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
  },
  {
    id: "ord-1003",
    code: "FL-1003",
    source: "ONLINE",
    status: "PENDING",
    customerName: "Anh Hoàng Nam",
    customerPhone: "0977554433",
    customerAddress: "45 Lê Văn Sỹ, Quận 3",
    note: "Cho thêm muỗng nhựa nha shop",
    items: [
      {
        productId: "prod-yogurt",
        productName: "Yogurt",
        variantId: "var-yg-10",
        variantName: "1 Chục (10 hũ)",
        quantity: 1,
        unitPrice: 50000,
        subtotal: 50000,
        stockDeductionPerItem: 10,
      },
      {
        productId: "prod-panna-cotta",
        productName: "Panna Cotta",
        variantId: "var-pc-strawberry",
        variantName: "Vị Dâu Tây (Strawberry)",
        quantity: 3,
        unitPrice: 10000,
        subtotal: 30000,
        stockDeductionPerItem: 1,
      },
    ],
    subtotal: 80000,
    discount: 0,
    shippingFee: 15000,
    total: 95000,
    paymentMethod: "COD",
    isPaid: false,
    createdAt: new Date(Date.now() - 1000 * 60 * 12).toISOString(),
  },
];

const INITIAL_LOGS: StockLog[] = [
  {
    id: "log-1",
    targetId: "prod-flan",
    targetName: "Flan",
    targetType: "product",
    change: 130,
    previousStock: 0,
    newStock: 130,
    reason: "Mẻ bánh mới ra lò buổi sáng",
    createdAt: new Date(Date.now() - 1000 * 60 * 180).toISOString(),
  },
  {
    id: "log-2",
    targetId: "prod-flan",
    targetName: "Flan",
    targetType: "product",
    change: -10,
    previousStock: 130,
    newStock: 120,
    reason: "Bán đơn POS #FL-1001",
    createdAt: new Date(Date.now() - 1000 * 60 * 95).toISOString(),
  },
];

const INITIAL_DB: StoreDatabase = {
  products: INITIAL_PRODUCTS,
  ingredients: INITIAL_INGREDIENTS,
  stockLogs: INITIAL_LOGS,
  orders: INITIAL_ORDERS,
  settings: {
    shopName: "FLANDI",
    tagline: "Muốn ăn hãy Flăn vào tớ",
    phone: "0703166903",
    zaloPhone: "0703166903",
    facebookUrl: "https://www.facebook.com/tiem.flandi",
    address: "Tiệm bánh ngọt nhà làm FLANDI — TP. Hồ Chí Minh",
    openHours: "08:00 – 21:30 mỗi ngày",
    bankName: "Vietcombank",
    bankBin: "970436",
    bankAccountNo: "1029384756",
    bankAccountName: "TIEM BANH FLANDI",
    freeShipMinimum: 150000,
    defaultShippingFee: 15000,
    announcement: "Mẻ bánh Flan & Panna Cotta mới ra lò mỗi sáng — Freeship đơn từ 150k!",
    brandKit: DEFAULT_BRAND_KIT,
    pageConfig: DEFAULT_PAGE_CONFIG,
  },
  chats: [
    {
      id: "chat-demo-1",
      customerName: "Bạn Bảo Trân",
      customerPhone: "0912345678",
      unreadForAdmin: 1,
      updatedAt: new Date(Date.now() - 1000 * 60 * 8).toISOString(),
      messages: [
        {
          id: "msg-1",
          sender: "BOT",
          text: "Chào bạn! 🍮 Tiệm bánh FLANDI (“Muốn ăn hãy Flăn vào tớ”) có thể giúp gì cho bạn hôm nay nè?",
          createdAt: new Date(Date.now() - 1000 * 60 * 10).toISOString(),
        },
        {
          id: "msg-2",
          sender: "CUSTOMER",
          text: "Shop ơi hôm nay còn Panna Cotta vị chanh dây với Rau câu dừa nhân flan không ạ?",
          createdAt: new Date(Date.now() - 1000 * 60 * 8).toISOString(),
        },
      ],
    },
  ],
  ledger: [
    {
      id: "led-demo-1",
      code: "SS-1001",
      type: "EXPENSE",
      category: "Nguyên liệu",
      title: "Nhập trứng gà ta, sữa tươi thanh trùng & kem tươi",
      amount: 420000,
      paymentMethod: "VIETQR",
      note: "Hoá đơn nhập nguyên liệu mẻ bánh sáng sớm",
      imageUrl: "/images/products/flan.png",
      createdAt: new Date(Date.now() - 1000 * 60 * 180).toISOString(),
    },
    {
      id: "led-demo-2",
      code: "SS-1002",
      type: "EXPENSE",
      category: "Bao bì & Hộp",
      title: "Mua 500 hũ nhựa nắp trong + túi giữ nhiệt + đá gel",
      amount: 185000,
      paymentMethod: "CASH",
      note: "Đã kiểm đủ số lượng nhập kho bao bì",
      imageUrl: "/images/products/panna-cotta.png",
      createdAt: new Date(Date.now() - 1000 * 60 * 120).toISOString(),
    },
    {
      id: "led-demo-3",
      code: "SS-1003",
      type: "NOTE_PHOTO",
      category: "Sổ ghi chép / Kiểm ca",
      title: "Ảnh chụp phiếu kiểm mẻ bánh & sổ bàn giao ca sáng",
      amount: 0,
      paymentMethod: "CASH",
      note: "Bàn giao đủ 80 Flan, 55 Panna Cotta, 45 Rau câu dừa",
      imageUrl: "/images/menu-board.png",
      createdAt: new Date(Date.now() - 1000 * 60 * 60).toISOString(),
    },
  ],
};

export function readDb(): StoreDatabase {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (!fs.existsSync(DB_PATH)) {
      fs.writeFileSync(DB_PATH, JSON.stringify(INITIAL_DB, null, 2), "utf-8");
      return INITIAL_DB;
    }
    const raw = fs.readFileSync(DB_PATH, "utf-8");
    const parsed = JSON.parse(raw) as StoreDatabase;
    if (!parsed.settings.brandKit) {
      parsed.settings.brandKit = DEFAULT_BRAND_KIT;
    }
    if (!parsed.settings.pageConfig) {
      parsed.settings.pageConfig = DEFAULT_PAGE_CONFIG;
    }
    if (!parsed.chats) {
      parsed.chats = INITIAL_DB.chats;
    }
    if (!parsed.ledger) {
      parsed.ledger = INITIAL_DB.ledger;
    }
    return parsed;
  } catch (err) {
    console.error("Failed to read DB, returning initial DB:", err);
    return INITIAL_DB;
  }
}

export function writeDb(data: StoreDatabase): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), "utf-8");
}
