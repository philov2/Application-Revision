import { supabase } from "@/lib/supabaseClient";

export async function chargerTestsChapitre(chapitreId) {
  const { data, error } = await supabase
    .from("tests")
    .select("id, titre, questions, chapitre_id")
    .eq("chapitre_id", chapitreId);
  if (error) throw error;
  return data || [];
}

export async function chargerTest(testId) {
    const { data, error } = await supabase
          .from("tests")
          .select("id, titre, questions, chapitre_id")
          .eq("id", testId)
          .maybeSingle();
    if (error) throw error;
    return data || null;
}

export async function creerTest({ chapitreId, titre, questions }) {
  const { error } = await supabase.from("tests").insert({
    chapitre_id: chapitreId,
    titre,
    questions,
  });
  if (error) throw error;
}

export async function supprimerTest(testId) {
  const { error } = await supabase.from("tests").delete().eq("id", testId);
  if (error) throw error;
}

export async function chargerResultatTest(testId, enfantId) {
  const { data, error } = await supabase
    .from("resultats_tests")
    .select("id, reponses, note, date_realisation, complet")
    .eq("test_id", testId)
    .eq("enfant_id", enfantId)
    .order("date_realisation", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data || null;
}

export async function soumettreResultatTest({ testId, enfantId, reponses, note }) {
  const { error } = await supabase.from("resultats_tests").insert({
    test_id: testId,
    enfant_id: enfantId,
    reponses,
    note,
    complet: true,
  });
  if (error) throw error;
}
