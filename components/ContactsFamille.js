"use client";

import { useEffect, useState } from "react";
import { chargerMembresFamille } from "@/lib/messagesSupabase";

const LABEL_ROLE = { parent: "Parent", enfant: "Enfant", soutien: "Soutien", admin: "Administrateur" };

// Icônes pour appeler / envoyer un SMS aux autres membres de la famille
// (l'enfant, son ou ses parents, son ou ses soutiens), affichées en haut de
// chaque tableau de bord. Seuls les membres dont le téléphone a été
// renseigné par l'administrateur (page Comptes) apparaissent.
export default function ContactsFamille({ enfantId, compteId }) {
const [membres, setMembres] = useState([]);

useEffect(() => {
if (!enfantId || !compteId) return;
chargerMembresFamille(enfantId, compteId).then(setMembres).catch(() => setMembres([]));
}, [enfantId, compteId]);

const contacts = membres.filter((m) => m.telephone);
if (contacts.length === 0) return null;

return (
<div className="flex flex-wrap items-center gap-2 text-xs">
<span className="text-slate-400">Contacter :</span>
{contacts.map((m) => (
<span
key={m.id}
className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 dark:border-slate-700 pl-2.5 pr-1.5 py-1"
>
<span className="text-slate-600 dark:text-slate-300">
{m.nom}
{LABEL_ROLE[m.role] ? ` (${LABEL_ROLE[m.role]})` : ""}
</span>
<a href={`tel:${m.telephone}`} title={`Appeler ${m.nom}`} className="px-0.5">📞</a>
<a href={`sms:${m.telephone}`} title={`SMS à ${m.nom}`} className="px-0.5">💬</a>
</span>
))}
</div>
);
}
