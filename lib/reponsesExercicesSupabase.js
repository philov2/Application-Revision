import { supabase } from "@/lib/supabaseClient";
import { sanitizeNomFichier } from "@/lib/sanitizeNomFichier";

const BUCKET = "documents";

// Envoie un ou plusieurs fichiers (photo, PDF, Word...) pour un exercice et
// enregistre une seule réponse regroupant tous les fichiers envoyés. Une
// note et un commentaire uniques seront ensuite donnés pour l'ensemble par
// le parent ou le soutien (voir noterExercice) — pas de note par fichier.
export async function soumettreReponseExercice(devoirId, enfantId, fichiers) {
    const liste = Array.from(fichiers || []);
    if (liste.length === 0) throw new Error("Aucun fichier sélectionné.");

  const chemins = [];
    for (const fichier of liste) {
          const chemin = `${enfantId}/exercices/${Date.now()}-${sanitizeNomFichier(fichier.name)}`;
          const { error: uploadError } = await supabase.storage.from(BUCKET).upload(chemin, fichier);
          if (uploadError) throw uploadError;
          chemins.push(chemin);
    }

  const { error: insertError } = await supabase.from("reponses_exercices").insert({
        devoir_id: devoirId,
        fichiers_urls: chemins,
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

export async function urlSigneeFichierExercice(chemin) {
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(chemin, 60);
    if (error) throw error;
    return data.signedUrl;
}
