"use client";

import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  useReactTable,
  getCoreRowModel,
  getExpandedRowModel,
  type ColumnDef,
  type ExpandedState,
} from "@tanstack/react-table";
import {
  ChevronRight,
  ChevronDown,
  Plus,
  Pencil,
  Trash2,
  Search,
  FolderTree,
  Folder,
  FileText,
  Eye,
  RefreshCw,
  ChevronsDownUp,
} from "lucide-react";
import toast from "react-hot-toast";
import { useRouter } from "next/navigation";
import { useMenus, menusQueryKey } from "@/hooks/use-menus";
import {
  buildMenuTree,
  isMenuVisible,
  type MenuItem,
  type MenuNode,
} from "@/lib/menus";
import { apiRequest } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
import { MenuEditor } from "./menu-editor";
import { MenuIcon } from "./menu-icon";

function searchTree(nodes: MenuNode[], search: string): MenuNode[] {
  return nodes.flatMap((node) => {
    if (`${node.name} ${node.path || ""}`.toLowerCase().includes(search))
      return [node];
    const children = searchTree(node.children, search);
    return children.length ? [{ ...node, children }] : [];
  });
}

export function MenusTable() {
  const query = useMenus();
  const items = query.data ?? [];
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<ExpandedState>(true);
  const [editor, setEditor] = useState<{
    item?: MenuItem;
    parentId?: string;
  } | null>(null);
  const [deleting, setDeleting] = useState<MenuItem | null>(null);
  const queryClient = useQueryClient();
  const router = useRouter();
  const deletion = useMutation({
    mutationFn: (id: string) =>
      apiRequest(`/api/admin/menus/${id}`, { method: "DELETE" }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: menusQueryKey });
      await queryClient.invalidateQueries({ queryKey: ["navigation"] });
      await queryClient.invalidateQueries({ queryKey: ["roles"] });
      router.refresh();
      setDeleting(null);
      toast.success("删除成功");
    },
  });
  const tree = useMemo(
    () =>
      searchTree(buildMenuTree(query.data ?? []), search.trim().toLowerCase()),
    [query.data, search],
  );
  const columns: ColumnDef<MenuNode>[] = [
    {
      accessorKey: "name",
      header: "菜单名称",
      cell: ({ row }) => (
        <div
          className="flex items-center gap-2"
          style={{ paddingLeft: row.depth * 24 }}
        >
          {row.getCanExpand() ? (
            <button
              aria-label={`${row.getIsExpanded() ? "折叠" : "展开"}${row.original.name}`}
              onClick={row.getToggleExpandedHandler()}
              className="rounded p-0.5 hover:bg-slate-100"
            >
              {row.getIsExpanded() ? (
                <ChevronDown className="size-4" />
              ) : (
                <ChevronRight className="size-4" />
              )}
            </button>
          ) : (
            <span className="w-5" />
          )}
          <span
            className={`flex size-8 items-center justify-center rounded-lg ${row.original.type === "directory" ? "bg-amber-50 text-amber-600" : "bg-indigo-50 text-indigo-600"}`}
          >
            <MenuIcon name={row.original.icon} />
          </span>
          <span className="font-medium">{row.original.name}</span>
          {row.original.system && (
            <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-400">
              系统
            </span>
          )}
        </div>
      ),
    },
    {
      accessorKey: "type",
      header: "类型",
      cell: ({ row }) => (
        <Badge variant="outline" className="font-normal text-slate-500">
          {row.original.type === "directory" ? "目录" : "菜单"}
        </Badge>
      ),
    },
    {
      accessorKey: "path",
      header: "页面路径",
      cell: ({ getValue }) => (
        <span className="font-mono text-xs text-slate-500">
          {getValue<string>() || "—"}
        </span>
      ),
    },
    {
      accessorKey: "sort",
      header: "排序",
      cell: ({ getValue }) => (
        <span className="text-slate-500">{getValue<number>()}</span>
      ),
    },
    {
      accessorKey: "visible",
      header: "显示状态",
      cell: ({ row }) => (
        <span
          className={`inline-flex items-center gap-1.5 text-xs ${row.original.visible ? "text-emerald-600" : "text-slate-400"}`}
        >
          <span
            className={`size-1.5 rounded-full ${row.original.visible ? "bg-emerald-500" : "bg-slate-300"}`}
          />
          {row.original.visible ? "显示" : "隐藏"}
        </span>
      ),
    },
    {
      id: "actions",
      header: "操作",
      cell: ({ row }) => (
        <div className="flex gap-1">
          <Button
            size="icon"
            variant="ghost"
            aria-label={`编辑${row.original.name}`}
            onClick={() => setEditor({ item: row.original })}
          >
            <Pencil className="size-3.5" />
          </Button>
          {row.original.type === "directory" && (
            <Button
              size="icon"
              variant="ghost"
              aria-label={`在${row.original.name}下新增`}
              onClick={() => setEditor({ parentId: row.original.id })}
            >
              <Plus className="size-4" />
            </Button>
          )}
          <Button
            size="icon"
            variant="ghost"
            className="text-red-500 hover:text-red-600"
            disabled={
              row.original.system ||
              items.some((item) => item.parentId === row.original.id)
            }
            aria-label={`删除${row.original.name}`}
            title={
              row.original.system
                ? "系统菜单不可删除"
                : items.some((item) => item.parentId === row.original.id)
                  ? "请先移动或删除子项"
                  : "删除"
            }
            onClick={() => {
              deletion.reset();
              setDeleting(row.original);
            }}
          >
            <Trash2 className="size-3.5" />
          </Button>
        </div>
      ),
    },
  ];
  // TanStack Table v8 uses a mutable table instance; React Compiler is not enabled.
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data: tree,
    columns,
    getRowId: (row) => row.id,
    getSubRows: (row) => row.children,
    getCoreRowModel: getCoreRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
    state: { expanded },
    onExpandedChange: setExpanded,
    autoResetExpanded: false,
  });
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="mb-2 flex items-center gap-2 text-xs text-slate-400">
            <FolderTree className="size-3.5" />
            工作空间 / 系统管理
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">菜单管理</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            组织你的后台导航，让每个功能都有自己的位置。
          </p>
        </div>
        <Button
          onClick={() => setEditor({})}
          className="bg-indigo-600 text-white hover:bg-indigo-700"
        >
          <Plus className="size-4" />
          新建目录 / 菜单
        </Button>
      </div>
      <div className="grid grid-cols-3 gap-3">
        {[
          {
            label: "全部目录",
            count: items.filter((i) => i.type === "directory").length,
            icon: Folder,
            color: "bg-amber-50 text-amber-600",
          },
          {
            label: "页面菜单",
            count: items.filter((i) => i.type === "menu").length,
            icon: FileText,
            color: "bg-indigo-50 text-indigo-600",
          },
          {
            label: "显示中的项目",
            count: items.filter((i) => isMenuVisible(i, items)).length,
            icon: Eye,
            color: "bg-emerald-50 text-emerald-600",
          },
        ].map((stat) => (
          <div
            key={stat.label}
            className="flex items-center gap-3 rounded-xl border bg-white p-4 sm:p-5"
          >
            <span className={`hidden rounded-xl p-3 sm:block ${stat.color}`}>
              <stat.icon className="size-5" />
            </span>
            <div>
              <p className="text-xs text-muted-foreground">{stat.label}</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums">
                {query.isPending ? "—" : stat.count}
              </p>
            </div>
          </div>
        ))}
      </div>
      <div className="overflow-hidden rounded-xl border bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b p-4">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 size-4 text-slate-400" />
            <Input
              aria-label="搜索菜单"
              placeholder="搜索菜单名称或路径…"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setExpanded(true);
              }}
              className="w-64 pl-9"
            />
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                table.toggleAllRowsExpanded(!table.getIsAllRowsExpanded())
              }
            >
              <ChevronsDownUp className="size-3.5" />
              {table.getIsAllRowsExpanded() ? "全部折叠" : "全部展开"}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label="刷新菜单"
              disabled={query.isFetching}
              onClick={() => query.refetch()}
            >
              <RefreshCw
                className={`size-4 ${query.isFetching ? "animate-spin" : ""}`}
              />
            </Button>
          </div>
        </div>
        {query.error ? (
          <div role="alert" className="p-10 text-center text-sm text-red-600">
            {query.error.message}
            <Button variant="link" onClick={() => query.refetch()}>
              重试
            </Button>
          </div>
        ) : (
          <DataTable
            table={table}
            loading={query.isPending}
            empty={search ? "没有找到匹配的菜单" : "暂无菜单，点击右上角创建"}
          />
        )}
        <div className="flex flex-wrap justify-between gap-2 border-t px-5 py-3 text-xs text-slate-400">
          <span>共 {items.length} 项 · 最多支持 8 层目录</span>
          <span>排序值越小越靠前 · 系统菜单保留基础入口</span>
        </div>
      </div>
      {editor && (
        <MenuEditor
          items={items}
          item={editor.item}
          parentId={editor.parentId}
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
            <AlertDialogTitle>
              删除{deleting?.type === "directory" ? "目录" : "菜单"}？
            </AlertDialogTitle>
            <AlertDialogDescription>
              将删除「{deleting?.name}」，此操作无法撤销。
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
