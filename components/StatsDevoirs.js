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
          className="carte-recap rounded-2xl border px-2 py-2 text-center"
          style={{
            borderColor: c.accent ? "var(--ambre)" : "var(--bordure-recap)",
            background: c.accent
              ? "color-mix(in srgb, var(--ambre) 12%, var(--bg-carte))"
              : "var(--bg-carte)",
          }}
        >
          <p className="font-display text-base font-semibold leading-tight">
            {c.cle === "streak" && c.valeur > 0 ? "🔥 " : ""}
            {c.valeur}
          </p>
          <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-tight">{c.label}</p>
        </div>
      ))}
    </div>
  );
}
