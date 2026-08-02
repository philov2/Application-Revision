import { NextResponse } from "next/server";
import { supabaseAdmin, supabaseAdminConfigured, getCompteFromToken } from "@/lib/supabaseAdmin";

// Supprime définitivement un document : réservé à l'administrateur ou à la
// personne qui l'a importé (cree_par). Supprime aussi le fichier associé
// dans le Storage.
//
// Ordre volontaire : on supprime d'abord la ligne en base, puis le fichier
// dans le Storage. Auparavant l'ordre était inversé, ce qui pouvait supprimer
// le fichier du Storage puis échouer sur la suppression en base (par exemple
// si un devoir référence encore ce document), laissant une ligne orpheline
// pointant vers un fichier disparu. Voir Jalon "suppression d'un document
// référencé par un devoir" : devoirs.document_id est désormais en
// "on delete set null" côté base, donc la suppression en base réussit même
// si un devoir référence encore le document (le devoir perd simplement son
// document associé).
export async function DELETE(request, { params }) {
  if (!supabaseAdminConfigured) {
    return NextResponse.json({ error: "Supabase n'est pas encore configuré côté serveur (SUPABASE_SERVICE_ROLE_KEY manquante)." }, { status: 500 });
  }

  const compte = await getCompteFromToken(request);
  if (!compte || compte.statut !== "actif") {
    return NextResponse.json({ error: "Non autorisé." }, { status: 403 });
  }

  const { id } = await params;

  const { data: document, error: documentError } = await supabaseAdmin
    .from("documents")
    .select("*")
    .eq("id", id)
    .single();

  if (documentError || !document) {
    return NextResponse.json({ error: "Document introuvable." }, { status: 404 });
  }

  if (compte.role !== "admin" && document.cree_par !== compte.id) {
    return NextResponse.json({ error: "Réservé à l'administrateur ou à la personne ayant importé ce document." }, { status: 403 });
  }

  const { error: deleteError } = await supabaseAdmin.from("documents").delete().eq("id", id);
  if (deleteError) {
    return NextResponse.json({ error: `Échec de la suppression du document : ${deleteError.message}` }, { status: 500 });
  }

  const { error: storageError } = await supabaseAdmin.storage.from("documents").remove([document.fichier_url]);
  if (storageError) {
    // La ligne est déjà supprimée en base ; le fichier restera orphelin dans
    // le Storage mais n'est plus référencé par l'application. On ne fait pas
    // échouer la requête pour autant : du point de vue de l'utilisateur, le
    // document a bien été supprimé.
    return NextResponse.json({ success: true, avertissement: `Document supprimé, mais le fichier n'a pas pu être retiré du stockage : ${storageError.message}` });
  }

  return NextResponse.json({ success: true });
}
