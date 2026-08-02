import { NextResponse } from "next/server";
import { supabaseAdmin, supabaseAdminConfigured } from "@/lib/supabaseAdmin";

// Route de diagnostic TEMPORAIRE (à supprimer une fois le problème résolu).
export async function GET(request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  const diag = {
    supabaseAdminConfigured,
    supabaseUrl,
    serviceRoleKeyLength: serviceRoleKey ? serviceRoleKey.length : 0,
    serviceRoleKeyPrefix: serviceRoleKey ? serviceRoleKey.slice(0, 12) : null,
  };

  const authHeader = request.headers.get("authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  diag.tokenPresent = Boolean(token);
  diag.tokenLength = token.length;

  if (!supabaseAdminConfigured || !token) {
    return NextResponse.json(diag);
  }

  try {
    const res = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: {
        Authorization: `Bearer ${token}`,
        apikey: serviceRoleKey,
      },
    });
    diag.fetchStatus = res.status;
    diag.fetchOk = res.ok;
    const text = await res.text();
    diag.fetchBody = text.slice(0, 500);
  } catch (e) {
    diag.fetchThrew = String(e);
  }

  return NextResponse.json(diag);
}
