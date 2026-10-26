export interface ProductVariant {
  id: string;
  name: string;
  price: number;
  unitLabel: string; // e.g., "chục", "cái", "hộp"
  stockDeduction: number; // how many base stock units this variant deducts (e.g. 1 chục = 10 cái, or 1 unit)
}

export interface Product {
  id: string;
  name: string;
  subtitle: string;
  category: "Flan & Pudding" | "Panna Cotta" | "Rau Câu" | "Tàu Hũ & Yogurt";
  description: string;
  price: number; // default display price in VND (e.g. 60000)
  costPrice: number; // cost per base stock unit for profit analytics
  unit: string; // display unit on badge, e.g. "chục", "cái", "hộp"
  badgeText: string; // e.g. "60k / chục"
  secondaryBadgeText?: string; // e.g. "80k / chục" for Rau Câu Dừa (Flan)
  image: string;
  stock: number; // current available stock in base units
  stockUnit: string; // e.g. "cái", "hộp", "hũ"
  lowStockThreshold: number;
  isActive: boolean;
  isBestSeller?: boolean;
  variants: ProductVariant[];
}

export interface IngredientItem {
  id: string;
  name: string;
  category: "Nguyên liệu" | "Bao bì" | "Topping";
  quantity: number;
  unit: string;
  minThreshold: number;
  costPerUnit: number;
  lastUpdated: string;
}

export interface StockLog {
  id: string;
  targetId: string;
  targetName: string;
  targetType: "product" | "ingredient";
  change: number; // +10 or -2
  previousStock: number;
  newStock: number;
  reason: string; // "Mẻ bánh mới", "Đơn hàng POS #FL-...", "Kiểm kho", "Huỷ hàng hỏng"
  createdAt: string;
}

export interface OrderItem {
  productId: string;
  productName: string;
  variantId: string;
  variantName: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  stockDeductionPerItem: number;
}

export type OrderSource = "POS" | "ONLINE" | "ZALO" | "GRAB_SHOPEE";
export type OrderStatus = "PENDING" | "PREPARING" | "COMPLETED" | "CANCELLED";
export type PaymentMethod = "CASH" | "VIETQR" | "COD" | "MOMO";

export interface Order {
  id: string;
  code: string; // e.g. FL-2401
  source: OrderSource;
  status: OrderStatus;
  customerId?: string;
  customerEmail?: string;
  customerName: string;
  customerPhone: string;
  customerAddress?: string;
  note?: string;
  attachmentImage?: string; // Photo of handwritten order, chat screenshot, or payment bill
  items: OrderItem[];
  subtotal: number;
  discount: number;
  shippingFee: number;
  total: number;
  paymentMethod: PaymentMethod;
  isPaid: boolean;
  cashReceived?: number;
  changeGiven?: number;
  createdAt: string;
}

export type LedgerEntryType = "EXPENSE" | "INCOME" | "NOTE_PHOTO";
export type LedgerCategory =
  | "Nguyên liệu"
  | "Bao bì & Hộp"
  | "Vận chuyển / Ship"
  | "Vận hành / Điện nước"
  | "Doanh thu ngoài"
  | "Sổ ghi chép / Kiểm ca"
  | "Khác";

export interface LedgerEntry {
  id: string;
  code: string; // e.g. SS-1001
  type: LedgerEntryType;
  category: LedgerCategory;
  title: string;
  amount: number;
  paymentMethod: PaymentMethod;
  note?: string;
  imageUrl?: string; // Uploaded photo of invoice, receipt, or handwritten ledger book
  linkedOrderId?: string;
  createdAt: string;
}

export interface BrandColor {
  id: string;
  name: string;
  hex: string;
  usage: string;
}

export interface BrandKit {
  brandName: string;
  tagline: string;
  subTagline: string;
  brandStory: string;
  logoStyle: "ARCHED_STICKER" | "MASCOT_EMBLEM" | "MINIMAL_STAMP";
  mascotImage: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  bgColor: string;
  darkColor: string;
  headingFont: string;
  bodyFont: string;
  stickerNote: string;
  thankYouTitle: string;
  thankYouMessage: string;
  storageInstruction: string;
  promoHeadline: string;
  promoSubheadline: string;
  colors: BrandColor[];
}

export interface StoryFeatureItem {
  id: string;
  icon: "SPARKLES" | "TRUCK" | "SHIELD" | "HEART";
  title: string;
  description: string;
  enabled: boolean;
}

export interface MediaResourceItem {
  id: string;
  name: string;
  url: string;
  category: "LOGO" | "PRODUCT" | "BANNER";
}

export interface PageConfig {
  // Visibility Toggles
  showAnnouncementBar: boolean;
  showHeroSection: boolean;
  showHeroCollage: boolean;
  showMenuPosterButton: boolean;
  showMenuSection: boolean;
  showStorySection: boolean;
  showStoryPosterPreview: boolean;
  showFloatingZalo: boolean;
  showFloatingMessenger: boolean;
  showOwnerLinks: boolean;

  // Header & Hero Content
  headerLogoUrl: string;
  heroBadgeText: string;
  heroTitle: string;
  heroSubtitle: string;
  heroDescription: string;
  heroPrimaryCtaText: string;
  heroSecondaryCtaText: string;
  heroCollageTitle: string;
  heroCollageSubtitle: string;

  // Menu Section Content
  menuTitle: string;
  menuSubtitle: string;
  menuSearchPlaceholder: string;

  // Story Section Content
  storyBadgeText: string;
  storyTitle: string;
  storyDescription: string;
  storyFeatures: StoryFeatureItem[];

  // Footer Content
  footerDescription: string;

  // Authentication & Third-party integrations
  googleClientId?: string;

  // Managed Media Resources
  resources: MediaResourceItem[];
}

export interface ShopSettings {
  shopName: string;
  tagline: string;
  phone: string;
  zaloPhone: string;
  facebookUrl?: string;
  address: string;
  openHours: string;
  bankName: string;
  bankBin: string;
  bankAccountNo: string;
  bankAccountName: string;
  freeShipMinimum: number;
  defaultShippingFee: number;
  announcement: string;
  brandKit?: BrandKit;
  pageConfig?: PageConfig;
}

export interface ChatMessage {
  id: string;
  sender: "CUSTOMER" | "SHOP" | "BOT";
  text: string;
  createdAt: string;
}

export interface ChatSession {
  id: string;
  customerName: string;
  customerPhone?: string;
  unreadForAdmin: number;
  updatedAt: string;
  messages: ChatMessage[];
}

export interface CustomerUser {
  id: string; // e.g. "cust_google_12345678"
  googleId?: string;
  email: string;
  name: string;
  picture?: string;
  phone?: string;
  address?: string;
  deliveryNote?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface CustomerSession {
  user: CustomerUser;
  token: string;
}

export interface StoreDatabase {
  products: Product[];
  ingredients: IngredientItem[];
  stockLogs: StockLog[];
  orders: Order[];
  settings: ShopSettings;
  chats?: ChatSession[];
  ledger?: LedgerEntry[];
  customers?: CustomerUser[];
}
