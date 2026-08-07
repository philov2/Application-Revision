"use client";

import { useEffect, useRef, useState } from "react";
import { chargerMessages, envoyerMessage, marquerCommeLu, chargerMembresFamille } from "@/lib/messagesSupabase";

const LABEL_ROLE = { parent: "Parent", enfant: "Enfant", soutien: "Soutien", admin: "Administrateur" };

function formatHeure(dateIso) {
const date = new Date(dateIso);
const maintenant = new Date();
const memeJour = date.toDateString() === maintenant.toDateString();
const heure = date.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
if (memeJour) return heure;
const jour = date.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" });
return `${jour} ${heure}`;
}

export default function MessagerieFamille({ enfantId, compteId, titre }) {
const [messages, setMessages] = useState([]);
const [membres, setMembres] = useState([]);
const [destinataireId, setDestinataireId] = useState("");
const [texte, setTexte] = useState("");
const [envoi, setEnvoi] = useState(false);
const [erreur, setErreur] = useState("");
const [chargement, setChargement] = useState(true);
const finRef = useRef(null);

async function recharger() {
if (!enfantId) return;
try {
const liste = await chargerMessages(enfantId);
setMessages(liste);
} catch (err) {
setErreur(err.message);
} finally {
setChargement(false);
}
}

useEffect(() => {
if (!enfantId || !compteId) return;
recharger();
marquerCommeLu(enfantId, compteId).catch(() => {});
chargerMembresFamille(enfantId, compteId).then(setMembres).catch(() => setMembres([]));
const intervalle = setInterval(recharger, 10000);
return () => clearInterval(intervalle);
// eslint-disable-next-line react-hooks/exhaustive-deps
}, [enfantId, compteId]);

useEffect(() => {
finRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
}, [messages.length]);

async function envoyer(e) {
e.preventDefault();
const contenu = texte.trim();
if (!contenu || !enfantId || !compteId) return;
setEnvoi(true);
setErreur("");
try {
await envoyerMessage(enfantId, compteId, contenu, destinataireId || null);
setTexte("");
await recharger();
await marquerCommeLu(enfantId, compteId);
} catch (err) {
setErreur(err.message);
} finally {
setEnvoi(false);
}
}

function surTouche(e) {
if (e.key === "Enter" && !e.shiftKey) {
e.preventDefault();
envoyer(e);
}
}

return (
<div className="rounded-xl border border-slate-200 dark:border-slate-700 flex flex-col h-[28rem]">
<div className="px-4 py-3 border-b border-slate-200 dark:border-slate-700">
<h2 className="font-semibold text-sm">{titre || "Messages de la famille"}</h2>
</div>

<div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
{chargement && <p className="text-sm text-slate-400 text-center">Chargement…</p>}
{!chargement && messages.length === 0 && (
<p className="text-sm text-slate-400 text-center">Aucun message pour l&apos;instant. Écrivez le premier !</p>
)}
{messages.map((m) => {
const estMoi = m.auteur_id === compteId;
const nomAuteur = m.auteur?.nom || "?";
const roleAuteur = LABEL_ROLE[m.auteur?.role] || "";
const nomDestinataire = m.destinataire?.nom || null;
return (
<div key={m.id} className={`flex ${estMoi ? "justify-end" : "justify-start"}`}>
<div
className={`max-w-[80%] rounded-2xl px-3.5 py-2 text-sm ${estMoi ? "text-white" : "bg-slate-100 dark:bg-slate-800"}`}
style={estMoi ? { background: "#4169E1" } : undefined}
>
{(!estMoi || nomDestinataire) && (
<p className={`text-xs font-semibold mb-0.5 ${estMoi ? "text-white/80" : "text-slate-500 dark:text-slate-400"}`}>
{!estMoi && (
<>
{nomAuteur}
{roleAuteur ? ` · ${roleAuteur}` : ""}
</>
)}
{nomDestinataire && <span> → {nomDestinataire}</span>}
</p>
)}
<p className="whitespace-pre-wrap break-words">{m.contenu}</p>
<p className={`text-[10px] mt-1 ${estMoi ? "text-white/70" : "text-slate-400"}`}>{formatHeure(m.created_at)}</p>
</div>
</div>
);
})}
<div ref={finRef} />
</div>

{erreur && <p className="text-xs text-red-600 px-4 pb-1">{erreur}</p>}

<form onSubmit={envoyer} className="border-t border-slate-200 dark:border-slate-700 p-3 space-y-2">
{membres.length > 0 && (
<div className="flex items-center gap-2">
<label htmlFor="destinataire-message" className="text-xs text-slate-500 shrink-0">
Pour :
</label>
<select
id="destinataire-message"
value={destinataireId}
onChange={(e) => setDestinataireId(e.target.value)}
className="text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-transparent px-2 py-1 focus:outline-none focus:ring-2 focus:ring-[#4169E1]"
>
<option value="">Tout le monde</option>
{membres.map((m) => (
<option key={m.id} value={m.id}>
{m.nom}{LABEL_ROLE[m.role] ? ` (${LABEL_ROLE[m.role]})` : ""}
</option>
))}
</select>
</div>
)}
<div className="flex items-end gap-2">
<textarea
value={texte}
onChange={(e) => setTexte(e.target.value)}
onKeyDown={surTouche}
rows={1}
placeholder="Écrire un message…"
className="flex-1 resize-none rounded-lg border border-slate-300 dark:border-slate-600 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#4169E1]"
/>
<button
type="submit"
disabled={envoi || !texte.trim()}
className="rounded-lg px-4 py-2 text-sm font-medium text-white disabled:opacity-50 shrink-0"
style={{ background: "#4169E1" }}
>
Envoyer
</button>
</div>
</form>
</div>
);
}
