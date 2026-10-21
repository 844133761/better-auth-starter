import "server-only";
import path from "node:path";
import { unlink } from "node:fs/promises";
export const avatarDirectory = path.join(process.cwd(), ".data", "avatars");
export const avatarFilename = /^[a-f0-9-]{36}\.webp$/;
export async function removeAvatar(url?: string | null) {
  const filename = url?.split("/api/profile/avatar/")[1];
  if (filename && avatarFilename.test(filename))
    await unlink(path.join(avatarDirectory, filename)).catch(() => {});
}
