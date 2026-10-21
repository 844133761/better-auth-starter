import { PageAccess } from "@/components/admin/page-access";
import { notFound } from "next/navigation";
import { listMenus } from "@/lib/menu-service";
import { isMenuVisible } from "@/lib/menus";
import { MenuIcon } from "@/components/admin/menu-icon";

export default async function CustomMenuPage({
  params,
}: {
  params: Promise<{ slug: string[] }>;
}) {
  const { slug } = await params;
  const items = await listMenus();
  const item = items.find(
    (item) => item.path === `/admin/${slug.join("/")}` && item.type === "menu",
  );
  if (!item || !isMenuVisible(item, items)) notFound();
  return (
    <PageAccess path={item.path!}>
      <div className="p-4 md:p-8">
        <h1 className="text-2xl font-semibold">{item.name}</h1>
        <div className="mt-6 flex min-h-80 flex-col items-center justify-center rounded-xl border border-dashed bg-slate-50/60">
          <div className="rounded-xl border bg-white p-4">
            <MenuIcon name={item.icon} className="size-7 text-slate-400" />
          </div>
          <h2 className="mt-5 font-medium">{item.name}</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            这个菜单下暂时没有内容
          </p>
        </div>
      </div>
    </PageAccess>
  );
}
