"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { creerDevoir } from "@/lib/devoirsSupabase";

const TYPES_DEVOIR = [
  { value: "revision", label: "Reviser le cours" },
  { value: "exercice", label: "Exercices" },
  { value: "test", label: "Test" },
];

const TYPES_DOCUMENT = [
  { value: "cours", label: "Cours" },
  { value: "exercice", label: "Exercice" },
  { value: "flashcard", label: "Flashcard" },
  { value: "corrige", label: "Corrigé" },
];

export default function FormulaireDevoir({ enfantId, compteId, matieres, onCree }) {
  const [ouvert, setOuvert] = useState(false);
  const [matiereId, setMatiereId] = useState("");
  const [chapitres, setChapitres] = useState([]);
  const [chapitreId, setChapitreId] = useState("");
  const [documents, setDocuments] = useState([]);
  const [documentId, setDocumentId] = useState("");
  const [nouveauFichierOuvert, setNouveauFichierOuvert] = useState(false);
  const [envoi, setEnvoi] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!matiereId) {
      setChapitres([]);
      return;
    }
    (async () => {
      const { data } = await supabase.from("chapitres").select("id, nom").eq("matiere_id", matiereId).order("nom");
      setChapitres(data || []);
    })();
  }, [matiereId]);

  useEffect(() => {
    if (!matiereId || !enfantId) {
      setDocuments([]);
      setDocumentId("");
      return;
    }
    (async () => {
      let requete = supabase.from("documents").select("id, nom, type").eq("matiere_id", matiereId).eq("enfant_id", enfantId);
      if (chapitreId) requete = requete.eq("chapitre_id", chapitreId);
      const { data } = await requete.order("created_at", { ascending: false });
      setDocuments(data || []);
      setDocumentId("");
    })();
  }, [matiereId, chapitreId, enfantId]);

  async function soumettre(e) {
    e.preventDefault();
    setMessage("");
    const form = new FormData(e.target);
    setEnvoi(true);
    try {
      let documentIdAEnvoyer = documentId || null;

      const nouveauFichier = form.get("fichier");
      if (nouveauFichierOuvert && nouveauFichier && nouveauFichier.size > 0) {
        const chemin = `${compteId}/${Date.now()}-${nouveauFichier.name}`;
        const { error: uploadError } = await supabase.storage.from("documents").upload(chemin, nouveauFichier);
        if (uploadError) throw uploadError;

        const { data: nouveauDocument, error: insertError } = await supabase
          .from("documents")
          .insert({
            nom: form.get("nom_fichier") || nouveauFichier.name,
            type: form.get("type_fichier") || "cours",
            matiere_id: matiereId,
            chapitre_id: chapitreId || null,
            enfant_id: enfantId,
            cree_par: compteId,
            fichier_url: chemin,
            taille_octets: nouveauFichier.size,
            format: nouveauFichier.type,
          })
          .select()
          .single();
        if (insertError) throw insertError;
        documentIdAEnvoyer = nouveauDocument.id;
      }

      await creerDevoir({
        enfantId,
        matiereId: form.get("matiere_id"),
        chapitreId: form.get("chapitre_id") || null,
        documentId: documentIdAEnvoyer,
        type: form.get("type"),
        dateEcheance: form.get("date_echeance"),
        creePar: compteId,
      });
      e.target.reset();
      setMatiereId("");
      setChapitreId("");
      setDocumentId("");
      setNouveauFichierOuvert(false);
      setOuvert(false);
      onCree?.();
    } catch (err) {
      setMessage(err.message);
    } finally {
      setEnvoi(false);
    }
  }

  return (
    <div>
      <button onClick={() => setOuvert((v) => !v)} className="text-sm font-medium rounded-lg px-3 py-1.5" style={{ background: "#91CAFF" }}>
        + Nouveau devoir
      </button>
      {ouvert && (
        <form onSubmit={soumettre} className="rounded-xl border border-slate-200 dark:border-slate-700 p-4 space-y-3 mt-3">
          {message && <p className="text-sm text-red-600">{message}</p>}
          <select name="matiere_id" required value={matiereId} onChange={(e) => { setMatiereId(e.target.value); setChapitreId(""); }} className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-transparent px-3 py-2 text-sm">
            <option value="">Choisir une matiere</option>
            {matieres.map((m) => <option key={m.id} value={m.id}>{m.nom}</option>)}
          </select>
          <select name="chapitre_id" value={chapitreId} onChange={(e) => setChapitreId(e.target.value)} className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-transparent px-3 py-2 text-sm">
            <option value="">Aucun chapitre</option>
            {chapitres.map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}
          </select>
          <select name="type" required className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-transparent px-3 py-2 text-sm">
            {TYPES_DEVOIR.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
          <input name="date_echeance" type="date" required className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-transparent px-3 py-2 text-sm" />

          {matiereId && (
            <div className="rounded-lg border border-slate-200 dark:border-slate-600 p-3 space-y-2">
              <p className="text-xs font-medium text-slate-500">Document à utiliser (optionnel)</p>
              {documents.length > 0 && !nouveauFichierOuvert && (
                <select value={documentId} onChange={(e) => setDocumentId(e.target.value)} className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-transparent px-3 py-2 text-sm">
                  <option value="">Aucun document</option>
                  {documents.map((d) => <option key={d.id} value={d.id}>{d.nom}</option>)}
                </select>
              )}
              {documents.length === 0 && !nouveauFichierOuvert && (
                <p className="text-xs text-slate-400">Aucun document déjà importé pour cette matière{chapitreId ? " / ce chapitre" : ""}.</p>
              )}
              {!nouveauFichierOuvert ? (
                <button type="button" onClick={() => setNouveauFichierOuvert(true)} className="text-xs font-medium underline text-blue-600">
                  + Importer un nouveau fichier
                </button>
              ) : (
                <div className="space-y-2">
                  <input name="nom_fichier" placeholder="Nom du document (optionnel)" className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-transparent px-3 py-2 text-sm" />
                  <select name="type_fichier" className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-transparent px-3 py-2 text-sm">
                    {TYPES_DOCUMENT.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                  <input name="fichier" type="file" className="w-full text-sm" />
                  <button type="button" onClick={() => setNouveauFichierOuvert(false)} className="text-xs font-medium underline text-slate-500">
                    Annuler l&apos;import
                  </button>
                </div>
              )}
            </div>
          )}

          <button type="submit" disabled={envoi} className="rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50" style={{ background: "#91CAFF" }}>
            {envoi ? "Creation..." : "Creer le devoir"}
          </button>
        </form>
      )}
    </div>
  );
}
