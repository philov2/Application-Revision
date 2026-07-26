import { NextResponse } from "next/server";
import { supabaseAdmin, supabaseAdminConfigured, getCompteFromToken } from "@/lib/supabaseAdmin";

// Genere une synthese IA a partir d'un document de type "cours" deja importe.
// - Telecharge le fichier original depuis le Storage
// - Envoie son contenu a Claude (API Anthropic) avec une consigne de synthese
// - Enregistre le resultat comme un nouveau document de type "synthese"
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
return NextResponse.json({ error: "Seuls les documents de type Cours peuvent etre synthetises." }, { status: 400 });
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
} else {
return NextResponse.json({ error: `Format de fichier non pris en charge pour la synthese IA : ${mime || "inconnu"}` }, { status: 400 });
}

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
system: "Tu es un assistant pedagogique qui aide des eleves de college et lycee a reviser. Redige une synthese claire, structuree (titres, listes a puces) et fidele au contenu du cours fourni, en francais.",
messages: [
{
role: "user",
content: [contenu, { type: "text", text: "Redige une synthese de ce cours." }],
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
const texteSynthese = (donneesClaude.content || [])
.filter((bloc) => bloc.type === "text")
.map((bloc) => bloc.text)
.join("\n\n")
.trim();

if (!texteSynthese) {
  return NextResponse.json({ error: "Claude n'a renvoye aucun texte de synthese." }, { status: 500 });
  }

const cheminSynthese = `${document.enfant_id}/${Date.now()}-synthese-${document.nom || "cours"}.md`;
const { error: uploadError } = await supabaseAdmin.storage
.from("documents")
.upload(cheminSynthese, Buffer.from(texteSynthese, "utf-8"), { contentType: "text/markdown" });
if (uploadError) {
  return NextResponse.json({ error: `Echec de l'enregistrement de la synthese : ${uploadError.message}` }, { status: 500 });
  }

const { data: nouveauDocument, error: insertError } = await supabaseAdmin
.from("documents")
.insert({
  nom: `Synthese - ${document.nom}`,
  type: "synthese",
  matiere_id: document.matiere_id,
  chapitre_id: document.chapitre_id,
  enfant_id: document.enfant_id,
  cree_par: compte.id,
  fichier_url: cheminSynthese,
  taille_octets: Buffer.byteLength(texteSynthese, "utf-8"),
  format: "text/markdown",
  genere_par_ia: true,
  })
.select()
.single();

if (insertError) {
  return NextResponse.json({ error: `Echec de l'enregistrement de la synthese : ${insertError.message}` }, { status: 500 });
  }

return NextResponse.json({ success: true, document: nouveauDocument });
}
