"use client";

import React, { useState, useEffect, useRef } from "react";
import { X, Sparkles, ShieldCheck, Package, Check, ArrowRight, User } from "lucide-react";
import { useCustomerAuth } from "@/lib/customer-auth-context";

interface GoogleAuthModalProps {
  googleClientId?: string;
}

export default function GoogleAuthModal({ googleClientId }: GoogleAuthModalProps) {
  const { isAuthModalOpen, setIsAuthModalOpen, loginWithGoogle } = useCustomerAuth();
  const [customEmail, setCustomEmail] = useState("");
  const [customName, setCustomName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isManualInput, setIsManualInput] = useState(false);

  const googleBtnContainerRef = useRef<HTMLDivElement | null>(null);

  const activeClientId =
    googleClientId ||
    process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ||
    "";

  // Khởi tạo Google Identity Services nếu có Google Client ID
  useEffect(() => {
    if (!isAuthModalOpen || !activeClientId) return;

    const initGsi = () => {
      if (typeof window !== "undefined" && (window as any).google?.accounts?.id) {
        try {
          (window as any).google.accounts.id.initialize({
            client_id: activeClientId,
            callback: async (response: any) => {
              if (response?.credential) {
                setIsSubmitting(true);
                setErrorMsg(null);
                const res = await loginWithGoogle({ credential: response.credential });
                setIsSubmitting(false);
                if (!res.success) {
                  setErrorMsg(res.error || "Đăng nhập Google không thành công");
                }
              }
            },
            auto_select: false,
          });

          if (googleBtnContainerRef.current) {
            googleBtnContainerRef.current.innerHTML = "";
            (window as any).google.accounts.id.renderButton(
              googleBtnContainerRef.current,
              {
                theme: "outline",
                size: "large",
                width: 320,
                text: "continue_with",
                shape: "pill",
                logo_alignment: "left",
              }
            );
          }
        } catch (err) {
          console.error("GSI Init error:", err);
        }
      }
    };

    // Load gsi script nếu chưa có
    if (!(window as any).google?.accounts?.id) {
      const script = document.createElement("script");
      script.src = "https://accounts.google.com/gsi/client";
      script.async = true;
      script.defer = true;
      script.onload = initGsi;
      document.body.appendChild(script);
    } else {
      initGsi();
    }
  }, [isAuthModalOpen, activeClientId, loginWithGoogle]);

  if (!isAuthModalOpen) return null;

  // Demo / Fast Google Profiles
  const sampleAccounts = [
    {
      name: "Nguyễn Mai Anh",
      email: "maianh.flandi@gmail.com",
      picture: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80",
    },
    {
      name: "Trần Minh Quân",
      email: "minhquan.hcm@gmail.com",
      picture: "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=100&auto=format&fit=crop&q=80",
    },
  ];

  const handleSelectSample = async (acc: { name: string; email: string; picture: string }) => {
    setIsSubmitting(true);
    setErrorMsg(null);
    const res = await loginWithGoogle({
      name: acc.name,
      email: acc.email,
      picture: acc.picture,
    });
    setIsSubmitting(false);
    if (!res.success) {
      setErrorMsg(res.error || "Đăng nhập thất bại");
    }
  };

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customEmail || !customEmail.includes("@")) {
      setErrorMsg("Vui lòng nhập địa chỉ email Google hợp lệ (ví dụ: banhflan@gmail.com)");
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);
    const res = await loginWithGoogle({
      email: customEmail.trim(),
      name: customName.trim() || customEmail.split("@")[0],
    });
    setIsSubmitting(false);
    if (!res.success) {
      setErrorMsg(res.error || "Đăng nhập thất bại");
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200"
      onClick={() => setIsAuthModalOpen(false)}
    >
      <div
        className="w-full max-w-md bg-white rounded-3xl border-2 border-flandi-salmon shadow-cute-lg overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-flandi-cream via-[#FFF3EE] to-flandi-cream px-5 py-4 border-b border-flandi-pink/80 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white border border-flandi-pink/80 shadow-2xs flex items-center justify-center shrink-0">
              {/* Google 4-color SVG Icon */}
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
            </div>
            <div>
              <h3 className="font-display text-base font-extrabold text-flandi-dark leading-tight">
                Đăng Nhập Google
              </h3>
              <p className="text-xs font-bold text-flandi-muted">
                Lưu địa chỉ & Tra cứu đơn bánh FLANDI
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setIsAuthModalOpen(false)}
            className="w-8 h-8 rounded-full bg-white/80 hover:bg-flandi-pink/50 text-flandi-dark flex items-center justify-center transition border border-flandi-pink/60"
            title="Đóng"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Value Proposition: Non-intrusive benefits */}
        <div className="p-5 space-y-4">
          <div className="bg-flandi-bg/60 rounded-2xl p-3 border border-flandi-pink/60 space-y-2">
            <div className="flex items-center gap-2 text-xs font-bold text-flandi-dark">
              <Check className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Tự động điền số điện thoại & địa chỉ giao hàng</span>
            </div>
            <div className="flex items-center gap-2 text-xs font-bold text-flandi-dark">
              <Package className="w-4 h-4 text-flandi-coral shrink-0" />
              <span>Tra cứu trạng thái mọi đơn hàng đã đặt bất cứ lúc nào</span>
            </div>
            <div className="flex items-center gap-2 text-xs font-bold text-flandi-dark">
              <Sparkles className="w-4 h-4 text-amber-500 shrink-0" />
              <span>Đặt lại món yêu thích nhanh chỉ trong 1 chạm</span>
            </div>
          </div>

          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold">
              {errorMsg}
            </div>
          )}

          {/* Official Google GSI Button Container (Rendered when Client ID is configured) */}
          {activeClientId && (
            <div className="flex flex-col items-center justify-center pt-1 pb-2">
              <div ref={googleBtnContainerRef} className="min-h-[44px]" />
              <div className="relative w-full my-3 flex items-center justify-center">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-flandi-pink/70" />
                </div>
                <span className="relative bg-white px-3 text-[11px] font-bold text-flandi-muted uppercase">
                  hoặc chọn nhanh
                </span>
              </div>
            </div>
          )}

          {/* Quick Select Profile (Instant 1-Click for best UX without typing) */}
          {!isManualInput ? (
            <div className="space-y-2.5">
              <span className="text-[11px] font-extrabold text-flandi-muted uppercase tracking-wider block">
                Chọn tài khoản Google:
              </span>

              <div className="space-y-2">
                {sampleAccounts.map((acc) => (
                  <button
                    key={acc.email}
                    type="button"
                    disabled={isSubmitting}
                    onClick={() => handleSelectSample(acc)}
                    className="w-full p-2.5 rounded-2xl border-2 border-flandi-pink/70 hover:border-flandi-coral hover:bg-flandi-cream/30 bg-white flex items-center justify-between transition group shadow-2xs text-left"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <img
                        src={acc.picture}
                        alt={acc.name}
                        className="w-9 h-9 rounded-full object-cover border border-flandi-pink shrink-0"
                      />
                      <div className="min-w-0">
                        <p className="text-xs font-black text-flandi-dark group-hover:text-flandi-coral transition-colors truncate">
                          {acc.name}
                        </p>
                        <p className="text-[11px] font-semibold text-flandi-muted truncate">
                          {acc.email}
                        </p>
                      </div>
                    </div>
                    <ArrowRight className="w-4 h-4 text-flandi-muted group-hover:text-flandi-coral transition-transform group-hover:translate-x-0.5 shrink-0 mr-1" />
                  </button>
                ))}
              </div>

              <div className="pt-1 text-center">
                <button
                  type="button"
                  onClick={() => setIsManualInput(true)}
                  className="text-xs font-extrabold text-flandi-coral hover:underline inline-flex items-center gap-1"
                >
                  <User className="w-3.5 h-3.5" />
                  <span>Dùng địa chỉ Gmail khác của bạn</span>
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleManualSubmit} className="space-y-3 pt-1">
              <span className="text-[11px] font-extrabold text-flandi-muted uppercase tracking-wider block">
                Nhập tài khoản Google của bạn:
              </span>
              <div>
                <label className="text-[11px] font-bold text-flandi-muted block mb-1">
                  Địa chỉ Gmail *
                </label>
                <input
                  type="email"
                  required
                  placeholder="vidu@gmail.com"
                  value={customEmail}
                  onChange={(e) => setCustomEmail(e.target.value)}
                  className="w-full text-xs font-bold text-flandi-dark bg-flandi-bg/50 border border-flandi-pink rounded-xl px-3 py-2.5 focus:outline-none focus:border-flandi-coral"
                />
              </div>
              <div>
                <label className="text-[11px] font-bold text-flandi-muted block mb-1">
                  Họ và tên của bạn
                </label>
                <input
                  type="text"
                  placeholder="Tên bạn muốn tiệm gọi khi giao bánh"
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  className="w-full text-xs font-bold text-flandi-dark bg-flandi-bg/50 border border-flandi-pink rounded-xl px-3 py-2.5 focus:outline-none focus:border-flandi-coral"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setIsManualInput(false)}
                  className="py-2.5 px-4 rounded-xl border border-flandi-pink text-xs font-extrabold text-flandi-muted hover:bg-flandi-bg"
                >
                  Quay lại
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-gradient-to-r from-flandi-coral to-flandi-salmon hover:opacity-95 text-white font-black text-xs shadow-cute flex items-center justify-center gap-2"
                >
                  {isSubmitting ? "Đang xử lý..." : "Tiếp tục đăng nhập"}
                </button>
              </div>
            </form>
          )}

          {/* Privacy Note: Respectful UX */}
          <div className="pt-2 border-t border-flandi-pink/50 flex items-center justify-between text-[11px] text-flandi-muted">
            <span className="flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              Bảo mật bởi Google
            </span>
            <button
              type="button"
              onClick={() => setIsAuthModalOpen(false)}
              className="font-bold hover:text-flandi-dark underline"
            >
              Để sau (Tiếp tục đặt bánh)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
