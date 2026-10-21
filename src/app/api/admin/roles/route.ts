import { NextResponse } from "next/server";
import { apiError } from "@/lib/admin-auth";
import { requireMenuAccess } from "@/lib/permissions";
import { rolesData, saveRole } from "@/lib/role-service";

export async function GET() {
  try {
    await requireMenuAccess("/admin/roles");
    return NextResponse.json(await rolesData());
  } catch (error) {
    return apiError(error);
  }
}
export async function POST(request: Request) {
  try {
    await requireMenuAccess("/admin/roles", request);
    return NextResponse.json(await saveRole(await request.json()), {
      status: 201,
    });
  } catch (error) {
    return apiError(error);
  }
}
