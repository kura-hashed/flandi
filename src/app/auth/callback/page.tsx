"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useCustomerAuth } from "@/lib/customer-auth-context";

export default function GoogleAuthCallbackPage() {
  const router = useRouter();
  const { loginWithGoogle } = useCustomerAuth();
  const processedRef = useRef(false);

  useEffect(() => {
    if (processedRef.current || typeof window === "undefined") return;
    processedRef.current = true;

    const hash = window.location.hash.substring(1);
    const params = new URLSearchParams(hash);
    const accessToken = params.get("access_token");

    if (accessToken) {
      loginWithGoogle({ accessToken }).then(() => {
        router.replace("/order");
      });
    } else {
      router.replace("/order");
    }
  }, [loginWithGoogle, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#FFF9F8]">
      <div className="text-center space-y-3 p-6 bg-white rounded-3xl border border-flandi-pink shadow-cute max-w-sm w-full mx-4">
        <div className="w-10 h-10 border-4 border-flandi-coral border-t-transparent rounded-full animate-spin mx-auto" />
        <h3 className="font-display text-base font-extrabold text-flandi-dark">
          Đang xác thực Google...
        </h3>
        <p className="text-xs text-flandi-muted">
          Vui lòng đợi trong giây lát, đang đăng nhập vào FLANDI
        </p>
      </div>
    </div>
  );
}
