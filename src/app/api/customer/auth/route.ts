import { NextResponse } from "next/server";
import { readDb, writeDb, upsertCustomer } from "@/lib/db";
import {
  CUSTOMER_COOKIE_NAME,
  generateCustomerToken,
  parseGoogleCredential,
  resolveRequestActor,
  verifyAdminAuth,
  verifyPinAdminSession,
  verifySameOrigin,
} from "@/lib/security";
import { getPermissionsForRole, normalizeRbacPolicy } from "@/lib/rbac";
import {
  customerAuthRateLimiter,
  createRateLimitErrorResponse,
  getClientIp,
  attachRateLimitHeaders,
} from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const db = readDb();
    const googleClientId =
      process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ||
      db.settings?.pageConfig?.googleClientId ||
      "";
    const rbacPolicy = normalizeRbacPolicy(db.settings?.rbacPolicy);
    const actor = resolveRequestActor(request, db);

    return NextResponse.json({
      authenticated: Boolean(actor.user),
      user: actor.user,
      role: actor.role,
      authMethod: actor.authMethod,
      isPinAdmin: actor.isPinAdmin,
      permissions: actor.permissions,
      rbacPolicy,
      googleClientId,
    });
  } catch (error) {
    console.error("Customer auth check error:", error);
    return NextResponse.json({
      authenticated: false,
      user: null,
      role: "guest",
      authMethod: "none",
      isPinAdmin: false,
      permissions: getPermissionsForRole("guest"),
      googleClientId: "",
    });
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

    // 1. Xác thực Google ID Token (từ Google Identity Services / One Tap)
    if (body.credential && typeof body.credential === "string") {
      try {
        const verifyRes = await fetch(
          `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(body.credential)}`,
          { cache: "no-store" }
        );
        if (verifyRes.ok) {
          const gData = await verifyRes.json();
          email = gData.email || "";
          name = gData.name || gData.given_name || "";
          picture = gData.picture;
          googleId = gData.sub;
        }
      } catch (err) {
        console.warn("Google tokeninfo remote check warning, falling back to local JWT:", err);
      }

      if (!email) {
        const parsed = parseGoogleCredential(body.credential);
        if (parsed) {
          email = parsed.email;
          name = parsed.name;
          picture = parsed.picture;
          googleId = parsed.sub;
        }
      }
    }

    // 2. Xác thực Google OAuth 2.0 Access Token (từ Google OAuth Popup flow)
    if (!email && body.accessToken && typeof body.accessToken === "string") {
      try {
        const userRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
          headers: { Authorization: `Bearer ${body.accessToken}` },
          cache: "no-store",
        });
        if (userRes.ok) {
          const gUser = await userRes.json();
          email = gUser.email || "";
          name = gUser.name || gUser.given_name || "";
          picture = gUser.picture;
          googleId = gUser.sub;
        }
      } catch (err) {
        console.error("Google userinfo fetch error:", err);
      }
    }

    if (!email || !email.includes("@")) {
      return NextResponse.json(
        { error: "Xác thực tài khoản Google thất bại. Vui lòng thử lại với tài khoản Google hợp lệ." },
        { status: 400 }
      );
    }

    if (!name) {
      name = email.split("@")[0];
    }

    // 3. Upsert tài khoản (giữ nguyên role nếu đã được Admin cấp quyền trước theo email)
    const customer = upsertCustomer({
      email,
      name,
      picture,
      googleId,
    });

    const db = readDb();
    const isPinAdmin = verifyPinAdminSession(request);
    const effectiveRole = isPinAdmin ? "admin" : customer.role || "user";
    const permissions = getPermissionsForRole(
      effectiveRole,
      db.settings?.rbacPolicy
    );

    const token = generateCustomerToken(customer.id);
    const response = NextResponse.json({
      success: true,
      user: customer,
      role: effectiveRole,
      isPinAdmin,
      permissions,
      token,
      message: "Đăng nhập tài khoản Google thành công!",
    });

    // 4. Lưu session cookie an toàn (30 ngày)
    response.cookies.set({
      name: CUSTOMER_COOKIE_NAME,
      value: token,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 30 * 24 * 60 * 60,
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

export async function PUT(request: Request) {
  try {
    if (!verifySameOrigin(request)) {
      return NextResponse.json({ error: "Nguồn gốc không hợp lệ" }, { status: 403 });
    }
    if (!verifyAdminAuth(request)) {
      return NextResponse.json(
        { error: "Yêu cầu quyền Admin để cập nhật Google Client ID" },
        { status: 403 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const clientId = String(body.googleClientId || "").trim();
    if (!clientId) {
      return NextResponse.json(
        { error: "Google Client ID không được để trống" },
        { status: 400 }
      );
    }

    const db = readDb();
    const pageConfig = db.settings.pageConfig || ({} as any);
    pageConfig.googleClientId = clientId;
    db.settings.pageConfig = pageConfig;
    writeDb(db);

    return NextResponse.json({
      success: true,
      googleClientId: clientId,
      message: "Đã lưu Google Client ID thành công!",
    });
  } catch {
    return NextResponse.json(
      { error: "Lỗi lưu cấu hình Google Client ID" },
      { status: 500 }
    );
  }
}

export async function DELETE() {
  const response = NextResponse.json({
    success: true,
    message: "Đã đăng xuất tài khoản",
  });

  response.cookies.set({
    name: CUSTOMER_COOKIE_NAME,
    value: "",
    httpOnly: true,
    path: "/",
    maxAge: 0,
  });

  return response;
}
