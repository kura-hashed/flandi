import { NextResponse } from "next/server";
import {
  appendAuditLog,
  readDb,
  upsertUserWithRole,
  writeDb,
} from "@/lib/db";
import { isAccountRole, normalizeRbacPolicy } from "@/lib/rbac";
import {
  resolveRequestActor,
  sanitizeString,
  verifySameOrigin,
} from "@/lib/security";
import {
  adminApiRateLimiter,
  attachRateLimitHeaders,
  createRateLimitErrorResponse,
  getClientIp,
} from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

function getActorLabel(actor: ReturnType<typeof resolveRequestActor>): string {
  if (actor.user?.email) {
    return actor.isPinAdmin ? `${actor.user.email} (PIN)` : actor.user.email;
  }
  return actor.isPinAdmin ? "Admin (Mã PIN)" : actor.role;
}

export async function GET(request: Request) {
  const ip = getClientIp(request);
  const rateLimit = adminApiRateLimiter.check(`admin-users-get-${ip}`);
  if (!rateLimit.allowed) {
    return createRateLimitErrorResponse(rateLimit);
  }

  const db = readDb();
  const actor = resolveRequestActor(request, db);

  if (!actor.permissions.includes("users:manage")) {
    return NextResponse.json(
      { error: "Yêu cầu quyền Admin để quản lý tài khoản & phân quyền" },
      { status: 403 }
    );
  }

  const response = NextResponse.json({
    users: db.customers || [],
    rbacPolicy: normalizeRbacPolicy(db.settings?.rbacPolicy),
    auditLogs: db.auditLogs || [],
    currentActor: {
      role: actor.role,
      authMethod: actor.authMethod,
      isPinAdmin: actor.isPinAdmin,
      user: actor.user,
    },
  });
  attachRateLimitHeaders(response.headers, rateLimit);
  return response;
}

export async function POST(request: Request) {
  try {
    if (!verifySameOrigin(request)) {
      return NextResponse.json({ error: "Nguồn gốc không hợp lệ" }, { status: 403 });
    }

    const ip = getClientIp(request);
    const rateLimit = adminApiRateLimiter.check(`admin-users-post-${ip}`);
    if (!rateLimit.allowed) {
      return createRateLimitErrorResponse(rateLimit);
    }

    const db = readDb();
    const actor = resolveRequestActor(request, db);
    if (!actor.permissions.includes("users:manage")) {
      return NextResponse.json(
        { error: "Chỉ Admin mới được thêm & cấp quyền tài khoản" },
        { status: 403 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const rawEmail = sanitizeString(body.email || "", 120).toLowerCase().trim();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!rawEmail || !emailRegex.test(rawEmail)) {
      return NextResponse.json(
        { error: "Email không hợp lệ (ví dụ: nhanvien@gmail.com)" },
        { status: 400 }
      );
    }

    const role = isAccountRole(body.role) ? body.role : "staff";
    const name = body.name ? sanitizeString(body.name, 80) : undefined;
    const phone = body.phone ? sanitizeString(body.phone, 20) : undefined;

    // Không cho phép Admin đang login Google tự hạ quyền chính mình khi không có PIN session
    if (
      !actor.isPinAdmin &&
      actor.user &&
      actor.user.email.toLowerCase().trim() === rawEmail &&
      role !== "admin"
    ) {
      return NextResponse.json(
        { error: "Không thể tự hạ quyền Admin của tài khoản bạn đang đăng nhập!" },
        { status: 400 }
      );
    }

    const { user, isNew, previousRole } = upsertUserWithRole(db, {
      email: rawEmail,
      name,
      phone,
      role,
    });

    appendAuditLog(db, {
      actorEmail: getActorLabel(actor),
      actorRole: actor.role,
      action: isNew ? "Thêm & cấp quyền email" : "Cập nhật quyền theo email",
      target: rawEmail,
      detail: isNew
        ? `Cấp quyền mới: ${role.toUpperCase()}`
        : `Đổi role: ${(previousRole || "user").toUpperCase()} -> ${role.toUpperCase()}`,
    });

    writeDb(db);
    const response = NextResponse.json({
      success: true,
      user,
      users: db.customers || [],
      auditLogs: db.auditLogs || [],
    });
    attachRateLimitHeaders(response.headers, rateLimit);
    return response;
  } catch (error) {
    return NextResponse.json(
      { error: "Không thể lưu phân quyền tài khoản", details: String(error) },
      { status: 400 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    if (!verifySameOrigin(request)) {
      return NextResponse.json({ error: "Nguồn gốc không hợp lệ" }, { status: 403 });
    }

    const ip = getClientIp(request);
    const rateLimit = adminApiRateLimiter.check(`admin-users-patch-${ip}`);
    if (!rateLimit.allowed) {
      return createRateLimitErrorResponse(rateLimit);
    }

    const db = readDb();
    const actor = resolveRequestActor(request, db);
    if (!actor.permissions.includes("users:manage")) {
      return NextResponse.json(
        { error: "Chỉ Admin mới được chỉnh sửa phân quyền" },
        { status: 403 }
      );
    }

    const body = await request.json().catch(() => ({}));

    // Nhánh 1: Cập nhật Ma trận Quyền (Role × Permission Matrix)
    if (body.rbacPolicy && typeof body.rbacPolicy === "object") {
      const nextPolicy = normalizeRbacPolicy(body.rbacPolicy);
      db.settings.rbacPolicy = nextPolicy;

      appendAuditLog(db, {
        actorEmail: getActorLabel(actor),
        actorRole: actor.role,
        action: "Cập nhật ma trận quyền",
        target: "RBAC Policy",
        detail: `Staff: [${nextPolicy.staff.join(", ")}] • User: [${nextPolicy.user.join(", ")}]`,
      });

      writeDb(db);
      const response = NextResponse.json({
        success: true,
        rbacPolicy: nextPolicy,
        auditLogs: db.auditLogs || [],
      });
      attachRateLimitHeaders(response.headers, rateLimit);
      return response;
    }

    // Nhánh 2: Đổi role cho 1 tài khoản cụ thể
    const userId = sanitizeString(body.userId || "", 80);
    if (!userId || !isAccountRole(body.role)) {
      return NextResponse.json(
        { error: "Thiếu ID tài khoản hoặc vai trò không hợp lệ" },
        { status: 400 }
      );
    }

    if (!db.customers) db.customers = [];
    const idx = db.customers.findIndex((u) => u.id === userId);
    if (idx === -1) {
      return NextResponse.json(
        { error: "Không tìm thấy tài khoản người dùng" },
        { status: 404 }
      );
    }

    const targetUser = db.customers[idx];
    if (
      !actor.isPinAdmin &&
      actor.user?.id === targetUser.id &&
      body.role !== "admin"
    ) {
      return NextResponse.json(
        { error: "Không thể tự hạ quyền Admin của chính bạn!" },
        { status: 400 }
      );
    }

    const prevRole = targetUser.role || "user";
    const now = new Date().toISOString();
    db.customers[idx] = {
      ...targetUser,
      role: body.role,
      roleUpdatedAt: now,
      updatedAt: now,
    };

    appendAuditLog(db, {
      actorEmail: getActorLabel(actor),
      actorRole: actor.role,
      action: "Đổi vai trò tài khoản",
      target: targetUser.email,
      detail: `${prevRole.toUpperCase()} -> ${body.role.toUpperCase()}`,
    });

    writeDb(db);
    const response = NextResponse.json({
      success: true,
      user: db.customers[idx],
      users: db.customers,
      auditLogs: db.auditLogs || [],
    });
    attachRateLimitHeaders(response.headers, rateLimit);
    return response;
  } catch (error) {
    return NextResponse.json(
      { error: "Không thể cập nhật phân quyền", details: String(error) },
      { status: 400 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    if (!verifySameOrigin(request)) {
      return NextResponse.json({ error: "Nguồn gốc không hợp lệ" }, { status: 403 });
    }

    const ip = getClientIp(request);
    const rateLimit = adminApiRateLimiter.check(`admin-users-del-${ip}`);
    if (!rateLimit.allowed) {
      return createRateLimitErrorResponse(rateLimit);
    }

    const db = readDb();
    const actor = resolveRequestActor(request, db);
    if (!actor.permissions.includes("users:manage")) {
      return NextResponse.json(
        { error: "Chỉ Admin mới được xoá tài khoản" },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const id = sanitizeString(searchParams.get("id") || "", 80);
    if (!id) {
      return NextResponse.json({ error: "Thiếu ID tài khoản" }, { status: 400 });
    }

    if (!actor.isPinAdmin && actor.user?.id === id) {
      return NextResponse.json(
        { error: "Không thể xoá tài khoản Admin bạn đang đăng nhập!" },
        { status: 400 }
      );
    }

    const target = (db.customers || []).find((c) => c.id === id);
    if (!target) {
      return NextResponse.json(
        { error: "Không tìm thấy tài khoản" },
        { status: 404 }
      );
    }

    db.customers = (db.customers || []).filter((c) => c.id !== id);
    appendAuditLog(db, {
      actorEmail: getActorLabel(actor),
      actorRole: actor.role,
      action: "Xoá tài khoản",
      target: target.email,
      detail: `Đã xoá tài khoản (${(target.role || "user").toUpperCase()})`,
    });

    writeDb(db);
    const response = NextResponse.json({
      success: true,
      users: db.customers,
      auditLogs: db.auditLogs || [],
    });
    attachRateLimitHeaders(response.headers, rateLimit);
    return response;
  } catch (error) {
    return NextResponse.json(
      { error: "Không thể xoá tài khoản", details: String(error) },
      { status: 400 }
    );
  }
}
