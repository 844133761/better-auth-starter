import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { safeAdminRedirect } from "@/lib/config";
import { AuthForm } from "@/components/auth/auth-form";

export const metadata = { title: "登录 / 注册" };

export default async function AuthPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string; next?: string }>;
}) {
  const params = await searchParams;
  const session = await auth.api.getSession({ headers: await headers() });
  if (session) redirect(safeAdminRedirect(params.next));
  return (
    <AuthForm
      initialMode={params.mode === "register" ? "register" : "login"}
      next={safeAdminRedirect(params.next)}
      emailVerificationEnabled={Boolean(process.env.RESEND_API_KEY)}
    />
  );
}
