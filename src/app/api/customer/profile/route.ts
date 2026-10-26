import { NextResponse } from "next/server";
import { findCustomerById, updateCustomerProfile } from "@/lib/db";
import {
  getCustomerTokenFromRequest,
  verifyCustomerToken,
  sanitizeString,
} from "@/lib/security";
import { getClientIp, customerAuthRateLimiter, createRateLimitErrorResponse } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const token = getCustomerTokenFromRequest(request);
  if (!token) {
    return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
  }

  const customerId = verifyCustomerToken(token);
  if (!customerId) {
    return NextResponse.json({ error: "Phiên đăng nhập hết hạn" }, { status: 401 });
  }

  const customer = findCustomerById(customerId);
  if (!customer) {
    return NextResponse.json({ error: "Không tìm thấy khách hàng" }, { status: 404 });
  }

  return NextResponse.json({ user: customer });
}

export async function PATCH(request: Request) {
  try {
    const ip = getClientIp(request);
    const rateLimit = customerAuthRateLimiter.check(`cust-profile-${ip}`);
    if (!rateLimit.allowed) {
      return createRateLimitErrorResponse(rateLimit);
    }

    const token = getCustomerTokenFromRequest(request);
    if (!token) {
      return NextResponse.json({ error: "Vui lòng đăng nhập để cập nhật thông tin" }, { status: 401 });
    }

    const customerId = verifyCustomerToken(token);
    if (!customerId) {
      return NextResponse.json({ error: "Phiên đăng nhập không hợp lệ" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const updates: Record<string, string> = {};

    if (typeof body.name === "string" && body.name.trim()) {
      updates.name = sanitizeString(body.name, 80);
    }

    if (typeof body.phone === "string") {
      const cleanPhone = body.phone.replace(/[\s.-]/g, "").trim();
      updates.phone = sanitizeString(cleanPhone, 20);
    }

    if (typeof body.address === "string") {
      updates.address = sanitizeString(body.address, 250);
    }

    if (typeof body.deliveryNote === "string") {
      updates.deliveryNote = sanitizeString(body.deliveryNote, 250);
    }

    const updatedCustomer = updateCustomerProfile(customerId, updates);
    if (!updatedCustomer) {
      return NextResponse.json({ error: "Không tìm thấy hồ sơ khách hàng" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message: "Cập nhật thông tin giao hàng thành công!",
      user: updatedCustomer,
    });
  } catch (error) {
    console.error("Profile update error:", error);
    return NextResponse.json(
      { error: "Lỗi cập nhật thông tin", details: String(error) },
      { status: 500 }
    );
  }
}
