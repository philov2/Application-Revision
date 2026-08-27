import { NextResponse } from "next/server";
import { supabaseAdmin, supabaseAdminConfigured, getCompteFromToken } from "@/lib/supabaseAdmin";

// Permet à un compte connecté de modifier certains réglages qui ne
// concernent que lui-même, sans passer par l'écran Admin > Comptes (réservé
// à la gestion nom/rôle/téléphone par l'administrateur — voir
// app/api/comptes/[id]/route.js). Pour l'instant, seul le champ
// couleur_accent est concerné (Jalon "personnalisation de l'espace Enfant",
// signalement de Phil) — volontairement une liste blanche de champs plutôt
// qu'un PATCH générique, pour qu'un compte ne puisse jamais modifier son
// propre rôle ou statut par ce biais. La couleur elle-même est aussi
// restreinte à une palette fixe (voir components/PersonnalisationEspace.js),
// pour ne jamais enregistrer une valeur CSS arbitraire non prévue.
const PALETTE_AUTORISEE = ["#4169E1", "#FF7F6B", "#10B981", "#8B5CF6", "#F59E0B", "#F43F5E", "#14B8A6", "#0EA5E9"];

export async function PATCH(request) {
  if (!supabaseAdminConfigured) {
    return NextResponse.json({ error: "Supabase n'est pas encore configuré côté serveur (SUPABASE_SERVICE_ROLE_KEY manquante)." }, { status: 500 });
  }

  const compte = await getCompteFromToken(request);
  if (!compte || compte.statut !== "actif") {
    return NextResponse.json({ error: "Non autorisé." }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const misesAJour = {};

  if (body.couleurAccent !== undefined) {
    if (body.couleurAccent !== null && !PALETTE_AUTORISEE.includes(body.couleurAccent)) {
      return NextResponse.json({ error: "Couleur non reconnue." }, { status: 400 });
    }
    misesAJour.couleur_accent = body.couleurAccent;
  }

  if (Object.keys(misesAJour).length === 0) {
    return NextResponse.json({ error: "Aucune modification valide fournie." }, { status: 400 });
  }

  const { error } = await supabaseAdmin.from("comptes").update(misesAJour).eq("id", compte.id);
  if (error) {
    return NextResponse.json({ error: `Échec de l'enregistrement : ${error.message}` }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
