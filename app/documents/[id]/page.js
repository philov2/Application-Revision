"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase, supabaseConfigured } from "@/lib/supabaseClient";
import { MarkdownDoc } from "@/components/markdownDoc";
import Navbar from "@/components/Navbar";

const LABEL_TYPE = {
  cours: "Cours",
  synthese: "Synthèse",
  exercice: "Exercices",
  test: "Test",
  flashcard: "Flashcard",
  corrige: "Corrigé",
};

// Page d'affichage d'un document. Les documents générés par IA (synthèses,
// exercices — fichiers .md bruts) sont mis en forme et présentés de façon
// lisible ici plutôt que d'ouvrir un fichier texte brut dans un nouvel
// onglet. Les autres documents (PDF, images, Word importés) sont simplement
// redirigés vers leur URL signée, comme avant.
//
// Accessible à tous les rôles connectés (Parent, Enfant, Soutien, Admin) :
// c'est la table "documents" (RLS) qui décide qui peut réellement voir quel
// document, pas cette page — comme partout ailleurs dans l'application.
export default function PageDocument() {
  const { id } = useParams();
  const router = useRouter();
  const [document, setDocument] = useState(null);
  const [contenuMarkdown, setContenuMarkdown] = useState(null);
  const [erreur, setErreur] = useState("");
  const [chargement, setChargement] = useState(true);
  const [compteId, setCompteId] = useState(null);
  const [role, setRole] = useState(null);
  const [nom, setNom] = useState(null);

  useEffect(() => {
    if (!supabaseConfigured || !id) return;
    let annule = false;
    (async () => {
      setChargement(true);
      setErreur("");

      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        router.replace("/login");
        return;
      }
      setCompteId(session.user.id);

      const { data: compte } = await supabase.from("comptes").select("nom, role").eq("id", session.user.id).single();
      if (!annule && compte) {
        setNom(compte.nom);
        setRole(compte.role);
      }

      const { data: doc, error } = await supabase
        .from("documents")
        .select("id, nom, type, format, fichier_url, genere_par_ia, enfant_id, created_at, matiere:matieres(nom, couleur), chapitre:chapitres(nom)")
        .eq("id", id)
        .single();

      if (annule) return;
      if (error || !doc) {
        setErreur("Document introuvable ou vous n'y avez pas accès.");
        setChargement(false);
        return;
      }
      setDocument(doc);

      const { data: signe, error: erreurSignature } = await supabase.storage.from("documents").createSignedUrl(doc.fichier_url, 300);
      if (erreurSignature || !signe) {
        setErreur(erreurSignature?.message || "Impossible d'ouvrir ce document.");
        setChargement(false);
        return;
      }

      const estMarkdown = (doc.format || "").includes("markdown") || (doc.genere_par_ia && (doc.fichier_url || "").endsWith(".md"));

      if (!estMarkdown) {
        // Documents importés (PDF, image, Word...) : comportement inchangé,
        // on ouvre directement le fichier original.
        window.location.replace(signe.signedUrl);
        return;
      }

      try {
        const reponse = await fetch(signe.signedUrl);
        const texte = await reponse.text();
        if (!annule) {
          setContenuMarkdown(texte);
          setChargement(false);
        }
      } catch (err) {
        if (!annule) {
          setErreur("Impossible de charger le contenu du document.");
          setChargement(false);
        }
      }
    })();
    return () => {
      annule = true;
    };
  }, [id]);

  return (
    <>
      <div className="print:hidden">
        <Navbar role={role} nom={nom} enfantId={document?.enfant_id} compteId={compteId} />
      </div>
      <main className="min-h-screen bg-slate-50 dark:bg-slate-950 py-8 px-4 print:bg-white print:py-0">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center justify-between mb-4 print:hidden">
            <button onClick={() => router.back()} className="text-sm font-medium text-slate-500 hover:text-slate-700 dark:hover:text-slate-300">
              ← Retour
            </button>
            {contenuMarkdown && (
              <button
                onClick={() => window.print()}
                className="text-sm font-medium rounded-lg px-3 py-1.5 border border-slate-300 dark:border-slate-600"
              >
                Imprimer / Enregistrer en PDF
              </button>
            )}
          </div>

          {chargement && <p className="text-sm text-slate-500 text-center py-16">Chargement du document...</p>}

          {!chargement && erreur && (
            <p className="text-sm text-red-600 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/40 rounded-xl px-4 py-3">
              {erreur}
            </p>
          )}

          {!chargement && !erreur && contenuMarkdown && document && (
            <article
              className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm ring-1 ring-black/5 dark:ring-white/10 overflow-hidden print:shadow-none print:ring-0"
              style={{ borderTop: `6px solid ${document.matiere?.couleur || "#4169E1"}` }}
            >
              <header className="px-6 sm:px-10 pt-8 pb-6 border-b border-slate-100 dark:border-slate-800">
                {document.genere_par_ia && (
                  <span
                    className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full mb-3"
                    style={{ background: "#e8f3ff", color: "#2E75B6" }}
                  >
                    ✨ Généré par IA
                  </span>
                )}
                <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{document.nom}</h1>
                <p className="text-sm text-slate-500 mt-1.5">
                  {LABEL_TYPE[document.type] || document.type}
                  {document.matiere?.nom ? ` · ${document.matiere.nom}` : ""}
                  {document.chapitre?.nom ? ` · ${document.chapitre.nom}` : ""}
                  {document.created_at ? ` · ${new Date(document.created_at).toLocaleDateString("fr-FR")}` : ""}
                </p>
              </header>
              <div className="px-6 sm:px-10 py-7">
                <MarkdownDoc texte={contenuMarkdown} />
              </div>
            </article>
          )}
        </div>
      </main>
    </>
  );
}
