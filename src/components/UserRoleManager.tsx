"use client";

import React, { useEffect, useMemo, useState, useCallback } from "react";
import {
  ShieldCheck,
  UserPlus,
  Users,
  Search,
  Trash2,
  Check,
  Lock,
  History,
  RefreshCw,
  Zap,
} from "lucide-react";
import {
  AccountRole,
  AuditLogEntry,
  CustomerUser,
  PermissionKey,
  RbacPolicy,
  UserRole,
} from "@/lib/types";
import {
  ACCOUNT_ROLES,
  ALL_USER_ROLES,
  DEFAULT_RBAC_POLICY,
  PERMISSION_DEFINITIONS,
  ROLE_META,
} from "@/lib/rbac";

interface UserRoleManagerProps {
  notify: (msg: string) => void;
  onAuthChanged?: () => Promise<void> | void;
}

interface CurrentActorInfo {
  role: UserRole;
  authMethod: "pin" | "google" | "none";
  isPinAdmin: boolean;
  user: CustomerUser | null;
}

export default function UserRoleManager({
  notify,
  onAuthChanged,
}: UserRoleManagerProps) {
  const [users, setUsers] = useState<CustomerUser[]>([]);
  const [rbacPolicy, setRbacPolicy] = useState<RbacPolicy>(DEFAULT_RBAC_POLICY);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [currentActor, setCurrentActor] = useState<CurrentActorInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingPolicy, setSavingPolicy] = useState(false);

  // Form cấp quyền nhanh theo Email
  const [newEmail, setNewEmail] = useState("");
  const [newName, setNewName] = useState("");
  const [newRole, setNewRole] = useState<AccountRole>("staff");
  const [isAddingUser, setIsAddingUser] = useState(false);

  // Tìm kiếm & lọc danh sách tài khoản
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<"ALL" | AccountRole>("ALL");
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/users", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) {
        notify(`⚠️ ${data.error || "Không thể tải danh sách phân quyền"}`);
        return;
      }
      setUsers(data.users || []);
      if (data.rbacPolicy) setRbacPolicy(data.rbacPolicy);
      setAuditLogs(data.auditLogs || []);
      setCurrentActor(data.currentActor || null);
    } catch (err) {
      console.error("Failed to load RBAC users:", err);
      notify("⚠️ Lỗi kết nối khi tải dữ liệu phân quyền");
    } finally {
      setLoading(false);
    }
  }, [notify]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const roleCounts = useMemo(() => {
    return {
      admin: users.filter((u) => u.role === "admin").length,
      staff: users.filter((u) => u.role === "staff").length,
      user: users.filter((u) => !u.role || u.role === "user").length,
    };
  }, [users]);

  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      const uRole: AccountRole = u.role || "user";
      if (roleFilter !== "ALL" && uRole !== roleFilter) return false;
      const q = searchQuery.trim().toLowerCase();
      if (!q) return true;
      return (
        u.email.toLowerCase().includes(q) ||
        u.name.toLowerCase().includes(q) ||
        (u.phone && u.phone.includes(q))
      );
    });
  }, [users, roleFilter, searchQuery]);

  const handleUpsertByEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    const email = newEmail.trim().toLowerCase();
    if (!email) {
      notify("⚠️ Vui lòng nhập địa chỉ email Google");
      return;
    }

    setIsAddingUser(true);
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          name: newName.trim() || undefined,
          role: newRole,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        notify(`⚠️ ${data.error || "Không thể cấp quyền"}`);
        return;
      }
      setUsers(data.users || []);
      setAuditLogs(data.auditLogs || []);
      setNewEmail("");
      setNewName("");
      notify(`✅ Đã gán quyền ${ROLE_META[newRole].shortLabel} cho ${email}`);
      await onAuthChanged?.();
    } catch {
      notify("⚠️ Lỗi kết nối khi lưu phân quyền");
    } finally {
      setIsAddingUser(false);
    }
  };

  const handlePromoteSelf = async () => {
    if (!currentActor?.user) return;
    setUpdatingUserId(currentActor.user.id);
    try {
      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: currentActor.user.id,
          role: "admin",
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        notify(`⚠️ ${data.error || "Không thể nâng quyền"}`);
        return;
      }
      setUsers(data.users || []);
      setAuditLogs(data.auditLogs || []);
      setCurrentActor((prev) =>
        prev && prev.user
          ? { ...prev, user: { ...prev.user, role: "admin" } }
          : prev
      );
      notify(`🎉 Đã gán quyền Admin cho ${currentActor.user.email}!`);
      await onAuthChanged?.();
    } catch {
      notify("⚠️ Lỗi kết nối khi nâng quyền");
    } finally {
      setUpdatingUserId(null);
    }
  };

  const handleChangeUserRole = async (userId: string, nextRole: AccountRole) => {
    setUpdatingUserId(userId);
    try {
      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, role: nextRole }),
      });
      const data = await res.json();
      if (!res.ok) {
        notify(`⚠️ ${data.error || "Không thể đổi vai trò"}`);
        return;
      }
      setUsers(data.users || []);
      setAuditLogs(data.auditLogs || []);
      notify(`✅ Đã cập nhật vai trò thành ${ROLE_META[nextRole].shortLabel}`);
      await onAuthChanged?.();
    } catch {
      notify("⚠️ Lỗi kết nối khi đổi vai trò");
    } finally {
      setUpdatingUserId(null);
    }
  };

  const handleDeleteUser = async (target: CustomerUser) => {
    if (
      typeof window !== "undefined" &&
      !window.confirm(`Xoá tài khoản ${target.email} khỏi hệ thống?`)
    ) {
      return;
    }
    setUpdatingUserId(target.id);
    try {
      const res = await fetch(
        `/api/admin/users?id=${encodeURIComponent(target.id)}`,
        { method: "DELETE" }
      );
      const data = await res.json();
      if (!res.ok) {
        notify(`⚠️ ${data.error || "Không thể xoá tài khoản"}`);
        return;
      }
      setUsers(data.users || []);
      setAuditLogs(data.auditLogs || []);
      notify(`🗑️ Đã xoá tài khoản ${target.email}`);
      await onAuthChanged?.();
    } catch {
      notify("⚠️ Lỗi kết nối khi xoá tài khoản");
    } finally {
      setUpdatingUserId(null);
    }
  };

  const handleTogglePermission = async (
    role: UserRole,
    permKey: PermissionKey
  ) => {
    const def = PERMISSION_DEFINITIONS.find((d) => d.key === permKey);
    if (def?.lockedRoles && typeof def.lockedRoles[role] === "boolean") {
      return;
    }

    const currentList = rbacPolicy[role] || [];
    const exists = currentList.includes(permKey);
    const nextList = exists
      ? currentList.filter((k) => k !== permKey)
      : [...currentList, permKey];

    const optimisticPolicy: RbacPolicy = {
      ...rbacPolicy,
      [role]: nextList,
    };
    setRbacPolicy(optimisticPolicy);
    setSavingPolicy(true);

    try {
      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rbacPolicy: optimisticPolicy }),
      });
      const data = await res.json();
      if (!res.ok) {
        notify(`⚠️ ${data.error || "Không thể cập nhật quyền"}`);
        await loadData();
        return;
      }
      if (data.rbacPolicy) setRbacPolicy(data.rbacPolicy);
      if (data.auditLogs) setAuditLogs(data.auditLogs);
      notify(
        `✅ Đã ${exists ? "tắt" : "bật"} "${def?.label || permKey}" cho ${
          ROLE_META[role].shortLabel
        }`
      );
      await onAuthChanged?.();
    } catch {
      notify("⚠️ Lỗi kết nối khi lưu ma trận quyền");
      await loadData();
    } finally {
      setSavingPolicy(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-3xl border-2 border-flandi-pink p-10 text-center">
        <div className="w-9 h-9 mx-auto border-4 border-flandi-pink border-t-flandi-coral rounded-full animate-spin mb-3" />
        <p className="text-xs font-extrabold text-flandi-coral">
          Đang tải danh sách tài khoản & ma trận phân quyền...
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Banner gợi ý nâng email hiện tại lên Admin khi mở khoá bằng PIN */}
      {currentActor?.isPinAdmin &&
        currentActor.user &&
        currentActor.user.role !== "admin" && (
          <div className="bg-gradient-to-r from-flandi-cream via-white to-flandi-cream rounded-2xl border-2 border-flandi-coral p-4 flex flex-wrap items-center justify-between gap-3 shadow-cute">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-flandi-coral text-white flex items-center justify-center shrink-0">
                <Zap className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-extrabold text-sm text-flandi-dark">
                  Gán quyền Admin cho tài khoản Google của bạn
                </h4>
                <p className="text-xs font-semibold text-flandi-dark/75">
                  Bạn đang đăng nhập Google bằng{" "}
                  <strong className="text-flandi-coral">
                    {currentActor.user.email}
                  </strong>{" "}
                  ({ROLE_META[currentActor.user.role || "user"].shortLabel}). Nâng
                  lên Admin để lần sau vào thẳng không cần bấm PIN!
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handlePromoteSelf}
              disabled={updatingUserId === currentActor.user.id}
              className="px-4 py-2.5 rounded-xl bg-flandi-coral hover:bg-flandi-salmon text-white text-xs sm:text-sm font-extrabold shadow-cute transition active:scale-95 cursor-pointer"
            >
              Nâng lên Admin ngay
            </button>
          </div>
        )}

      {/* 4 Thẻ Tổng Quan 4 Nhóm Quyền */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {(["admin", "staff", "user", "guest"] as UserRole[]).map((r) => {
          const meta = ROLE_META[r];
          const countText =
            r === "guest"
              ? "Khách vãng lai"
              : `${roleCounts[r]} tài khoản`;
          return (
            <div
              key={r}
              className="bg-white rounded-2xl border-2 border-flandi-pink p-4 flex flex-col justify-between gap-2 shadow-2xs"
            >
              <div className="flex items-center justify-between gap-2">
                <span
                  className={`px-2.5 py-0.5 rounded-full text-xs font-black border ${meta.badgeClass}`}
                >
                  {meta.shortLabel}
                </span>
                <span className="text-xs font-extrabold text-flandi-coral tabular-nums">
                  {countText}
                </span>
              </div>
              <p className="text-xs font-semibold text-flandi-dark/80 leading-relaxed">
                {meta.description}
              </p>
            </div>
          );
        })}
      </div>

      {/* Khu vực Cấp quyền nhanh theo Email + Danh sách tài khoản */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Cột trái (4 cols): Thêm trước / Gán quyền nhanh theo Email Google */}
        <div className="lg:col-span-4 bg-white rounded-3xl border-2 border-flandi-pink p-5 shadow-2xs space-y-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-flandi-cream border border-flandi-salmon text-flandi-coral flex items-center justify-center shrink-0">
              <UserPlus className="w-4.5 h-4.5" />
            </div>
            <div>
              <h3 className="font-display text-base text-flandi-dark leading-snug">
                Cấp quyền theo Email
              </h3>
              <p className="text-xs font-semibold text-flandi-dark/70">
                Thêm trước email nhân viên để đăng nhập Google nhận quyền ngay
              </p>
            </div>
          </div>

          <form onSubmit={handleUpsertByEmail} className="space-y-3">
            <div>
              <label className="block text-xs font-extrabold text-flandi-dark mb-1">
                Email Google *
              </label>
              <input
                type="email"
                required
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="nhanvien@gmail.com"
                className="w-full px-3.5 py-2.5 rounded-xl border border-flandi-pink focus:border-flandi-coral focus:outline-none text-sm font-bold text-flandi-dark bg-flandi-bg/50"
              />
            </div>

            <div>
              <label className="block text-xs font-extrabold text-flandi-dark mb-1">
                Tên hiển thị (tuỳ chọn)
              </label>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="VD: Bạn Linh Ca Sáng"
                className="w-full px-3.5 py-2.5 rounded-xl border border-flandi-pink focus:border-flandi-coral focus:outline-none text-sm font-bold text-flandi-dark bg-flandi-bg/50"
              />
            </div>

            <div>
              <label className="block text-xs font-extrabold text-flandi-dark mb-1">
                Vai trò cần cấp
              </label>
              <div className="grid grid-cols-3 gap-1.5">
                {ACCOUNT_ROLES.map((r) => {
                  const active = newRole === r;
                  return (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setNewRole(r)}
                      className={`py-2 px-2 rounded-xl border text-xs font-extrabold transition cursor-pointer ${
                        active
                          ? "bg-flandi-coral border-flandi-coral text-white shadow-2xs"
                          : "bg-white border-flandi-pink text-flandi-dark hover:bg-flandi-cream"
                      }`}
                    >
                      {ROLE_META[r].shortLabel}
                    </button>
                  );
                })}
              </div>
            </div>

            <button
              type="submit"
              disabled={isAddingUser}
              className="w-full py-2.5 rounded-xl bg-flandi-coral hover:bg-flandi-salmon disabled:opacity-50 text-white text-sm font-extrabold shadow-cute transition active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <ShieldCheck className="w-4 h-4" />
              <span>{isAddingUser ? "Đang lưu..." : "Lưu phân quyền"}</span>
            </button>
          </form>
        </div>

        {/* Cột phải (8 cols): Danh sách tài khoản & Đổi role trực tiếp */}
        <div className="lg:col-span-8 bg-white rounded-3xl border-2 border-flandi-pink p-5 shadow-2xs space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-flandi-coral" />
              <h3 className="font-display text-base text-flandi-dark">
                Tài khoản người dùng ({users.length})
              </h3>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-flandi-coral absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Tìm tên, email, SĐT..."
                  className="pl-8 pr-3 py-1.5 rounded-xl border border-flandi-pink focus:border-flandi-coral focus:outline-none text-xs font-bold text-flandi-dark bg-flandi-bg/50 w-44 sm:w-52"
                />
              </div>

              <div className="flex items-center gap-1 bg-flandi-bg p-1 rounded-xl border border-flandi-pink">
                {(["ALL", "admin", "staff", "user"] as const).map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setRoleFilter(f)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-extrabold transition cursor-pointer ${
                      roleFilter === f
                        ? "bg-flandi-coral text-white"
                        : "text-flandi-dark hover:bg-flandi-cream"
                    }`}
                  >
                    {f === "ALL" ? "Tất cả" : ROLE_META[f].shortLabel}
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={loadData}
                className="p-2 rounded-xl border border-flandi-pink hover:bg-flandi-cream text-flandi-coral cursor-pointer"
                title="Làm mới"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {filteredUsers.length === 0 ? (
            <div className="py-10 text-center border border-dashed border-flandi-pink rounded-2xl bg-flandi-bg/40">
              <p className="text-sm font-extrabold text-flandi-dark/70">
                Chưa có tài khoản phù hợp
              </p>
              <p className="text-xs font-semibold text-flandi-dark/60 mt-1">
                Nhập email Google ở khung bên trái để cấp quyền Staff hoặc Admin
              </p>
            </div>
          ) : (
            <div className="divide-y divide-flandi-pink/50">
              {filteredUsers.map((u) => {
                const uRole: AccountRole = u.role || "user";
                const isSelf =
                  !currentActor?.isPinAdmin && currentActor?.user?.id === u.id;
                const isBusy = updatingUserId === u.id;

                return (
                  <div
                    key={u.id}
                    className="py-3 flex flex-wrap sm:flex-nowrap items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <img
                        src={
                          u.picture ||
                          `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(
                            u.email
                          )}`
                        }
                        alt={u.name}
                        className="w-10 h-10 rounded-full object-cover border-2 border-flandi-salmon/80 shrink-0 bg-flandi-cream"
                      />
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-extrabold text-sm text-flandi-dark truncate">
                            {u.name}
                          </span>
                          <span
                            className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${ROLE_META[uRole].badgeClass}`}
                          >
                            {ROLE_META[uRole].shortLabel}
                          </span>
                          {!u.googleId && (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-amber-50 text-amber-700 border border-amber-200">
                              Chờ đăng nhập lần đầu
                            </span>
                          )}
                        </div>
                        <p className="text-xs font-semibold text-flandi-dark/70 truncate">
                          {u.email}
                          {u.phone ? ` • ${u.phone}` : ""}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0 ml-auto">
                      <div className="flex items-center gap-1 bg-flandi-bg p-1 rounded-xl border border-flandi-pink">
                        {ACCOUNT_ROLES.map((r) => {
                          const selected = uRole === r;
                          const disabledSelfDemote = isSelf && r !== "admin";
                          return (
                            <button
                              key={r}
                              type="button"
                              disabled={isBusy || disabledSelfDemote}
                              onClick={() => {
                                if (!selected) handleChangeUserRole(u.id, r);
                              }}
                              title={
                                disabledSelfDemote
                                  ? "Không thể tự hạ quyền Admin của chính bạn"
                                  : `Đổi sang ${ROLE_META[r].label}`
                              }
                              className={`px-2.5 py-1 rounded-lg text-xs font-extrabold transition ${
                                selected
                                  ? "bg-flandi-coral text-white shadow-2xs"
                                  : "text-flandi-dark hover:bg-white disabled:opacity-35"
                              } ${
                                disabledSelfDemote
                                  ? "cursor-not-allowed"
                                  : "cursor-pointer"
                              }`}
                            >
                              {ROLE_META[r].shortLabel}
                            </button>
                          );
                        })}
                      </div>

                      <button
                        type="button"
                        disabled={isBusy || isSelf}
                        onClick={() => handleDeleteUser(u)}
                        title={
                          isSelf
                            ? "Không thể xoá tài khoản đang đăng nhập"
                            : "Xoá tài khoản"
                        }
                        className="p-2 rounded-xl border border-rose-200 bg-rose-50/70 hover:bg-rose-100 text-rose-600 disabled:opacity-30 transition cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Ma trận Phân quyền trực quan (Role × Permission Matrix) */}
      <div className="bg-white rounded-3xl border-2 border-flandi-pink p-5 shadow-2xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="font-display text-base text-flandi-dark">
              Ma trận Quyền theo Vai trò (RBAC Policy)
            </h3>
            <p className="text-xs font-semibold text-flandi-dark/70">
              Bật / tắt quyền trực tiếp cho từng nhóm mà không cần sửa mã nguồn
            </p>
          </div>
          {savingPolicy && (
            <span className="text-xs font-extrabold text-flandi-coral">
              Đang lưu thay đổi...
            </span>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[600px]">
            <thead>
              <tr className="border-b border-flandi-pink text-xs font-extrabold text-flandi-dark">
                <th className="py-2.5 pr-4">Chức năng / Quyền hạn</th>
                {ALL_USER_ROLES.map((r) => (
                  <th key={r} className="py-2.5 px-3 text-center w-28">
                    <span
                      className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-black border ${ROLE_META[r].badgeClass}`}
                    >
                      {ROLE_META[r].shortLabel}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-flandi-pink/50 text-xs">
              {PERMISSION_DEFINITIONS.map((perm) => (
                <tr key={perm.key} className="hover:bg-flandi-bg/40">
                  <td className="py-3 pr-4">
                    <div className="font-extrabold text-sm text-flandi-dark">
                      {perm.label}
                    </div>
                    <div className="text-xs font-semibold text-flandi-dark/65">
                      {perm.description}
                    </div>
                  </td>
                  {ALL_USER_ROLES.map((r) => {
                    const enabled = (rbacPolicy[r] || []).includes(perm.key);
                    const isLocked =
                      perm.lockedRoles &&
                      typeof perm.lockedRoles[r] === "boolean";
                    return (
                      <td key={r} className="py-3 px-3 text-center">
                        <button
                          type="button"
                          disabled={Boolean(isLocked) || savingPolicy}
                          onClick={() => handleTogglePermission(r, perm.key)}
                          title={
                            isLocked
                              ? "Quyền mặc định cố định để đảm bảo an toàn hệ thống"
                              : `Bấm để ${enabled ? "tắt" : "bật"}`
                          }
                          className={`w-9 h-9 mx-auto rounded-xl border flex items-center justify-center transition ${
                            enabled
                              ? "bg-flandi-coral border-flandi-coral text-white shadow-2xs"
                              : "bg-flandi-bg border-flandi-pink text-flandi-dark/30 hover:border-flandi-salmon"
                          } ${
                            isLocked
                              ? "opacity-80 cursor-not-allowed"
                              : "cursor-pointer active:scale-95"
                          }`}
                        >
                          {enabled ? (
                            <Check className="w-4 h-4 stroke-[3]" />
                          ) : isLocked ? (
                            <Lock className="w-3.5 h-3.5" />
                          ) : (
                            <span className="text-xs font-black">—</span>
                          )}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Nhật ký Phân quyền gần đây */}
      {auditLogs.length > 0 && (
        <div className="bg-white rounded-3xl border-2 border-flandi-pink p-5 shadow-2xs space-y-3">
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-flandi-coral" />
            <h3 className="font-display text-sm text-flandi-dark">
              Nhật ký thay đổi phân quyền gần đây
            </h3>
          </div>
          <div className="divide-y divide-flandi-pink/40 max-h-52 overflow-y-auto pr-1">
            {auditLogs.slice(0, 15).map((log) => (
              <div
                key={log.id}
                className="py-2 flex flex-wrap items-center justify-between gap-2 text-xs"
              >
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-extrabold text-flandi-coral">
                    {log.action}
                  </span>
                  <span className="font-bold text-flandi-dark">
                    • {log.target}
                  </span>
                  <span className="font-semibold text-flandi-dark/70">
                    ({log.detail})
                  </span>
                </div>
                <div className="text-[11px] font-semibold text-flandi-dark/60 tabular-nums">
                  bởi {log.actorEmail} •{" "}
                  {new Date(log.createdAt).toLocaleString("vi-VN")}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
