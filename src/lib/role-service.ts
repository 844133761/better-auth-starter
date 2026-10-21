import "server-only";
import { db } from "@/db";
import { appRole, roleMenu, userRole, user, menu } from "@/db/schema";
import { eq, sql, inArray } from "drizzle-orm";
import { RequestError } from "@/lib/admin-auth";
import {
  ADMIN_ROLE_ID,
  USER_ROLE_ID,
  isSystemRole,
  roleInputSchema,
  userRolesInputSchema,
  type RolesData,
} from "@/lib/roles";

// Account-level roles come from Better Auth; only extra menu roles use user_role.
export async function effectiveRoles(
  userId: string,
  accountRole?: string | null,
) {
  if (accountRole === "admin")
    return [{ id: ADMIN_ROLE_ID, name: "超级管理员" }];
  const extra = await db
    .select({ id: appRole.id, name: appRole.name })
    .from(userRole)
    .innerJoin(appRole, eq(userRole.roleId, appRole.id))
    .where(eq(userRole.userId, userId));
  return [
    { id: USER_ROLE_ID, name: "普通用户" },
    ...extra.filter((r) => !isSystemRole(r.id)),
  ];
}

export async function rolesData(): Promise<RolesData> {
  const [roles, permissions, members, users, menus] = await Promise.all([
    db.select().from(appRole).orderBy(appRole.createdAt),
    db.select().from(roleMenu),
    db.select().from(userRole),
    db
      .select({
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      })
      .from(user)
      .orderBy(user.name),
    db.select().from(menu),
  ]);
  return {
    roles: roles
      .sort((a, b) => {
        const rank = (id: string) =>
          id === ADMIN_ROLE_ID ? 0 : id === USER_ROLE_ID ? 1 : 2;
        return rank(a.id) - rank(b.id);
      })
      .map((role) => ({
        ...role,
        menuIds:
          role.id === ADMIN_ROLE_ID
            ? menus.filter((m) => m.type === "menu").map((m) => m.id)
            : permissions
                .filter((p) => p.roleId === role.id)
                .map((p) => p.menuId),
        memberIds: isSystemRole(role.id)
          ? users
              .filter((u) =>
                role.id === ADMIN_ROLE_ID
                  ? u.role === "admin"
                  : u.role !== "admin",
              )
              .map((u) => u.id)
          : members
              .filter(
                (m) =>
                  m.roleId === role.id &&
                  users.some((u) => u.id === m.userId && u.role !== "admin"),
              )
              .map((m) => m.userId),
      })),
    menus,
    users,
  };
}

export async function saveRole(body: unknown, id?: string) {
  if (id === ADMIN_ROLE_ID)
    throw new RequestError("超级管理员角色只可查看，不能编辑", 403);
  const parsed = roleInputSchema.safeParse(body);
  if (!parsed.success) throw new RequestError(parsed.error.issues[0].message);
  const input = parsed.data;
  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(7823402)`);
    const roles = await tx.select().from(appRole);
    if (id && !roles.some((r) => r.id === id))
      throw new RequestError("角色不存在", 404);
    if (id === USER_ROLE_ID && input.name !== "普通用户")
      throw new RequestError("默认角色名称不可修改", 409);
    if (roles.some((r) => r.id !== id && r.name === input.name))
      throw new RequestError("角色名称已存在", 409);
    const menus = await tx.select().from(menu);
    const users = await tx.select({ id: user.id, role: user.role }).from(user);
    const menuIds = [...new Set(input.menuIds)];
    const memberIds = [...new Set(input.memberIds)];
    if (
      menuIds.some((id) => !menus.some((m) => m.id === id && m.type === "menu"))
    )
      throw new RequestError("只能授予存在的页面菜单权限");
    if (memberIds.some((id) => !users.some((u) => u.id === id)))
      throw new RequestError("所选用户不存在");
    if (
      id !== USER_ROLE_ID &&
      memberIds.some((id) =>
        users.some((u) => u.id === id && u.role === "admin"),
      )
    )
      throw new RequestError("超级管理员独立使用系统角色，无需分配其他角色");
    if (id === USER_ROLE_ID) {
      const expected = users.filter((u) => u.role !== "admin").map((u) => u.id);
      if (
        expected.length !== memberIds.length ||
        expected.some((id) => !memberIds.includes(id))
      )
        throw new RequestError(
          "普通用户成员由用户管理中的角色自动同步，请刷新后重试",
          409,
        );
    }
    const roleId = id ?? crypto.randomUUID();
    if (id)
      await tx
        .update(appRole)
        .set({
          name: input.name,
          description: input.description,
          updatedAt: new Date(),
        })
        .where(eq(appRole.id, id));
    else
      await tx.insert(appRole).values({
        id: roleId,
        name: input.name,
        description: input.description,
      });
    await tx.delete(roleMenu).where(eq(roleMenu.roleId, roleId));
    if (!isSystemRole(roleId))
      await tx.delete(userRole).where(eq(userRole.roleId, roleId));
    if (menuIds.length)
      await tx
        .insert(roleMenu)
        .values(menuIds.map((menuId) => ({ roleId, menuId })));
    if (!isSystemRole(roleId) && memberIds.length)
      await tx
        .insert(userRole)
        .values(memberIds.map((userId) => ({ roleId, userId })));
    return { id: roleId, ...input, menuIds, memberIds };
  });
}

export async function deleteRole(id: string) {
  if (isSystemRole(id)) throw new RequestError("系统默认角色不能删除", 403);
  await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(7823402)`);
    const [role] = await tx.select().from(appRole).where(eq(appRole.id, id));
    if (!role) throw new RequestError("角色不存在", 404);
    if (
      (await tx.select().from(userRole).where(eq(userRole.roleId, id)).limit(1))
        .length
    )
      throw new RequestError("请先移除此角色的成员再删除", 409);
    await tx.delete(appRole).where(eq(appRole.id, id));
  });
}

export async function setUserRoles(userId: string, body: unknown) {
  const parsed = userRolesInputSchema.safeParse(body);
  if (!parsed.success) throw new RequestError(parsed.error.issues[0].message);
  const roleIds = [...new Set(parsed.data.roleIds)];
  const admin = roleIds.includes(ADMIN_ROLE_ID);
  if (
    (admin && roleIds.length !== 1) ||
    (!admin && !roleIds.includes(USER_ROLE_ID))
  )
    throw new RequestError(
      "超级管理员独立使用，其他角色须包含普通用户基础角色",
    );
  await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(7823402)`);
    const roles = await tx
      .select()
      .from(appRole)
      .where(inArray(appRole.id, roleIds));
    if (roles.length !== roleIds.length)
      throw new RequestError("所选角色不存在");
    const [target] = await tx.select().from(user).where(eq(user.id, userId));
    if (!target) throw new RequestError("用户不存在", 404);
    await tx
      .update(user)
      .set({ role: admin ? "admin" : "user", updatedAt: new Date() })
      .where(eq(user.id, userId));
    await tx.delete(userRole).where(eq(userRole.userId, userId));
    const extras = roleIds.filter((id) => !isSystemRole(id));
    if (extras.length)
      await tx
        .insert(userRole)
        .values(extras.map((roleId) => ({ userId, roleId })));
  });
  return { roleIds };
}
