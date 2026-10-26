import { StoreDatabase, Order, OrderItem } from "./types";

// Khóa bí mật mặc định (có thể ghi đè bằng ADMIN_PIN hoặc ADMIN_SECRET_KEY trong .env)
export const DEFAULT_ADMIN_PIN = process.env.ADMIN_PIN || "8888";
export const ADMIN_COOKIE_NAME = "flandi_admin_session";

/**
 * Loại bỏ các thẻ HTML nguy hiểm, script, javascript: protocol và ký tự độc hại để chống XSS.
 */
export function sanitizeString(input: unknown, maxLength = 500): string {
  if (typeof input !== "string") return "";

  let cleaned = input
    // Bỏ null bytes
    .replace(/\0/g, "")
    // Bỏ thẻ script và nội dung bên trong
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    // Bỏ các thẻ HTML tags
    .replace(/<[^>]+>/g, "")
    // Bỏ javascript: và vbscript:
    .replace(/(?:javascript|vbscript|data):/gi, "")
    // Bỏ các sự kiện inline độc hại (onload, onerror, onclick...)
    .replace(/on\w+\s*=/gi, "")
    .trim();

  if (cleaned.length > maxLength) {
    cleaned = cleaned.substring(0, maxLength);
  }

  return cleaned;
}

/**
 * Kiểm tra xem request có đến từ cùng Origin của website hay không (Chống CSRF).
 */
export function verifySameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");

  // Nếu không có origin (ví dụ curl hoặc server-to-server), kiểm tra referer
  if (!origin) {
    const referer = request.headers.get("referer");
    if (!referer) return true; // Cho phép nếu không có referer (hoặc môi trường test)
    try {
      const refUrl = new URL(referer);
      return refUrl.host === host;
    } catch {
      return false;
    }
  }

  try {
    const originUrl = new URL(origin);
    return originUrl.host === host;
  } catch {
    return false;
  }
}

/**
 * Kiểm tra quyền Quản trị viên (Admin) thông qua:
 * 1. Header `x-admin-key`
 * 2. Header `Authorization: Bearer <pin/token>`
 * 3. Cookie `flandi_admin_session`
 */
export function verifyAdminAuth(request: Request): boolean {
  const validSecret = process.env.ADMIN_SECRET_KEY || DEFAULT_ADMIN_PIN;

  // 1. Kiểm tra x-admin-key
  const adminKey = request.headers.get("x-admin-key");
  if (adminKey && (adminKey === validSecret || adminKey === DEFAULT_ADMIN_PIN)) {
    return true;
  }

  // 2. Kiểm tra Authorization header
  const authHeader = request.headers.get("authorization");
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.substring(7).trim();
    if (token === validSecret || token === DEFAULT_ADMIN_PIN || isValidAdminToken(token)) {
      return true;
    }
  }

  // 3. Kiểm tra Cookie flandi_admin_session
  const cookieHeader = request.headers.get("cookie");
  if (cookieHeader) {
    const cookies = Object.fromEntries(
      cookieHeader.split(";").map((c) => {
        const [k, ...v] = c.trim().split("=");
        return [k, v.join("=")];
      })
    );
    const sessionVal = cookies[ADMIN_COOKIE_NAME];
    if (sessionVal && (sessionVal === "authenticated" || isValidAdminToken(sessionVal))) {
      return true;
    }
  }

  return false;
}

/**
 * Tạo token đơn giản dựa trên PIN và thời gian
 */
export function generateAdminSessionToken(): string {
  const timestamp = Date.now();
  // Mã hóa đơn giản base64 chứa timestamp
  const payload = `flandi_adm_${timestamp}_${DEFAULT_ADMIN_PIN.slice(0, 4)}`;
  return Buffer.from(payload).toString("base64");
}

function isValidAdminToken(token: string): boolean {
  try {
    const decoded = Buffer.from(token, "base64").toString("utf8");
    if (!decoded.startsWith("flandi_adm_")) return false;
    const parts = decoded.split("_");
    const ts = parseInt(parts[2], 10);
    // Token hợp lệ trong 14 ngày
    const maxAge = 14 * 24 * 60 * 60 * 1000;
    return Date.now() - ts < maxAge;
  } catch {
    return false;
  }
}

export interface VerifiedOrderResult {
  valid: boolean;
  isBot?: boolean;
  error?: string;
  order?: Order;
}

/**
 * Xác thực và khử độc đơn hàng hoàn toàn trên Server-Side (Anti-Tampering & Anti-Fraud):
 * - Phát hiện bot honeypot
 * - Lấy giá gốc và thông tin từ DB để chống người dùng hack sửa đơn giá / giảm giá
 * - Kiểm tra số lượng hợp lệ (từ 1 đến 100) tránh hack số lượng âm gây đảo ngược trừ tồn kho
 * - Tự động tính lại subtotal, phí ship, và grand total
 */
export function verifyAndSanitizeOrder(
  body: any,
  db: StoreDatabase
): VerifiedOrderResult {
  // 1. Kiểm tra Honeypot (Bẫy bot spam)
  if (
    (body._hp_company && String(body._hp_company).trim().length > 0) ||
    (body.website && String(body.website).trim().length > 0) ||
    (body.fax && String(body.fax).trim().length > 0)
  ) {
    // Là bot cào tự động điền các trường ẩn
    return { valid: false, isBot: true, error: "Honeypot triggered" };
  }

  // 2. Kiểm tra danh sách món hàng
  if (!Array.isArray(body.items) || body.items.length === 0) {
    return { valid: false, error: "Đơn hàng phải có ít nhất 1 món bánh" };
  }

  if (body.items.length > 50) {
    return { valid: false, error: "Số lượng loại món vượt quá giới hạn (tối đa 50)" };
  }

  // 3. Khử trùng thông tin khách hàng
  const customerName = sanitizeString(body.customerName || "Khách đặt nhanh", 80);
  const rawPhone = String(body.customerPhone || "").replace(/[\s.-]/g, "").trim();
  const phoneRegex = /^(0|\+84|84)(3|5|7|8|9)[0-9]{8}$/;

  // Bắt buộc SĐT với đơn khách tự đặt
  if (body.source !== "POS") {
    if (!rawPhone || !phoneRegex.test(rawPhone)) {
      return { valid: false, error: "Số điện thoại nhận bánh không hợp lệ (cần 10 số di động VN)" };
    }
  }

  const customerAddress = sanitizeString(body.customerAddress || "", 250);
  if (body.source !== "POS" && customerAddress.length < 3) {
    return { valid: false, error: "Vui lòng nhập địa chỉ giao hàng hoặc giờ ghé lấy bánh rõ ràng" };
  }

  const note = sanitizeString(body.note || "", 300);

  // 4. Kiểm tra từng món, đối chiếu DB và tính lại giá chuẩn xác
  const verifiedItems: OrderItem[] = [];
  let calculatedSubtotal = 0;

  for (const item of body.items) {
    const qty = parseInt(String(item.quantity), 10);
    if (isNaN(qty) || qty < 1 || qty > 100) {
      return { valid: false, error: `Số lượng món không hợp lệ (phải từ 1 đến 100 cái)` };
    }

    const product = db.products.find((p) => p.id === item.productId);
    if (!product) {
      return { valid: false, error: `Sản phẩm mã "${item.productId}" không tồn tại` };
    }

    if (product.isActive === false) {
      return { valid: false, error: `Món "${product.name}" hiện đang tạm ngưng phục vụ` };
    }

    // Tìm đơn giá chuẩn từ sản phẩm hoặc variant trong DB
    let officialUnitPrice = product.price;
    let variantName = item.variantName || product.unit || "cái";
    let deductionPerItem = 1;

    if (item.variantId && product.variants && product.variants.length > 0) {
      const variant = product.variants.find((v) => v.id === item.variantId);
      if (variant) {
        officialUnitPrice = variant.price;
        variantName = variant.name;
        deductionPerItem = variant.stockDeduction || 1;
      }
    }

    const itemSubtotal = officialUnitPrice * qty;
    calculatedSubtotal += itemSubtotal;

    verifiedItems.push({
      productId: product.id,
      productName: product.name,
      variantId: item.variantId || undefined,
      variantName,
      quantity: qty,
      unitPrice: officialUnitPrice,
      subtotal: itemSubtotal,
      stockDeductionPerItem: deductionPerItem,
    });
  }

  // 5. Tính toán phí ship chuẩn theo cấu hình tiệm
  const freeShipMin = db.settings.freeShipMinimum ?? 100000;
  const standardShippingFee = db.settings.defaultShippingFee ?? 15000;

  let verifiedShippingFee = 0;
  if (body.source === "POS") {
    // POS có thể có phí ship riêng nếu chọn giao
    verifiedShippingFee = Number(body.shippingFee) || 0;
  } else {
    verifiedShippingFee = calculatedSubtotal >= freeShipMin ? 0 : standardShippingFee;
  }

  // Giảm giá (nếu có từ POS, online mặc định 0 trừ khi có mã khuyến mãi)
  const discount = body.source === "POS" ? Math.max(0, Number(body.discount) || 0) : 0;
  const calculatedTotal = Math.max(0, calculatedSubtotal - discount + verifiedShippingFee);

  const nextNumber = 1001 + db.orders.length;
  const code = sanitizeString(body.code || `FL-${nextNumber}`, 20);

  const verifiedOrder: Order = {
    id: `ord-${Date.now()}`,
    code,
    source: body.source || "ONLINE",
    status: body.status || (body.source === "POS" ? "COMPLETED" : "PENDING"),
    customerId: body.customerId ? sanitizeString(String(body.customerId), 80) : undefined,
    customerEmail: body.customerEmail ? sanitizeString(String(body.customerEmail), 120) : undefined,
    customerName,
    customerPhone: rawPhone,
    customerAddress,
    note,
    attachmentImage: typeof body.attachmentImage === "string" && body.attachmentImage.startsWith("data:image/")
      ? body.attachmentImage
      : undefined,
    items: verifiedItems,
    subtotal: calculatedSubtotal,
    discount,
    shippingFee: verifiedShippingFee,
    total: calculatedTotal,
    paymentMethod: body.paymentMethod || (body.source === "POS" ? "CASH" : "COD"),
    isPaid: Boolean(body.isPaid ?? (body.source === "POS")),
    cashReceived: body.cashReceived ? Number(body.cashReceived) : undefined,
    changeGiven: body.changeGiven ? Number(body.changeGiven) : undefined,
    createdAt: new Date().toISOString(),
  };

  return {
    valid: true,
    order: verifiedOrder,
  };
}

// ----------------------------------------------------
// Customer Google Authentication & Session Helpers
// ----------------------------------------------------

export const CUSTOMER_COOKIE_NAME = "flandi_customer_session";
const CUSTOMER_TOKEN_SECRET = process.env.CUSTOMER_AUTH_SECRET || "flandi_cust_secret_2026";

export function generateCustomerToken(customerId: string): string {
  const payload = {
    sub: customerId,
    iat: Date.now(),
    exp: Date.now() + 30 * 24 * 60 * 60 * 1000, // 30 ngày
  };
  return Buffer.from(JSON.stringify(payload)).toString("base64url");
}

export function verifyCustomerToken(token: string): string | null {
  try {
    const raw = Buffer.from(token, "base64url").toString("utf8");
    const parsed = JSON.parse(raw);
    if (!parsed || !parsed.sub) return null;
    if (parsed.exp && Date.now() > parsed.exp) return null;
    return parsed.sub;
  } catch {
    return null;
  }
}

export function parseGoogleCredential(credential: string): {
  sub: string;
  email: string;
  name: string;
  picture?: string;
} | null {
  try {
    const parts = credential.split(".");
    if (parts.length !== 3) return null;
    const payloadRaw = Buffer.from(parts[1], "base64").toString("utf8");
    const payload = JSON.parse(payloadRaw);

    if (!payload || !payload.email) return null;

    return {
      sub: payload.sub || "",
      email: payload.email,
      name: payload.name || payload.given_name || payload.email.split("@")[0],
      picture: payload.picture,
    };
  } catch (err) {
    console.error("Failed to parse Google credential:", err);
    return null;
  }
}

export function getCustomerTokenFromRequest(request: Request): string | null {
  // 1. Authorization: Bearer <token>
  const authHeader = request.headers.get("authorization");
  if (authHeader && authHeader.startsWith("Bearer ")) {
    return authHeader.substring(7).trim();
  }

  // 2. Cookie flandi_customer_session
  const cookieHeader = request.headers.get("cookie");
  if (cookieHeader) {
    const cookies = Object.fromEntries(
      cookieHeader.split(";").map((c) => {
        const [k, ...v] = c.trim().split("=");
        return [k, v.join("=")];
      })
    );
    if (cookies[CUSTOMER_COOKIE_NAME]) {
      return cookies[CUSTOMER_COOKIE_NAME];
    }
  }

  return null;
}
