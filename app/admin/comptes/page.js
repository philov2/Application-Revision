"use client";

import { useEffect, useState } from "react";
import Navbar from "@/components/Navbar";
import DemoBanner from "@/components/DemoBanner";
import AuthGuard from "@/components/AuthGuard";
import { supabase, supabaseConfigured } from "@/lib/supabaseClient";
import { authFetch } from "@/lib/authFetch";

const ROLES = ["admin", "parent", "enfant", "soutien"];
const LABELS_ROLE = { admin: "Administrateur", parent: "Parent", enfant: "Enfant", soutien: "Soutien" };

export default function PageComptes() {
  return (
    <AuthGuard role="admin">
      <Contenu />
    </AuthGuard>
  );
}

function Contenu() {
  const [comptes, setComptes] = useState([]);
  const [erreur, setErreur] = useState("");
  const [enEdition, setEnEdition] = useState(null);
  const [nomEdite, setNomEdite] = useState("");
  const [roleEdite, setRoleEdite] = useState("");
  const [enCours, setEnCours] = useState(new Set());
  const [enConfirmation, setEnConfirmation] = useState(null);

  async function charger() {
    if (!supabaseConfigured) return;
    const { data } = await supabase
      .from("comptes")
      .select("*")
      .order("created_at", { ascending: true });
    setComptes(data || []);
  }

  useEffect(() => {
    charger();
  }, []);

  function commencerEdition(c) {
    setEnEdition(c.id);
    setNomEdite(c.nom);
    setRoleEdite(c.role);
    setErreur("");
  }

  function annulerEdition() {
    setEnEdition(null);
  }

  async function enregistrer(id) {
    setErreur("");
    setEnCours((prev) => new Set(prev).add(id));
    try {
      await authFetch(`/api/comptes/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ nom: nomEdite, role: roleEdite }),
      });
      setEnEdition(null);
      await charger();
    } catch (err) {
      setErreur(err.message);
    } finally {
      setEnCours((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  }

  async function supprimer(c) {
    setErreur("");
    setEnCours((prev) => new Set(prev).add(c.id));
    try {
      await authFetch(`/api/comptes/${c.id}`, { method: "DELETE" });
      setComptes((prev) => prev.filter((x) => x.id !== c.id));
      setEnConfirmation(null);
    } catch (err) {
      setErreur(err.message);
    } finally {
      setEnCours((prev) => {
        const next = new Set(prev);
        next.delete(c.id);
        return next;
      });
    }
  }

  return (
    <>
      <DemoBanner />
      <Navbar role="admin" nom="Philippe" />
      <main className="flex-1 max-w-3xl w-full mx-auto px-4 py-8 space-y-6">
        <h2 className="font-semibold">Comptes ({comptes.length})</h2>
        {erreur && <p className="text-sm text-red-600">{erreur}</p>}
        <div className="space-y-3">
          {comptes.map((c) => (
            <div key={c.id} className="rounded-xl border border-slate-200 dark:border-slate-700 p-4 flex items-center justify-between gap-4 flex-wrap">
              {enEdition === c.id ? (
                <>
                  <div className="flex-1 flex items-center gap-2 flex-wrap">
                    <input
                      value={nomEdite}
                      onChange={(e) => setNomEdite(e.target.value)}
                      className="rounded-lg border border-slate-300 dark:border-slate-600 bg-transparent px-2 py-1 text-sm"
                    />
                    <select
                      value={roleEdite}
                      onChange={(e) => setRoleEdite(e.target.value)}
                      className="rounded-lg border border-slate-300 dark:border-slate-600 bg-transparent px-2 py-1 text-sm"
                    >
                      {ROLES.map((r) => (
                        <option key={r} value={r}>{LABELS_ROLE[r]}</option>
                      ))}
                    </select>
                    <span className="text-xs text-slate-400">{c.email}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => enregistrer(c.id)}
                      disabled={enCours.has(c.id)}
                      className="rounded-lg px-3 py-1.5 text-sm font-medium disabled:opacity-50"
                      style={{ background: "#91CAFF" }}
                    >
                      {enCours.has(c.id) ? "Enregistrement..." : "Enregistrer"}
                    </button>
                    <button onClick={annulerEdition} className="text-sm text-slate-500">Annuler</button>
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <p className="font-medium">{c.nom} <span className="text-xs font-normal text-slate-400">({LABELS_ROLE[c.role] || c.role})</span></p>
                    <p className="text-sm text-slate-500">{c.email}</p>
                    <p className="text-xs text-slate-400">Statut : {c.statut}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <button onClick={() => commencerEdition(c)} className="text-xs font-medium underline">Modifier</button>
                    {enConfirmation === c.id ? (
                      <>
                        <span className="text-xs text-red-600">Confirmer ?</span>
                        <button
                          onClick={() => supprimer(c)}
                          disabled={enCours.has(c.id)}
                          className="text-xs font-medium underline text-red-600 disabled:opacity-50"
                        >
                          {enCours.has(c.id) ? "Suppression..." : "Oui, supprimer"}
                        </button>
                        <button onClick={() => setEnConfirmation(null)} className="text-xs font-medium underline text-slate-500">Annuler</button>
                      </>
                    ) : (
                      <button
                        onClick={() => setEnConfirmation(c.id)}
                        className="text-xs font-medium underline text-red-600"
                      >
                        Supprimer
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          ))}
          {comptes.length === 0 && <p className="text-slate-500 text-sm">Aucun compte.</p>}
        </div>
      </main>
    </>
  );
}
