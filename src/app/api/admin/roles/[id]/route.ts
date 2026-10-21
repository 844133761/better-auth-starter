import { NextResponse } from "next/server";
import { apiError } from "@/lib/admin-auth";
import { requireMenuAccess } from "@/lib/permissions";
import { saveRole, deleteRole } from "@/lib/role-service";
type Context = { params: Promise<{ id: string }> };
export async function PUT(request: Request, context: Context) {
  try {
    await requireMenuAccess("/admin/roles", request);
    const { id } = await context.params;
    return NextResponse.json(await saveRole(await request.json(), id));
  } catch (error) {
    return apiError(error);
  }
}
export async function DELETE(request: Request, context: Context) {
  try {
    await requireMenuAccess("/admin/roles", request);
    const { id } = await context.params;
    await deleteRole(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    return apiError(error);
  }
}
