import { db } from "@/db";
import { user, appRole, userRole } from "@/db/schema";
import {
  and,
  eq,
  ilike,
  asc,
  desc,
  count,
  inArray,
  or,
  isNull,
} from "drizzle-orm";
import { ADMIN_ROLE_ID, USER_ROLE_ID, isSystemRole } from "@/lib/roles";

export interface UserWithDetails {
  id: string;
  name: string;
  email: string;
  verified: boolean;
  banned: boolean;
  banReason?: string;
  banExpires?: Date | null;
  accounts: string[];
  lastSignIn: Date | null;
  createdAt: Date;
  avatarUrl: string;
  role?: string;
  roleNames?: string[];
  roleIds?: string[];
}

export interface GetUsersOptions {
  limit?: number;
  offset?: number;
  sortBy?: string;
  sortDirection?: "asc" | "desc";
  role?: string;
  status?: string;
  email?: string;
  name?: string;
}

export async function getUsers(
  options: GetUsersOptions = {},
): Promise<{ users: UserWithDetails[]; total: number }> {
  const filters = [];
  if (options.role === ADMIN_ROLE_ID) filters.push(eq(user.role, "admin"));
  else if (options.role === USER_ROLE_ID)
    filters.push(or(eq(user.role, "user"), isNull(user.role))!);
  else if (options.role)
    filters.push(
      inArray(
        user.id,
        db
          .select({ id: userRole.userId })
          .from(userRole)
          .where(eq(userRole.roleId, options.role)),
      ),
    );
  if (options.email) filters.push(ilike(user.email, "%" + options.email + "%"));
  if (options.name) filters.push(ilike(user.name, "%" + options.name + "%"));
  if (options.status)
    filters.push(eq(user.banned, options.status === "banned"));
  const where = and(...filters);
  const sortColumn = options.sortBy === "name" ? user.name : user.createdAt;
  const [rows, totalRows, memberships] = await Promise.all([
    db
      .select()
      .from(user)
      .where(where)
      .orderBy(
        options.sortDirection === "asc" ? asc(sortColumn) : desc(sortColumn),
      )
      .limit(options.limit ?? 10)
      .offset(options.offset ?? 0),
    db.select({ total: count() }).from(user).where(where),
    db
      .select({ userId: userRole.userId, id: appRole.id, name: appRole.name })
      .from(userRole)
      .innerJoin(appRole, eq(appRole.id, userRole.roleId)),
  ]);
  const result = { users: rows, total: totalRows[0].total };

  // Query separate tables to get accounts information
  const accountsQuery = await db.query.account.findMany({
    columns: {
      userId: true,
      providerId: true,
    },
  });

  // Query session information
  const sessionsQuery = await db.query.session.findMany({
    columns: {
      userId: true,
      createdAt: true,
    },
    orderBy: (session) => [session.createdAt],
  });

  // Group accounts by user ID
  const accountsByUser = accountsQuery.reduce(
    (acc, account) => {
      if (!acc[account.userId]) {
        acc[account.userId] = [];
      }
      acc[account.userId].push(account.providerId);
      return acc;
    },
    {} as Record<string, string[]>,
  );

  // Get last sign in date by user ID
  const lastSignInByUser = sessionsQuery.reduce(
    (acc, session) => {
      if (!acc[session.userId] || session.createdAt > acc[session.userId]) {
        acc[session.userId] = session.createdAt;
      }
      return acc;
    },
    {} as Record<string, Date>,
  );

  // Transform the raw data into the format expected by the UsersTable component
  const users: UserWithDetails[] = result.users.map((user) => {
    const accounts = accountsByUser[user.id] || [];
    const banned = user.banned ?? false;
    const banReason = user.banReason || "";
    const banExpires = user.banExpires || null;
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      verified: user.emailVerified,
      role: user.role ?? "user",
      roleIds:
        user.role === "admin"
          ? [ADMIN_ROLE_ID]
          : [
              USER_ROLE_ID,
              ...memberships
                .filter((m) => m.userId === user.id && !isSystemRole(m.id))
                .map((m) => m.id),
            ],
      roleNames:
        user.role === "admin"
          ? ["超级管理员"]
          : [
              "普通用户",
              ...memberships
                .filter((m) => m.userId === user.id && !isSystemRole(m.id))
                .map((m) => m.name),
            ],
      banned,
      banReason,
      banExpires,
      accounts,
      lastSignIn: lastSignInByUser[user.id] || null,
      createdAt: user.createdAt,
      avatarUrl: user.image || "",
    };
  });

  return { users, total: result.total ?? users.length };
}
