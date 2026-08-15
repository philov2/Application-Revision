import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { consigneLangue } from "@/lib/langueMatiere";
import { genererTexteIA } from "@/lib/genererTexteIA";

// Genere automatiquement le corrige d'une serie d'exercices produite par IA,
// et l'enregistre comme un nouveau document de type "corrige" relie a
// l'exercice via corrige_de_id (voir schema.sql). Utilise par les deux
// routes de generation d'exercices IA (par prompt et a partir d'un cours).
//
// La generation passe par lib/genererTexteIA.js (Claude puis Gemini en
// secours). Non bloquant : si la generation ou l'enregistrement du corrige
// echoue, on logge l'erreur et on renvoie null plutot que de faire echouer
// toute la requete - l'exercice, lui, a deja ete cree avec succes.
export async function genererEtEnregistrerCorrige({ texteExercices, nomDocumentExercice, documentExerciceId, matiereId, chapitreId, enfantId, creePar, nomMatiere }) {
    try {
          const consigneLangueMatiere = consigneLangue(nomMatiere);
          const { texte: texteCorrige } = await genererTexteIA({
                  systemPrompt: `Tu es un assistant pedagogique. Voici une serie d'exercices d'entrainement destines a un eleve de college ou lycee. Redige le corrige complet et detaille : pour chaque exercice, donne la reponse attendue avec une courte explication, en reprenant la meme numerotation que les exercices. ${consigneLangueMatiere}`,
                  promptTexte: texteExercices,
                  maxTokens: 4096,
          });

      const cheminCorrige = `${enfantId}/${Date.now()}-corrige-exercices-ia.md`;
          const { error: uploadError } = await supabaseAdmin.storage
            .from("documents")
            .upload(cheminCorrige, Buffer.from(texteCorrige, "utf-8"), { contentType: "text/markdown; charset=utf-8" });
          if (uploadError) {
                  console.error(`Echec de l'enregistrement du corrige : ${uploadError.message}`);
                  return null;
          }

      const { data: nouveauCorrige, error: insertError } = await supabaseAdmin
            .from("documents")
            .insert({
                      nom: `Corrige - ${nomDocumentExercice}`,
                      type: "corrige",
                      matiere_id: matiereId,
                      chapitre_id: chapitreId || null,
                      enfant_id: enfantId,
                      cree_par: creePar,
                      fichier_url: cheminCorrige,
                      taille_octets: Buffer.byteLength(texteCorrige, "utf-8"),
                      format: "text/markdown",
                      genere_par_ia: true,
                      corrige_de_id: documentExerciceId,
            })
            .select()
            .single();

      if (insertError) {
              console.error(`Echec de l'enregistrement du corrige : ${insertError.message}`);
              return null;
      }

      return nouveauCorrige;
    } catch (err) {
          console.error(`Echec de la generation du corrige : ${err.message}`);
          return null;
    }
}
