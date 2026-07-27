"use client";

import { useEffect, useState } from "react";
import { matieres as matieresSample } from "@/lib/sampleData";
import { supabase } from "@/lib/supabaseClient";
import { modifierDevoir, supprimerDevoir } from "@/lib/devoirsSupabase";

const LABEL_TYPE = { revision: "Réviser le cours", exercice: "Exercices", test: "Test" };
const TYPES_DEVOIR = [
  { value: "revision", label: "Réviser le cours" },
  { value: "exercice", label: "Exercices" },
  { value: "test", label: "Test" },
];

function statutDate(dateStr) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const echeance = new Date(dateStr + "T00:00:00");
  if (echeance.getTime() === today.getTime()) return "aujourdhui";
  return echeance < today ? "retard" : "avenir";
}

const COULEUR_DATE = {
  avenir: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  retard: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  aujourdhui: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
};

export default function DevoirCard({ devoir, onToggle, matieres, onChange }) {
  const couleur = matieresSample.find((m) => m.nom === devoir.matiere)?.couleur || "#91CAFF";
  const fait = devoir.statut === "fait";
  const [, month, day] = devoir.echeance.split("-");
  const dateLabel = `${day}/${month}`;
  const statut = statutDate(devoir.echeance);

  const [enEdition, setEnEdition] = useState(false);
  const [enConfirmationSuppression, setEnConfirmationSuppression] = useState(false);
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState("");
  const [matiereId, setMatiereId] = useState(devoir.matiereId || "");
  const [chapitreId, setChapitreId] = useState(devoir.chapitreId || "");
  const [chapitres, setChapitres] = useState([]);
  const [type, setType] = useState(devoir.type);
  const [dateEcheance, setDateEcheance] = useState(devoir.echeance);

  useEffect(() => {
    if (!matiereId) {
      setChapitres([]);
      return;
    }
    (async () => {
      const { data } = await supabase.from("chapitres").select("id, nom").eq("matiere_id", matiereId).order("nom");
      setChapitres(data || []);
    })();
  }, [matiereId]);

  function commencerEdition() {
    setMatiereId(devoir.matiereId || "");
    setChapitreId(devoir.chapitreId || "");
    setType(devoir.type);
    setDateEcheance(devoir.echeance);
    setErreur("");
    setEnEdition(true);
  }

  async function enregistrer() {
    setErreur("");
    setEnCours(true);
    try {
      await modifierDevoir(devoir.id, { matiereId, chapitreId: chapitreId || null, type, dateEcheance });
      setEnEdition(false);
      onChange?.();
    } catch (err) {
      setErreur(err.message);
    } finally {
      setEnCours(false);
    }
  }

  async function supprimer() {
    setErreur("");
    setEnCours(true);
    try {
      await supprimerDevoir(devoir.id);
      setEnConfirmationSuppression(false);
      onChange?.();
    } catch (err) {
      setErreur(err.message);
    } finally {
      setEnCours(false);
    }
  }

  if (enEdition) {
    return (
      <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-4 space-y-2" style={{ borderLeft: `6px solid ${couleur}` }}>
        {erreur && <p className="text-sm text-red-600">{erreur}</p>}
        <select value={matiereId} onChange={(e) => { setMatiereId(e.target.value); setChapitreId(""); }} className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-transparent px-3 py-2 text-sm">
          <option value="">Choisir une matière</option>
          {(matieres || []).map((m) => <option key={m.id} value={m.id}>{m.nom}</option>)}
        </select>
        <select value={chapitreId} onChange={(e) => setChapitreId(e.target.value)} className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-transparent px-3 py-2 text-sm">
          <option value="">Aucun chapitre</option>
          {chapitres.map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}
        </select>
        <select value={type} onChange={(e) => setType(e.target.value)} className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-transparent px-3 py-2 text-sm">
          {TYPES_DEVOIR.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
        <input type="date" value={dateEcheance} onChange={(e) => setDateEcheance(e.target.value)} className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-transparent px-3 py-2 text-sm" />
        <div className="flex items-center gap-2">
          <button onClick={enregistrer} disabled={enCours} className="rounded-lg px-3 py-1.5 text-sm font-medium disabled:opacity-50" style={{ background: "#91CAFF" }}>
            {enCours ? "Enregistrement..." : "Enregistrer"}
          </button>
          <button onClick={() => setEnEdition(false)} className="text-sm text-slate-500">Annuler</button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="rounded-xl border border-slate-200 dark:border-slate-700 p-4 flex items-center justify-between gap-4 flex-wrap"
      style={{ borderLeft: `6px solid ${couleur}` }}
    >
      <div>
        <p className="text-xs uppercase tracking-wide text-slate-500">{devoir.matiere} · {devoir.chapitre}</p>
        <p className="font-medium">{LABEL_TYPE[devoir.type] || devoir.type}</p>
        <div className="flex items-center gap-2 mt-2">
          <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold ${COULEUR_DATE[statut]}`}>
            {dateLabel}
          </span>
          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-600">
            {devoir.origine}
          </span>
        </div>
        {erreur && <p className="text-xs text-red-600 mt-1">{erreur}</p>}
      </div>
      <div className="flex items-center gap-3 shrink-0">
        {onToggle && (
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={fait} onChange={() => onToggle?.(devoir.id)} className="h-5 w-5" />
            {fait ? "Fait" : "À faire"}
          </label>
        )}
        {matieres && (
          <>
            <button onClick={commencerEdition} className="text-xs font-medium underline">Modifier</button>
            {enConfirmationSuppression ? (
              <>
                <span className="text-xs text-red-600">Confirmer ?</span>
                <button onClick={supprimer} disabled={enCours} className="text-xs font-medium underline text-red-600 disabled:opacity-50">
                  {enCours ? "Suppression..." : "Oui, supprimer"}
                </button>
                <button onClick={() => setEnConfirmationSuppression(false)} className="text-xs font-medium underline text-slate-500">Annuler</button>
              </>
            ) : (
              <button onClick={() => setEnConfirmationSuppression(true)} className="text-xs font-medium underline text-red-600">Supprimer</button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
