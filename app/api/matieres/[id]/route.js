import { NextResponse } from "next/server";
import { supabaseAdmin, supabaseAdminConfigured, getCompteFromToken } from "@/lib/supabaseAdmin";

/* Supprime definitivement une matiere : reserve a l'administrateur et aux
   parents (voir signalement de Phil : pouvoir creer ET supprimer une
   matiere). Les matieres sont un referentiel commun sans proprietaire (pas
   de colonne cree_par), comme les chapitres.

   Contrairement a la suppression d'un chapitre (qui supprime ses documents
   avec lui), la suppression d'une matiere est bloquee tant qu'il reste des
   chapitres, des documents ou des devoirs qui la referencent : une matiere
   represente potentiellement un historique de devoirs sur plusieurs mois,
   qu'on ne veut jamais faire disparaitre par erreur. L'utilisateur doit
   d'abord vider la matiere (supprimer ses chapitres depuis l'onglet
   "Chapitres et documents", qui supprime aussi leurs documents ; supprimer
   les devoirs concernes depuis les cartes de devoirs) avant de pouvoir
   supprimer la matiere elle-meme. */
export async function DELETE(request, { params }) {
  if (!supabaseAdminConfigured) {
    return NextResponse.json({ error: "Supabase n'est pas encore configuré côté serveur (SUPABASE_SERVICE_ROLE_KEY manquante)." }, { status: 500 });
  }

  const compte = await getCompteFromToken(request);
  if (!compte || compte.statut !== "actif") {
    return NextResponse.json({ error: "Non autorisé." }, { status: 403 });
  }

  if (!["parent", "admin"].includes(compte.role)) {
    return NextResponse.json({ error: "Réservé aux parents et à l'administrateur." }, { status: 403 });
  }

  const { id } = await params;

  const { data: matiere, error: matiereError } = await supabaseAdmin
    .from("matieres")
    .select("id, nom")
    .eq("id", id)
    .single();

  if (matiereError || !matiere) {
    return NextResponse.json({ error: "Matière introuvable." }, { status: 404 });
  }

  const { count: nombreChapitres } = await supabaseAdmin
    .from("chapitres")
    .select("id", { count: "exact", head: true })
    .eq("matiere_id", id);

  if (nombreChapitres > 0) {
    return NextResponse.json(
      { error: `Impossible de supprimer « ${matiere.nom} » : ${nombreChapitres} chapitre(s) existent encore. Supprimez-les d'abord depuis l'onglet Chapitres et documents.` },
      { status: 400 }
    );
  }

  const { count: nombreDocuments } = await supabaseAdmin
    .from("documents")
    .select("id", { count: "exact", head: true })
    .eq("matiere_id", id);

  if (nombreDocuments > 0) {
    return NextResponse.json(
      { error: `Impossible de supprimer « ${matiere.nom} » : ${nombreDocuments} document(s) existent encore pour cette matière.` },
      { status: 400 }
    );
  }

  const { count: nombreDevoirs } = await supabaseAdmin
    .from("devoirs")
    .select("id", { count: "exact", head: true })
    .eq("matiere_id", id);

  if (nombreDevoirs > 0) {
    return NextResponse.json(
      { error: `Impossible de supprimer « ${matiere.nom} » : ${nombreDevoirs} devoir(s) existent encore pour cette matière.` },
      { status: 400 }
    );
  }

  const { error: deleteError } = await supabaseAdmin.from("matieres").delete().eq("id", id);
  if (deleteError) {
    return NextResponse.json({ error: `Échec de la suppression de la matière : ${deleteError.message}` }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

/* Renomme une matiere existante : corrige une erreur de frappe sans avoir a
   supprimer puis recreer la matiere (ce qui ferait perdre l'historique de
   ses chapitres, documents et devoirs, voir DELETE ci-dessus). Ouvert aux
   memes roles que la creation d'une matiere (parent, soutien, admin — voir
   supabase/policies.sql, "creation matieres par parent soutien ou admin"),
   contrairement a la suppression qui reste reservee a parent+admin :
   renommer n'est pas destructeur. */
export async function PATCH(request, { params }) {
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
  const body = await request.json();
  const nom = (body?.nom || "").trim();

  if (!nom) {
    return NextResponse.json({ error: "Le nom ne peut pas être vide." }, { status: 400 });
  }

  const { data: toutesMatieres, error: matieresError } = await supabaseAdmin.from("matieres").select("id, nom");
  if (matieresError) {
    return NextResponse.json({ error: `Échec de la vérification des doublons : ${matieresError.message}` }, { status: 500 });
  }

  const doublon = (toutesMatieres || []).some((m) => m.id !== id && m.nom.trim().toLowerCase() === nom.toLowerCase());
  if (doublon) {
    return NextResponse.json({ error: `Une matière « ${nom} » existe déjà.` }, { status: 400 });
  }

  const { error: updateError } = await supabaseAdmin.from("matieres").update({ nom }).eq("id", id);
  if (updateError) {
    return NextResponse.json({ error: `Échec du renommage de la matière : ${updateError.message}` }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
