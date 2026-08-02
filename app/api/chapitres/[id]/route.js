import { NextResponse } from "next/server";
import { supabaseAdmin, supabaseAdminConfigured, getCompteFromToken } from "@/lib/supabaseAdmin";

// Supprime définitivement un chapitre : réservé aux mêmes rôles que la
// création (parent, soutien, admin — voir supabase/policies.sql, "creation
// chapitres par parent ou admin"). Les chapitres sont un référentiel commun
// sans propriétaire (pas de colonne cree_par), donc pas de restriction par
// rattachement ici, comme pour la création.
//
// Les documents, devoirs et tests qui référençaient ce chapitre ne sont pas
// supprimés : ils perdent simplement leur chapitre associé. Voir Jalon
// "suppression de chapitres obsolètes" : documents.chapitre_id,
// devoirs.chapitre_id et tests.chapitre_id sont en "on delete set null"
// côté base (même principe que pour la suppression d'un document référencé
// par un devoir).
export async function DELETE(request, { params }) {
  if (!supabaseAdminConfigured) {
    return NextResponse.json({ error: "Supabase n'est pas encore configuré côté serveur (SUPABASE_SERVICE_ROLE_KEY manquante)." }, { status: 500 });
  }

  const compte = await getCompteFromToken(request);
  if (!compte || compte.statut !== "actif") {
    return NextResponse.json({ error: "Non autorisé." }, { status: 403 });
  }

  if (!["parent", "soutien", "admin"].includes(compte.role)) {
    return NextResponse.json({ error: "Réservé aux parents, soutiens et à l'administrateur." }, { status: 403 });
  }

  const { id } = await params;

  const { data: chapitre, error: chapitreError } = await supabaseAdmin
    .from("chapitres")
    .select("id")
    .eq("id", id)
    .single();

  if (chapitreError || !chapitre) {
    return NextResponse.json({ error: "Chapitre introuvable." }, { status: 404 });
  }

  const { error: deleteError } = await supabaseAdmin.from("chapitres").delete().eq("id", id);
  if (deleteError) {
    return NextResponse.json({ error: `Échec de la suppression du chapitre : ${deleteError.message}` }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
