import { Product, ProductVariant } from "./types";

export interface ParsedItemMatch {
  product: Product;
  variant: ProductVariant;
  quantity: number;
  matchedText: string;
  confidence: "HIGH" | "MEDIUM" | "LOW";
}

export interface ParsedOrderResult {
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  note: string;
  items: ParsedItemMatch[];
  unmatchedLines: string[];
  rawText: string;
}

/**
 * Chuẩn hóa chuỗi tiếng Việt: bỏ dấu, viết thường, loại bỏ ký tự lạ để so khớp
 */
export function normalizeVietnamese(str: string): string {
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Trích xuất số điện thoại di động Việt Nam (10 số, bắt đầu bằng 03, 05, 07, 08, 09 hoặc +84)
 */
export function extractPhone(text: string): string {
  const match = text.match(/(?:\+84|84|0)\s*(3|5|7|8|9)(?:[\s.-]*\d){8}\b/);
  if (match) {
    let cleaned = match[0].replace(/[\s.-]/g, "");
    if (cleaned.startsWith("+84")) cleaned = "0" + cleaned.slice(3);
    else if (cleaned.startsWith("84")) cleaned = "0" + cleaned.slice(2);
    return cleaned;
  }
  return "";
}

/**
 * Phân tích nội dung đơn hàng từ ảnh OCR / tin nhắn chat thành các trường dữ liệu POS
 */
export function parseOrderText(
  rawText: string,
  products: Product[]
): ParsedOrderResult {
  const result: ParsedOrderResult = {
    customerName: "",
    customerPhone: "",
    customerAddress: "",
    note: "",
    items: [],
    unmatchedLines: [],
    rawText,
  };

  if (!rawText.trim() || !products || products.length === 0) {
    return result;
  }

  // 1. Trích xuất số điện thoại
  result.customerPhone = extractPhone(rawText);

  // 2. Tách từng dòng để phân tích
  const rawLines = rawText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const pendingItemLines: string[] = [];

  for (const line of rawLines) {
    const normLine = normalizeVietnamese(line);

    // Bỏ qua các dòng tiêu đề chung / footer của tiệm
    if (
      normLine.includes("tiem banh flandi") ||
      normLine.includes("muon an hay flan") ||
      normLine.includes("da chon") ||
      normLine.includes("thanh tien") ||
      normLine.includes("tam tinh") ||
      normLine.includes("phi ship") ||
      normLine.includes("tong cong") ||
      normLine.includes("freeship") ||
      normLine.includes("sl thanh tien") ||
      normLine.includes("sl don gia") ||
      normLine.startsWith("----") ||
      normLine.startsWith("====")
    ) {
      continue;
    }

    // Nhận diện Tên khách hàng
    if (
      !result.customerName &&
      (normLine.includes("khach") ||
        normLine.includes("nguoi nhan") ||
        normLine.includes("ten") ||
        normLine.startsWith("c ") ||
        normLine.startsWith("a ") ||
        normLine.startsWith("chi ") ||
        normLine.startsWith("anh ") ||
        normLine.startsWith("ban "))
    ) {
      const namePart = line
        .replace(/^.*?(?:khách|người nhận|tên|khach|nguoi nhan|ten)\s*[:\-]\s*/i, "")
        .replace(/(?:sđt|sdt|tel|phone|đ\/c|dc|địa chỉ|dia chỉ|dia chi).*$/i, "")
        .replace(/[\s\-,;:]+$/, "")
        .trim();
      if (namePart && namePart.length >= 2 && namePart.length <= 50) {
        result.customerName = namePart;
        continue;
      }
    }

    // Nhận diện Địa chỉ giao hàng
    if (
      !result.customerAddress &&
      (normLine.includes("dia chi") ||
        normLine.includes("giao den") ||
        normLine.includes("noi nhan") ||
        normLine.includes("d c") ||
        normLine.includes("dc") ||
        normLine.includes("duong") ||
        normLine.includes("phuong") ||
        normLine.includes("quan") ||
        normLine.includes("tp hcm"))
    ) {
      const addrPart = line
        .replace(/^.*?(?:địa chỉ|dia chỉ|dia chi|giao đến|giao den|nơi nhận|noi nhan|đ\/c|dc)\s*[:\-]\s*/i, "")
        .replace(/[\s\-,;:]+$/, "")
        .trim();
      if (addrPart && addrPart.length >= 5) {
        result.customerAddress = addrPart;
        continue;
      }
    }

    // Nhận diện Ghi chú
    if (
      !result.note &&
      (normLine.includes("ghi chu") ||
        normLine.includes("luu y") ||
        normLine.includes("it da") ||
        normLine.includes("nhieu da") ||
        normLine.includes("giao luc") ||
        normLine.includes("lay muong"))
    ) {
      const notePart = line
        .replace(/^.*?(?:ghi chú|ghi chu|lưu ý|luu y|note)\s*[:\-]\s*/i, "")
        .trim();
      result.note = notePart || line;
      continue;
    }

    // Nếu không phải metadata, cho vào danh sách dòng có khả năng chứa món
    pendingItemLines.push(line);
  }

  // Nếu dòng chưa tách mà người dùng gõ kiểu phẩy "1 flan, 2 panna, 3 rau cau"
  const itemCandidateSegments: string[] = [];
  for (const line of pendingItemLines) {
    if (line.includes(",") || line.includes(";")) {
      const parts = line.split(/[,;]+/).map((p) => p.trim()).filter(Boolean);
      itemCandidateSegments.push(...parts);
    } else {
      itemCandidateSegments.push(line);
    }
  }

  // 3. Phân tích từng dòng/phân đoạn để tìm món và số lượng
  for (const segment of itemCandidateSegments) {
    const norm = normalizeVietnamese(segment);
    if (!norm) continue;

    // Tìm số lượng
    let quantity = 1;
    let isChuc = norm.includes("chuc") || norm.includes("hop 10") || norm.includes("10 cai");
    let isSet5 = norm.includes("set 5") || norm.includes("5 cai");

    // Thử bắt các mẫu: "10 cai", "10x", "x 10", "1 chuc", "10.", "1."
    const qtyLeading = norm.match(/^(\d+)\s*(?:cai|hop|hu|phan|x|\.|\-|\:)/);
    const qtyTrailing = norm.match(/(?:x|\:|\-)?\s*(\d+)\s*(?:cai|hop|hu|phan)?\s*$/);
    const qtyInline = norm.match(/(?:^|\s)(\d+)(?:\s*(?:cai|hop|hu|phan|chuc)|\s*(?:x)\s*|\s*$)/);

    if (qtyLeading) {
      quantity = parseInt(qtyLeading[1], 10);
    } else if (qtyInline) {
      quantity = parseInt(qtyInline[1], 10);
    } else if (qtyTrailing) {
      quantity = parseInt(qtyTrailing[1], 10);
    }

    if (isNaN(quantity) || quantity <= 0) quantity = 1;

    // Tìm sản phẩm khớp nhất
    let matchedProduct: Product | null = null;
    let preferredVariantKeyword = "";

    // Phân loại ưu tiên:
    // 1. Rau Câu Flan vs Rau Câu Dừa vs Rau Câu Lá
    if (norm.includes("rau cau flan") || (norm.includes("rau cau") && norm.includes("flan"))) {
      matchedProduct = products.find((p) => p.id === "prod-rau-cau-flan") || null;
    } else if (norm.includes("rau cau la") || (norm.includes("la dua") && norm.includes("ca phe"))) {
      matchedProduct = products.find((p) => p.id === "prod-rau-cau-la") || null;
    } else if (norm.includes("rau cau") || norm.includes("dua") || norm.includes("thach dua")) {
      matchedProduct = products.find((p) => p.id === "prod-rau-cau-dua") || null;
    } else if (norm.includes("panna")) {
      matchedProduct = products.find((p) => p.id === "prod-panna-cotta") || null;
      if (norm.includes("chanh day") || norm.includes("chanh")) preferredVariantKeyword = "chanh";
      else if (norm.includes("viet quat") || norm.includes("quat")) preferredVariantKeyword = "việt quất";
      else if (norm.includes("dao")) preferredVariantKeyword = "đào";
      else if (norm.includes("dau")) preferredVariantKeyword = "dâu";
    } else if (norm.includes("tau hu") || norm.includes("tao pho") || norm.includes("dau hu")) {
      matchedProduct = products.find((p) => p.id === "prod-tau-hu") || null;
      if (norm.includes("la dua") || norm.includes("pandan")) preferredVariantKeyword = "lá dứa";
    } else if (norm.includes("yogurt") || norm.includes("sua chua") || norm.includes("yaourt")) {
      matchedProduct = products.find((p) => p.id === "prod-yogurt") || null;
    } else if (norm.includes("flan") || norm.includes("banh flan")) {
      matchedProduct = products.find((p) => p.id === "prod-flan") || null;
    }

    if (matchedProduct && matchedProduct.variants.length > 0) {
      let matchedVariant = matchedProduct.variants[0];

      if (preferredVariantKeyword) {
        const found = matchedProduct.variants.find((v) =>
          normalizeVietnamese(v.name).includes(normalizeVietnamese(preferredVariantKeyword))
        );
        if (found) matchedVariant = found;
      }

      // Xử lý đơn vị "chục" hoặc "hộp 10" nếu variant có cấu hình chục
      const chucVariant = matchedProduct.variants.find(
        (v) =>
          normalizeVietnamese(v.name).includes("chuc") ||
          normalizeVietnamese(v.unitLabel).includes("chuc") ||
          v.stockDeduction === 10
      );

      if (isChuc && chucVariant) {
        matchedVariant = chucVariant;
      }

      result.items.push({
        product: matchedProduct,
        variant: matchedVariant,
        quantity,
        matchedText: segment,
        confidence: "HIGH",
      });
    } else {
      // Dòng không khớp món
      if (norm.length > 2 && !norm.match(/^\d+$/)) {
        result.unmatchedLines.push(segment);
      }
    }
  }

  return result;
}
