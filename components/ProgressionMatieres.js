"use client";

import { progressionGlobale } from "@/lib/devoirsStats";

// Jalon "progression cumulee et ludique" (signalement de Phil : la barre de
// progression par matiere n'etait pas assez fun ni attractive ; il prefere
// une seule barre cumulee sur tous les devoirs, avec un message et un emoji
// qui evoluent selon l'avancement, dans la meme veine que le streak et le
// minuteur focus).
function messageProgression(pourcentage, total) {
  if (total === 0) return { emoji: "✨", texte: "Prêt·e à commencer ?" };
  if (pourcentage >= 100) return { emoji: "🎉", texte: "Tout est fait, bravo !" };
  if (pourcentage >= 75) return { emoji: "🔥", texte: "Presque au bout, continue !" };
  if (pourcentage >= 50) return { emoji: "💪", texte: "Tu es à mi-chemin !" };
  if (pourcentage >= 25) return { emoji: "🚀", texte: "Bon départ, continue comme ça !" };
  return { emoji: "🌱", texte: "C'est parti !" };
}

export default function ProgressionMatieres({ devoirs }) {
  const { total, faits, pourcentage } = progressionGlobale(devoirs || []);
  if (total === 0) return null;

  const { emoji, texte } = messageProgression(pourcentage, total);

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-4 space-y-2.5 bg-gradient-to-br from-white to-slate-50 dark:from-slate-900 dark:to-slate-800/60">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
          {emoji} {texte}
        </p>
        <p className="text-xs font-bold text-slate-500 dark:text-slate-400">
          {faits}/{total} devoirs · {pourcentage}%
        </p>
      </div>
      <div className="relative h-4 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: `${pourcentage}%`,
            background: "linear-gradient(90deg, #FFC0CB, #4169E1)",
          }}
        />
      </div>
    </div>
  );
}
