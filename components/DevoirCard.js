"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { matieres as matieresSample } from "@/lib/sampleData";
import { supabase } from "@/lib/supabaseClient";
import { modifierDevoir, supprimerDevoir, basculerStatutDevoir } from "@/lib/devoirsSupabase";
import { soumettreReponseExercice, noterExercice, urlSigneeFichierExercice } from "@/lib/reponsesExercicesSupabase";
import { chargerTestsChapitre, chargerResultatTest, soumettreResultatTest } from "@/lib/testsSupabase";

const LABEL_TYPE = { revision: "Réviser le cours", exercice: "Exercices", test: "Test" };
const TYPES_DEVOIR = [
  { value: "revision", label: "Réviser le cours" },
  { value: "exercice", label: "Exercices" },
  { value: "test", label: "Test" },
];

// Formats acceptés pour l'envoi d'une réponse d'exercice : photo, PDF ou
// document Word. Plusieurs fichiers peuvent être envoyés en une fois (par
// exemple une photo par page).
const ACCEPT_FICHIERS_EXERCICE =
  "image/*,.pdf,application/pdf,.doc,.docx,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document";

function statutDate(dateStr) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const echeance = new Date(dateStr + "T00:00:00");
  if (echeance.getTime() === today.getTime()) return "aujourdhui";
  return echeance < today ? "retard" : "avenir";
}

const COULEUR_DATE = {
  avenir: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  retard: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  aujourdhui: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
};

export default function DevoirCard({ devoir, onToggle, matieres, onChange, enfantId, compteId }) {
  const router = useRouter();
  const couleur = matieresSample.find((m) => m.nom === devoir.matiere)?.couleur || "#91CAFF";
  const fait = devoir.statut === "fait";
  const [, month, day] = devoir.echeance.split("-");
  const dateLabel = `${day}/${month}`;
  const statut = statutDate(devoir.echeance);

  const [enEdition, setEnEdition] = useState(false);
  const [enConfirmationSuppression, setEnConfirmationSuppression] = useState(false);
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState("");
  const [titre, setTitre] = useState(devoir.titre || "");
  const [matiereId, setMatiereId] = useState(devoir.matiereId || "");
  const [chapitreId, setChapitreId] = useState(devoir.chapitreId || "");
  const [chapitres, setChapitres] = useState([]);
  const [type, setType] = useState(devoir.type);
  const [dateEcheance, setDateEcheance] = useState(devoir.echeance);
  const [documentsEdition, setDocumentsEdition] = useState([]);
  const [documentIdEdition, setDocumentIdEdition] = useState(devoir.document?.id || "");

  const [enEnvoiFichiers, setEnEnvoiFichiers] = useState(false);
  const [erreurFichiers, setErreurFichiers] = useState("");
  const fileInputRef = useRef(null);

  const [enChargementFichier, setEnChargementFichier] = useState(false);
  const [note, setNote] = useState("");
  const [commentaire, setCommentaire] = useState("");
  const [enCoursNote, setEnCoursNote] = useState(false);
  const [erreurNote, setErreurNote] = useState("");

  const [enChargementDocument, setEnChargementDocument] = useState(false);
  const [erreurDocument, setErreurDocument] = useState("");

  const [testDisponible, setTestDisponible] = useState(null);
  const [resultatTest, setResultatTest] = useState(null);
  const [enPassageTest, setEnPassageTest] = useState(false);
  const [reponsesTest, setReponsesTest] = useState([]);
  const [enEnvoiTest, setEnEnvoiTest] = useState(false);
  const [erreurTest, setErreurTest] = useState("");

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
    if (!enEdition || !matiereId || !enfantId) {
      setDocumentsEdition([]);
      return;
    }
    (async () => {
      let requete = supabase.from("documents").select("id, nom, type").eq("matiere_id", matiereId).eq("enfant_id", enfantId);
      if (chapitreId) requete = requete.eq("chapitre_id", chapitreId);
      const { data } = await requete.order("created_at", { ascending: false });
      setDocumentsEdition(data || []);
    })();
  }, [enEdition, matiereId, chapitreId, enfantId]);

  useEffect(() => {
    if (devoir.type !== "test" || !devoir.chapitreId || !devoir.enfantId) return;
    (async () => {
      try {
        const tests = await chargerTestsChapitre(devoir.chapitreId);
        const t = tests[0] || null;
        setTestDisponible(t);
        if (t) {
          const r = await chargerResultatTest(t.id, devoir.enfantId);
          setResultatTest(r);
        }
      } catch {
        // silencieux : ne bloque pas l'affichage du devoir
      }
    })();
  }, [devoir.type, devoir.chapitreId, devoir.enfantId]);

  function commencerEdition() {
    setTitre(devoir.titre || "");
    setMatiereId(devoir.matiereId || "");
    setChapitreId(devoir.chapitreId || "");
    setType(devoir.type);
    setDateEcheance(devoir.echeance);
    setDocumentIdEdition(devoir.document?.id || "");
    setErreur("");
    setEnEdition(true);
  }

  async function enregistrer() {
    setErreur("");
    setEnCours(true);
    try {
      await modifierDevoir(devoir.id, { matiereId, chapitreId: chapitreId || null, documentId: documentIdEdition || null, titre: titre || null, type, dateEcheance });
      setEnEdition(false);
      onChange?.();
    } catch (err) {
      setErreur(err.message);
    } finally {
      setEnCours(false);
    }
  }

  async function supprimer() {
    setErreur("");
    setEnCours(true);
    try {
      await supprimerDevoir(devoir.id);
      setEnConfirmationSuppression(false);
      onChange?.();
    } catch (err) {
      setErreur(err.message);
    } finally {
      setEnCours(false);
    }
  }

  async function envoyerFichiers(e) {
    const fichiers = e.target.files;
    if (!fichiers || fichiers.length === 0 || !enfantId) return;
    setErreurFichiers("");
    setEnEnvoiFichiers(true);
    try {
      await soumettreReponseExercice(devoir.id, enfantId, fichiers);
      // La réponse envoyée marque automatiquement le devoir comme "fait" —
      // il reste "en attente de correction" tant qu'aucune note n'est donnée.
      if (devoir.statut !== "fait") {
        await basculerStatutDevoir(devoir.id, "fait");
      }
      onChange?.();
    } catch (err) {
      setErreurFichiers(err.message);
    } finally {
      setEnEnvoiFichiers(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function voirFichier(chemin) {
    setErreurNote("");
    setEnChargementFichier(true);
    try {
      const url = await urlSigneeFichierExercice(chemin);
      window.open(url, "_blank");
    } catch (err) {
      setErreurNote(err.message);
    } finally {
      setEnChargementFichier(false);
    }
  }

  async function voirDocument() {
    if (!devoir.document) return;

    // Un document généré par IA (synthèse/exercices, fichier .md) s'ouvre
    // dans la page de lecture stylisée de l'application plutôt que comme
    // fichier texte brut ; les documents importés (PDF, image...) s'ouvrent
    // tels quels, comme avant.
    const estMarkdownIA = devoir.document.generePasIA && (devoir.document.format || "").includes("markdown");
    if (estMarkdownIA) {
      router.push(`/documents/${devoir.document.id}`);
      return;
    }

    setErreurDocument("");
    setEnChargementDocument(true);
    try {
      const { data, error } = await supabase.storage.from("documents").createSignedUrl(devoir.document.fichierUrl, 60);
      if (error) throw error;
      window.open(data.signedUrl, "_blank");
    } catch (err) {
      setErreurDocument(err.message);
    } finally {
      setEnChargementDocument(false);
    }
  }

  async function enregistrerNote() {
    if (!devoir.reponseExercice) return;
    setErreurNote("");
    setEnCoursNote(true);
    try {
      await noterExercice(devoir.reponseExercice.id, {
        note: note === "" ? null : Number(note),
        commentaire: commentaire || null,
        notePar: compteId,
      });
      onChange?.();
    } catch (err) {
      setErreurNote(err.message);
    } finally {
      setEnCoursNote(false);
    }
  }

  function commencerTest() {
    if (!testDisponible) return;
    setReponsesTest(new Array(testDisponible.questions.length).fill(null));
    setErreurTest("");
    setEnPassageTest(true);
  }

  function choisirReponse(indexQuestion, indexChoix) {
    setReponsesTest((prev) => prev.map((r, i) => (i === indexQuestion ? indexChoix : r)));
  }

  async function validerTest() {
    if (!testDisponible || !devoir.enfantId) return;
    setErreurTest("");
    setEnEnvoiTest(true);
    try {
      const total = testDisponible.questions.length;
      let correct = 0;
      testDisponible.questions.forEach((q, i) => {
        if (reponsesTest[i] === q.bonne_reponse) correct += 1;
      });
      const noteCalculee = Math.round((correct / total) * 20 * 100) / 100;
      await soumettreResultatTest({ testId: testDisponible.id, enfantId: devoir.enfantId, reponses: reponsesTest, note: noteCalculee });
      setResultatTest({ note: noteCalculee, reponses: reponsesTest });
      setEnPassageTest(false);
    } catch (err) {
      setErreurTest(err.message);
    } finally {
      setEnEnvoiTest(false);
    }
  }

  // Modifier / Supprimer : actions sur le devoir entier (pas sur un fichier en
  // particulier). N'apparaît qu'une seule fois par carte, accolé à la première
  // ligne de contenu (document, fichier envoyé, ou test) — jamais répété.
  // Invisible côté Enfant (matieres n'est fourni que côté Parent/Soutien).
  function ActionsModifierSupprimer() {
    if (!matieres) return null;
    return (
      <div className="flex items-center gap-2 shrink-0">
        <button onClick={commencerEdition} className="text-xs font-medium underline">Modifier</button>
        {enConfirmationSuppression ? (
          <>
            <span className="text-xs text-red-600">Confirmer ?</span>
            <button onClick={supprimer} disabled={enCours} className="text-xs font-medium underline text-red-600 disabled:opacity-50">
              {enCours ? "Suppression..." : "Oui, supprimer"}
            </button>
            <button onClick={() => setEnConfirmationSuppression(false)} className="text-xs font-medium underline text-slate-500">Annuler</button>
          </>
        ) : (
          <button onClick={() => setEnConfirmationSuppression(true)} className="text-xs font-medium underline text-red-600">Supprimer</button>
        )}
      </div>
    );
  }

  if (enEdition) {
    return (
      <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-4 space-y-2" style={{ borderLeft: `6px solid ${couleur}` }}>
        {erreur && <p className="text-sm text-red-600">{erreur}</p>}
        <input value={titre} onChange={(e) => setTitre(e.target.value)} placeholder="Nom du devoir (optionnel)" className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-transparent px-3 py-2 text-sm" />
        <select value={matiereId} onChange={(e) => { setMatiereId(e.target.value); setChapitreId(""); setDocumentIdEdition(""); }} className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-transparent px-3 py-2 text-sm">
          <option value="">Choisir une matière</option>
          {(matieres || []).map((m) => <option key={m.id} value={m.id}>{m.nom}</option>)}
        </select>
        <select value={chapitreId} onChange={(e) => { setChapitreId(e.target.value); setDocumentIdEdition(""); }} className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-transparent px-3 py-2 text-sm">
          <option value="">Aucun chapitre</option>
          {chapitres.map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}
        </select>
        <select value={type} onChange={(e) => setType(e.target.value)} className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-transparent px-3 py-2 text-sm">
          {TYPES_DEVOIR.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
        <input type="date" value={dateEcheance} onChange={(e) => setDateEcheance(e.target.value)} className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-transparent px-3 py-2 text-sm" />
        {matiereId && (
          <select value={documentIdEdition} onChange={(e) => setDocumentIdEdition(e.target.value)} className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-transparent px-3 py-2 text-sm">
            <option value="">Aucun document</option>
            {documentsEdition.map((d) => <option key={d.id} value={d.id}>{d.nom}</option>)}
          </select>
        )}
        <div className="flex items-center gap-2">
          <button onClick={enregistrer} disabled={enCours} className="rounded-lg px-3 py-1.5 text-sm font-medium disabled:opacity-50" style={{ background: "#91CAFF" }}>
            {enCours ? "Enregistrement..." : "Enregistrer"}
          </button>
          <button onClick={() => setEnEdition(false)} className="text-sm text-slate-500">Annuler</button>
        </div>
      </div>
    );
  }

  // Case à cocher (Enfant, révision/test) ou badge de statut (exercice),
  // affiché à droite de la ligne « Type - Nom du devoir ».
  const statutIndicator =
    devoir.type === "exercice" ? (
      <span className="text-xs font-medium text-slate-500">
        {!devoir.reponseExercice ? "À faire" : devoir.reponseExercice.note == null ? "En attente de correction" : "Fait — corrigé"}
      </span>
    ) : onToggle ? (
      <label className="flex items-center gap-2 text-xs">
        <input type="checkbox" checked={fait} onChange={() => onToggle?.(devoir.id)} className="h-4 w-4" />
        {fait ? "Fait" : "À faire"}
      </label>
    ) : null;

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-4" style={{ borderLeft: `6px solid ${couleur}` }}>
      {/* Ligne principale : Matière - Chapitre (gauche) / date - créateur (droite) */}
      <div className="flex items-start justify-between gap-3">
        <p className="font-semibold text-sm">
          {devoir.matiere}
          {devoir.chapitre ? ` · ${devoir.chapitre}` : ""}
        </p>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs text-slate-500">{devoir.origine}</span>
          <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold ${COULEUR_DATE[statut]}`}>
            {dateLabel}
          </span>
        </div>
      </div>

      {/* Type de devoir - Nom du devoir (gauche) / statut (droite) */}
      <div className="flex items-center justify-between gap-3 mt-0.5 flex-wrap">
        <p className="text-xs text-slate-500">
          {LABEL_TYPE[devoir.type] || devoir.type}
          {devoir.titre ? ` · ${devoir.titre}` : ""}
        </p>
        {statutIndicator && <div className="shrink-0">{statutIndicator}</div>}
      </div>

      {erreur && <p className="text-xs text-red-600 mt-1">{erreur}</p>}

      <div className="mt-2 text-xs space-y-1">
        {devoir.type === "revision" && (
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="min-w-0">
              {erreurDocument && <p className="text-red-600 mb-1">{erreurDocument}</p>}
              {devoir.document ? (
                <button onClick={voirDocument} disabled={enChargementDocument} className="underline font-medium text-blue-600 disabled:opacity-50 text-left">
                  {enChargementDocument ? "Ouverture..." : `Ouvrir le document : ${devoir.document.nom}`}
                </button>
              ) : (
                <p className="text-slate-400">Aucun document associé à ce devoir. Cliquez sur « Modifier » pour en choisir ou en importer un.</p>
              )}
            </div>
            <ActionsModifierSupprimer />
          </div>
        )}

        {devoir.type === "exercice" && (
          <div className="space-y-1">
            {erreurFichiers && <p className="text-red-600">{erreurFichiers}</p>}
            {!devoir.reponseExercice ? (
              <div className="flex items-center justify-between gap-3 flex-wrap">
                {onToggle ? (
                  <>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept={ACCEPT_FICHIERS_EXERCICE}
                      multiple
                      onChange={envoyerFichiers}
                      disabled={enEnvoiFichiers}
                      className="hidden"
                      id={`fichiers-${devoir.id}`}
                    />
                    <label htmlFor={`fichiers-${devoir.id}`} className="cursor-pointer underline font-medium text-blue-600">
                      {enEnvoiFichiers ? "Envoi en cours..." : "Envoyer l'exercice (photo, PDF ou Word — plusieurs fichiers possibles)"}
                    </label>
                  </>
                ) : (
                  <p className="text-slate-400">En attente d&apos;envoi par l&apos;enfant.</p>
                )}
                <ActionsModifierSupprimer />
              </div>
            ) : (
              <>
                {devoir.reponseExercice.fichiersUrls.map((chemin, i) => (
                  <div key={chemin} className="flex items-center justify-between gap-3">
                    <button onClick={() => voirFichier(chemin)} disabled={enChargementFichier} className="underline font-medium text-blue-600 disabled:opacity-50 text-left">
                      Voir fichier {i + 1}
                    </button>
                    {i === 0 && <ActionsModifierSupprimer />}
                  </div>
                ))}
                {erreurNote && <p className="text-red-600">{erreurNote}</p>}
                {matieres && devoir.reponseExercice.note == null ? (
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <input
                      type="text"
                      value={commentaire}
                      onChange={(e) => setCommentaire(e.target.value)}
                      placeholder="Commentaire (optionnel)"
                      className="flex-1 min-w-[8rem] rounded-lg border border-slate-300 dark:border-slate-600 bg-transparent px-2 py-1"
                    />
                    <div className="flex items-center gap-2 shrink-0">
                      <input type="number" min="0" max="20" step="0.5" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note /20" className="w-20 rounded-lg border border-slate-300 dark:border-slate-600 bg-transparent px-2 py-1" />
                      <button onClick={enregistrerNote} disabled={enCoursNote || note === ""} className="rounded-lg px-3 py-1 font-medium disabled:opacity-50" style={{ background: "#91CAFF" }}>
                        {enCoursNote ? "..." : "Enregistrer"}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-slate-500">
                      {devoir.reponseExercice.note == null
                        ? "Réponse envoyée, en attente de correction."
                        : devoir.reponseExercice.commentaire || ""}
                    </p>
                    {devoir.reponseExercice.note != null && (
                      <p className="text-green-700 dark:text-green-400 font-medium shrink-0">{devoir.reponseExercice.note}/20</p>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {devoir.type === "test" && (
          <div className="space-y-1">
            {erreurTest && <p className="text-red-600">{erreurTest}</p>}
            {!testDisponible && (
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <p className="text-slate-400">Aucun test n&apos;est encore rattaché à ce chapitre.</p>
                <ActionsModifierSupprimer />
              </div>
            )}
            {testDisponible && !resultatTest && !enPassageTest && (
              <div className="flex items-center justify-between gap-3 flex-wrap">
                {onToggle ? (
                  <button onClick={commencerTest} className="underline font-medium text-blue-600">Passer le test</button>
                ) : (
                  <p className="text-slate-400">Test pas encore passé par l&apos;enfant.</p>
                )}
                <ActionsModifierSupprimer />
              </div>
            )}
            {testDisponible && !resultatTest && enPassageTest && (
              <div className="space-y-3 border border-slate-200 dark:border-slate-600 rounded-lg p-3">
                <p className="font-medium text-sm">{testDisponible.titre}</p>
                {testDisponible.questions.map((q, i) => (
                  <div key={i} className="space-y-1">
                    <p className="text-sm">{q.question}</p>
                    {q.choix.map((choixTexte, j) => (
                      <label key={j} className="flex items-center gap-2 text-sm">
                        <input type="radio" name={`q-${devoir.id}-${i}`} checked={reponsesTest[i] === j} onChange={() => choisirReponse(i, j)} />
                        {choixTexte}
                      </label>
                    ))}
                  </div>
                ))}
                <button
                  onClick={validerTest}
                  disabled={enEnvoiTest || reponsesTest.some((r) => r === null)}
                  className="rounded-lg px-3 py-1.5 text-sm font-medium disabled:opacity-50"
                  style={{ background: "#91CAFF" }}
                >
                  {enEnvoiTest ? "Envoi..." : "Valider le test"}
                </button>
              </div>
            )}
            {resultatTest && (
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <p className="text-slate-500">Test terminé.</p>
                <div className="flex items-center gap-3 shrink-0">
                  <p className="text-green-700 dark:text-green-400 font-medium">{resultatTest.note}/20</p>
                  <ActionsModifierSupprimer />
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
