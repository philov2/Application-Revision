"use client";

import { useEffect, useState } from "react";
import Navbar from "@/components/Navbar";
import DemoBanner from "@/components/DemoBanner";
import DevoirCard from "@/components/DevoirCard";
import MatiereDocuments from "@/components/MatiereDocuments";
import AuthGuard from "@/components/AuthGuard";
import { supabase, supabaseConfigured } from "@/lib/supabaseClient";
import { devoirsEnfant } from "@/lib/sampleData";
import StatsDevoirs from "@/components/StatsDevoirs";
import { filtrerDevoirsFaitsRecents } from "@/lib/devoirsStats";
import { chargerDevoirs } from "@/lib/devoirsSupabase";
import FormulaireDevoir from "@/components/FormulaireDevoir";

// En démonstration, Viviane est rattachée à Rose pour 4 matières (voir
// supabase/seed.sql et l'Addendum au DCF). Une fois Supabase connecté, la
// liste réelle des matières confiées au soutien connecté est utilisée à la
// place — un compte soutien ne voit jamais que les matières qui lui ont été
// confiées par les parents. L'administrateur voit toutes les matières (voir
// README : il n'a pas de compte soutien séparé).
const MATIERES_DEMO = ["Allemand", "Français", "Anglais", "Histoire-Géographie"];

export default function DashboardSoutien() {
  return (
    <AuthGuard role="soutien">
      <Contenu />
    </AuthGuard>
  );
}

function Contenu() {
  const [matieresSuivies, setMatieresSuivies] = useState(supabaseConfigured ? [] : MATIERES_DEMO);
  const [matieres, setMatieres] = useState([]);
  const [enfantId, setEnfantId] = useState(null);
  const [compteId, setCompteId] = useState(null);
  const [devoirs, setDevoirs] = useState(supabaseConfigured ? [] : devoirsEnfant);
  useEffect(() => {
    if (!supabaseConfigured) return;
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      setCompteId(session.user.id);

      const { data: compte } = await supabase.from("comptes").select("role").eq("id", session.user.id).single();

      if (compte?.role === "admin") {
        const { data: toutesMatieres } = await supabase.from("matieres").select("id, nom, couleur").order("nom");
        if (toutesMatieres) {
          setMatieres(toutesMatieres);
          setMatieresSuivies(toutesMatieres.map((m) => m.nom));
        }
        const { data: enfants } = await supabase.from("comptes").select("id").eq("role", "enfant").limit(1);
        const enfant = enfants && enfants[0];
        if (enfant) setEnfantId(enfant.id);
        if (enfant) await recharger(enfant.id);
        return;
      }

      const { data } = await supabase
        .from("liens_soutien")
        .select("enfant_id, matiere:matieres!matiere_id (id, nom, couleur)")
        .eq("soutien_id", session.user.id);
      const liens = data || [];
      const noms = [...new Set(liens.map((l) => l.matiere?.nom).filter(Boolean))];
      const mats = liens.map((l) => l.matiere).filter(Boolean);
      if (noms.length > 0) {
        setMatieresSuivies(noms);
        setMatieres(mats);
        setEnfantId(liens[0]?.enfant_id || null);
        if (liens[0]?.enfant_id) await recharger(liens[0].enfant_id);
      }
    })();
  }, []);

  async function recharger(id) {
    const liste = await chargerDevoirs(id);
    setDevoirs(liste);
  }

  const devoirsVisibles = devoirs.filter((d) => matieresSuivies.includes(d.matiere));
  const devoirsAFaireTries = devoirsVisibles.filter((d) => d.statut === "a_faire").sort((a, b) => a.echeance.localeCompare(b.echeance));
  const devoirsFaits = filtrerDevoirsFaitsRecents(devoirsVisibles);
  return (
    <>
      <DemoBanner />
      <Navbar role="soutien" nom="Viviane" />
      <main className="flex-1 max-w-3xl w-full mx-auto px-4 py-8 space-y-8">
        <p className="text-sm text-slate-500">Matières suivies : {matieresSuivies.join(", ")} — Rose</p>
        <StatsDevoirs devoirs={devoirsVisibles} />
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold">Devoirs a faire</h2>
            <FormulaireDevoir enfantId={enfantId} compteId={compteId} matieres={matieres} onCree={() => recharger(enfantId)} />
          </div>
          <div className="space-y-3">
            {devoirsAFaireTries.map((d) => <DevoirCard key={d.id} devoir={d} matieres={matieres} compteId={compteId} onChange={() => recharger(enfantId)} />)}
            {devoirsAFaireTries.length === 0 && <p className="text-slate-500 text-sm">Aucun devoir pour ces matières.</p>}
          </div>
        </section>

        <section>
          <h2 className="font-semibold mb-3">Devoirs faits</h2>
          <div className="space-y-3">
            {devoirsFaits.map((d) => <DevoirCard key={d.id} devoir={d} matieres={matieres} compteId={compteId} onChange={() => recharger(enfantId)} />)}
          </div>
        </section>

        {enfantId && compteId && matieres.length > 0 && (
          <section>
            <h2 className="font-semibold mb-3">Chapitres et documents</h2>
            <div className="space-y-4">
              {matieres.map((m) => (
                <MatiereDocuments key={m.id} matiere={m} enfantId={enfantId} compteId={compteId} />
              ))}
            </div>
          </section>
        )}
      </main>
    </>
  );
}
