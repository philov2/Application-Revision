"use client";

import { calculerStatsDevoirs, calculerStreak } from "@/lib/devoirsStats";

export default function StatsDevoirs({ devoirs }) {
  const stats = calculerStatsDevoirs(devoirs || []);
  const streak = calculerStreak(devoirs || []);
  const cases = [
    { label: "jours d'affilée", valeur: streak, cle: "streak", accent: streak > 0 },
    { label: "devoirs a faire aujourd'hui", valeur: stats.aFaireAujourdhui },
    { label: "Total des devoirs à faire", valeur: stats.totalAFaire },
    { label: "devoirs en retard", valeur: stats.enRetard },
    { label: "realises dans les delais", valeur: stats.realisesDansLesDelais },
    { label: "retard de plus d'une semaine", valeur: stats.retardPlusUneSemaine },
  ];

  return (
    <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
      {cases.map((c) => (
        <div
          key={c.label}
          className={`rounded-lg border px-2 py-1.5 text-center ${
            c.accent
              ? "border-orange-300 dark:border-orange-700 bg-orange-50 dark:bg-orange-950/30"
              : "border-slate-200 dark:border-slate-700"
          }`}
        >
          <p className="text-base font-semibold leading-tight">
            {c.cle === "streak" && c.valeur > 0 ? "🔥 " : ""}
            {c.valeur}
          </p>
          <p className="text-[10px] text-slate-500 leading-tight">{c.label}</p>
        </div>
      ))}
    </div>
  );
}
