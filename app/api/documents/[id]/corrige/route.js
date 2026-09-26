import { NextResponse } from "next/server";
import { supabaseAdmin, supabaseAdminConfigured, getCompteFromToken } from "@/lib/supabaseAdmin";

export const maxDuration = 30;

/* Genere le corrige d'un exercice ou d'un test deja importe, de facon
ASYNCHRONE (signalement de Phil : meme apres avoir raccourci la consigne et
ajoute des delais par fournisseur, un exercice avec beaucoup de questions
demande parfois pres d'une minute de traitement par l'IA - constate par Phil
en testant Claude directement en dehors de l'application - ce qui depasse le
plafond strict de 60s d'une fonction Vercel sur le plan Hobby et provoque une
erreur 504 imprevisible). Cette route ne fait plus que verifier les
conditions puis declencher la Supabase Edge Function "generer-corrige" (voir
supabase/functions/generer-corrige), qui n'a pas cette limite de duree et
fait le vrai travail (telechargement, appel IA, enregistrement) en
arriere-plan. Le document source passe par un statut "en_cours" le temps du
traitement (voir schema.sql : documents.corrige_statut / corrige_erreur) ;
DevoirCard.js et MatiereDocuments.js interrogent ce statut a intervalles
reguliers pour savoir quand afficher le corrige ou l'erreur, au lieu
d'attendre la reponse de cette route. */
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
  if (document.corrige_statut === "en_cours") {
    return NextResponse.json({ error: "Une generation est deja en cours pour ce document." }, { status: 400 });
  }

  const { data: corrigeExistant } = await supabaseAdmin
    .from("documents")
    .select("id")
    .eq("corrige_de_id", id)
    .maybeSingle();
  if (corrigeExistant) {
    return NextResponse.json({ error: "Un corrige existe deja pour ce document." }, { status: 400 });
  }

  const edgeFunctionUrl = process.env.SUPABASE_EDGE_FUNCTION_URL_CORRIGE;
  const edgeFunctionSecret = process.env.EDGE_FUNCTION_SECRET;
  if (!edgeFunctionUrl || !edgeFunctionSecret) {
    return NextResponse.json({ error: "La generation asynchrone du corrige n'est pas encore configuree cote serveur (variables d'environnement manquantes)." }, { status: 500 });
  }

  await supabaseAdmin.from("documents").update({ corrige_statut: "en_cours", corrige_erreur: null }).eq("id", id);

  try {
    const reponse = await fetch(edgeFunctionUrl, {
      method: "POST",
      headers: { "content-type": "application/json", "x-fonction-secret": edgeFunctionSecret },
      body: JSON.stringify({ documentId: id, compteId: compte.id }),
    });
    if (!reponse.ok) {
      const detail = await reponse.text();
      await supabaseAdmin.from("documents").update({ corrige_statut: "erreur", corrige_erreur: `Echec du declenchement : ${detail}` }).eq("id", id);
      return NextResponse.json({ error: `Echec du declenchement de la generation : ${detail}` }, { status: 500 });
    }
  } catch (err) {
    await supabaseAdmin.from("documents").update({ corrige_statut: "erreur", corrige_erreur: err.message }).eq("id", id);
    return NextResponse.json({ error: `Echec du declenchement de la generation : ${err.message}` }, { status: 500 });
  }

  return NextResponse.json({ success: true, statut: "en_cours" });
}
