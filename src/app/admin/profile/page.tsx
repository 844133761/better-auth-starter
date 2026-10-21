import { ProfilePage } from "@/components/admin/profile-page";
export const metadata = { title: "个人中心" };
export default function Page() {
  return (
    <div className="p-4 md:p-8">
      <ProfilePage />
    </div>
  );
}
