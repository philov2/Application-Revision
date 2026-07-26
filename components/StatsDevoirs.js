"use client";

import { calculerStatsDevoirs } from "@/lib/devoirsStats";

export default function StatsDevoirs({ devoirs }) {
  const stats = calculerStatsDevoirs(devoirs || []);
  const cases = [
    { label: "devoirs a faire aujourd'hui", valeur: stats.aFaireAujourdhui },
    { label: "total devoirs a faire", valeur: stats.totalAFaire },
    { label: "devoirs en retard", valeur: stats.enRetard },
    { label: "realises dans les delais", valeur: stats.realisesDansLesDelais },
    { label: "retard de plus d'une semaine", valeur: stats.retardPlusUneSemaine },
    ];

return (
  <div className="grid grid-cols-2 gap-4">
{cases.map((c) => (
  <div key={c.label} className="rounded-xl border border-slate-200 dark:border-slate-700 p-4 text-center">
  <p className="text-2xl font-semibold">{c.valeur}</p>
<p className="text-xs text-slate-500">{c.label}</p>
  </div>
))}
  </div>
);
}
