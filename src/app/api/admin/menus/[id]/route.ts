import { requireMenuAccess } from "@/lib/permissions";
import { NextResponse } from "next/server";
import { apiError } from "@/lib/admin-auth";
import { saveMenu, deleteMenu } from "@/lib/menu-service";

type Context = { params: Promise<{ id: string }> };

export async function PUT(request: Request, context: Context) {
  try {
    await requireMenuAccess("/admin/menus", request);
    const { id } = await context.params;
    return NextResponse.json(await saveMenu(await request.json(), id));
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(request: Request, context: Context) {
  try {
    await requireMenuAccess("/admin/menus", request);
    const { id } = await context.params;
    await deleteMenu(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    return apiError(error);
  }
}
