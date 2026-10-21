import type { Metadata } from "next";
import { UsersTable } from "@/components/admin/users-table";
import { PageAccess } from "@/components/admin/page-access";

export const metadata: Metadata = {
  title: "用户管理",
  description: "Manage users in the admin dashboard",
};

export default function UsersPage() {
  return (
    <PageAccess path="/admin/users">
      <div className="p-4 md:p-8">
        <UsersTable />
      </div>
    </PageAccess>
  );
}
