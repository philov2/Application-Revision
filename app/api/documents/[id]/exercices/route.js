import { NextResponse } from "next/server";
import mammoth from "mammoth";
import { supabaseAdmin, supabaseAdminConfigured, getCompteFromToken } from "@/lib/supabaseAdmin";
import { genererEtEnregistrerCorrige } from "@/lib/corrigeIA";
import { consigneLangue } from "@/lib/langueMatiere";
import { genererTexteIA } from "@/lib/genererTexteIA";

const MIME_DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

// Genere des exercices d'entrainement par IA a partir d'un document de type "cours" deja importe.
// - Telecharge le fichier original depuis le Storage
// - Envoie son contenu a genererTexteIA (Claude puis Gemini en secours) avec une consigne de generation d'exercices
//   (eventuellement completee par une consigne personnalisee fournie par l'utilisateur)
// - Enregistre le resultat comme un nouveau document de type "exercice"
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
          return NextResponse.json({ error: "Seuls les documents de type Cours peuvent servir a generer des exercices." }, { status: 400 });
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
          return NextResponse.json({ error: `Format de fichier non pris en charge pour la generation d'exercices : ${mime || "inconnu"}` }, { status: 400 });
    }

  const { data: matiere } = await supabaseAdmin.from("matieres").select("nom").eq("id", document.matiere_id).single();
    const consigneLangueMatiere = consigneLangue(matiere?.nom);

  const consigneSysteme = consigne
      ? `Tu es un assistant pedagogique qui aide des eleves de college et lycee a s'entrainer. A partir du cours fourni, redige une serie d'exercices d'entrainement varies et progressifs (sans corrige), clairement numerotes. Adapte la difficulte au contenu du cours. ${consigneLangueMatiere} Consigne particuliere donnee par l'utilisateur, a respecter en priorite : ${consigne}`
        : `Tu es un assistant pedagogique qui aide des eleves de college et lycee a s'entrainer. A partir du cours fourni, redige une serie d'exercices d'entrainement varies et progressifs (sans corrige), clairement numerotes. Adapte la difficulte au contenu du cours. ${consigneLangueMatiere}`;

  let texteExercices;
    try {
          const resultat = await genererTexteIA({
                  systemPrompt: consigneSysteme,
                  promptTexte: "Redige des exercices d'entrainement a partir de ce cours.",
                  pieceJointe,
                  maxTokens: 4096,
          });
          texteExercices = resultat.texte;
    } catch (err) {
          return NextResponse.json({ error: `Echec de la generation par IA : ${err.message}` }, { status: 500 });
    }

  const cheminExercices = `${document.enfant_id}/${Date.now()}-exercices-${document.nom || "cours"}.md`;
    const { error: uploadError } = await supabaseAdmin.storage
      .from("documents")
      .upload(cheminExercices, Buffer.from(texteExercices, "utf-8"), { contentType: "text/markdown; charset=utf-8" });
    if (uploadError) {
          return NextResponse.json({ error: `Echec de l'enregistrement des exercices : ${uploadError.message}` }, { status: 500 });
    }

  const nomDocument = `Exercices - ${document.nom}`;
    const { data: nouveauDocument, error: insertError } = await supabaseAdmin
      .from("documents")
      .insert({
              nom: nomDocument,
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

  // Corrige genere automatiquement a cote de l'exercice (voir lib/corrigeIA.js) -
  // non bloquant : l'exercice reste utilisable meme si cette etape echoue.
  const corrige = await genererEtEnregistrerCorrige({
        texteExercices,
        nomDocumentExercice: nomDocument,
        documentExerciceId: nouveauDocument.id,
        matiereId: document.matiere_id,
        chapitreId: document.chapitre_id,
        enfantId: document.enfant_id,
        creePar: compte.id,
        nomMatiere: matiere?.nom,
  });

  return NextResponse.json({ success: true, document: nouveauDocument, corrige });
}
