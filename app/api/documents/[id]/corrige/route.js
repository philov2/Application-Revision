import { NextResponse } from "next/server";
import mammoth from "mammoth";
import { supabaseAdmin, supabaseAdminConfigured, getCompteFromToken } from "@/lib/supabaseAdmin";
import { consigneLangue } from "@/lib/langueMatiere";
import { genererTexteIA } from "@/lib/genererTexteIA";

const MIME_DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

/* Genere le corrige d'un exercice ou d'un test deja importe (signalement de
Phil : un exercice photographie depuis un manuel scolaire n'a pas ete cree
par l'IA, mais le Parent doit quand meme pouvoir obtenir un corrige genere
par IA a partir du fichier importe).
- Telecharge le fichier original depuis le Storage
- Envoie son contenu (texte ou image/PDF en vision) a genererTexteIA (Claude
  puis Gemini en secours) avec une consigne de redaction de corrige
- Enregistre le resultat comme un nouveau document de type "corrige", relie
  au document source via corrige_de_id (voir schema.sql) -> DevoirCard.js
  affiche deja automatiquement "Voir le corrige" des que ce champ est rempli,
  aucune modification necessaire la-bas. */
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
  if (document.type !== "exercice" && document.type !== "test") {
    return NextResponse.json({ error: "Seuls les documents de type Exercice ou Test peuvent servir a generer un corrige." }, { status: 400 });
  }

  const { data: corrigeExistant } = await supabaseAdmin
    .from("documents")
    .select("id")
    .eq("corrige_de_id", id)
    .maybeSingle();
  if (corrigeExistant) {
    return NextResponse.json({ error: "Un corrige existe deja pour ce document." }, { status: 400 });
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
    return NextResponse.json({ error: `Format de fichier non pris en charge pour la generation d'un corrige : ${mime || "inconnu"}` }, { status: 400 });
  }

  const { data: matiere } = await supabaseAdmin.from("matieres").select("nom").eq("id", document.matiere_id).single();
  const consigneLangueMatiere = consigneLangue(matiere?.nom);

  const consigneSysteme = `Tu es un assistant pedagogique qui aide des eleves de college et lycee. Voici un exercice ou un test (fourni en piece jointe, eventuellement une photo ou un scan). Redige le corrige complet et detaille : pour chaque question ou exercice, donne la reponse attendue avec une explication claire et concise, en reprenant si possible la meme numerotation que l'enonce. ${consigneLangueMatiere}`;

  let texteCorrige;
  try {
    const resultat = await genererTexteIA({
      systemPrompt: consigneSysteme,
      promptTexte: "Redige le corrige complet de cet exercice.",
      pieceJointe,
      maxTokens: 4096,
    });
    texteCorrige = resultat.texte;
  } catch (err) {
    return NextResponse.json({ error: `Echec de la generation par IA : ${err.message}` }, { status: 500 });
  }

  const cheminCorrige = `${document.enfant_id}/${Date.now()}-corrige-${document.nom || "exercice"}.md`;
  const { error: uploadError } = await supabaseAdmin.storage
    .from("documents")
    .upload(cheminCorrige, Buffer.from(texteCorrige, "utf-8"), { contentType: "text/markdown; charset=utf-8" });
  if (uploadError) {
    return NextResponse.json({ error: `Echec de l'enregistrement du corrige : ${uploadError.message}` }, { status: 500 });
  }

  const nomDocument = `Corrigé - ${document.nom}`;
  const { data: nouveauCorrige, error: insertError } = await supabaseAdmin
    .from("documents")
    .insert({
      nom: nomDocument,
      type: "corrige",
      matiere_id: document.matiere_id,
      chapitre_id: document.chapitre_id,
      enfant_id: document.enfant_id,
      cree_par: compte.id,
      fichier_url: cheminCorrige,
      taille_octets: Buffer.byteLength(texteCorrige, "utf-8"),
      format: "text/markdown",
      genere_par_ia: true,
      corrige_de_id: document.id,
    })
    .select()
    .single();

  if (insertError) {
    return NextResponse.json({ error: `Echec de l'enregistrement du corrige : ${insertError.message}` }, { status: 500 });
  }

  return NextResponse.json({ success: true, document: nouveauCorrige });
}
