import { NextResponse } from "next/server";
import { readDb, writeDb } from "@/lib/db";
import { ChatSession, ChatMessage } from "@/lib/types";
import {
  getClientIp,
  chatRateLimiter,
  publicApiRateLimiter,
  createRateLimitErrorResponse,
  attachRateLimitHeaders,
} from "@/lib/rate-limit";
import { sanitizeString, verifyAdminAuth } from "@/lib/security";

export const dynamic = "force-dynamic";

function generateSmartAutoReply(
  text: string,
  shopPhone: string,
  freeShipMin: number
): string | null {
  const lower = text.toLowerCase();
  if (
    lower.includes("menu") ||
    lower.includes("giá") ||
    lower.includes("bao nhiêu") ||
    lower.includes("tư vấn")
  ) {
    return `🍮 Menu nhà FLANDI hiện có:\n• Bánh Flan: 60k/chục (Lẻ 6.5k/cái)\n• Panna Cotta trái cây tươi: 10k/cái\n• Rau Câu Dừa Nhân Flan: 80k/chục (Truyền thống 60k/chục)\n• Rau Câu Lá Dứa Cà Phê: 40k/hộp\n• Tàu Hũ Singapore: 8k/cái\n• Yogurt nhà làm: 50k/chục\nBạn thích ăn vị nào để FLANDI lên đơn ngay cho bạn nha!`;
  }
  if (lower.includes("ship") || lower.includes("giao hàng") || lower.includes("phí")) {
    return `🛵 FLANDI giao hàng giữ lạnh tận nơi mỗi ngày từ 08:00 – 21:30! Phí ship nội thành chỉ 15k và MIỄN PHÍ GIAO HÀNG cho đơn từ ${Math.round(
      freeShipMin / 1000
    )}k trở lên nha!`;
  }
  if (lower.includes("tiệc") || lower.includes("số lượng lớn") || lower.includes("sỉ")) {
    return `🎉 FLANDI có nhận đặt bánh liên hoan, sinh nhật, trà chiều công ty với ưu đãi chiết khấu hấp dẫn! Bạn để lại SĐT hoặc số lượng dự kiến, chủ tiệm sẽ phản hồi ngay tại khung chat này nhé (Hotline/Zalo: ${shopPhone}).`;
  }
  if (lower.includes("chuyển khoản") || lower.includes("stk") || lower.includes("qr")) {
    return `💳 Bạn có thể chọn món trực tiếp trên trang rồi bấm "Hoàn tất đặt bánh" để hệ thống tạo mã VietQR tự động theo đúng số tiền đơn hàng, hoặc nhắn món ngay tại đây để tiệm tạo đơn giúp bạn nha!`;
  }
  return null;
}

export async function GET(request: Request) {
  const ip = getClientIp(request);
  const rateLimit = publicApiRateLimiter.check(`chat-get-${ip}`);
  if (!rateLimit.allowed) {
    return createRateLimitErrorResponse(rateLimit);
  }

  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get("sessionId");
  const db = readDb();
  const chats = db.chats || [];

  if (sessionId) {
    const session = chats.find((c) => c.id === sessionId) || null;
    const response = NextResponse.json({ session });
    attachRateLimitHeaders(response.headers, rateLimit);
    return response;
  }

  // Lấy toàn bộ danh sách chat yêu cầu quyền Admin
  if (!verifyAdminAuth(request)) {
    return NextResponse.json(
      { error: "Yêu cầu quyền quản trị viên" },
      { status: 401 }
    );
  }

  const response = NextResponse.json({ chats });
  attachRateLimitHeaders(response.headers, rateLimit);
  return response;
}

export async function POST(request: Request) {
  try {
    const ip = getClientIp(request);

    // 1. Kiểm tra Rate Limiting tin nhắn chat
    const rateLimit = chatRateLimiter.check(`chat-post-${ip}`);
    if (!rateLimit.allowed) {
      return createRateLimitErrorResponse(rateLimit);
    }

    const body = await request.json();

    // 2. Kiểm tra Honeypot
    if (body._hp_website || body.website) {
      return NextResponse.json({ success: true, message: "OK" });
    }

    const {
      sessionId,
      sender,
      text,
      markReadForAdmin,
    } = body as {
      sessionId: string;
      customerName?: string;
      customerPhone?: string;
      sender?: "CUSTOMER" | "SHOP";
      text?: string;
      markReadForAdmin?: boolean;
    };

    // Khử trùng chuỗi đầu vào (Chống XSS và Payload lớn)
    const customerName = sanitizeString(body.customerName || "Khách truy cập Web", 80);
    const customerPhone = sanitizeString(body.customerPhone || "", 20);
    const sanitizedText = sanitizeString(text || "", 1000);

    const msgSender = sender === "SHOP" ? "SHOP" : "CUSTOMER";

    // Nếu là SHOP gửi hoặc đánh dấu đã đọc -> bắt buộc quyền Admin
    if (msgSender === "SHOP" || markReadForAdmin) {
      if (!verifyAdminAuth(request)) {
        return NextResponse.json(
          { error: "Yêu cầu quyền quản trị viên để trả lời với vai trò SHOP" },
          { status: 401 }
        );
      }
    }

    const db = readDb();
    if (!db.chats) db.chats = [];

    const safeSessionId = sanitizeString(sessionId || `chat-${Date.now()}`, 50);
    let session = db.chats.find((c) => c.id === safeSessionId);

    if (!session) {
      session = {
        id: safeSessionId,
        customerName: customerName || "Khách truy cập Web",
        customerPhone: customerPhone || "",
        unreadForAdmin: 0,
        updatedAt: new Date().toISOString(),
        messages: [
          {
            id: `msg-welcome-${Date.now()}`,
            sender: "BOT",
            text: `Xin chào ${
              customerName || "bạn"
            }! 🍮 Chào mừng bạn đến với tiệm bánh FLANDI (“Muốn ăn hãy Flăn vào tớ”). Bạn nhắn tin trực tiếp tại đây, tiệm sẽ trả lời ngay lập tức nha!`,
            createdAt: new Date().toISOString(),
          },
        ],
      };
      db.chats.unshift(session);
    } else {
      if (customerName) session.customerName = customerName;
      if (customerPhone) session.customerPhone = customerPhone;
    }

    if (markReadForAdmin) {
      session.unreadForAdmin = 0;
      writeDb(db);
      return NextResponse.json({ session, chats: db.chats });
    }

    if (sanitizedText) {
      const newMsg: ChatMessage = {
        id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        sender: msgSender,
        text: sanitizedText,
        createdAt: new Date().toISOString(),
      };
      session.messages.push(newMsg);
      session.updatedAt = new Date().toISOString();

      if (msgSender === "CUSTOMER") {
        session.unreadForAdmin = (session.unreadForAdmin || 0) + 1;

        // Trợ lý ảo tự động phản hồi tức thì
        const autoReply = generateSmartAutoReply(
          sanitizedText,
          db.settings.phone || "0703166903",
          db.settings.freeShipMinimum || 100000
        );
        if (autoReply) {
          session.messages.push({
            id: `msg-bot-${Date.now()}`,
            sender: "BOT",
            text: autoReply,
            createdAt: new Date(Date.now() + 250).toISOString(),
          });
        } else if (session.messages.filter((m) => m.sender === "CUSTOMER").length === 1) {
          session.messages.push({
            id: `msg-bot-${Date.now()}`,
            sender: "BOT",
            text: "✅ FLANDI đã nhận được tin nhắn của bạn! Chủ tiệm đang xem và sẽ phản hồi bạn ngay tại khung chat này nha ♥",
            createdAt: new Date(Date.now() + 250).toISOString(),
          });
        }
      } else if (msgSender === "SHOP") {
        session.unreadForAdmin = 0;
      }

      // Đưa session vừa có tin nhắn lên đầu
      db.chats = [
        session,
        ...db.chats.filter((c) => c.id !== session!.id),
      ];
    }

    writeDb(db);
    const response = NextResponse.json({ session, chats: db.chats });
    attachRateLimitHeaders(response.headers, rateLimit);
    return response;
  } catch (error) {
    return NextResponse.json(
      { error: "Lỗi xử lý tin nhắn", details: String(error) },
      { status: 400 }
    );
  }
}
