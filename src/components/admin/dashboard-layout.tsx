"use client";

import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { DashboardSidebar } from "./dashboard-sidebar";
import { useNavigation } from "@/hooks/use-menus";
import { usePathname } from "next/navigation";
import { ChevronRight, ShieldCheck } from "lucide-react";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { data = [] } = useNavigation();
  const active = data.find((item) => item.path === pathname);
  const parent = data.find((item) => item.id === active?.parentId);
  return (
    <SidebarProvider>
      <DashboardSidebar />
      <SidebarInset className="min-w-0 bg-white">
        <header className="flex h-16 shrink-0 items-center justify-between gap-3 border-b px-4 md:px-8">
          <div className="flex items-center gap-3 text-xs">
            <SidebarTrigger className="-ml-2" />
            <span className="h-4 border-l" />
            <span className="text-slate-400">{parent?.name || "工作空间"}</span>
            <ChevronRight className="size-3 text-slate-300" />
            <span className="font-medium">
              {pathname === "/admin/profile"
                ? "个人中心"
                : active?.name || "控制台"}
            </span>
          </div>
          <span className="flex items-center gap-1.5 text-[11px] text-slate-400">
            <ShieldCheck className="size-3.5 text-emerald-500" />
            安全工作空间
          </span>
        </header>
        <main className="min-w-0 flex-1 bg-slate-50/40">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
