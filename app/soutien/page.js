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
import { filtrerDevoirsFaitsRecents, filtrerDevoirsEnAttenteCorrection } from "@/lib/devoirsStats";
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
  const [nomEnfant, setNomEnfant] = useState("Rose");
  const [compteId, setCompteId] = useState(null);
  const [devoirs, setDevoirs] = useState(supabaseConfigured ? [] : devoirsEnfant);
  const [nouvelleMatiereOuvert, setNouvelleMatiereOuvert] = useState(false);
  const [nomNouvelleMatiere, setNomNouvelleMatiere] = useState("");
  const [enCoursMatiere, setEnCoursMatiere] = useState(false);
  const [message, setMessage] = useState("");
  const [onglet, setOnglet] = useState("devoirs"); // "devoirs" | "documents"

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
        const { data: enfants } = await supabase.from("comptes").select("id, nom").eq("role", "enfant").limit(1);
        const enfant = enfants && enfants[0];
        if (enfant) {
          setEnfantId(enfant.id);
          setNomEnfant(enfant.nom);
        }
        if (enfant) await recharger(enfant.id);
        return;
      }

      const { data } = await supabase
        .from("liens_soutien")
        .select("enfant_id, matiere:matieres!matiere_id (id, nom, couleur), enfant:comptes!enfant_id (nom)")
        .eq("soutien_id", session.user.id);
      const liens = data || [];
      const noms = [...new Set(liens.map((l) => l.matiere?.nom).filter(Boolean))];
      const mats = liens.map((l) => l.matiere).filter(Boolean);
      if (noms.length > 0) {
        setMatieresSuivies(noms);
        setMatieres(mats);
        setEnfantId(liens[0]?.enfant_id || null);
        if (liens[0]?.enfant?.nom) setNomEnfant(liens[0].enfant.nom);
        if (liens[0]?.enfant_id) await recharger(liens[0].enfant_id);
      }
    })();
  }, []);

  async function recharger(id) {
    const liste = await chargerDevoirs(id);
    setDevoirs(liste);
  }

  async function creerNouvelleMatiere(e) {
    e.preventDefault();
    if (!nomNouvelleMatiere.trim()) return;
    setMessage("");
    setEnCoursMatiere(true);
    try {
      const { data, error } = await supabase.from("matieres").insert({ nom: nomNouvelleMatiere.trim() }).select().single();
      if (error) throw error;
      setNomNouvelleMatiere("");
      setNouvelleMatiereOuvert(false);
      setMessage(`Matière « ${data.nom} » créée. Demandez à un parent de vous y rattacher pour la gérer ici.`);
    } catch (err) {
      setMessage(err.message);
    } finally {
      setEnCoursMatiere(false);
    }
  }

  const devoirsVisibles = devoirs.filter((d) => matieresSuivies.includes(d.matiere));
  const devoirsAFaireTries = devoirsVisibles.filter((d) => d.statut === "a_faire").sort((a, b) => a.echeance.localeCompare(b.echeance));
  const devoirsACorriger = filtrerDevoirsEnAttenteCorrection(devoirsVisibles);
  const devoirsFaits = filtrerDevoirsFaitsRecents(devoirsVisibles);
  return (
    <>
      <DemoBanner />
      <Navbar role="soutien" nom="Viviane" />
      <main className="flex-1 max-w-3xl w-full mx-auto px-4 py-8 space-y-8">
        {message && <p className="text-sm rounded-lg bg-slate-100 dark:bg-slate-800 px-3 py-2">{message}</p>}
        <p className="text-sm text-slate-500">Matières suivies : {matieresSuivies.join(", ")} — {nomEnfant}</p>

        <div className="flex gap-2 border-b border-slate-200 dark:border-slate-700">
          <button
            onClick={() => setOnglet("devoirs")}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${onglet === "devoirs" ? "border-slate-900 dark:border-white" : "border-transparent text-slate-500"}`}
          >
            Devoir de {nomEnfant}
          </button>
          <button
            onClick={() => setOnglet("documents")}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${onglet === "documents" ? "border-slate-900 dark:border-white" : "border-transparent text-slate-500"}`}
          >
            Chapitres et documents
          </button>
        </div>

        {onglet === "devoirs" && (
          <>
            <StatsDevoirs devoirs={devoirsVisibles} />

            {devoirsACorriger.length > 0 && (
              <section>
                <h2 className="font-semibold mb-3">À corriger</h2>
                <div className="space-y-3">
                  {devoirsACorriger.map((d) => <DevoirCard key={d.id} devoir={d} matieres={matieres} compteId={compteId} enfantId={enfantId} onChange={() => recharger(enfantId)} />)}
                </div>
              </section>
            )}

            <section>
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-semibold">Devoirs a faire</h2>
                <FormulaireDevoir enfantId={enfantId} compteId={compteId} matieres={matieres} onCree={() => recharger(enfantId)} />
              </div>
              <div className="space-y-3">
                {devoirsAFaireTries.map((d) => <DevoirCard key={d.id} devoir={d} matieres={matieres} compteId={compteId} enfantId={enfantId} onChange={() => recharger(enfantId)} />)}
                {devoirsAFaireTries.length === 0 && <p className="text-slate-500 text-sm">Aucun devoir pour ces matières.</p>}
              </div>
            </section>

            <section>
              <h2 className="font-semibold mb-3">Devoirs faits</h2>
              <div className="space-y-3">
                {devoirsFaits.map((d) => <DevoirCard key={d.id} devoir={d} matieres={matieres} compteId={compteId} enfantId={enfantId} onChange={() => recharger(enfantId)} />)}
              </div>
            </section>
          </>
        )}

        {onglet === "documents" && enfantId && compteId && (
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold">Chapitres et documents</h2>
              <button onClick={() => setNouvelleMatiereOuvert((v) => !v)} className="text-sm font-medium rounded-lg px-3 py-1.5 border border-dashed border-slate-400">
                + Nouvelle matière
              </button>
            </div>
            {nouvelleMatiereOuvert && (
              <form onSubmit={creerNouvelleMatiere} className="flex items-center gap-2 mb-3">
                <input value={nomNouvelleMatiere} onChange={(e) => setNomNouvelleMatiere(e.target.value)} placeholder="Nom de la nouvelle matière" className="flex-1 rounded-lg border border-slate-300 dark:border-slate-600 bg-transparent px-3 py-2 text-sm" />
                <button type="submit" disabled={enCoursMatiere || !nomNouvelleMatiere.trim()} className="rounded-lg px-3 py-2 text-xs font-medium disabled:opacity-50" style={{ background: "#91CAFF" }}>
                  {enCoursMatiere ? "..." : "Ajouter"}
                </button>
              </form>
            )}
            {matieres.length > 0 ? (
              <div className="space-y-4">
                {matieres.map((m) => (
                  <MatiereDocuments key={m.id} matiere={m} enfantId={enfantId} compteId={compteId} />
                ))}
              </div>
            ) : (
              <p className="text-slate-500 text-xs">Aucune matière ne vous est encore confiée.</p>
            )}
          </section>
        )}
      </main>
    </>
  );
}
