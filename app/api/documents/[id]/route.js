import { NextResponse } from "next/server";
import { supabaseAdmin, supabaseAdminConfigured, getCompteFromToken } from "@/lib/supabaseAdmin";

// Supprime définitivement un document : réservé à l'administrateur ou à la
// personne qui l'a importé (cree_par). Supprime aussi le fichier associé
// dans le Storage.
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

  const { error: storageError } = await supabaseAdmin.storage.from("documents").remove([document.fichier_url]);
  if (storageError) {
    return NextResponse.json({ error: `Échec de la suppression du fichier : ${storageError.message}` }, { status: 500 });
  }

  const { error: deleteError } = await supabaseAdmin.from("documents").delete().eq("id", id);
  if (deleteError) {
    return NextResponse.json({ error: `Échec de la suppression du document : ${deleteError.message}` }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
