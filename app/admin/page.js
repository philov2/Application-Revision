"use client";

import { useEffect, useState } from "react";
import Navbar from "@/components/Navbar";
import DemoBanner from "@/components/DemoBanner";
import AuthGuard from "@/components/AuthGuard";
import { supabase, supabaseConfigured } from "@/lib/supabaseClient";
import { authFetch } from "@/lib/authFetch";
import { demandesAdmin } from "@/lib/sampleData";

export default function DashboardAdmin() {
  return (
    <AuthGuard role="admin">
      <Contenu />
    </AuthGuard>
  );
}

function Contenu() {
  const [demandes, setDemandes] = useState(supabaseConfigured ? [] : demandesAdmin);
  const [erreur, setErreur] = useState("");
  const [enCoursValidation, setEnCoursValidation] = useState(new Set());
  const [enCoursRejet, setEnCoursRejet] = useState(new Set());

  useEffect(() => {
    if (!supabaseConfigured) return;
    (async () => {
      const { data } = await supabase
        .from("demandes_comptes")
        .select("*")
        .eq("statut", "en_attente")
        .order("date_demande", { ascending: true });
      setDemandes(data || []);
    })();
  }, []);

  async function valider(id) {
    if (enCoursValidation.has(id) || enCoursRejet.has(id)) return;
    setErreur("");
    if (!supabaseConfigured) {
      setDemandes((prev) => prev.filter((d) => d.id !== id));
      return;
    }
    setEnCoursValidation((prev) => new Set(prev).add(id));
    try {
      await authFetch(`/api/demandes/${id}/valider`, { method: "POST" });
      setDemandes((prev) => prev.filter((d) => d.id !== id));
    } catch (err) {
      setErreur(err.message);
    } finally {
      setEnCoursValidation((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  }

  async function rejeter(id) {
    if (enCoursValidation.has(id) || enCoursRejet.has(id)) return;
    setErreur("");
    if (!supabaseConfigured) {
      setDemandes((prev) => prev.filter((d) => d.id !== id));
      return;
    }
    setEnCoursRejet((prev) => new Set(prev).add(id));
    try {
      await authFetch(`/api/demandes/${id}/rejeter`, { method: "POST" });
      setDemandes((prev) => prev.filter((d) => d.id !== id));
    } catch (err) {
      setErreur(err.message);
    } finally {
      setEnCoursRejet((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  }

  return (
    <>
      <DemoBanner />
      <Navbar role="admin" nom="Philippe" />
      <main className="flex-1 max-w-3xl w-full mx-auto px-4 py-8 space-y-6">
        <h2 className="font-semibold">Demandes en attente ({demandes.length})</h2>
        {erreur && <p className="text-sm text-red-600">{erreur}</p>}
        <div className="space-y-3">
          {demandes.map((d) => (
            <div key={d.id} className="rounded-xl border border-slate-200 dark:border-slate-700 p-4 flex items-center justify-between gap-4">
              <div>
                <p className="font-medium">{d.type_compte === "soutien" ? "Nouveau compte Soutien" : d.type ? d.type : "Nouveau compte Parent"}</p>
                <p className="text-sm text-slate-500">{d.nom} · {d.email}</p>
                <p className="text-xs text-slate-400">Reçue le {(d.date_demande || d.date || "").toString().slice(0, 10)}</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => valider(d.id)}
                  disabled={enCoursValidation.has(d.id) || enCoursRejet.has(d.id)}
                  className="rounded-lg px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                  style={{ background: "#4169E1" }}
                >
                  {enCoursValidation.has(d.id) ? "Validation..." : "Valider"}
                </button>
                <button
                  onClick={() => rejeter(d.id)}
                  disabled={enCoursValidation.has(d.id) || enCoursRejet.has(d.id)}
                  className="rounded-lg px-4 py-2 text-sm font-medium border border-slate-300 dark:border-slate-600 disabled:opacity-50"
                >
                  {enCoursRejet.has(d.id) ? "Rejet..." : "Rejeter"}
                </button>
              </div>
            </div>
          ))}
          {demandes.length === 0 && <p className="text-slate-500 text-sm">Aucune demande en attente.</p>}
        </div>
      </main>
    </>
  );
}
