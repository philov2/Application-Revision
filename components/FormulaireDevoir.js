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
  { value: "existant", label: "Document existant" },
  { value: "import", label: "Importer un fichier" },
  { value: "ia", label: "Générer par IA" },
];

// Champ de formulaire réutilisable : libellé au-dessus, style commun.
function Champ({ label, children }) {
  return (
    <label className="block space-y-1.5">
      <span className="block text-xs font-semibold text-slate-600 dark:text-slate-300">{label}</span>
      {children}
    </label>
  );
}

const CLASSE_INPUT =
  "w-full rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800/60 px-3.5 py-2.5 text-sm shadow-sm transition focus:outline-none focus:ring-2 focus:ring-[#91CAFF] focus:border-transparent";

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

  const [documents, setDocuments] = useState([]);
  const [documentId, setDocumentId] = useState("");
  const [modeDocument, setModeDocument] = useState("existant"); // "existant" | "import" | "ia"

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
        if (type === "test" && !chapitreId) {
          throw new Error("Choisissez ou créez d'abord un chapitre : un test généré par IA doit être rattaché à un chapitre.");
        }

        const fichierSource = form.get("fichier_source");
        const promptIA = (form.get("prompt_ia") || "").trim();

        if (fichierSource && fichierSource.size > 0) {
          // Génération à partir d'un cours importé (comportement existant).
          const coursSource = await importerDocument(fichierSource, form.get("nom_fichier") || fichierSource.name, "cours");
          const route = ROUTES_IA_AVEC_DOCUMENT[type];
          if (type === "test") {
            await authFetch(`/api/documents/${coursSource.id}/${route}`, { method: "POST" });
            documentIdAEnvoyer = coursSource.id;
          } else {
            const resultat = await authFetch(`/api/documents/${coursSource.id}/${route}`, { method: "POST" });
            documentIdAEnvoyer = resultat.document.id;
          }
        } else if (promptIA) {
          // Génération directement à partir d'un prompt, sans document source.
          if (type === "test") {
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
        } else {
          throw new Error("Importez un fichier de cours ou décrivez ce que vous voulez générer par IA.");
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
      setTitre("");
      setDateEcheance("");
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
        className="text-sm font-medium rounded-lg px-3.5 py-1.5 text-slate-900 shadow-sm transition hover:brightness-95 active:brightness-90"
        style={{ background: "#91CAFF" }}
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
              style={{ background: "linear-gradient(135deg, #91CAFF, #c3e0ff)" }}
            >
              <div>
                <h2 className="text-base font-semibold text-slate-900">Nouveau devoir</h2>
                <p className="text-xs text-slate-700/80 mt-0.5">Créez un devoir de révision, d&apos;exercices ou de test.</p>
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

              <Champ label="Titre (optionnel)">
                <input
                  name="titre"
                  value={titre}
                  onChange={(e) => setTitre(e.target.value)}
                  placeholder="Nom du devoir"
                  className={CLASSE_INPUT}
                />
              </Champ>

              <Champ label="Matière">
                {!nouvelleMatiereOuvert ? (
                  <div className="space-y-1.5">
                    <select
                      name="matiere_id"
                      required
                      value={matiereId}
                      onChange={(e) => {
                        setMatiereId(e.target.value);
                        setChapitreId("");
                      }}
                      className={CLASSE_INPUT}
                    >
                      <option value="">Choisir une matiere</option>
                      {matieresLocales.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.nom}
                        </option>
                      ))}
                    </select>
                    <button type="button" onClick={() => setNouvelleMatiereOuvert(true)} className="text-xs font-medium text-blue-600 hover:underline">
                      + Créer une nouvelle matière
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
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
                      className="rounded-xl px-3 py-2.5 text-xs font-medium disabled:opacity-50 shadow-sm"
                      style={{ background: "#91CAFF" }}
                    >
                      {enCoursMatiere ? "..." : "Ajouter"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setNouvelleMatiereOuvert(false);
                        setNomNouvelleMatiere("");
                      }}
                      className="text-xs text-slate-500 hover:underline"
                    >
                      Annuler
                    </button>
                  </div>
                )}
              </Champ>

              {matiereId && (
                <Champ label="Chapitre (optionnel)">
                  {!nouveauChapitreOuvert ? (
                    <div className="space-y-1.5">
                      <select name="chapitre_id" value={chapitreId} onChange={(e) => setChapitreId(e.target.value)} className={CLASSE_INPUT}>
                        <option value="">Aucun chapitre</option>
                        {chapitres.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.nom}
                          </option>
                        ))}
                      </select>
                      <button type="button" onClick={() => setNouveauChapitreOuvert(true)} className="text-xs font-medium text-blue-600 hover:underline">
                        + Créer un nouveau chapitre
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
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
                        className="rounded-xl px-3 py-2.5 text-xs font-medium disabled:opacity-50 shadow-sm"
                        style={{ background: "#91CAFF" }}
                      >
                        {enCoursChapitre ? "..." : "Ajouter"}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setNouveauChapitreOuvert(false);
                          setNomNouveauChapitre("");
                        }}
                        className="text-xs text-slate-500 hover:underline"
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
                          ? "border-transparent text-slate-900 shadow-sm"
                          : "border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:border-slate-400"
                      }`}
                      style={type === t.value ? { background: "#91CAFF" } : undefined}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </Champ>

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

              {matiereId && (
                <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-3.5 space-y-3 bg-slate-50 dark:bg-slate-800/40">
                  <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">Document à utiliser (optionnel)</p>

                  <div className="grid grid-cols-3 gap-2">
                    {MODES_DOCUMENT.map((m) => (
                      <button
                        key={m.value}
                        type="button"
                        onClick={() => setModeDocument(m.value)}
                        className={`rounded-lg px-2 py-1.5 text-xs font-medium border transition ${
                          modeDocument === m.value
                            ? "border-transparent text-slate-900 shadow-sm"
                            : "border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:border-slate-400 bg-white dark:bg-slate-800"
                        }`}
                        style={modeDocument === m.value ? { background: "#91CAFF" } : undefined}
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
                    <div className="space-y-2">
                      <input name="nom_fichier" placeholder="Nom du document (optionnel)" className={CLASSE_INPUT} />
                      <select name="type_fichier" className={CLASSE_INPUT}>
                        {TYPES_DOCUMENT.map((t) => (
                          <option key={t.value} value={t.value}>
                            {t.label}
                          </option>
                        ))}
                      </select>
                      <input name="fichier" type="file" className="w-full text-xs" />
                    </div>
                  )}

                  {modeDocument === "ia" && (
                    <div className="space-y-2">
                      <p className="text-xs text-slate-500">
                        {LABEL_IA_PAR_TYPE[type]} — importez un cours source, ou décrivez ce que vous voulez sans fichier.
                      </p>
                      <input name="nom_fichier" placeholder="Nom du cours source (optionnel, si vous importez un fichier)" className={CLASSE_INPUT} />
                      <input name="fichier_source" type="file" className="w-full text-xs" />
                      <p className="text-xs text-slate-400 text-center">— ou —</p>
                      <textarea
                        name="prompt_ia"
                        rows={3}
                        placeholder="Décrivez ce que l'IA doit générer, sans fichier (ex. « synthèse sur les fractions, niveau 6ème » ou « 8 exercices progressifs sur la conjugaison du présent »)"
                        className={CLASSE_INPUT}
                      />
                      {type === "test" && !chapitreId && (
                        <p className="text-xs text-red-600">
                          Choisissez ou créez d&apos;abord un chapitre ci-dessus : un test généré par IA doit être rattaché à un chapitre.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}
            </form>

            {/* Pied — actions */}
            <div className="px-5 py-3.5 border-t border-slate-200 dark:border-slate-700 flex items-center justify-end gap-2 shrink-0">
              <button type="button" onClick={fermer} className="text-sm font-medium text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 px-3 py-2">
                Annuler
              </button>
              <button
                type="submit"
                form="formulaire-nouveau-devoir"
                disabled={envoi}
                className="rounded-xl px-4 py-2 text-sm font-semibold text-slate-900 shadow-sm disabled:opacity-50 transition hover:brightness-95"
                style={{ background: "#91CAFF" }}
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
