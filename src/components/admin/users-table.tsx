"use client";

import { useMemo, useState, useEffect, useCallback } from "react";
import {
  useQuery,
  useQueryClient,
  keepPreviousData,
} from "@tanstack/react-query";
import {
  useReactTable,
  getCoreRowModel,
  type ColumnDef,
  type PaginationState,
  type SortingState,
} from "@tanstack/react-table";
import {
  Search,
  Plus,
  RefreshCw,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Users,
} from "lucide-react";
import { format } from "date-fns";
import { authClient } from "@/lib/auth-client";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { apiRequest } from "@/lib/api-client";
import type { UserWithDetails } from "@/utils/users";
import { DataTable } from "@/components/ui/data-table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { UserActions } from "./user-actions";
import { UserAddDialog } from "./user-add-dialog";

type UsersResponse = {
  users: UserWithDetails[];
  total: number;
  totalPages: number;
};

export function UsersTable() {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [role, setRole] = useState("all");
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 10,
  });
  const [sorting, setSorting] = useState<SortingState>([
    { id: "createdAt", desc: true },
  ]);
  const [adding, setAdding] = useState(false);
  const client = useQueryClient();
  const { data: session } = authClient.useSession();
  const superAdmin = session?.user.role === "admin";
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPagination((prev) => ({ ...prev, pageIndex: 0 }));
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);
  const params = new URLSearchParams({
    page: String(pagination.pageIndex + 1),
    limit: String(pagination.pageSize),
    sortBy: sorting[0]?.id || "createdAt",
    sortDirection: sorting[0]?.desc ? "desc" : "asc",
  });
  if (role !== "all") params.set("role", role);
  if (debouncedSearch) params.set("email", debouncedSearch);
  const query = useQuery({
    queryKey: ["users", params.toString()],
    queryFn: ({ signal }) =>
      apiRequest<UsersResponse>("/api/admin/users?" + params.toString(), {
        signal,
      }),
    placeholderData: keepPreviousData,
  });
  const roles = useQuery({
    queryKey: ["role-options"],
    queryFn: ({ signal }) =>
      apiRequest<{ id: string; name: string }[]>("/api/admin/users/roles", {
        signal,
      }),
  });
  const refresh = useCallback(() => {
    setPagination((prev) => ({ ...prev, pageIndex: 0 }));
    void client.invalidateQueries({ queryKey: ["users"] });
  }, [client]);
  const columns = useMemo<ColumnDef<UserWithDetails>[]>(
    () => [
      {
        accessorKey: "name",
        header: ({ column }) => (
          <button
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="flex items-center gap-2"
          >
            用户
            <ArrowUpDown className="size-3" />
          </button>
        ),
        cell: ({ row }) => (
          <div className="flex items-center gap-3">
            <Avatar className="size-9">
              <AvatarImage
                src={row.original.avatarUrl}
                alt={row.original.name}
              />
              <AvatarFallback>
                {row.original.name.slice(0, 1).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="font-medium">{row.original.name}</p>
              <p className="mt-1 text-xs text-slate-400">
                {row.original.email}
              </p>
            </div>
          </div>
        ),
      },
      {
        accessorKey: "role",
        header: "角色",
        cell: ({ row }) => (
          <Badge
            variant="outline"
            className={
              row.original.role === "admin"
                ? "border-indigo-100 bg-indigo-50 text-indigo-600"
                : "text-slate-500"
            }
          >
            {row.original.role === "admin"
              ? "超级管理员"
              : row.original.roleNames?.join("、") || "普通用户"}
          </Badge>
        ),
      },
      {
        accessorKey: "verified",
        header: "邮箱验证",
        cell: ({ row }) => (
          <span
            className={
              row.original.verified
                ? "text-xs text-emerald-600"
                : "text-xs text-slate-400"
            }
          >
            {row.original.verified ? "已验证" : "未验证"}
          </span>
        ),
      },
      {
        accessorKey: "banned",
        header: "状态",
        cell: ({ row }) => (
          <span
            className={
              row.original.banned
                ? "text-xs text-red-500"
                : "text-xs text-emerald-600"
            }
          >
            {row.original.banned ? "已禁用" : "正常"}
          </span>
        ),
      },
      {
        accessorKey: "createdAt",
        header: ({ column }) => (
          <button
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="flex items-center gap-2"
          >
            创建时间
            <ArrowUpDown className="size-3" />
          </button>
        ),
        cell: ({ row }) => (
          <span className="text-xs text-slate-400">
            {format(new Date(row.original.createdAt), "yyyy-MM-dd HH:mm")}
          </span>
        ),
      },
      {
        id: "actions",
        header: "操作",
        cell: ({ row }) =>
          superAdmin ? (
            <UserActions user={row.original} onActionComplete={refresh} />
          ) : (
            <span className="text-xs text-slate-400">只读</span>
          ),
      },
    ],
    [refresh, superAdmin],
  );
  // TanStack Table v8 uses a mutable table instance; React Compiler is not enabled.
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data: query.data?.users ?? [],
    columns,
    getCoreRowModel: getCoreRowModel(),
    getRowId: (row) => row.id,
    state: { pagination, sorting },
    onPaginationChange: setPagination,
    onSortingChange: (updater) => {
      setSorting(updater);
      setPagination((prev) => ({ ...prev, pageIndex: 0 }));
    },
    manualPagination: true,
    rowCount: query.data?.total ?? 0,
    manualSorting: true,
  });
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="mb-2 flex items-center gap-2 text-xs text-slate-400">
            <Users className="size-3.5" />
            工作空间 / 系统管理
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">用户管理</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            管理工作空间成员、账号状态与访问权限。
          </p>
        </div>
        <Button
          className="bg-indigo-600 text-white hover:bg-indigo-700"
          disabled={!superAdmin}
          onClick={() => setAdding(true)}
        >
          <Plus className="size-4" />
          新增用户
        </Button>
      </div>
      <div className="overflow-hidden rounded-xl border bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b p-4">
          <div className="flex flex-wrap gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 size-4 text-slate-400" />
              <Input
                aria-label="搜索用户邮箱"
                placeholder="搜索邮箱…"
                className="w-60 pl-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <select
              aria-label="筛选角色"
              value={role}
              onChange={(e) => {
                setRole(e.target.value);
                table.setPageIndex(0);
              }}
              className="rounded-md border bg-white px-3 text-sm"
            >
              <option value="all">全部角色</option>
              {roles.data?.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </div>
          <Button
            variant="ghost"
            size="icon"
            aria-label="刷新用户"
            disabled={query.isFetching}
            onClick={refresh}
          >
            <RefreshCw
              className={query.isFetching ? "size-4 animate-spin" : "size-4"}
            />
          </Button>
        </div>
        {query.error ? (
          <div role="alert" className="p-10 text-center text-sm text-red-600">
            {query.error.message}
            <Button variant="link" onClick={refresh}>
              重试
            </Button>
          </div>
        ) : (
          <DataTable
            table={table}
            loading={query.isPending}
            empty="没有找到匹配的用户"
          />
        )}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t px-5 py-4 text-xs text-slate-400">
          <span>共 {query.data?.total ?? 0} 位用户</span>
          <div className="flex items-center gap-3">
            <select
              aria-label="每页条数"
              value={pagination.pageSize}
              onChange={(e) => table.setPageSize(Number(e.target.value))}
              className="rounded border p-1.5"
            >
              {[10, 20, 50].map((n) => (
                <option key={n} value={n}>
                  {n} 条 / 页
                </option>
              ))}
            </select>
            <span>
              第 {pagination.pageIndex + 1} /{" "}
              {Math.max(1, table.getPageCount())} 页
            </span>
            <Button
              variant="outline"
              size="icon"
              aria-label="上一页"
              disabled={!table.getCanPreviousPage() || query.isFetching}
              onClick={() => table.previousPage()}
            >
              <ChevronLeft className="size-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              aria-label="下一页"
              disabled={!table.getCanNextPage() || query.isFetching}
              onClick={() => table.nextPage()}
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      </div>
      <UserAddDialog
        isOpen={adding}
        onClose={() => setAdding(false)}
        onSuccess={refresh}
      />
    </div>
  );
}
