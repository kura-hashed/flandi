import { NextResponse } from "next/server";

export interface RateLimitRule {
  name: string;
  windowMs: number;
  maxRequests: number;
  message?: string;
}

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  reset: number;
  retryAfter: number;
  message: string;
}

interface ClientRecord {
  timestamps: number[];
  lastSeen: number;
}

/**
 * Lấy IP client thực tế một cách an toàn từ headers (hỗ trợ Cloudflare, Reverse Proxy, Vercel).
 */
export function getClientIp(request: Request): string {
  // 1. Cloudflare header
  const cfIp = request.headers.get("cf-connecting-ip");
  if (cfIp) {
    const clean = cfIp.trim().split(",")[0].trim();
    if (clean) return clean;
  }

  // 2. Nginx / reverse proxy real IP
  const realIp = request.headers.get("x-real-ip");
  if (realIp) {
    const clean = realIp.trim().split(",")[0].trim();
    if (clean) return clean;
  }

  // 3. X-Forwarded-For: Client IP là IP đầu tiên bên trái
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    const firstIp = forwardedFor.split(",")[0].trim();
    // Bỏ qua port nếu có (e.g. 192.168.1.1:12345)
    const clean = firstIp.replace(/:\d+$/, "");
    if (clean) return clean;
  }

  return "127.0.0.1";
}

/**
 * Sliding Window Rate Limiter lưu trữ trong bộ nhớ với khả năng tự dọn dẹp (auto-purge).
 */
export class SlidingWindowRateLimiter {
  private store: Map<string, ClientRecord> = new Map();
  private rules: RateLimitRule[];
  private maxEntries: number;

  constructor(rules: RateLimitRule[], maxEntries = 10000) {
    this.rules = rules;
    this.maxEntries = maxEntries;

    // Định kỳ dọn dẹp mỗi 60 giây nếu môi trường hỗ trợ setInterval
    if (typeof setInterval !== "undefined") {
      setInterval(() => this.purgeExpired(), 60000).unref?.();
    }
  }

  public check(identifier: string): RateLimitResult {
    const now = Date.now();
    let record = this.store.get(identifier);

    if (!record) {
      if (this.store.size >= this.maxEntries) {
        this.purgeExpired();
      }
      record = { timestamps: [], lastSeen: now };
      this.store.set(identifier, record);
    }

    record.lastSeen = now;

    // Tính toán cửa sổ thời gian lớn nhất cần giữ
    const maxWindowMs = Math.max(...this.rules.map((r) => r.windowMs));
    record.timestamps = record.timestamps.filter((ts) => now - ts < maxWindowMs);

    // Kiểm tra từng rule
    for (const rule of this.rules) {
      const windowStart = now - rule.windowMs;
      const countInWindow = record.timestamps.filter((ts) => ts >= windowStart).length;

      if (countInWindow >= rule.maxRequests) {
        // Tìm timestamp cũ nhất trong window để tính retryAfter
        const oldestInWindow = record.timestamps.find((ts) => ts >= windowStart) || now;
        const retryAfterSec = Math.max(
          1,
          Math.ceil((oldestInWindow + rule.windowMs - now) / 1000)
        );
        const resetTimestamp = Math.ceil((oldestInWindow + rule.windowMs) / 1000);

        return {
          allowed: false,
          limit: rule.maxRequests,
          remaining: 0,
          reset: resetTimestamp,
          retryAfter: retryAfterSec,
          message:
            rule.message ||
            `Quá nhiều yêu cầu. Vui lòng thử lại sau ${retryAfterSec} giây.`,
        };
      }
    }

    // Nếu đạt yêu cầu, ghi nhận timestamp mới
    record.timestamps.push(now);

    const primaryRule = this.rules[0];
    const countInPrimary = record.timestamps.filter(
      (ts) => ts >= now - primaryRule.windowMs
    ).length;
    const remaining = Math.max(0, primaryRule.maxRequests - countInPrimary);
    const reset = Math.ceil((now + primaryRule.windowMs) / 1000);

    return {
      allowed: true,
      limit: primaryRule.maxRequests,
      remaining,
      reset,
      retryAfter: 0,
      message: "OK",
    };
  }

  private purgeExpired() {
    const now = Date.now();
    const maxWindowMs = Math.max(...this.rules.map((r) => r.windowMs));

    for (const [key, record] of this.store.entries()) {
      record.timestamps = record.timestamps.filter((ts) => now - ts < maxWindowMs);
      if (record.timestamps.length === 0 && now - record.lastSeen > maxWindowMs) {
        this.store.delete(key);
      }
    }
  }

  public reset(identifier: string) {
    this.store.delete(identifier);
  }
}

// ----------------------------------------------------
// Cấu hình các bộ Rate Limiter chuyên biệt cho từng dịch vụ
// ----------------------------------------------------

/**
 * Rate Limiter cho Đặt Hàng (/api/orders):
 * - Giới hạn ngắn: Tối đa 5 đơn / 1 phút (chống spam click)
 * - Giới hạn dài: Tối đa 15 đơn / 10 phút (chống cạn kiệt tồn kho / stock-locking attack)
 */
export const orderRateLimiter = new SlidingWindowRateLimiter([
  {
    name: "orders-burst",
    windowMs: 60 * 1000,
    maxRequests: 5,
    message: "Bạn đang đặt đơn quá nhanh! Vui lòng đợi 1 phút trước khi gửi tiếp.",
  },
  {
    name: "orders-sustained",
    windowMs: 10 * 60 * 1000,
    maxRequests: 15,
    message: "Bạn đã gửi quá nhiều đơn hàng trong thời gian ngắn. Vui lòng liên hệ hotline/Zalo của tiệm.",
  },
]);

/**
 * Rate Limiter cho Tin Nhắn Khách Hàng (/api/chat):
 * - Giới hạn ngắn: Tối đa 10 tin nhắn / 1 phút
 * - Giới hạn dài: Tối đa 30 tin nhắn / 5 phút
 */
export const chatRateLimiter = new SlidingWindowRateLimiter([
  {
    name: "chat-burst",
    windowMs: 60 * 1000,
    maxRequests: 10,
    message: "Bạn gửi tin nhắn quá nhanh. Vui lòng đợi ít giây rồi gửi lại nha!",
  },
  {
    name: "chat-sustained",
    windowMs: 5 * 60 * 1000,
    maxRequests: 30,
    message: "Hộp thoại tạm thời quá tải tin nhắn từ bạn. Vui lòng đợi vài phút.",
  },
]);

/**
 * Rate Limiter cho Xác thực Admin PIN (/api/auth):
 * - Chống Brute Force: Tối đa 5 lần thử sai / 15 phút
 */
export const adminAuthRateLimiter = new SlidingWindowRateLimiter([
  {
    name: "admin-auth",
    windowMs: 15 * 60 * 1000,
    maxRequests: 5,
    message: "Đã nhập sai mã PIN quá 5 lần. Tạm khóa xác thực quản trị viên trong 15 phút.",
  },
]);

/**
 * Rate Limiter cho Thao tác Quản trị & Write API:
 * - Tối đa 60 requests / 1 phút
 */
export const adminApiRateLimiter = new SlidingWindowRateLimiter([
  {
    name: "admin-api",
    windowMs: 60 * 1000,
    maxRequests: 60,
    message: "Thao tác quản trị quá nhanh, vui lòng chờ giây lát.",
  },
]);

/**
 * Rate Limiter cho Đăng nhập Khách Hàng (/api/customer/auth):
 * - Tối đa 20 yêu cầu / 1 phút
 */
export const customerAuthRateLimiter = new SlidingWindowRateLimiter([
  {
    name: "customer-auth",
    windowMs: 60 * 1000,
    maxRequests: 20,
    message: "Bạn đang thao tác quá nhanh, vui lòng chờ giây lát.",
  },
]);

/**
 * Rate Limiter cho Public API & Scraper:
 * - Tối đa 120 requests / 1 phút
 */
export const publicApiRateLimiter = new SlidingWindowRateLimiter([
  {
    name: "public-api",
    windowMs: 60 * 1000,
    maxRequests: 120,
    message: "Quá nhiều yêu cầu đọc dữ liệu từ thiết bị của bạn.",
  },
]);

/**
 * Helper tạo HTTP 429 response chuẩn RFC 6585
 */
export function createRateLimitErrorResponse(result: RateLimitResult): NextResponse {
  return NextResponse.json(
    {
      error: result.message,
      code: "RATE_LIMIT_EXCEEDED",
      retryAfter: result.retryAfter,
    },
    {
      status: 429,
      headers: {
        "Retry-After": String(result.retryAfter),
        "X-RateLimit-Limit": String(result.limit),
        "X-RateLimit-Remaining": "0",
        "X-RateLimit-Reset": String(result.reset),
      },
    }
  );
}

/**
 * Helper đính kèm Rate Limit headers vào response thành công
 */
export function attachRateLimitHeaders(
  headers: Headers,
  result: RateLimitResult
): void {
  headers.set("X-RateLimit-Limit", String(result.limit));
  headers.set("X-RateLimit-Remaining", String(result.remaining));
  headers.set("X-RateLimit-Reset", String(result.reset));
}
