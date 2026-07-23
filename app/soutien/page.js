"use client";

import { useEffect, useState } from "react";
import Navbar from "@/components/Navbar";
import DemoBanner from "@/components/DemoBanner";
import DevoirCard from "@/components/DevoirCard";
import MatiereDocuments from "@/components/MatiereDocuments";
import AuthGuard from "@/components/AuthGuard";
import { supabase, supabaseConfigured } from "@/lib/supabaseClient";
import { devoirsEnfant } from "@/lib/sampleData";

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
    const [matieresSuivies, setMatieresSuivies] = useState(MATIERES_DEMO);
    const [matieres, setMatieres] = useState([]);
    const [enfantId, setEnfantId] = useState(null);
    const [compteId, setCompteId] = useState(null);

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
                         const { data: enfant } = await supabase.from("comptes").select("id").eq("role", "enfant").limit(1).single();
                         if (enfant) setEnfantId(enfant.id);
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
                }
        })();
  }, []);

  const devoirsVisibles = devoirsEnfant.filter((d) => matieresSuivies.includes(d.matiere));

  return (
        <>
          <DemoBanner />
          <Navbar role="soutien" nom="Viviane" />
          <main className="flex-1 max-w-3xl w-full mx-auto px-4 py-8 space-y-8">
            <p className="text-sm text-slate-500">Matières suivies : {matieresSuivies.join(", ")} — Rose</p>
          <section>
              <h2 className="font-semibold mb-3">Devoirs</h2>
            <div className="space-y-3">
  {devoirsVisibles.map((d) => <DevoirCard key={d.id} devoir={d} />)}
{devoirsVisibles.length === 0 && <p className="text-slate-500 text-sm">Aucun devoir pour ces matières.</p>}
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
