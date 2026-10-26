"use client";

import React, { useState, useEffect, useRef } from "react";
import { X, Sparkles, ShieldCheck, Package, Check, KeyRound, ExternalLink } from "lucide-react";
import { useCustomerAuth } from "@/lib/customer-auth-context";

interface GoogleAuthModalProps {
  googleClientId?: string;
}

export default function GoogleAuthModal({ googleClientId: propClientId }: GoogleAuthModalProps) {
  const {
    isAuthModalOpen,
    setIsAuthModalOpen,
    googleClientId,
    saveGoogleClientId,
    triggerGoogleSignIn,
    loginWithGoogle,
  } = useCustomerAuth();

  const [inputClientId, setInputClientId] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const googleBtnContainerRef = useRef<HTMLDivElement | null>(null);

  const activeClientId = propClientId || googleClientId;

  // Render official Google Sign In button khi modal mở và đã có activeClientId
  useEffect(() => {
    if (!isAuthModalOpen || !activeClientId || typeof window === "undefined") return;

    let timer: NodeJS.Timeout;

    const renderGoogleButton = () => {
      const google = (window as any).google;
      if (!google?.accounts?.id || !googleBtnContainerRef.current) {
        timer = setTimeout(renderGoogleButton, 200);
        return;
      }

      try {
        googleBtnContainerRef.current.innerHTML = "";
        google.accounts.id.initialize({
          client_id: activeClientId,
          callback: async (response: any) => {
            if (response?.credential) {
              const res = await loginWithGoogle({ credential: response.credential });
              if (!res.success) {
                setErrorMsg(res.error || "Đăng nhập Google thất bại");
              }
            }
          },
          auto_select: false,
        });

        google.accounts.id.renderButton(googleBtnContainerRef.current, {
          theme: "outline",
          size: "large",
          type: "standard",
          shape: "pill",
          text: "continue_with",
          logo_alignment: "left",
          width: 320,
        });
      } catch (err) {
        console.error("Failed to render Google Sign-In button:", err);
      }
    };

    renderGoogleButton();

    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [isAuthModalOpen, activeClientId, loginWithGoogle]);

  if (!isAuthModalOpen) return null;

  const handleSaveClientId = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanId = inputClientId.trim();
    if (!cleanId || !cleanId.includes(".apps.googleusercontent.com")) {
      setErrorMsg("Vui lòng nhập Google Client ID hợp lệ (kết thúc bằng .apps.googleusercontent.com)");
      return;
    }

    setIsSaving(true);
    setErrorMsg(null);
    const res = await saveGoogleClientId(cleanId);
    setIsSaving(false);

    if (res.success) {
      // Tự động kích hoạt đăng nhập Google
      setTimeout(() => {
        triggerGoogleSignIn();
      }, 300);
    } else {
      setErrorMsg(res.error || "Không thể lưu Google Client ID");
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
                Quick Authentication with Google
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setIsAuthModalOpen(false)}
            className="w-8 h-8 rounded-full bg-white/80 hover:bg-flandi-pink/50 text-flandi-dark flex items-center justify-center transition border border-flandi-pink/60 cursor-pointer"
            title="Đóng"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body Content */}
        <div className="p-5 space-y-4">
          {/* Lợi ích khi đăng nhập */}
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

          {/* TRƯỜNG HỢP 1: ĐÃ CÓ GOOGLE CLIENT ID -> HIỂN THỊ NÚT GOOGLE CHUẨN */}
          {activeClientId ? (
            <div className="space-y-3 pt-2">
              <p className="text-xs font-bold text-slate-600 text-center">
                Đăng nhập nhanh chóng và bảo mật bằng tài khoản Google của bạn:
              </p>

              {/* Official Google Button Rendered by GSI */}
              <div className="flex justify-center items-center min-h-[46px] my-2">
                <div ref={googleBtnContainerRef} className="flex justify-center" />
              </div>

              {/* Native Google OAuth Popup Button */}
              <button
                type="button"
                onClick={triggerGoogleSignIn}
                className="w-full py-2.5 px-4 rounded-2xl border-2 border-flandi-pink/80 hover:border-flandi-coral bg-white hover:bg-flandi-cream/30 text-flandi-dark font-extrabold text-xs flex items-center justify-center gap-2 shadow-2xs transition cursor-pointer"
              >
                <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
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
                <span>Mở cửa sổ chọn tài khoản Google</span>
              </button>
            </div>
          ) : (
            /* TRƯỜNG HỢP 2: CHƯA CÓ GOOGLE CLIENT ID -> HƯỚNG DẪN KÍCH HOẠT NHANH */
            <form onSubmit={handleSaveClientId} className="space-y-3 pt-1">
              <div className="p-3 bg-amber-50/80 rounded-2xl border border-amber-200 text-amber-900 text-xs space-y-1">
                <div className="font-extrabold flex items-center gap-1.5">
                  <KeyRound className="w-4 h-4 text-amber-600" />
                  <span>Kích hoạt Google Quick Authentication</span>
                </div>
                <p className="text-[11px] leading-relaxed">
                  Để đăng nhập tài khoản Google thực tế, hãy dán <strong>Google Client ID</strong> của bạn bên dưới (hoặc cấu hình biến môi trường <code>NEXT_PUBLIC_GOOGLE_CLIENT_ID</code>).
                </p>
              </div>

              <div>
                <label className="text-[11px] font-extrabold text-flandi-dark block mb-1">
                  Google Client ID (Web Application) *
                </label>
                <input
                  type="text"
                  required
                  placeholder="xxxx-xxxxxxxx.apps.googleusercontent.com"
                  value={inputClientId}
                  onChange={(e) => setInputClientId(e.target.value)}
                  className="w-full text-xs font-bold text-flandi-dark bg-white border border-flandi-pink rounded-xl px-3 py-2.5 focus:outline-none focus:border-flandi-coral"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <button
                  type="submit"
                  disabled={isSaving}
                  className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-flandi-coral to-flandi-salmon hover:opacity-95 text-white font-black text-xs shadow-cute flex items-center justify-center gap-2 cursor-pointer"
                >
                  {isSaving ? "Đang lưu cấu hình..." : "Lưu & Bắt đầu Đăng nhập Google"}
                </button>
              </div>

              <div className="text-center pt-1">
                <a
                  href="https://console.cloud.google.com/apis/credentials"
                  target="_blank"
                  rel="noreferrer"
                  className="text-[11px] font-bold text-flandi-coral hover:underline inline-flex items-center gap-1"
                >
                  <span>Lấy Client ID từ Google Cloud Console</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </form>
          )}

          {/* Privacy Note */}
          <div className="pt-2 border-t border-flandi-pink/50 flex items-center justify-between text-[11px] text-flandi-muted">
            <span className="flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              Bảo mật bởi Google
            </span>
            <button
              type="button"
              onClick={() => setIsAuthModalOpen(false)}
              className="font-bold hover:text-flandi-dark underline cursor-pointer"
            >
              Để sau (Tiếp tục đặt bánh)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
