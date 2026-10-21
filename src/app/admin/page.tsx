import { redirect } from "next/navigation";

const AdminPage = async () => {
  redirect("/admin/profile");
};

export default AdminPage;
