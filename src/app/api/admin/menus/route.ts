import { requireMenuAccess } from "@/lib/permissions";
import { NextResponse } from "next/server";
import { apiError } from "@/lib/admin-auth";
import { listMenus, saveMenu } from "@/lib/menu-service";

export async function GET() {
  try {
    await requireMenuAccess("/admin/menus");
    return NextResponse.json(await listMenus());
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  try {
    await requireMenuAccess("/admin/menus", request);
    return NextResponse.json(await saveMenu(await request.json()), {
      status: 201,
    });
  } catch (error) {
    return apiError(error);
  }
}
