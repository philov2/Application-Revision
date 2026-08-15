mport { NextResponse } from "next/server";
import { supabaseAdmin, supabaseAdminConfigured, getCompteFromToken } from "@/lib/supabaseAdmin";
import { consigneLangue } from "@/lib/langueMatiere";
import { genererTexteIA } from "@/lib/genererTexteIA";

// Genere un test a choix multiples (QCM) par IA a partir d'un simple prompt
// tape par l'utilisateur, sans document source a importer au prealable.
// Le resultat est enregistre directement dans la table "tests", rattache au
// chapitre indique (obligatoire : c'est par ce chapitre que l'enfant retrouve
// le test).
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
    const { chapitreId } = body;

  if (!prompt) {
        return NextResponse.json({ error: "Merci de decrire le test a generer." }, { status: 400 });
  }
    if (!chapitreId) {
          return NextResponse.json({ error: "Un chapitre est requis pour generer un test (le test est retrouve par l'enfant via le chapitre)." }, { status: 400 });
    }

  const { data: chapitre } = await supabaseAdmin.from("chapitres").select("matiere_id").eq("id", chapitreId).single();
    const { data: matiere } = chapitre?.matiere_id
      ? await supabaseAdmin.from("matieres").select("nom").eq("id", chapitre.matiere_id).single()
          : { data: null };
    const consigneLangueMatiere = consigneLangue(matiere?.nom);

  const consigneFormat =
        'Reponds UNIQUEMENT avec un objet JSON valide, sans texte avant ni apres, sans balises markdown, exactement sous cette forme : ' +
        '{"titre": "...", "questions": [{"question": "...", "choix": ["...", "...", "...", "..."], "bonne_reponse": 0}]}. ' +
        "Le champ bonne_reponse est l'indice (0, 1, 2 ou 3) de la bonne reponse dans le tableau choix. " +
        `Genere entre 5 et 8 questions, avec 4 choix par question. ${consigneLangueMatiere}`;

  let texteJSON;
    try {
          const resultat = await genererTexteIA({
                  systemPrompt: `Tu es un assistant pedagogique qui cree des tests a choix multiples (QCM) pour des eleves de college et lycee, a partir de la demande de l'utilisateur (sujet, niveau, points a couvrir, etc.). ${consigneFormat}`,
                  promptTexte: prompt,
                  maxTokens: 4096,
          });
          texteJSON = resultat.texte;
    } catch (err) {
          return NextResponse.json({ error: `Echec de la generation par IA : ${err.message}` }, { status: 500 });
    }

  // Securite : au cas ou l'IA entourerait la reponse de balises markdown malgre la consigne
  texteJSON = texteJSON.replace(/^```(json)?/i, "").replace(/```$/, "").trim();

  let structure;
    try {
          structure = JSON.parse(texteJSON);
    } catch {
          return NextResponse.json({ error: "L'IA n'a pas renvoye un test au format attendu. Reessayez." }, { status: 500 });
    }

  if (!structure || !Array.isArray(structure.questions) || structure.questions.length === 0) {
        return NextResponse.json({ error: "Le test genere par l'IA est incomplet. Reessayez." }, { status: 500 });
  }

  const questionsValides = structure.questions.every(
        (q) => q && typeof q.question === "string" && Array.isArray(q.choix) && q.choix.length >= 2 && Number.isInteger(q.bonne_reponse)
      );
    if (!questionsValides) {
          return NextResponse.json({ error: "Le test genere par l'IA est mal forme. Reessayez." }, { status: 500 });
    }

  const titrePrompt = prompt.slice(0, 40).replace(/\s+/g, " ").trim();

  const { data: nouveauTest, error: insertError } = await supabaseAdmin
      .from("tests")
      .insert({
              chapitre_id: chapitreId,
              titre: structure.titre || `Test IA - ${titrePrompt}`,
              questions: structure.questions,
      })
      .select()
      .single();

  if (insertError) {
        return NextResponse.json({ error: `Echec de l'enregistrement du test : ${insertError.message}` }, { status: 500 });
  }

  return NextResponse.json({ success: true, test: nouveauTest });
}
