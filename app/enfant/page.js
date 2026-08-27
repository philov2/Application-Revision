"use client";

import { useEffect, useRef, useState } from "react";
import Navbar from "@/components/Navbar";
import DemoBanner from "@/components/DemoBanner";
import DevoirCard from "@/components/DevoirCard";
import AuthGuard from "@/components/AuthGuard";
import MessagerieFamille from "@/components/MessagerieFamille";
import MatiereDocuments from "@/components/MatiereDocuments";
import { devoirsEnfant, matieres as matieresDemo } from "@/lib/sampleData";
import StatsDevoirs from "@/components/StatsDevoirs";
import ProgressionMatieres from "@/components/ProgressionMatieres";
import { filtrerDevoirsFaitsRecents, filtrerDevoirsEnAttenteCorrection, filtrerDevoirsArchives } from "@/lib/devoirsStats";
import { supabase, supabaseConfigured } from "@/lib/supabaseClient";
import { chargerDevoirs, basculerStatutDevoir } from "@/lib/devoirsSupabase";
import { compterNonLus } from "@/lib/messagesSupabase";
import { envoyerNotification } from "@/lib/notifications";
import BanniereEncouragement from "@/components/BanniereEncouragement";
import MinuteurFocus from "@/components/MinuteurFocus";
import MinuteurFocusMini from "@/components/MinuteurFocusMini";
import { useMinuteurFocus } from "@/lib/useMinuteurFocus";
import PersonnalisationEspace from "@/components/PersonnalisationEspace";

const LABEL_TYPE_NOTIF = { revision: "Réviser le cours", exercice: "Exercices", test: "Test" };

export default function DashboardEnfant() {
  return (
    <AuthGuard role="enfant">
      <Contenu />
    </AuthGuard>
  );
}

function Contenu() {
  const [devoirs, setDevoirs] = useState(supabaseConfigured ? [] : devoirsEnfant);
  const [enfantId, setEnfantId] = useState(null);
  const [nomEnfant, setNomEnfant] = useState("Rose");
  const [compteId, setCompteId] = useState(null);
  const [matieres, setMatieres] = useState(supabaseConfigured ? [] : matieresDemo);
  /* Jalon "repertoire d'archivage" (signalement de Phil) : l'Enfant peut */
  /* consulter le meme historique que Parent/Soutien, en lecture seule */
  /* (aucun bouton archiver/supprimer), comme son onglet Documents actuel. */
  /* Place en dernier dans la barre d'onglets (signalement de Phil), apres */
  /* Messages. */
  const [onglet, setOnglet] = useState("devoirs"); /* "devoirs" | "documents" | "messages" | "archives" | "focus" */
  /* Jalon "minuteur focus" (suite, signalement de Phil) : instancié ici, au */
  /* niveau du dashboard, pour que le minuteur et la plante continuent de */
  /* tourner meme quand on quitte l'onglet Focus pour aller travailler. */
  const minuteur = useMinuteurFocus();
  /* Jalon "personnalisation de l'espace Enfant" (signalement de Phil) : */
  /* couleur d'accent choisie librement par l'enfant, chargée avec le reste */
  /* du compte ci-dessous et utilisée pour l'onglet actif + le bouton */
  /* Démarrer du minuteur Focus (voir components/PersonnalisationEspace.js */
  /* et app/api/mon-compte/route.js). */
  const [couleurAccent, setCouleurAccent] = useState(null);
  const [nonLus, setNonLus] = useState(0);
  const devoirsRef = useRef(null);
  const nonLusRef = useRef(null);

  /* Compare la nouvelle liste de devoirs à la précédente pour détecter deux */
  /* événements qui méritent une notification : un nouveau devoir apparu, ou */
  /* un exercice qui vient d'être corrigé (note passée de rien à une valeur). */
  /* Ne notifie jamais au tout premier chargement (devoirsRef encore vide), */
  /* pour ne pas bombarder l'enfant de notifications sur des devoirs déjà là. */
  function detecterNouveautes(liste) {
    if (devoirsRef.current) {
      const precedents = new Map(devoirsRef.current.map((d) => [d.id, d]));
      liste.forEach((d) => {
        const avant = precedents.get(d.id);
        if (!avant) {
          envoyerNotification("Nouveau devoir", `${d.matiere} · ${LABEL_TYPE_NOTIF[d.type] || d.type}`);
          return;
        }
        const noteAvant = avant.reponseExercice?.note ?? null;
        const noteApres = d.reponseExercice?.note ?? null;
        if (noteAvant == null && noteApres != null) {
          envoyerNotification("Devoir corrigé", `${d.matiere} — ${noteApres}/20`);
        }
      });
    }
    devoirsRef.current = liste;
  }

  async function recharger(id) {
    const liste = await chargerDevoirs(id);
    detecterNouveautes(liste);
    setDevoirs(liste);
  }

  useEffect(() => {
    if (!supabaseConfigured) return;
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      setCompteId(session.user.id);

      const { data: compte } = await supabase.from("comptes").select("nom, role, couleur_accent").eq("id", session.user.id).single();
      const { data: mats } = await supabase.from("matieres").select("id, nom, couleur").order("nom");
      if (mats) setMatieres(mats);
      if (compte?.couleur_accent) setCouleurAccent(compte.couleur_accent);

      if (compte?.role === "admin") {
        const { data: enfants } = await supabase.from("comptes").select("id, nom").eq("role", "enfant").limit(1);
        const enfant = enfants && enfants[0];
        if (enfant) {
          setEnfantId(enfant.id);
          setNomEnfant(enfant.nom);
          await recharger(enfant.id);
        }
        return;
      }

      setEnfantId(session.user.id);
      if (compte?.nom) setNomEnfant(compte.nom);
      await recharger(session.user.id);
    })();
  }, []);

  useEffect(() => {
    if (!supabaseConfigured || !enfantId || !compteId) {
      setNonLus(0);
      return;
    }
    let annule = false;
    nonLusRef.current = null;
    async function rafraichirNonLus() {
      try {
        const n = await compterNonLus(enfantId, compteId);
        if (!annule) {
          if (nonLusRef.current !== null && n > nonLusRef.current) {
            envoyerNotification("Nouveau message", "Vous avez un nouveau message dans la messagerie.");
          }
          nonLusRef.current = n;
          setNonLus(n);
        }
      } catch {
        /* ignore */
      }
    }
    rafraichirNonLus();
    const intervalle = setInterval(rafraichirNonLus, 15000);
    return () => {
      annule = true;
      clearInterval(intervalle);
    };
  }, [enfantId, compteId, onglet]);

  /* Vérifie régulièrement l'arrivée de nouveaux devoirs ou de corrections, */
  /* même si l'onglet Devoirs n'est pas affiché (ex. enfant en train de lire */
  /* ses messages) — c'est recharger() qui compare et notifie si besoin. */
  useEffect(() => {
    if (!supabaseConfigured || !enfantId) return;
    const intervalle = setInterval(() => recharger(enfantId), 20000);
    return () => clearInterval(intervalle);
  }, [enfantId]);

  async function toggle(id) {
    if (supabaseConfigured && enfantId) {
      const devoir = devoirs.find((d) => d.id === id);
      const nouveauStatut = devoir?.statut === "fait" ? "a_faire" : "fait";
      await basculerStatutDevoir(id, nouveauStatut);
      await recharger(enfantId);
      return;
    }
    setDevoirs((prev) =>
      prev.map((d) => {
        if (d.id !== id) return d;
        const nouveauStatut = d.statut === "fait" ? "a_faire" : "fait";
        return { ...d, statut: nouveauStatut, date_realisation: nouveauStatut === "fait" ? new Date().toISOString().slice(0, 10) : d.date_realisation };
      })
    );
  }

  const aFaire = devoirs.filter((d) => d.statut === "a_faire").sort((a, b) => a.echeance.localeCompare(b.echeance));
  const enAttenteCorrection = filtrerDevoirsEnAttenteCorrection(devoirs);
  const faits = filtrerDevoirsFaitsRecents(devoirs);
  const archives = filtrerDevoirsArchives(devoirs);

  /* Jalon "personnalisation de l'espace Enfant" : l'onglet actif se */
  /* souligne avec la couleur choisie par l'enfant s'il y en a une, sinon */
  /* on garde l'apparence par défaut (noir / blanc en mode sombre) plutôt */
  /* que de forcer une couleur avant même que l'enfant n'ait rien choisi. */
  function classeOnglet(actif) {
    if (!actif) return "px-4 py-2 text-sm font-medium border-b-2 -mb-px border-transparent text-slate-500 dark:text-slate-400";
    return `px-4 py-2 text-sm font-medium border-b-2 -mb-px ${couleurAccent ? "border-transparent" : "border-slate-900 dark:border-white"}`;
  }
  function styleOnglet(actif) {
    return actif && couleurAccent ? { borderColor: couleurAccent } : {};
  }

  return (
    <>
      <DemoBanner />
      <Navbar role="enfant" nom={nomEnfant} enfantId={enfantId} compteId={compteId} />
      <main className="flex-1 max-w-3xl w-full mx-auto px-4 py-8 space-y-8">
        <div className="flex gap-2 border-b border-slate-200 dark:border-slate-700 flex-wrap">
          <button onClick={() => setOnglet("devoirs")} className={classeOnglet(onglet === "devoirs")} style={styleOnglet(onglet === "devoirs")}>
            Mes devoirs
          </button>
          <button onClick={() => setOnglet("documents")} className={classeOnglet(onglet === "documents")} style={styleOnglet(onglet === "documents")}>
            Chapitres et documents
          </button>
          <button onClick={() => setOnglet("messages")} className={`${classeOnglet(onglet === "messages")} flex items-center gap-1.5`} style={styleOnglet(onglet === "messages")}>
            Messages
            {nonLus > 0 && (
              <span className="inline-flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold h-4 min-w-4 px-1">
                {nonLus}
              </span>
            )}
          </button>
          <button onClick={() => setOnglet("archives")} className={classeOnglet(onglet === "archives")} style={styleOnglet(onglet === "archives")}>
            🗄 Archives
          </button>
          <button onClick={() => setOnglet("focus")} className={classeOnglet(onglet === "focus")} style={styleOnglet(onglet === "focus")}>
            🌱 Focus
          </button>
        </div>

        {onglet === "devoirs" && (
          <>
            <BanniereEncouragement devoirs={devoirs} />
            <StatsDevoirs devoirs={devoirs} />
            <ProgressionMatieres devoirs={devoirs} />
            <section>
              <h2 className="font-semibold mb-3">À faire ({aFaire.length})</h2>
              <div className="space-y-3">
                {aFaire.map((d) => <DevoirCard key={d.id} devoir={d} onToggle={toggle} enfantId={enfantId} onChange={() => recharger(enfantId)} />)}
                {aFaire.length === 0 && <p className="text-slate-500 dark:text-slate-400 text-sm">Rien à faire pour le moment, bravo !</p>}
              </div>
            </section>
            {enAttenteCorrection.length > 0 && (
              <section>
                <h2 className="font-semibold mb-3">Fait - en attente de correction ({enAttenteCorrection.length})</h2>
                <div className="space-y-3">
                  {enAttenteCorrection.map((d) => <DevoirCard key={d.id} devoir={d} onToggle={toggle} enfantId={enfantId} onChange={() => recharger(enfantId)} />)}
                </div>
              </section>
            )}
            <section>
              <h2 className="font-semibold mb-3 flex items-center gap-1.5 text-green-700 dark:text-green-400">
                <span aria-hidden="true">✓</span> Déjà fait ({faits.length})
              </h2>
              <div className="space-y-3">
                {faits.map((d) => <DevoirCard key={d.id} devoir={d} onToggle={toggle} enfantId={enfantId} onChange={() => recharger(enfantId)} />)}
              </div>
            </section>
          </>
        )}

        {onglet === "documents" && enfantId && (
          <section>
            <h2 className="font-semibold mb-3">Chapitres et documents</h2>
            <div className="space-y-4">
              {matieres.map((m) => (
                <MatiereDocuments key={m.id} matiere={m} enfantId={enfantId} compteId={compteId} lectureSeule />
              ))}
              {matieres.length === 0 && <p className="text-slate-500 dark:text-slate-400 text-xs">Aucune matière pour l&apos;instant.</p>}
            </div>
          </section>
        )}

        {onglet === "messages" && enfantId && compteId && (
          <section>
            <MessagerieFamille enfantId={enfantId} compteId={compteId} titre="Messages" />
          </section>
        )}

        {onglet === "archives" && enfantId && (
          <>
            <section>
              <h2 className="font-semibold mb-3">🗄 Devoirs archivés ({archives.length})</h2>
              <div className="space-y-3">
                {archives.map((d) => <DevoirCard key={d.id} devoir={d} enfantId={enfantId} />)}
                {archives.length === 0 && <p className="text-slate-500 dark:text-slate-400 text-sm">Aucun devoir archivé pour l&apos;instant.</p>}
              </div>
            </section>
            <section>
              <h2 className="font-semibold mb-3">🗄 Documents archivés</h2>
              <div className="space-y-4">
                {matieres.map((m) => (
                  <MatiereDocuments key={m.id} matiere={m} enfantId={enfantId} compteId={compteId} lectureSeule modeArchive />
                ))}
              </div>
            </section>
          </>
        )}

        {onglet === "focus" && (
          <section className="space-y-4">
            <MinuteurFocus minuteur={minuteur} couleurAccent={couleurAccent} />
            <PersonnalisationEspace couleurActuelle={couleurAccent} onChange={setCouleurAccent} />
          </section>
        )}

        {onglet !== "focus" && (
          <MinuteurFocusMini minuteur={minuteur} onOuvrir={() => setOnglet("focus")} />
        )}
      </main>
    </>
  );
}
