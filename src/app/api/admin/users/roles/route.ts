import { NextResponse } from "next/server";
import { db } from "@/db";
import { appRole } from "@/db/schema";
import { apiError } from "@/lib/admin-auth";
import { requireMenuAccess } from "@/lib/permissions";

export async function GET() {
  try {
    await requireMenuAccess("/admin/users");
    return NextResponse.json(
      await db
        .select({ id: appRole.id, name: appRole.name })
        .from(appRole)
        .orderBy(appRole.createdAt),
    );
  } catch (error) {
    return apiError(error);
  }
}
