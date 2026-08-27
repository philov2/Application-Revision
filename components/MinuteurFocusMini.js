"use client";

import { formaterTemps, stadePlante } from "@/lib/useMinuteurFocus";

/* Jalon "minuteur focus" (suite, signalement de Phil : la plante n'était */
/* visible nulle part pendant qu'on travaillait, et repartait à zéro en */
/* changeant d'onglet). Petit badge flottant, visible sur tous les onglets */
/* du dashboard Enfant dès qu'une session a été démarrée (en cours ou en */
/* pause), pour voir la plante continuer à pousser en faisant ses devoirs. */
/* Cliquer dessus ramène directement à l'onglet Focus. */
export default function MinuteurFocusMini({ minuteur, onOuvrir }) {
  const { phase, secondesRestantes, actif, fraction, enCours } = minuteur;

  if (!enCours) return null;

  return (
    <button
      onClick={onOuvrir}
      className="fixed bottom-4 right-4 z-40 flex items-center gap-2 rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-lg px-3 py-2"
    >
      <span aria-hidden="true" style={{ fontSize: "22px" }}>
        {phase === "focus" ? stadePlante(fraction) : "☕"}
      </span>
      <span className="text-sm font-medium tabular-nums">{formaterTemps(secondesRestantes)}</span>
      {!actif && <span className="text-xs text-slate-500 dark:text-slate-400">en pause</span>}
    </button>
  );
}
