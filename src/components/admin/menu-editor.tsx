"use client";

import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { X, Folder, FileText, Loader2 } from "lucide-react";
import toast from "react-hot-toast";
import { apiRequest } from "@/lib/api-client";
import {
  menuIcons,
  menuInputSchema,
  descendantIds,
  buildMenuTree,
  type MenuItem,
  type MenuInput,
  type MenuNode,
} from "@/lib/menus";
import { menusQueryKey } from "@/hooks/use-menus";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { MenuIcon } from "./menu-icon";

const selectClass =
  "h-10 w-full rounded-md border bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-indigo-200 disabled:bg-slate-100 disabled:text-slate-500";

export function MenuEditor({
  item,
  items,
  parentId,
  onClose,
}: {
  item?: MenuItem;
  items: MenuItem[];
  parentId?: string | null;
  onClose: () => void;
}) {
  const [form, setForm] = useState<MenuInput>(
    item
      ? {
          name: item.name,
          type: item.type,
          parentId: item.parentId,
          path: item.path,
          icon: item.icon,
          sort: item.sort,
          visible: item.visible,
        }
      : {
          name: "",
          type: "directory",
          parentId: parentId ?? null,
          path: null,
          icon: "Folder",
          sort: 0,
          visible: true,
        },
  );
  const queryClient = useQueryClient();
  const router = useRouter();
  const excluded = item ? descendantIds(items, item.id) : new Set<string>();
  const dirs: { id: string; label: string }[] = [];
  function collect(nodes: MenuNode[], depth = 0) {
    for (const node of nodes) {
      if (node.type === "directory" && !excluded.has(node.id)) {
        dirs.push({ id: node.id, label: "　".repeat(depth) + node.name });
        collect(node.children, depth + 1);
      }
    }
  }
  collect(buildMenuTree(items));
  const mutation = useMutation({
    mutationFn: async () => {
      const parsed = menuInputSchema.safeParse(form);
      if (!parsed.success) throw new Error(parsed.error.issues[0].message);
      return apiRequest<MenuItem>(
        item ? `/api/admin/menus/${item.id}` : "/api/admin/menus",
        { method: item ? "PUT" : "POST", body: JSON.stringify(parsed.data) },
      );
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: menusQueryKey });
      await queryClient.invalidateQueries({ queryKey: ["navigation"] });
      await queryClient.invalidateQueries({ queryKey: ["roles"] });
      router.refresh();
      toast.success(item ? "修改已保存" : "创建成功");
      onClose();
    },
  });
  const update = <K extends keyof MenuInput>(key: K, value: MenuInput[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));
  return (
    <Dialog.Root
      open
      onOpenChange={(open) => {
        if (!open && !mutation.isPending) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-slate-950/35 backdrop-blur-[2px]" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 max-h-[90svh] w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl border bg-white p-6 shadow-xl">
          <Dialog.Title className="text-lg font-semibold">
            {item ? "编辑" : "新建"}
            {form.type === "directory" ? "目录" : "菜单"}
          </Dialog.Title>
          <Dialog.Description className="mt-1 text-sm text-muted-foreground">
            目录用于分组，菜单用于打开对应的后台页面。
          </Dialog.Description>
          <Dialog.Close
            className="absolute right-5 top-5 rounded p-1 text-slate-400 hover:bg-slate-100"
            aria-label="关闭"
            disabled={mutation.isPending}
          >
            <X className="size-4" />
          </Dialog.Close>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              mutation.mutate();
            }}
            className="mt-6 space-y-5"
          >
            <fieldset disabled={mutation.isPending} className="space-y-5">
              <div className="grid grid-cols-2 gap-3">
                {(["directory", "menu"] as const).map((type) => (
                  <button
                    key={type}
                    type="button"
                    disabled={item?.system}
                    onClick={() =>
                      setForm((prev) => ({
                        ...prev,
                        type,
                        path: type === "directory" ? null : "/admin/",
                        icon: type === "directory" ? "Folder" : "FileText",
                      }))
                    }
                    className={`flex items-center justify-center gap-2 rounded-lg border p-3 text-sm disabled:cursor-not-allowed ${form.type === type ? "border-indigo-500 bg-indigo-50 text-indigo-700" : "text-slate-500"}`}
                  >
                    {type === "directory" ? (
                      <Folder className="size-4" />
                    ) : (
                      <FileText className="size-4" />
                    )}
                    {type === "directory" ? "目录" : "菜单"}
                  </button>
                ))}
              </div>
              <div className="space-y-2">
                <Label htmlFor="menu-name">
                  名称 <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="menu-name"
                  placeholder="例如：运营管理"
                  required
                  maxLength={50}
                  value={form.name}
                  onChange={(e) => update("name", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="menu-parent">上级目录</Label>
                <select
                  id="menu-parent"
                  className={selectClass}
                  value={form.parentId ?? ""}
                  onChange={(e) => update("parentId", e.target.value || null)}
                >
                  <option value="">顶级目录</option>
                  {dirs.map((dir) => (
                    <option key={dir.id} value={dir.id}>
                      {dir.label}
                    </option>
                  ))}
                </select>
              </div>
              {form.type === "menu" && (
                <div className="space-y-2">
                  <Label htmlFor="menu-path">
                    页面路径 <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="menu-path"
                    placeholder="/admin/reports"
                    required
                    disabled={item?.system}
                    value={form.path ?? ""}
                    onChange={(e) => update("path", e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    以 /admin/ 开头，例如 /admin/reports。路径必须唯一。
                  </p>
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="menu-icon">图标</Label>
                  <div className="flex items-center gap-2">
                    <MenuIcon name={form.icon} />
                    <select
                      id="menu-icon"
                      className={selectClass}
                      value={form.icon}
                      onChange={(e) =>
                        update("icon", e.target.value as MenuInput["icon"])
                      }
                    >
                      {menuIcons.map((icon) => (
                        <option key={icon} value={icon}>
                          {icon}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="menu-sort">排序</Label>
                  <Input
                    id="menu-sort"
                    type="number"
                    min={0}
                    max={9999}
                    required
                    value={form.sort}
                    onChange={(e) => update("sort", e.target.valueAsNumber)}
                  />
                </div>
              </div>
              <label className="flex cursor-pointer items-center justify-between rounded-lg border p-3 text-sm">
                <span>
                  在侧边栏显示
                  <span className="mt-1 block text-xs text-muted-foreground">
                    隐藏目录时，其下所有菜单也会隐藏
                  </span>
                </span>
                <input
                  aria-label="在侧边栏显示"
                  type="checkbox"
                  className="size-4 accent-indigo-600"
                  disabled={item?.system}
                  checked={form.visible}
                  onChange={(e) => update("visible", e.target.checked)}
                />
              </label>
            </fieldset>
            {mutation.error && (
              <p
                role="alert"
                className="rounded-md bg-red-50 p-3 text-sm text-red-600"
              >
                {mutation.error.message}
              </p>
            )}
            <div className="flex justify-end gap-2 border-t pt-5">
              <Button
                variant="outline"
                type="button"
                disabled={mutation.isPending}
                onClick={onClose}
              >
                取消
              </Button>
              <Button
                type="submit"
                disabled={mutation.isPending}
                className="bg-indigo-600 text-white hover:bg-indigo-700"
              >
                {mutation.isPending && (
                  <Loader2 className="size-4 animate-spin" />
                )}
                保存{form.type === "directory" ? "目录" : "菜单"}
              </Button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
