"use client";

import { calculerStatsDevoirs } from "@/lib/devoirsStats";

export default function StatsDevoirs({ devoirs }) {
  const stats = calculerStatsDevoirs(devoirs || []);
  const cases = [
    { label: "devoirs a faire aujourd'hui", valeur: stats.aFaireAujourdhui },
    { label: "Total des devoirs à faire", valeur: stats.totalAFaire },
    { label: "devoirs en retard", valeur: stats.enRetard },
    { label: "realises dans les delais", valeur: stats.realisesDansLesDelais },
    { label: "retard de plus d'une semaine", valeur: stats.retardPlusUneSemaine },
  ];

  return (
    <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
      {cases.map((c) => (
        <div key={c.label} className="rounded-lg border border-slate-200 dark:border-slate-700 px-2 py-1.5 text-center">
          <p className="text-base font-semibold leading-tight">{c.valeur}</p>
          <p className="text-[10px] text-slate-500 leading-tight">{c.label}</p>
        </div>
      ))}
    </div>
  );
}
