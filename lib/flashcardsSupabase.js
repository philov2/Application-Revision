import { supabase } from "@/lib/supabaseClient";

// Jalon "flashcards" (signalement de Phil : rendre l'application plus
// attractive pour une adolescente, dans la meme veine que le streak, le
// minuteur focus et la progression par matiere) : memes fonctions que
// lib/testsSupabase.js, pour un mode de revision interactif carte a carte
// genere par IA (voir components/RevisionFlashcards.js et
// app/api/documents/[id]/flashcards-ia/route.js). Pas de creerFlashcards ici
// : contrairement aux tests (creation manuelle possible via
// FormulaireTest.js), les decks de flashcards ne sont crees que par l'IA,
// directement dans la route API (via supabaseAdmin), donc jamais depuis le
// client.

export async function chargerFlashcardsChapitre(chapitreId) {
  const { data, error } = await supabase
    .from("flashcards")
    .select("id, titre, cartes, chapitre_id")
    .eq("chapitre_id", chapitreId);
  if (error) throw error;
  return data || [];
}

export async function chargerFlashcards(flashcardsId) {
  const { data, error } = await supabase
    .from("flashcards")
    .select("id, titre, cartes, chapitre_id")
    .eq("id", flashcardsId)
    .maybeSingle();
  if (error) throw error;
  return data || null;
}

export async function supprimerFlashcards(flashcardsId) {
  const { error } = await supabase.from("flashcards").delete().eq("id", flashcardsId);
  if (error) throw error;
}
