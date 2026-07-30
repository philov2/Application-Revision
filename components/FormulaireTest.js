"use client";

import { useState } from "react";
import { creerTest } from "@/lib/testsSupabase";

function questionVide() {
  return { question: "", choix: ["", ""], bonneReponse: 0 };
}

export default function FormulaireTest({ chapitreId, onCree }) {
  const [ouvert, setOuvert] = useState(false);
  const [titre, setTitre] = useState("");
  const [questions, setQuestions] = useState([questionVide()]);
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState("");

  function reinitialiser() {
    setTitre("");
    setQuestions([questionVide()]);
    setErreur("");
  }

  function modifierQuestion(i, texte) {
    setQuestions((prev) => prev.map((q, idx) => (idx === i ? { ...q, question: texte } : q)));
  }

  function modifierChoix(i, j, texte) {
    setQuestions((prev) => prev.map((q, idx) => {
      if (idx !== i) return q;
      const choix = [...q.choix];
      choix[j] = texte;
      return { ...q, choix };
    }));
  }

  function definirBonneReponse(i, j) {
    setQuestions((prev) => prev.map((q, idx) => (idx === i ? { ...q, bonneReponse: j } : q)));
  }

  function ajouterChoix(i) {
    setQuestions((prev) => prev.map((q, idx) => (idx === i ? { ...q, choix: [...q.choix, ""] } : q)));
  }

  function supprimerChoix(i, j) {
    setQuestions((prev) => prev.map((q, idx) => {
      if (idx !== i) return q;
      const choix = q.choix.filter((_, cj) => cj !== j);
      const bonneReponse = q.bonneReponse >= choix.length ? 0 : q.bonneReponse;
      return { ...q, choix, bonneReponse };
    }));
  }

  function ajouterQuestion() {
    setQuestions((prev) => [...prev, questionVide()]);
  }

  function supprimerQuestion(i) {
    setQuestions((prev) => prev.filter((_, idx) => idx !== i));
  }

  async function soumettre(e) {
    e.preventDefault();
    setErreur("");
    if (!titre.trim()) {
      setErreur("Donnez un titre au test.");
      return;
    }
    for (const q of questions) {
      if (!q.question.trim()) {
        setErreur("Chaque question doit avoir un énoncé.");
        return;
      }
      if (q.choix.some((c) => !c.trim())) {
        setErreur("Chaque choix doit être rempli.");
        return;
      }
    }
    setEnvoi(true);
    try {
      await creerTest({
        chapitreId,
        titre: titre.trim(),
        questions: questions.map((q) => ({ question: q.question.trim(), choix: q.choix.map((c) => c.trim()), bonne_reponse: q.bonneReponse })),
      });
      reinitialiser();
      setOuvert(false);
      onCree?.();
    } catch (err) {
      setErreur(err.message);
    } finally {
      setEnvoi(false);
    }
  }

  return (
    <div>
      <button onClick={() => setOuvert((v) => !v)} className="text-xs font-medium underline">
        + Test
      </button>
      {ouvert && (
        <form onSubmit={soumettre} className="mt-2 rounded-lg border border-slate-200 dark:border-slate-600 p-3 space-y-3">
          {erreur && <p className="text-xs text-red-600">{erreur}</p>}
          <input
            value={titre}
            onChange={(e) => setTitre(e.target.value)}
            placeholder="Titre du test"
            className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-transparent px-3 py-2 text-sm"
          />
          <div className="space-y-3">
            {questions.map((q, i) => (
              <div key={i} className="rounded-lg border border-slate-200 dark:border-slate-600 p-2 space-y-2">
                <div className="flex items-center gap-2">
                  <input
                    value={q.question}
                    onChange={(e) => modifierQuestion(i, e.target.value)}
                    placeholder={`Question ${i + 1}`}
                    className="flex-1 rounded-lg border border-slate-300 dark:border-slate-600 bg-transparent px-3 py-1.5 text-sm"
                  />
                  {questions.length > 1 && (
                    <button type="button" onClick={() => supprimerQuestion(i)} className="text-xs text-red-600 underline shrink-0">
                      Supprimer
                    </button>
                  )}
                </div>
                <div className="space-y-1 pl-2">
                  {q.choix.map((c, j) => (
                    <div key={j} className="flex items-center gap-2">
                      <input
                        type="radio"
                        name={`bonne-reponse-${i}`}
                        checked={q.bonneReponse === j}
                        onChange={() => definirBonneReponse(i, j)}
                        title="Bonne réponse"
                      />
                      <input
                        value={c}
                        onChange={(e) => modifierChoix(i, j, e.target.value)}
                        placeholder={`Choix ${j + 1}`}
                        className="flex-1 rounded-lg border border-slate-300 dark:border-slate-600 bg-transparent px-3 py-1 text-sm"
                      />
                      {q.choix.length > 2 && (
                        <button type="button" onClick={() => supprimerChoix(i, j)} className="text-xs text-red-600 underline shrink-0">
                          ×
                        </button>
                      )}
                    </div>
                  ))}
                  <button type="button" onClick={() => ajouterChoix(i)} className="text-xs underline">
                    + Choix
                  </button>
                </div>
              </div>
            ))}
          </div>
          <button type="button" onClick={ajouterQuestion} className="text-xs font-medium underline">
            + Question
          </button>
          <div className="flex items-center gap-2">
            <button type="submit" disabled={envoi} className="rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50" style={{ background: "#91CAFF" }}>
              {envoi ? "Création..." : "Créer le test"}
            </button>
            <button type="button" onClick={() => { setOuvert(false); reinitialiser(); }} className="text-sm text-slate-500">
              Annuler
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
