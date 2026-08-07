import { NextResponse } from "next/server";
import { supabaseAdmin, supabaseAdminConfigured, getCompteFromToken } from "@/lib/supabaseAdmin";

// Rattache automatiquement un soutien à une matière qu'il vient de créer
// lui-même (bouton "+ Créer une nouvelle matière" dans le formulaire
// "Nouveau devoir"). Sans cette route, la matière se crée bien (policy
// ouverte à parent/soutien/admin), mais créer ensuite un chapitre ou un
// devoir dans cette matière échoue avec "non autorisé", car aucune ligne
// liens_soutien ne relie encore ce soutien à cette matière pour cet enfant
// (signalement : "la création d'un devoir dans le chapitre Technologie
// n'est pas autorisé" — la matière Technologie avait été créée à la volée
// mais le soutien n'y était pas rattaché).
//
// Réservé aux soutiens déjà rattachés à l'enfant concerné (au moins une
// autre matière) : on ne permet pas de s'auto-rattacher à un enfant
// totalement étranger. Pour les autres rôles (parent, non limité par
// matière), la route ne fait rien.
export async function POST(request) {
  if (!supabaseAdminConfigured) {
    return NextResponse.json({ error: "Supabase n'est pas encore configuré côté serveur." }, { status: 500 });
  }

  const compte = await getCompteFromToken(request);
  if (!compte) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }

  if (compte.role !== "soutien") {
    return NextResponse.json({ success: true, ignore: true });
  }

  const { enfantId, matiereId } = await request.json();
  if (!enfantId || !matiereId) {
    return NextResponse.json({ error: "enfantId et matiereId requis." }, { status: 400 });
  }

  // Remarque : liens_soutien n'a pas de colonne "id" (clé primaire composite
  // soutien_id + enfant_id + matiere_id, voir schema.sql) — on sélectionne
  // donc une colonne qui existe vraiment.
  const { data: dejaRattache } = await supabaseAdmin
    .from("liens_soutien")
    .select("matiere_id")
    .eq("soutien_id", compte.id)
    .eq("enfant_id", enfantId)
    .limit(1);

  if (!dejaRattache || dejaRattache.length === 0) {
    return NextResponse.json({ error: "Vous n'êtes pas encore rattaché à cet enfant." }, { status: 403 });
  }

  const { data: existant } = await supabaseAdmin
    .from("liens_soutien")
    .select("matiere_id")
    .eq("soutien_id", compte.id)
    .eq("enfant_id", enfantId)
    .eq("matiere_id", matiereId)
    .maybeSingle();

  if (!existant) {
    const { error } = await supabaseAdmin
      .from("liens_soutien")
      .insert({ soutien_id: compte.id, enfant_id: enfantId, matiere_id: matiereId });
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  return NextResponse.json({ success: true });
}
