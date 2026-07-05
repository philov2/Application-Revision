"use client";

import { matieres } from "@/lib/sampleData";

const LABEL_TYPE = { revision: "Réviser le cours", exercice: "Exercices", test: "Test" };

export default function DevoirCard({ devoir, onToggle }) {
  const couleur = matieres.find((m) => m.nom === devoir.matiere)?.couleur || "#91CAFF";
  const fait = devoir.statut === "fait";
  return (
    <div
      className="rounded-xl border border-slate-200 dark:border-slate-700 p-4 flex items-center justify-between gap-4"
      style={{ borderLeft: `6px solid ${couleur}` }}
    >
      <div>
        <p className="text-xs uppercase tracking-wide text-slate-500">{devoir.matiere} · {devoir.chapitre}</p>
        <p className="font-medium">{LABEL_TYPE[devoir.type] || devoir.type}</p>
        <p className="text-xs text-slate-500 mt-1">
          À faire pour le {devoir.echeance} · demandé par {devoir.origine}
        </p>
      </div>
      <label className="flex items-center gap-2 text-sm shrink-0">
        <input type="checkbox" checked={fait} onChange={() => onToggle?.(devoir.id)} className="h-5 w-5" />
        {fait ? "Fait" : "À faire"}
      </label>
    </div>
  );
}
