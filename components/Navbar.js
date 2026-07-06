"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase, supabaseConfigured } from "@/lib/supabaseClient";

export default function Navbar({ role, nom }) {
  const router = useRouter();
  const roleLabel = { parent: "Parent", enfant: "Enfant", soutien: "Soutien", admin: "Administrateur" }[role] || "";

  async function deconnexion() {
    if (supabaseConfigured) {
      await supabase.auth.signOut();
    }
    router.replace("/login");
  }

  return (
    <header className="border-b border-slate-200 dark:border-slate-700">
      <div className="max-w-4xl mx-auto flex items-center justify-between px-4 py-3 gap-4">
        <Link href="/" className="font-semibold text-lg" style={{ color: "#2E75B6" }}>
          Application de révision
        </Link>
        <div className="flex items-center gap-3">
          <span className="text-sm text-slate-500 dark:text-slate-400">
            {nom ? `${nom} · ${roleLabel}` : roleLabel}
          </span>
          {supabaseConfigured && (
            <button
              onClick={deconnexion}
              className="text-sm font-medium rounded-lg px-3 py-1.5 border border-slate-300 dark:border-slate-600"
            >
              Déconnexion
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
