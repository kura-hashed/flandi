"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from "react";
import { CustomerUser } from "@/lib/types";

interface CustomerAuthContextType {
  user: CustomerUser | null;
  loading: boolean;
  googleClientId: string;
  setGoogleClientId: (id: string) => void;
  saveGoogleClientId: (id: string) => Promise<{ success: boolean; error?: string }>;
  isAuthModalOpen: boolean;
  setIsAuthModalOpen: (open: boolean) => void;
  openAuthModal: () => void;
  triggerGoogleSignIn: () => void;
  isAccountDrawerOpen: boolean;
  setIsAccountDrawerOpen: (open: boolean) => void;
  accountDrawerTab: "orders" | "profile";
  setAccountDrawerTab: (tab: "orders" | "profile") => void;
  openAccountDrawer: (tab?: "orders" | "profile") => void;
  loginWithGoogle: (data: {
    credential?: string;
    accessToken?: string;
  }) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  updateProfile: (data: {
    name?: string;
    phone?: string;
    address?: string;
    deliveryNote?: string;
  }) => Promise<{ success: boolean; error?: string }>;
  refreshCustomer: () => Promise<void>;
}

const CustomerAuthContext = createContext<CustomerAuthContextType | undefined>(
  undefined
);

export function CustomerAuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<CustomerUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [googleClientId, setGoogleClientId] = useState<string>("");
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isAccountDrawerOpen, setIsAccountDrawerOpen] = useState(false);
  const [accountDrawerTab, setAccountDrawerTab] = useState<"orders" | "profile">(
    "orders"
  );

  // 1. Kiểm tra session khách hàng & lấy Google Client ID từ hệ thống
  const refreshCustomer = useCallback(async () => {
    try {
      const res = await fetch("/api/customer/auth", { cache: "no-store" });
      const data = await res.json();
      if (data.googleClientId) {
        setGoogleClientId(data.googleClientId);
      }
      if (data.authenticated && data.user) {
        setUser(data.user);
      } else {
        setUser(null);
      }
    } catch (err) {
      console.error("Failed to check customer session:", err);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshCustomer();
  }, [refreshCustomer]);

  // 2. Mở Auth Modal hoặc Drawer
  const openAuthModal = useCallback(() => {
    setIsAuthModalOpen(true);
  }, []);

  const openAccountDrawer = useCallback((tab: "orders" | "profile" = "orders") => {
    setAccountDrawerTab(tab);
    setIsAccountDrawerOpen(true);
  }, []);

  // 3. Đăng nhập Google (với Google ID Token hoặc OAuth Access Token thực tế)
  const loginWithGoogle = useCallback(
    async (data: {
      credential?: string;
      accessToken?: string;
    }): Promise<{ success: boolean; error?: string }> => {
      try {
        const res = await fetch("/api/customer/auth", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });

        const resData = await res.json();
        if (!res.ok || !resData.success) {
          return {
            success: false,
            error: resData.error || "Không thể đăng nhập bằng tài khoản Google",
          };
        }

        setUser(resData.user);
        setIsAuthModalOpen(false);
        return { success: true };
      } catch (err) {
        console.error("Google login error:", err);
        return { success: false, error: "Lỗi kết nối máy chủ khi đăng nhập" };
      }
    },
    []
  );

  // 4. Lưu cấu hình Google Client ID
  const saveGoogleClientId = useCallback(
    async (id: string): Promise<{ success: boolean; error?: string }> => {
      try {
        const res = await fetch("/api/customer/auth", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ googleClientId: id }),
        });
        const data = await res.json();
        if (!res.ok || !data.success) {
          return { success: false, error: data.error || "Lỗi lưu cấu hình" };
        }
        setGoogleClientId(id);
        return { success: true };
      } catch (err) {
        return { success: false, error: "Không thể kết nối máy chủ" };
      }
    },
    []
  );

  // 5. Tải Google Identity Services (GSI) script
  useEffect(() => {
    if (typeof window === "undefined") return;

    if (!(window as any).google?.accounts) {
      const script = document.createElement("script");
      script.src = "https://accounts.google.com/gsi/client";
      script.async = true;
      script.defer = true;
      document.body.appendChild(script);
    }
  }, []);

  // 6. Tự động kích hoạt Google One Tap (Quick Authentication) khi khách chưa đăng nhập
  useEffect(() => {
    if (typeof window === "undefined" || !googleClientId || user) return;

    let timer: NodeJS.Timeout;

    const setupGoogleOneTap = () => {
      const google = (window as any).google;
      if (!google?.accounts?.id) {
        timer = setTimeout(setupGoogleOneTap, 300);
        return;
      }

      try {
        google.accounts.id.initialize({
          client_id: googleClientId,
          callback: async (response: any) => {
            if (response?.credential) {
              await loginWithGoogle({ credential: response.credential });
            }
          },
          auto_select: true, // Quick authentication: tự động gợi ý tài khoản Google
          cancel_on_tap_outside: false,
        });

        // Hiển thị Google One Tap
        google.accounts.id.prompt((notification: any) => {
          if (notification.isNotDisplayed()) {
            console.log(
              "Google One Tap prompt not displayed:",
              notification.getNotDisplayedReason()
            );
          }
        });
      } catch (err) {
        console.warn("Google One Tap initialize warning:", err);
      }
    };

    setupGoogleOneTap();

    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [googleClientId, user, loginWithGoogle]);

  // 7. Kích hoạt trực tiếp Google Quick Authentication khi người dùng bấm nút
  const triggerGoogleSignIn = useCallback(() => {
    setIsAuthModalOpen(true);

    const google = (window as any).google;
    if (google?.accounts?.id && googleClientId) {
      try {
        google.accounts.id.prompt();
      } catch (err) {
        console.warn("Google One Tap prompt warning:", err);
      }
    }
  }, [googleClientId]);

  // 8. Đăng xuất
  const logout = async () => {
    try {
      await fetch("/api/customer/auth", { method: "DELETE" });
      setUser(null);
      setIsAccountDrawerOpen(false);
      // Thu hồi One Tap auto_select
      const google = (window as any).google;
      if (google?.accounts?.id?.disableAutoSelect) {
        google.accounts.id.disableAutoSelect();
      }
    } catch (err) {
      console.error("Logout error:", err);
    }
  };

  // 9. Cập nhật thông tin giao hàng & cá nhân
  const updateProfile = async (data: {
    name?: string;
    phone?: string;
    address?: string;
    deliveryNote?: string;
  }): Promise<{ success: boolean; error?: string }> => {
    try {
      const res = await fetch("/api/customer/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      const resData = await res.json();
      if (!res.ok || !resData.success) {
        return {
          success: false,
          error: resData.error || "Không thể lưu thông tin hồ sơ",
        };
      }

      setUser(resData.user);
      return { success: true };
    } catch (err) {
      console.error("Profile update error:", err);
      return { success: false, error: "Lỗi kết nối khi cập nhật hồ sơ" };
    }
  };

  return (
    <CustomerAuthContext.Provider
      value={{
        user,
        loading,
        googleClientId,
        setGoogleClientId,
        saveGoogleClientId,
        isAuthModalOpen,
        setIsAuthModalOpen,
        openAuthModal,
        triggerGoogleSignIn,
        isAccountDrawerOpen,
        setIsAccountDrawerOpen,
        accountDrawerTab,
        setAccountDrawerTab,
        openAccountDrawer,
        loginWithGoogle,
        logout,
        updateProfile,
        refreshCustomer,
      }}
    >
      {children}
    </CustomerAuthContext.Provider>
  );
}

export function useCustomerAuth() {
  const context = useContext(CustomerAuthContext);
  if (!context) {
    throw new Error(
      "useCustomerAuth must be used within a CustomerAuthProvider"
    );
  }
  return context;
}
