"use client";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, LogOut, Layers3, UserRound } from "lucide-react";
import toast from "react-hot-toast";
import { authClient } from "@/lib/auth-client";
import { useNavigation } from "@/hooks/use-menus";
import { buildMenuTree, type MenuNode } from "@/lib/menus";
import { MenuIcon } from "./menu-icon";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";

function NavNodes({
  nodes,
  pathname,
}: {
  nodes: MenuNode[];
  pathname: string;
}) {
  const { isMobile, setOpenMobile } = useSidebar();
  return (
    <>
      {nodes
        .filter((node) => node.visible)
        .map((node) =>
          node.type === "directory" ? (
            <li key={node.id} className="list-none">
              <details open className="group/directory">
                <summary className="flex cursor-pointer list-none items-center gap-2 rounded-md px-2 py-2.5 text-xs font-medium text-slate-500">
                  <MenuIcon name={node.icon} className="size-3.5" />
                  <span className="flex-1">{node.name}</span>
                  <ChevronDown className="size-3 transition-transform group-open/directory:rotate-180" />
                </summary>
                <ul className="ml-3 space-y-1 border-l border-slate-200 pl-2">
                  <NavNodes nodes={node.children} pathname={pathname} />
                </ul>
              </details>
            </li>
          ) : (
            <SidebarMenuItem key={node.id}>
              <SidebarMenuButton
                asChild
                isActive={pathname === node.path}
                className="h-10 text-slate-600 data-[active=true]:bg-indigo-50 data-[active=true]:text-indigo-700 data-[active=true]:font-medium"
              >
                <Link
                  href={node.path!}
                  onClick={() => {
                    if (isMobile) setOpenMobile(false);
                  }}
                >
                  <MenuIcon name={node.icon} />
                  <span>{node.name}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ),
        )}
    </>
  );
}

export function DashboardSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const queryClient = useQueryClient();
  const query = useNavigation();
  const { data: session } = authClient.useSession();
  const logout = useMutation({
    mutationFn: async () => {
      const res = await authClient.signOut();
      if (res.error) throw new Error(res.error.message);
    },
    onSuccess: () => {
      queryClient.clear();
      router.replace("/auth");
      router.refresh();
    },
    onError: (error) => toast.error(error.message),
  });
  return (
    <Sidebar collapsible="offcanvas" className="border-r bg-slate-50/70">
      <SidebarHeader className="px-5 py-6">
        <Link href="/admin" className="flex items-center gap-3">
          <span className="flex size-9 items-center justify-center rounded-xl bg-indigo-600 text-white">
            <Layers3 className="size-5" />
          </span>
          <div>
            <p className="text-sm font-semibold tracking-wide">管理控制台</p>
            <p className="mt-0.5 text-[10px] tracking-[0.16em] text-slate-400">
              ADMIN WORKSPACE
            </p>
          </div>
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup className="px-4">
          <p className="mb-4 px-2 text-[10px] font-medium tracking-widest text-slate-400">
            工作空间
          </p>
          <SidebarGroupContent>
            <SidebarMenu>
              {query.isPending ? (
                <li className="p-3 text-xs text-slate-400">正在加载导航…</li>
              ) : query.error ? (
                <li className="p-2 text-xs text-red-500">
                  导航加载失败{" "}
                  <button className="underline" onClick={() => query.refetch()}>
                    重试
                  </button>
                </li>
              ) : (
                <NavNodes
                  nodes={buildMenuTree(query.data)}
                  pathname={pathname}
                />
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="gap-3 border-t p-4">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild>
              <Link href="/admin/profile">
                <UserRound className="size-4" />
                个人中心
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        <div className="flex items-center gap-3 rounded-xl border bg-white p-3">
          <Avatar className="size-8">
            <AvatarImage
              src={session?.user.image || undefined}
              alt="我的头像"
            />
            <AvatarFallback>
              {session?.user.name?.slice(0, 1).toUpperCase() || "U"}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-medium">
              {session?.user.name || "管理员"}
            </p>
            <p className="mt-0.5 truncate text-[10px] text-slate-400">
              {session?.user.email}
            </p>
          </div>
          <button
            aria-label="退出登录"
            disabled={logout.isPending}
            onClick={() => logout.mutate()}
            className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            <LogOut className="size-4" />
          </button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
