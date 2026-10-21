"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowRight,
  Eye,
  EyeOff,
  ShieldCheck,
  Layers3,
  Loader2,
} from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

export function AuthForm({
  initialMode,
  next,
  emailVerificationEnabled,
}: {
  initialMode: "login" | "register";
  next: string;
  emailVerificationEnabled: boolean;
}) {
  const [mode, setMode] = useState(initialMode);
  const [showPassword, setShowPassword] = useState(false);
  const [notice, setNotice] = useState("");
  const router = useRouter();
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: async (form: FormData) => {
      const email = String(form.get("email")).trim();
      const password = String(form.get("password"));
      if (mode === "register") {
        const result = await authClient.signUp.email({
          email,
          password,
          name: String(form.get("name")).trim(),
          callbackURL: next,
        });
        if (result.error) throw new Error(result.error.message || "注册失败");
        if (emailVerificationEnabled) return "verify";
      } else {
        const result = await authClient.signIn.email({ email, password });
        if (result.error)
          throw new Error(result.error.message || "登录失败，请检查邮箱和密码");
      }
      return "success";
    },
    onSuccess: (result) => {
      queryClient.clear();
      if (result === "verify") {
        setNotice("注册成功，请前往邮箱完成验证后登录。");
        setMode("login");
      } else {
        router.replace(next);
        router.refresh();
      }
    },
  });

  return (
    <main className="grid min-h-svh lg:grid-cols-2">
      <aside className="relative hidden overflow-hidden bg-slate-950 p-14 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="absolute -right-44 top-1/4 size-[580px] rounded-full border border-white/10" />
        <div className="absolute -right-20 top-1/3 size-[400px] rounded-full border border-white/10" />
        <div className="relative flex items-center gap-3 text-lg font-semibold">
          <Layers3 className="size-7 text-indigo-400" /> 管理控制台
        </div>
        <div className="relative max-w-md">
          <span className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/15 px-3 py-1 text-xs text-slate-300">
            <span className="size-1.5 rounded-full bg-emerald-400" />{" "}
            为有序管理而构建
          </span>
          <h1 className="text-4xl font-semibold leading-relaxed tracking-tight">
            让管理更简单，
            <br />
            让工作更有序。
          </h1>
          <p className="mt-6 text-sm leading-7 text-slate-400">
            从用户到菜单，在一个清晰、专注的工作空间中，掌控你的日常管理。
          </p>
        </div>
        <p className="relative text-xs text-slate-500">
          一个入口，连接你的工作空间。
        </p>
      </aside>
      <section className="flex items-center justify-center bg-slate-50/60 p-6 sm:p-12">
        <div className="w-full max-w-[380px]">
          <div className="mb-8 flex size-12 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-lg shadow-indigo-200">
            <ShieldCheck className="size-6" />
          </div>
          <>
            <h1 className="text-2xl font-semibold tracking-tight">
              {mode === "login" ? "欢迎回来" : "创建你的账号"}
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {mode === "login"
                ? "登录以进入你的管理工作空间。"
                : "注册后即可进入个人中心，其他菜单由管理员授权。"}
            </p>
            <div
              className="my-7 grid grid-cols-2 rounded-lg bg-slate-200/60 p-1"
              role="tablist"
              aria-label="账号操作"
            >
              {(["login", "register"] as const).map((item) => (
                <button
                  key={item}
                  type="button"
                  role="tab"
                  aria-selected={mode === item}
                  disabled={mutation.isPending}
                  onClick={() => {
                    setMode(item);
                    setNotice("");
                    mutation.reset();
                  }}
                  className={`rounded-md py-2 text-sm font-medium transition ${mode === item ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"}`}
                >
                  {item === "login" ? "登录" : "注册"}
                </button>
              ))}
            </div>
            <form
              key={mode}
              onSubmit={(e) => {
                e.preventDefault();
                setNotice("");
                mutation.mutate(new FormData(e.currentTarget));
              }}
              className="space-y-5"
            >
              {mode === "register" && (
                <div className="space-y-2">
                  <Label htmlFor="name">姓名</Label>
                  <Input
                    id="name"
                    name="name"
                    autoComplete="name"
                    placeholder="你的姓名"
                    required
                    minLength={2}
                    maxLength={50}
                  />
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="email">邮箱地址</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  required
                  maxLength={254}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">密码</Label>
                <div className="relative">
                  <Input
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete={
                      mode === "login" ? "current-password" : "new-password"
                    }
                    placeholder={
                      mode === "login" ? "输入你的密码" : "至少 8 位字符"
                    }
                    required
                    minLength={mode === "register" ? 8 : 1}
                    maxLength={128}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? "隐藏密码" : "显示密码"}
                    className="absolute inset-y-0 right-0 px-3 text-slate-400"
                  >
                    {showPassword ? (
                      <EyeOff className="size-4" />
                    ) : (
                      <Eye className="size-4" />
                    )}
                  </button>
                </div>
              </div>
              {mutation.error && (
                <p
                  role="alert"
                  className="rounded-lg bg-red-50 p-3 text-sm text-red-600"
                >
                  {mutation.error.message}
                </p>
              )}
              {notice && (
                <p
                  role="status"
                  className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700"
                >
                  {notice}
                </p>
              )}
              <Button
                type="submit"
                disabled={mutation.isPending}
                className="h-11 w-full bg-indigo-600 text-white hover:bg-indigo-700"
              >
                {mutation.isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <>
                    {mode === "login" ? "登录控制台" : "创建账号"}
                    <ArrowRight className="ml-2 size-4" />
                  </>
                )}
              </Button>
            </form>
            <p className="mt-8 text-center text-xs leading-6 text-slate-400">
              个人中心对所有已登录用户开放
            </p>
          </>
        </div>
      </section>
    </main>
  );
}
