import "server-only";
import { db } from "@/db";
import { menu } from "@/db/schema";
import { asc, eq, sql } from "drizzle-orm";
import { RequestError } from "@/lib/admin-auth";
import { menuInputSchema, type MenuItem } from "@/lib/menus";

export async function listMenus() {
  return db.select().from(menu).orderBy(asc(menu.sort), asc(menu.name));
}

function validateTree(items: MenuItem[]) {
  const byId = new Map(items.map((item) => [item.id, item]));
  for (const item of items) {
    const visited = new Set([item.id]);
    let parentId = item.parentId;
    while (parentId) {
      if (visited.has(parentId))
        throw new RequestError("上级目录不能是自身或自己的子目录");
      const parent = byId.get(parentId);
      if (!parent || parent.type !== "directory")
        throw new RequestError("上级必须是存在的目录");
      visited.add(parentId);
      if (visited.size > 8) throw new RequestError("目录层级最多为 8 层");
      parentId = parent.parentId;
    }
  }
}

export async function saveMenu(body: unknown, id?: string) {
  const parsed = menuInputSchema.safeParse(body);
  if (!parsed.success) throw new RequestError(parsed.error.issues[0].message);
  const input = parsed.data;
  if (input.path === "/admin/profile")
    throw new RequestError("个人中心为固定入口，无需创建或授权");
  return db.transaction(async (tx) => {
    // Serialize tree changes so simultaneous moves cannot create cycles.
    await tx.execute(sql`select pg_advisory_xact_lock(7823401)`);
    const items = await tx.select().from(menu);
    const existing = id ? items.find((item) => item.id === id) : undefined;
    if (id && !existing) throw new RequestError("菜单不存在", 404);
    if (
      existing?.system &&
      (input.type !== existing.type ||
        input.path !== existing.path ||
        !input.visible)
    ) {
      throw new RequestError("系统菜单的类型、路径和显示状态不可修改");
    }
    if (
      input.path &&
      items.some((item) => item.id !== id && item.path === input.path)
    )
      throw new RequestError("菜单路径已存在", 409);
    const candidate = {
      ...input,
      id: id ?? crypto.randomUUID(),
      system: existing?.system ?? false,
    };
    validateTree([...items.filter((item) => item.id !== id), candidate]);
    if (id)
      return (
        await tx
          .update(menu)
          .set({ ...input, updatedAt: new Date() })
          .where(eq(menu.id, id))
          .returning()
      )[0];
    return (await tx.insert(menu).values(candidate).returning())[0];
  });
}

export async function deleteMenu(id: string) {
  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(7823401)`);
    const items = await tx.select().from(menu);
    const existing = items.find((item) => item.id === id);
    if (!existing) throw new RequestError("菜单不存在", 404);
    if (existing.system) throw new RequestError("系统菜单不可删除");
    if (items.some((item) => item.parentId === id))
      throw new RequestError("请先移动或删除该目录下的子项", 409);
    await tx.delete(menu).where(eq(menu.id, id));
  });
}
