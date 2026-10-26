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
  isAuthModalOpen: boolean;
  setIsAuthModalOpen: (open: boolean) => void;
  openAuthModal: () => void;
  isAccountDrawerOpen: boolean;
  setIsAccountDrawerOpen: (open: boolean) => void;
  accountDrawerTab: "orders" | "profile";
  setAccountDrawerTab: (tab: "orders" | "profile") => void;
  openAccountDrawer: (tab?: "orders" | "profile") => void;
  loginWithGoogle: (data: {
    credential?: string;
    email?: string;
    name?: string;
    picture?: string;
    phone?: string;
    address?: string;
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
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isAccountDrawerOpen, setIsAccountDrawerOpen] = useState(false);
  const [accountDrawerTab, setAccountDrawerTab] = useState<"orders" | "profile">(
    "orders"
  );

  // 1. Kiểm tra session khách hàng hiện tại
  const refreshCustomer = useCallback(async () => {
    try {
      const res = await fetch("/api/customer/auth", { cache: "no-store" });
      const data = await res.json();
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

  // 2. Mở Auth Modal hoặc Drawer trực tiếp vào tab mong muốn
  const openAuthModal = useCallback(() => {
    setIsAuthModalOpen(true);
  }, []);

  const openAccountDrawer = useCallback((tab: "orders" | "profile" = "orders") => {
    setAccountDrawerTab(tab);
    setIsAccountDrawerOpen(true);
  }, []);

  // 3. Đăng nhập Google
  const loginWithGoogle = async (data: {
    credential?: string;
    email?: string;
    name?: string;
    picture?: string;
    phone?: string;
    address?: string;
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
  };

  // 4. Đăng xuất
  const logout = async () => {
    try {
      await fetch("/api/customer/auth", { method: "DELETE" });
      setUser(null);
      setIsAccountDrawerOpen(false);
    } catch (err) {
      console.error("Logout error:", err);
    }
  };

  // 5. Cập nhật thông tin giao hàng & cá nhân
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
        isAuthModalOpen,
        setIsAuthModalOpen,
        openAuthModal,
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
