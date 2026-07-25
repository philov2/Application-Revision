"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { creerDevoir } from "@/lib/devoirsSupabase";

const TYPES_DEVOIR = [
  { value: "revision", label: "Reviser le cours" },
  { value: "exercice", label: "Exercices" },
  { value: "test", label: "Test" },
  ];

export default function FormulaireDevoir({ enfantId, compteId, matieres, onCree }) {
    const [ouvert, setOuvert] = useState(false);
    const [matiereId, setMatiereId] = useState("");
    const [chapitres, setChapitres] = useState([]);
    const [envoi, setEnvoi] = useState(false);
    const [message, setMessage] = useState("");

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

  async function soumettre(e) {
        e.preventDefault();
        setMessage("");
        const form = new FormData(e.target);
        setEnvoi(true);
        try {
                await creerDevoir({
                          enfantId,
                          matiereId: form.get("matiere_id"),
                          chapitreId: form.get("chapitre_id") || null,
                          type: form.get("type"),
                          dateEcheance: form.get("date_echeance"),
                          creePar: compteId,
                });
                e.target.reset();
                setMatiereId("");
                setOuvert(false);
                onCree?.();
        } catch (err) {
                setMessage(err.message);
        } finally {
                setEnvoi(false);
        }
  }

  return (
        <div>
          <button onClick={() => setOuvert((v) => !v)} className="text-sm font-medium rounded-lg px-3 py-1.5" style={{ background: "#91CAFF" }}>
        + Nouveau devoir
          </button>
{ouvert && (
          <form onSubmit={soumettre} className="rounded-xl border border-slate-200 dark:border-slate-700 p-4 space-y-3 mt-3">
{message && <p className="text-sm text-red-600">{message}</p>}
           <select name="matiere_id" required value={matiereId} onChange={(e) => setMatiereId(e.target.value)} className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-transparent px-3 py-2 text-sm">
              <option value="">Choisir une matiere</option>
{matieres.map((m) => <option key={m.id} value={m.id}>{m.nom}</option>)}
  </select>
          <select name="chapitre_id" className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-transparent px-3 py-2 text-sm">
              <option value="">Aucun chapitre</option>
{chapitres.map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}
  </select>
          <select name="type" required className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-transparent px-3 py-2 text-sm">
{TYPES_DEVOIR.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                            <input name="date_echeance" type="date" required className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-transparent px-3 py-2 text-sm" />
                            <button type="submit" disabled={envoi} className="rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50" style={{ background: "#91CAFF" }}>
                  {envoi ? "Creation..." : "Creer le devoir"}
                  </button>
                  </form>
                        )}
</div>
  );
}
