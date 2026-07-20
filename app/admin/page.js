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
  const [enCours, setEnCours] = useState(new Set());

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
  if (enCours.has(id)) return;
  setErreur("");
  if (!supabaseConfigured) {
    setDemandes((prev) => prev.filter((d) => d.id !== id));
    return;
  }
  setEnCours((prev) => new Set(prev).add(id));
  try {
    await authFetch(`/api/demandes/${id}/valider`, { method: "POST" });
    setDemandes((prev) => prev.filter((d) => d.id !== id));
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
<button
  onClick={() => valider(d.id)}
    disabled={enCours.has(d.id)}
className="rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50"
  style={{ background: "#91CAFF" }}
>
{enCours.has(d.id) ? "Validation..." : "Valider"}
</button>
            </div>
          ))}
          {demandes.length === 0 && <p className="text-slate-500 text-sm">Aucune demande en attente.</p>}
        </div>
      </main>
    </>
  );
}
