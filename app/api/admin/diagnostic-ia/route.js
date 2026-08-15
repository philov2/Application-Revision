import { NextResponse } from "next/server";
import { getCompteFromToken } from "@/lib/supabaseAdmin";
import { appellerClaude, appellerGemini } from "@/lib/genererTexteIA";

// Route de diagnostic (reservee aux admins) : teste independamment Claude et
// Gemini avec un prompt trivial, pour verifier que les deux cles API sont
// bien configurees et fonctionnelles, sans jamais toucher aux variables
// d'environnement de production. N'ecrit rien en base de donnees.
export async function GET(request) {
    const compte = await getCompteFromToken(request);
    if (!compte || compte.statut !== "actif" || compte.role !== "admin") {
          return NextResponse.json({ error: "Non autorise." }, { status: 403 });
    }

  const resultats = {};

  try {
        const texte = await appellerClaude({
                systemPrompt: "Reponds uniquement par le mot OK, sans rien ajouter.",
                promptTexte: "Dis OK.",
                maxTokens: 20,
        });
        resultats.claude = { ok: true, reponse: texte };
  } catch (err) {
        resultats.claude = { ok: false, erreur: err.message };
  }

  try {
        const texte = await appellerGemini({
                systemPrompt: "Reponds uniquement par le mot OK, sans rien ajouter.",
                promptTexte: "Dis OK.",
                maxTokens: 20,
        });
        resultats.gemini = { ok: true, reponse: texte };
  } catch (err) {
        resultats.gemini = { ok: false, erreur: err.message };
  }

  return NextResponse.json(resultats);
}
