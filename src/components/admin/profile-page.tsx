"use client";
import { useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useDropzone } from "react-dropzone";
import { useRouter } from "next/navigation";
import {
  UploadCloud,
  UserRound,
  LockKeyhole,
  ShieldCheck,
  Loader2,
  Eye,
  EyeOff,
} from "lucide-react";
import toast from "react-hot-toast";
import { authClient } from "@/lib/auth-client";
import { apiRequest } from "@/lib/api-client";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

type Profile = {
  user: {
    id: string;
    name: string;
    email: string;
    image?: string | null;
    role?: string | null;
    emailVerified: boolean;
    createdAt: string;
  };
  roles: { id: string; name: string }[];
  hasPassword: boolean;
};

export function ProfilePage() {
  const query = useQuery({
    queryKey: ["profile"],
    queryFn: ({ signal }) => apiRequest<Profile>("/api/profile", { signal }),
    staleTime: 0,
  });
  const client = useQueryClient();
  const router = useRouter();
  const { refetch: refetchSession } = authClient.useSession();
  const passwordForm = useRef<HTMLFormElement>(null);
  const [showPassword, setShowPassword] = useState(false);
  const refresh = async () => {
    await Promise.all([
      client.invalidateQueries({ queryKey: ["profile"] }),
      client.invalidateQueries({ queryKey: ["users"] }),
      refetchSession({ query: { disableCookieCache: true } }),
    ]);
    router.refresh();
  };
  const nameMutation = useMutation({
    mutationFn: async (form: FormData) => {
      const name = String(form.get("name")).trim();
      if (!name || name.length > 50) throw new Error("姓名应为 1 至 50 个字符");
      const result = await authClient.updateUser({ name });
      if (result.error) throw new Error(result.error.message || "保存失败");
    },
    onSuccess: async () => {
      await refresh();
      toast.success("姓名已更新");
    },
  });
  const passwordMutation = useMutation({
    mutationFn: async (form: FormData) => {
      const currentPassword = String(form.get("oldPassword"));
      const newPassword = String(form.get("newPassword"));
      if (newPassword.length < 8 || newPassword.length > 128)
        throw new Error("新密码应为 8 至 128 个字符");
      if (currentPassword === newPassword)
        throw new Error("新密码不能与旧密码相同");
      if (newPassword !== String(form.get("confirmPassword")))
        throw new Error("两次输入的新密码不一致");
      const result = await authClient.changePassword({
        currentPassword,
        newPassword,
        revokeOtherSessions: true,
      });
      if (result.error)
        throw new Error(
          result.error.code === "INVALID_PASSWORD"
            ? "旧密码不正确"
            : result.error.message || "密码修改失败",
        );
    },
    onSuccess: async () => {
      passwordForm.current?.reset();
      await refresh();
      toast.success("密码已修改，其他设备的登录已退出");
    },
  });
  const avatarMutation = useMutation({
    mutationFn: async (file: File) => {
      const form = new FormData();
      form.set("file", file);
      const response = await fetch("/api/profile/avatar", {
        method: "POST",
        body: form,
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "上传失败");
      return data;
    },
    onSuccess: async () => {
      await refresh();
      toast.success("头像已更新");
    },
  });
  const dropzone = useDropzone({
    accept: {
      "image/jpeg": [".jpg", ".jpeg"],
      "image/png": [".png"],
      "image/webp": [".webp"],
    },
    maxFiles: 1,
    maxSize: 5 * 1024 * 1024,
    multiple: false,
    disabled: avatarMutation.isPending,
    onDropAccepted: (files) => {
      if (files[0]) avatarMutation.mutate(files[0]);
    },
    onDropRejected: () =>
      toast.error("请选择一张 5 MB 以内的 JPG、PNG 或 WebP 图片"),
  });
  const profile = query.data;
  if (query.isPending)
    return (
      <div className="flex min-h-96 items-center justify-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        正在加载个人资料…
      </div>
    );
  if (!profile)
    return (
      <p role="alert" className="p-10 text-red-600">
        {query.error?.message || "加载失败"}
        <Button variant="link" onClick={() => query.refetch()}>
          重试
        </Button>
      </p>
    );
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <div className="mb-2 flex items-center gap-2 text-xs text-slate-400">
          <UserRound className="size-3.5" />
          我的工作空间
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">个人中心</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          管理个人资料与账号安全。
        </p>
      </div>
      <div className="grid items-start gap-6 lg:grid-cols-[300px_1fr]">
        <aside className="overflow-hidden rounded-2xl border bg-white shadow-sm">
          <div className="h-24 bg-gradient-to-br from-indigo-600 to-violet-500" />
          <div className="px-6 pb-6">
            <Avatar className="-mt-10 size-20 border-4 border-white shadow-sm">
              <AvatarImage
                src={profile.user.image || undefined}
                alt={profile.user.name}
              />
              <AvatarFallback className="bg-indigo-50 text-2xl text-indigo-600">
                {profile.user.name.slice(0, 1).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <h2 className="mt-4 break-words text-lg font-semibold">
              {profile.user.name}
            </h2>
            <p className="mt-1 break-all text-xs text-slate-400">
              {profile.user.email}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {(profile.user.role === "admin"
                ? ["超级管理员"]
                : profile.roles.length
                  ? profile.roles.map((role) => role.name)
                  : ["普通用户"]
              ).map((role) => (
                <span
                  key={role}
                  className="rounded-full bg-indigo-50 px-2.5 py-1 text-xs text-indigo-600"
                >
                  {role}
                </span>
              ))}
            </div>
            <div
              {...dropzone.getRootProps()}
              className={`mt-6 cursor-pointer rounded-xl border border-dashed p-5 text-center transition focus-visible:outline-indigo-500 ${dropzone.isDragActive ? "border-indigo-500 bg-indigo-50" : "border-slate-200 hover:bg-slate-50"} ${avatarMutation.isPending ? "pointer-events-none opacity-60" : ""}`}
              aria-label="上传头像"
            >
              <input {...dropzone.getInputProps()} aria-label="选择头像图片" />
              {avatarMutation.isPending ? (
                <Loader2 className="mx-auto size-6 animate-spin text-indigo-500" />
              ) : (
                <UploadCloud className="mx-auto size-6 text-indigo-500" />
              )}
              <p className="mt-2 text-sm font-medium">
                {avatarMutation.isPending
                  ? "正在上传…"
                  : dropzone.isDragActive
                    ? "松开以上传头像"
                    : "拖拽图片，或点击上传"}
              </p>
              <p className="mt-2 text-[11px] leading-5 text-slate-400">
                JPG、PNG、WebP · 最大 5 MB
                <br />
                自动裁剪为方形头像
              </p>
            </div>
            {avatarMutation.error && (
              <p role="alert" className="mt-3 text-xs text-red-600">
                {avatarMutation.error.message}
              </p>
            )}
            <p className="mt-5 flex items-center gap-1.5 text-[11px] text-slate-400">
              <ShieldCheck className="size-3.5 text-emerald-500" />
              个人中心无需额外菜单权限
            </p>
          </div>
        </aside>
        <div className="space-y-6">
          <section className="rounded-2xl border bg-white p-6 shadow-sm">
            <div className="mb-6 flex items-center gap-2">
              <UserRound className="size-4 text-indigo-500" />
              <h2 className="font-semibold">基本资料</h2>
            </div>
            <form
              key={`${profile.user.id}:${profile.user.name}`}
              className="space-y-5"
              onSubmit={(e) => {
                e.preventDefault();
                nameMutation.mutate(new FormData(e.currentTarget));
              }}
            >
              <div className="space-y-2">
                <Label htmlFor="profile-name">姓名</Label>
                <Input
                  id="profile-name"
                  name="name"
                  autoComplete="name"
                  required
                  maxLength={50}
                  defaultValue={profile.user.name}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="profile-email">邮箱地址</Label>
                <Input id="profile-email" value={profile.user.email} disabled />
                <p className="text-xs text-slate-400">
                  邮箱作为登录账号，此处不可修改。
                </p>
              </div>
              {nameMutation.error && (
                <p role="alert" className="text-sm text-red-600">
                  {nameMutation.error.message}
                </p>
              )}
              <Button
                type="submit"
                disabled={nameMutation.isPending}
                className="bg-indigo-600 text-white hover:bg-indigo-700"
              >
                {nameMutation.isPending ? "正在保存…" : "保存资料"}
              </Button>
            </form>
          </section>
          <section className="rounded-2xl border bg-white p-6 shadow-sm">
            <div className="mb-2 flex items-center gap-2">
              <LockKeyhole className="size-4 text-indigo-500" />
              <h2 className="font-semibold">修改密码</h2>
            </div>
            <p className="mb-6 text-xs leading-6 text-slate-400">
              需要验证当前密码。修改后，其他设备的登录将失效。
            </p>
            {profile.hasPassword ? (
              <form
                ref={passwordForm}
                onSubmit={(e) => {
                  e.preventDefault();
                  passwordMutation.mutate(new FormData(e.currentTarget));
                }}
                className="space-y-5"
              >
                <input
                  type="text"
                  name="username"
                  autoComplete="username"
                  value={profile.user.email}
                  readOnly
                  hidden
                />
                <fieldset
                  disabled={passwordMutation.isPending}
                  className="space-y-5"
                >
                  {[
                    {
                      id: "oldPassword",
                      label: "旧密码",
                      complete: "current-password",
                    },
                    {
                      id: "newPassword",
                      label: "新密码",
                      complete: "new-password",
                    },
                    {
                      id: "confirmPassword",
                      label: "确认新密码",
                      complete: "new-password",
                    },
                  ].map((field) => (
                    <div key={field.id} className="space-y-2">
                      <Label htmlFor={field.id}>{field.label}</Label>
                      <Input
                        id={field.id}
                        name={field.id}
                        type={showPassword ? "text" : "password"}
                        autoComplete={field.complete}
                        minLength={field.id === "oldPassword" ? 1 : 8}
                        maxLength={128}
                        required
                        placeholder={
                          field.id === "oldPassword"
                            ? "输入当前密码"
                            : "至少 8 位字符"
                        }
                      />
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="flex items-center gap-1.5 text-xs text-slate-400"
                  >
                    {showPassword ? (
                      <EyeOff className="size-3.5" />
                    ) : (
                      <Eye className="size-3.5" />
                    )}
                    {showPassword ? "隐藏密码" : "显示密码"}
                  </button>
                </fieldset>
                {passwordMutation.error && (
                  <p role="alert" className="text-sm text-red-600">
                    {passwordMutation.error.message}
                  </p>
                )}
                <Button
                  type="submit"
                  variant="outline"
                  disabled={passwordMutation.isPending}
                >
                  {passwordMutation.isPending ? "正在修改…" : "更新密码"}
                </Button>
              </form>
            ) : (
              <p className="rounded-lg bg-amber-50 p-4 text-sm text-amber-700">
                此账号未设置密码，请联系管理员处理。
              </p>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
