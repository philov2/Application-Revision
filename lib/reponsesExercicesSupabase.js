import { supabase } from "@/lib/supabaseClient";

const BUCKET = "documents";

export async function soumettrePhotoExercice(devoirId, enfantId, fichier) {
  const chemin = `${enfantId}/exercices/${Date.now()}-${fichier.name}`;
  const { error: uploadError } = await supabase.storage.from(BUCKET).upload(chemin, fichier);
  if (uploadError) throw uploadError;
  const { error: insertError } = await supabase.from("reponses_exercices").insert({
    devoir_id: devoirId,
    photo_url: chemin,
  });
  if (insertError) throw insertError;
}

export async function noterExercice(reponseId, { note, commentaire, notePar }) {
  const { error } = await supabase
    .from("reponses_exercices")
    .update({ note, commentaire, note_par: notePar })
    .eq("id", reponseId);
  if (error) throw error;
}

export async function urlSigneePhotoExercice(chemin) {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(chemin, 60);
  if (error) throw error;
  return data.signedUrl;
}
