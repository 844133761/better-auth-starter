import { NextResponse } from "next/server";
import { apiError, requireAdmin } from "@/lib/admin-auth";
import { setUserRoles } from "@/lib/role-service";

export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    await requireAdmin(request);
    const { id } = await context.params;
    return NextResponse.json(await setUserRoles(id, await request.json()));
  } catch (error) {
    return apiError(error);
  }
}
