"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { authFetch } from "@/lib/authFetch";
import { supprimerTest } from "@/lib/testsSupabase";
import FormulaireTest from "@/components/FormulaireTest";

const TYPES_DOCUMENT = [
  { value: "cours", label: "Cours" },
  { value: "synthese", label: "Synthèse" },
  { value: "exercice", label: "Exercice" },
  { value: "test", label: "Test" },
  { value: "flashcard", label: "Flashcard" },
  { value: "corrige", label: "Corrigé" },
];

export default function MatiereDocuments({ matiere, enfantId, compteId }) {
  const [chapitres, setChapitres] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [testsParChapitre, setTestsParChapitre] = useState({});
  const [nouveauChapitre, setNouveauChapitre] = useState("");
  const [formOuvert, setFormOuvert] = useState(false);
  const [envoi, setEnvoi] = useState(false);
  const [message, setMessage] = useState("");
  const [enCoursSynthese, setEnCoursSynthese] = useState(new Set());
  const [enCoursSuppression, setEnCoursSuppression] = useState(new Set());
  const [enConfirmationSuppression, setEnConfirmationSuppression] = useState(null);
  const [enConfirmationSuppressionTest, setEnConfirmationSuppressionTest] = useState(null);
  const [enCoursSuppressionTest, setEnCoursSuppressionTest] = useState(new Set());

  async function charger() {
    const { data: chaps } = await supabase
      .from("chapitres")
      .select("id, nom")
      .eq("matiere_id", matiere.id)
      .order("nom");
    setChapitres(chaps || []);

    const { data: docs } = await supabase
      .from("documents")
      .select("id, nom, type, fichier_url, chapitre:chapitres(nom)")
      .eq("matiere_id", matiere.id)
      .eq("enfant_id", enfantId)
      .order("created_at", { ascending: false });
    setDocuments(docs || []);

    const chapitreIds = (chaps || []).map((c) => c.id);
    if (chapitreIds.length > 0) {
      const { data: tests } = await supabase.from("tests").select("id, titre, chapitre_id").in("chapitre_id", chapitreIds);
      const parChapitre = {};
      (tests || []).forEach((t) => {
        if (!parChapitre[t.chapitre_id]) parChapitre[t.chapitre_id] = [];
        parChapitre[t.chapitre_id].push(t);
      });
      setTestsParChapitre(parChapitre);
    } else {
      setTestsParChapitre({});
    }
  }

  useEffect(() => {
    if (matiere?.id && enfantId) charger();
  }, [matiere?.id, enfantId]);

  async function ajouterChapitre(e) {
    e.preventDefault();
    if (!nouveauChapitre.trim()) return;
    const { error } = await supabase.from("chapitres").insert({ matiere_id: matiere.id, nom: nouveauChapitre.trim() });
    if (error) {
      setMessage(error.message);
      return;
    }
    setNouveauChapitre("");
    charger();
  }

  async function importerDocument(e) {
    e.preventDefault();
    setMessage("");
    const form = new FormData(e.target);
    const fichier = form.get("fichier");
    if (!fichier || fichier.size === 0) {
      setMessage("Choisissez un fichier.");
      return;
    }
    setEnvoi(true);
    try {
      const chemin = `${compteId}/${Date.now()}-${fichier.name}`;
      const { error: uploadError } = await supabase.storage.from("documents").upload(chemin, fichier);
      if (uploadError) throw uploadError;

      const { error: insertError } = await supabase.from("documents").insert({
        nom: form.get("nom") || fichier.name,
        type: form.get("type"),
        matiere_id: matiere.id,
        chapitre_id: form.get("chapitre_id") || null,
        enfant_id: enfantId,
        cree_par: compteId,
        fichier_url: chemin,
        taille_octets: fichier.size,
        format: fichier.type,
      });
      if (insertError) throw insertError;
      e.target.reset();
      setFormOuvert(false);
      charger();
    } catch (err) {
      setMessage(err.message);
    } finally {
      setEnvoi(false);
    }
  }

  async function genererSynthese(documentId) {
    setEnCoursSynthese((prev) => new Set(prev).add(documentId));
    setMessage("");
    try {
      await authFetch(`/api/documents/${documentId}/synthese`, { method: "POST" });
      charger();
    } catch (err) {
      setMessage(err.message);
    } finally {
      setEnCoursSynthese((prev) => {
        const next = new Set(prev);
        next.delete(documentId);
        return next;
      });
    }
  }

  async function supprimerDocument(documentId) {
    setEnCoursSuppression((prev) => new Set(prev).add(documentId));
    setMessage("");
    try {
      await authFetch(`/api/documents/${documentId}`, { method: "DELETE" });
      setEnConfirmationSuppression(null);
      charger();
    } catch (err) {
      setMessage(err.message);
    } finally {
      setEnCoursSuppression((prev) => {
        const next = new Set(prev);
        next.delete(documentId);
        return next;
      });
    }
  }

  async function retirerTest(testId) {
    setEnCoursSuppressionTest((prev) => new Set(prev).add(testId));
    setMessage("");
    try {
      await supprimerTest(testId);
      setEnConfirmationSuppressionTest(null);
      charger();
    } catch (err) {
      setMessage(err.message);
    } finally {
      setEnCoursSuppressionTest((prev) => {
        const next = new Set(prev);
        next.delete(testId);
        return next;
      });
    }
  }

  async function telecharger(chemin) {
    const { data, error } = await supabase.storage.from("documents").createSignedUrl(chemin, 60);
    if (error) {
      setMessage(error.message);
      return;
    }
    window.open(data.signedUrl, "_blank");
  }

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-4 space-y-4" style={{ borderLeft: `6px solid ${matiere.couleur}` }}>
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">{matiere.nom}</h3>
        <button onClick={() => setFormOuvert((v) => !v)} className="text-sm font-medium rounded-lg px-3 py-1.5 border border-dashed border-slate-400">
          + Importer un document
        </button>
      </div>
      {message && <p className="text-sm text-red-600">{message}</p>}
      <form onSubmit={ajouterChapitre} className="flex gap-2">
        <input
          value={nouveauChapitre}
          onChange={(e) => setNouveauChapitre(e.target.value)}
          placeholder="Nouveau chapitre"
          className="flex-1 rounded-lg border border-slate-300 dark:border-slate-600 bg-transparent px-3 py-1.5 text-sm"
        />
        <button type="submit" className="rounded-lg px-3 py-1.5 text-sm font-medium border border-slate-300 dark:border-slate-600">Ajouter</button>
      </form>
      {chapitres.length > 0 && (
        <div className="space-y-2">
          {chapitres.map((c) => (
            <div key={c.id} className="rounded-lg border border-slate-200 dark:border-slate-600 p-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-600 dark:text-slate-300">{c.nom}</span>
                <FormulaireTest chapitreId={c.id} onCree={charger} />
              </div>
              <div className="mt-1 space-y-1">
                {(testsParChapitre[c.id] || []).map((t) => (
                  <div key={t.id} className="flex items-center justify-between text-xs">
                    <span>{t.titre}</span>
                    {enConfirmationSuppressionTest === t.id ? (
                      <span className="flex items-center gap-2">
                        <span className="text-red-600">Confirmer ?</span>
                        <button onClick={() => retirerTest(t.id)} disabled={enCoursSuppressionTest.has(t.id)} className="underline text-red-600 disabled:opacity-50">
                          {enCoursSuppressionTest.has(t.id) ? "Suppression..." : "Oui, supprimer"}
                        </button>
                        <button onClick={() => setEnConfirmationSuppressionTest(null)} className="underline text-slate-500">Annuler</button>
                      </span>
                    ) : (
                      <button onClick={() => setEnConfirmationSuppressionTest(t.id)} className="underline text-red-600">Supprimer</button>
                    )}
                  </div>
                ))}
                {(testsParChapitre[c.id] || []).length === 0 && <p className="text-slate-400 text-xs">Aucun test pour ce chapitre.</p>}
              </div>
            </div>
          ))}
        </div>
      )}
      {formOuvert && (
        <form onSubmit={importerDocument} className="rounded-lg border border-slate-200 dark:border-slate-700 p-3 space-y-2">
          <input name="nom" placeholder="Nom du document (optionnel)" className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-transparent px-3 py-2 text-sm" />
          <select name="type" required className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-transparent px-3 py-2 text-sm">
            {TYPES_DOCUMENT.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
          <select name="chapitre_id" className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-transparent px-3 py-2 text-sm">
            <option value="">Aucun chapitre</option>
            {chapitres.map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}
          </select>
          <input name="fichier" type="file" required className="w-full text-sm" />
          <button type="submit" disabled={envoi} className="rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50" style={{ background: "#91CAFF" }}>
            {envoi ? "Envoi..." : "Importer"}
          </button>
        </form>
      )}
      <div className="space-y-2">
        {documents.map((d) => (
          <div key={d.id} className="flex items-center justify-between text-sm rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2">
            <div>
              <p className="font-medium">{d.nom}</p>
              <p className="text-xs text-slate-500">{TYPES_DOCUMENT.find((t) => t.value === d.type)?.label || d.type}{d.chapitre?.nom ? ` · ${d.chapitre.nom}` : ""}</p>
            </div>
            <div className="flex items-center gap-3">
              {d.type === "cours" && (
                <button onClick={() => genererSynthese(d.id)} disabled={enCoursSynthese.has(d.id)} className="text-xs font-medium underline disabled:opacity-50">
                  {enCoursSynthese.has(d.id) ? "Generation..." : "Generer une synthese"}
                </button>
              )}
              <button onClick={() => telecharger(d.fichier_url)} className="text-xs font-medium underline">Ouvrir</button>
              {enConfirmationSuppression === d.id ? (
                <>
                  <span className="text-xs text-red-600">Confirmer ?</span>
                  <button
                    onClick={() => supprimerDocument(d.id)}
                    disabled={enCoursSuppression.has(d.id)}
                    className="text-xs font-medium underline text-red-600 disabled:opacity-50"
                  >
                    {enCoursSuppression.has(d.id) ? "Suppression..." : "Oui, supprimer"}
                  </button>
                  <button onClick={() => setEnConfirmationSuppression(null)} className="text-xs font-medium underline text-slate-500">Annuler</button>
                </>
              ) : (
                <button
                  onClick={() => setEnConfirmationSuppression(d.id)}
                  className="text-xs font-medium underline text-red-600"
                >
                  Supprimer
                </button>
              )}
            </div>
          </div>
        ))}
        {documents.length === 0 && <p className="text-slate-500 text-xs">Aucun document pour cette matière.</p>}
      </div>
    </div>
  );
}
