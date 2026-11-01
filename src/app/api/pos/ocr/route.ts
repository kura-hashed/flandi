import { NextResponse } from "next/server";
import path from "path";
import { createRequire } from "module";
import sharp from "sharp";
import { readDb } from "@/lib/db";
import { resolveRequestActor, verifySameOrigin } from "@/lib/security";
import { parseOrderText } from "@/lib/order-ocr-parser";
import {
  getClientIp,
  publicApiRateLimiter,
  createRateLimitErrorResponse,
  attachRateLimitHeaders,
} from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const requireModule = createRequire(import.meta.url);

// Singleton OCR worker được tái sử dụng để phản hồi siêu tốc (< 500ms)
let cachedWorkerPromise: Promise<any> | null = null;

async function getOcrWorker(): Promise<any> {
  if (!cachedWorkerPromise) {
    cachedWorkerPromise = (async () => {
      const { createWorker } = requireModule("tesseract.js");
      const workerPath = path.resolve(
        process.cwd(),
        "node_modules/tesseract.js/src/worker-script/node/index.js"
      );
      const corePath = path.resolve(
        process.cwd(),
        "node_modules/tesseract.js-core"
      );

      const worker = await createWorker(["vie", "eng"], 1, {
        workerPath,
        corePath,
        workerBlobURL: false,
        logger: () => {},
      });
      return worker;
    })();
  }
  return cachedWorkerPromise;
}

export async function POST(request: Request) {
  try {
    const ip = getClientIp(request);

    if (!verifySameOrigin(request)) {
      return NextResponse.json(
        { error: "Forbidden: Nguồn gốc không hợp lệ" },
        { status: 403 }
      );
    }

    const rateLimit = publicApiRateLimiter.check(`ocr-${ip}`);
    if (!rateLimit.allowed) {
      return createRateLimitErrorResponse(rateLimit);
    }

    const db = readDb();
    const actor = resolveRequestActor(request, db);

    // Bắt buộc quyền Staff hoặc Admin mới được dùng chức năng OCR nạp đơn POS
    if (!actor.permissions.includes("orders:create")) {
      return NextResponse.json(
        { error: "Yêu cầu quyền Staff hoặc Admin để sử dụng tính năng OCR nạp đơn" },
        { status: 403 }
      );
    }

    // 1. Nhận dữ liệu ảnh từ JSON body hoặc FormData
    let imageBuffer: Buffer | null = null;
    let base64Preview = "";

    const contentType = request.headers.get("content-type") || "";

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      const file = formData.get("image") as File | null;
      if (!file) {
        return NextResponse.json(
          { error: "Vui lòng chọn file ảnh đơn hàng" },
          { status: 400 }
        );
      }
      const arrayBuffer = await file.arrayBuffer();
      imageBuffer = Buffer.from(arrayBuffer);
      base64Preview = `data:${file.type || "image/png"};base64,${imageBuffer.toString("base64")}`;
    } else {
      const body = await request.json();
      const rawImage = body.image || body.base64;
      if (!rawImage || typeof rawImage !== "string") {
        return NextResponse.json(
          { error: "Dữ liệu ảnh không hợp lệ (cần base64 hoặc file ảnh)" },
          { status: 400 }
        );
      }

      base64Preview = rawImage.startsWith("data:")
        ? rawImage
        : `data:image/png;base64,${rawImage}`;

      const base64Data = rawImage.replace(/^data:image\/[a-zA-Z0-9+.-]+;base64,/, "");
      imageBuffer = Buffer.from(base64Data, "base64");
    }

    if (!imageBuffer || imageBuffer.length === 0) {
      return NextResponse.json(
        { error: "Không tìm thấy dữ liệu ảnh để nhận diện" },
        { status: 400 }
      );
    }

    // Giới hạn kích thước file ảnh tối đa 15MB
    if (imageBuffer.length > 15 * 1024 * 1024) {
      return NextResponse.json(
        { error: "File ảnh vượt quá giới hạn 15MB" },
        { status: 400 }
      );
    }

    // 2. Tối ưu ảnh với sharp trước khi nạp vào Tesseract OCR (tăng độ chính xác chữ viết tay / bill chụp)
    let processedBuffer = imageBuffer;
    try {
      const metadata = await sharp(imageBuffer).metadata();
      let pipeline = sharp(imageBuffer);

      // Nếu ảnh quá nhỏ, phóng to lên để chữ rõ nét hơn
      if (metadata.width && metadata.width < 1000) {
        pipeline = pipeline.resize({ width: 1400, withoutEnlargement: false });
      } else if (metadata.width && metadata.width > 2400) {
        // Nếu ảnh quá lớn, nén gọn về 2400 để xử lý nhanh
        pipeline = pipeline.resize({ width: 2400, withoutEnlargement: true });
      }

      // Chuyển sang ảnh grayscale, tăng tương phản để chữ tách biệt nền giấy/màn hình
      processedBuffer = await pipeline
        .grayscale()
        .normalize()
        .sharpen()
        .png()
        .toBuffer();
    } catch {
      // Nếu sharp gặp định dạng lạ, dùng trực tiếp buffer gốc
      processedBuffer = imageBuffer;
    }

    // 3. Thực thi OCR với Tesseract.js (tiếng Việt + tiếng Anh)
    const worker = await getOcrWorker();
    const ocrResult = await worker.recognize(processedBuffer);
    const rawText = ocrResult.data.text || "";
    const confidence = Math.round(ocrResult.data.confidence || 0);

    // 4. Trích xuất thông tin đơn hàng và món theo thực đơn tiệm
    const parsed = parseOrderText(rawText, db.products);

    const response = NextResponse.json({
      success: true,
      rawText,
      confidence,
      parsed,
      image: base64Preview,
    });

    attachRateLimitHeaders(response.headers, rateLimit);
    return response;
  } catch (err) {
    console.error("POS OCR Error:", err);
    return NextResponse.json(
      { error: "Lỗi nhận diện ảnh đơn hàng", details: String(err) },
      { status: 500 }
    );
  }
}
