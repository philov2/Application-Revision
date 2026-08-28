"use client";

import { useEffect, useId, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { authFetch } from "@/lib/authFetch";
import { creerDevoir } from "@/lib/devoirsSupabase";
import { sanitizeNomFichier } from "@/lib/sanitizeNomFichier";

const TYPES_DEVOIR = [
  { value: "revision", label: "📖 Réviser le cours" },
  { value: "exercice", label: "✏️ Exercices" },
  { value: "test", label: "📝 Test" },
  ];

const TYPES_DOCUMENT = [
  { value: "cours", label: "Cours" },
  { value: "exercice", label: "Exercice" },
  { value: "flashcard", label: "Flashcard" },
  { value: "corrige", label: "Corrigé" },
  ];

const LABEL_IA_PAR_TYPE = {
    revision: "une synthèse du cours",
    exercice: "des exercices",
    test: "un test (QCM)",
};

// Jalon "flashcards depuis l'assistant Nouveau devoir" (signalement de Phil :
// en tapant "flashcards" dans la description du devoir de type Révision,
// l'IA générait un document texte imitant la mise en page recto/verso au
// lieu de vraies flashcards interactives -- cette option n'existait tout
// simplement pas ici, seul le bouton dédié de l'onglet "Chapitres et
// documents" créait de vraies flashcards). Un devoir de révision généré par
// IA peut désormais produire soit une synthèse (comportement existant), soit
// un jeu de flashcards, au choix.
function libelleIA(type, formatRevision) {
  if (type === "revision" && formatRevision === "flashcards") {
    return "des flashcards de révision (cartes question/réponse)";
  }
  return LABEL_IA_PAR_TYPE[type];
}

const ROUTES_IA_AVEC_DOCUMENT = {
    revision: "synthese",
    exercice: "exercices",
    test: "test-ia",
};

const ROUTES_IA_PROMPT = {
    revision: "/api/generation/synthese",
    exercice: "/api/generation/exercices",
    test: "/api/generation/test-ia",
};

const MODES_DOCUMENT = [
  { value: "existant", label: "📁 Document existant" },
  { value: "import", label: "📤 Importer un fichier" },
  { value: "ia", label: "✨ Générer par IA" },
  ];

const SOURCES_IA = [
  { value: "prompt", label: "1. À partir d'une description" },
  { value: "fichier", label: "2. À partir d'un fichier" },
  ];

/* Champ de formulaire réutilisable : libellé au-dessus, style commun. */
function Champ({ label, children }) {
    return (
          <label className="block space-y-1.5">
            <span className="block text-xs font-semibold text-slate-600 dark:text-slate-300">{label}</span>
  {children}
  </label>
    );
}

const CLASSE_INPUT =
    "w-full rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800/60 px-3.5 py-2.5 text-sm shadow-sm transition focus:outline-none focus:ring-2 focus:ring-[#4169E1] focus:border-transparent";
const CLASSE_INPUT_ETROIT = CLASSE_INPUT.replace("w-full ", "");

/* Puce de sélection réutilisable (matière, etc.) : remplace les listes */
/* déroulantes natives par des boutons, plus lisibles et plus rapides à */
/* utiliser au doigt sur mobile (signalement de Phil : formulaire trop long */
/* et compliqué sur iOS). */
function Puce({ actif, onClick, children, pointille }) {
    return (
          <button
        type="button"
        onClick={onClick}
        className={`rounded-full px-3.5 py-1.5 text-xs font-medium border transition ${
                  actif
                    ? "border-transparent text-white shadow-sm"
                    : pointille
                    ? "border-dashed border-slate-300 dark:border-slate-600 text-blue-600 dark:text-blue-400"
                    : "border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:border-slate-400"
        }`}
      style={actif ? { background: "#4169E1" } : undefined}
    >
{children}
</button>
  );
}

/* Bouton de sélection de fichier réutilisable : remplace le input[type=file] */
/* natif (peu visible) par un vrai bouton, avec le nom du fichier choisi */
/* affiché à côté. */
function FichierBouton({ name, nomFichier, onChange, accept }) {
    const id = useId();
    return (
          <div className="flex items-center gap-2.5 flex-wrap">
            <label
          htmlFor={id}
          className="shrink-0 cursor-pointer rounded-xl px-3.5 py-2.5 text-xs font-semibold text-white shadow-sm transition hover:brightness-95 active:brightness-90"
          style={{ background: "#4169E1" }}
      >
        📎 Choisir un fichier
          </label>
      <input
        id={id}
        name={name}
        type="file"
        accept={accept}
        onChange={(e) => onChange(e.target.files?.[0]?.name || "")}
        className="hidden"
      />
                <span className="text-xs text-slate-500 dark:text-slate-400 truncate max-w-[220px]">
        {nomFichier || "Aucun fichier sélectionné"}
</span>
  </div>
  );
}

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
    const [titre, setTitre] = useState("");
    const [dateEcheance, setDateEcheance] = useState("");

  // "synthese" (comportement existant, produit un document à lire) ou
  // "flashcards" (produit un jeu de cartes interactif) -- uniquement
  // pertinent quand type === "revision" et modeDocument === "ia".
  const [formatRevision, setFormatRevision] = useState("synthese");
  const estFlashcardsFormat = type === "revision" && formatRevision === "flashcards";

  const [documents, setDocuments] = useState([]);
    const [documentId, setDocumentId] = useState("");
    const [modeDocument, setModeDocument] = useState("existant"); /* "existant" | "import" | "ia" */
  const [sourceIA, setSourceIA] = useState("prompt"); /* "prompt" | "fichier" */
  const [nomFichierImport, setNomFichierImport] = useState("");
    const [nomFichierSource, setNomFichierSource] = useState("");

  /* Titre et chapitre sont désormais toujours visibles : le repli */
  /* "Options avancées" a été retiré (signalement de Phil, le libellé */
  /* était trompeur puisque ces champs ne sont pas vraiment optionnels). */

  const [envoi, setEnvoi] = useState(false);
    const [message, setMessage] = useState("");

  function fermer() {
        setOuvert(false);
        setMessage("");
  }

  useEffect(() => {
        if (!ouvert) return;
        function onKeyDown(e) {
                if (e.key === "Escape") fermer();
        }
        document.addEventListener("keydown", onKeyDown);
        return () => document.removeEventListener("keydown", onKeyDown);
  }, [ouvert]);

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
        const nomMatiereSaisi = nomNouvelleMatiere.trim();
        if (!nomMatiereSaisi) return;
        setMessage("");
        if (matieresLocales.some((m) => m.nom.trim().toLowerCase() === nomMatiereSaisi.toLowerCase())) {
                setMessage("Cette matière existe déjà.");
                return;
        }
        setEnCoursMatiere(true);
        try {
                const { data, error } = await supabase.from("matieres").insert({ nom: nomMatiereSaisi }).select().single();
                if (error) throw error;
                /* Si c'est un soutien qui crée cette nouvelle matière, il n'y est pas */
          /* encore rattaché (table liens_soutien) : sans ce rattachement */
          /* automatique, créer ensuite un chapitre ou un devoir dans cette */
          /* matière échouerait avec "non autorisé" (voir signalement : création */
          /* d'un devoir dans la matière Technologie non autorisée). Pour un */
          /* parent, cet appel ne fait rien (la route l'ignore) puisqu'il n'est */
          /* pas limité par matière. Non bloquant si ça échoue : la matière reste */
          /* créée dans tous les cas. */
          try {
                    await authFetch("/api/liens-soutien", {
                                method: "POST",
                                body: JSON.stringify({ enfantId, matiereId: data.id }),
                    });
          } catch (err) {
                    /* silencieux : voir commentaire ci-dessus */
          }
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
        const nomChapitreSaisi = nomNouveauChapitre.trim();
        if (!nomChapitreSaisi || !matiereId) return;
        setMessage("");
        if (chapitres.some((c) => c.nom.trim().toLowerCase() === nomChapitreSaisi.toLowerCase())) {
                setMessage("Ce chapitre existe déjà dans cette matière.");
                return;
        }
        setEnCoursChapitre(true);
        try {
                const { data, error } = await supabase.from("chapitres").insert({ matiere_id: matiereId, nom: nomChapitreSaisi }).select().single();
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
        const chemin = `${compteId}/${Date.now()}-${sanitizeNomFichier(fichier.name)}`;
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
        if (!matiereId) {
                setMessage("Choisissez une matière.");
                return;
        }
        const form = new FormData(e.target);
        setEnvoi(true);
        try {
                let documentIdAEnvoyer = documentId || null;
                let flashcardsIdAEnvoyer = null;

          if (modeDocument === "import") {
                    const fichier = form.get("fichier");
                    if (fichier && fichier.size > 0) {
                                const nouveauDocument = await importerDocument(fichier, form.get("nom_fichier"), form.get("type_fichier") || "cours");
                                documentIdAEnvoyer = nouveauDocument.id;
                    }
          } else if (modeDocument === "ia") {
                    if ((type === "test" || estFlashcardsFormat) && !chapitreId) {
                                throw new Error("Choisissez ou créez d'abord un chapitre : un contenu généré par IA (test ou flashcards) doit être rattaché à un chapitre.");
                    }

                  if (sourceIA === "fichier") {
                              const fichierSource = form.get("fichier_source");
                              if (!fichierSource || fichierSource.size === 0) {
                                            throw new Error("Importez un fichier de cours à partir duquel générer le document.");
                              }
                              const consigne = (form.get("consigne_ia") || "").trim();
                              const coursSource = await importerDocument(fichierSource, form.get("nom_fichier") || fichierSource.name, "cours");
                              if (estFlashcardsFormat) {
                                            const resultat = await authFetch(`/api/documents/${coursSource.id}/flashcards-ia`, { method: "POST" });
                                            flashcardsIdAEnvoyer = resultat.flashcards.id;
                              } else {
                                            const route = ROUTES_IA_AVEC_DOCUMENT[type];
                                            if (type === "test") {
                                                            await authFetch(`/api/documents/${coursSource.id}/${route}`, {
                                                                            method: "POST",
                                                                            body: JSON.stringify({ consigne }),
                                                            });
                                                            documentIdAEnvoyer = coursSource.id;
                                            } else {
                                                            const resultat = await authFetch(`/api/documents/${coursSource.id}/${route}`, {
                                                                            method: "POST",
                                                                            body: JSON.stringify({ consigne }),
                                                            });
                                                            documentIdAEnvoyer = resultat.document.id;
                                            }
                              }
                  } else {
                              const promptIA = (form.get("prompt_ia") || "").trim();
                              if (!promptIA) {
                                            throw new Error("Décrivez ce que l'IA doit générer.");
                              }
                              if (estFlashcardsFormat) {
                                            const resultat = await authFetch("/api/generation/flashcards-ia", {
                                                            method: "POST",
                                                            body: JSON.stringify({ prompt: promptIA, chapitreId }),
                                            });
                                            flashcardsIdAEnvoyer = resultat.flashcards.id;
                              } else if (type === "test") {
                                            await authFetch(ROUTES_IA_PROMPT.test, {
                                                            method: "POST",
                                                            body: JSON.stringify({ prompt: promptIA, chapitreId }),
                                            });
                                            documentIdAEnvoyer = null;
                              } else {
                                            const resultat = await authFetch(ROUTES_IA_PROMPT[type], {
                                                            method: "POST",
                                                            body: JSON.stringify({ prompt: promptIA, matiereId, chapitreId, enfantId }),
                                            });
                                            documentIdAEnvoyer = resultat.document.id;
                              }
                  }
          }

          await creerDevoir({
                    enfantId,
                    matiereId,
                    chapitreId: chapitreId || null,
                    documentId: documentIdAEnvoyer,
                    flashcardsId: flashcardsIdAEnvoyer,
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
                setSourceIA("prompt");
                setType("revision");
                setFormatRevision("synthese");
                setTitre("");
                setDateEcheance("");
                setNomFichierImport("");
                setNomFichierSource("");
                fermer();
                onCree?.();
        } catch (err) {
                setMessage(err.message);
        } finally {
                setEnvoi(false);
        }
  }

  return (
        <div>
          <button
          onClick={() => setOuvert(true)}
          className="text-sm font-medium rounded-lg px-3.5 py-1.5 text-white shadow-sm transition hover:brightness-95 active:brightness-90"
          style={{ background: "#4169E1" }}
      >
        + Nouveau devoir
          </button>

{ouvert && (
          <div
           className="fixed inset-0 z-50 flex items-start sm:items-center justify-center bg-slate-900/50 backdrop-blur-sm p-3 sm:p-6 overflow-y-auto"
           onClick={fermer}
         >
                       <div
             onClick={(e) => e.stopPropagation()}
             className="w-full max-w-lg my-6 sm:my-0 rounded-2xl bg-white dark:bg-slate-900 shadow-2xl ring-1 ring-black/5 dark:ring-white/10 flex flex-col max-h-[92vh] overflow-hidden"
           >
             {/* En-tête */}
                           <div
               className="px-5 py-4 flex items-start justify-between gap-3 shrink-0"
               style={{ background: "linear-gradient(135deg, #4169E1, #7A96EA)" }}
            >
              <div>
                              <h2 className="text-base font-semibold text-white">Nouveau devoir</h2>
                <p className="text-xs text-white/80 mt-0.5">Créez un devoir de révision, d&apos;exercices ou de test.</p>
              </div>
              <button
                type="button"
                onClick={fermer}
                aria-label="Fermer"
                className="shrink-0 rounded-full h-7 w-7 flex items-center justify-center text-slate-700 bg-white/60 hover:bg-white transition"
              >
                                  ×
                  </button>
                  </div>

{/* Corps du formulaire */}
            <form id="formulaire-nouveau-devoir" onSubmit={soumettre} className="px-5 py-4 space-y-4 overflow-y-auto">
            {message && (
                              <p className="text-sm text-red-700 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/40 rounded-lg px-3 py-2">
            {message}
              </p>
              )}

              <Champ label="Matière">
                                <div className="flex flex-wrap gap-2">
              {matieresLocales.map((m) => (
                                    <Puce
                                                         key={m.id}
                      actif={matiereId === m.id}
                                              onClick={() => {
                        setMatiereId(m.id);
                                                setChapitreId("");
                      }}
                    >
{m.nom}
</Puce>
                  ))}
{!nouvelleMatiereOuvert && (
                      <Puce pointille onClick={() => setNouvelleMatiereOuvert(true)}>
                        + Nouvelle
  </Puce>
                   )}
</div>
{nouvelleMatiereOuvert && (
                    <div className="flex items-center gap-2 mt-2">
                      <input
                       value={nomNouvelleMatiere}
                       onChange={(e) => setNomNouvelleMatiere(e.target.value)}
                       placeholder="Nom de la nouvelle matière"
                       className={`flex-1 ${CLASSE_INPUT}`}
                    />
                    <button
                      type="button"
                      onClick={creerNouvelleMatiere}
                      disabled={enCoursMatiere || !nomNouvelleMatiere.trim()}
                      className="rounded-xl px-3 py-2.5 text-xs font-medium text-white disabled:opacity-50 shadow-sm"
                      style={{ background: "#4169E1" }}
                    >
{enCoursMatiere ? "..." : "Ajouter"}
</button>
                    <button
                      type="button"
                      onClick={() => {
                                                setNouvelleMatiereOuvert(false);
                                                setNomNouvelleMatiere("");
                      }}
                      className="text-xs text-slate-500 dark:text-slate-400 hover:underline"
                    >
                                              Annuler
                        </button>
                        </div>
                )}
</Champ>

{matiereId && (
                    <Champ label="Chapitre">
                      <div className="flex flex-wrap gap-2">
{chapitres.map((c) => (
                          <Puce key={c.id} actif={chapitreId === c.id} onClick={() => setChapitreId(chapitreId === c.id ? "" : c.id)}>
{c.nom}
</Puce>
                      ))}
{!nouveauChapitreOuvert && (
                          <Puce pointille onClick={() => setNouveauChapitreOuvert(true)}>
                            + Nouveau
  </Puce>
                       )}
</div>
{nouveauChapitreOuvert && (
                        <div className="flex items-center gap-2 mt-2">
                          <input
                           value={nomNouveauChapitre}
                                                      onChange={(e) => setNomNouveauChapitre(e.target.value)}
                                                                                 placeholder="Nom du nouveau chapitre"
                                                                                                            className={`flex-1 ${CLASSE_INPUT}`}
                      />
                                              <button
                                                type="button"
                                                                          onClick={creerNouveauChapitre}
                                                                                                    disabled={enCoursChapitre || !nomNouveauChapitre.trim()}
                        className="rounded-xl px-3 py-2.5 text-xs font-medium text-white disabled:opacity-50 shadow-sm"
                                      style={{ background: "#4169E1" }}
                      >
{enCoursChapitre ? "..." : "Ajouter"}
</button>
                        <button
                          type="button"
                                                    onClick={() => {
                                                                                                          setNouveauChapitreOuvert(false);
                                                                                                          setNomNouveauChapitre("");
                                                    }}
                                                                                                      >
                                                                                                                                   Annuler
                                                                                </button>
                                                                                </div>
                                                                                                  )}
                                                                                                    </Champ>
                                                                                                                  )}

                                                                                                                    <Champ label="Type de devoir">
                                  <div className="grid grid-cols-3 gap-2">
                {TYPES_DEVOIR.map((t) => (
                                      <button
                                                        key={t.value}
                      type="button"
                      onClick={() => setType(t.value)}
                      className={`rounded-xl px-2 py-2 text-xs font-medium border transition ${
                                                type === t.value
                                                  ? "border-transparent text-white shadow-sm"
                                                  : "border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:border-slate-400"
                      }`}
                      style={type === t.value ? { background: "#4169E1" } : undefined}
                                            >
                      {t.label}
</button>
                  ))}
                    </div>
                    </Champ>

              <div className="grid grid-cols-2 gap-3">
                                    <Champ label="Date limite">
                                      <input
                    name="date_echeance"
                    type="date"
                    required
                    value={dateEcheance}
                    onChange={(e) => setDateEcheance(e.target.value)}
                    className={CLASSE_INPUT}
                  />
                      </Champ>
                <Champ label="Titre">
                                        <input
                    name="titre"
                    value={titre}
                    onChange={(e) => setTitre(e.target.value)}
                    placeholder="Nom du devoir"
                    className={CLASSE_INPUT}
                  />
                      </Champ>
                      </div>

{matiereId && (
                  <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-3.5 space-y-3 bg-slate-50 dark:bg-slate-800/40">
                    <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">Document à utiliser</p>

                  <div className="grid grid-cols-3 gap-2">
{MODES_DOCUMENT.map((m) => (
                        <button
                                            key={m.value}
                        type="button"
                        onClick={() => setModeDocument(m.value)}
                        className={`rounded-lg px-2 py-1.5 text-xs font-medium border transition ${
                                                    modeDocument === m.value
                                                      ? "border-transparent text-white shadow-sm"
                                                      : "border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:border-slate-400 bg-white dark:bg-slate-800"
                        }`}
                        style={modeDocument === m.value ? { background: "#4169E1" } : undefined}
                                                >
                        {m.label}
</button>
                    ))}
                      </div>

{modeDocument === "existant" &&
                      (documents.length > 0 ? (
                                              <select value={documentId} onChange={(e) => setDocumentId(e.target.value)} className={CLASSE_INPUT}>
                          <option value="">Aucun document</option>
{documents.map((d) => (
                            <option key={d.id} value={d.id}>
{d.nom}
</option>
                        ))}
                          </select>
                    ) : (
                                            <p className="text-xs text-slate-400">
                                              Aucun document déjà importé pour cette matière{chapitreId ? " / ce chapitre" : ""}.
</p>
                    ))}

{modeDocument === "import" && (
                      <div className="space-y-3">
                        <Champ label="Nom du document">
                          <input name="nom_fichier" placeholder="Ex. Chapitre 3 - Les fractions" className={CLASSE_INPUT} />
  </Champ>
                       <Champ label="Type de document">
                          <select name="type_fichier" defaultValue="" required className={CLASSE_INPUT}>
                            <option value="" disabled>
                              Choisir un type de document
  </option>
 {TYPES_DOCUMENT.map((t) => (
                               <option key={t.value} value={t.value}>
 {t.label}
   </option>
                           ))}
</select>
  </Champ>
                      <Champ label="Fichier à importer">
                          <FichierBouton
                          name="fichier"
                          nomFichier={nomFichierImport}
                          onChange={setNomFichierImport}
                          accept=".pdf,.doc,.docx,image/*"
                        />
                            </Champ>
                            </div>
                  )}

{modeDocument === "ia" && (
                      <div className="space-y-3">
                        <p className="text-xs text-slate-600 dark:text-slate-300">
                          L&apos;IA va générer <strong>{libelleIA(type, formatRevision)}</strong> (d&apos;après le type de devoir choisi ci-dessus).
                        Choisissez comment lui fournir la matière première :
                        </p>

                      {type === "revision" && (
                        <div className="flex flex-wrap gap-2">
                          <Puce actif={formatRevision === "synthese"} onClick={() => setFormatRevision("synthese")}>
                            📄 Synthèse à lire
                          </Puce>
                          <Puce actif={formatRevision === "flashcards"} onClick={() => setFormatRevision("flashcards")}>
                            🗂 Flashcards (cartes)
                          </Puce>
                        </div>
                      )}

                      <div className="grid grid-cols-2 gap-2">
                        {SOURCES_IA.map((s) => (
                                                    <button
                                                                    key={s.value}
                            type="button"
                            onClick={() => setSourceIA(s.value)}
                            className={`rounded-lg px-2 py-2 text-xs font-medium border transition text-left ${
                                                            sourceIA === s.value
                                                              ? "border-transparent text-white shadow-sm"
                                                              : "border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:border-slate-400 bg-white dark:bg-slate-800"
                            }`}
                            style={sourceIA === s.value ? { background: "#4169E1" } : undefined}
                                                        >
                            {s.label}
</button>
                        ))}
                          </div>
{sourceIA === "prompt" ? (
                          <div className="space-y-1.5">
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                              Aucun fichier : décrivez simplement ce que vous voulez, l&apos;IA rédige {libelleIA(type, formatRevision)} à partir de votre texte.
  </p>
                           <textarea
                             name="prompt_ia"
                             rows={3}
                             placeholder="Ex. « synthèse sur les fractions, niveau 6ème » ou « 8 exercices progressifs sur la conjugaison du présent »"
                             className={CLASSE_INPUT}
                           />
                               </div>
                       ) : (
                                                 <div className="space-y-3">
                                                   <p className="text-xs text-slate-500 dark:text-slate-400">
                                                     Étape 1 : importez le fichier de cours (PDF, Word ou image) qui servira de base.
                         </p>
                           <Champ label="Nom du cours source">
                                                     <input name="nom_fichier" placeholder="Ex. Cours sur la Révolution française" className={CLASSE_INPUT} />
                         </Champ>
                           <Champ label="Fichier du cours">
                                                     <FichierBouton
                               name="fichier_source"
                               nomFichier={nomFichierSource}
                               onChange={setNomFichierSource}
                               accept=".pdf,.doc,.docx,image/*"
                             />
                                 </Champ>
                         {!estFlashcardsFormat && (
                           <>
                           <p className="text-xs text-slate-500 dark:text-slate-400 pt-1">
                                                             Étape 2 (optionnelle) : précisez une consigne pour orienter {libelleIA(type, formatRevision)}.
 </p>
                           <textarea
                             name="consigne_ia"
                             rows={2}
                             placeholder="Ex. « insiste sur les dates clés » ou « questions faciles uniquement » — laissez vide pour une génération standard"
                             className={CLASSE_INPUT}
                           />
                           </>
                         )}
                               </div>
                      )}

{(type === "test" || estFlashcardsFormat) && !chapitreId && (
                          <p className="text-xs text-red-600">
                            Choisissez ou créez d&apos;abord un chapitre ci-dessus : un contenu généré par IA (test ou flashcards) doit être rattaché à un chapitre.
  </p>
                       )}
</div>
                  }
</div>
                )}
</form>

{/* Pied — actions */}
            <div className="px-5 py-3.5 border-t border-slate-200 dark:border-slate-700 flex items-center justify-end gap-2 shrink-0">
                          <button type="button" onClick={fermer} className="text-sm font-medium text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 px-3 py-2">
                              Annuler
              </button>
              <button
                type="submit"
                form="formulaire-nouveau-devoir"
                disabled={envoi}
                className="rounded-xl px-4 py-2 text-sm font-semibold text-white shadow-sm disabled:opacity-50 transition hover:brightness-95"
                style={{ background: "#4169E1" }}
              >
{envoi ? (modeDocument === "ia" ? "Génération en cours..." : "Création...") : "Créer le devoir"}
</button>
  </div>
  </div>
  </div>
      )}
</div>
  );
}
