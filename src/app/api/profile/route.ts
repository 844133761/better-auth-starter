import { NextResponse } from "next/server";
import { requireSession, apiError } from "@/lib/admin-auth";
import { db } from "@/db";
import { account } from "@/db/schema";
import { effectiveRoles } from "@/lib/role-service";
import { eq, and } from "drizzle-orm";

export async function GET() {
  try {
    const session = await requireSession();
    const [roles, credentials] = await Promise.all([
      effectiveRoles(session.user.id, session.user.role),
      db
        .select({ password: account.password })
        .from(account)
        .where(
          and(
            eq(account.userId, session.user.id),
            eq(account.providerId, "credential"),
          ),
        )
        .limit(1),
    ]);
    return NextResponse.json({
      user: session.user,
      roles,
      hasPassword: Boolean(credentials[0]?.password),
    });
  } catch (error) {
    return apiError(error);
  }
}
