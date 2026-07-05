"use client";

import { useState } from "react";
import Link from "next/link";
import { supabase, supabaseConfigured } from "@/lib/supabaseClient";
import { CHEMIN_PAR_ROLE } from "@/lib/roles";
import DemoBanner from "@/components/DemoBanner";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (!supabaseConfigured) {
      setError("Le projet Supabase n'est pas encore connecté (voir README.md). Utilisez les liens de démonstration sur la page d'accueil.");
      return;
    }
    setLoading(true);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setLoading(false);
      setError(error.message);
      return;
    }
    const { data: compte } = await supabase
      .from("comptes")
      .select("role, statut")
      .eq("id", data.user.id)
      .single();
    setLoading(false);
    if (!compte) {
      setError("Aucun compte associé à cette connexion. Contactez l'administrateur.");
      return;
    }
    if (compte.statut !== "actif") {
      setError("Ce compte n'est pas encore actif.");
      return;
    }
    window.location.href = CHEMIN_PAR_ROLE[compte.role] || "/";
  }

  return (
    <>
      <DemoBanner />
      <main className="flex-1 flex items-center justify-center px-4">
        <form onSubmit={handleSubmit} className="max-w-sm w-full space-y-4 py-16">
          <h1 className="text-xl font-semibold" style={{ color: "#2E75B6" }}>Connexion</h1>
          <div>
            <label className="block text-sm mb-1">Adresse email</label>
            <input
              type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-transparent px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm mb-1">Mot de passe</label>
            <input
              type="password" required value={password} onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-transparent px-3 py-2"
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit" disabled={loading}
            className="w-full rounded-lg py-2 font-medium"
            style={{ background: "#91CAFF" }}
          >
            {loading ? "Connexion..." : "Se connecter"}
          </button>
          <p className="text-xs text-slate-500 text-center">
            Mot de passe oublié ? Contactez l&apos;administrateur.
          </p>
          <p className="text-xs text-slate-500 text-center">
            <Link href="/demande" className="underline">Pas encore de compte ? Faire une demande</Link>
          </p>
        </form>
      </main>
    </>
  );
}
