"use client";

import { progressionParMatiere } from "@/lib/devoirsStats";

// Jalon "progression visible" (signalement de Phil : rendre l'application
// plus attractive pour une adolescente, comme le streak et le minuteur
// focus) : une barre de progression par matière, à la couleur de la
// matière (même palette que partout ailleurs — cartes de devoirs, Chapitres
// et documents), pour voir en un coup d'œil où on en est. N'affiche rien si
// aucun devoir n'a encore de matière (liste vide au tout premier chargement).
export default function ProgressionMatieres({ devoirs }) {
  const progression = progressionParMatiere(devoirs || []);
  if (progression.length === 0) return null;

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-4 space-y-2.5">
      <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Progression par matière</p>
      <div className="space-y-2">
        {progression.map((m) => (
          <div key={m.matiereId} className="flex items-center gap-2.5">
            <span className="text-xs w-20 sm:w-28 shrink-0 truncate" title={m.nom}>
              {m.nom}
            </span>
            <div className="flex-1 h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${m.pourcentage}%`, background: m.couleur }}
              />
            </div>
            <span className="text-xs text-slate-500 dark:text-slate-400 w-9 text-right shrink-0">{m.pourcentage}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}
