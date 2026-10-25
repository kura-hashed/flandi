import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Danh sách các User-Agent quét lỗ hổng và crawler độc hại cần chặn ngay tại tầng Edge
const MALICIOUS_USER_AGENTS = [
  "sqlmap",
  "nikto",
  "wpscan",
  "dirbuster",
  "gobuster",
  "masscan",
  "nmap",
  "zgrab",
  "acunetix",
  "havij",
  "netsparker",
];

// Danh sách các đường dẫn quét tự động phổ biến thường bị bot tấn công dò tìm
const BLOCKED_PROBE_PATHS = [
  "/wp-login.php",
  "/wp-admin",
  "/xmlrpc.php",
  "/.env",
  "/.git",
  "/phpmyadmin",
  "/admin.php",
  "/cgi-bin",
  "/config.json",
];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const userAgent = (request.headers.get("user-agent") || "").toLowerCase();

  // 1. Chặn các công cụ quét lỗ hổng tự động
  if (MALICIOUS_USER_AGENTS.some((bot) => userAgent.includes(bot))) {
    return new NextResponse("Forbidden (Malicious scanner detected)", {
      status: 403,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  // 2. Chặn các probe paths khai thác lỗ hổng CMS
  if (BLOCKED_PROBE_PATHS.some((path) => pathname.toLowerCase().startsWith(path))) {
    return new NextResponse("Not Found", {
      status: 404,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  // 3. Tạo response tiếp theo và gán bộ Security Headers chuẩn cao nhất
  const response = NextResponse.next();

  // Ngăn chặn trình duyệt đoán loại MIME (MIME-sniffing)
  response.headers.set("X-Content-Type-Options", "nosniff");

  // Chống Clickjacking bằng cách cấm nhúng iframe từ bên ngoài
  response.headers.set("X-Frame-Options", "SAMEORIGIN");

  // Bật cơ chế lọc XSS của trình duyệt
  response.headers.set("X-XSS-Protection", "1; mode=block");

  // Giữ an toàn thông tin Referrer
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");

  // Hạn chế các quyền nhạy cảm của thiết bị (Camera, Micro, Vị trí)
  response.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), interest-cohort=()"
  );

  return response;
}

export const config = {
  matcher: [
    /*
     * Khớp tất cả request ngoại trừ:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico
     * - images/
     */
    "/((?!_next/static|_next/image|images/|favicon.ico).*)",
  ],
};
