"use client";

import React from "react";
import { useCustomerAuth } from "@/lib/customer-auth-context";

interface CustomerHeaderAuthButtonProps {
  className?: string;
}

export default function CustomerHeaderAuthButton({
  className = "",
}: CustomerHeaderAuthButtonProps) {
  const { user, loading, triggerGoogleSignIn, openAccountDrawer } =
    useCustomerAuth();

  if (loading) {
    return (
      <div className="w-8 h-8 rounded-full bg-flandi-bg animate-pulse border border-flandi-pink/50 shrink-0" />
    );
  }

  // Khi đã đăng nhập: CHỈ HIỂN THỊ LOGO / AVATAR TÀI KHOẢN (Gọn gàng chuẩn Big Tech, không bị lỗi tràn chữ trên mobile)
  if (user) {
    return (
      <button
        type="button"
        onClick={() => openAccountDrawer("orders")}
        className={`group relative p-0.5 rounded-full bg-white hover:bg-flandi-cream border-2 border-flandi-salmon/90 hover:border-flandi-coral shadow-2xs hover:shadow-cute transition active:scale-95 shrink-0 cursor-pointer ${className}`}
        title={`Tài khoản: ${user.name} (Bấm để tra cứu đơn hàng & địa chỉ)`}
        aria-label={`Tài khoản ${user.name}`}
      >
        <div className="relative w-8 h-8 sm:w-9 sm:h-9 rounded-full overflow-hidden bg-flandi-cream">
          <img
            src={
              user.picture ||
              "https://api.dicebear.com/7.x/bottts/svg?seed=flandi"
            }
            alt={user.name}
            className="w-full h-full object-cover"
          />
        </div>
        <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 border-2 border-white rounded-full shadow-xs" />
      </button>
    );
  }

  // Khi chưa đăng nhập: Nút Đăng nhập Google
  return (
    <button
      type="button"
      onClick={triggerGoogleSignIn}
      className={`group flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white hover:bg-flandi-cream/60 text-flandi-dark font-extrabold text-xs border border-flandi-pink/90 hover:border-flandi-coral shadow-2xs transition active:scale-95 cursor-pointer shrink-0 ${className}`}
      title="Đăng nhập Google để lưu địa chỉ & tra cứu đơn hàng"
    >
      {/* Google Icon 4 colors */}
      <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24">
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
      <span className="text-xs font-extrabold">Đăng nhập</span>
    </button>
  );
}
