"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  type ColumnDef,
} from "@tanstack/react-table";
import { Plus, Search, ShieldCheck, Pencil, Trash2, Eye } from "lucide-react";
import toast from "react-hot-toast";
import { apiRequest } from "@/lib/api-client";
import {
  ADMIN_ROLE_ID,
  isSystemRole,
  type RoleItem,
  type RolesData,
} from "@/lib/roles";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DataTable } from "@/components/ui/data-table";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { RoleEditor } from "./role-editor";

export function RolesTable() {
  const query = useQuery({
    queryKey: ["roles"],
    queryFn: ({ signal }) =>
      apiRequest<RolesData>("/api/admin/roles", { signal }),
  });
  const [editor, setEditor] = useState<{ item?: RoleItem } | null>(null);
  const [deleting, setDeleting] = useState<RoleItem | null>(null);
  const [search, setSearch] = useState("");
  const client = useQueryClient();
  const deletion = useMutation({
    mutationFn: (id: string) =>
      apiRequest(`/api/admin/roles/${id}`, { method: "DELETE" }),
    onSuccess: async () => {
      await Promise.all([
        client.invalidateQueries({ queryKey: ["roles"] }),
        client.invalidateQueries({ queryKey: ["role-options"] }),
      ]);
      setDeleting(null);
      toast.success("角色已删除");
    },
  });
  const columns: ColumnDef<RoleItem>[] = [
    {
      accessorKey: "name",
      header: "角色名称",
      cell: ({ row }) => (
        <div className="flex items-center gap-3">
          <span className="rounded-lg bg-indigo-50 p-2 text-indigo-600">
            <ShieldCheck className="size-4" />
          </span>
          <span className="font-medium">{row.original.name}</span>
          {isSystemRole(row.original.id) && (
            <span className="text-xs text-slate-400">
              默认{row.original.id === ADMIN_ROLE_ID ? " · 只读" : ""}
            </span>
          )}
        </div>
      ),
    },
    {
      accessorKey: "description",
      header: "描述",
      cell: ({ getValue }) => (
        <span className="text-xs text-slate-500">
          {getValue<string>() || "—"}
        </span>
      ),
    },
    {
      id: "permissions",
      header: "菜单权限",
      cell: ({ row }) => (
        <span className="text-xs text-slate-500">
          {row.original.id === ADMIN_ROLE_ID
            ? "全部菜单"
            : `${row.original.menuIds.length} 项`}
        </span>
      ),
    },
    {
      id: "members",
      header: "成员",
      cell: ({ row }) => (
        <span className="text-xs text-slate-500">
          {row.original.memberIds.length} 人
        </span>
      ),
    },
    {
      id: "actions",
      header: "操作",
      cell: ({ row }) => (
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="icon"
            aria-label={`${row.original.id === ADMIN_ROLE_ID ? "查看" : "编辑"}${row.original.name}`}
            onClick={() => setEditor({ item: row.original })}
          >
            {row.original.id === ADMIN_ROLE_ID ? (
              <Eye className="size-4" />
            ) : (
              <Pencil className="size-4" />
            )}
          </Button>
          {!isSystemRole(row.original.id) && (
            <Button
              variant="ghost"
              size="icon"
              aria-label={`删除${row.original.name}`}
              disabled={row.original.memberIds.length > 0}
              title={
                row.original.memberIds.length ? "请先移除角色成员" : "删除角色"
              }
              onClick={() => {
                deletion.reset();
                setDeleting(row.original);
              }}
              className="text-red-500"
            >
              <Trash2 className="size-4" />
            </Button>
          )}
        </div>
      ),
    },
  ];
  // TanStack Table uses a mutable table instance; React Compiler is not enabled.
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data: query.data?.roles ?? [],
    columns,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    state: { globalFilter: search },
    onGlobalFilterChange: setSearch,
  });
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">角色管理</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            为不同职责分配菜单权限，让每位成员各司其职。
          </p>
        </div>
        <Button
          onClick={() => setEditor({})}
          disabled={!query.data}
          className="bg-indigo-600 text-white hover:bg-indigo-700"
        >
          <Plus className="size-4" />
          创建角色
        </Button>
      </div>
      <div className="flex gap-3 rounded-xl border border-indigo-100 bg-indigo-50/50 p-4 text-sm text-indigo-700">
        <ShieldCheck className="mt-0.5 size-5 shrink-0" />
        <p>
          默认提供超级管理员和普通用户。超级管理员只可查看；普通用户可配置基础菜单权限。用户管理与此处的角色成员同步，个人中心始终可用。
        </p>
      </div>
      <div className="overflow-hidden rounded-xl border bg-white">
        <div className="relative border-b p-4">
          <Search className="absolute left-7 top-6.5 size-4 text-slate-400" />
          <Input
            aria-label="搜索角色"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              table.setPageIndex(0);
            }}
            placeholder="搜索角色名称或描述…"
            className="w-64 pl-9"
          />
        </div>
        {query.error ? (
          <p role="alert" className="p-8 text-sm text-red-600">
            {query.error.message}
            <Button variant="link" onClick={() => query.refetch()}>
              重试
            </Button>
          </p>
        ) : (
          <DataTable
            table={table}
            loading={query.isPending}
            empty="暂无角色，创建一个并选择菜单权限"
          />
        )}
        <div className="flex items-center justify-between border-t p-4 text-xs text-slate-400">
          <span>共 {query.data?.roles.length ?? 0} 个角色</span>
          <div className="flex items-center gap-3">
            <Button
              size="sm"
              variant="outline"
              disabled={!table.getCanPreviousPage()}
              onClick={() => table.previousPage()}
            >
              上一页
            </Button>
            <span>
              {table.getState().pagination.pageIndex + 1} /{" "}
              {Math.max(1, table.getPageCount())}
            </span>
            <Button
              size="sm"
              variant="outline"
              disabled={!table.getCanNextPage()}
              onClick={() => table.nextPage()}
            >
              下一页
            </Button>
          </div>
        </div>
      </div>
      {editor && query.data && (
        <RoleEditor
          item={editor.item}
          data={query.data}
          onClose={() => setEditor(null)}
        />
      )}
      <AlertDialog
        open={Boolean(deleting)}
        onOpenChange={(open) => {
          if (!open && !deletion.isPending) setDeleting(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>删除角色？</AlertDialogTitle>
            <AlertDialogDescription>
              确定删除「{deleting?.name}」？此操作无法撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          {deletion.error && (
            <p role="alert" className="text-sm text-red-600">
              {deletion.error.message}
            </p>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletion.isPending}>
              取消
            </AlertDialogCancel>
            <Button
              variant="destructive"
              disabled={deletion.isPending}
              onClick={() => deleting && deletion.mutate(deleting.id)}
            >
              {deletion.isPending ? "正在删除…" : "确认删除"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
