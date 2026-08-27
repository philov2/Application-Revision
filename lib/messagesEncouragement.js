import { calculerStatsDevoirs, calculerStreak, filtrerDevoirsFaitsRecents } from "./devoirsStats";

/* Jalon "messages d'encouragement" (signalement de Phil : rendre l'application
   plus attractive pour une adolescente, inspire d'apps comme Duolingo).
   Renvoie une phrase courte et positive adaptee au contexte (streak, devoirs
   en retard, tout est fait...). Plusieurs variantes par situation, choisies
   via le jour de l'annee pour se renouveler chaque jour sans changer a
   chaque re-render. */
function choisirVariante(variantes, aujourdHui) {
  const debutAnnee = new Date(aujourdHui.getFullYear(), 0, 0);
  const jourDeLannee = Math.floor((aujourdHui - debutAnnee) / 86400000);
  return variantes[jourDeLannee % variantes.length];
}

export function genererMessageEncouragement(devoirs, aujourdHui = new Date()) {
  const liste = devoirs || [];
  const stats = calculerStatsDevoirs(liste, aujourdHui);
  const streak = calculerStreak(liste, aujourdHui);

  if (streak >= 7) {
    return choisirVariante(
      [
        `🔥 ${streak} jours d'affilée, sérieusement impressionnant !`,
        `🔥 ${streak} jours de suite — une vraie habitude qui s'installe.`,
        `🔥 ${streak} jours d'affilée, continue comme ça !`,
      ],
      aujourdHui
    );
  }
  if (streak >= 3) {
    return choisirVariante(
      [
        `🔥 ${streak} jours d'affilée, tu es lancée !`,
        `🔥 ${streak} jours de suite, jolie régularité.`,
        `🔥 ${streak} jours d'affilée — encore un peu et ça devient une habitude.`,
      ],
      aujourdHui
    );
  }
  if (stats.totalAFaire === 0) {
    return choisirVariante(
      [
        "✨ Tout est à jour, aucun devoir en attente. Bien joué !",
        "✨ Rien à faire pour le moment — profite-en pour souffler.",
        "✨ Tout est fait, la voie est libre !",
      ],
      aujourdHui
    );
  }
  if (stats.enRetard > 0) {
    return choisirVariante(
      [
        "💪 Un petit coup pour rattraper ce qui traîne, et c'est reparti.",
        "💪 Quelques devoirs en attente — un à la fois, ça se rattrape vite.",
        "💪 Pas de stress, on reprend un devoir à la fois.",
      ],
      aujourdHui
    );
  }
  const faitsRecents = filtrerDevoirsFaitsRecents(liste, aujourdHui).length;
  if (faitsRecents > 0) {
    return choisirVariante(
      [
        `👏 ${faitsRecents} devoir${faitsRecents > 1 ? "s" : ""} fait${faitsRecents > 1 ? "s" : ""} cette semaine, bon rythme.`,
        "👏 Bon rythme cette semaine, continue !",
        "👏 Ça avance bien, bravo pour le travail fourni.",
      ],
      aujourdHui
    );
  }
  return choisirVariante(
    [
      "🌟 Prête à démarrer ? Un devoir à la fois.",
      "🌟 Allez, on s'y met tranquillement.",
      "🌟 Chaque devoir compte, à toi de jouer.",
    ],
    aujourdHui
  );
}
