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
  customerName: string;
  customerPhone: string;
  customerAddress?: string;
  note?: string;
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

export interface ShopSettings {
  shopName: string;
  tagline: string;
  phone: string;
  zaloPhone: string;
  address: string;
  openHours: string;
  bankName: string;
  bankBin: string;
  bankAccountNo: string;
  bankAccountName: string;
  freeShipMinimum: number;
  defaultShippingFee: number;
  announcement: string;
}

export interface StoreDatabase {
  products: Product[];
  ingredients: IngredientItem[];
  stockLogs: StockLog[];
  orders: Order[];
  settings: ShopSettings;
}
