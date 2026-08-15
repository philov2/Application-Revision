import { NextResponse } from "next/server";
import mammoth from "mammoth";
import { supabaseAdmin, supabaseAdminConfigured, getCompteFromToken } from "@/lib/supabaseAdmin";
import { consigneLangue } from "@/lib/langueMatiere";
import { genererTexteIA } from "@/lib/genererTexteIA";

const MIME_DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

// Genere un test a choix multiples (QCM) par IA a partir d'un document de type
// "cours" deja importe, et l'enregistre directement dans la table "tests"
// (questions + bonnes reponses generees automatiquement par genererTexteIA -
// Claude puis Gemini en secours -, sans relecture humaine avant enregistrement).
export async function POST(request, { params }) {
    if (!supabaseAdminConfigured) {
          return NextResponse.json({ error: "Supabase n'est pas encore configure cote serveur (SUPABASE_SERVICE_ROLE_KEY manquante)." }, { status: 500 });
    }

  const compte = await getCompteFromToken(request);
    if (!compte || compte.statut !== "actif") {
          return NextResponse.json({ error: "Non autorise." }, { status: 403 });
    }

  const { id } = await params;

  const corps = await request.json().catch(() => ({}));
    const consigne = (corps?.consigne || "").trim();

  const { data: document, error: documentError } = await supabaseAdmin
      .from("documents")
      .select("*")
      .eq("id", id)
      .single();

  if (documentError || !document) {
        return NextResponse.json({ error: "Document introuvable." }, { status: 404 });
  }
    if (document.type !== "cours") {
          return NextResponse.json({ error: "Seuls les documents de type Cours peuvent servir a generer un test." }, { status: 400 });
    }
    if (!document.chapitre_id) {
          return NextResponse.json({ error: "Ce cours doit d'abord etre rattache a un chapitre pour pouvoir generer un test (le test est retrouve par l'enfant via le chapitre)." }, { status: 400 });
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
          // Fichier Word moderne (.docx) : les API IA ne prennent pas en charge les
      // fichiers Word directement (contrairement aux PDF), donc on extrait le
      // texte brut avec mammoth et on l'envoie comme un simple bloc de texte.
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
          return NextResponse.json({ error: `Format de fichier non pris en charge pour la generation de test : ${mime || "inconnu"}` }, { status: 400 });
    }

  const { data: matiere } = await supabaseAdmin.from("matieres").select("nom").eq("id", document.matiere_id).single();
    const consigneLangueMatiere = consigneLangue(matiere?.nom);

  const consigneFormat =
        'Reponds UNIQUEMENT avec un objet JSON valide, sans texte avant ni apres, sans balises markdown, exactement sous cette forme : ' +
        '{"titre": "...", "questions": [{"question": "...", "choix": ["...", "...", "...", "..."], "bonne_reponse": 0}]}. ' +
        "Le champ bonne_reponse est l'indice (0, 1, 2 ou 3) de la bonne reponse dans le tableau choix. " +
        `Genere entre 5 et 8 questions, fideles au contenu du cours, avec 4 choix par question. ${consigneLangueMatiere}`;

  const consigneUtilisateur = consigne ? ` Consigne particuliere donnee par l'utilisateur, a respecter en priorite : ${consigne}` : "";

  let texteJSON;
    try {
          const resultat = await genererTexteIA({
                  systemPrompt: `Tu es un assistant pedagogique qui cree des tests a choix multiples (QCM) pour des eleves de college et lycee, a partir d'un cours fourni. ${consigneFormat}${consigneUtilisateur}`,
                  promptTexte: "Cree un test a choix multiples a partir de ce cours.",
                  pieceJointe,
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

  const { data: nouveauTest, error: insertError } = await supabaseAdmin
      .from("tests")
      .insert({
              chapitre_id: document.chapitre_id,
              titre: structure.titre || `Test - ${document.nom}`,
              questions: structure.questions,
      })
      .select()
      .single();

  if (insertError) {
        return NextResponse.json({ error: `Echec de l'enregistrement du test : ${insertError.message}` }, { status: 500 });
  }

  return NextResponse.json({ success: true, test: nouveauTest });
}
