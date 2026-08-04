import { NextResponse } from "next/server";
import mammoth from "mammoth";
import { supabaseAdmin, supabaseAdminConfigured, getCompteFromToken } from "@/lib/supabaseAdmin";

const MIME_DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

// Genere un test a choix multiples (QCM) par IA a partir d'un document de type
// "cours" deja importe, et l'enregistre directement dans la table "tests"
// (questions + bonnes reponses generees automatiquement par Claude, sans
// relecture humaine avant enregistrement).
export async function POST(request, { params }) {
  if (!supabaseAdminConfigured) {
    return NextResponse.json({ error: "Supabase n'est pas encore configure cote serveur (SUPABASE_SERVICE_ROLE_KEY manquante)." }, { status: 500 });
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "La cle API Anthropic (ANTHROPIC_API_KEY) n'est pas configuree sur le serveur." }, { status: 500 });
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

  let contenu;
  if (mime === "application/pdf") {
    contenu = { type: "document", source: { type: "base64", media_type: "application/pdf", data: base64 } };
  } else if (mime.startsWith("image/")) {
    contenu = { type: "image", source: { type: "base64", media_type: mime, data: base64 } };
  } else if (mime.startsWith("text/")) {
    contenu = { type: "text", text: Buffer.from(arrayBuffer).toString("utf-8") };
  } else if (mime === MIME_DOCX) {
    // Fichier Word moderne (.docx) : l'API Claude ne prend pas en charge les
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
    contenu = { type: "text", text: texteExtrait };
  } else if (mime === "application/msword") {
    return NextResponse.json({ error: "Les anciens fichiers Word (.doc) ne sont pas pris en charge. Enregistrez le document au format .docx ou PDF, puis reessayez." }, { status: 400 });
  } else {
    return NextResponse.json({ error: `Format de fichier non pris en charge pour la generation de test : ${mime || "inconnu"}` }, { status: 400 });
  }

  const consigneFormat =
    'Reponds UNIQUEMENT avec un objet JSON valide, sans texte avant ni apres, sans balises markdown, exactement sous cette forme : ' +
    '{"titre": "...", "questions": [{"question": "...", "choix": ["...", "...", "...", "..."], "bonne_reponse": 0}]}. ' +
    "Le champ bonne_reponse est l'indice (0, 1, 2 ou 3) de la bonne reponse dans le tableau choix. " +
    "Genere entre 5 et 8 questions, fideles au contenu du cours, en francais, avec 4 choix par question.";

  let reponseClaude;
  try {
    reponseClaude = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-5",
        max_tokens: 4096,
        system: `Tu es un assistant pedagogique qui cree des tests a choix multiples (QCM) pour des eleves de college et lycee, a partir d'un cours fourni. ${consigneFormat}`,
        messages: [
          {
            role: "user",
            content: [contenu, { type: "text", text: "Cree un test a choix multiples a partir de ce cours." }],
          },
        ],
      }),
    });
  } catch (err) {
    return NextResponse.json({ error: `Echec de l'appel a Claude : ${err.message}` }, { status: 500 });
  }

  if (!reponseClaude.ok) {
    const detail = await reponseClaude.text();
    return NextResponse.json({ error: `Echec de l'appel a Claude (${reponseClaude.status}) : ${detail}` }, { status: 500 });
  }

  const donneesClaude = await reponseClaude.json();
  let texteJSON = (donneesClaude.content || [])
    .filter((bloc) => bloc.type === "text")
    .map((bloc) => bloc.text)
    .join("\n")
    .trim();

  // Securite : au cas ou Claude entourerait la reponse de balises markdown malgre la consigne
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
