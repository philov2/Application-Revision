import { NextResponse } from "next/server";
import mammoth from "mammoth";
import { supabaseAdmin, supabaseAdminConfigured, getCompteFromToken } from "@/lib/supabaseAdmin";
import { consigneLangue } from "@/lib/langueMatiere";
import { genererTexteIA } from "@/lib/genererTexteIA";

const MIME_DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

// Jalon "flashcards" (signalement de Phil : rendre l'application plus
// attractive pour une adolescente, dans la meme veine que le streak, le
// minuteur focus et la progression par matiere) : genere un jeu de
// flashcards (question au recto, reponse au verso) par IA a partir d'un
// document de type "cours" deja importe. Meme structure que
// app/api/documents/[id]/exercices/route.js pour le telechargement et
// l'extraction du contenu source (PDF, image, texte, Word) ; le resultat est
// enregistre dans la table "flashcards" (pas un document, pour piloter l'UI
// carte a carte de components/RevisionFlashcards.js sans reparser un
// fichier), rattache au chapitre du document source. Un chapitre est donc
// obligatoire, comme pour le test QCM (voir le bouton correspondant, desactive
// tant que le document n'a pas de chapitre, dans components/MatiereDocuments.js).
export async function POST(request, { params }) {
  if (!supabaseAdminConfigured) {
    return NextResponse.json({ error: "Supabase n'est pas encore configure cote serveur (SUPABASE_SERVICE_ROLE_KEY manquante)." }, { status: 500 });
  }

  const compte = await getCompteFromToken(request);
  if (!compte || compte.statut !== "actif") {
    return NextResponse.json({ error: "Non autorise." }, { status: 403 });
  }

  const { id } = await params;

  const { data: document, error: documentError } = await supabaseAdmin
    .from("documents")
    .select("*")
    .eq("id", id)
    .single();

  if (documentError || !document) {
    return NextResponse.json({ error: "Document introuvable." }, { status: 404 });
  }
  if (document.type !== "cours") {
    return NextResponse.json({ error: "Seuls les documents de type Cours peuvent servir a generer des flashcards." }, { status: 400 });
  }
  if (!document.chapitre_id) {
    return NextResponse.json({ error: "Rattachez d'abord ce document a un chapitre pour generer des flashcards." }, { status: 400 });
  }

  const { data: fichier, error: telechargementError } = await supabaseAdmin.storage.from("documents").download(document.fichier_url);
  if (telechargementError || !fichier) {
    return NextResponse.json({ error: `Impossible de telecharger le document original : ${telechargementError?.message || "erreur inconnue"}` }, { status: 500 });
  }

  const arrayBuffer = await fichier.arrayBuffer();
  const base64 = Buffer.from(arrayBuffer).toString("base64");
  const mime = document.format || "";

  let pieceJointe;
  if (mime === "application/pdf" || mime.startsWith("image/")) {
    pieceJointe = { mimeType: mime, base64 };
  } else if (mime.startsWith("text/")) {
    pieceJointe = { texte: Buffer.from(arrayBuffer).toString("utf-8") };
  } else if (mime === MIME_DOCX) {
    let texteExtrait;
    try {
      const resultatExtraction = await mammoth.extractRawText({ buffer: Buffer.from(arrayBuffer) });
      texteExtrait = resultatExtraction.value;
    } catch (err) {
      return NextResponse.json({ error: `Impossible de lire ce fichier Word : ${err.message}` }, { status: 400 });
    }
    if (!texteExtrait || !texteExtrait.trim()) {
      return NextResponse.json({ error: "Ce fichier Word ne contient pas de texte exploitable." }, { status: 400 });
    }
    pieceJointe = { texte: texteExtrait };
  } else if (mime === "application/msword") {
    return NextResponse.json({ error: "Les anciens fichiers Word (.doc) ne sont pas pris en charge. Enregistrez le document au format .docx ou PDF, puis reessayez." }, { status: 400 });
  } else {
    return NextResponse.json({ error: `Format de fichier non pris en charge pour la generation de flashcards : ${mime || "inconnu"}` }, { status: 400 });
  }

  const { data: matiere } = await supabaseAdmin.from("matieres").select("nom").eq("id", document.matiere_id).single();
  const consigneLangueMatiere = consigneLangue(matiere?.nom);

  const consigneFormat =
    'Reponds UNIQUEMENT avec un objet JSON valide, sans texte avant ni apres, sans balises markdown, exactement sous cette forme : ' +
    '{"titre": "...", "cartes": [{"question": "...", "reponse": "..."}]}. ' +
    `Genere entre 8 et 15 cartes, une question courte au recto et une reponse courte et precise au verso de chacune. ${consigneLangueMatiere}`;

  let texteJSON;
  try {
    const resultat = await genererTexteIA({
      systemPrompt: `Tu es un assistant pedagogique qui cree des flashcards de revision (question/reponse) pour des eleves de college et lycee, a partir du cours fourni. ${consigneFormat}`,
      promptTexte: "Genere des flashcards de revision a partir de ce cours.",
      pieceJointe,
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

  const { data: nouvellesFlashcards, error: insertError } = await supabaseAdmin
    .from("flashcards")
    .insert({
      chapitre_id: document.chapitre_id,
      titre: structure.titre || `Flashcards - ${document.nom}`,
      cartes: structure.cartes,
    })
    .select()
    .single();

  if (insertError) {
    return NextResponse.json({ error: `Echec de l'enregistrement des flashcards : ${insertError.message}` }, { status: 500 });
  }

  return NextResponse.json({ success: true, flashcards: nouvellesFlashcards });
}
