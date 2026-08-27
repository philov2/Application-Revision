"use client";

import { useEffect, useRef, useState } from "react";
import { envoyerNotification } from "@/lib/notifications";

/* Jalon "minuteur focus" (signalement de Phil : rendre l'application plus
   attractive pour une adolescente, inspiré de l'appli Forest) : minuteur
   Pomodoro 25 min de concentration / 5 min de pause, avec une petite plante
   qui pousse à l'écran pendant la session de concentration. Purement visuel,
   aucune session n'est enregistrée en base de données (outil simple, l'état
   repart à zéro si la page est rechargée).

   L'état est géré ici, dans un hook utilisé au niveau du dashboard (voir
   app/enfant/page.js), plutôt que dans le composant d'affichage : ainsi le
   minuteur continue de tourner et la plante continue de pousser même quand
   l'enfant quitte l'onglet Focus pour aller travailler sur ses devoirs
   (signalement de Phil : la plante repartait à zéro dès qu'on changeait
   d'onglet, et n'était visible nulle part pendant qu'on travaillait). */

export const DUREE_FOCUS = 25 * 60;
export const DUREE_PAUSE = 5 * 60;

export function formaterTemps(secondes) {
  const m = Math.floor(secondes / 60);
  const s = secondes % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function stadePlante(fraction) {
  if (fraction >= 1) return "🌳";
  if (fraction >= 0.66) return "🌿";
  if (fraction >= 0.33) return "🌱";
  return "🌰";
}

export function useMinuteurFocus() {
  const [phase, setPhase] = useState("focus"); /* "focus" | "pause" */
  const [secondesRestantes, setSecondesRestantes] = useState(DUREE_FOCUS);
  const [actif, setActif] = useState(false);
  const [sessionsTerminees, setSessionsTerminees] = useState(0);
  const phaseRef = useRef(phase);
  phaseRef.current = phase;

  useEffect(() => {
    if (!actif) return;
    const intervalle = setInterval(() => {
      setSecondesRestantes((prev) => {
        if (prev <= 1) {
          const finPhase = phaseRef.current;
          const prochaine = finPhase === "focus" ? "pause" : "focus";
          if (finPhase === "focus") {
            setSessionsTerminees((n) => n + 1);
            envoyerNotification("Session terminée !", "Bien joué — place à une pause de 5 minutes.");
          } else {
            envoyerNotification("Pause terminée", "Prête pour une nouvelle session de concentration ?");
          }
          setPhase(prochaine);
          return prochaine === "focus" ? DUREE_FOCUS : DUREE_PAUSE;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(intervalle);
  }, [actif]);

  function demarrer() {
    setActif(true);
  }
  function mettreEnPause() {
    setActif(false);
  }
  function reinitialiser() {
    setActif(false);
    setPhase("focus");
    setSecondesRestantes(DUREE_FOCUS);
  }

  const dureeTotale = phase === "focus" ? DUREE_FOCUS : DUREE_PAUSE;
  const fraction = 1 - secondesRestantes / dureeTotale;
  /* Une session est "en cours" (pour le petit badge flottant visible sur les */
  /* autres onglets) dès qu'elle a été démarrée au moins une fois et n'a pas */
  /* été réinitialisée — qu'elle tourne activement ou soit en pause. */
  const enCours = actif || secondesRestantes !== dureeTotale;

  return {
    phase,
    secondesRestantes,
    actif,
    sessionsTerminees,
    dureeTotale,
    fraction,
    enCours,
    demarrer,
    mettreEnPause,
    reinitialiser,
  };
}
