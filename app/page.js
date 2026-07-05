"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import DemoBanner from "@/components/DemoBanner";
import { supabase, supabaseConfigured } from "@/lib/supabaseClient";
import { CHEMIN_PAR_ROLE } from "@/lib/roles";

export default function Home() {
  const [verification, setVerification] = useState(supabaseConfigured);

  useEffect(() => {
    if (!supabaseConfigured) return;
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setVerification(false);
        return;
      }
      const { data: compte } = await supabase.from("comptes").select("role").eq("id", session.user.id).single();
      if (compte) window.location.href = CHEMIN_PAR_ROLE[compte.role] || "/login";
      else setVerification(false);
    })();
  }, []);

  if (verification) {
    return (
      <main className="flex-1 flex items-center justify-center">
        <p className="text-slate-500 text-sm">Vérification de la connexion...</p>
      </main>
    );
  }

  return (
    <>
      <DemoBanner />
      <main className="flex-1 flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center space-y-6 py-16">
          <h1 className="text-2xl font-semibold" style={{ color: "#2E75B6" }}>
            Application de révision
          </h1>
          {supabaseConfigured ? (
            <>
              <p className="text-slate-500 dark:text-slate-400">
                Connectez-vous, ou faites une demande de compte si vous n&apos;en avez pas encore.
              </p>
              <div className="grid grid-cols-1 gap-3">
                <Link href="/login" className="rounded-lg py-3 font-medium" style={{ background: "#91CAFF" }}>
                  Se connecter
                </Link>
                <Link href="/demande" className="rounded-lg py-3 font-medium border border-slate-300 dark:border-slate-600">
                  Demander un compte
                </Link>
              </div>
            </>
          ) : (
            <>
              <p className="text-slate-500 dark:text-slate-400">
                Aperçu de l&apos;interface — MVP en construction. Choisissez un profil pour prévisualiser son tableau de bord (données d&apos;exemple).
              </p>
              <div className="grid grid-cols-1 gap-3">
                <Link href="/parent" className="rounded-lg py-3 font-medium" style={{ background: "#91CAFF" }}>
                  Tableau de bord Parent
                </Link>
                <Link href="/enfant" className="rounded-lg py-3 font-medium" style={{ background: "#F7CEE6" }}>
                  Tableau de bord Enfant
                </Link>
                <Link href="/soutien" className="rounded-lg py-3 font-medium border border-slate-300 dark:border-slate-600">
                  Tableau de bord Soutien
                </Link>
                <Link href="/admin" className="rounded-lg py-3 font-medium border border-slate-300 dark:border-slate-600">
                  Espace Administrateur
                </Link>
                <Link href="/login" className="text-sm text-slate-500 underline mt-2">
                  Page de connexion
                </Link>
              </div>
            </>
          )}
        </div>
      </main>
    </>
  );
}
