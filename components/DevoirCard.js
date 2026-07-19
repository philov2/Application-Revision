"use client";

import { matieres } from "@/lib/sampleData";

const LABEL_TYPE = { revision: "Réviser le cours", exercice: "Exercices", test: "Test" };

function statutDate(dateStr) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const echeance = new Date(dateStr + "T00:00:00");
  if (echeance.getTime() === today.getTime()) return "aujourdhui";
  return echeance < today ? "retard" : "avenir";
}

const COULEUR_DATE = {
  avenir: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  retard: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  aujourdhui: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
};

export default function DevoirCard({ devoir, onToggle }) {
  const couleur = matieres.find((m) => m.nom === devoir.matiere)?.couleur || "#91CAFF";
  const fait = devoir.statut === "fait";
  const [, month, day] = devoir.echeance.split("-");
  const dateLabel = `${day}/${month}`;
  const statut = statutDate(devoir.echeance);

  return (
    <div
      className="rounded-xl border border-slate-200 dark:border-slate-700 p-4 flex items-center justify-between gap-4"
      style={{ borderLeft: `6px solid ${couleur}` }}
    >
      <div>
        <p className="text-xs uppercase tracking-wide text-slate-500">{devoir.matiere} · {devoir.chapitre}</p>
        <p className="font-medium">{LABEL_TYPE[devoir.type] || devoir.type}</p>
        <div className="flex items-center gap-2 mt-2">
          <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold ${COULEUR_DATE[statut]}`}>
            {dateLabel}
          </span>
          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-600">
            {devoir.origine}
          </span>
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm shrink-0">
        <input type="checkbox" checked={fait} onChange={() => onToggle?.(devoir.id)} className="h-5 w-5" />
        {fait ? "Fait" : "À faire"}
      </label>
    </div>
  );
}
