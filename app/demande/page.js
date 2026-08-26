"use client";

import { useState } from "react";
import Link from "next/link";
import { supabase, supabaseConfigured } from "@/lib/supabaseClient";
import DemoBanner from "@/components/DemoBanner";

export default function DemandeCompte() {
  const [envoye, setEnvoye] = useState(false);
  const [erreur, setErreur] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setErreur("");
    const form = new FormData(e.target);
    if (!supabaseConfigured) {
      setErreur("Supabase n'est pas encore connecté (voir README.md) : la demande ne peut pas être enregistrée pour le moment.");
      return;
    }
    const { error } = await supabase.from("demandes_comptes").insert({
      type_compte: "parent",
      nom: form.get("nom"),
      email: form.get("email"),
      telephone: form.get("telephone"),
    });
    if (error) setErreur(error.message);
    else setEnvoye(true);
  }

  return (
    <>
      <DemoBanner />
      <main className="flex-1 flex items-center justify-center px-4">
        <div className="max-w-sm w-full py-16">
          {/* Bascule bien visible entre "déjà inscrit" et "nouvel utilisateur" */}
          {/* (retour de Phil : les liens en petits caractères en bas de page passaient inaperçus) */}
          <div className="flex rounded-lg border border-slate-300 dark:border-slate-600 overflow-hidden text-sm font-medium mb-4">
            <Link
              href="/login"
              className="flex-1 text-center py-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              Déjà inscrit
            </Link>
            <span className="flex-1 text-center py-2 text-white" style={{ background: "#4169E1" }}>
              Nouvel utilisateur
            </span>
          </div>
          <h1 className="text-xl font-semibold mb-4" style={{ color: "#4169E1" }}>Demande de création de compte</h1>
          {envoye ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Votre demande a été envoyée à l&apos;administrateur. Vous recevrez un email d&apos;invitation dès qu&apos;elle sera validée.
            </p>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm mb-1">Nom</label>
                <input name="nom" required className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-transparent px-3 py-2" />
              </div>
              <div>
                <label className="block text-sm mb-1">Adresse email</label>
                <input name="email" type="email" required className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-transparent px-3 py-2" />
              </div>
              <div>
                <label className="block text-sm mb-1">Numéro de téléphone</label>
                <input name="telephone" type="tel" required placeholder="ex. 621 234 567" className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-transparent px-3 py-2" />
              </div>
              {erreur && <p className="text-sm text-red-600">{erreur}</p>}
              <button type="submit" className="w-full rounded-lg py-2 font-medium text-white" style={{ background: "#4169E1" }}>
                Envoyer la demande
              </button>
            </form>
          )}
        </div>
      </main>
    </>
  );
}
