"use client";

import { useState } from "react";
import { authFetch } from "@/lib/authFetch";

// Jalon "personnalisation de l'espace Enfant" (signalement de Phil) :
// l'enfant choisit une couleur d'accent pour son propre espace (soulignement
// de l'onglet actif, bouton Démarrer du minuteur Focus...). Palette fixe et
// restreinte (voir app/api/mon-compte/route.js, qui revalide la même liste
// côté serveur) plutôt qu'un sélecteur de couleur libre, pour rester dans
// des teintes qui restent lisibles en mode clair comme en mode sombre.
export const PALETTE_COULEURS = [
  { nom: "Bleu roi", valeur: "#4169E1" },
  { nom: "Corail", valeur: "#FF7F6B" },
  { nom: "Émeraude", valeur: "#10B981" },
  { nom: "Violet", valeur: "#8B5CF6" },
  { nom: "Ambre", valeur: "#F59E0B" },
  { nom: "Rose", valeur: "#F43F5E" },
  { nom: "Turquoise", valeur: "#14B8A6" },
  { nom: "Ciel", valeur: "#0EA5E9" },
];

export default function PersonnalisationEspace({ couleurActuelle, onChange }) {
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState("");
  const couleur = couleurActuelle || "#4169E1";

  async function choisir(valeur) {
    if (valeur === couleur) return;
    setErreur("");
    setEnCours(true);
    const precedente = couleurActuelle;
    onChange?.(valeur); // réponse visuelle immédiate, avant confirmation du serveur
    try {
      await authFetch("/api/mon-compte", { method: "PATCH", body: JSON.stringify({ couleurAccent: valeur }) });
    } catch (err) {
      setErreur(err.message);
      onChange?.(precedente);
    } finally {
      setEnCours(false);
    }
  }

  return (
    <section className="rounded-xl border border-slate-200 dark:border-slate-700 p-4 space-y-3">
      <p className="text-sm font-medium">🎨 Personnaliser mon espace</p>
      <div className="flex flex-wrap gap-2">
        {PALETTE_COULEURS.map((c) => (
          <button
            key={c.valeur}
            type="button"
            onClick={() => choisir(c.valeur)}
            disabled={enCours}
            title={c.nom}
            aria-label={c.nom}
            className="h-8 w-8 rounded-full flex items-center justify-center disabled:opacity-50"
            style={{ background: c.valeur }}
          >
            {c.valeur === couleur && (
              <span className="text-white text-sm" aria-hidden="true">
                ✓
              </span>
            )}
          </button>
        ))}
      </div>
      {erreur && <p className="text-xs text-red-600">{erreur}</p>}
    </section>
  );
}
