"use client";

import { useEffect, useState } from "react";
import Navbar from "@/components/Navbar";
import DemoBanner from "@/components/DemoBanner";
import DevoirCard from "@/components/DevoirCard";
import AuthGuard from "@/components/AuthGuard";
import { devoirsEnfant } from "@/lib/sampleData";
import StatsDevoirs from "@/components/StatsDevoirs";
import { filtrerDevoirsFaitsRecents } from "@/lib/devoirsStats";

import { supabase, supabaseConfigured } from "@/lib/supabaseClient";
import { chargerDevoirs, basculerStatutDevoir } from "@/lib/devoirsSupabase";
export default function DashboardEnfant() {
return (
<AuthGuard role="enfant">
<Contenu />
</AuthGuard>
);
}

function Contenu() {
const [devoirs, setDevoirs] = useState(supabaseConfigured ? [] : devoirsEnfant);
const [enfantId, setEnfantId] = useState(null);
const [nomEnfant, setNomEnfant] = useState("Rose");

async function recharger(id) {
const liste = await chargerDevoirs(id);
setDevoirs(liste);
}

useEffect(() => {
if (!supabaseConfigured) return;
(async () => {
const { data: { session } } = await supabase.auth.getSession();
if (!session) return;
setEnfantId(session.user.id);
const { data: compte } = await supabase.from("comptes").select("nom").eq("id", session.user.id).single();
if (compte?.nom) setNomEnfant(compte.nom);
await recharger(session.user.id);
})();
}, []);

async function toggle(id) {
if (supabaseConfigured && enfantId) {
const devoir = devoirs.find((d) => d.id === id);
const nouveauStatut = devoir?.statut === "fait" ? "a_faire" : "fait";
await basculerStatutDevoir(id, nouveauStatut);
await recharger(enfantId);
return;
}
setDevoirs((prev) => prev.map((d) => {
if (d.id !== id) return d;
const nouveauStatut = d.statut === "fait" ? "a_faire" : "fait";
return { ...d, statut: nouveauStatut, date_realisation: nouveauStatut === "fait" ? new Date().toISOString().slice(0, 10) : d.date_realisation };
}));
}

const aFaire = devoirs.filter((d) => d.statut === "a_faire").sort((a, b) => a.echeance.localeCompare(b.echeance));
const faits = filtrerDevoirsFaitsRecents(devoirs);
return (
<>
<DemoBanner />
<Navbar role="enfant" nom={nomEnfant} />
<main className="flex-1 max-w-3xl w-full mx-auto px-4 py-8 space-y-8">
<StatsDevoirs devoirs={devoirs} />
<section>
<h2 className="font-semibold mb-3">À faire ({aFaire.length})</h2>
<div className="space-y-3">
{aFaire.map((d) => <DevoirCard key={d.id} devoir={d} onToggle={toggle} enfantId={enfantId} onChange={() => recharger(enfantId)} />)}
{aFaire.length === 0 && <p className="text-slate-500 text-sm">Rien à faire pour le moment, bravo !</p>}
</div>
</section>
<section>
<h2 className="font-semibold mb-3">Déjà fait ({faits.length})</h2>
<div className="space-y-3">
{faits.map((d) => <DevoirCard key={d.id} devoir={d} onToggle={toggle} enfantId={enfantId} onChange={() => recharger(enfantId)} />)}
</div>
</section>
</main>
</>
);
}
