"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  ReactNode,
} from "react";
import { CustomerUser, PermissionKey, UserRole } from "@/lib/types";
import { DEFAULT_RBAC_POLICY } from "@/lib/rbac";

interface CustomerAuthContextType {
  user: CustomerUser | null;
  role: UserRole;
  permissions: PermissionKey[];
  isPinAdmin: boolean;
  can: (permission: PermissionKey) => boolean;
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
  const [role, setRole] = useState<UserRole>("guest");
  const [permissions, setPermissions] = useState<PermissionKey[]>(
    DEFAULT_RBAC_POLICY.guest
  );
  const [isPinAdmin, setIsPinAdmin] = useState<boolean>(false);
  const [loading, setLoading] = useState(true);
  const [googleClientId, setGoogleClientId] = useState<string>("");
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isAccountDrawerOpen, setIsAccountDrawerOpen] = useState(false);
  const [accountDrawerTab, setAccountDrawerTab] = useState<"orders" | "profile">(
    "orders"
  );

  const permissionSet = useMemo(() => new Set(permissions), [permissions]);
  const can = useCallback(
    (permission: PermissionKey) => permissionSet.has(permission),
    [permissionSet]
  );

  // 1. Kiểm tra session người dùng, quyền RBAC thực tế & Google Client ID
  const refreshCustomer = useCallback(async () => {
    try {
      const res = await fetch("/api/customer/auth", { cache: "no-store" });
      const data = await res.json();
      if (data.googleClientId) {
        setGoogleClientId(data.googleClientId);
      }
      setUser(data.authenticated && data.user ? data.user : null);
      setRole((data.role as UserRole) || "guest");
      setIsPinAdmin(Boolean(data.isPinAdmin));
      setPermissions(
        Array.isArray(data.permissions)
          ? data.permissions
          : DEFAULT_RBAC_POLICY.guest
      );
    } catch (err) {
      console.error("Failed to check customer session:", err);
      setUser(null);
      setRole("guest");
      setIsPinAdmin(false);
      setPermissions(DEFAULT_RBAC_POLICY.guest);
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
        setRole((resData.role as UserRole) || resData.user?.role || "user");
        setIsPinAdmin(Boolean(resData.isPinAdmin));
        if (Array.isArray(resData.permissions)) {
          setPermissions(resData.permissions);
        }
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
      } catch {
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

  // 6. Tự động kích hoạt Google One Tap khi chưa đăng nhập
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
          auto_select: true,
          cancel_on_tap_outside: false,
        });

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

  // 7. Kích hoạt trực tiếp Google Sign-In
  const triggerGoogleSignIn = useCallback(() => {
    if (!googleClientId) {
      console.warn("Chưa cấu hình Google Client ID");
      return;
    }

    const google = (window as any).google;

    if (google?.accounts?.oauth2) {
      try {
        const client = google.accounts.oauth2.initTokenClient({
          client_id: googleClientId,
          scope: "email profile openid",
          callback: async (tokenResponse: any) => {
            if (tokenResponse?.access_token) {
              await loginWithGoogle({ accessToken: tokenResponse.access_token });
            }
          },
        });
        client.requestAccessToken({ prompt: "select_account" });
        return;
      } catch (err) {
        console.warn("Google OAuth popup error, falling back to direct redirect:", err);
      }
    }

    if (typeof window !== "undefined") {
      const redirectUri = window.location.origin + "/auth/callback";
      const googleAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${encodeURIComponent(
        googleClientId
      )}&redirect_uri=${encodeURIComponent(
        redirectUri
      )}&response_type=token&scope=${encodeURIComponent(
        "email profile openid"
      )}&prompt=select_account`;

      window.location.href = googleAuthUrl;
    }
  }, [googleClientId, loginWithGoogle]);

  // 8. Đăng xuất
  const logout = async () => {
    try {
      await fetch("/api/customer/auth", { method: "DELETE" });
      await fetch("/api/auth", { method: "DELETE" });
      setUser(null);
      setRole("guest");
      setIsPinAdmin(false);
      setPermissions(DEFAULT_RBAC_POLICY.guest);
      setIsAccountDrawerOpen(false);
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
        role,
        permissions,
        isPinAdmin,
        can,
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
