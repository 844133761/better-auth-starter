INSERT INTO "app_role" ("id", "name", "description") VALUES
  ('admin', '超级管理员', '拥有全部菜单权限，系统角色仅可查看'),
  ('user', '普通用户', '所有普通账号默认拥有的基础角色')
ON CONFLICT ("id") DO NOTHING;
