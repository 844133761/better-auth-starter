CREATE TABLE "menu" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"parent_id" text,
	"path" text,
	"icon" text DEFAULT 'LayoutGrid' NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL,
	"visible" boolean DEFAULT true NOT NULL,
	"system" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "menu_path_unique" UNIQUE("path"),
	CONSTRAINT "menu_type_check" CHECK ("menu"."type" in ('directory', 'menu')),
	CONSTRAINT "menu_path_check" CHECK (("menu"."type" = 'directory' and "menu"."path" is null) or ("menu"."type" = 'menu' and "menu"."path" is not null))
);
--> statement-breakpoint
ALTER TABLE "menu" ADD CONSTRAINT "menu_parent_id_menu_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."menu"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
INSERT INTO "menu" ("id", "name", "type", "parent_id", "path", "icon", "sort", "visible", "system") VALUES
  ('system', '系统管理', 'directory', NULL, NULL, 'Settings', 0, true, true),
  ('system-users', '用户管理', 'menu', 'system', '/admin/users', 'Users', 0, true, true),
  ('system-menus', '菜单管理', 'menu', 'system', '/admin/menus', 'LayoutGrid', 1, true, true);
