import { NextResponse } from "next/server";
import { supabaseAdmin, supabaseAdminConfigured, getCompteFromToken } from "@/lib/supabaseAdmin";

// Supprime définitivement un chapitre : réservé aux mêmes rôles que la
// création (parent, soutien, admin — voir supabase/policies.sql, "creation
// chapitres par parent ou admin"). Les chapitres sont un référentiel commun
// sans propriétaire (pas de colonne cree_par), donc pas de restriction par
// rattachement ici, comme pour la création.
//
// Les documents qui appartiennent à ce chapitre sont supprimés avec lui
// (ligne en base + fichier dans le Storage), comme avant l'introduction du
// chapitre obligatoire (voir Jalon "chapitre obligatoire pour les
// documents"). Un chapitre supprimé ne doit pas laisser derrière lui des
// documents orphelins à réassigner : le chapitre et son contenu forment un
// tout. devoirs.chapitre_id et tests.chapitre_id restent en "on delete set
// null" côté base (un devoir ou un test perd simplement son chapitre
// associé, il n'est pas supprimé).
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

  // Supprime d'abord les documents du chapitre (ligne + fichier Storage),
  // avant de supprimer le chapitre lui-même — même ordre volontaire que pour
  // la suppression d'un document seul (voir app/api/documents/[id]/route.js) :
  // la ligne en base d'abord, le fichier dans le Storage ensuite, pour ne
  // jamais laisser une ligne orpheline pointant vers un fichier disparu.
  const { data: documents, error: documentsError } = await supabaseAdmin
    .from("documents")
    .select("id, fichier_url")
    .eq("chapitre_id", id);

  if (documentsError) {
    return NextResponse.json({ error: `Échec de la lecture des documents du chapitre : ${documentsError.message}` }, { status: 500 });
  }

  let avertissement = null;

  if (documents && documents.length > 0) {
    const documentIds = documents.map((d) => d.id);
    const { error: suppressionDocumentsError } = await supabaseAdmin.from("documents").delete().in("id", documentIds);
    if (suppressionDocumentsError) {
      return NextResponse.json({ error: `Échec de la suppression des documents du chapitre : ${suppressionDocumentsError.message}` }, { status: 500 });
    }

    const chemins = documents.map((d) => d.fichier_url).filter(Boolean);
    if (chemins.length > 0) {
      const { error: storageError } = await supabaseAdmin.storage.from("documents").remove(chemins);
      if (storageError) {
        // Les lignes sont déjà supprimées en base ; certains fichiers
        // resteront orphelins dans le Storage mais ne sont plus référencés
        // par l'application. On ne fait pas échouer la requête pour autant.
        avertissement = `Chapitre et documents supprimés, mais certains fichiers n'ont pas pu être retirés du stockage : ${storageError.message}`;
      }
    }
  }

  const { error: deleteError } = await supabaseAdmin.from("chapitres").delete().eq("id", id);
  if (deleteError) {
    return NextResponse.json({ error: `Échec de la suppression du chapitre : ${deleteError.message}` }, { status: 500 });
  }

  return NextResponse.json(avertissement ? { success: true, avertissement } : { success: true });
}

/* Renomme un chapitre existant : corrige une erreur de frappe sans avoir a
   le supprimer puis le recreer (ce qui supprimerait aussi tous ses
   documents, voir DELETE ci-dessus). Ouvert aux memes roles que la
   creation/suppression d'un chapitre (parent, soutien, admin). L'unicite du
   nom n'est verifiee que parmi les chapitres de la MEME matiere (comme pour
   la creation), pas globalement. */
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

  const { data: chapitre, error: chapitreError } = await supabaseAdmin
    .from("chapitres")
    .select("id, matiere_id")
    .eq("id", id)
    .single();

  if (chapitreError || !chapitre) {
    return NextResponse.json({ error: "Chapitre introuvable." }, { status: 404 });
  }

  const { data: chapitresMemeMatiere, error: chapitresError } = await supabaseAdmin
    .from("chapitres")
    .select("id, nom")
    .eq("matiere_id", chapitre.matiere_id);

  if (chapitresError) {
    return NextResponse.json({ error: `Échec de la vérification des doublons : ${chapitresError.message}` }, { status: 500 });
  }

  const doublon = (chapitresMemeMatiere || []).some((c) => c.id !== id && c.nom.trim().toLowerCase() === nom.toLowerCase());
  if (doublon) {
    return NextResponse.json({ error: `Un chapitre « ${nom} » existe déjà dans cette matière.` }, { status: 400 });
  }

  const { error: updateError } = await supabaseAdmin.from("chapitres").update({ nom }).eq("id", id);
  if (updateError) {
    return NextResponse.json({ error: `Échec du renommage du chapitre : ${updateError.message}` }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
