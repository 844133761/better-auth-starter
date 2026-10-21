import "server-only";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { NextResponse } from "next/server";

export class RequestError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}

export function validateWriteRequest(request?: Request, json = true) {
  if (request && request.method !== "GET") {
    const origin = request.headers.get("origin");
    if (request.headers.get("sec-fetch-site") === "cross-site") {
      throw new RequestError("请求来源不允许", 403);
    }
    if (origin && origin !== new URL(request.url).origin)
      throw new RequestError("请求来源不允许", 403);
    if (
      json &&
      request.method !== "DELETE" &&
      !request.headers.get("content-type")?.includes("application/json")
    )
      throw new RequestError("请使用 JSON 请求", 415);
  }
}

export async function requireSession(request?: Request, json = true) {
  validateWriteRequest(request, json);
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new RequestError("请先登录", 401);
  return session;
}

export async function requireAdmin(request?: Request) {
  const session = await requireSession(request);
  if (session.user.role !== "admin")
    throw new RequestError("需要管理员权限", 403);
  return session;
}

export function apiError(error: unknown) {
  if (error instanceof RequestError)
    return NextResponse.json(
      { error: error.message },
      { status: error.status },
    );
  if (error instanceof SyntaxError)
    return NextResponse.json({ error: "请求数据格式不正确" }, { status: 400 });
  const code =
    (error as { code?: string; cause?: { code?: string } })?.cause?.code ??
    (error as { code?: string })?.code;
  if (code === "23505")
    return NextResponse.json({ error: "名称或路径已存在" }, { status: 409 });
  if (code === "23503")
    return NextResponse.json(
      { error: "该目录仍有子项，请先移动或删除子项" },
      { status: 409 },
    );
  console.error(error);
  return NextResponse.json({ error: "操作失败，请稍后重试" }, { status: 500 });
}
