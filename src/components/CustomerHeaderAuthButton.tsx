"use client";

import React from "react";
import { useCustomerAuth } from "@/lib/customer-auth-context";
import { Package, User, Sparkles } from "lucide-react";

interface CustomerHeaderAuthButtonProps {
  className?: string;
  variant?: "pill" | "icon" | "full";
}

export default function CustomerHeaderAuthButton({
  className = "",
  variant = "pill",
}: CustomerHeaderAuthButtonProps) {
  const { user, loading, triggerGoogleSignIn, openAccountDrawer } =
    useCustomerAuth();

  if (loading) {
    return (
      <div className="h-8 w-24 rounded-full bg-flandi-bg animate-pulse border border-flandi-pink/50" />
    );
  }

  // Nếu đã đăng nhập với Google
  if (user) {
    return (
      <button
        type="button"
        onClick={() => openAccountDrawer("orders")}
        className={`group flex items-center gap-2 pl-1 pr-3 py-1 rounded-full bg-white hover:bg-flandi-cream/60 border border-flandi-salmon/80 shadow-2xs hover:shadow-cute transition active:scale-95 ${className}`}
        title="Tài khoản & Đơn hàng của bạn"
      >
        <div className="relative shrink-0">
          <img
            src={
              user.picture ||
              "https://api.dicebear.com/7.x/bottts/svg?seed=flandi"
            }
            alt={user.name}
            className="w-7 h-7 rounded-full object-cover border border-flandi-salmon shadow-2xs"
          />
          <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-500 border-2 border-white rounded-full" />
        </div>
        <div className="text-left min-w-0">
          <span className="text-xs font-black text-flandi-dark group-hover:text-flandi-coral transition-colors truncate block max-w-[85px] sm:max-w-[110px] leading-tight">
            {user.name.split(" ").slice(-2).join(" ")}
          </span>
          <span className="text-[10px] font-bold text-flandi-coral leading-none block">
            Đơn của tôi
          </span>
        </div>
      </button>
    );
  }

  // Nếu chưa đăng nhập: Nút mời đăng nhập Google tinh tế, không làm phiền
  return (
    <div className="flex items-center gap-1.5">
      <button
        type="button"
        onClick={triggerGoogleSignIn}
        className={`group flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white hover:bg-flandi-cream/60 text-flandi-dark font-extrabold text-xs border border-flandi-pink/90 hover:border-flandi-coral shadow-2xs transition active:scale-95 cursor-pointer ${className}`}
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
        <span className="hidden sm:inline">Đăng nhập</span>
        <span className="sm:hidden">Tra cứu</span>
      </button>

      {/* Quick Lookup pill button on desktop */}
      <button
        type="button"
        onClick={() => openAccountDrawer("orders")}
        className="hidden md:inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full bg-flandi-bg hover:bg-flandi-pink/40 text-flandi-muted hover:text-flandi-dark text-xs font-bold border border-flandi-pink/60 transition shadow-2xs"
        title="Tra cứu đơn hàng bằng số điện thoại hoặc mã đơn"
      >
        <Package className="w-3.5 h-3.5 text-flandi-coral" />
        <span>Tra cứu</span>
      </button>
    </div>
  );
}
