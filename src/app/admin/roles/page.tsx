import { PageAccess } from "@/components/admin/page-access";
import { RolesTable } from "@/components/admin/roles-table";
export const metadata = { title: "角色管理" };
export default function RolesPage() {
  return (
    <PageAccess path="/admin/roles">
      <div className="p-4 md:p-8">
        <RolesTable />
      </div>
    </PageAccess>
  );
}
