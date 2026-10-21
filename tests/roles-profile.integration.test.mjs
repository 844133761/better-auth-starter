import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { Client } from "pg";
import dotenv from "dotenv";
import sharp from "sharp";
import { unlink } from "node:fs/promises";
import path from "node:path";
dotenv.config({ quiet: true });
const base = process.env.TEST_BASE_URL || "http://localhost:3000";
if (!["localhost", "127.0.0.1", "[::1]"].includes(new URL(base).hostname))
  throw new Error("Localhost only");
const cookieOf = (res) =>
  res.headers
    .getSetCookie()
    .map((v) => v.split(";")[0])
    .join("; ");

test(
  "roles, menu authorization, profile, password and avatar",
  { skip: !process.env.TEST_ADMIN_EMAIL || !process.env.TEST_ADMIN_PASSWORD },
  async (t) => {
    const db = new Client({ connectionString: process.env.DATABASE_URL });
    await db.connect();
    let adminCookie, memberCookie, userId, avatarUrl;
    const roleIds = [];
    const menuIds = [];
    const email = `profile-${crypto.randomUUID()}@example.com`;
    const oldPassword = crypto.randomBytes(18).toString("base64url");
    const newPassword = crypto.randomBytes(18).toString("base64url");
    const request = async (
      url,
      { cookie, method = "GET", body, expected = 200 } = {},
    ) => {
      const response = await fetch(base + url, {
        method,
        redirect: "manual",
        headers: {
          Origin: base,
          ...(cookie ? { Cookie: cookie } : {}),
          ...(body ? { "Content-Type": "application/json" } : {}),
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      assert.equal(
        response.status,
        expected,
        `${method} ${url}: ${response.status}`,
      );
      return response;
    };
    const role = (name, menus, members = [userId]) => ({
      name,
      description: "integration",
      menuIds: menus,
      memberIds: members,
    });
    try {
      await t.test(
        "anonymous profile and role endpoints require login",
        async () => {
          for (const url of [
            "/api/profile",
            "/api/navigation",
            "/api/admin/roles",
          ])
            await request(url, { expected: 401 });
        },
      );
      const admin = await request("/api/auth/sign-in/email", {
        method: "POST",
        body: {
          email: process.env.TEST_ADMIN_EMAIL,
          password: process.env.TEST_ADMIN_PASSWORD,
        },
      });
      adminCookie = cookieOf(admin);
      const member = await request("/api/auth/sign-up/email", {
        method: "POST",
        body: { email, password: oldPassword, name: "Profile test" },
      });
      memberCookie = cookieOf(member);
      userId = (await member.json()).user.id;
      await t.test(
        "any authenticated user gets profile without menu permission",
        async () => {
          await request("/admin/profile", { cookie: memberCookie });
          const profile = await (
            await request("/api/profile", { cookie: memberCookie })
          ).json();
          assert.equal(profile.user.id, userId);
          assert.equal(profile.hasPassword, true);
          assert.deepEqual(
            await (
              await request("/api/navigation", { cookie: memberCookie })
            ).json(),
            [],
          );
          for (const url of [
            "/api/admin/roles",
            "/api/admin/menus",
            "/api/admin/users",
          ])
            await request(url, { cookie: memberCookie, expected: 403 });
          const page = await (
            await request("/admin/roles", { cookie: memberCookie })
          ).text();
          assert.ok(page.includes("暂无访问权限"));
          const redirect = await request("/auth", {
            cookie: memberCookie,
            expected: 307,
          });
          assert.equal(
            new URL(redirect.headers.get("location"), base).pathname,
            "/admin/profile",
          );
        },
      );
      let roleA, roleB, customMenu;
      await t.test(
        "assign multiple roles and merge permissions, without granting administrator",
        async () => {
          const menuResponse = await request("/api/admin/menus", {
            cookie: adminCookie,
            method: "POST",
            expected: 201,
            body: {
              name: "Role test page",
              type: "menu",
              parentId: "system",
              path: `/admin/role-test-${crypto.randomUUID()}`,
              icon: "FileText",
              sort: 5,
              visible: true,
            },
          });
          customMenu = await menuResponse.json();
          menuIds.push(customMenu.id);
          roleA = await (
            await request("/api/admin/roles", {
              cookie: adminCookie,
              method: "POST",
              expected: 201,
              body: role(`Reader ${crypto.randomUUID()}`, [customMenu.id]),
            })
          ).json();
          roleIds.push(roleA.id);
          roleB = await (
            await request("/api/admin/roles", {
              cookie: adminCookie,
              method: "POST",
              expected: 201,
              body: role(`Users ${crypto.randomUUID()}`, ["system-users"]),
            })
          ).json();
          roleIds.push(roleB.id);
          const nav = await (
            await request("/api/navigation", { cookie: memberCookie })
          ).json();
          assert.deepEqual(
            new Set(nav.map((m) => m.id)),
            new Set(["system", customMenu.id, "system-users"]),
          );
          await request(customMenu.path, { cookie: memberCookie });
          await request("/api/admin/users", { cookie: memberCookie });
          await request("/api/admin/roles", {
            cookie: memberCookie,
            method: "POST",
            body: role("Escalation", []),
            expected: 403,
          });
          await request("/api/auth/admin/set-role", {
            cookie: memberCookie,
            method: "POST",
            body: { userId, role: "admin" },
            expected: 403,
          });
          const profile = await (
            await request("/api/profile", { cookie: memberCookie })
          ).json();
          assert.equal(profile.user.role, "user");
          assert.equal(profile.roles.length, 3);
          assert.ok(profile.roles.some((r) => r.id === "user"));
        },
      );
      await t.test("revoke access immediately and validate roles", async () => {
        await request(`/api/admin/roles/${roleB.id}`, {
          cookie: adminCookie,
          method: "PUT",
          body: role(roleB.name, []),
        });
        await request("/api/admin/users", {
          cookie: memberCookie,
          expected: 403,
        });
        await request(`/api/admin/roles/${roleA.id}`, {
          cookie: adminCookie,
          method: "DELETE",
          expected: 409,
        });
        for (const body of [
          role("", []),
          role("Bad menu", ["missing"]),
          role("Directory", ["system"]),
          role("Bad member", [], ["missing"]),
          { ...role("Privilege", []), admin: true },
        ]) {
          await request("/api/admin/roles", {
            cookie: adminCookie,
            method: "POST",
            body,
            expected: 400,
          });
        }
        await request("/api/admin/roles", {
          cookie: adminCookie,
          method: "POST",
          body: role(roleA.name, []),
          expected: 409,
        });
        await request(`/api/admin/roles/${roleA.id}`, {
          cookie: adminCookie,
          method: "PUT",
          body: role(roleA.name, [], []),
        });
        const page = await (
          await request(customMenu.path, { cookie: memberCookie })
        ).text();
        assert.ok(page.includes("暂无访问权限"));
        await request("/api/profile", { cookie: memberCookie });
      });
      await t.test(
        "default roles are present and super administrator is read-only",
        async () => {
          const data = await (
            await request("/api/admin/roles", { cookie: adminCookie })
          ).json();
          assert.deepEqual(
            data.roles.slice(0, 2).map((r) => [r.id, r.name]),
            [
              ["admin", "超级管理员"],
              ["user", "普通用户"],
            ],
          );
          assert.ok(data.roles[0].memberIds.length > 0);
          assert.ok(data.roles[1].memberIds.includes(userId));
          await request("/api/admin/roles", {
            cookie: adminCookie,
            method: "POST",
            body: role("Admin extra role", [], [data.roles[0].memberIds[0]]),
            expected: 400,
          });
          await request("/api/admin/roles/admin", {
            cookie: adminCookie,
            method: "PUT",
            body: role("Changed", []),
            expected: 403,
          });
          for (const id of ["admin", "user"])
            await request(`/api/admin/roles/${id}`, {
              cookie: adminCookie,
              method: "DELETE",
              expected: 403,
            });
          const options = await (
            await request("/api/admin/users/roles", { cookie: adminCookie })
          ).json();
          assert.deepEqual(
            new Set(options.map((r) => r.id)),
            new Set(data.roles.map((r) => r.id)),
          );
        },
      );
      await t.test(
        "user management and role membership synchronize in both directions",
        async () => {
          const setRoles = (ids, expected = 200, cookie = adminCookie) =>
            request(`/api/admin/users/${userId}/roles`, {
              cookie,
              method: "PUT",
              body: { roleIds: ids },
              expected,
            });
          await setRoles(["admin"], 403, memberCookie);
          for (const ids of [
            [],
            ["missing"],
            ["user", "missing"],
            ["user", "admin"],
            [roleA.id],
          ])
            await setRoles(ids, 400);
          await setRoles(["user", roleA.id]);
          let data = await (
            await request("/api/admin/roles", { cookie: adminCookie })
          ).json();
          assert.ok(
            data.roles
              .find((r) => r.id === roleA.id)
              .memberIds.includes(userId),
          );
          assert.ok(
            !data.roles
              .find((r) => r.id === roleB.id)
              .memberIds.includes(userId),
          );
          await request(`/api/admin/roles/${roleB.id}`, {
            cookie: adminCookie,
            method: "PUT",
            body: role(roleB.name, ["system-users"]),
          });
          let users = await (
            await request(`/api/admin/users?email=${email}&role=${roleB.id}`, {
              cookie: adminCookie,
            })
          ).json();
          assert.deepEqual(
            new Set(users.users[0].roleIds),
            new Set(["user", roleA.id, roleB.id]),
          );
          assert.ok(users.users[0].roleNames.includes(roleB.name));
          await request("/api/admin/users", { cookie: memberCookie });
          await setRoles(["admin"]);
          data = await (
            await request("/api/admin/roles", { cookie: adminCookie })
          ).json();
          assert.ok(
            data.roles.find((r) => r.id === "admin").memberIds.includes(userId),
          );
          assert.ok(
            !data.roles.find((r) => r.id === "user").memberIds.includes(userId),
          );
          assert.equal(
            (
              await (
                await request("/api/profile", { cookie: memberCookie })
              ).json()
            ).user.role,
            "admin",
          );
          await request("/api/admin/roles", { cookie: memberCookie });
          // Existing Better Auth role changes are reflected by the same default roles.
          await request("/api/auth/admin/set-role", {
            cookie: adminCookie,
            method: "POST",
            body: { userId, role: "user" },
          });
          data = await (
            await request("/api/admin/roles", { cookie: adminCookie })
          ).json();
          assert.ok(
            data.roles.find((r) => r.id === "user").memberIds.includes(userId),
          );
          await request("/api/admin/roles", {
            cookie: memberCookie,
            expected: 403,
          });
          await request("/api/admin/users", {
            cookie: memberCookie,
            expected: 403,
          });
          await request("/api/profile", { cookie: memberCookie });
        },
      );
      await t.test(
        "ordinary user base menu permissions apply and revoke immediately",
        async () => {
          const data = await (
            await request("/api/admin/roles", { cookie: adminCookie })
          ).json();
          const baseline = data.roles.find((r) => r.id === "user");
          const body = {
            name: baseline.name,
            description: baseline.description,
            menuIds: baseline.menuIds,
            memberIds: baseline.memberIds,
          };
          try {
            await request("/api/admin/roles/user", {
              cookie: adminCookie,
              method: "PUT",
              body: { ...body, menuIds: [...baseline.menuIds, customMenu.id] },
            });
            const nav = await (
              await request("/api/navigation", { cookie: memberCookie })
            ).json();
            assert.ok(nav.some((m) => m.id === customMenu.id));
            const profile = await (
              await request("/api/profile", { cookie: memberCookie })
            ).json();
            assert.deepEqual(profile.roles, [{ id: "user", name: "普通用户" }]);
            await request(`/api/admin/roles/user`, {
              cookie: adminCookie,
              method: "PUT",
              body: { ...body, memberIds: [] },
              expected: 409,
            });
          } finally {
            await request("/api/admin/roles/user", {
              cookie: adminCookie,
              method: "PUT",
              body,
            });
          }
          const nav = await (
            await request("/api/navigation", { cookie: memberCookie })
          ).json();
          assert.ok(!nav.some((m) => m.id === customMenu.id));
        },
      );
      await t.test(
        "name changes persist and password requires old password",
        async () => {
          await request("/api/auth/update-user", {
            cookie: memberCookie,
            method: "POST",
            body: { name: "Updated member" },
          });
          assert.equal(
            (
              await (
                await request("/api/profile", { cookie: memberCookie })
              ).json()
            ).user.name,
            "Updated member",
          );
          const wrong = await fetch(base + "/api/auth/change-password", {
            method: "POST",
            headers: {
              Cookie: memberCookie,
              Origin: base,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              currentPassword: "incorrect",
              newPassword,
              revokeOtherSessions: true,
            }),
          });
          assert.ok(!wrong.ok);
          const other = await request("/api/auth/sign-in/email", {
            method: "POST",
            body: { email, password: oldPassword },
          });
          const otherCookie = cookieOf(other);
          const changed = await request("/api/auth/change-password", {
            cookie: memberCookie,
            method: "POST",
            body: {
              currentPassword: oldPassword,
              newPassword,
              revokeOtherSessions: true,
            },
          });
          memberCookie = cookieOf(changed) || memberCookie;
          await request("/api/profile", { cookie: otherCookie, expected: 401 });
          const outdated = await fetch(base + "/api/auth/sign-in/email", {
            method: "POST",
            headers: { Origin: base, "Content-Type": "application/json" },
            body: JSON.stringify({ email, password: oldPassword }),
          });
          assert.ok(!outdated.ok);
          const login = await request("/api/auth/sign-in/email", {
            method: "POST",
            body: { email, password: newPassword },
          });
          memberCookie = cookieOf(login);
        },
      );
      await t.test(
        "validate avatar content, store reencoded image and persist profile URL",
        async () => {
          const upload = async (data, type) => {
            const form = new FormData();
            form.set("file", new Blob([data], { type }), "avatar.png");
            return fetch(base + "/api/profile/avatar", {
              method: "POST",
              headers: { Cookie: memberCookie, Origin: base },
              body: form,
            });
          };
          const invalid = await upload("not an image", "image/png");
          assert.equal(invalid.status, 400);
          const svg = await upload(
            '<svg xmlns="http://www.w3.org/2000/svg"/>',
            "image/svg+xml",
          );
          assert.equal(svg.status, 400);
          const data = await sharp({
            create: {
              width: 128,
              height: 128,
              channels: 3,
              background: "#6366f1",
            },
          })
            .png()
            .toBuffer();
          const uploaded = await upload(data, "image/png");
          assert.equal(uploaded.status, 200);
          avatarUrl = (await uploaded.json()).url;
          assert.equal(
            (
              await (
                await request("/api/profile", { cookie: memberCookie })
              ).json()
            ).user.image,
            avatarUrl,
          );
          const image = await request(avatarUrl, { cookie: memberCookie });
          assert.equal(image.headers.get("content-type"), "image/webp");
          assert.equal(
            (await sharp(Buffer.from(await image.arrayBuffer())).metadata())
              .format,
            "webp",
          );
          await request(avatarUrl, { expected: 401 });
        },
      );
      await t.test("Google and GitHub social login are disabled", async () => {
        for (const provider of ["google", "github"]) {
          const res = await fetch(base + "/api/auth/sign-in/social", {
            method: "POST",
            headers: { Origin: base, "Content-Type": "application/json" },
            body: JSON.stringify({ provider, callbackURL: "/admin/profile" }),
          });
          assert.ok(!res.ok);
        }
      });
    } finally {
      if (userId) {
        await db.query("DELETE FROM user_role WHERE user_id=$1", [userId]);
        await db.query('DELETE FROM "user" WHERE id=$1', [userId]);
      }
      for (const id of roleIds)
        await db.query("DELETE FROM app_role WHERE id=$1", [id]);
      for (const id of menuIds)
        await db.query("DELETE FROM menu WHERE id=$1", [id]);
      if (avatarUrl)
        await unlink(
          path.join(
            process.cwd(),
            ".data",
            "avatars",
            path.basename(avatarUrl),
          ),
        ).catch(() => {});
      if (adminCookie)
        await fetch(base + "/api/auth/sign-out", {
          method: "POST",
          headers: {
            Cookie: adminCookie,
            Origin: base,
            "Content-Type": "application/json",
          },
          body: "{}",
        });
      await db.end();
    }
  },
);
