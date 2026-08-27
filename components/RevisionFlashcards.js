"use client";

import { useState } from "react";

// Jalon "flashcards" (signalement de Phil : rendre l'application plus
// attractive pour une adolescente, dans la meme veine que le streak, le
// minuteur focus et la progression par matiere) : mode de revision
// interactif carte a carte, purement presentationnel — le deck (titre +
// cartes) est deja charge par le composant parent (voir DevoirCard.js, qui
// resout le devoir.flashcardsId via lib/flashcardsSupabase.js). Clic sur la
// carte = retourner (question <-> reponse) ; Precedent/Suivant pour
// naviguer ; Recommencer une fois la derniere carte atteinte pour repartir
// du debut sans avoir a rouvrir le devoir.
export default function RevisionFlashcards({ flashcards, onFermer }) {
  const [index, setIndex] = useState(0);
  const [retournee, setRetournee] = useState(false);

  const cartes = flashcards?.cartes || [];
  const total = cartes.length;
  const carte = cartes[index];

  if (total === 0) {
    return (
      <div className="rounded-lg border border-slate-200 dark:border-slate-600 p-3 space-y-2">
        <p className="text-sm text-slate-400">Ce jeu de flashcards ne contient aucune carte.</p>
        {onFermer && (
          <button onClick={onFermer} className="text-xs font-medium underline text-slate-500 dark:text-slate-400">
            Fermer
          </button>
        )}
      </div>
    );
  }

  function allerA(nouvelIndex) {
    setIndex(nouvelIndex);
    setRetournee(false);
  }

  function precedente() {
    if (index > 0) allerA(index - 1);
  }

  function suivante() {
    if (index < total - 1) allerA(index + 1);
  }

  function recommencer() {
    allerA(0);
  }

  const derniereCarte = index === total - 1;

  return (
    <div className="space-y-3 border border-slate-200 dark:border-slate-600 rounded-lg p-3">
      <div className="flex items-center justify-between gap-3">
        <p className="font-medium text-sm">{flashcards.titre}</p>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs text-slate-500 dark:text-slate-400">
            {index + 1} / {total}
          </span>
          {onFermer && (
            <button onClick={onFermer} className="text-xs font-medium underline text-slate-500 dark:text-slate-400">
              Fermer
            </button>
          )}
        </div>
      </div>

      <button
        type="button"
        onClick={() => setRetournee((v) => !v)}
        className="w-full min-h-[7rem] rounded-xl border-2 flex items-center justify-center text-center px-4 py-6 text-sm font-medium"
        style={
          retournee
            ? { borderColor: "#4169E1", background: "rgba(65, 105, 225, 0.08)" }
            : { borderColor: "#cbd5e1" }
        }
      >
        <span>{retournee ? carte.reponse : carte.question}</span>
      </button>
      <p className="text-xs text-center text-slate-400">
        {retournee ? "Réponse — cliquez pour revoir la question" : "Question — cliquez pour voir la réponse"}
      </p>

      <div className="flex items-center justify-between gap-2">
        <button
          onClick={precedente}
          disabled={index === 0}
          className="rounded-lg px-3 py-1.5 text-sm font-medium border border-slate-300 dark:border-slate-600 disabled:opacity-40"
        >
          ← Précédente
        </button>
        {derniereCarte ? (
          <button
            onClick={recommencer}
            className="rounded-lg px-3 py-1.5 text-sm font-medium text-white"
            style={{ background: "#4169E1" }}
          >
            ↻ Recommencer
          </button>
        ) : (
          <button
            onClick={suivante}
            className="rounded-lg px-3 py-1.5 text-sm font-medium text-white"
            style={{ background: "#4169E1" }}
          >
            Suivante →
          </button>
        )}
      </div>
    </div>
  );
}
