export interface BillImageItem {
  name: string;
  badgeText: string;
  image: string;
  unit: string;
  price: number;
  quantity: number;
}

export interface BillImageOptions {
  orderCode?: string;
  items: BillImageItem[];
  subtotal: number;
  shippingFee: number;
  grandTotal: number;
  customerName?: string;
  customerPhone?: string;
  customerAddress?: string;
  shopName?: string;
  tagline?: string;
  mascotUrl?: string;
  shopPhone?: string;
  shopAddress?: string;
}

export interface GeneratedBillImage {
  blob: Blob;
  objectUrl: string;
  fileName: string;
}

function formatK(n: number): string {
  const val = Number(n) || 0;
  const inK = val / 1000;
  if (Number.isInteger(inK)) {
    return `${inK}k`;
  }
  return `${Number(inK.toFixed(1))}k`;
}

const canvasImageCache = new Map<string, HTMLImageElement>();
let fontsLoadedOnce = false;

export async function preloadBillAssets(imageUrls: string[]): Promise<void> {
  if (typeof window === "undefined") return;
  const tasks: Promise<unknown>[] = [];
  if (!fontsLoadedOnce && typeof document !== "undefined" && document.fonts) {
    tasks.push(
      Promise.allSettled([
        document.fonts.ready,
        document.fonts.load("900 40px Coiny"),
        document.fonts.load("800 26px Quicksand"),
        document.fonts.load("700 22px Quicksand"),
      ]).then(() => {
        fontsLoadedOnce = true;
      })
    );
  }
  for (const url of imageUrls) {
    if (url) {
      tasks.push(loadCanvasImage(url));
    }
  }
  await Promise.allSettled(tasks);
}

function loadCanvasImage(src: string): Promise<HTMLImageElement | null> {
  if (!src) {
    return Promise.resolve(null);
  }
  const cached = canvasImageCache.get(src);
  if (cached && cached.complete && cached.naturalWidth > 0) {
    return Promise.resolve(cached);
  }
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      canvasImageCache.set(src, img);
      resolve(img);
    };
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function drawCoverImage(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number,
  y: number,
  w: number,
  h: number
) {
  const iw = img.naturalWidth || img.width;
  const ih = img.naturalHeight || img.height;
  if (!iw || !ih) return;

  const scale = Math.max(w / iw, h / ih);
  const sw = w / scale;
  const sh = h / scale;
  const sx = (iw - sw) / 2;
  const sy = (ih - sh) / 2;
  ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
}

function wrapCanvasText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string[] {
  const words = text.trim().split(/\s+/);
  if (words.length === 0) return [];
  const lines: string[] = [];
  let current = words[0];

  for (let i = 1; i < words.length; i++) {
    const candidate = `${current} ${words[i]}`;
    if (ctx.measureText(candidate).width <= maxWidth) {
      current = candidate;
    } else {
      lines.push(current);
      current = words[i];
    }
  }
  lines.push(current);
  return lines;
}

function truncateCanvasText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let trimmed = text;
  while (trimmed.length > 1 && ctx.measureText(`${trimmed}…`).width > maxWidth) {
    trimmed = trimmed.slice(0, -1);
  }
  return `${trimmed}…`;
}

export async function generateBillImage(
  opts: BillImageOptions
): Promise<GeneratedBillImage> {
  if (!fontsLoadedOnce && typeof document !== "undefined" && document.fonts) {
    await Promise.allSettled([
      document.fonts.ready,
      document.fonts.load("900 40px Coiny"),
      document.fonts.load("800 26px Quicksand"),
      document.fonts.load("700 22px Quicksand"),
    ]);
    fontsLoadedOnce = true;
  }

  const mascotSrc = opts.mascotUrl || "/images/branding/flandi-mascot.png";
  const [mascotImg, ...itemImages] = await Promise.all([
    loadCanvasImage(mascotSrc),
    ...opts.items.map((i) => loadCanvasImage(i.image)),
  ]);

  const W = 960;
  const padX = 44;
  const padY = 44;
  const cardW = W - padX * 2; // 872
  const innerX = padX + 36;
  const innerRight = padX + cardW - 36;
  const innerW = cardW - 72; // 800

  // Measure optional customer info lines before allocating final bitmap height
  const measureCanvas = document.createElement("canvas");
  const mCtx = measureCanvas.getContext("2d");
  const custLines: { label: string; lines: string[] }[] = [];

  const cleanName = opts.customerName?.trim() || "";
  const cleanPhone = opts.customerPhone?.trim() || "";
  const cleanAddress = opts.customerAddress?.trim() || "";

  if (mCtx) {
    mCtx.font = "700 22px Quicksand, sans-serif";
    if (cleanName || cleanPhone) {
      const who = [cleanName, cleanPhone].filter(Boolean).join(" • ");
      custLines.push({
        label: "Khách:",
        lines: wrapCanvasText(mCtx, who, innerW - 145),
      });
    }
    if (cleanAddress) {
      custLines.push({
        label: "Địa chỉ:",
        lines: wrapCanvasText(mCtx, cleanAddress, innerW - 145),
      });
    }
  }

  const headerH = 158;
  const listHeaderH = 52;
  const itemRowH = 108;
  const itemsBlockH = opts.items.length * itemRowH;
  const tearLineH = 44;
  const totalsBlockH = 188;

  let customerBlockH = 0;
  if (custLines.length > 0) {
    const totalSubLines = custLines.reduce((s, r) => s + r.lines.length, 0);
    customerBlockH = 36 + totalSubLines * 32 + (custLines.length - 1) * 10 + 24;
  }

  const footerH = 98;
  const cardH =
    headerH +
    listHeaderH +
    itemsBlockH +
    tearLineH +
    totalsBlockH +
    customerBlockH +
    footerH;
  const H = cardH + padY * 2;

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Không thể khởi tạo khung vẽ hóa đơn (2D context)");
  }

  // 1. Pastel Cream Grid Background
  ctx.fillStyle = "#FFF9F8";
  ctx.fillRect(0, 0, W, H);

  ctx.strokeStyle = "rgba(244, 139, 126, 0.13)";
  ctx.lineWidth = 1.5;
  const gridStep = 36;
  for (let x = 0; x <= W; x += gridStep) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, H);
    ctx.stroke();
  }
  for (let y = 0; y <= H; y += gridStep) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
    ctx.stroke();
  }

  // Soft decorative corner blobs
  ctx.save();
  ctx.fillStyle = "rgba(244, 139, 126, 0.18)";
  ctx.beginPath();
  ctx.arc(40, 40, 140, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(255, 214, 209, 0.45)";
  ctx.beginPath();
  ctx.arc(W - 30, 70, 150, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(244, 139, 126, 0.16)";
  ctx.beginPath();
  ctx.arc(W - 50, H - 40, 140, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // 2. Main Receipt Card Container
  ctx.save();
  ctx.shadowColor = "rgba(232, 111, 95, 0.18)";
  ctx.shadowBlur = 28;
  ctx.shadowOffsetY = 10;
  ctx.fillStyle = "#FFFFFF";
  ctx.beginPath();
  ctx.roundRect(padX, padY, cardW, cardH, 36);
  ctx.fill();
  ctx.restore();

  // Clip inside card for top banner tint
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(padX, padY, cardW, cardH, 36);
  ctx.clip();

  // Top Header Gradient Tint
  const headerGrad = ctx.createLinearGradient(padX, padY, padX + cardW, padY + headerH);
  headerGrad.addColorStop(0, "#FFF4EE");
  headerGrad.addColorStop(0.5, "#FFF9F6");
  headerGrad.addColorStop(1, "#FFF2EE");
  ctx.fillStyle = headerGrad;
  ctx.fillRect(padX, padY, cardW, headerH);

  // Header bottom border
  ctx.strokeStyle = "#FFD6D1";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(padX, padY + headerH);
  ctx.lineTo(padX + cardW, padY + headerH);
  ctx.stroke();

  // Mascot Avatar in Header
  const avatarX = innerX;
  const avatarY = padY + 35;
  const avatarSize = 88;
  ctx.save();
  ctx.fillStyle = "#F48B7E";
  ctx.beginPath();
  ctx.arc(
    avatarX + avatarSize / 2,
    avatarY + avatarSize / 2,
    avatarSize / 2 + 4,
    0,
    Math.PI * 2
  );
  ctx.fill();

  ctx.fillStyle = "#FFFFFF";
  ctx.beginPath();
  ctx.arc(
    avatarX + avatarSize / 2,
    avatarY + avatarSize / 2,
    avatarSize / 2 + 1,
    0,
    Math.PI * 2
  );
  ctx.fill();

  ctx.beginPath();
  ctx.arc(
    avatarX + avatarSize / 2,
    avatarY + avatarSize / 2,
    avatarSize / 2 - 2,
    0,
    Math.PI * 2
  );
  ctx.clip();
  if (mascotImg) {
    drawCoverImage(ctx, mascotImg, avatarX, avatarY, avatarSize, avatarSize);
  } else {
    ctx.fillStyle = "#FFF4EE";
    ctx.fillRect(avatarX, avatarY, avatarSize, avatarSize);
  }
  ctx.restore();

  // Brand & Receipt Title
  const titleX = avatarX + avatarSize + 22;
  ctx.fillStyle = "#E86F5F";
  ctx.font = "900 36px Coiny, Quicksand, sans-serif";
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillText("TIỆM BÁNH FLANDI", titleX, padY + 76);

  ctx.fillStyle = "#8C6D68";
  ctx.font = "700 21px Quicksand, sans-serif";
  ctx.fillText(
    opts.tagline || "Muốn ăn hãy Flăn vào tớ",
    titleX,
    padY + 110
  );

  // Date & Order Code Badge (Top Right)
  const now = new Date();
  const timeStr = now.toLocaleTimeString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
  });
  const dateStr = now.toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

  const codeLabel = opts.orderCode ? `#${opts.orderCode}` : "HÓA ĐƠN";
  ctx.font = "800 18px Quicksand, sans-serif";
  const badgeW = Math.max(ctx.measureText(codeLabel).width + 32, 120);
  const badgeH = 36;
  const badgeX = innerRight - badgeW;
  const badgeY = padY + 38;

  ctx.fillStyle = "#E86F5F";
  ctx.beginPath();
  ctx.roundRect(badgeX, badgeY, badgeW, badgeH, 18);
  ctx.fill();

  ctx.fillStyle = "#FFFFFF";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(codeLabel, badgeX + badgeW / 2, badgeY + badgeH / 2 + 1);

  ctx.fillStyle = "#8C6D68";
  ctx.font = "700 18px Quicksand, sans-serif";
  ctx.textAlign = "right";
  ctx.textBaseline = "alphabetic";
  ctx.fillText(`${timeStr} • ${dateStr}`, innerRight, padY + 108);

  // 3. Column Subheader
  let curY = padY + headerH;
  ctx.fillStyle = "#FFFDFC";
  ctx.fillRect(padX, curY, cardW, listHeaderH);

  ctx.fillStyle = "#8C6D68";
  ctx.font = "800 18px Quicksand, sans-serif";
  ctx.textAlign = "left";
  ctx.fillText(
    `ĐÃ CHỌN (${opts.items.length})`,
    innerX,
    curY + 33
  );
  ctx.textAlign = "right";
  ctx.fillText("SL & THÀNH TIỀN", innerRight, curY + 33);

  ctx.strokeStyle = "#FFE4E0";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(innerX, curY + listHeaderH);
  ctx.lineTo(innerRight, curY + listHeaderH);
  ctx.stroke();

  curY += listHeaderH;

  // 4. Item Rows (with rounded gradient-framed product images matching Menu/Bill!)
  opts.items.forEach((item, idx) => {
    const rowTop = curY + idx * itemRowH;
    const imgSize = 74;
    const imgX = innerX;
    const imgY = rowTop + (itemRowH - imgSize) / 2;

    // Gradient rounded frame
    const frameGrad = ctx.createLinearGradient(
      imgX,
      imgY + imgSize,
      imgX + imgSize,
      imgY
    );
    frameGrad.addColorStop(0, "#E86F5F");
    frameGrad.addColorStop(1, "#F48B7E");
    ctx.fillStyle = frameGrad;
    ctx.beginPath();
    ctx.roundRect(imgX, imgY, imgSize, imgSize, 18);
    ctx.fill();

    // Inner white border
    ctx.fillStyle = "#FFFFFF";
    ctx.beginPath();
    ctx.roundRect(imgX + 3, imgY + 3, imgSize - 6, imgSize - 6, 15);
    ctx.fill();

    // Product image clipped
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(imgX + 5, imgY + 5, imgSize - 10, imgSize - 10, 13);
    ctx.clip();
    const prodImg = itemImages[idx];
    if (prodImg) {
      drawCoverImage(
        ctx,
        prodImg,
        imgX + 5,
        imgY + 5,
        imgSize - 10,
        imgSize - 10
      );
    } else {
      ctx.fillStyle = "#FFF4EE";
      ctx.fillRect(imgX + 5, imgY + 5, imgSize - 10, imgSize - 10);
    }
    ctx.restore();

    // Right side: [Quantity Pill] + Subtotal cleanly aligned on the right
    const rowMidY = rowTop + itemRowH / 2;
    const lineTotalStr = formatK(item.price * item.quantity);
    ctx.font = "900 28px Quicksand, sans-serif";
    ctx.fillStyle = "#4A2E2B";
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    ctx.fillText(lineTotalStr, innerRight, rowMidY);

    const qtyText = `${item.quantity}`;
    ctx.font = "900 26px Quicksand, sans-serif";
    const qtyPillW = Math.max(ctx.measureText(qtyText).width + 36, 66);
    const qtyPillH = 46;
    const qtyPillX = innerRight - 112 - qtyPillW;
    const qtyPillY = rowTop + (itemRowH - qtyPillH) / 2;

    ctx.fillStyle = "#FFF5F2";
    ctx.strokeStyle = "#FFC5BC";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(qtyPillX, qtyPillY, qtyPillW, qtyPillH, 14);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "#E86F5F";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(qtyText, qtyPillX + qtyPillW / 2, qtyPillY + qtyPillH / 2 + 1);

    // Left text: Product Name + Coral Unit Price right next to product name
    const textLeft = imgX + imgSize + 20;
    const unitPriceSuffix = `  ${formatK(item.price)}`;
    ctx.font = "900 26px Quicksand, sans-serif";
    const suffixW = ctx.measureText(unitPriceSuffix).width;
    const maxNameW = Math.max(qtyPillX - textLeft - suffixW - 24, 160);

    ctx.font = "900 27px Coiny, Quicksand, sans-serif";
    ctx.fillStyle = "#4A2E2B";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    const drawnName = truncateCanvasText(ctx, item.name, maxNameW);
    ctx.fillText(drawnName, textLeft, rowMidY + 2);
    const drawnNameW = ctx.measureText(drawnName).width;

    ctx.font = "900 26px Quicksand, sans-serif";
    ctx.fillStyle = "#E86F5F";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(unitPriceSuffix, textLeft + drawnNameW, rowMidY + 1);

    // Row divider
    if (idx < opts.items.length - 1) {
      ctx.strokeStyle = "#FFE9E5";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(innerX, rowTop + itemRowH);
      ctx.lineTo(innerRight, rowTop + itemRowH);
      ctx.stroke();
    }
  });

  curY += itemsBlockH;

  // 5. Receipt Dashed Tear Line
  const tearY = curY + tearLineH / 2;
  ctx.save();
  ctx.setLineDash([10, 8]);
  ctx.strokeStyle = "#F7B3A8";
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(padX + 22, tearY);
  ctx.lineTo(padX + cardW - 22, tearY);
  ctx.stroke();
  ctx.restore();

  curY += tearLineH;

  // 6. Totals Summary Block
  ctx.fillStyle = "#FFF9F7";
  ctx.fillRect(padX, curY, cardW, totalsBlockH + customerBlockH);

  ctx.font = "700 23px Quicksand, sans-serif";
  ctx.fillStyle = "#8C6D68";
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillText("Tạm tính", innerX, curY + 38);

  ctx.font = "800 24px Quicksand, sans-serif";
  ctx.fillStyle = "#4A2E2B";
  ctx.textAlign = "right";
  ctx.fillText(formatK(opts.subtotal), innerRight, curY + 38);

  ctx.font = "700 23px Quicksand, sans-serif";
  ctx.fillStyle = "#8C6D68";
  ctx.textAlign = "left";
  ctx.fillText("Phí ship", innerX, curY + 80);

  ctx.font = "900 24px Quicksand, sans-serif";
  ctx.fillStyle = opts.shippingFee === 0 ? "#047857" : "#4A2E2B";
  ctx.textAlign = "right";
  ctx.fillText(
    opts.shippingFee === 0 ? "FREESHIP" : formatK(opts.shippingFee),
    innerRight,
    curY + 80
  );

  // Divider above Grand Total
  ctx.strokeStyle = "#FFD6D1";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(innerX, curY + 104);
  ctx.lineTo(innerRight, curY + 104);
  ctx.stroke();

  ctx.font = "900 25px Quicksand, sans-serif";
  ctx.fillStyle = "#4A2E2B";
  ctx.textAlign = "left";
  ctx.fillText("THÀNH TIỀN", innerX, curY + 156);

  ctx.font = "900 46px Quicksand, sans-serif";
  ctx.fillStyle = "#E86F5F";
  ctx.textAlign = "right";
  ctx.fillText(formatK(opts.grandTotal), innerRight, curY + 160);

  curY += totalsBlockH;

  // 7. Optional Customer Delivery Details Box
  if (custLines.length > 0) {
    const boxX = innerX;
    const boxY = curY + 4;
    const boxH = customerBlockH - 20;

    ctx.fillStyle = "#FFFFFF";
    ctx.strokeStyle = "#FFD6D1";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(boxX, boxY, innerW, boxH, 20);
    ctx.fill();
    ctx.stroke();

    let textY = boxY + 34;
    custLines.forEach((row) => {
      ctx.font = "800 20px Quicksand, sans-serif";
      ctx.fillStyle = "#8C6D68";
      ctx.textAlign = "left";
      ctx.fillText(row.label, boxX + 20, textY);

      ctx.font = "700 21px Quicksand, sans-serif";
      ctx.fillStyle = "#4A2E2B";
      row.lines.forEach((line, lIdx) => {
        ctx.fillText(line, boxX + 140, textY + lIdx * 30);
      });
      textY += row.lines.length * 30 + 12;
    });

    curY += customerBlockH;
  }

  // 8. Shop Footer
  ctx.fillStyle = "#FFF3EE";
  ctx.fillRect(padX, curY, cardW, footerH);
  ctx.strokeStyle = "#FFD6D1";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(padX, curY);
  ctx.lineTo(padX + cardW, curY);
  ctx.stroke();

  const phoneText = opts.shopPhone || "0703166903";
  const addrText =
    opts.shopAddress || "123/3 Nguyễn Hữu Cảnh, Thủ Dầu Một, TP Hồ Chí Minh";

  ctx.textAlign = "center";
  ctx.font = "800 20px Quicksand, sans-serif";
  ctx.fillStyle = "#E86F5F";
  ctx.fillText(
    `🍮 ${opts.shopName || "Tiệm bánh Flandi"} • Zalo: ${phoneText}`,
    W / 2,
    curY + 40
  );

  ctx.font = "700 18px Quicksand, sans-serif";
  ctx.fillStyle = "#8C6D68";
  ctx.fillText(addrText, W / 2, curY + 72);

  ctx.restore(); // End card clip

  // Outer card salmon border + cute ticket punch cutouts
  ctx.strokeStyle = "#F48B7E";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.roundRect(padX, padY, cardW, cardH, 36);
  ctx.stroke();

  // Ticket punch semi-circles at tearY
  [padX, padX + cardW].forEach((cx, sideIdx) => {
    ctx.save();
    ctx.fillStyle = "#FFF9F8";
    ctx.beginPath();
    ctx.arc(cx, tearY, 14, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = "#F48B7E";
    ctx.lineWidth = 3;
    ctx.beginPath();
    if (sideIdx === 0) {
      ctx.arc(cx, tearY, 14, -Math.PI / 2, Math.PI / 2);
    } else {
      ctx.arc(cx, tearY, 14, Math.PI / 2, (Math.PI * 3) / 2);
    }
    ctx.stroke();
    ctx.restore();
  });

  // 9. Export & verify PNG Blob before assigning .png filename
  const blob = await new Promise<Blob>((resolve, reject) => {
    try {
      canvas.toBlob((result) => {
        if (!result) {
          reject(new Error("Canvas export returned null blob"));
          return;
        }
        if (result.type !== "image/png") {
          reject(new Error(`Unexpected image MIME type: ${result.type}`));
          return;
        }
        resolve(result);
      }, "image/png");
    } catch (err) {
      reject(err);
    }
  });

  const stamp = opts.orderCode
    ? opts.orderCode
    : `${now.getHours().toString().padStart(2, "0")}${now
        .getMinutes()
        .toString()
        .padStart(2, "0")}`;
  const fileName = `FLANDI-HoaDon-${stamp}.png`;
  const objectUrl = URL.createObjectURL(blob);

  return { blob, objectUrl, fileName };
}
