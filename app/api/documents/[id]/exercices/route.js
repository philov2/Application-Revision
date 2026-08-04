import { NextResponse } from "next/server";
import mammoth from "mammoth";
import { supabaseAdmin, supabaseAdminConfigured, getCompteFromToken } from "@/lib/supabaseAdmin";

const MIME_DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

// Genere des exercices d'entrainement par IA a partir d'un document de type "cours" deja importe.
// - Telecharge le fichier original depuis le Storage
// - Envoie son contenu a Claude (API Anthropic) avec une consigne de generation d'exercices
//   (eventuellement completee par une consigne personnalisee fournie par l'utilisateur)
// - Enregistre le resultat comme un nouveau document de type "exercice"
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
    return NextResponse.json({ error: "Seuls les documents de type Cours peuvent servir a generer des exercices." }, { status: 400 });
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
    return NextResponse.json({ error: `Format de fichier non pris en charge pour la generation d'exercices : ${mime || "inconnu"}` }, { status: 400 });
  }

  const consigneSysteme = consigne
    ? `Tu es un assistant pedagogique qui aide des eleves de college et lycee a s'entrainer. A partir du cours fourni, redige une serie d'exercices d'entrainement varies et progressifs (sans corrige), clairement numerotes, en francais. Adapte la difficulte au contenu du cours. Consigne particuliere donnee par l'utilisateur, a respecter en priorite : ${consigne}`
    : "Tu es un assistant pedagogique qui aide des eleves de college et lycee a s'entrainer. A partir du cours fourni, redige une serie d'exercices d'entrainement varies et progressifs (sans corrige), clairement numerotes, en francais. Adapte la difficulte au contenu du cours.";

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
        system: consigneSysteme,
        messages: [
          {
            role: "user",
            content: [contenu, { type: "text", text: "Redige des exercices d'entrainement a partir de ce cours." }],
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
  const texteExercices = (donneesClaude.content || [])
    .filter((bloc) => bloc.type === "text")
    .map((bloc) => bloc.text)
    .join("\n\n")
    .trim();

  if (!texteExercices) {
    return NextResponse.json({ error: "Claude n'a renvoye aucun exercice." }, { status: 500 });
  }

  const cheminExercices = `${document.enfant_id}/${Date.now()}-exercices-${document.nom || "cours"}.md`;
  const { error: uploadError } = await supabaseAdmin.storage
    .from("documents")
    .upload(cheminExercices, Buffer.from(texteExercices, "utf-8"), { contentType: "text/markdown; charset=utf-8" });
  if (uploadError) {
    return NextResponse.json({ error: `Echec de l'enregistrement des exercices : ${uploadError.message}` }, { status: 500 });
  }

  const { data: nouveauDocument, error: insertError } = await supabaseAdmin
    .from("documents")
    .insert({
      nom: `Exercices - ${document.nom}`,
      type: "exercice",
      matiere_id: document.matiere_id,
      chapitre_id: document.chapitre_id,
      enfant_id: document.enfant_id,
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

  return NextResponse.json({ success: true, document: nouveauDocument });
}
