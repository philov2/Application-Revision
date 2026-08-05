"use client";

import { useEffect, useState } from "react";
import Navbar from "@/components/Navbar";
import DemoBanner from "@/components/DemoBanner";
import DevoirCard from "@/components/DevoirCard";
import AuthGuard from "@/components/AuthGuard";
import MessagerieFamille from "@/components/MessagerieFamille";
import ContactsFamille from "@/components/ContactsFamille";
import { devoirsEnfant } from "@/lib/sampleData";
import StatsDevoirs from "@/components/StatsDevoirs";
import { filtrerDevoirsFaitsRecents, filtrerDevoirsEnAttenteCorrection } from "@/lib/devoirsStats";

import { supabase, supabaseConfigured } from "@/lib/supabaseClient";
import { chargerDevoirs, basculerStatutDevoir } from "@/lib/devoirsSupabase";
import { compterNonLus } from "@/lib/messagesSupabase";
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
const [compteId, setCompteId] = useState(null);
const [onglet, setOnglet] = useState("devoirs"); // "devoirs" | "messages"
const [nonLus, setNonLus] = useState(0);

async function recharger(id) {
const liste = await chargerDevoirs(id);
setDevoirs(liste);
}

useEffect(() => {
if (!supabaseConfigured) return;
(async () => {
const { data: { session } } = await supabase.auth.getSession();
if (!session) return;
setCompteId(session.user.id);
const { data: compte } = await supabase.from("comptes").select("nom, role").eq("id", session.user.id).single();

if (compte?.role === "admin") {
const { data: enfants } = await supabase.from("comptes").select("id, nom").eq("role", "enfant").limit(1);
const enfant = enfants && enfants[0];
if (enfant) {
setEnfantId(enfant.id);
setNomEnfant(enfant.nom);
await recharger(enfant.id);
}
return;
}

setEnfantId(session.user.id);
if (compte?.nom) setNomEnfant(compte.nom);
await recharger(session.user.id);
})();
}, []);

useEffect(() => {
if (!supabaseConfigured || !enfantId || !compteId) {
setNonLus(0);
return;
}
let annule = false;
async function rafraichirNonLus() {
try {
const n = await compterNonLus(enfantId, compteId);
if (!annule) setNonLus(n);
} catch {
// ignore
}
}
rafraichirNonLus();
const intervalle = setInterval(rafraichirNonLus, 15000);
return () => {
annule = true;
clearInterval(intervalle);
};
}, [enfantId, compteId, onglet]);

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
const enAttenteCorrection = filtrerDevoirsEnAttenteCorrection(devoirs);
const faits = filtrerDevoirsFaitsRecents(devoirs);
return (
<>
<DemoBanner />
<Navbar role="enfant" nom={nomEnfant} />
<main className="flex-1 max-w-3xl w-full mx-auto px-4 py-8 space-y-8">
{enfantId && compteId && <ContactsFamille enfantId={enfantId} compteId={compteId} />}
<div className="flex gap-2 border-b border-slate-200 dark:border-slate-700">
<button
onClick={() => setOnglet("devoirs")}
className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${onglet === "devoirs" ? "border-slate-900 dark:border-white" : "border-transparent text-slate-500"}`}
>
Mes devoirs
</button>
<button
onClick={() => setOnglet("messages")}
className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px flex items-center gap-1.5 ${onglet === "messages" ? "border-slate-900 dark:border-white" : "border-transparent text-slate-500"}`}
>
Messages
{nonLus > 0 && (
<span className="inline-flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold h-4 min-w-4 px-1">
{nonLus}
</span>
)}
</button>
</div>

{onglet === "devoirs" && (
<>
<StatsDevoirs devoirs={devoirs} />
<section>
<h2 className="font-semibold mb-3">À faire ({aFaire.length})</h2>
<div className="space-y-3">
{aFaire.map((d) => <DevoirCard key={d.id} devoir={d} onToggle={toggle} enfantId={enfantId} onChange={() => recharger(enfantId)} />)}
{aFaire.length === 0 && <p className="text-slate-500 text-sm">Rien à faire pour le moment, bravo !</p>}
</div>
</section>
{enAttenteCorrection.length > 0 && (
<section>
<h2 className="font-semibold mb-3">Fait - en attente de correction ({enAttenteCorrection.length})</h2>
<div className="space-y-3">
{enAttenteCorrection.map((d) => <DevoirCard key={d.id} devoir={d} onToggle={toggle} enfantId={enfantId} onChange={() => recharger(enfantId)} />)}
</div>
</section>
)}
<section>
<h2 className="font-semibold mb-3 flex items-center gap-1.5 text-green-700 dark:text-green-400">
<span aria-hidden="true">✓</span> Déjà fait ({faits.length})
</h2>
<div className="space-y-3">
{faits.map((d) => <DevoirCard key={d.id} devoir={d} onToggle={toggle} enfantId={enfantId} onChange={() => recharger(enfantId)} />)}
</div>
</section>
</>
)}

{onglet === "messages" && enfantId && compteId && (
<section>
<MessagerieFamille enfantId={enfantId} compteId={compteId} titre="Messages" />
</section>
)}
</main>
</>
);
}
