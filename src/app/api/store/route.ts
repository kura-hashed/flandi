import { NextResponse } from "next/server";
import { readDb, writeDb } from "@/lib/db";
import {
  getClientIp,
  publicApiRateLimiter,
  adminApiRateLimiter,
  createRateLimitErrorResponse,
  attachRateLimitHeaders,
} from "@/lib/rate-limit";
import { verifyAdminAuth, sanitizeString } from "@/lib/security";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const ip = getClientIp(request);
  const rateLimit = publicApiRateLimiter.check(`store-get-${ip}`);
  if (!rateLimit.allowed) {
    return createRateLimitErrorResponse(rateLimit);
  }

  const db = readDb();
  const response = NextResponse.json(db);
  attachRateLimitHeaders(response.headers, rateLimit);
  return response;
}

export async function PUT(request: Request) {
  try {
    const ip = getClientIp(request);

    // 1. Bắt buộc quyền Quản trị viên khi thay đổi cài đặt cửa hàng
    if (!verifyAdminAuth(request)) {
      return NextResponse.json(
        { error: "Yêu cầu quyền quản trị viên (Admin authentication required)" },
        { status: 401 }
      );
    }

    // 2. Rate limit quản trị
    const rateLimit = adminApiRateLimiter.check(`store-put-${ip}`);
    if (!rateLimit.allowed) {
      return createRateLimitErrorResponse(rateLimit);
    }

    const body = await request.json();
    const db = readDb();

    if (body.settings) {
      // Khử trùng các trường văn bản quan trọng
      const s = body.settings;
      if (s.name) s.name = sanitizeString(s.name, 100);
      if (s.tagline) s.tagline = sanitizeString(s.tagline, 200);
      if (s.phone) s.phone = sanitizeString(s.phone, 30);
      if (s.zaloPhone) s.zaloPhone = sanitizeString(s.zaloPhone, 30);
      if (s.address) s.address = sanitizeString(s.address, 250);
      if (s.qrAccountNo) s.qrAccountNo = sanitizeString(s.qrAccountNo, 50);
      if (s.qrAccountName) s.qrAccountName = sanitizeString(s.qrAccountName, 100);
      if (s.qrBank) s.qrBank = sanitizeString(s.qrBank, 50);

      db.settings = { ...db.settings, ...s };
    }

    writeDb(db);
    const response = NextResponse.json(db);
    attachRateLimitHeaders(response.headers, rateLimit);
    return response;
  } catch (error) {
    return NextResponse.json(
      { error: "Không thể cập nhật cấu hình tiệm", details: String(error) },
      { status: 400 }
    );
  }
}
