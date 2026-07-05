"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase, supabaseConfigured } from "@/lib/supabaseClient";
import { CHEMIN_PAR_ROLE } from "@/lib/roles";

// Protège une page en fonction du rôle attendu. Tant que Supabase n'est pas
// connecté, le mode démonstration reste actif et la page s'affiche sans
// vérification (voir README.md).
export default function AuthGuard({ role, children }) {
  const router = useRouter();
  const [etat, setEtat] = useState(supabaseConfigured ? "verification" : "demo");

  useEffect(() => {
    if (!supabaseConfigured) return;

    let annule = false;

    async function verifier() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.replace("/login");
        return;
      }

      const { data: compte } = await supabase
        .from("comptes")
        .select("role, statut")
        .eq("id", session.user.id)
        .single();

      if (annule) return;

      if (!compte) {
        setEtat("compte_introuvable");
        return;
      }
      if (compte.statut !== "actif") {
        setEtat("en_attente");
        return;
      }
      if (compte.role !== role) {
        router.replace(CHEMIN_PAR_ROLE[compte.role] || "/login");
        return;
      }
      setEtat("autorise");
    }

    verifier();
    return () => { annule = true; };
  }, [role, router]);

  if (etat === "demo") {
    return <>{children}</>;
  }
  if (etat === "verification") {
    return (
      <main className="flex-1 flex items-center justify-center">
        <p className="text-slate-500 text-sm">Vérification de la connexion...</p>
      </main>
    );
  }
  if (etat === "en_attente") {
    return (
      <main className="flex-1 flex items-center justify-center px-4">
        <p className="text-slate-500 text-sm text-center max-w-sm">
          Votre compte n&apos;est pas encore actif. Si vous venez de vous inscrire, patientez le temps de la validation, ou contactez l&apos;administrateur.
        </p>
      </main>
    );
  }
  if (etat === "compte_introuvable") {
    return (
      <main className="flex-1 flex items-center justify-center px-4">
        <p className="text-slate-500 text-sm text-center max-w-sm">
          Aucun compte associé à cette connexion n&apos;a été trouvé. Contactez l&apos;administrateur.
        </p>
      </main>
    );
  }
  return <>{children}</>;
}
