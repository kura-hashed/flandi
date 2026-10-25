import { NextResponse } from "next/server";
import {
  DEFAULT_ADMIN_PIN,
  ADMIN_COOKIE_NAME,
  generateAdminSessionToken,
  verifyAdminAuth,
} from "@/lib/security";
import {
  adminAuthRateLimiter,
  createRateLimitErrorResponse,
  getClientIp,
} from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const isAuthenticated = verifyAdminAuth(request);
  return NextResponse.json({ authenticated: isAuthenticated });
}

export async function POST(request: Request) {
  try {
    const ip = getClientIp(request);

    // 1. Kiểm tra Rate Limiting chống Brute-Force PIN
    const rateLimitCheck = adminAuthRateLimiter.check(`auth-${ip}`);
    if (!rateLimitCheck.allowed) {
      return createRateLimitErrorResponse(rateLimitCheck);
    }

    const body = await request.json();
    const pin = String(body.pin || "").trim();

    const expectedPin = process.env.ADMIN_PIN || DEFAULT_ADMIN_PIN;

    if (!pin || pin !== expectedPin) {
      return NextResponse.json(
        {
          error: "Mã PIN bảo mật không đúng! Vui lòng thử lại.",
          remainingAttempts: rateLimitCheck.remaining,
        },
        { status: 401 }
      );
    }

    // Đăng nhập thành công -> Reset rate limit cho IP này
    adminAuthRateLimiter.reset(`auth-${ip}`);

    const token = generateAdminSessionToken();
    const response = NextResponse.json({
      success: true,
      message: "Xác thực quản trị viên thành công!",
      token,
    });

    // Thiết lập cookie an toàn
    response.cookies.set({
      name: ADMIN_COOKIE_NAME,
      value: token,
      httpOnly: false, // Để client script có thể đọc được kiểm tra trạng thái
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 14 * 24 * 60 * 60, // 14 ngày
    });

    return response;
  } catch (error) {
    return NextResponse.json(
      { error: "Lỗi xử lý xác thực", details: String(error) },
      { status: 500 }
    );
  }
}

export async function DELETE() {
  const response = NextResponse.json({
    success: true,
    message: "Đã đăng xuất khỏi tài khoản quản trị.",
  });

  response.cookies.delete(ADMIN_COOKIE_NAME);
  return response;
}
