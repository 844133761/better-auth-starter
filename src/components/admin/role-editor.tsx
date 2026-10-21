"use client";
import { useState, useRef, useEffect } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { X, Search, ShieldCheck } from "lucide-react";
import toast from "react-hot-toast";
import { useRouter } from "next/navigation";
import { apiRequest } from "@/lib/api-client";
import { buildMenuTree, type MenuNode } from "@/lib/menus";
import {
  ADMIN_ROLE_ID,
  USER_ROLE_ID,
  isSystemRole,
  roleInputSchema,
  type RoleInput,
  type RoleItem,
  type RolesData,
} from "@/lib/roles";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

function leafIds(node: MenuNode): string[] {
  return node.type === "menu" ? [node.id] : node.children.flatMap(leafIds);
}
function PermissionNode({
  node,
  selected,
  toggle,
}: {
  node: MenuNode;
  selected: string[];
  toggle: (ids: string[], enabled: boolean) => void;
}) {
  const ids = leafIds(node);
  const checked = ids.length > 0 && ids.every((id) => selected.includes(id));
  const partial = !checked && ids.some((id) => selected.includes(id));
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = partial;
  }, [partial]);
  return (
    <li className="list-none">
      <label className="flex items-center gap-2 py-2 text-sm">
        <input
          ref={ref}
          type="checkbox"
          className="size-4 accent-indigo-600"
          disabled={!ids.length}
          checked={checked}
          onChange={(e) => toggle(ids, e.target.checked)}
        />
        <span>{node.name}</span>
        {node.type === "directory" && (
          <span className="text-[10px] text-slate-400">目录</span>
        )}
        {!node.visible && (
          <span className="text-[10px] text-slate-400">已隐藏</span>
        )}
      </label>
      {node.children.length > 0 && (
        <ul className="ml-2 border-l pl-5">
          {node.children.map((child) => (
            <PermissionNode
              key={child.id}
              node={child}
              selected={selected}
              toggle={toggle}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

export function RoleEditor({
  item,
  data,
  onClose,
}: {
  item?: RoleItem;
  data: RolesData;
  onClose: () => void;
}) {
  const readOnly = item?.id === ADMIN_ROLE_ID;
  const system = Boolean(item && isSystemRole(item.id));
  const [form, setForm] = useState<RoleInput>({
    name: item?.name ?? "",
    description: item?.description ?? "",
    menuIds: item?.menuIds ?? [],
    memberIds: item?.memberIds ?? [],
  });
  const [search, setSearch] = useState("");
  const client = useQueryClient();
  const router = useRouter();
  const mutation = useMutation({
    mutationFn: () => {
      const parsed = roleInputSchema.safeParse(form);
      if (!parsed.success) throw new Error(parsed.error.issues[0].message);
      return apiRequest(
        item ? `/api/admin/roles/${item.id}` : "/api/admin/roles",
        { method: item ? "PUT" : "POST", body: JSON.stringify(parsed.data) },
      );
    },
    onSuccess: async () => {
      await Promise.all([
        client.invalidateQueries({ queryKey: ["roles"] }),
        client.invalidateQueries({ queryKey: ["navigation"] }),
        client.invalidateQueries({ queryKey: ["profile"] }),
        client.invalidateQueries({ queryKey: ["users"] }),
        client.invalidateQueries({ queryKey: ["role-options"] }),
      ]);
      router.refresh();
      toast.success("角色与权限已保存");
      onClose();
    },
  });
  const toggle = (
    key: "menuIds" | "memberIds",
    ids: string[],
    enabled: boolean,
  ) =>
    setForm((prev) => ({
      ...prev,
      [key]: enabled
        ? [...new Set([...prev[key], ...ids])]
        : prev[key].filter((id) => !ids.includes(id)),
    }));
  return (
    <Dialog.Root
      open
      onOpenChange={(open) => {
        if (!open && !mutation.isPending) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-slate-950/35 backdrop-blur-[2px]" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 max-h-[90svh] w-[calc(100%-2rem)] max-w-3xl -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl border bg-white p-6 shadow-xl">
          <Dialog.Title className="flex items-center gap-2 text-lg font-semibold">
            <ShieldCheck className="size-5 text-indigo-600" />
            {readOnly ? "查看超级管理员" : item ? "编辑角色" : "创建角色"}
          </Dialog.Title>
          <Dialog.Description className="mt-2 text-sm text-muted-foreground">
            {readOnly
              ? "系统内置角色，始终拥有全部菜单权限。成员由用户管理中的角色设置同步。"
              : item?.id === USER_ROLE_ID
                ? "普通用户自动拥有此角色，可配置其基础菜单权限；成员由用户管理同步。"
                : "选择菜单权限并添加成员，也可在用户管理中分配相同角色。多个角色权限合并生效。"}
          </Dialog.Description>
          <Dialog.Close
            aria-label="关闭"
            disabled={mutation.isPending}
            className="absolute right-5 top-5 rounded p-1 text-slate-400"
          >
            <X className="size-4" />
          </Dialog.Close>
          <form
            className="mt-6 space-y-5"
            onSubmit={(e) => {
              e.preventDefault();
              if (!readOnly) mutation.mutate();
            }}
          >
            <fieldset
              disabled={mutation.isPending || readOnly}
              className="space-y-5"
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="role-name">角色名称</Label>
                  <Input
                    id="role-name"
                    disabled={system}
                    required
                    maxLength={50}
                    placeholder="例如：内容运营"
                    value={form.name}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, name: e.target.value }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="role-description">描述</Label>
                  <Textarea
                    id="role-description"
                    className="min-h-10"
                    maxLength={200}
                    placeholder="这个角色负责什么"
                    value={form.description}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        description: e.target.value,
                      }))
                    }
                  />
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-xl border">
                  <div className="border-b p-4">
                    <h3 className="text-sm font-medium">
                      菜单权限{" "}
                      <span className="ml-1 text-xs text-slate-400">
                        已选 {form.menuIds.length}
                      </span>
                    </h3>
                    <p className="mt-2 text-xs text-slate-400">
                      个人中心默认开放，无需勾选。
                    </p>
                  </div>
                  <ul className="max-h-72 overflow-y-auto p-4">
                    {buildMenuTree(data.menus).map((node) => (
                      <PermissionNode
                        key={node.id}
                        node={node}
                        selected={form.menuIds}
                        toggle={(ids, enabled) =>
                          toggle("menuIds", ids, enabled)
                        }
                      />
                    ))}
                  </ul>
                </div>
                <div className="rounded-xl border">
                  <div className="border-b p-4">
                    <h3 className="text-sm font-medium">
                      角色成员{" "}
                      <span className="ml-1 text-xs text-slate-400">
                        已选 {form.memberIds.length}
                      </span>
                    </h3>
                    <div className="relative mt-3">
                      <Search className="absolute left-2.5 top-2.5 size-4 text-slate-400" />
                      <Input
                        aria-label="搜索角色成员"
                        placeholder="搜索姓名或邮箱"
                        className="pl-8"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="max-h-64 space-y-1 overflow-y-auto p-3">
                    {data.users
                      .filter((user) =>
                        `${user.name} ${user.email}`
                          .toLowerCase()
                          .includes(search.toLowerCase()),
                      )
                      .map((user) => (
                        <label
                          key={user.id}
                          className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2 hover:bg-slate-50"
                        >
                          <input
                            type="checkbox"
                            disabled={system || user.role === "admin"}
                            checked={form.memberIds.includes(user.id)}
                            className="size-4 accent-indigo-600"
                            onChange={(e) =>
                              toggle("memberIds", [user.id], e.target.checked)
                            }
                          />
                          <span className="min-w-0 text-sm">
                            <span className="block truncate">
                              {user.name}
                              {user.role === "admin" && (
                                <span className="ml-1 text-[10px] text-indigo-500">
                                  超级管理员
                                </span>
                              )}
                            </span>
                            <span className="block truncate text-xs text-slate-400">
                              {user.email}
                            </span>
                          </span>
                        </label>
                      ))}
                  </div>
                </div>
              </div>
              <p className="rounded-lg bg-amber-50 p-3 text-xs leading-5 text-amber-700">
                授予「角色管理」允许管理角色及分配菜单权限；授予「菜单管理」允许修改菜单结构。账号封禁、删除及设置超级管理员仍仅限超级管理员。
              </p>
            </fieldset>
            {mutation.error && (
              <p role="alert" className="text-sm text-red-600">
                {mutation.error.message}
              </p>
            )}
            <div className="flex justify-end gap-2 border-t pt-5">
              <Button
                type="button"
                variant="outline"
                disabled={mutation.isPending}
                onClick={onClose}
              >
                {readOnly ? "关闭" : "取消"}
              </Button>
              {!readOnly && (
                <Button
                  type="submit"
                  disabled={mutation.isPending}
                  className="bg-indigo-600 text-white hover:bg-indigo-700"
                >
                  {mutation.isPending ? "正在保存…" : "保存角色"}
                </Button>
              )}
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
