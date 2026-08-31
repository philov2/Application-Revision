"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { supabase, supabaseConfigured } from "@/lib/supabaseClient";
import ContactsFamille from "@/components/ContactsFamille";
import ActivateNotifications from "@/components/ActivateNotifications";
import ThemeToggle from "@/components/ThemeToggle";

const TABLEAUX = [
  { role: "admin", chemin: "/admin", label: "Administrateur" },
  { role: "parent", chemin: "/parent", label: "Parent" },
  { role: "enfant", chemin: "/enfant", label: "Enfant" },
  { role: "soutien", chemin: "/soutien", label: "Soutien" },
];

export default function Navbar({ role, nom, enfantId, compteId }) {
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
    <header
      className="sticky top-0 z-20 bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm border-b"
      style={{ borderColor: "var(--bordure-recap)" }}
    >
      <div className="max-w-4xl mx-auto flex items-center justify-between px-4 py-3 gap-4 flex-wrap">
        <Link href="/" className="flex items-center gap-2.5">
          <span
            className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: "var(--azur)" }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 5.5c2.5-1 5.5-1 8 0v13c-2.5-1-5.5-1-8 0z"/>
              <path d="M20 5.5c-2.5-1-5.5-1-8 0v13c2.5-1 5.5-1 8 0z"/>
            </svg>
          </span>
          <span className="font-display font-semibold text-lg tracking-tight text-[#FFC0CB]">
            Révision
          </span>
        </Link>
        <div className="flex items-center gap-3 flex-wrap">
          {estAdmin && (
            <nav className="flex items-center gap-1 text-sm">
              {TABLEAUX.map((t) => (
                <Link
                  key={t.role}
                  href={t.chemin}
                  className={`px-3 py-1 rounded-full ${pathname === t.chemin ? "font-medium text-white" : "text-slate-500 dark:text-slate-400"}`}
                  style={pathname === t.chemin ? { background: "var(--azur)" } : {}}
                >
                  {t.label}
                </Link>
              ))}
              <Link
                href="/admin/comptes"
                className={`px-3 py-1 rounded-full ${pathname === "/admin/comptes" ? "font-medium text-white" : "text-slate-500 dark:text-slate-400"}`}
                style={pathname === "/admin/comptes" ? { background: "var(--azur)" } : {}}
              >
                Comptes
              </Link>
            </nav>
          )}
          <span className="text-sm text-slate-500 dark:text-slate-400">
            {nom ? `${nom} · ${roleLabel}` : roleLabel}
          </span>
          {supabaseConfigured && <ActivateNotifications />}
          <ThemeToggle />
          {supabaseConfigured && (
            <button
              onClick={deconnexion}
              className="text-sm font-medium rounded-full px-3 py-1.5 border border-slate-300 dark:border-slate-600"
            >
              Déconnexion
            </button>
          )}
        </div>
      </div>
      {enfantId && compteId && (
        <div className="max-w-4xl mx-auto px-4 pb-3">
          <ContactsFamille enfantId={enfantId} compteId={compteId} />
        </div>
      )}
    </header>
  );
}
