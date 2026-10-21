import "server-only";
import { db } from "@/db";
import { menu, roleMenu, userRole } from "@/db/schema";
import { eq, or, inArray } from "drizzle-orm";
import { USER_ROLE_ID } from "@/lib/roles";
import { requireSession, RequestError } from "@/lib/admin-auth";
import { isMenuVisible, type MenuItem } from "@/lib/menus";

type Principal = { id: string; role?: string | null };

export async function allowedMenuIds(user: Principal) {
  if (user.role === "admin") return null;
  const rows = await db
    .select({ id: roleMenu.menuId })
    .from(roleMenu)
    .where(
      or(
        eq(roleMenu.roleId, USER_ROLE_ID),
        // Only memberships of this user participate in the union.
        inArray(
          roleMenu.roleId,
          db
            .select({ id: userRole.roleId })
            .from(userRole)
            .where(eq(userRole.userId, user.id)),
        ),
      ),
    );
  return new Set(rows.map((row) => row.id));
}

export async function canAccessPath(user: Principal, path: string) {
  if (path === "/admin/profile") return true;
  const items = await db.select().from(menu);
  const item = items.find((item) => item.type === "menu" && item.path === path);
  if (!item || !isMenuVisible(item, items)) return false;
  const allowed = await allowedMenuIds(user);
  return allowed === null || allowed.has(item.id);
}

export async function requireMenuAccess(path: string, request?: Request) {
  const session = await requireSession(request);
  if (!(await canAccessPath(session.user, path)))
    throw new RequestError("没有此菜单的访问权限", 403);
  return session;
}

export async function navigationMenus(user: Principal): Promise<MenuItem[]> {
  const items = await db.select().from(menu);
  const allowed = await allowedMenuIds(user);
  const selected = new Set<string>();
  for (const item of items) {
    if (
      item.type !== "menu" ||
      !isMenuVisible(item, items) ||
      (allowed !== null && !allowed.has(item.id))
    )
      continue;
    selected.add(item.id);
    let parent = item.parentId;
    while (parent) {
      selected.add(parent);
      parent = items.find((value) => value.id === parent)?.parentId ?? null;
    }
  }
  return items.filter((item) => selected.has(item.id));
}
