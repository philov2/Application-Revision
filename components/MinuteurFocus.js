"use client";

import { useEffect, useRef, useState } from "react";
import { envoyerNotification } from "@/lib/notifications";

/* Jalon "minuteur focus" (signalement de Phil : rendre l'application plus
   attractive pour une adolescente, inspiré de l'appli Forest) : minuteur
   Pomodoro 25 min de concentration / 5 min de pause, avec une petite plante
   qui pousse à l'écran pendant la session de concentration. Purement visuel,
   aucune session n'est enregistrée en base de données (outil simple, l'état
   repart à zéro si la page est rechargée). */

const DUREE_FOCUS = 25 * 60;
const DUREE_PAUSE = 5 * 60;

function formaterTemps(secondes) {
  const m = Math.floor(secondes / 60);
  const s = secondes % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function stadePlante(fraction) {
  if (fraction >= 1) return "🌳";
  if (fraction >= 0.66) return "🌿";
  if (fraction >= 0.33) return "🌱";
  return "🌰";
}

export default function MinuteurFocus() {
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

  return (
    <section className="rounded-xl border border-slate-200 dark:border-slate-700 p-6 flex flex-col items-center gap-4">
      <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
        {phase === "focus" ? "Concentration" : "Pause"}
      </p>
      <div aria-hidden="true" style={{ fontSize: `${56 + fraction * 40}px`, transition: "font-size 1s ease" }}>
        {phase === "focus" ? stadePlante(fraction) : "☕"}
      </div>
      <p className="text-4xl font-semibold tabular-nums">{formaterTemps(secondesRestantes)}</p>
      <div className="flex items-center gap-2">
        {!actif ? (
          <button
            onClick={demarrer}
            className="rounded-lg px-4 py-2 text-sm font-medium text-white"
            style={{ background: "#4169E1" }}
          >
            {secondesRestantes === dureeTotale ? "Démarrer" : "Reprendre"}
          </button>
        ) : (
          <button
            onClick={mettreEnPause}
            className="rounded-lg px-4 py-2 text-sm font-medium border border-slate-300 dark:border-slate-600"
          >
            Mettre en pause
          </button>
        )}
        <button
          onClick={reinitialiser}
          className="rounded-lg px-4 py-2 text-sm font-medium border border-slate-300 dark:border-slate-600"
        >
          Réinitialiser
        </button>
      </div>
      {sessionsTerminees > 0 && (
        <p className="text-xs text-slate-500 dark:text-slate-400">
          🌳 {sessionsTerminees} session{sessionsTerminees > 1 ? "s" : ""} de concentration terminée
          {sessionsTerminees > 1 ? "s" : ""} aujourd&apos;hui
        </p>
      )}
    </section>
  );
}
