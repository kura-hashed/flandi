import { NextResponse } from "next/server";
import { findCustomerById, getCustomerOrders } from "@/lib/db";
import { getCustomerTokenFromRequest, verifyCustomerToken, sanitizeString } from "@/lib/security";
import { getClientIp, publicApiRateLimiter, createRateLimitErrorResponse } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const ip = getClientIp(request);
    const rateLimit = publicApiRateLimiter.check(`cust-orders-${ip}`);
    if (!rateLimit.allowed) {
      return createRateLimitErrorResponse(rateLimit);
    }

    const { searchParams } = new URL(request.url);
    const queryCode = searchParams.get("code") ? sanitizeString(searchParams.get("code")!, 30) : undefined;
    const queryPhone = searchParams.get("phone") ? sanitizeString(searchParams.get("phone")!, 30) : undefined;

    // 1. Kiểm tra session đăng nhập nếu có
    const token = getCustomerTokenFromRequest(request);
    let customerId: string | undefined = undefined;
    let customerEmail: string | undefined = undefined;
    let customerPhone: string | undefined = undefined;

    if (token) {
      const verifiedId = verifyCustomerToken(token);
      if (verifiedId) {
        const customer = findCustomerById(verifiedId);
        if (customer) {
          customerId = customer.id;
          customerEmail = customer.email;
          customerPhone = customer.phone;
        }
      }
    }

    // 2. Nếu khách vãng lai không đăng nhập và không truyền mã/SĐT -> yêu cầu thông tin tra cứu
    if (!customerId && !queryCode && !queryPhone) {
      return NextResponse.json({
        authenticated: false,
        orders: [],
        message: "Vui lòng đăng nhập hoặc nhập số điện thoại / mã đơn để tra cứu",
      });
    }

    // 3. Tìm kiếm đơn hàng phù hợp
    const orders = getCustomerOrders({
      customerId,
      email: customerEmail,
      phone: queryPhone || customerPhone,
      code: queryCode,
    });

    return NextResponse.json({
      success: true,
      authenticated: Boolean(customerId),
      count: orders.length,
      orders,
    });
  } catch (error) {
    console.error("Customer orders lookup error:", error);
    return NextResponse.json(
      { error: "Lỗi tra cứu đơn hàng", details: String(error) },
      { status: 500 }
    );
  }
}
