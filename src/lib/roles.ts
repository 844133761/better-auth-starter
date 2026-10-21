import { z } from "zod";
import type { MenuItem } from "@/lib/menus";

export const ADMIN_ROLE_ID = "admin";
export const USER_ROLE_ID = "user";
export const isSystemRole = (id: string) =>
  id === ADMIN_ROLE_ID || id === USER_ROLE_ID;

export const userRolesInputSchema = z
  .object({
    roleIds: z.array(z.string().min(1).max(100)).min(1).max(100),
  })
  .strict();

export const roleInputSchema = z
  .object({
    name: z.string().trim().min(1, "请输入角色名称").max(50),
    description: z.string().trim().max(200),
    menuIds: z.array(z.string().min(1).max(100)).max(2000),
    memberIds: z.array(z.string().min(1).max(100)).max(5000),
  })
  .strict();
export type RoleInput = z.infer<typeof roleInputSchema>;
export type RoleItem = RoleInput & { id: string };
export type RolesData = {
  roles: RoleItem[];
  menus: MenuItem[];
  users: { id: string; name: string; email: string; role: string | null }[];
};
