import { NextResponse } from "next/server";
import { supabaseAdmin, supabaseAdminConfigured } from "@/lib/supabaseAdmin";

// Route de diagnostic TEMPORAIRE (à supprimer une fois le problème résolu) :
// permet de voir précisément où échoue la vérification du jeton côté serveur
// (jeton absent, échec de auth.getUser, ou compte introuvable en base) sans
// avoir besoin d'accéder aux logs Vercel. Ne renvoie aucune information
// sensible (pas de clé, pas de jeton complet).
export async function GET(request) {
  const diag = { supabaseAdminConfigured };

  const authHeader = request.headers.get("authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  diag.tokenPresent = Boolean(token);
  diag.tokenLength = token.length;

  if (!supabaseAdminConfigured) {
    return NextResponse.json(diag);
  }

  if (!token) {
    return NextResponse.json(diag);
  }

  const { data: userData, error: getUserError } = await supabaseAdmin.auth.getUser(token);
  diag.getUserError = getUserError ? getUserError.message : null;
  diag.userId = userData?.user?.id || null;
  diag.userEmail = userData?.user?.email || null;

  if (!userData?.user) {
    return NextResponse.json(diag);
  }

  const { data: compte, error: compteError } = await supabaseAdmin
    .from("comptes")
    .select("id, role, statut, nom, email")
    .eq("id", userData.user.id)
    .single();

  diag.compteError = compteError ? compteError.message : null;
  diag.compte = compte || null;

  return NextResponse.json(diag);
}
