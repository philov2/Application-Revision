"use client";

import { formaterTemps, stadePlante } from "@/lib/useMinuteurFocus";

/* Jalon "minuteur focus" (voir lib/useMinuteurFocus.js pour l'état) : ce
   composant est purement présentationnel — l'état (phase, temps restant,
   actif, sessions terminées) vient du hook useMinuteurFocus, instancié au
   niveau du dashboard Enfant, pour qu'il survive aux changements d'onglet. */
export default function MinuteurFocus({ minuteur }) {
  const {
    phase,
    secondesRestantes,
    actif,
    sessionsTerminees,
    dureeTotale,
    fraction,
    demarrer,
    mettreEnPause,
    reinitialiser,
  } = minuteur;

  return (
    <section className="rounded-xl border border-slate-200 dark:border-slate-700 p-6 flex flex-col items-center gap-4">
      <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
        {phase === "focus" ? "Concentration" : "Pause"}
      </p>
      <div aria-hidden="true" style={{ fontSize: `${56 + fraction * 40}px`, transition: "font-size 1s ease" }}>
        {phase === "focus" ? stadePlante(fraction) : "☕"}
      </div>
      <p className="text-4xl font-semibold tabular-nums">{formaterTemps(secondesRestantes)}</p>
      <div className="flex items-center gap-2">
        {!actif ? (
          <button
            onClick={demarrer}
            className="rounded-lg px-4 py-2 text-sm font-medium text-white"
            style={{ background: "#4169E1" }}
          >
            {secondesRestantes === dureeTotale ? "Démarrer" : "Reprendre"}
          </button>
        ) : (
          <button
            onClick={mettreEnPause}
            className="rounded-lg px-4 py-2 text-sm font-medium border border-slate-300 dark:border-slate-600"
          >
            Mettre en pause
          </button>
        )}
        <button
          onClick={reinitialiser}
          className="rounded-lg px-4 py-2 text-sm font-medium border border-slate-300 dark:border-slate-600"
        >
          Réinitialiser
        </button>
      </div>
      {sessionsTerminees > 0 && (
        <p className="text-xs text-slate-500 dark:text-slate-400">
          🌳 {sessionsTerminees} session{sessionsTerminees > 1 ? "s" : ""} de concentration terminée
          {sessionsTerminees > 1 ? "s" : ""} aujourd&apos;hui
        </p>
      )}
    </section>
  );
}
