import { AccountRole, PermissionKey, RbacPolicy, UserRole } from "./types";

export const ALL_USER_ROLES: UserRole[] = ["admin", "staff", "user", "guest"];
export const ACCOUNT_ROLES: AccountRole[] = ["admin", "staff", "user"];

export const ROLE_META: Record<
  UserRole,
  {
    label: string;
    shortLabel: string;
    badgeClass: string;
    description: string;
  }
> = {
  admin: {
    label: "Admin (Quản trị)",
    shortLabel: "Admin",
    badgeClass: "bg-flandi-coral text-white border-flandi-coral",
    description: "Toàn quyền quản lý tiệm, kho, sổ sách và phân quyền tài khoản.",
  },
  staff: {
    label: "Staff (Nhân viên)",
    shortLabel: "Staff",
    badgeClass: "bg-emerald-50 text-emerald-700 border-emerald-200",
    description: "Được quyền lên đơn (/order, /pos) và xử lý đơn hàng trong ca.",
  },
  user: {
    label: "User (Khách thành viên)",
    shortLabel: "User",
    badgeClass: "bg-sky-50 text-sky-700 border-sky-200",
    description: "Đã đăng nhập Google: xem menu, lưu địa chỉ & tra cứu đơn cá nhân.",
  },
  guest: {
    label: "Guest (Khách vãng lai)",
    shortLabel: "Guest",
    badgeClass: "bg-slate-100 text-slate-600 border-slate-200",
    description: "Chưa đăng nhập: xem menu, tính tiền và Share ảnh bill.",
  },
};

export interface PermissionDefinition {
  key: PermissionKey;
  label: string;
  description: string;
  lockedRoles?: Partial<Record<UserRole, boolean>>;
}

export const PERMISSION_DEFINITIONS: PermissionDefinition[] = [
  {
    key: "menu:view",
    label: "Xem menu & Share bill",
    description: "Xem danh sách bánh, tính nhẩm thành tiền và chia sẻ ảnh bill.",
    lockedRoles: { admin: true, staff: true, user: true, guest: true },
  },
  {
    key: "orders:self",
    label: "Hồ sơ & tra cứu đơn cá nhân",
    description: "Lưu địa chỉ giao hàng và xem lịch sử đơn của chính mình.",
    lockedRoles: { admin: true, guest: false },
  },
  {
    key: "orders:create",
    label: "Lên đơn mới (/order, /pos)",
    description: "Tạo và gửi đơn hàng vào hệ thống tiệm.",
    lockedRoles: { admin: true },
  },
  {
    key: "orders:manage",
    label: "Xử lý đơn trong ca",
    description: "Xem danh sách đơn hàng và cập nhật trạng thái đơn / thanh toán.",
    lockedRoles: { admin: true, guest: false },
  },
  {
    key: "store:manage",
    label: "Quản lý cửa hàng, kho & sổ sách",
    description: "Chỉnh sửa thực đơn, kho nguyên liệu, sổ thu chi, chat & thương hiệu.",
    lockedRoles: { admin: true, user: false, guest: false },
  },
  {
    key: "users:manage",
    label: "Phân quyền & quản lý tài khoản",
    description: "Cấp/thu hồi quyền Admin, Staff, User và chỉnh ma trận quyền.",
    lockedRoles: { admin: true, staff: false, user: false, guest: false },
  },
];

export const DEFAULT_RBAC_POLICY: RbacPolicy = {
  guest: ["menu:view"],
  user: ["menu:view", "orders:self"],
  staff: ["menu:view", "orders:self", "orders:create", "orders:manage"],
  admin: [
    "menu:view",
    "orders:self",
    "orders:create",
    "orders:manage",
    "store:manage",
    "users:manage",
  ],
};

const VALID_PERMISSIONS = new Set<PermissionKey>(
  PERMISSION_DEFINITIONS.map((d) => d.key)
);

export function isAccountRole(val: unknown): val is AccountRole {
  return val === "admin" || val === "staff" || val === "user";
}

export function normalizeRbacPolicy(
  raw?: Partial<Record<UserRole, PermissionKey[]>> | null
): RbacPolicy {
  const result: RbacPolicy = {
    guest: [...DEFAULT_RBAC_POLICY.guest],
    user: [...DEFAULT_RBAC_POLICY.user],
    staff: [...DEFAULT_RBAC_POLICY.staff],
    admin: [...DEFAULT_RBAC_POLICY.admin],
  };

  if (raw && typeof raw === "object") {
    for (const role of ALL_USER_ROLES) {
      if (Array.isArray(raw[role])) {
        const filtered = Array.from(
          new Set(
            raw[role]!.filter((p): p is PermissionKey =>
              VALID_PERMISSIONS.has(p as PermissionKey)
            )
          )
        );
        result[role] = filtered;
      }
    }
  }

  // Áp dụng các ràng buộc an toàn (không bao giờ cho phép tự khoá quyền Admin hoặc cấp quyền nhạy cảm cho Guest)
  for (const def of PERMISSION_DEFINITIONS) {
    if (!def.lockedRoles) continue;
    for (const role of ALL_USER_ROLES) {
      const lockedVal = def.lockedRoles[role];
      if (lockedVal === true && !result[role].includes(def.key)) {
        result[role].push(def.key);
      } else if (lockedVal === false) {
        result[role] = result[role].filter((k) => k !== def.key);
      }
    }
  }

  return result;
}

export function getPermissionsForRole(
  role: UserRole,
  policy?: Partial<RbacPolicy> | null
): PermissionKey[] {
  const normalized = normalizeRbacPolicy(policy);
  return normalized[role] || normalized.guest;
}

export function roleCan(
  role: UserRole,
  permission: PermissionKey,
  policy?: Partial<RbacPolicy> | null
): boolean {
  return getPermissionsForRole(role, policy).includes(permission);
}
