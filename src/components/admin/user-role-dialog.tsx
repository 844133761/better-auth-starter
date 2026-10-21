"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { apiRequest } from "@/lib/api-client";
import { authClient } from "@/lib/auth-client";
import { ADMIN_ROLE_ID, USER_ROLE_ID } from "@/lib/roles";
import type { UserWithDetails } from "@/utils/users";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";

interface UserRoleDialogProps {
  user: UserWithDetails;
  isOpen: boolean;
  onClose: () => void;
}

export function UserRoleDialog({ user, isOpen, onClose }: UserRoleDialogProps) {
  const [selected, setSelected] = useState(
    user.roleIds ?? [user.role === "admin" ? ADMIN_ROLE_ID : USER_ROLE_ID],
  );
  const client = useQueryClient();
  const router = useRouter();
  const session = authClient.useSession();
  const options = useQuery({
    queryKey: ["role-options"],
    queryFn: ({ signal }) =>
      apiRequest<{ id: string; name: string }[]>("/api/admin/users/roles", {
        signal,
      }),
  });
  const mutation = useMutation({
    mutationFn: () => {
      if (!options.data) throw new Error("角色列表尚未加载，请稍后重试");
      return apiRequest(`/api/admin/users/${user.id}/roles`, {
        method: "PUT",
        body: JSON.stringify({ roleIds: selected }),
      });
    },
    onSuccess: async () => {
      await Promise.all(
        ["users", "roles", "profile", "navigation"].map((key) =>
          client.invalidateQueries({ queryKey: [key] }),
        ),
      );
      await session.refetch();
      router.refresh();
      toast.success("用户角色已更新，并同步至角色管理");
      onClose();
    },
    onError: (error) => toast.error(error.message),
  });
  const superAdmin = selected.includes(ADMIN_ROLE_ID);
  return (
    <ConfirmationDialog
      isOpen={isOpen}
      busy={mutation.isPending}
      onClose={onClose}
      onConfirm={() => mutation.mutate()}
      title={`设置角色：${user.name || user.email}`}
      description="与角色管理使用相同角色及成员关系。普通用户可叠加自定义角色，超级管理员拥有全部权限。"
      confirmText={mutation.isPending ? "正在保存…" : "保存角色"}
      cancelText="取消"
    >
      <div className="max-h-72 space-y-2 overflow-auto py-4">
        {options.isPending && (
          <p className="text-sm text-muted-foreground">正在加载角色…</p>
        )}
        {options.error && (
          <p role="alert" className="text-sm text-red-600">
            {options.error.message}
          </p>
        )}
        {options.data?.map((role) => (
          <label
            key={role.id}
            className="flex items-center gap-3 rounded-lg border p-3 text-sm"
          >
            <input
              type="checkbox"
              className="size-4 accent-indigo-600"
              checked={selected.includes(role.id)}
              disabled={
                mutation.isPending ||
                (role.id === USER_ROLE_ID && !superAdmin) ||
                (superAdmin && role.id !== ADMIN_ROLE_ID)
              }
              onChange={(event) => {
                if (role.id === ADMIN_ROLE_ID)
                  setSelected(
                    event.target.checked ? [ADMIN_ROLE_ID] : [USER_ROLE_ID],
                  );
                else
                  setSelected((prev) =>
                    event.target.checked
                      ? [...prev, role.id]
                      : prev.filter((id) => id !== role.id),
                  );
              }}
            />
            <span>{role.name}</span>
            {role.id === USER_ROLE_ID && (
              <span className="text-xs text-muted-foreground">
                普通账号默认角色
              </span>
            )}
          </label>
        ))}
      </div>
    </ConfirmationDialog>
  );
}
