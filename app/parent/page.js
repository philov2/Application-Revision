"use client";

import { useEffect, useState } from "react";
import Navbar from "@/components/Navbar";
import DemoBanner from "@/components/DemoBanner";
import DevoirCard from "@/components/DevoirCard";
import AuthGuard from "@/components/AuthGuard";
import { supabase, supabaseConfigured } from "@/lib/supabaseClient";
import { authFetch } from "@/lib/authFetch";
import { enfants as enfantsDemo, devoirsEnfant, matieres as matieresDemo } from "@/lib/sampleData";

export default function DashboardParent() {
  return (
    <AuthGuard role="parent">
      <Contenu />
    </AuthGuard>
  );
}

function Contenu() {
  const [enfants, setEnfants] = useState(enfantsDemo);
  const [matieres, setMatieres] = useState(matieresDemo);
  const [enfantSelectionne, setEnfantSelectionne] = useState(enfantsDemo[0]?.id);
  const [formEnfantOuvert, setFormEnfantOuvert] = useState(false);
  const [formSoutienOuvert, setFormSoutienOuvert] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!supabaseConfigured) return;
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data: liens } = await supabase
        .from("liens_parent_enfant")
        .select("enfant_id, niveau_scolaire, enfant:comptes!enfant_id (id, nom)")
        .eq("parent_id", session.user.id);

      const listeEnfants = (liens || []).map((l) => ({
        id: l.enfant?.id,
        nom: l.enfant?.nom,
        niveau: l.niveau_scolaire,
        devoirsAFaire: 0,
        devoirsFaits: 0,
      }));
      if (listeEnfants.length > 0) {
        setEnfants(listeEnfants);
        setEnfantSelectionne(listeEnfants[0].id);
      }

      const { data: mats } = await supabase.from("matieres").select("id, nom, couleur");
      if (mats) setMatieres(mats);
    })();
  }, []);

  const enfant = enfants.find((e) => e.id === enfantSelectionne) || enfants[0];

  async function ajouterEnfant(e) {
    e.preventDefault();
    setMessage("");
    const form = new FormData(e.target);
    try {
      if (supabaseConfigured) {
        await authFetch("/api/enfants", {
          method: "POST",
          body: JSON.stringify({
            nom: form.get("nom"),
            email: form.get("email"),
            niveau_scolaire: form.get("niveau_scolaire"),
          }),
        });
        setMessage("Compte enfant créé — un email d'invitation a été envoyé.");
      } else {
        setMessage("Mode démonstration : aucune donnée réelle n'est créée (connectez Supabase, voir README).");
      }
      setFormEnfantOuvert(false);
      e.target.reset();
    } catch (err) {
      setMessage(err.message);
    }
  }

  async function demanderSoutien(e) {
    e.preventDefault();
    setMessage("");
    const form = new FormData(e.target);
    const matieresChoisies = form.getAll("matieres");
    try {
      if (supabaseConfigured) {
        const { data: { session } } = await supabase.auth.getSession();
        const { error } = await supabase.from("demandes_comptes").insert({
          type_compte: "soutien",
          nom: form.get("nom"),
          email: form.get("email"),
          matieres: matieresChoisies,
          demandeur_id: session.user.id,
        });
        if (error) throw error;
        setMessage("Demande envoyée à l'administrateur pour validation.");
      } else {
        setMessage("Mode démonstration : aucune donnée réelle n'est créée (connectez Supabase, voir README).");
      }
      setFormSoutienOuvert(false);
      e.target.reset();
    } catch (err) {
      setMessage(err.message);
    }
  }

  return (
    <>
      <DemoBanner />
      <Navbar role="parent" nom="JC / Virginie" />
      <main className="flex-1 max-w-3xl w-full mx-auto px-4 py-8 space-y-6">
        {message && <p className="text-sm rounded-lg bg-slate-100 dark:bg-slate-800 px-3 py-2">{message}</p>}

        <div className="flex gap-2 flex-wrap">
          {enfants.map((e) => (
            <button
              key={e.id}
              onClick={() => setEnfantSelectionne(e.id)}
              className={`px-4 py-2 rounded-lg text-sm font-medium border ${e.id === enfantSelectionne ? "border-transparent" : "border-slate-300 dark:border-slate-600"}`}
              style={e.id === enfantSelectionne ? { background: "#91CAFF" } : {}}
            >
              {e.nom} · {e.niveau}
            </button>
          ))}
          <button onClick={() => setFormEnfantOuvert((v) => !v)} className="px-4 py-2 rounded-lg text-sm font-medium border border-dashed border-slate-400">
            + Ajouter un enfant
          </button>
        </div>

        {formEnfantOuvert && (
          <form onSubmit={ajouterEnfant} className="rounded-xl border border-slate-200 dark:border-slate-700 p-4 space-y-3">
            <p className="font-medium text-sm">Nouveau compte enfant</p>
            <input name="nom" required placeholder="Prénom" className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-transparent px-3 py-2" />
            <input name="email" type="email" required placeholder="Adresse email" className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-transparent px-3 py-2" />
            <input name="niveau_scolaire" required placeholder="Niveau scolaire (ex. 4ème)" className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-transparent px-3 py-2" />
            <button type="submit" className="rounded-lg px-4 py-2 text-sm font-medium" style={{ background: "#91CAFF" }}>Créer le compte</button>
          </form>
        )}

        {enfant && (
          <>
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-4 text-center">
                <p className="text-2xl font-semibold">{enfant.devoirsAFaire}</p>
                <p className="text-xs text-slate-500">devoirs à faire</p>
              </div>
              <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-4 text-center">
                <p className="text-2xl font-semibold">{enfant.devoirsFaits}</p>
                <p className="text-xs text-slate-500">devoirs réalisés</p>
              </div>
            </div>

            <section>
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-semibold">Devoirs de {enfant.nom}</h2>
                <button className="text-sm font-medium rounded-lg px-3 py-1.5" style={{ background: "#91CAFF" }}>
                  + Nouveau devoir
                </button>
              </div>
              <div className="space-y-3">
                {devoirsEnfant.map((d) => <DevoirCard key={d.id} devoir={d} />)}
              </div>
            </section>
          </>
        )}

        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold">Soutiens</h2>
            <button onClick={() => setFormSoutienOuvert((v) => !v)} className="text-sm font-medium rounded-lg px-3 py-1.5 border border-dashed border-slate-400">
              + Demander un compte soutien
            </button>
          </div>
          {formSoutienOuvert && (
            <form onSubmit={demanderSoutien} className="rounded-xl border border-slate-200 dark:border-slate-700 p-4 space-y-3">
              <input name="nom" required placeholder="Nom du soutien" className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-transparent px-3 py-2" />
              <input name="email" type="email" required placeholder="Adresse email" className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-transparent px-3 py-2" />
              <div>
                <p className="text-sm mb-1">Matières concernées</p>
                <div className="grid grid-cols-2 gap-1">
                  {matieres.map((m) => (
                    <label key={m.id} className="flex items-center gap-2 text-sm">
                      <input type="checkbox" name="matieres" value={m.id} />
                      {m.nom}
                    </label>
                  ))}
                </div>
              </div>
              <button type="submit" className="rounded-lg px-4 py-2 text-sm font-medium" style={{ background: "#91CAFF" }}>
                Envoyer la demande à l&apos;administrateur
              </button>
            </form>
          )}
        </section>
      </main>
    </>
  );
}
