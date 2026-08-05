"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { authFetch } from "@/lib/authFetch";
import { supprimerTest } from "@/lib/testsSupabase";
import { creerDevoir } from "@/lib/devoirsSupabase";
import FormulaireTest from "@/components/FormulaireTest";

const TYPES_DOCUMENT = [
  { value: "cours", label: "Cours" },
  { value: "synthese", label: "Synthèse" },
  { value: "exercice", label: "Exercice" },
  { value: "test", label: "Test" },
  { value: "flashcard", label: "Flashcard" },
  { value: "corrige", label: "Corrigé" },
];

// Styles de pastilles réutilisés partout sur cet écran, dans le même esprit
// que les actions Modifier/Supprimer des cartes de devoirs : de petits
// boutons courts (icône + texte), plutôt que des liens soulignés, pour que
// les actions se distinguent clairement de la donnée elle-même.
const PILL_NEUTRE =
  "inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium border border-slate-300 dark:border-slate-600 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800";
const PILL_DANGER =
  "inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900/50";
const PILL_DANGER_SOLIDE =
  "inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold bg-red-600 text-white hover:bg-red-700 disabled:opacity-50";
const PILL_AVERTISSEMENT =
  "inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400";
const PILL_IA =
  "inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400 hover:bg-indigo-200 dark:hover:bg-indigo-900/50 disabled:opacity-50";

// lectureSeule masque toutes les actions qui modifient les données (créer,
// importer, générer par IA, supprimer, rattacher un document orphelin à un
// chapitre) — utilisé côté Enfant, qui doit pouvoir consulter la structure
// Matière > Chapitre > Documents et ouvrir les documents, sans pouvoir la
// modifier. Le repli/dépli reste disponible dans les deux cas : ce n'est pas
// une action sur les données.
export default function MatiereDocuments({ matiere, enfantId, compteId, lectureSeule = false }) {
  const router = useRouter();
  const [chapitres, setChapitres] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [testsParChapitre, setTestsParChapitre] = useState({});
  const [nouveauChapitre, setNouveauChapitre] = useState("");
  const [formOuvertPourChapitre, setFormOuvertPourChapitre] = useState(null);
  const [envoi, setEnvoi] = useState(false);
  const [message, setMessage] = useState("");
  const [enCoursSynthese, setEnCoursSynthese] = useState(new Set());
  const [enCoursExercices, setEnCoursExercices] = useState(new Set());
  const [enCoursTestIA, setEnCoursTestIA] = useState(new Set());
  const [enCoursSuppression, setEnCoursSuppression] = useState(new Set());
  const [enConfirmationSuppression, setEnConfirmationSuppression] = useState(null);
  const [enConfirmationSuppressionTest, setEnConfirmationSuppressionTest] = useState(null);
  const [enCoursSuppressionTest, setEnCoursSuppressionTest] = useState(new Set());
  const [enConfirmationSuppressionChapitre, setEnConfirmationSuppressionChapitre] = useState(null);
  const [enCoursSuppressionChapitre, setEnCoursSuppressionChapitre] = useState(new Set());
  const [enCoursAssignation, setEnCoursAssignation] = useState(new Set());

  // Replier/déplier la matière entière et, indépendamment, chaque chapitre —
  // pour qu'une fois beaucoup de documents chargés, la liste reste courte et
  // navigable au lieu de dérouler tout le contenu d'un coup.
  const [matiereReduite, setMatiereReduite] = useState(false);
  const [chapitresReduits, setChapitresReduits] = useState(new Set());

  function toggleChapitre(chapitreId) {
    setChapitresReduits((prev) => {
      const next = new Set(prev);
      if (next.has(chapitreId)) next.delete(chapitreId);
      else next.add(chapitreId);
      return next;
    });
  }

  function deplierChapitre(chapitreId) {
    setChapitresReduits((prev) => {
      if (!prev.has(chapitreId)) return prev;
      const next = new Set(prev);
      next.delete(chapitreId);
      return next;
    });
  }

  async function charger() {
    const { data: chaps } = await supabase
      .from("chapitres")
      .select("id, nom")
      .eq("matiere_id", matiere.id)
      .order("nom");
    setChapitres(chaps || []);

    const { data: docs } = await supabase
      .from("documents")
      .select("id, nom, type, fichier_url, chapitre_id, genere_par_ia, format, chapitre:chapitres(nom)")
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

  async function supprimerChapitre(chapitreId) {
    setEnCoursSuppressionChapitre((prev) => new Set(prev).add(chapitreId));
    setMessage("");
    try {
      await authFetch(`/api/chapitres/${chapitreId}`, { method: "DELETE" });
      setEnConfirmationSuppressionChapitre(null);
      charger();
    } catch (err) {
      setMessage(err.message);
    } finally {
      setEnCoursSuppressionChapitre((prev) => {
        const next = new Set(prev);
        next.delete(chapitreId);
        return next;
      });
    }
  }

  // Un document appartient toujours à un chapitre, qui appartient lui-même à
  // une matière — c'est cette structure à 3 niveaux (Matière > Chapitre >
  // Documents) qui organise tout cet écran. chapitreId est donc obligatoire
  // ici : le formulaire d'import n'existe qu'à l'intérieur de la carte d'un
  // chapitre précis (voir plus bas), jamais au niveau de la matière — il n'y
  // a donc plus moyen d'importer un document sans d'abord choisir son
  // chapitre.
  async function importerDocument(e, chapitreId) {
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
        chapitre_id: chapitreId,
        enfant_id: enfantId,
        cree_par: compteId,
        fichier_url: chemin,
        taille_octets: fichier.size,
        format: fichier.type,
      });
      if (insertError) throw insertError;
      e.target.reset();
      setFormOuvertPourChapitre(null);
      charger();
    } catch (err) {
      setMessage(err.message);
    } finally {
      setEnvoi(false);
    }
  }

  function ouvrirImportPourChapitre(chapitreId) {
    deplierChapitre(chapitreId);
    setFormOuvertPourChapitre((v) => (v === chapitreId ? null : chapitreId));
  }

  // Crée automatiquement un devoir pour l'enfant après une génération IA
  // réussie (synthèse, exercices ou test), pour que le nouveau contenu
  // n'existe pas seulement dans l'onglet Chapitres et documents mais
  // apparaisse aussi dans "Mes devoirs" côté Enfant. Échéance par défaut :
  // aujourd'hui — modifiable ensuite via le bouton "✎ Modif." du devoir,
  // comme pour tout devoir créé manuellement.
  async function creerDevoirAuto({ type, chapitreId, documentId }) {
    try {
      await creerDevoir({
        enfantId,
        matiereId: matiere.id,
        chapitreId: chapitreId || null,
        documentId: documentId || null,
        titre: null,
        type,
        dateEcheance: new Date().toISOString().slice(0, 10),
        creePar: compteId,
      });
    } catch (err) {
      setMessage(`Contenu généré, mais échec de la création du devoir : ${err.message}`);
    }
  }

  async function genererSynthese(d) {
    setEnCoursSynthese((prev) => new Set(prev).add(d.id));
    setMessage("");
    try {
      const resultat = await authFetch(`/api/documents/${d.id}/synthese`, { method: "POST" });
      await creerDevoirAuto({ type: "revision", chapitreId: d.chapitre_id, documentId: resultat?.document?.id });
      charger();
    } catch (err) {
      setMessage(err.message);
    } finally {
      setEnCoursSynthese((prev) => {
        const next = new Set(prev);
        next.delete(d.id);
        return next;
      });
    }
  }

  async function genererExercices(d) {
    setEnCoursExercices((prev) => new Set(prev).add(d.id));
    setMessage("");
    try {
      const resultat = await authFetch(`/api/documents/${d.id}/exercices`, { method: "POST" });
      await creerDevoirAuto({ type: "exercice", chapitreId: d.chapitre_id, documentId: resultat?.document?.id });
      charger();
    } catch (err) {
      setMessage(err.message);
    } finally {
      setEnCoursExercices((prev) => {
        const next = new Set(prev);
        next.delete(d.id);
        return next;
      });
    }
  }

  async function genererTestIA(d) {
    setEnCoursTestIA((prev) => new Set(prev).add(d.id));
    setMessage("");
    try {
      await authFetch(`/api/documents/${d.id}/test-ia`, { method: "POST" });
      // Le test lui-même n'est pas un "document" (table tests à part), donc
      // le devoir référence le cours source plutôt qu'un document généré.
      await creerDevoirAuto({ type: "test", chapitreId: d.chapitre_id, documentId: d.id });
      charger();
      setMessage("Test généré par IA et ajouté aux devoirs de l'enfant.");
    } catch (err) {
      setMessage(err.message);
    } finally {
      setEnCoursTestIA((prev) => {
        const next = new Set(prev);
        next.delete(d.id);
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

  // Rattache à un chapitre un document importé avant l'introduction de cette
  // règle (donc encore orphelin, chapitre_id vide) — permet de régulariser
  // progressivement les anciens documents plutôt que de les laisser hors
  // structure indéfiniment.
  async function assignerChapitre(documentId, chapitreId) {
    if (!chapitreId) return;
    setEnCoursAssignation((prev) => new Set(prev).add(documentId));
    setMessage("");
    try {
      const { error } = await supabase.from("documents").update({ chapitre_id: chapitreId }).eq("id", documentId);
      if (error) throw error;
      charger();
    } catch (err) {
      setMessage(err.message);
    } finally {
      setEnCoursAssignation((prev) => {
        const next = new Set(prev);
        next.delete(documentId);
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

  // Les documents générés par IA (synthèse/exercices, fichiers .md) s'ouvrent
  // dans la page de lecture stylisée de l'application ; les documents
  // importés (PDF, image, Word...) s'ouvrent tels quels, comme avant.
  function ouvrir(doc) {
    const estMarkdownIA = doc.genere_par_ia && (doc.format || "").includes("markdown");
    if (estMarkdownIA) {
      router.push(`/documents/${doc.id}`);
      return;
    }
    telecharger(doc.fichier_url);
  }

  // Regroupe les documents par chapitre pour l'affichage imbriqué Matière >
  // Chapitre > Documents. Les documents importés avant la règle du chapitre
  // obligatoire (chapitre_id encore vide) sont isolés à part, avec un moyen
  // de les rattacher a posteriori (voir assignerChapitre ci-dessus).
  const documentsParChapitre = {};
  const documentsSansChapitre = [];
  documents.forEach((d) => {
    if (d.chapitre_id) {
      if (!documentsParChapitre[d.chapitre_id]) documentsParChapitre[d.chapitre_id] = [];
      documentsParChapitre[d.chapitre_id].push(d);
    } else {
      documentsSansChapitre.push(d);
    }
  });

  function DocumentRow({ d }) {
    return (
      <div className="flex items-center justify-between text-sm rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 flex-wrap gap-2 bg-white dark:bg-slate-900/40">
        <div>
          <p className="font-medium">📄 {d.nom}</p>
          <p className="text-xs text-slate-500">{TYPES_DOCUMENT.find((t) => t.value === d.type)?.label || d.type}</p>
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          {!lectureSeule && d.type === "cours" && (
            <>
              <button onClick={() => genererSynthese(d)} disabled={enCoursSynthese.has(d.id)} className={PILL_IA} title="Génère une synthèse et crée automatiquement un devoir pour l'enfant">
                ✨ {enCoursSynthese.has(d.id) ? "Génération..." : "Synthèse"}
              </button>
              <button onClick={() => genererExercices(d)} disabled={enCoursExercices.has(d.id)} className={PILL_IA} title="Génère des exercices et crée automatiquement un devoir pour l'enfant">
                ✨ {enCoursExercices.has(d.id) ? "Génération..." : "Exercices"}
              </button>
              <button
                onClick={() => genererTestIA(d)}
                disabled={enCoursTestIA.has(d.id) || !d.chapitre_id}
                title={!d.chapitre_id ? "Rattachez d'abord ce document à un chapitre" : "Génère un test QCM et crée automatiquement un devoir pour l'enfant"}
                className={PILL_IA}
              >
                ✨ {enCoursTestIA.has(d.id) ? "Génération..." : "Test QCM"}
              </button>
            </>
          )}
          <button onClick={() => ouvrir(d)} className={PILL_NEUTRE}>↗ Ouvrir</button>
          {!lectureSeule && (
            enConfirmationSuppression === d.id ? (
              <>
                <span className={PILL_AVERTISSEMENT}>Sûr ?</span>
                <button onClick={() => supprimerDocument(d.id)} disabled={enCoursSuppression.has(d.id)} className={PILL_DANGER_SOLIDE}>
                  {enCoursSuppression.has(d.id) ? "..." : "Oui"}
                </button>
                <button onClick={() => setEnConfirmationSuppression(null)} className={PILL_NEUTRE}>Annuler</button>
              </>
            ) : (
              <button onClick={() => setEnConfirmationSuppression(d.id)} className={PILL_DANGER}>🗑 Suppr.</button>
            )
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-4 space-y-4" style={{ borderLeft: `6px solid ${matiere.couleur}` }}>
      <button type="button" onClick={() => setMatiereReduite((v) => !v)} className="w-full flex items-center justify-between gap-2 text-left">
        <span className="flex items-center gap-2 min-w-0">
          <span className="text-xs text-slate-400 shrink-0">{matiereReduite ? "▶" : "▼"}</span>
          <h3 className="font-semibold text-base truncate">{matiere.nom}</h3>
        </span>
        <span className="text-xs text-slate-400 shrink-0">
          {chapitres.length} chapitre{chapitres.length !== 1 ? "s" : ""} · {documents.length} document{documents.length !== 1 ? "s" : ""}
        </span>
      </button>

      {!matiereReduite && (
        <>
          {message && <p className="text-sm text-red-600">{message}</p>}

          {!lectureSeule && (
            <form onSubmit={ajouterChapitre} className="flex gap-2">
              <input
                value={nouveauChapitre}
                onChange={(e) => setNouveauChapitre(e.target.value)}
                placeholder="+ Nouveau chapitre"
                className="flex-1 rounded-lg border border-slate-300 dark:border-slate-600 bg-transparent px-3 py-1.5 text-sm"
              />
              <button type="submit" className={PILL_NEUTRE}>+ Ajouter</button>
            </form>
          )}

          {chapitres.length === 0 && (
            <p className="text-slate-400 text-xs">
              {lectureSeule
                ? "Aucun chapitre pour cette matière."
                : "Aucun chapitre pour cette matière. Créez-en un ci-dessus : les documents s'importent ensuite à l'intérieur d'un chapitre."}
            </p>
          )}

          <div className="space-y-3">
            {chapitres.map((c) => {
              const docsChapitre = documentsParChapitre[c.id] || [];
              const testsChapitre = testsParChapitre[c.id] || [];
              const estReduit = chapitresReduits.has(c.id);
              return (
                <div key={c.id} className="rounded-lg border-2 border-slate-200 dark:border-slate-600 p-3 space-y-2.5 bg-slate-50/60 dark:bg-slate-800/20">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <button type="button" onClick={() => toggleChapitre(c.id)} className="flex items-center gap-1.5 text-left min-w-0">
                      <span className="text-xs text-slate-400 shrink-0">{estReduit ? "▶" : "▼"}</span>
                      <span className="text-sm shrink-0">📂</span>
                      <span className="text-sm font-semibold text-slate-700 dark:text-slate-200 truncate">{c.nom}</span>
                      <span className="text-xs text-slate-400 shrink-0">
                        ({docsChapitre.length} doc{docsChapitre.length !== 1 ? "s" : ""}
                        {testsChapitre.length > 0 ? `, ${testsChapitre.length} test${testsChapitre.length !== 1 ? "s" : ""}` : ""})
                      </span>
                    </button>
                    {!lectureSeule && (
                      <div className="flex items-center gap-1.5">
                        <button onClick={() => ouvrirImportPourChapitre(c.id)} className={PILL_NEUTRE}>📄+ Document</button>
                        <FormulaireTest chapitreId={c.id} onCree={charger} className={PILL_NEUTRE} label="📝+ Test" onOuvrir={() => deplierChapitre(c.id)} />
                        {enConfirmationSuppressionChapitre === c.id ? (
                          <span className="flex items-center gap-1.5">
                            <span className={PILL_AVERTISSEMENT}>Sûr ?</span>
                            <button onClick={() => supprimerChapitre(c.id)} disabled={enCoursSuppressionChapitre.has(c.id)} className={PILL_DANGER_SOLIDE}>
                              {enCoursSuppressionChapitre.has(c.id) ? "..." : "Oui"}
                            </button>
                            <button onClick={() => setEnConfirmationSuppressionChapitre(null)} className={PILL_NEUTRE}>Annuler</button>
                          </span>
                        ) : (
                          <button onClick={() => setEnConfirmationSuppressionChapitre(c.id)} className={PILL_DANGER}>🗑 Suppr.</button>
                        )}
                      </div>
                    )}
                  </div>

                  {!estReduit && (
                    <>
                      {!lectureSeule && formOuvertPourChapitre === c.id && (
                        <form onSubmit={(e) => importerDocument(e, c.id)} className="rounded-lg border border-slate-200 dark:border-slate-700 p-3 space-y-2 bg-white dark:bg-slate-900">
                          <input name="nom" placeholder="Nom du document (optionnel)" className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-transparent px-3 py-2 text-sm" />
                          <select name="type" required className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-transparent px-3 py-2 text-sm">
                            {TYPES_DOCUMENT.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                          </select>
                          <input name="fichier" type="file" required className="w-full text-sm" />
                          <div className="flex items-center gap-2">
                            <button type="submit" disabled={envoi} className="rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50" style={{ background: "#91CAFF" }}>
                              {envoi ? "Envoi..." : `Importer dans « ${c.nom} »`}
                            </button>
                            <button type="button" onClick={() => setFormOuvertPourChapitre(null)} className="text-sm text-slate-500">Annuler</button>
                          </div>
                        </form>
                      )}

                      {testsChapitre.length > 0 && (
                        <div className="space-y-1 pl-1">
                          {testsChapitre.map((t) => (
                            <div key={t.id} className="flex items-center justify-between text-xs">
                              <span>📝 {t.titre}</span>
                              {!lectureSeule && (
                                enConfirmationSuppressionTest === t.id ? (
                                  <span className="flex items-center gap-1.5">
                                    <span className={PILL_AVERTISSEMENT}>Sûr ?</span>
                                    <button onClick={() => retirerTest(t.id)} disabled={enCoursSuppressionTest.has(t.id)} className={PILL_DANGER_SOLIDE}>
                                      {enCoursSuppressionTest.has(t.id) ? "..." : "Oui"}
                                    </button>
                                    <button onClick={() => setEnConfirmationSuppressionTest(null)} className={PILL_NEUTRE}>Annuler</button>
                                  </span>
                                ) : (
                                  <button onClick={() => setEnConfirmationSuppressionTest(t.id)} className={PILL_DANGER}>🗑 Suppr.</button>
                                )
                              )}
                            </div>
                          ))}
                        </div>
                      )}

                      <div className="space-y-1.5 pl-1">
                        {docsChapitre.map((d) => <DocumentRow key={d.id} d={d} />)}
                        {docsChapitre.length === 0 && testsChapitre.length === 0 && (
                          <p className="text-slate-400 text-xs">Aucun document ni test dans ce chapitre pour l&apos;instant.</p>
                        )}
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>

          {!lectureSeule && documentsSansChapitre.length > 0 && (
            <div className="rounded-lg border-2 border-dashed border-yellow-300 dark:border-yellow-700 p-3 space-y-2 bg-yellow-50/50 dark:bg-yellow-900/10">
              <p className="text-xs font-semibold text-yellow-800 dark:text-yellow-400">
                ⚠️ Documents sans chapitre (importés avant que ce soit obligatoire) — choisissez un chapitre pour chacun :
              </p>
              <div className="space-y-1.5">
                {documentsSansChapitre.map((d) => (
                  <div key={d.id} className="flex items-center justify-between text-sm rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 flex-wrap gap-2 bg-white dark:bg-slate-900/40">
                    <p className="font-medium">📄 {d.nom}</p>
                    <div className="flex items-center gap-2">
                      <select
                        disabled={enCoursAssignation.has(d.id) || chapitres.length === 0}
                        onChange={(e) => assignerChapitre(d.id, e.target.value)}
                        defaultValue=""
                        className="rounded-lg border border-slate-300 dark:border-slate-600 bg-transparent px-2 py-1 text-xs"
                      >
                        <option value="" disabled>Choisir un chapitre</option>
                        {chapitres.map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}
                      </select>
                      <button onClick={() => ouvrir(d)} className={PILL_NEUTRE}>↗ Ouvrir</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {lectureSeule && documentsSansChapitre.length > 0 && (
            <div className="space-y-1.5">
              {documentsSansChapitre.map((d) => (
                <div key={d.id} className="flex items-center justify-between text-sm rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 flex-wrap gap-2 bg-white dark:bg-slate-900/40">
                  <p className="font-medium">📄 {d.nom}</p>
                  <button onClick={() => ouvrir(d)} className={PILL_NEUTRE}>↗ Ouvrir</button>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
