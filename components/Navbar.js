"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { supabase, supabaseConfigured } from "@/lib/supabaseClient";

const TABLEAUX = [
  { role: "admin", chemin: "/admin", label: "Administrateur" },
  { role: "parent", chemin: "/parent", label: "Parent" },
  { role: "enfant", chemin: "/enfant", label: "Enfant" },
  { role: "soutien", chemin: "/soutien", label: "Soutien" },
];

export default function Navbar({ role, nom }) {
  const router = useRouter();
  const pathname = usePathname();
  const roleLabel = { parent: "Parent", enfant: "Enfant", soutien: "Soutien", admin: "Administrateur" }[role] || "";
  const [estAdmin, setEstAdmin] = useState(false);

  useEffect(() => {
    if (!supabaseConfigured) return;
    let annule = false;
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const { data: compte } = await supabase.from("comptes").select("role").eq("id", session.user.id).single();
      if (!annule && compte?.role === "admin") setEstAdmin(true);
    })();
    return () => { annule = true; };
  }, []);

  async function deconnexion() {
    if (supabaseConfigured) {
      await supabase.auth.signOut();
    }
    router.replace("/login");
  }

  return (
    <header className="border-b border-slate-200 dark:border-slate-700">
      <div className="max-w-4xl mx-auto flex items-center justify-between px-4 py-3 gap-4 flex-wrap">
        <Link href="/" className="font-semibold text-lg" style={{ color: "#2E75B6" }}>
          Application de révision
        </Link>
        <div className="flex items-center gap-3 flex-wrap">
          {estAdmin && (
            <nav className="flex items-center gap-1 text-sm">
              {TABLEAUX.map((t) => (
                <Link
                  key={t.role}
                  href={t.chemin}
                  className={`px-2.5 py-1 rounded-lg ${pathname === t.chemin ? "font-medium" : "text-slate-500 dark:text-slate-400"}`}
                  style={pathname === t.chemin ? { background: "#91CAFF" } : {}}
                >
                  {t.label}
                </Link>
              ))}
            </nav>
          )}
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
