import { z } from "zod";

export const menuIcons = [
  "LayoutGrid",
  "Users",
  "Settings",
  "Folder",
  "FileText",
  "ChartColumn",
  "ShoppingBag",
  "Shield",
  "Globe",
  "Database",
] as const;

export const menuInputSchema = z
  .object({
    name: z.string().trim().min(1, "请输入名称").max(50, "名称最多 50 个字符"),
    type: z.enum(["directory", "menu"]),
    parentId: z.string().min(1).max(100).nullable(),
    path: z.string().trim().max(200).nullable(),
    icon: z.enum(menuIcons),
    sort: z.number().int().min(0).max(9999),
    visible: z.boolean(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (
      value.type === "menu" &&
      !/^\/admin\/[a-zA-Z0-9_-]+(?:\/[a-zA-Z0-9_-]+)*$/.test(value.path || "")
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["path"],
        message: "菜单路径须为 /admin/ 开头的站内路径，例如 /admin/reports",
      });
    }
    if (value.type === "directory" && value.path !== null)
      ctx.addIssue({
        code: "custom",
        path: ["path"],
        message: "目录不能设置页面路径",
      });
  });

export type MenuInput = z.infer<typeof menuInputSchema>;
export type MenuItem = MenuInput & { id: string; system: boolean };
export type MenuNode = MenuItem & { children: MenuNode[] };

export function buildMenuTree(
  items: MenuItem[],
  parentId: string | null = null,
): MenuNode[] {
  return items
    .filter((item) => item.parentId === parentId)
    .sort(
      (a, b) =>
        a.sort - b.sort ||
        a.name.localeCompare(b.name) ||
        a.id.localeCompare(b.id),
    )
    .map((item) => ({ ...item, children: buildMenuTree(items, item.id) }));
}

export function descendantIds(items: MenuItem[], id: string): Set<string> {
  const ids = new Set([id]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const item of items)
      if (item.parentId && ids.has(item.parentId) && !ids.has(item.id)) {
        ids.add(item.id);
        changed = true;
      }
  }
  return ids;
}

export function isMenuVisible(item: MenuItem, items: MenuItem[]): boolean {
  if (!item.visible) return false;
  if (!item.parentId) return true;
  const parent = items.find((value) => value.id === item.parentId);
  return Boolean(parent && isMenuVisible(parent, items));
}
