import { NextResponse } from "next/server";
import {
  findCustomerById,
  upsertCustomer,
} from "@/lib/db";
import {
  CUSTOMER_COOKIE_NAME,
  generateCustomerToken,
  verifyCustomerToken,
  parseGoogleCredential,
  getCustomerTokenFromRequest,
  sanitizeString,
} from "@/lib/security";
import {
  customerAuthRateLimiter,
  createRateLimitErrorResponse,
  getClientIp,
  attachRateLimitHeaders,
} from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const token = getCustomerTokenFromRequest(request);
    if (!token) {
      return NextResponse.json({ authenticated: false, user: null });
    }

    const customerId = verifyCustomerToken(token);
    if (!customerId) {
      return NextResponse.json({ authenticated: false, user: null });
    }

    const customer = findCustomerById(customerId);
    if (!customer) {
      return NextResponse.json({ authenticated: false, user: null });
    }

    return NextResponse.json({
      authenticated: true,
      user: customer,
    });
  } catch (error) {
    console.error("Customer auth check error:", error);
    return NextResponse.json({ authenticated: false, user: null });
  }
}

export async function POST(request: Request) {
  try {
    const ip = getClientIp(request);
    const rateLimit = customerAuthRateLimiter.check(`cust-auth-${ip}`);
    if (!rateLimit.allowed) {
      return createRateLimitErrorResponse(rateLimit);
    }

    const body = await request.json().catch(() => ({}));
    let email = "";
    let name = "";
    let picture: string | undefined = undefined;
    let googleId: string | undefined = undefined;
    let phone: string | undefined = undefined;
    let address: string | undefined = undefined;

    // 1. Nếu có credential JWT từ Google Identity Services
    if (body.credential && typeof body.credential === "string") {
      const parsed = parseGoogleCredential(body.credential);
      if (parsed) {
        email = parsed.email;
        name = parsed.name;
        picture = parsed.picture;
        googleId = parsed.sub;
      }
    }

    // 2. Hoặc nhận trực tiếp từ client (Demo mode hoặc OAuth payload)
    if (!email && body.email) {
      email = sanitizeString(String(body.email), 120);
    }
    if (!name && body.name) {
      name = sanitizeString(String(body.name), 80);
    }
    if (!picture && body.picture) {
      picture = String(body.picture);
    }
    if (body.phone) {
      phone = sanitizeString(String(body.phone), 30);
    }
    if (body.address) {
      address = sanitizeString(String(body.address), 250);
    }

    if (!email || !email.includes("@")) {
      return NextResponse.json(
        { error: "Email Google không hợp lệ" },
        { status: 400 }
      );
    }

    if (!name) {
      name = email.split("@")[0];
    }

    // 3. Upsert khách hàng vào database
    const customer = upsertCustomer({
      email,
      name,
      picture,
      googleId,
      phone,
      address,
    });

    const token = generateCustomerToken(customer.id);
    const response = NextResponse.json({
      success: true,
      user: customer,
      token,
      message: "Đăng nhập Google thành công!",
    });

    // 4. Lưu session cookie
    response.cookies.set({
      name: CUSTOMER_COOKIE_NAME,
      value: token,
      httpOnly: false, // Để client script có thể xác thực khi cần
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 30 * 24 * 60 * 60, // 30 ngày
    });

    attachRateLimitHeaders(response.headers, rateLimit);
    return response;
  } catch (error) {
    console.error("Customer Google login error:", error);
    return NextResponse.json(
      { error: "Đăng nhập Google thất bại", details: String(error) },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  const response = NextResponse.json({
    success: true,
    message: "Đã đăng xuất tài khoản",
  });

  response.cookies.set({
    name: CUSTOMER_COOKIE_NAME,
    value: "",
    path: "/",
    maxAge: 0,
  });

  return response;
}
