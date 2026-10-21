import { NextResponse } from "next/server";
import { mkdir, writeFile, unlink } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { requireSession, apiError, RequestError } from "@/lib/admin-auth";
import { avatarDirectory, removeAvatar } from "@/lib/avatar-storage";
import { db } from "@/db";
import { user } from "@/db/schema";
import { eq } from "drizzle-orm";

export const runtime = "nodejs";
const maxSize = 5 * 1024 * 1024;

export async function POST(request: Request) {
  try {
    const session = await requireSession(request, false);
    if (!request.headers.get("content-type")?.startsWith("multipart/form-data"))
      throw new RequestError("请选择图片文件", 415);
    if (Number(request.headers.get("content-length")) > maxSize + 65536)
      throw new RequestError("图片不能超过 5 MB", 413);
    const reader = request.body?.getReader();
    if (!reader) throw new RequestError("请选择图片文件");
    const chunks: Uint8Array[] = [];
    let total = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        total += value.byteLength;
        if (total > maxSize + 65536) {
          await reader.cancel();
          throw new RequestError("图片不能超过 5 MB", 413);
        }
        chunks.push(value);
      }
    } finally {
      reader.releaseLock();
    }
    const form = await new Response(Buffer.concat(chunks), {
      headers: { "content-type": request.headers.get("content-type")! },
    }).formData();
    const file = form.get("file");
    if (!(file instanceof File) || file.size === 0)
      throw new RequestError("请选择图片文件");
    if (file.size > maxSize) throw new RequestError("图片不能超过 5 MB", 413);
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type))
      throw new RequestError("仅支持 JPG、PNG、WebP 图片");
    let image: Buffer;
    try {
      const source = sharp(Buffer.from(await file.arrayBuffer()), {
        limitInputPixels: 16_000_000,
        failOn: "error",
      });
      const meta = await source.metadata();
      if (
        !["jpeg", "png", "webp"].includes(meta.format || "") ||
        (meta.pages ?? 1) > 1
      )
        throw new Error("unsupported");
      image = await source
        .rotate()
        .resize(512, 512, { fit: "cover", withoutEnlargement: true })
        .webp({ quality: 85 })
        .toBuffer();
    } catch {
      throw new RequestError(
        "图片无效，请选择不超过 1600 万像素的静态 JPG、PNG 或 WebP",
      );
    }
    const filename = `${crypto.randomUUID()}.webp`;
    const url = `/api/profile/avatar/${filename}`;
    await mkdir(avatarDirectory, { recursive: true });
    await writeFile(path.join(avatarDirectory, filename), image, {
      flag: "wx",
    });
    try {
      await db
        .update(user)
        .set({ image: url, updatedAt: new Date() })
        .where(eq(user.id, session.user.id));
    } catch (error) {
      await unlink(path.join(avatarDirectory, filename));
      throw error;
    }
    await removeAvatar(session.user.image);
    return NextResponse.json({ url });
  } catch (error) {
    return apiError(error);
  }
}
