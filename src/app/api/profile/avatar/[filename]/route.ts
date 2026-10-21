import path from "node:path";
import { readFile } from "node:fs/promises";
import { requireSession, apiError, RequestError } from "@/lib/admin-auth";
import { avatarDirectory, avatarFilename } from "@/lib/avatar-storage";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ filename: string }> },
) {
  try {
    await requireSession();
    const { filename } = await params;
    if (!avatarFilename.test(filename))
      throw new RequestError("图片不存在", 404);
    const data = await readFile(path.join(avatarDirectory, filename)).catch(
      () => null,
    );
    if (!data) throw new RequestError("图片不存在", 404);
    return new Response(data, {
      headers: {
        "Content-Type": "image/webp",
        "Cache-Control": "private, max-age=3600",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    return apiError(error);
  }
}
