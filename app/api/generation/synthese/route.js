import { NextResponse } from "next/server";
import { supabaseAdmin, supabaseAdminConfigured, getCompteFromToken } from "@/lib/supabaseAdmin";
import { consigneLangue } from "@/lib/langueMatiere";
import { genererTexteIA } from "@/lib/genererTexteIA";

// Genere une synthese de cours par IA a partir d'un simple prompt tape par
// l'utilisateur (parent ou soutien), sans document source a importer au
// prealable. Le resultat est enregistre comme un nouveau document de type
// "synthese", genere_par_ia: true.
//
// La generation passe par lib/genererTexteIA.js, qui essaie Claude en
// premier puis bascule automatiquement sur Gemini si Claude est
// indisponible (voir ce fichier pour le detail).
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
    const { matiereId, chapitreId, enfantId } = body;

  if (!prompt) {
        return NextResponse.json({ error: "Merci de decrire ce que vous souhaitez generer." }, { status: 400 });
  }
    if (!matiereId || !enfantId) {
          return NextResponse.json({ error: "Matiere et enfant requis pour generer une synthese." }, { status: 400 });
    }

  const { data: matiere } = await supabaseAdmin.from("matieres").select("nom").eq("id", matiereId).single();
    const consigneLangueMatiere = consigneLangue(matiere?.nom);

  let texteSynthese;
    try {
          const resultat = await genererTexteIA({
                  systemPrompt: `Tu es un assistant pedagogique qui redige des syntheses de cours claires et structurees pour des eleves de college et lycee, a partir de la demande de l'utilisateur (qui peut preciser le sujet, le niveau scolaire, les points a couvrir, etc.). Structure ta reponse avec des titres et sous-titres. ${consigneLangueMatiere}`,
                  promptTexte: prompt,
                  maxTokens: 4096,
          });
          texteSynthese = resultat.texte;
    } catch (err) {
          return NextResponse.json({ error: `Echec de la generation par IA : ${err.message}` }, { status: 500 });
    }

  const titrePrompt = prompt.slice(0, 50).replace(/\s+/g, " ").trim();
    const nomDocument = `Synthese IA - ${titrePrompt}${prompt.length > 50 ? "..." : ""}`;
    const cheminSynthese = `${enfantId}/${Date.now()}-synthese-ia.md`;
    const { error: uploadError } = await supabaseAdmin.storage
      .from("documents")
      .upload(cheminSynthese, Buffer.from(texteSynthese, "utf-8"), { contentType: "text/markdown; charset=utf-8" });
    if (uploadError) {
          return NextResponse.json({ error: `Echec de l'enregistrement de la synthese : ${uploadError.message}` }, { status: 500 });
    }

  const { data: nouveauDocument, error: insertError } = await supabaseAdmin
      .from("documents")
      .insert({
              nom: nomDocument,
              type: "synthese",
              matiere_id: matiereId,
              chapitre_id: chapitreId || null,
              enfant_id: enfantId,
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
