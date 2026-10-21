import { NextResponse } from "next/server";
import { requireSession, apiError } from "@/lib/admin-auth";
import { navigationMenus } from "@/lib/permissions";

export async function GET() {
  try {
    const session = await requireSession();
    return NextResponse.json(await navigationMenus(session.user));
  } catch (error) {
    return apiError(error);
  }
}
