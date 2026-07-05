"use client";

import { useState } from "react";
import Navbar from "@/components/Navbar";
import DemoBanner from "@/components/DemoBanner";
import DevoirCard from "@/components/DevoirCard";
import AuthGuard from "@/components/AuthGuard";
import { devoirsEnfant } from "@/lib/sampleData";

export default function DashboardEnfant() {
  return (
    <AuthGuard role="enfant">
      <Contenu />
    </AuthGuard>
  );
}

function Contenu() {
  const [devoirs, setDevoirs] = useState(devoirsEnfant);

  function toggle(id) {
    setDevoirs((prev) => prev.map((d) => d.id === id ? { ...d, statut: d.statut === "fait" ? "a_faire" : "fait" } : d));
  }

  const aFaire = devoirs.filter((d) => d.statut === "a_faire");
  const faits = devoirs.filter((d) => d.statut === "fait");

  return (
    <>
      <DemoBanner />
      <Navbar role="enfant" nom="Rose" />
      <main className="flex-1 max-w-3xl w-full mx-auto px-4 py-8 space-y-8">
        <section>
          <h2 className="font-semibold mb-3">À faire ({aFaire.length})</h2>
          <div className="space-y-3">
            {aFaire.map((d) => <DevoirCard key={d.id} devoir={d} onToggle={toggle} />)}
            {aFaire.length === 0 && <p className="text-slate-500 text-sm">Rien à faire pour le moment, bravo !</p>}
          </div>
        </section>
        <section>
          <h2 className="font-semibold mb-3">Déjà fait ({faits.length})</h2>
          <div className="space-y-3">
            {faits.map((d) => <DevoirCard key={d.id} devoir={d} onToggle={toggle} />)}
          </div>
        </section>
      </main>
    </>
  );
}
