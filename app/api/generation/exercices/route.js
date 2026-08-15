import { NextResponse } from "next/server";
import { supabaseAdmin, supabaseAdminConfigured, getCompteFromToken } from "@/lib/supabaseAdmin";
import { genererEtEnregistrerCorrige } from "@/lib/corrigeIA";
import { consigneLangue } from "@/lib/langueMatiere";
import { genererTexteIA } from "@/lib/genererTexteIA";

// Genere des exercices d'entrainement par IA a partir d'un simple prompt
// tape par l'utilisateur, sans document source a importer au prealable.
// Le resultat est enregistre comme un nouveau document de type "exercice".
//
// La generation passe par lib/genererTexteIA.js (Claude puis Gemini en
// secours).
export async function POST(request) {
    if (!supabaseAdminConfigured) {
          return NextResponse.json({ error: "Supabase n'est pas encore configure cote serveur (SUPABASE_SERVICE_ROLE_KEY manquante)." }, { status: 500 });
    }

  const compte = await getCompteFromToken(request);
    if (!compte || compte.statut !== "actif") {
          return NextResponse.json({ error: "Non autorise." }, { status: 403 });
    }

  const body = await request.json().catch(() => ({}));
    const prompt = (body.prompt || "").trim();
    const { matiereId, chapitreId, enfantId } = body;

  if (!prompt) {
        return NextResponse.json({ error: "Merci de decrire les exercices souhaites." }, { status: 400 });
  }
    if (!matiereId || !enfantId) {
          return NextResponse.json({ error: "Matiere et enfant requis pour generer des exercices." }, { status: 400 });
    }

  const { data: matiere } = await supabaseAdmin.from("matieres").select("nom").eq("id", matiereId).single();
    const consigneLangueMatiere = consigneLangue(matiere?.nom);

  let texteExercices;
    try {
          const resultat = await genererTexteIA({
                  systemPrompt: `Tu es un assistant pedagogique qui aide des eleves de college et lycee a s'entrainer. A partir de la demande de l'utilisateur (sujet, niveau, nombre d'exercices souhaite, etc.), redige une serie d'exercices d'entrainement varies et progressifs (sans corrige), clairement numerotes. ${consigneLangueMatiere}`,
                  promptTexte: prompt,
                  maxTokens: 4096,
          });
          texteExercices = resultat.texte;
    } catch (err) {
          return NextResponse.json({ error: `Echec de la generation par IA : ${err.message}` }, { status: 500 });
    }

  const titrePrompt = prompt.slice(0, 50).replace(/\s+/g, " ").trim();
    const nomDocument = `Exercices IA - ${titrePrompt}${prompt.length > 50 ? "..." : ""}`;
    const cheminExercices = `${enfantId}/${Date.now()}-exercices-ia.md`;
    const { error: uploadError } = await supabaseAdmin.storage
      .from("documents")
      .upload(cheminExercices, Buffer.from(texteExercices, "utf-8"), { contentType: "text/markdown; charset=utf-8" });
    if (uploadError) {
          return NextResponse.json({ error: `Echec de l'enregistrement des exercices : ${uploadError.message}` }, { status: 500 });
    }

  const { data: nouveauDocument, error: insertError } = await supabaseAdmin
      .from("documents")
      .insert({
              nom: nomDocument,
              type: "exercice",
              matiere_id: matiereId,
              chapitre_id: chapitreId || null,
              enfant_id: enfantId,
              cree_par: compte.id,
              fichier_url: cheminExercices,
              taille_octets: Buffer.byteLength(texteExercices, "utf-8"),
              format: "text/markdown",
              genere_par_ia: true,
      })
      .select()
      .single();

  if (insertError) {
        return NextResponse.json({ error: `Echec de l'enregistrement des exercices : ${insertError.message}` }, { status: 500 });
  }

  // Corrige genere automatiquement a cote de l'exercice (voir lib/corrigeIA.js) -
  // non bloquant : l'exercice reste utilisable meme si cette etape echoue.
  const corrige = await genererEtEnregistrerCorrige({
        texteExercices,
        nomDocumentExercice: nomDocument,
        documentExerciceId: nouveauDocument.id,
        matiereId,
        chapitreId,
        enfantId,
        creePar: compte.id,
        nomMatiere: matiere?.nom,
  });

  return NextResponse.json({ success: true, document: nouveauDocument, corrige });
}
