import { NextResponse } from "next/server";
import { supabaseAdmin, supabaseAdminConfigured, getCompteFromToken } from "@/lib/supabaseAdmin";
import { consigneLangue } from "@/lib/langueMatiere";
import { genererTexteIA } from "@/lib/genererTexteIA";

// Genere un jeu de flashcards (question au recto, reponse au verso) par IA a
// partir d'un simple prompt tape par l'utilisateur, sans document source a
// importer au prealable -- meme principe que
// app/api/generation/test-ia/route.js (signalement de Phil : depuis
// l'assistant "Nouveau devoir", generer des flashcards a partir d'une
// description produisait un document texte imitant la mise en page recto/
// verso au lieu de vraies flashcards interactives ; cette route manquait,
// seule la generation a partir d'un document deja importe existait, voir
// app/api/documents/[id]/flashcards-ia/route.js).
// Le resultat est enregistre directement dans la table "flashcards",
// rattachee au chapitre indique (obligatoire : c'est par ce chapitre que
// l'enfant retrouve le devoir, comme pour un test).
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
    return NextResponse.json({ error: "Merci de decrire les flashcards a generer." }, { status: 400 });
  }
  if (!chapitreId) {
    return NextResponse.json({ error: "Un chapitre est requis pour generer des flashcards (elles sont retrouvees par l'enfant via le chapitre)." }, { status: 400 });
  }

  const { data: chapitre } = await supabaseAdmin.from("chapitres").select("matiere_id").eq("id", chapitreId).single();
  const { data: matiere } = chapitre?.matiere_id
    ? await supabaseAdmin.from("matieres").select("nom").eq("id", chapitre.matiere_id).single()
    : { data: null };
  const consigneLangueMatiere = consigneLangue(matiere?.nom);

  const consigneFormat =
    'Reponds UNIQUEMENT avec un objet JSON valide, sans texte avant ni apres, sans balises markdown, exactement sous cette forme : ' +
    '{"titre": "...", "cartes": [{"question": "...", "reponse": "..."}]}. ' +
    `Genere entre 8 et 15 cartes, une question courte au recto et une reponse courte et precise au verso de chacune. ${consigneLangueMatiere}`;

  let texteJSON;
  try {
    const resultat = await genererTexteIA({
      systemPrompt: `Tu es un assistant pedagogique qui cree des flashcards de revision (question/reponse) pour des eleves de college et lycee, a partir de la demande de l'utilisateur (sujet, niveau, points a couvrir, etc.). ${consigneFormat}`,
      promptTexte: prompt,
      maxTokens: 4096,
    });
    texteJSON = resultat.texte;
  } catch (err) {
    return NextResponse.json({ error: `Echec de la generation par IA : ${err.message}` }, { status: 500 });
  }

  texteJSON = texteJSON.replace(/^```(json)?/i, "").replace(/```$/, "").trim();

  let structure;
  try {
    structure = JSON.parse(texteJSON);
  } catch {
    return NextResponse.json({ error: "L'IA n'a pas renvoye des flashcards au format attendu. Reessayez." }, { status: 500 });
  }

  if (!structure || !Array.isArray(structure.cartes) || structure.cartes.length === 0) {
    return NextResponse.json({ error: "Les flashcards generees par l'IA sont incompletes. Reessayez." }, { status: 500 });
  }

  const cartesValides = structure.cartes.every(
    (c) => c && typeof c.question === "string" && c.question.trim() && typeof c.reponse === "string" && c.reponse.trim()
  );
  if (!cartesValides) {
    return NextResponse.json({ error: "Les flashcards generees par l'IA sont mal formees. Reessayez." }, { status: 500 });
  }

  const titrePrompt = prompt.slice(0, 40).replace(/\s+/g, " ").trim();

  const { data: nouvellesFlashcards, error: insertError } = await supabaseAdmin
    .from("flashcards")
    .insert({
      chapitre_id: chapitreId,
      titre: structure.titre || `Flashcards - ${titrePrompt}`,
      cartes: structure.cartes,
    })
    .select()
    .single();

  if (insertError) {
    return NextResponse.json({ error: `Echec de l'enregistrement des flashcards : ${insertError.message}` }, { status: 500 });
  }

  return NextResponse.json({ success: true, flashcards: nouvellesFlashcards });
}
