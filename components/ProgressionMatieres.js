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
    <div
      className="carte-recap rounded-2xl p-4 flex items-center gap-4 flex-wrap"
      style={{ background: "var(--bg-carte)", border: "1px solid var(--bordure-recap)" }}
    >
      <div
        className="anneau lg"
        style={{ "--pct": pourcentage, "--accent": "var(--teal)", "--trou": "var(--bg-carte)" }}
      >
        <span>{pourcentage}%</span>
      </div>
      <div className="flex-1 min-w-[180px]">
        <p className="font-display text-[15px] font-semibold">
          {emoji} {texte}
        </p>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          {faits}/{total} devoirs faits
        </p>
      </div>
    </div>
  );
}
