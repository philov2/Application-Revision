import { NextResponse } from "next/server";
import { supabaseAdmin, supabaseAdminConfigured, getCompteFromToken } from "@/lib/supabaseAdmin";

// Un parent crée directement le compte de son enfant (pas de validation admin
// nécessaire, conformément au DCF). Envoie un email d'invitation à l'enfant
// pour qu'il choisisse son mot de passe.
export async function POST(request) {
  if (!supabaseAdminConfigured) {
    return NextResponse.json({ error: "Supabase n'est pas encore configuré côté serveur (SUPABASE_SERVICE_ROLE_KEY manquante)." }, { status: 500 });
  }

  const compte = await getCompteFromToken(request);
  if (!compte || compte.role !== "parent") {
    return NextResponse.json({ error: "Réservé aux comptes Parent." }, { status: 403 });
  }

  const { nom, email, niveau_scolaire } = await request.json();
  if (!nom || !email) {
    return NextResponse.json({ error: "Nom et email requis." }, { status: 400 });
  }

  const { data: invite, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, { redirectTo: new URL("/definir-mot-de-passe", request.url).toString() });
  if (inviteError) {
    return NextResponse.json({ error: `Échec de l'invitation : ${inviteError.message}` }, { status: 500 });
  }
  const enfantId = invite.user.id;

  const { error: compteError } = await supabaseAdmin.from("comptes").insert({
    id: enfantId,
    email,
    nom,
    role: "enfant",
    statut: "actif",
  });
  if (compteError) {
    return NextResponse.json({ error: `Échec de la création du compte : ${compteError.message}` }, { status: 500 });
  }

  const { error: lienError } = await supabaseAdmin.from("liens_parent_enfant").insert({
    parent_id: compte.id,
    enfant_id: enfantId,
    niveau_scolaire: niveau_scolaire || null,
  });
  if (lienError) {
    return NextResponse.json({ error: `Échec du rattachement : ${lienError.message}` }, { status: 500 });
  }

  return NextResponse.json({ success: true, enfantId });
}
