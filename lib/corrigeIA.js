import { supabaseAdmin } from "@/lib/supabaseAdmin";

// Génère automatiquement le corrigé d'une série d'exercices produite par IA,
// et l'enregistre comme un nouveau document de type "corrige" relié à
// l'exercice via corrige_de_id (voir schema.sql). Utilisé par les deux
// routes de génération d'exercices IA (par prompt et à partir d'un cours) —
// signalement : "il serait bien d'avoir un fichier qui donne les réponses
// quand l'enfant a fini l'exercice / le fichier avec les solutions doit
// être disponible directement à côté du fichier de l'exercice pour le
// parent" (le degré de visibilité — enfant après envoi, parent tout de
// suite — est géré côté affichage dans DevoirCard.js, pas ici).
//
// Non bloquant : si la génération ou l'enregistrement du corrigé échoue, on
// logge l'erreur et on renvoie null plutôt que de faire échouer toute la
// requête — l'exercice, lui, a déjà été créé avec succès.
export async function genererEtEnregistrerCorrige({ texteExercices, nomDocumentExercice, documentExerciceId, matiereId, chapitreId, enfantId, creePar }) {
  try {
    const reponseClaude = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-5",
        max_tokens: 4096,
        system:
          "Tu es un assistant pedagogique. Voici une serie d'exercices d'entrainement destines a un eleve de college ou lycee. Redige le corrige complet et detaille : pour chaque exercice, donne la reponse attendue avec une courte explication, en reprenant la meme numerotation que les exercices, en francais.",
        messages: [
          {
            role: "user",
            content: [{ type: "text", text: texteExercices }],
          },
        ],
      }),
    });

    if (!reponseClaude.ok) {
      const detail = await reponseClaude.text();
      console.error(`Echec de la generation du corrige (${reponseClaude.status}) : ${detail}`);
      return null;
    }

    const donneesClaude = await reponseClaude.json();
    const texteCorrige = (donneesClaude.content || [])
      .filter((bloc) => bloc.type === "text")
      .map((bloc) => bloc.text)
      .join("\n\n")
      .trim();

    if (!texteCorrige) {
      console.error("Claude n'a renvoye aucun corrige.");
      return null;
    }

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
        nom: `Corrigé - ${nomDocumentExercice}`,
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
