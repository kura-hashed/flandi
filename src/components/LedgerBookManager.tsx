"use client";

import React, { useState, useMemo } from "react";
import {
  LedgerEntry,
  LedgerEntryType,
  LedgerCategory,
  Order,
  PaymentMethod,
} from "@/lib/types";
import {
  BookOpen,
  Upload,
  Plus,
  Trash2,
  Search,
  Eye,
  X,
  ArrowDownCircle,
  ArrowUpCircle,
  FileText,
  Wallet,
  Camera,
  ShoppingBag,
  CheckCircle2,
} from "lucide-react";

interface LedgerBookManagerProps {
  ledger: LedgerEntry[];
  orders: Order[];
  notify: (msg: string) => void;
  onRefresh: () => Promise<void>;
  onSendImageToPosOrder?: (imageUrl: string, noteTitle?: string) => void;
}

export function compressImageFile(file: File, maxWidth = 1200): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let width = img.width;
        let height = img.height;
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(String(e.target?.result || ""));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", 0.82));
      };
      img.onerror = () => resolve(String(e.target?.result || ""));
      img.src = String(e.target?.result || "");
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function LedgerBookManager({
  ledger,
  orders,
  notify,
  onRefresh,
  onSendImageToPosOrder,
}: LedgerBookManagerProps) {
  const [type, setType] = useState<LedgerEntryType>("EXPENSE");
  const [category, setCategory] = useState<LedgerCategory>("Nguyên liệu");
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("CASH");
  const [note, setNote] = useState("");
  const [imageUrl, setImageUrl] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);

  const [filterType, setFilterType] = useState<"ALL" | LedgerEntryType>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [previewImage, setPreviewImage] = useState<{
    url: string;
    title: string;
  } | null>(null);

  const formatVND = (n: number) =>
    new Intl.NumberFormat("vi-VN").format(Math.round(n || 0)) + "đ";

  const summary = useMemo(() => {
    const validOrders = orders.filter((o) => o.status !== "CANCELLED" && o.isPaid);
    const orderRevenue = validOrders.reduce((s, o) => s + o.total, 0);
    const extraIncome = ledger
      .filter((l) => l.type === "INCOME")
      .reduce((s, l) => s + l.amount, 0);
    const totalExpense = ledger
      .filter((l) => l.type === "EXPENSE")
      .reduce((s, l) => s + l.amount, 0);
    const netBalance = orderRevenue + extraIncome - totalExpense;
    return {
      orderRevenue,
      extraIncome,
      totalExpense,
      netBalance,
      photoCount:
        ledger.filter((l) => Boolean(l.imageUrl)).length +
        orders.filter((o) => Boolean(o.attachmentImage)).length,
    };
  }, [ledger, orders]);

  const filteredLedger = useMemo(() => {
    return ledger.filter((item) => {
      const matchType = filterType === "ALL" || item.type === filterType;
      const q = searchQuery.trim().toLowerCase();
      const matchQ =
        !q ||
        item.title.toLowerCase().includes(q) ||
        item.code.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q) ||
        (item.note || "").toLowerCase().includes(q);
      return matchType && matchQ;
    });
  }, [ledger, filterType, searchQuery]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await compressImageFile(file);
      setImageUrl(dataUrl);
      if (!title.trim()) {
        setTitle(file.name.replace(/\.[^/.]+$/, ""));
      }
      notify("📸 Đã tải ảnh chứng từ / sổ sách lên!");
    } catch (err) {
      console.error(err);
      notify("Lỗi khi đọc file ảnh!");
    }
    e.target.value = "";
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      notify("Vui lòng nhập nội dung / tiêu đề phiếu sổ sách!");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/ledger", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          category,
          title: title.trim(),
          amount: type === "NOTE_PHOTO" ? 0 : Number(amount) || 0,
          paymentMethod,
          note: note.trim(),
          imageUrl: imageUrl || undefined,
        }),
      });
      if (res.ok) {
        notify("✅ Đã lưu phiếu vào Sổ Sách & Chứng Từ!");
        setTitle("");
        setAmount(0);
        setNote("");
        setImageUrl("");
        await onRefresh();
      }
    } catch (err) {
      console.error(err);
      notify("Lỗi khi lưu sổ sách!");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (entry: LedgerEntry) => {
    if (!confirm(`Bạn có chắc muốn xoá phiếu "${entry.title}" (${entry.code})?`))
      return;
    try {
      const res = await fetch(`/api/ledger?id=${entry.id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        notify(`Đã xoá phiếu ${entry.code}`);
        await onRefresh();
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-2xl border-2 border-flandi-pink shadow-xs">
          <div className="flex items-center justify-between text-xs font-bold text-flandi-muted">
            <span>Doanh Thu Đơn Đã Thu</span>
            <ShoppingBag className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="text-2xl font-extrabold text-emerald-600 mt-1">
            +{formatVND(summary.orderRevenue)}
          </p>
          <span className="text-[11px] text-flandi-muted font-semibold">
            Tự động tổng hợp từ đơn POS & Web
          </span>
        </div>

        <div className="bg-white p-4 rounded-2xl border-2 border-flandi-pink shadow-xs">
          <div className="flex items-center justify-between text-xs font-bold text-flandi-muted">
            <span>Phiếu Thu Ngoài Sổ Sách</span>
            <ArrowUpCircle className="w-4 h-4 text-blue-600" />
          </div>
          <p className="text-2xl font-extrabold text-blue-600 mt-1">
            +{formatVND(summary.extraIncome)}
          </p>
          <span className="text-[11px] text-flandi-muted font-semibold">
            Thu cọc tiệc, phụ thu, thu khác
          </span>
        </div>

        <div className="bg-white p-4 rounded-2xl border-2 border-flandi-pink shadow-xs">
          <div className="flex items-center justify-between text-xs font-bold text-flandi-muted">
            <span>Tổng Chi Hoá Đơn / Nguyên Liệu</span>
            <ArrowDownCircle className="w-4 h-4 text-flandi-coral" />
          </div>
          <p className="text-2xl font-extrabold text-flandi-coral mt-1">
            -{formatVND(summary.totalExpense)}
          </p>
          <span className="text-[11px] text-flandi-muted font-semibold">
            Chi mua trứng, sữa, hộp, đá gel...
          </span>
        </div>

        <div className="bg-flandi-dark text-white p-4 rounded-2xl border-2 border-flandi-salmon shadow-cute">
          <div className="flex items-center justify-between text-xs font-bold text-flandi-pink">
            <span>Thực Tồn Sổ Quỹ (Thu - Chi)</span>
            <Wallet className="w-4 h-4 text-flandi-salmon" />
          </div>
          <p className="text-2xl font-extrabold text-white mt-1">
            {formatVND(summary.netBalance)}
          </p>
          <span className="text-[11px] text-flandi-pink/80 font-semibold">
            Đã lưu {summary.photoCount} ảnh hoá đơn & sổ sách
          </span>
        </div>
      </div>

      {/* Main Grid: Left 5 cols Upload & Create Form | Right 7 cols Ledger List */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left 5 Cols: Upload Photo for Ledger / Bookkeeping or Convert to POS Order */}
        <form
          onSubmit={handleSubmit}
          className="lg:col-span-5 bg-white rounded-3xl border-2 border-flandi-salmon shadow-cute p-5 space-y-4"
        >
          <div className="flex items-center justify-between border-b border-flandi-pink pb-3">
            <div>
              <h3 className="font-extrabold text-base text-flandi-dark flex items-center gap-2">
                <Camera className="w-5 h-5 text-flandi-coral" />
                <span>Up Ảnh Sổ Sách & Hoá Đơn</span>
              </h3>
              <p className="text-xs text-flandi-muted font-semibold">
                Lưu ảnh hoá đơn đi chợ, biên lai thu chi hoặc sổ ghi chép ca
              </p>
            </div>
          </div>

          {/* Image Upload Dropzone */}
          <div className="space-y-2">
            {!imageUrl ? (
              <label className="cursor-pointer flex flex-col items-center justify-center border-2 border-dashed border-flandi-salmon rounded-2xl p-6 bg-flandi-bg hover:bg-flandi-pink/30 transition text-center">
                <div className="w-12 h-12 rounded-2xl bg-flandi-coral text-white flex items-center justify-center shadow-xs mb-2">
                  <Upload className="w-6 h-6" />
                </div>
                <span className="text-xs font-extrabold text-flandi-dark">
                  Bấm để tải ảnh hoá đơn / sổ ghi chép / đơn viết tay
                </span>
                <span className="text-[11px] text-flandi-muted font-semibold mt-0.5">
                  Hỗ trợ ảnh chụp điện thoại, ảnh màn hình Zalo/Bill (JPG, PNG)
                </span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </label>
            ) : (
              <div className="relative rounded-2xl border-2 border-flandi-salmon overflow-hidden bg-flandi-bg p-2 space-y-2">
                <div className="relative h-48 rounded-xl overflow-hidden bg-black/5">
                  <img
                    src={imageUrl}
                    alt="Preview"
                    className="w-full h-full object-contain"
                  />
                  <button
                    type="button"
                    onClick={() => setImageUrl("")}
                    className="absolute top-2 right-2 w-8 h-8 rounded-full bg-red-600 text-white flex items-center justify-center shadow-md"
                    title="Xoá ảnh"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {onSendImageToPosOrder && (
                  <button
                    type="button"
                    onClick={() => onSendImageToPosOrder(imageUrl, title)}
                    className="w-full py-2 px-3 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-extrabold text-xs flex items-center justify-center gap-1.5 shadow-xs transition"
                  >
                    <ShoppingBag className="w-4 h-4" />
                    <span>Chuyển ảnh này sang Màn Hình Thu Ngân để Lên Đơn POS</span>
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Entry Type Selector */}
          <div className="grid grid-cols-3 gap-1.5 p-1 bg-flandi-bg rounded-xl border border-flandi-pink">
            {(
              [
                { id: "EXPENSE", label: "💸 Phiếu Chi" },
                { id: "INCOME", label: "💰 Phiếu Thu" },
                { id: "NOTE_PHOTO", label: "📒 Sổ Ghi Chép" },
              ] as { id: LedgerEntryType; label: string }[]
            ).map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => {
                  setType(t.id);
                  if (t.id === "NOTE_PHOTO") {
                    setCategory("Sổ ghi chép / Kiểm ca");
                  } else if (t.id === "INCOME") {
                    setCategory("Doanh thu ngoài");
                  } else {
                    setCategory("Nguyên liệu");
                  }
                }}
                className={`py-2 rounded-lg text-xs font-extrabold transition ${
                  type === t.id
                    ? "bg-flandi-coral text-white shadow-2xs"
                    : "text-flandi-dark hover:bg-flandi-cream"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="space-y-3 text-xs">
            <div>
              <label className="font-bold text-flandi-muted block mb-1">
                Tiêu đề phiếu / Nội dung sổ sách *
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={
                  type === "EXPENSE"
                    ? "VD: Mua 100 trứng gà ta + 10L sữa tươi..."
                    : type === "INCOME"
                    ? "VD: Thu tiền đặt cọc đơn tiệc sinh nhật..."
                    : "VD: Ảnh chụp sổ bàn giao ca tối / kiểm mẻ bánh..."
                }
                className="w-full px-3 py-2 rounded-xl border border-flandi-pink font-bold focus:border-flandi-coral focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="font-bold text-flandi-muted block mb-1">
                  Hạng mục sổ sách
                </label>
                <select
                  value={category}
                  onChange={(e) =>
                    setCategory(e.target.value as LedgerCategory)
                  }
                  className="w-full px-3 py-2 rounded-xl border border-flandi-pink font-bold bg-white"
                >
                  <option value="Nguyên liệu">Nguyên liệu</option>
                  <option value="Bao bì & Hộp">Bao bì & Hộp</option>
                  <option value="Vận chuyển / Ship">Vận chuyển / Ship</option>
                  <option value="Vận hành / Điện nước">Vận hành / Điện nước</option>
                  <option value="Doanh thu ngoài">Doanh thu ngoài</option>
                  <option value="Sổ ghi chép / Kiểm ca">Sổ ghi chép / Kiểm ca</option>
                  <option value="Khác">Khác</option>
                </select>
              </div>

              {type !== "NOTE_PHOTO" && (
                <div>
                  <label className="font-bold text-flandi-muted block mb-1">
                    Số tiền (VNĐ)
                  </label>
                  <input
                    type="number"
                    min={0}
                    step={1000}
                    value={amount || ""}
                    onChange={(e) => setAmount(Number(e.target.value) || 0)}
                    placeholder="VD: 250000"
                    className="w-full px-3 py-2 rounded-xl border border-flandi-pink font-extrabold text-flandi-coral"
                  />
                </div>
              )}
            </div>

            {type !== "NOTE_PHOTO" && (
              <div>
                <label className="font-bold text-flandi-muted block mb-1">
                  Hình thức thanh toán
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(["CASH", "VIETQR", "MOMO"] as PaymentMethod[]).map((pm) => (
                    <button
                      key={pm}
                      type="button"
                      onClick={() => setPaymentMethod(pm)}
                      className={`py-1.5 rounded-xl border font-extrabold text-xs transition ${
                        paymentMethod === pm
                          ? "border-flandi-coral bg-flandi-salmon/15 text-flandi-coral"
                          : "border-flandi-pink text-flandi-dark"
                      }`}
                    >
                      {pm === "CASH"
                        ? "Tiền mặt"
                        : pm === "VIETQR"
                        ? "Chuyển khoản"
                        : "Ví MoMo"}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div>
              <label className="font-bold text-flandi-muted block mb-1">
                Ghi chú chi tiết (tuỳ chọn)
              </label>
              <textarea
                rows={2}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Ghi chú người giao, số lượng, người nhận bàn giao..."
                className="w-full px-3 py-2 rounded-xl border border-flandi-pink font-medium focus:border-flandi-coral focus:outline-none"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3 rounded-2xl bg-flandi-coral hover:bg-flandi-salmon text-white font-extrabold text-xs shadow-cute flex items-center justify-center gap-2 transition"
          >
            <Plus className="w-4 h-4" />
            <span>
              {submitting ? "Đang lưu..." : "Lưu Vào Sổ Sách & Kho Chứng Từ"}
            </span>
          </button>
        </form>

        {/* Right 7 Cols: Ledger History & Receipt Photo Gallery */}
        <div className="lg:col-span-7 space-y-4">
          {/* Filter Bar */}
          <div className="bg-white p-4 rounded-2xl border border-flandi-pink shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto">
              {[
                { id: "ALL", label: `Tất cả (${ledger.length})` },
                {
                  id: "EXPENSE",
                  label: `Phiếu Chi (${
                    ledger.filter((l) => l.type === "EXPENSE").length
                  })`,
                },
                {
                  id: "INCOME",
                  label: `Phiếu Thu (${
                    ledger.filter((l) => l.type === "INCOME").length
                  })`,
                },
                {
                  id: "NOTE_PHOTO",
                  label: `Ảnh Sổ Ghi Chép (${
                    ledger.filter((l) => l.type === "NOTE_PHOTO").length
                  })`,
                },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() =>
                    setFilterType(tab.id as "ALL" | LedgerEntryType)
                  }
                  className={`px-3 py-1.5 rounded-xl text-xs font-extrabold whitespace-nowrap transition ${
                    filterType === tab.id
                      ? "bg-flandi-coral text-white"
                      : "bg-flandi-bg text-flandi-dark hover:bg-flandi-pink/40"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="relative w-full sm:w-52">
              <Search className="w-4 h-4 text-flandi-muted absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Tìm mã phiếu, nguyên liệu..."
                className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-flandi-pink text-xs font-semibold focus:border-flandi-coral focus:outline-none"
              />
            </div>
          </div>

          {/* Entries List */}
          <div className="space-y-3">
            {filteredLedger.length === 0 ? (
              <div className="bg-white rounded-3xl border border-dashed border-flandi-pink p-12 text-center text-xs text-flandi-muted font-bold">
                Chưa có phiếu sổ sách / chứng từ nào trong mục này.
              </div>
            ) : (
              filteredLedger.map((entry) => (
                <div
                  key={entry.id}
                  className="bg-white rounded-2xl border-2 border-flandi-pink hover:border-flandi-salmon p-4 transition flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-2xs"
                >
                  <div className="flex items-start gap-3.5 min-w-0 flex-1">
                    {entry.imageUrl ? (
                      <button
                        type="button"
                        onClick={() =>
                          setPreviewImage({
                            url: entry.imageUrl!,
                            title: `${entry.code} — ${entry.title}`,
                          })
                        }
                        className="relative w-16 h-16 rounded-2xl overflow-hidden border-2 border-flandi-salmon shrink-0 group bg-flandi-bg"
                        title="Bấm để phóng to ảnh chứng từ"
                      >
                        <img
                          src={entry.imageUrl}
                          alt={entry.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition"
                        />
                        <span className="absolute inset-0 bg-black/35 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition">
                          <Eye className="w-4 h-4" />
                        </span>
                      </button>
                    ) : (
                      <div className="w-16 h-16 rounded-2xl bg-flandi-bg border border-flandi-pink flex items-center justify-center text-flandi-muted shrink-0">
                        <FileText className="w-6 h-6" />
                      </div>
                    )}

                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="font-extrabold text-xs text-flandi-coral">
                          #{entry.code}
                        </span>
                        <span
                          className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                            entry.type === "EXPENSE"
                              ? "bg-red-100 text-red-700"
                              : entry.type === "INCOME"
                              ? "bg-emerald-100 text-emerald-700"
                              : "bg-amber-100 text-amber-800"
                          }`}
                        >
                          {entry.type === "EXPENSE"
                            ? "Phiếu Chi"
                            : entry.type === "INCOME"
                            ? "Phiếu Thu"
                            : "Ảnh Sổ Ghi Chép"}
                        </span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-flandi-bg border border-flandi-pink text-flandi-dark">
                          {entry.category}
                        </span>
                        <span className="text-[11px] text-flandi-muted">
                          {new Date(entry.createdAt).toLocaleString("vi-VN")}
                        </span>
                      </div>

                      <h4 className="font-extrabold text-sm text-flandi-dark">
                        {entry.title}
                      </h4>

                      {entry.note && (
                        <p className="text-xs text-flandi-muted font-medium">
                          Ghi chú: {entry.note}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-2 shrink-0 border-t sm:border-t-0 pt-2 sm:pt-0 border-flandi-pink/50">
                    {entry.type !== "NOTE_PHOTO" && (
                      <div className="text-right mr-2">
                        <span
                          className={`font-extrabold text-base block ${
                            entry.type === "EXPENSE"
                              ? "text-flandi-coral"
                              : "text-emerald-600"
                          }`}
                        >
                          {entry.type === "EXPENSE" ? "-" : "+"}
                          {formatVND(entry.amount)}
                        </span>
                        <span className="text-[10px] font-bold text-flandi-muted">
                          {entry.paymentMethod}
                        </span>
                      </div>
                    )}

                    {entry.imageUrl && onSendImageToPosOrder && (
                      <button
                        type="button"
                        onClick={() =>
                          onSendImageToPosOrder(entry.imageUrl!, entry.title)
                        }
                        className="px-2.5 py-2 rounded-xl bg-flandi-cream hover:bg-flandi-pink/60 text-flandi-coral text-xs font-extrabold flex items-center gap-1"
                        title="Dùng ảnh này để lên đơn POS"
                      >
                        <ShoppingBag className="w-3.5 h-3.5" />
                        <span className="hidden md:inline">Lên đơn</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => handleDelete(entry)}
                      className="p-2 rounded-xl bg-red-50 hover:bg-red-100 text-red-600 transition"
                      title="Xoá phiếu"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Lightbox Modal for Receipt / Ledger Image */}
      {previewImage && (
        <div
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setPreviewImage(null)}
        >
          <div
            className="bg-white rounded-3xl max-w-2xl w-full p-4 space-y-3 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-flandi-pink pb-2">
              <h4 className="font-extrabold text-sm text-flandi-dark truncate">
                {previewImage.title}
              </h4>
              <button
                type="button"
                onClick={() => setPreviewImage(null)}
                className="p-1.5 rounded-full bg-flandi-bg hover:bg-flandi-pink/50"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="max-h-[75vh] overflow-auto rounded-2xl bg-black/5 flex items-center justify-center">
              <img
                src={previewImage.url}
                alt={previewImage.title}
                className="max-w-full max-h-[72vh] object-contain"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
