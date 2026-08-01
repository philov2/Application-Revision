"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { authFetch } from "@/lib/authFetch";
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

const LABEL_IA_PAR_TYPE = {
  revision: "Générer une synthèse du cours par IA",
  exercice: "Générer des exercices par IA",
  test: "Générer un test (QCM) par IA",
};

export default function FormulaireDevoir({ enfantId, compteId, matieres, onCree }) {
  const [ouvert, setOuvert] = useState(false);

  const [matieresLocales, setMatieresLocales] = useState(matieres || []);
  useEffect(() => setMatieresLocales(matieres || []), [matieres]);
  const [matiereId, setMatiereId] = useState("");
  const [nouvelleMatiereOuvert, setNouvelleMatiereOuvert] = useState(false);
  const [nomNouvelleMatiere, setNomNouvelleMatiere] = useState("");
  const [enCoursMatiere, setEnCoursMatiere] = useState(false);

  const [chapitres, setChapitres] = useState([]);
  const [chapitreId, setChapitreId] = useState("");
  const [nouveauChapitreOuvert, setNouveauChapitreOuvert] = useState(false);
  const [nomNouveauChapitre, setNomNouveauChapitre] = useState("");
  const [enCoursChapitre, setEnCoursChapitre] = useState(false);

  const [type, setType] = useState("revision");

  const [documents, setDocuments] = useState([]);
  const [documentId, setDocumentId] = useState("");
  const [modeDocument, setModeDocument] = useState("existant"); // "existant" | "import" | "ia"

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

  async function creerNouvelleMatiere() {
    if (!nomNouvelleMatiere.trim()) return;
    setMessage("");
    setEnCoursMatiere(true);
    try {
      const { data, error } = await supabase.from("matieres").insert({ nom: nomNouvelleMatiere.trim() }).select().single();
      if (error) throw error;
      setMatieresLocales((prev) => [...prev, data].sort((a, b) => a.nom.localeCompare(b.nom)));
      setMatiereId(data.id);
      setChapitreId("");
      setNomNouvelleMatiere("");
      setNouvelleMatiereOuvert(false);
    } catch (err) {
      setMessage(err.message);
    } finally {
      setEnCoursMatiere(false);
    }
  }

  async function creerNouveauChapitre() {
    if (!nomNouveauChapitre.trim() || !matiereId) return;
    setMessage("");
    setEnCoursChapitre(true);
    try {
      const { data, error } = await supabase.from("chapitres").insert({ matiere_id: matiereId, nom: nomNouveauChapitre.trim() }).select().single();
      if (error) throw error;
      setChapitres((prev) => [...prev, data].sort((a, b) => a.nom.localeCompare(b.nom)));
      setChapitreId(data.id);
      setNomNouveauChapitre("");
      setNouveauChapitreOuvert(false);
    } catch (err) {
      setMessage(err.message);
    } finally {
      setEnCoursChapitre(false);
    }
  }

  async function importerDocument(fichier, nom, typeDocument) {
    const chemin = `${compteId}/${Date.now()}-${fichier.name}`;
    const { error: uploadError } = await supabase.storage.from("documents").upload(chemin, fichier);
    if (uploadError) throw uploadError;

    const { data: nouveauDocument, error: insertError } = await supabase
      .from("documents")
      .insert({
        nom: nom || fichier.name,
        type: typeDocument,
        matiere_id: matiereId,
        chapitre_id: chapitreId || null,
        enfant_id: enfantId,
        cree_par: compteId,
        fichier_url: chemin,
        taille_octets: fichier.size,
        format: fichier.type,
      })
      .select()
      .single();
    if (insertError) throw insertError;
    return nouveauDocument;
  }

  async function soumettre(e) {
    e.preventDefault();
    setMessage("");
    const form = new FormData(e.target);
    setEnvoi(true);
    try {
      let documentIdAEnvoyer = documentId || null;

      if (modeDocument === "import") {
        const fichier = form.get("fichier");
        if (fichier && fichier.size > 0) {
          const nouveauDocument = await importerDocument(fichier, form.get("nom_fichier"), form.get("type_fichier") || "cours");
          documentIdAEnvoyer = nouveauDocument.id;
        }
      } else if (modeDocument === "ia") {
        const fichierSource = form.get("fichier_source");
        if (!fichierSource || fichierSource.size === 0) {
          throw new Error("Choisissez un fichier de cours à utiliser pour la génération par IA.");
        }
        if (type === "test" && !chapitreId) {
          throw new Error("Choisissez ou créez d'abord un chapitre : un test généré par IA doit être rattaché à un chapitre.");
        }
        const coursSource = await importerDocument(fichierSource, form.get("nom_fichier") || fichierSource.name, "cours");

        if (type === "revision") {
          const resultat = await authFetch(`/api/documents/${coursSource.id}/synthese`, { method: "POST" });
          documentIdAEnvoyer = resultat.document.id;
        } else if (type === "exercice") {
          const resultat = await authFetch(`/api/documents/${coursSource.id}/exercices`, { method: "POST" });
          documentIdAEnvoyer = resultat.document.id;
        } else if (type === "test") {
          await authFetch(`/api/documents/${coursSource.id}/test-ia`, { method: "POST" });
          documentIdAEnvoyer = coursSource.id;
        }
      }

      await creerDevoir({
        enfantId,
        matiereId: form.get("matiere_id"),
        chapitreId: form.get("chapitre_id") || null,
        documentId: documentIdAEnvoyer,
        titre: form.get("titre") || null,
        type,
        dateEcheance: form.get("date_echeance"),
        creePar: compteId,
      });
      e.target.reset();
      setMatiereId("");
      setChapitreId("");
      setDocumentId("");
      setModeDocument("existant");
      setType("revision");
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

          <input name="titre" placeholder="Nom du devoir (optionnel)" className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-transparent px-3 py-2 text-sm" />

          <div className="space-y-1">
            {!nouvelleMatiereOuvert ? (
              <>
                <select name="matiere_id" required value={matiereId} onChange={(e) => { setMatiereId(e.target.value); setChapitreId(""); }} className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-transparent px-3 py-2 text-sm">
                  <option value="">Choisir une matiere</option>
                  {matieresLocales.map((m) => <option key={m.id} value={m.id}>{m.nom}</option>)}
                </select>
                <button type="button" onClick={() => setNouvelleMatiereOuvert(true)} className="text-xs font-medium underline text-blue-600">
                  + Créer une nouvelle matière
                </button>
              </>
            ) : (
              <div className="flex items-center gap-2">
                <input value={nomNouvelleMatiere} onChange={(e) => setNomNouvelleMatiere(e.target.value)} placeholder="Nom de la nouvelle matière" className="flex-1 rounded-lg border border-slate-300 dark:border-slate-600 bg-transparent px-3 py-2 text-sm" />
                <button type="button" onClick={creerNouvelleMatiere} disabled={enCoursMatiere || !nomNouvelleMatiere.trim()} className="rounded-lg px-3 py-2 text-xs font-medium disabled:opacity-50" style={{ background: "#91CAFF" }}>
                  {enCoursMatiere ? "..." : "Ajouter"}
                </button>
                <button type="button" onClick={() => { setNouvelleMatiereOuvert(false); setNomNouvelleMatiere(""); }} className="text-xs text-slate-500">Annuler</button>
              </div>
            )}
          </div>

          {matiereId && (
            <div className="space-y-1">
              {!nouveauChapitreOuvert ? (
                <>
                  <select name="chapitre_id" value={chapitreId} onChange={(e) => setChapitreId(e.target.value)} className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-transparent px-3 py-2 text-sm">
                    <option value="">Aucun chapitre</option>
                    {chapitres.map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}
                  </select>
                  <button type="button" onClick={() => setNouveauChapitreOuvert(true)} className="text-xs font-medium underline text-blue-600">
                    + Créer un nouveau chapitre
                  </button>
                </>
              ) : (
                <div className="flex items-center gap-2">
                  <input value={nomNouveauChapitre} onChange={(e) => setNomNouveauChapitre(e.target.value)} placeholder="Nom du nouveau chapitre" className="flex-1 rounded-lg border border-slate-300 dark:border-slate-600 bg-transparent px-3 py-2 text-sm" />
                  <button type="button" onClick={creerNouveauChapitre} disabled={enCoursChapitre || !nomNouveauChapitre.trim()} className="rounded-lg px-3 py-2 text-xs font-medium disabled:opacity-50" style={{ background: "#91CAFF" }}>
                    {enCoursChapitre ? "..." : "Ajouter"}
                  </button>
                  <button type="button" onClick={() => { setNouveauChapitreOuvert(false); setNomNouveauChapitre(""); }} className="text-xs text-slate-500">Annuler</button>
                </div>
              )}
            </div>
          )}

          <select name="type" required value={type} onChange={(e) => setType(e.target.value)} className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-transparent px-3 py-2 text-sm">
            {TYPES_DEVOIR.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
          <input name="date_echeance" type="date" required className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-transparent px-3 py-2 text-sm" />

          {matiereId && (
            <div className="rounded-lg border border-slate-200 dark:border-slate-600 p-3 space-y-2">
              <p className="text-xs font-medium text-slate-500">Document à utiliser (optionnel)</p>

              <div className="flex gap-3 text-xs">
                <label className="flex items-center gap-1">
                  <input type="radio" checked={modeDocument === "existant"} onChange={() => setModeDocument("existant")} />
                  Document existant
                </label>
                <label className="flex items-center gap-1">
                  <input type="radio" checked={modeDocument === "import"} onChange={() => setModeDocument("import")} />
                  Importer un fichier
                </label>
                <label className="flex items-center gap-1">
                  <input type="radio" checked={modeDocument === "ia"} onChange={() => setModeDocument("ia")} />
                  Générer par IA
                </label>
              </div>

              {modeDocument === "existant" && (
                documents.length > 0 ? (
                  <select value={documentId} onChange={(e) => setDocumentId(e.target.value)} className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-transparent px-3 py-2 text-sm">
                    <option value="">Aucun document</option>
                    {documents.map((d) => <option key={d.id} value={d.id}>{d.nom}</option>)}
                  </select>
                ) : (
                  <p className="text-xs text-slate-400">Aucun document déjà importé pour cette matière{chapitreId ? " / ce chapitre" : ""}.</p>
                )
              )}

              {modeDocument === "import" && (
                <div className="space-y-2">
                  <input name="nom_fichier" placeholder="Nom du document (optionnel)" className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-transparent px-3 py-2 text-sm" />
                  <select name="type_fichier" className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-transparent px-3 py-2 text-sm">
                    {TYPES_DOCUMENT.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                  <input name="fichier" type="file" className="w-full text-sm" />
                </div>
              )}

              {modeDocument === "ia" && (
                <div className="space-y-2">
                  <p className="text-xs text-slate-500">{LABEL_IA_PAR_TYPE[type]} — déposez le cours source, l&apos;IA génère le contenu automatiquement.</p>
                  <input name="nom_fichier" placeholder="Nom du cours source (optionnel)" className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-transparent px-3 py-2 text-sm" />
                  <input name="fichier_source" type="file" className="w-full text-sm" />
                  {type === "test" && !chapitreId && (
                    <p className="text-xs text-red-600">Choisissez ou créez d&apos;abord un chapitre ci-dessus : un test généré par IA doit être rattaché à un chapitre.</p>
                  )}
                </div>
              )}
            </div>
          )}

          <button type="submit" disabled={envoi} className="rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50" style={{ background: "#91CAFF" }}>
            {envoi ? (modeDocument === "ia" ? "Génération en cours..." : "Creation...") : "Creer le devoir"}
          </button>
        </form>
      )}
    </div>
  );
}
