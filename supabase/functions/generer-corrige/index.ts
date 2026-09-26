// Supabase Edge Function : genere le corrige d'un exercice/test importe,
// SANS la limite de 60s d'une fonction Vercel (plan Hobby). Declenchee par
// app/api/documents/[id]/corrige/route.js (voir ce fichier pour le contexte
// complet : signalement de Phil, un exercice avec beaucoup de questions
// demande parfois pres d'une minute de traitement par l'IA).
//
// Deploiement (voir les instructions donnees a Phil dans la conversation) :
// via le Dashboard Supabase (Edge Functions > Create a new function, coller
// ce code) ou via la CLI (`supabase functions deploy generer-corrige`).
//
// Secrets a definir cote Supabase (Edge Functions > Secrets, ou
// `supabase secrets set`) : ANTHROPIC_API_KEY, GEMINI_API_KEY,
// FONCTION_SECRET (chaine partagee avec EDGE_FUNCTION_SECRET cote Vercel).
// SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY sont fournis automatiquement par
// Supabase, pas besoin de les definir.

import { createClient } from "npm:@supabase/supabase-js@2";
import { encodeBase64 } from "jsr:@std/encoding/base64";
import mammoth from "npm:mammoth@1.6.0";

const MODELE_CLAUDE = "claude-sonnet-5";
const MODELE_GEMINI = "gemini-3.5-flash";
const MIME_DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

// --- Consigne de langue (copie de lib/langueMatiere.js) ---------------------
const LANGUES_ETRANGERES = [
  { motsCles: ["allemand"], langue: "allemand (Deutsch)" },
  { motsCles: ["anglais"], langue: "anglais (English)" },
  { motsCles: ["espagnol"], langue: "espagnol (Español)" },
  { motsCles: ["italien"], langue: "italien (Italiano)" },
];
const CONSIGNE_NOTATION = "N'utilise jamais de notation LaTeX (pas de signes dollar autour des formules, pas de commandes commencant par un backslash comme frac ou sqrt) : ce document est affiche sans moteur de rendu mathematique. Pour une fraction, ecris-la sous la forme a/b (exemple : 3/4). Pour une puissance, ecris x2 ou x^2. Pour une racine carree, ecris-la en toutes lettres (racine carree de x). Pour une multiplication, utilise x ou le mot fois.";
function normaliser(texte) {
  return (texte || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}
function detecterLangueEtrangere(nomMatiere) {
  const normalise = normaliser(nomMatiere);
  const trouvee = LANGUES_ETRANGERES.find((l) => l.motsCles.some((mot) => normalise.includes(mot)));
  return trouvee?.langue || null;
}
function consigneLangue(nomMatiere) {
  const langue = detecterLangueEtrangere(nomMatiere);
  if (!langue) return `Rédige ta réponse en français. ${CONSIGNE_NOTATION}`;
  return `Cette matière porte sur l'apprentissage de la langue étrangère suivante : ${langue}. Rédige les consignes, instructions et explications en français (l'enfant doit comprendre facilement ce qu'il doit faire). En revanche, tout le contenu linguistique proprement dit — mots de vocabulaire, phrases, textes à lire/traduire/compléter, dialogues, réponses attendues dans la langue — doit être en ${langue}, jamais en français ni dans une autre langue étrangère. Ne mélange jamais deux langues étrangères différentes : si la matière est ${langue}, tout le vocabulaire et les phrases doivent être exclusivement en ${langue} (pas un mot d'anglais dans un exercice d'allemand, pas un mot d'allemand dans un exercice d'anglais, etc.). ${CONSIGNE_NOTATION}`;
}

// --- Nettoyage de nom de fichier (copie de lib/sanitizeNomFichier.js) ------
function sanitizeNomFichier(nom) {
  if (!nom) return "fichier";
  const sansAccents = nom.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  return sansAccents.replace(/[^a-zA-Z0-9._-]/g, "_");
}

// --- Appel fetch avec delai (evite un appel bloque indefiniment) -----------
async function fetchAvecDelai(url, options, delaiMs) {
  const controleur = new AbortController();
  const minuteur = setTimeout(() => controleur.abort(), delaiMs);
  try {
    return await fetch(url, { ...options, signal: controleur.signal });
  } catch (err) {
    if (err.name === "AbortError") throw new Error(`delai depasse apres ${Math.round(delaiMs / 1000)}s`);
    throw err;
  } finally {
    clearTimeout(minuteur);
  }
}

// --- Claude puis Gemini en secours (meme logique que lib/genererTexteIA.js, sans le plafond de 60s) ---
function construireContenuClaude(pieceJointe) {
  if (!pieceJointe) return [];
  if (pieceJointe.base64) {
    if (pieceJointe.mimeType === "application/pdf") {
      return [{ type: "document", source: { type: "base64", media_type: "application/pdf", data: pieceJointe.base64 } }];
    }
    return [{ type: "image", source: { type: "base64", media_type: pieceJointe.mimeType, data: pieceJointe.base64 } }];
  }
  if (pieceJointe.texte) return [{ type: "text", text: pieceJointe.texte }];
  return [];
}

async function appellerClaude({ systemPrompt, promptTexte, pieceJointe, maxTokens }) {
  const cle = Deno.env.get("ANTHROPIC_API_KEY");
  if (!cle) throw new Error("ANTHROPIC_API_KEY non configuree");
  const contenu = [...construireContenuClaude(pieceJointe), { type: "text", text: promptTexte }];
  const reponse = await fetchAvecDelai("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": cle, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({ model: MODELE_CLAUDE, max_tokens: maxTokens || 4096, system: systemPrompt, messages: [{ role: "user", content: contenu }] }),
  }, 100000);
  if (!reponse.ok) throw new Error(`erreur ${reponse.status} : ${await reponse.text()}`);
  const donnees = await reponse.json();
  const texte = (donnees.content || []).filter((b) => b.type === "text").map((b) => b.text).join("\n\n").trim();
  if (!texte) {
    const blocs = (donnees.content || []).map((b) => b.type).join(",") || "aucun";
    throw new Error(`aucun texte renvoye (stop_reason: ${donnees.stop_reason}, blocs: ${blocs})`);
  }
  return texte;
}

function construireParticulesGemini(pieceJointe) {
  if (!pieceJointe) return [];
  if (pieceJointe.base64) return [{ inline_data: { mime_type: pieceJointe.mimeType, data: pieceJointe.base64 } }];
  if (pieceJointe.texte) return [{ text: pieceJointe.texte }];
  return [];
}

async function appellerGemini({ systemPrompt, promptTexte, pieceJointe, maxTokens }) {
  const cle = Deno.env.get("GEMINI_API_KEY");
  if (!cle) throw new Error("GEMINI_API_KEY non configuree");
  const parts = [...construireParticulesGemini(pieceJointe), { text: promptTexte }];
  const reponse = await fetchAvecDelai(
    `https://generativelanguage.googleapis.com/v1beta/models/${MODELE_GEMINI}:generateContent?key=${cle}`,
    { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ system_instruction: { parts: [{ text: systemPrompt }] }, contents: [{ role: "user", parts }], generationConfig: { maxOutputTokens: maxTokens || 4096, thinkingConfig: { thinkingBudget: 0 } } }) },
    60000
  );
  if (!reponse.ok) throw new Error(`erreur ${reponse.status} : ${await reponse.text()}`);
  const donnees = await reponse.json();
  const texte = (donnees.candidates?.[0]?.content?.parts || []).map((p) => p.text || "").join("\n\n").trim();
  if (!texte) {
    const candidat = donnees.candidates?.[0];
    throw new Error(`aucun texte renvoye (finishReason: ${candidat?.finishReason}, safety: ${JSON.stringify(candidat?.safetyRatings || [])})`);
  }
  return texte;
}

async function genererTexteIA({ systemPrompt, promptTexte, pieceJointe, maxTokens }) {
  const erreurs = [];
  try {
    const texte = await appellerClaude({ systemPrompt, promptTexte, pieceJointe, maxTokens });
    return { texte, source: "claude" };
  } catch (err) {
    erreurs.push(`Claude : ${err.message}`);
  }
  try {
    const texte = await appellerGemini({ systemPrompt, promptTexte, pieceJointe, maxTokens });
    return { texte, source: "gemini" };
  } catch (err) {
    erreurs.push(`Gemini : ${err.message}`);
  }
  throw new Error(erreurs.join(" | "));
}

// --- Traitement principal ---------------------------------------------------
async function traiter(supabase, documentId, compteId) {
  try {
    const { data: document, error: documentError } = await supabase.from("documents").select("*").eq("id", documentId).single();
    if (documentError || !document) throw new Error("Document introuvable.");

    const { data: fichier, error: telechargementError } = await supabase.storage.from("documents").download(document.fichier_url);
    if (telechargementError || !fichier) throw new Error(`Impossible de telecharger le document original : ${telechargementError?.message || "erreur inconnue"}`);

    const arrayBuffer = await fichier.arrayBuffer();
    const mime = document.format || "";

    let pieceJointe;
    if (mime === "application/pdf" || mime.startsWith("image/")) {
      pieceJointe = { mimeType: mime, base64: encodeBase64(new Uint8Array(arrayBuffer)) };
    } else if (mime.startsWith("text/")) {
      pieceJointe = { texte: new TextDecoder("utf-8").decode(arrayBuffer) };
    } else if (mime === MIME_DOCX) {
      let texteExtrait;
      try {
        const resultatExtraction = await mammoth.extractRawText({ buffer: new Uint8Array(arrayBuffer) });
        texteExtrait = resultatExtraction.value;
      } catch (err) {
        throw new Error(`Impossible de lire ce fichier Word : ${err.message}`);
      }
      if (!texteExtrait || !texteExtrait.trim()) throw new Error("Ce fichier Word ne contient pas de texte exploitable.");
      pieceJointe = { texte: texteExtrait };
    } else if (mime === "application/msword") {
      throw new Error("Les anciens fichiers Word (.doc) ne sont pas pris en charge. Enregistrez le document au format .docx ou PDF, puis reessayez.");
    } else {
      throw new Error(`Format de fichier non pris en charge pour la generation d'un corrige : ${mime || "inconnu"}`);
    }

    const { data: matiere } = await supabase.from("matieres").select("nom").eq("id", document.matiere_id).single();
    const consigneLangueMatiere = consigneLangue(matiere?.nom);
    const consigneSysteme = `Tu es un assistant pedagogique qui aide des eleves de college et lycee. Voici un exercice ou un test (fourni en piece jointe, eventuellement une photo ou un scan). Redige un corrige concis : pour chaque question ou exercice, donne uniquement la reponse finale et le calcul ou raisonnement essentiel (1 a 2 lignes maximum par question, sans reformuler l'enonce), en reprenant si possible la meme numerotation que l'enonce. Va droit au but pour rester bref. ${consigneLangueMatiere}`;

    const resultat = await genererTexteIA({ systemPrompt: consigneSysteme, promptTexte: "Redige le corrige complet de cet exercice.", pieceJointe, maxTokens: 4096 });

    const cheminCorrige = `${document.enfant_id}/${Date.now()}-corrige-${sanitizeNomFichier(document.nom) || "exercice"}.md`;
    const { error: uploadError } = await supabase.storage.from("documents").upload(cheminCorrige, new TextEncoder().encode(resultat.texte), { contentType: "text/markdown; charset=utf-8" });
    if (uploadError) throw new Error(`Echec de l'enregistrement du corrige : ${uploadError.message}`);

    const { error: insertError } = await supabase.from("documents").insert({
      nom: `Corrigé - ${document.nom}`,
      type: "corrige",
      matiere_id: document.matiere_id,
      chapitre_id: document.chapitre_id,
      enfant_id: document.enfant_id,
      cree_par: compteId || document.cree_par,
      fichier_url: cheminCorrige,
      taille_octets: new TextEncoder().encode(resultat.texte).length,
      format: "text/markdown",
      genere_par_ia: true,
      corrige_de_id: document.id,
    });
    if (insertError) throw new Error(`Echec de l'enregistrement du corrige : ${insertError.message}`);

    await supabase.from("documents").update({ corrige_statut: null, corrige_erreur: null }).eq("id", documentId);
  } catch (err) {
    await supabase.from("documents").update({ corrige_statut: "erreur", corrige_erreur: err.message }).eq("id", documentId);
  }
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response(JSON.stringify({ error: "Methode non autorisee." }), { status: 405 });

  const secretAttendu = Deno.env.get("FONCTION_SECRET");
  const secretRecu = req.headers.get("x-fonction-secret");
  if (!secretAttendu || secretRecu !== secretAttendu) {
    return new Response(JSON.stringify({ error: "Non autorise." }), { status: 403 });
  }

  let documentId, compteId;
  try {
    const corps = await req.json();
    documentId = corps.documentId;
    compteId = corps.compteId;
  } catch {
    return new Response(JSON.stringify({ error: "Corps JSON invalide." }), { status: 400 });
  }
  if (!documentId) return new Response(JSON.stringify({ error: "documentId manquant." }), { status: 400 });

  const supabase = createClient(Deno.env.get("SUPABASE_URL"), Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"));

  const tache = traiter(supabase, documentId, compteId);
  // @ts-ignore EdgeRuntime est fourni par le runtime Supabase, pas par Deno standard
  if (typeof EdgeRuntime !== "undefined") {
    // @ts-ignore
    EdgeRuntime.waitUntil(tache);
  } else {
    await tache;
  }

  return new Response(JSON.stringify({ success: true }), { status: 200, headers: { "content-type": "application/json" } });
});
