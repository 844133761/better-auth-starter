import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { Client } from "pg";
import dotenv from "dotenv";

dotenv.config({ quiet: true });
const base = process.env.TEST_BASE_URL || "http://localhost:3000";
const email = process.env.TEST_ADMIN_EMAIL;
const password = process.env.TEST_ADMIN_PASSWORD;
const local = ["localhost", "127.0.0.1", "[::1]"];
if (!local.includes(new URL(base).hostname))
  throw new Error("Integration tests only run against localhost.");

test(
  "administrator authentication and persistent menu management",
  { skip: !email || !password },
  async (t) => {
    const db = new Client({ connectionString: process.env.DATABASE_URL });
    await db.connect();
    const createdIds = [];
    const testEmail = `integration-${crypto.randomUUID()}@example.com`;
    let testUserId;
    let adminCookie;
    const input = {
      name: "Integration directory",
      type: "directory",
      parentId: null,
      path: null,
      icon: "Folder",
      sort: 9,
      visible: true,
    };

    async function request(
      path,
      { cookie, body, method = "GET", origin = base, expected = 200 } = {},
    ) {
      const response = await fetch(base + path, {
        method,
        redirect: "manual",
        headers: {
          ...(cookie ? { Cookie: cookie } : {}),
          ...(body ? { "Content-Type": "application/json" } : {}),
          Origin: origin,
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      assert.equal(response.status, expected, `${method} ${path}`);
      return response;
    }
    async function create(body) {
      const row = await (
        await request("/api/admin/menus", {
          cookie: adminCookie,
          method: "POST",
          body,
          expected: 201,
        })
      ).json();
      createdIds.push(row.id);
      return row;
    }
    const cookies = (response) =>
      response.headers
        .getSetCookie()
        .map((value) => value.split(";")[0])
        .join("; ");
    const edit = (
      {
        id: _id,
        system: _system,
        createdAt: _created,
        updatedAt: _updated,
        ...value
      },
      changes = {},
    ) => ({ ...value, ...changes });

    try {
      await t.test(
        "anonymous and forged sessions cannot access admin APIs",
        async () => {
          for (const path of ["/api/admin/menus", "/api/admin/users"]) {
            await request(path, { expected: 401 });
            await request(path, {
              cookie: "better-auth.session_token=forged",
              expected: 401,
            });
          }
          const res = await request("/admin/menus?search=demo", {
            expected: 307,
          });
          assert.equal(
            new URL(res.headers.get("location"), base).pathname,
            "/auth",
          );
          assert.equal(
            new URL(res.headers.get("location"), base).searchParams.get("next"),
            "/admin/menus?search=demo",
          );
          await request("/auth");
          await request("/auth/register", { expected: 307 });
          await request("/auth/login", { expected: 307 });
        },
      );

      await t.test("admin login and safe login destination", async () => {
        const response = await request("/api/auth/sign-in/email", {
          method: "POST",
          body: { email, password },
        });
        const data = await response.json();
        assert.equal(data.user.role, "admin");
        adminCookie = cookies(response);
        await request("/admin/menus", { cookie: adminCookie });
        await request("/admin/users", { cookie: adminCookie });
        const redirect = await request("/auth?next=https://example.com", {
          cookie: adminCookie,
          expected: 307,
        });
        assert.equal(
          new URL(redirect.headers.get("location"), base).pathname,
        "/admin/profile",
        );
      });

      await t.test("registration never grants admin access", async () => {
        await request("/api/auth/sign-up/email", {
          method: "POST",
          body: {
            email: testEmail,
            password: crypto.randomBytes(18).toString("base64url"),
            name: "Integration User",
            role: "admin",
          },
          expected: 400,
        });
        const response = await request("/api/auth/sign-up/email", {
          method: "POST",
          body: {
            email: testEmail,
            password: crypto.randomBytes(18).toString("base64url"),
            name: "Integration User",
          },
        });
        const data = await response.json();
        testUserId = data.user.id;
        assert.equal(data.user.role, "user");
        const cookie = cookies(response);
        assert.ok(
          cookie,
          "local registration should establish a session without an email service",
        );
        await request("/api/admin/menus", { cookie, expected: 403 });
        await request("/api/admin/users", { cookie, expected: 403 });
        await request("/api/admin/menus", {
          cookie,
          method: "POST",
          body: input,
          expected: 403,
        });
      });

      let root, child, leaf;
      await t.test(
        "create tree, persist updates and reject invalid parents and duplicate paths",
        async () => {
          root = await create(input);
          child = await create({
            ...input,
            name: "Nested directory",
            parentId: root.id,
          });
          leaf = await create({
            ...input,
            name: "Report",
            type: "menu",
            parentId: child.id,
            path: `/admin/integration-${crypto.randomUUID()}`,
            icon: "FileText",
          });
          await request(leaf.path, { cookie: adminCookie });
          await request("/api/admin/menus", {
            cookie: adminCookie,
            method: "POST",
            body: edit(leaf),
            expected: 409,
          });
          await request("/api/admin/menus", {
            cookie: adminCookie,
            method: "POST",
            body: { ...input, parentId: leaf.id },
            expected: 400,
          });
          await request(`/api/admin/menus/${root.id}`, {
            cookie: adminCookie,
            method: "PUT",
            body: edit(root, { parentId: child.id }),
            expected: 400,
          });
          await request(`/api/admin/menus/${root.id}`, {
            cookie: adminCookie,
            method: "PUT",
            body: edit(root, { type: "menu", path: "/admin/invalid-parent" }),
            expected: 400,
          });
          await request(`/api/admin/menus/${leaf.id}`, {
            cookie: adminCookie,
            method: "PUT",
            body: edit(leaf, { name: "Updated report", sort: 3 }),
          });
          const rows = await (
            await request("/api/admin/menus", { cookie: adminCookie })
          ).json();
          const saved = rows.find((row) => row.id === leaf.id);
          assert.equal(saved.name, "Updated report");
          assert.equal(saved.sort, 3);
          assert.equal(saved.parentId, child.id);
          assert.equal(
            (await db.query("SELECT name FROM menu WHERE id = $1", [leaf.id]))
              .rows[0].name,
            "Updated report",
          );
        },
      );

      await t.test(
        "validate input, cross-origin writes and system menu protection",
        async () => {
          await request("/api/admin/menus", {
            cookie: adminCookie,
            method: "POST",
            body: input,
            origin: "https://example.com",
            expected: 403,
          });
          for (const body of [
            { ...input, name: "" },
            { ...input, sort: -1 },
            { ...input, system: true },
            { ...input, parentId: "missing" },
            { ...input, type: "menu", path: "https://example.com" },
          ]) {
            await request("/api/admin/menus", {
              cookie: adminCookie,
              method: "POST",
              body,
              expected: 400,
            });
          }
          await request("/api/admin/menus/system-menus", {
            cookie: adminCookie,
            method: "DELETE",
            expected: 400,
          });
          const rows = await (
            await request("/api/admin/menus", { cookie: adminCookie })
          ).json();
          await request("/api/admin/menus/system-menus", {
            cookie: adminCookie,
            method: "PUT",
            body: edit(
              rows.find((row) => row.id === "system-menus"),
              { visible: false },
            ),
            expected: 400,
          });
          await request(`/api/admin/menus/${root.id}`, {
            cookie: adminCookie,
            method: "DELETE",
            expected: 409,
          });
          await request("/api/admin/menus/missing", {
            cookie: adminCookie,
            method: "DELETE",
            expected: 404,
          });
        },
      );

      await t.test(
        "enforce tree depth and serialize concurrent cycle attempts",
        async () => {
          let parent = root;
          for (let depth = 2; depth <= 8; depth++)
            parent = await create({
              ...input,
              name: `Depth ${depth}`,
              parentId: parent.id,
            });
          await request("/api/admin/menus", {
            cookie: adminCookie,
            method: "POST",
            body: { ...input, parentId: parent.id },
            expected: 400,
          });
          const a = await create({ ...input, name: "Concurrent A" });
          const b = await create({ ...input, name: "Concurrent B" });
          const responses = await Promise.all(
            [a, b].map((row, index) =>
              fetch(base + `/api/admin/menus/${row.id}`, {
                method: "PUT",
                headers: {
                  Cookie: adminCookie,
                  Origin: base,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify(
                  edit(row, { parentId: index === 0 ? b.id : a.id }),
                ),
              }),
            ),
          );
          assert.deepEqual(responses.map((r) => r.status).sort(), [200, 400]);
          // Restore the successful move before cleanup.
          await request(`/api/admin/menus/${a.id}`, {
            cookie: adminCookie,
            method: "PUT",
            body: edit(a),
          });
          await request(`/api/admin/menus/${b.id}`, {
            cookie: adminCookie,
            method: "PUT",
            body: edit(b),
          });
        },
      );

      await t.test(
        "hide ancestors, restore, move and delete custom menus",
        async () => {
          await request(`/api/admin/menus/${root.id}`, {
            cookie: adminCookie,
            method: "PUT",
            body: edit(root, { visible: false }),
          });
          const hidden = await fetch(base + leaf.path, {
            headers: { Cookie: adminCookie },
          });
          const hiddenHtml = await hidden.text();
          assert.ok(
            hidden.status === 404 ||
              hiddenHtml.includes("NEXT_HTTP_ERROR_FALLBACK;404"),
          );
          await request(`/api/admin/menus/${root.id}`, {
            cookie: adminCookie,
            method: "PUT",
            body: edit(root),
          });
          await request(`/api/admin/menus/${leaf.id}`, {
            cookie: adminCookie,
            method: "PUT",
            body: edit(leaf, { parentId: null }),
          });
          await request(`/api/admin/menus/${leaf.id}`, {
            cookie: adminCookie,
            method: "DELETE",
          });
          assert.equal(
            (await db.query("SELECT id FROM menu WHERE id = $1", [leaf.id]))
              .rowCount,
            0,
          );
        },
      );
    } finally {
      // Delete only records created by this run, in child-first order.
      for (const id of [...createdIds].reverse())
        await db.query("DELETE FROM menu WHERE id = $1", [id]);
      if (testUserId)
        await db.query('DELETE FROM "user" WHERE id = $1 AND email = $2', [
          testUserId,
          testEmail,
        ]);
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
