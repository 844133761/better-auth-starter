import { requireSession } from "@/lib/admin-auth";
import { canAccessPath } from "@/lib/permissions";
import Link from "next/link";
import { ShieldAlert } from "lucide-react";

export async function PageAccess({
  path,
  children,
}: {
  path: string;
  children: React.ReactNode;
}) {
  const session = await requireSession();
  if (!(await canAccessPath(session.user, path)))
    return (
      <section className="flex min-h-96 flex-col items-center justify-center p-8 text-center">
        <ShieldAlert className="size-12 text-slate-300" />
        <h1 className="mt-5 text-xl font-semibold">暂无访问权限</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          请联系管理员分配此菜单权限。
        </p>
        <Link href="/admin/profile" className="mt-6 text-sm text-indigo-600">
          返回个人中心
        </Link>
      </section>
    );
  return children;
}
