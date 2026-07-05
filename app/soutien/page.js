"use client";

import { useEffect, useState } from "react";
import Navbar from "@/components/Navbar";
import DemoBanner from "@/components/DemoBanner";
import DevoirCard from "@/components/DevoirCard";
import AuthGuard from "@/components/AuthGuard";
import { supabase, supabaseConfigured } from "@/lib/supabaseClient";
import { devoirsEnfant } from "@/lib/sampleData";

// En démonstration, Viviane est rattachée à Rose pour 4 matières (voir
// supabase/seed.sql et l'Addendum au DCF). Une fois Supabase connecté, la
// liste réelle des matières confiées au soutien connecté est utilisée à la
// place — un compte soutien ne voit jamais que les matières qui lui ont été
// confiées par les parents.
const MATIERES_DEMO = ["Allemand", "Français", "Anglais", "Histoire-Géographie"];

export default function DashboardSoutien() {
  return (
    <AuthGuard role="soutien">
      <Contenu />
    </AuthGuard>
  );
}

function Contenu() {
  const [matieresSuivies, setMatieresSuivies] = useState(MATIERES_DEMO);

  useEffect(() => {
    if (!supabaseConfigured) return;
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const { data } = await supabase
        .from("liens_soutien")
        .select("matiere:matieres!matiere_id (nom)")
        .eq("soutien_id", session.user.id);
      const noms = [...new Set((data || []).map((l) => l.matiere?.nom).filter(Boolean))];
      if (noms.length > 0) setMatieresSuivies(noms);
    })();
  }, []);

  const devoirsVisibles = devoirsEnfant.filter((d) => matieresSuivies.includes(d.matiere));

  return (
    <>
      <DemoBanner />
      <Navbar role="soutien" nom="Viviane" />
      <main className="flex-1 max-w-3xl w-full mx-auto px-4 py-8 space-y-6">
        <p className="text-sm text-slate-500">Matières suivies : {matieresSuivies.join(", ")} — Rose</p>
        <section>
          <h2 className="font-semibold mb-3">Devoirs</h2>
          <div className="space-y-3">
            {devoirsVisibles.map((d) => <DevoirCard key={d.id} devoir={d} />)}
            {devoirsVisibles.length === 0 && <p className="text-slate-500 text-sm">Aucun devoir pour ces matières.</p>}
          </div>
        </section>
      </main>
    </>
  );
}
