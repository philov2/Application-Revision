import { NextResponse } from "next/server";
import { supabaseAdmin, supabaseAdminConfigured, getCompteFromToken } from "@/lib/supabaseAdmin";

// Envoie un email de réinitialisation de mot de passe à un compte existant :
// réservé à l'administrateur. Utilise le même flux que l'email d'invitation
// (redirection vers /definir-mot-de-passe, déjà prête à gérer un lien
// "type=recovery" en plus de "type=invite", voir app/page.js).
export async function POST(request, { params }) {
  if (!supabaseAdminConfigured) {
    return NextResponse.json({ error: "Supabase n'est pas encore configuré côté serveur (SUPABASE_SERVICE_ROLE_KEY manquante)." }, { status: 500 });
  }

  const compte = await getCompteFromToken(request);
  if (!compte || compte.role !== "admin") {
    return NextResponse.json({ error: "Réservé à l'administrateur." }, { status: 403 });
  }

  const { id } = await params;

  const { data: cible, error: cibleError } = await supabaseAdmin
    .from("comptes")
    .select("email")
    .eq("id", id)
    .single();

  if (cibleError || !cible) {
    return NextResponse.json({ error: "Compte introuvable." }, { status: 404 });
  }

  const { error: resetError } = await supabaseAdmin.auth.resetPasswordForEmail(cible.email, {
    redirectTo: new URL("/definir-mot-de-passe", request.url).toString(),
  });

  if (resetError) {
    return NextResponse.json({ error: `Échec de l'envoi de l'email : ${resetError.message}` }, { status: 500 });
  }

  return NextResponse.json({ success: true, email: cible.email });
}
