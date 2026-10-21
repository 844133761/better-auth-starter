import { MenusTable } from "@/components/admin/menus-table";
import { PageAccess } from "@/components/admin/page-access";

export const metadata = { title: "菜单管理" };
export default function MenusPage() {
  return (
    <PageAccess path="/admin/menus">
      <div className="p-4 md:p-8">
        <MenusTable />
      </div>
    </PageAccess>
  );
}
