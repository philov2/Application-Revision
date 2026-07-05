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
    });
    if (error) setErreur(error.message);
    else setEnvoye(true);
  }

  return (
    <>
      <DemoBanner />
      <main className="flex-1 flex items-center justify-center px-4">
        <div className="max-w-sm w-full py-16">
          <h1 className="text-xl font-semibold mb-4" style={{ color: "#2E75B6" }}>Demande de création de compte</h1>
          {envoye ? (
            <p className="text-sm text-slate-500">
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
              {erreur && <p className="text-sm text-red-600">{erreur}</p>}
              <button type="submit" className="w-full rounded-lg py-2 font-medium" style={{ background: "#91CAFF" }}>
                Envoyer la demande
              </button>
            </form>
          )}
          <p className="text-xs text-slate-500 text-center mt-4">
            <Link href="/login" className="underline">Déjà un compte ? Se connecter</Link>
          </p>
        </div>
      </main>
    </>
  );
}
