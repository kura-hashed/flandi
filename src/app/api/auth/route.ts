import { NextResponse } from "next/server";
import { appendAuditLog, readDb, upsertUserWithRole, writeDb } from "@/lib/db";
import { getPermissionsForRole } from "@/lib/rbac";
import {
  DEFAULT_ADMIN_PIN,
  ADMIN_COOKIE_NAME,
  generateAdminSessionToken,
  resolveRequestActor,
  verifySameOrigin,
} from "@/lib/security";
import {
  adminAuthRateLimiter,
  createRateLimitErrorResponse,
  getClientIp,
} from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const db = readDb();
  const actor = resolveRequestActor(request, db);
  const canAccessPortal =
    actor.permissions.includes("orders:manage") ||
    actor.permissions.includes("store:manage") ||
    actor.permissions.includes("users:manage");

  return NextResponse.json({
    authenticated: canAccessPortal,
    role: actor.role,
    authMethod: actor.authMethod,
    isPinAdmin: actor.isPinAdmin,
    permissions: actor.permissions,
    user: actor.user,
  });
}

export async function POST(request: Request) {
  try {
    if (!verifySameOrigin(request)) {
      return NextResponse.json({ error: "Nguồn gốc không hợp lệ" }, { status: 403 });
    }

    const ip = getClientIp(request);

    // 1. Kiểm tra Rate Limiting chống Brute-Force PIN
    const rateLimitCheck = adminAuthRateLimiter.check(`auth-${ip}`);
    if (!rateLimitCheck.allowed) {
      return createRateLimitErrorResponse(rateLimitCheck);
    }

    const body = await request.json().catch(() => ({}));
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

    const db = readDb();
    const currentActor = resolveRequestActor(request, db);
    let promotedUser = currentActor.user;

    // Tiện ích: Nếu chủ tiệm đang đăng nhập Google và chọn nâng tài khoản hiện tại lên Admin khi nhập PIN
    if (body.promoteCurrentUser && currentActor.user) {
      const res = upsertUserWithRole(db, {
        email: currentActor.user.email,
        name: currentActor.user.name,
        role: "admin",
      });
      promotedUser = res.user;
      appendAuditLog(db, {
        actorEmail: `${currentActor.user.email} (PIN)`,
        actorRole: "admin",
        action: "Kích hoạt Admin bằng PIN",
        target: currentActor.user.email,
        detail: `Nâng quyền từ ${res.previousRole || "user"} -> admin`,
      });
      writeDb(db);
    }

    const token = generateAdminSessionToken();
    const permissions = getPermissionsForRole("admin", db.settings?.rbacPolicy);

    const response = NextResponse.json({
      success: true,
      message: "Xác thực quản trị viên thành công!",
      role: "admin",
      authMethod: "pin",
      isPinAdmin: true,
      permissions,
      user: promotedUser,
      token,
    });

    response.cookies.set({
      name: ADMIN_COOKIE_NAME,
      value: token,
      httpOnly: true,
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
    message: "Đã khóa phiên PIN quản trị.",
  });

  response.cookies.set({
    name: ADMIN_COOKIE_NAME,
    value: "",
    httpOnly: true,
    path: "/",
    maxAge: 0,
  });
  return response;
}
