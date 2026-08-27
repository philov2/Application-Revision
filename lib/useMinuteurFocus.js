"use client";

import { useEffect, useRef, useState } from "react";
import { envoyerNotification } from "@/lib/notifications";

/* Jalon "minuteur focus" (signalement de Phil : rendre l'application plus
   attractive pour une adolescente, inspiré de l'appli Forest) : minuteur
   Pomodoro 25 min de concentration / 5 min de pause, avec une petite plante
   qui pousse à l'écran pendant la session de concentration. Purement visuel,
   aucune session n'est enregistrée en base de données (outil simple).

   L'état est géré ici, dans un hook réutilisable, et synchronisé via
   sessionStorage (signalement de Phil : le minuteur perdait sa progression
   et la plante repartait à zéro en ouvrant un document depuis l'application,
   puisque cette navigation démonte entièrement la page /enfant — et donc le
   state React qui y vivait). sessionStorage survit à ce type de navigation
   et aux rechargements de page, mais se vide quand l'onglet est fermé :
   assez pour ne pas perdre sa session en cours de route, sans devenir une
   vraie persistance serveur. */

export const DUREE_FOCUS = 25 * 60;
export const DUREE_PAUSE = 5 * 60;

const CLE_STOCKAGE = "revision_minuteur_focus";

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

/* Relit l'état sauvegardé et rattrape le temps écoulé pendant qu'aucune */
/* page ne montait le hook (ex. lecture d'un document). Si une ou plusieurs */
/* phases se sont terminées entre-temps, on les fait défiler (garde-fou à */
/* 50 itérations) pour retomber sur la bonne phase et le bon temps restant. */
function chargerEtatSauvegarde() {
  if (typeof window === "undefined") return null;
  try {
    const brut = window.sessionStorage.getItem(CLE_STOCKAGE);
    if (!brut) return null;
    const s = JSON.parse(brut);
    let phase = s.phase === "pause" ? "pause" : "focus";
    let sessionsTerminees = Number.isFinite(s.sessionsTerminees) ? s.sessionsTerminees : 0;

    if (!s.actif || !s.finTimestamp) {
      return {
        phase,
        actif: false,
        secondesRestantes: Number.isFinite(s.secondesRestantes) ? s.secondesRestantes : (phase === "focus" ? DUREE_FOCUS : DUREE_PAUSE),
        sessionsTerminees,
      };
    }

    let fin = s.finTimestamp;
    let garde = 0;
    while (Date.now() >= fin && garde < 50) {
      if (phase === "focus") sessionsTerminees += 1;
      phase = phase === "focus" ? "pause" : "focus";
      fin += (phase === "focus" ? DUREE_FOCUS : DUREE_PAUSE) * 1000;
      garde += 1;
    }
    const secondesRestantes = Math.max(0, Math.round((fin - Date.now()) / 1000));
    return { phase, actif: true, secondesRestantes, sessionsTerminees };
  } catch {
    return null;
  }
}

function sauvegarderEtat(etat) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(CLE_STOCKAGE, JSON.stringify(etat));
  } catch {
    /* stockage indisponible (navigation privée, quota...) : tant pis, le */
    /* minuteur reste fonctionnel en mémoire pour la page en cours. */
  }
}

export function useMinuteurFocus() {
  const [phase, setPhase] = useState("focus"); /* "focus" | "pause" */
  const [secondesRestantes, setSecondesRestantes] = useState(DUREE_FOCUS);
  const [actif, setActif] = useState(false);
  const [sessionsTerminees, setSessionsTerminees] = useState(0);
  const [pret, setPret] = useState(false);
  const phaseRef = useRef(phase);
  phaseRef.current = phase;

  /* Relecture de sessionStorage une fois le composant monté côté client */
  /* uniquement (jamais au rendu serveur), pour éviter un mismatch */
  /* d'hydratation Next.js entre le rendu serveur (état par défaut) et le */
  /* premier rendu client (état potentiellement sauvegardé différent). */
  useEffect(() => {
    const etat = chargerEtatSauvegarde();
    if (etat) {
      setPhase(etat.phase);
      setSecondesRestantes(etat.secondesRestantes);
      setActif(etat.actif);
      setSessionsTerminees(etat.sessionsTerminees);
    }
    setPret(true);
  }, []);

  /* Sauvegarde à chaque changement d'état, une fois la relecture initiale */
  /* terminée (sinon on écraserait l'état sauvegardé avec les valeurs par */
  /* défaut avant même de les avoir relues). */
  useEffect(() => {
    if (!pret) return;
    sauvegarderEtat({
      phase,
      secondesRestantes,
      actif,
      sessionsTerminees,
      finTimestamp: actif ? Date.now() + secondesRestantes * 1000 : null,
    });
  }, [pret, phase, secondesRestantes, actif, sessionsTerminees]);

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
  /* autres onglets et pages) dès qu'elle a été démarrée au moins une fois et */
  /* n'a pas été réinitialisée — qu'elle tourne activement ou soit en pause. */
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
