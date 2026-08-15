// Point d'entree unique pour toute generation de texte par IA dans
// l'application (synthese, exercices, corrige, test QCM). Essaie Claude
// (Anthropic) en premier ; si l'appel echoue (cle manquante, erreur reseau,
// erreur de l'API, quota epuise...), bascule automatiquement sur Gemini
// (Google) si une cle GEMINI_API_KEY est configuree cote serveur. Objectif :
// eviter qu'une indisponibilite ponctuelle d'un seul service ne bloque toute
// la generation de contenu pedagogique.
//
// Format d'entree normalise, independant du fournisseur :
//   systemPrompt : consigne systeme (comportement, regles de langue/notation...)
//   promptTexte  : instruction/texte principal (demande de l'utilisateur, ou
//                  consigne de type "Redige une synthese de ce cours.")
//   pieceJointe  : optionnel, document source :
//                  { mimeType, base64 } pour un PDF ou une image
//                  { texte } pour un contenu deja en texte brut
//   maxTokens    : nombre max de tokens de sortie (defaut 4096)
//
// Retour : { texte, source } ou source vaut "claude" ou "gemini", selon le
// service qui a repondu. Leve une erreur (message cumulant les deux echecs
// eventuels) si aucun des deux services n'a pu repondre.
//
// appellerClaude et appellerGemini sont aussi exportees individuellement,
// pour permettre un diagnostic separe de chaque fournisseur (voir
// app/api/admin/diagnostic-ia/route.js).

const MODELE_CLAUDE = "claude-sonnet-5";
const MODELE_GEMINI = "gemini-2.5-flash";

function construireContenuClaude(pieceJointe) {
      if (!pieceJointe) return [];
      if (pieceJointe.base64) {
              if (pieceJointe.mimeType === "application/pdf") {
                        return [{ type: "document", source: { type: "base64", media_type: "application/pdf", data: pieceJointe.base64 } }];
              }
              return [{ type: "image", source: { type: "base64", media_type: pieceJointe.mimeType, data: pieceJointe.base64 } }];
      }
      if (pieceJointe.texte) {
              return [{ type: "text", text: pieceJointe.texte }];
      }
      return [];
}

export async function appellerClaude({ systemPrompt, promptTexte, pieceJointe, maxTokens }) {
      if (!process.env.ANTHROPIC_API_KEY) {
              throw new Error("ANTHROPIC_API_KEY non configuree");
      }

  const contenu = [...construireContenuClaude(pieceJointe), { type: "text", text: promptTexte }];

  const reponse = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
                    "x-api-key": process.env.ANTHROPIC_API_KEY,
                    "anthropic-version": "2023-06-01",
                    "content-type": "application/json",
          },
          body: JSON.stringify({
                    model: MODELE_CLAUDE,
                    max_tokens: maxTokens || 4096,
                    system: systemPrompt,
                    messages: [{ role: "user", content: contenu }],
          }),
  });

  if (!reponse.ok) {
          const detail = await reponse.text();
          throw new Error(`erreur ${reponse.status} : ${detail}`);
  }

  const donnees = await reponse.json();
      const texte = (donnees.content || [])
        .filter((bloc) => bloc.type === "text")
        .map((bloc) => bloc.text)
        .join("\n\n")
        .trim();

  if (!texte) throw new Error("aucun texte renvoye");
      return texte;
}

function construireParticulesGemini(pieceJointe) {
      if (!pieceJointe) return [];
      if (pieceJointe.base64) {
              return [{ inline_data: { mime_type: pieceJointe.mimeType, data: pieceJointe.base64 } }];
      }
      if (pieceJointe.texte) {
              return [{ text: pieceJointe.texte }];
      }
      return [];
}

export async function appellerGemini({ systemPrompt, promptTexte, pieceJointe, maxTokens }) {
      if (!process.env.GEMINI_API_KEY) {
              throw new Error("GEMINI_API_KEY non configuree");
      }

  const parts = [...construireParticulesGemini(pieceJointe), { text: promptTexte }];

  const reponse = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${MODELE_GEMINI}:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({
                            system_instruction: { parts: [{ text: systemPrompt }] },
                            contents: [{ role: "user", parts }],
                            generationConfig: { maxOutputTokens: maxTokens || 4096, thinkingConfig: { thinkingBudget: 0 } },
                }),
      }
        );

  if (!reponse.ok) {
          const detail = await reponse.text();
          throw new Error(`erreur ${reponse.status} : ${detail}`);
  }

  const donnees = await reponse.json();
      const texte = (donnees.candidates?.[0]?.content?.parts || [])
        .map((partie) => partie.text || "")
        .join("\n\n")
        .trim();

  if (!texte) throw new Error("aucun texte renvoye");
      return texte;
}

export async function genererTexteIA({ systemPrompt, promptTexte, pieceJointe, maxTokens }) {
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
