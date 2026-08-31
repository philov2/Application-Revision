"use client";  import { useEffect, useState } from "react"; import Navbar from "@/components/Navbar"; import DemoBanner from "@/components/DemoBanner"; import AuthGuard from "@/components/AuthGuard"; import { supabase, supabaseConfigured } from "@/lib/supabaseClient"; import { authFetch } from "@/lib/authFetch"; import { demandesAdmin } from "@/lib/sampleData"; import { choisirCouleurMatiere } from "@/lib/couleursMatieres";  /* Styles de pastilles repris de MatiereDocuments.js pour que la suppression    d'une matière ait la même confirmation "Sûr ? / Oui / Annuler" partout    dans l'application, que ce soit ici (Admin) ou dans l'onglet Chapitres et    documents (Parent). */ const PILL_NEUTRE =   "inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium border border-slate-300 dark:border-slate-600 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"; const PILL_DANGER =   "inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900/50"; const PILL_DANGER_SOLIDE =   "inline-flex items-center px-2 py-0.5 rounded-md text-xs font-display font-semibold bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"; const PILL_AVERTISSEMENT =   "inline-flex items-center px-2 py-0.5 rounded-md text-xs font-display font-semibold bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400";  export default function DashboardAdmin() {   return (     <AuthGuard role="admin">       <Contenu />     </AuthGuard>   ); }  function Contenu() {   const [demandes, setDemandes] = useState(supabaseConfigured ? [] : demandesAdmin);   const [erreur, setErreur] = useState("");   const [enCoursValidation, setEnCoursValidation] = useState(new Set());   const [enCoursRejet, setEnCoursRejet] = useState(new Set());   /* "Philippe" restait affiche en dur meme apres suppression du compte */   /* correspondant (signalement de Phil sur la meme confusion cote Soutien) : */   /* on va desormais chercher le vrai nom du compte admin connecte. */   const [nomAdmin, setNomAdmin] = useState("Administrateur");    /* Jalon "gestion des matières côté Admin" (signalement de Phil : il faut */   /* pouvoir donner à l'administrateur et aux parents la possibilité de */   /* créer et de supprimer des matières). L'admin voit toutes les matières */   /* du référentiel commun, comme le fait déjà le tableau de bord Parent. */   const [matieres, setMatieres] = useState([]);   const [nouvelleMatiereOuvert, setNouvelleMatiereOuvert] = useState(false);   const [nomNouvelleMatiere, setNomNouvelleMatiere] = useState("");   const [enCoursMatiere, setEnCoursMatiere] = useState(false);   const [messageMatieres, setMessageMatieres] = useState("");   const [enConfirmationSuppressionMatiere, setEnConfirmationSuppressionMatiere] = useState(null);   const [enCoursSuppressionMatiere, setEnCoursSuppressionMatiere] = useState(new Set()); /* Meme jalon, chapitres : chaque matiere peut etre depliee pour gerer ses chapitres (creation + suppression), meme principe que MatiereDocuments.js cote Parent/Soutien. */ const [chapitresOuverts, setChapitresOuverts] = useState({}); const [chapitresParMatiere, setChapitresParMatiere] = useState({}); const [chargementChapitres, setChargementChapitres] = useState(new Set()); const [nouveauChapitreMatiereId, setNouveauChapitreMatiereId] = useState(null); const [nomNouveauChapitreAdmin, setNomNouveauChapitreAdmin] = useState(""); const [enCoursChapitreAdmin, setEnCoursChapitreAdmin] = useState(false); const [messageChapitres, setMessageChapitres] = useState(""); const [enConfirmationSuppressionChapitre, setEnConfirmationSuppressionChapitre] = useState(null); const [enCoursSuppressionChapitre, setEnCoursSuppressionChapitre] = useState(new Set()); /* Renommage (corrige une erreur de frappe sans supprimer/recreer) — matiere et chapitres, meme principe que MatiereDocuments.js cote Parent/Soutien. */ const [matiereEnRenommage, setMatiereEnRenommage] = useState(null); const [nomMatiereEditee, setNomMatiereEditee] = useState(""); const [enCoursRenommageMatiere, setEnCoursRenommageMatiere] = useState(new Set()); const [chapitreEnRenommageAdmin, setChapitreEnRenommageAdmin] = useState(null); const [nomChapitreEditeAdmin, setNomChapitreEditeAdmin] = useState(""); const [enCoursRenommageChapitreAdmin, setEnCoursRenommageChapitreAdmin] = useState(new Set()); const [diagnosticIA, setDiagnosticIA] = useState(null); const [enCoursDiagnosticIA, setEnCoursDiagnosticIA] = useState(false); async function testerIA() { setEnCoursDiagnosticIA(true); setDiagnosticIA(null); try { const resultat = await authFetch("/api/admin/diagnostic-ia"); setDiagnosticIA(resultat); } catch (err) { setDiagnosticIA({ erreur: err.message }); } finally { setEnCoursDiagnosticIA(false); } }    useEffect(() => {     if (!supabaseConfigured) return;     (async () => {       const { data: { session } } = await supabase.auth.getSession();       if (session) {         const { data: compte } = await supabase.from("comptes").select("nom").eq("id", session.user.id).single();         if (compte?.nom) setNomAdmin(compte.nom);       }       const { data } = await supabase         .from("demandes_comptes")         .select("*")         .eq("statut", "en_attente")         .order("date_demande", { ascending: true });       setDemandes(data || []);        const { data: mats } = await supabase.from("matieres").select("id, nom, couleur").order("nom");       if (mats) setMatieres(mats);     })();   }, []);    async function valider(id) {     if (enCoursValidation.has(id) || enCoursRejet.has(id)) return;     setErreur("");     if (!supabaseConfigured) {       setDemandes((prev) => prev.filter((d) => d.id !== id));       return;     }     setEnCoursValidation((prev) => new Set(prev).add(id));     try {       await authFetch(`/api/demandes/${id}/valider`, { method: "POST" });       setDemandes((prev) => prev.filter((d) => d.id !== id));     } catch (err) {       setErreur(err.message);     } finally {       setEnCoursValidation((prev) => {         const next = new Set(prev);         next.delete(id);         return next;       });     }   }    async function rejeter(id) {     if (enCoursValidation.has(id) || enCoursRejet.has(id)) return;     setErreur("");     if (!supabaseConfigured) {       setDemandes((prev) => prev.filter((d) => d.id !== id));      return;     }     setEnCoursRejet((prev) => new Set(prev).add(id));     try {       await authFetch(`/api/demandes/${id}/rejeter`, { method: "POST" });       setDemandes((prev) => prev.filter((d) => d.id !== id));     } catch (err) {       setErreur(err.message);     } finally {       setEnCoursRejet((prev) => {         const next = new Set(prev);         next.delete(id);         return next;       });     }   }    async function creerNouvelleMatiere(e) {     e.preventDefault();     const nomMatiereSaisi = nomNouvelleMatiere.trim();     if (!nomMatiereSaisi) return;     setMessageMatieres("");     if (matieres.some((m) => m.nom.trim().toLowerCase() === nomMatiereSaisi.toLowerCase())) {       setMessageMatieres("Cette matière existe déjà.");       return;     }     setEnCoursMatiere(true);     try {       const couleur = choisirCouleurMatiere(nomMatiereSaisi, matieres);       const { data, error } = await supabase.from("matieres").insert({ nom: nomMatiereSaisi, couleur }).select().single();       if (error) throw error;       setMatieres((prev) => [...prev, data].sort((a, b) => a.nom.localeCompare(b.nom)));       setNomNouvelleMatiere("");       setNouvelleMatiereOuvert(false);     } catch (err) {       setMessageMatieres(err.message);     } finally {       setEnCoursMatiere(false);     }   }    async function supprimerMatiere(id) {     setEnCoursSuppressionMatiere((prev) => new Set(prev).add(id));     setMessageMatieres("");     try {       await authFetch(`/api/matieres/${id}`, { method: "DELETE" });       setMatieres((prev) => prev.filter((m) => m.id !== id));       setEnConfirmationSuppressionMatiere(null);     } catch (err) {       setMessageMatieres(err.message);     } finally {       setEnCoursSuppressionMatiere((prev) => {         const next = new Set(prev);         next.delete(id);         return next;       });     }   }

  /* Deplie/replie la liste des chapitres d'une matiere ; charge les chapitres
     depuis Supabase la premiere fois qu'une matiere est depliee (mis en cache
     ensuite dans chapitresParMatiere pour ne pas les recharger a chaque clic). */
  async function basculerChapitres(matiereId) {
    setChapitresOuverts((prev) => ({ ...prev, [matiereId]: !prev[matiereId] }));
    if (chapitresParMatiere[matiereId]) return;
    setChargementChapitres((prev) => new Set(prev).add(matiereId));
    const { data } = await supabase.from("chapitres").select("id, nom").eq("matiere_id", matiereId).order("nom");
    setChapitresParMatiere((prev) => ({ ...prev, [matiereId]: data || [] }));
    setChargementChapitres((prev) => {
      const next = new Set(prev);
      next.delete(matiereId);
      return next;
    });
  }

  async function creerNouveauChapitreAdmin(e, matiereId) {
    e.preventDefault();
    const nomChapitreSaisi = nomNouveauChapitreAdmin.trim();
    if (!nomChapitreSaisi) return;
    setMessageChapitres("");
    const chapitresExistants = chapitresParMatiere[matiereId] || [];
    if (chapitresExistants.some((c) => c.nom.trim().toLowerCase() === nomChapitreSaisi.toLowerCase())) {
      setMessageChapitres("Ce chapitre existe déjà dans cette matière.");
      return;
    }
    setEnCoursChapitreAdmin(true);
    try {
      const { data, error } = await supabase.from("chapitres").insert({ matiere_id: matiereId, nom: nomChapitreSaisi }).select().single();
      if (error) throw error;
      setChapitresParMatiere((prev) => ({
        ...prev,
        [matiereId]: [...(prev[matiereId] || []), data].sort((a, b) => a.nom.localeCompare(b.nom)),
      }));
      setNomNouveauChapitreAdmin("");
      setNouveauChapitreMatiereId(null);
    } catch (err) {
      setMessageChapitres(err.message);
    } finally {
      setEnCoursChapitreAdmin(false);
    }
  }

  async function supprimerChapitreAdmin(id, matiereId) {
    setEnCoursSuppressionChapitre((prev) => new Set(prev).add(id));
    setMessageChapitres("");
    try {
      await authFetch(`/api/chapitres/${id}`, { method: "DELETE" });
      setChapitresParMatiere((prev) => ({
        ...prev,
        [matiereId]: (prev[matiereId] || []).filter((c) => c.id !== id),
      }));
      setEnConfirmationSuppressionChapitre(null);
    } catch (err) {
      setMessageChapitres(err.message);
    } finally {
      setEnCoursSuppressionChapitre((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  }

  /* Renomme une matiere (corrige une erreur de frappe) sans avoir a la
     supprimer puis la recreer, ce qui ferait perdre son historique de
     chapitres/documents/devoirs -- voir app/api/matieres/[id]/route.js. */
  async function renommerMatiereAdmin(e, id) {
    e.preventDefault();
    const nom = nomMatiereEditee.trim();
    if (!nom) return;
    setMessageMatieres("");
    setEnCoursRenommageMatiere((prev) => new Set(prev).add(id));
    try {
      await authFetch(`/api/matieres/${id}`, { method: "PATCH", body: JSON.stringify({ nom }) });
      setMatieres((prev) => prev.map((m) => (m.id === id ? { ...m, nom } : m)).sort((a, b) => a.nom.localeCompare(b.nom)));
      setMatiereEnRenommage(null);
    } catch (err) {
      setMessageMatieres(err.message);
    } finally {
      setEnCoursRenommageMatiere((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  }

  /* Meme principe pour un chapitre : renommage plutot que supprimer/recreer. */
  async function renommerChapitreAdmin(e, id, matiereId) {
    e.preventDefault();
    const nom = nomChapitreEditeAdmin.trim();
    if (!nom) return;
    setMessageChapitres("");
    setEnCoursRenommageChapitreAdmin((prev) => new Set(prev).add(id));
    try {
      await authFetch(`/api/chapitres/${id}`, { method: "PATCH", body: JSON.stringify({ nom }) });
      setChapitresParMatiere((prev) => ({
        ...prev,
        [matiereId]: (prev[matiereId] || []).map((c) => (c.id === id ? { ...c, nom } : c)).sort((a, b) => a.nom.localeCompare(b.nom)),
      }));
      setChapitreEnRenommageAdmin(null);
    } catch (err) {
      setMessageChapitres(err.message);
    } finally {
      setEnCoursRenommageChapitreAdmin((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  }

  return (     <>       <DemoBanner />       <Navbar role="admin" nom={nomAdmin} />       <main className="flex-1 max-w-3xl w-full mx-auto px-4 py-8 space-y-8">         <section>           <h2 className="font-display font-semibold mb-3">Demandes en attente ({demandes.length})</h2>           {erreur && <p className="text-sm text-red-600">{erreur}</p>}           <div className="space-y-3">             {demandes.map((d) => (               <div key={d.id} className="rounded-xl border border-slate-200 dark:border-slate-700 p-4 flex items-center justify-between gap-4">                 <div>                   <p className="font-medium">{d.type_compte === "soutien" ? "Nouveau compte Soutien" : d.type_compte === "coparent" ? "Nouveau compte Co-parent" : d.type ? d.type : "Nouveau compte Parent"}</p>                   <p className="text-sm text-slate-500 dark:text-slate-400">{d.nom} · {d.email}{d.telephone ? ` · ${d.telephone}` : ""}</p>                   <p className="text-xs text-slate-400">Reçue le {(d.date_demande || d.date || "").toString().slice(0, 10)}</p>                 </div>                 <div className="flex items-center gap-2">                   <button                     onClick={() => valider(d.id)}                     disabled={enCoursValidation.has(d.id) || enCoursRejet.has(d.id)}                     className="rounded-lg px-4 py-2 text-sm font-medium text-white disabled:opacity-50"                     style={{ background: "var(--azur)" }}                   >                     {enCoursValidation.has(d.id) ? "Validation..." : "Valider"}                   </button>                   <button                     onClick={() => rejeter(d.id)}                     disabled={enCoursValidation.has(d.id) || enCoursRejet.has(d.id)}                     className="rounded-lg px-4 py-2 text-sm font-medium border border-slate-300 dark:border-slate-600 disabled:opacity-50"                   >                     {enCoursRejet.has(d.id) ? "Rejet..." : "Rejeter"}                   </button>                 </div>               </div>             ))}             {demandes.length === 0 && <p className="text-slate-500 dark:text-slate-400 text-sm">Aucune demande en attente.</p>}           </div>         </section>          {supabaseConfigured && (           <section>             <div className="flex items-center justify-between mb-3">               <h2 className="font-display font-semibold">Matières ({matieres.length})</h2>               <button onClick={() => setNouvelleMatiereOuvert((v) => !v)} className="text-sm font-medium rounded-lg px-3 py-1.5 border border-dashed border-slate-400">                 + Nouvelle matière               </button>             </div>             {messageMatieres && <p className="text-sm text-red-600 mb-2">{messageMatieres}</p>} {messageChapitres && <p className="text-sm text-red-600 mb-2">{messageChapitres}</p>}             {nouvelleMatiereOuvert && (               <form onSubmit={creerNouvelleMatiere} className="flex items-center gap-2 mb-3">                 <input value={nomNouvelleMatiere} onChange={(e) => setNomNouvelleMatiere(e.target.value)} placeholder="Nom de la nouvelle matière" className="flex-1 rounded-lg border border-slate-300 dark:border-slate-600 bg-transparent px-3 py-2 text-sm" />                 <button type="submit" disabled={enCoursMatiere || !nomNouvelleMatiere.trim()} className="rounded-lg px-3 py-2 text-xs font-medium text-white disabled:opacity-50" style={{ background: "var(--azur)" }}>                   {enCoursMatiere ? "..." : "Ajouter"}                 </button>               </form>             )}             <div className="space-y-2">               {matieres.map((m) => (                 <div key={m.id} className="rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm" style={{ borderLeft: `6px solid ${m.couleur}` }}>
                  <div className="flex items-center justify-between gap-2">
                    {matiereEnRenommage === m.id ? (
                      <form onSubmit={(e) => renommerMatiereAdmin(e, m.id)} className="flex-1 flex items-center gap-1.5 min-w-0">
                        <input value={nomMatiereEditee} onChange={(e) => setNomMatiereEditee(e.target.value)} autoFocus className="flex-1 min-w-0 rounded-lg border border-slate-300 dark:border-slate-600 bg-transparent px-2 py-1 text-sm" />
                        <button type="submit" disabled={enCoursRenommageMatiere.has(m.id) || !nomMatiereEditee.trim()} className={PILL_NEUTRE}>
                          {enCoursRenommageMatiere.has(m.id) ? "..." : "✓ Ok"}
                        </button>
                        <button type="button" onClick={() => setMatiereEnRenommage(null)} className={PILL_NEUTRE}>Annuler</button>
                      </form>
                    ) : (
                      <button type="button" onClick={() => basculerChapitres(m.id)} className="font-medium text-left flex items-center gap-1.5 min-w-0">
                        <span className="text-xs text-slate-400 shrink-0">{chapitresOuverts[m.id] ? "▾" : "▸"}</span>
                        <span className="truncate">{m.nom}</span>
                      </button>
                    )}
                    {matiereEnRenommage !== m.id && (
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button onClick={() => { setNomMatiereEditee(m.nom); setMatiereEnRenommage(m.id); }} className={PILL_NEUTRE} title="Renommer">✎</button>
                        {enConfirmationSuppressionMatiere === m.id ? (                     <span className="flex items-center gap-1.5">                       <span className={PILL_AVERTISSEMENT}>Sûr ?</span>                       <button onClick={() => supprimerMatiere(m.id)} disabled={enCoursSuppressionMatiere.has(m.id)} className={PILL_DANGER_SOLIDE}>                         {enCoursSuppressionMatiere.has(m.id) ? "..." : "Oui"}                       </button>                       <button onClick={() => setEnConfirmationSuppressionMatiere(null)} className={PILL_NEUTRE}>Annuler</button>                     </span>                   ) : (                     <button onClick={() => setEnConfirmationSuppressionMatiere(m.id)} className={PILL_DANGER}>🗑 Suppr.</button>                   )}
                      </div>
                    )}
                  </div>
                  {chapitresOuverts[m.id] && (
                    <div className="mt-2 pl-4 border-l border-slate-200 dark:border-slate-700 space-y-1.5">
                      {chargementChapitres.has(m.id) ? (
                        <p className="text-xs text-slate-400">Chargement...</p>
                      ) : (
                        <>
                          {(chapitresParMatiere[m.id] || []).map((c) => (
                            <div key={c.id} className="flex items-center justify-between text-xs gap-2">
                              {chapitreEnRenommageAdmin === c.id ? (
                                <form onSubmit={(e) => renommerChapitreAdmin(e, c.id, m.id)} className="flex-1 flex items-center gap-1.5 min-w-0">
                                  <input value={nomChapitreEditeAdmin} onChange={(e) => setNomChapitreEditeAdmin(e.target.value)} autoFocus className="flex-1 min-w-0 rounded-lg border border-slate-300 dark:border-slate-600 bg-transparent px-2 py-1 text-xs" />
                                  <button type="submit" disabled={enCoursRenommageChapitreAdmin.has(c.id) || !nomChapitreEditeAdmin.trim()} className={PILL_NEUTRE}>
                                    {enCoursRenommageChapitreAdmin.has(c.id) ? "..." : "✓"}
                                  </button>
                                  <button type="button" onClick={() => setChapitreEnRenommageAdmin(null)} className={PILL_NEUTRE}>Annuler</button>
                                </form>
                              ) : (
                                <p className="truncate flex-1">{c.nom}</p>
                              )}
                              {chapitreEnRenommageAdmin !== c.id && (
                                <div className="flex items-center gap-1.5 shrink-0">
                                  <button onClick={() => { setNomChapitreEditeAdmin(c.nom); setChapitreEnRenommageAdmin(c.id); }} className={PILL_NEUTRE} title="Renommer">✎</button>
                                  {enConfirmationSuppressionChapitre === c.id ? (
                                    <span className="flex items-center gap-1.5">
                                      <span className={PILL_AVERTISSEMENT}>Sûr ?</span>
                                      <button onClick={() => supprimerChapitreAdmin(c.id, m.id)} disabled={enCoursSuppressionChapitre.has(c.id)} className={PILL_DANGER_SOLIDE}>
                                        {enCoursSuppressionChapitre.has(c.id) ? "..." : "Oui"}
                                      </button>
                                      <button onClick={() => setEnConfirmationSuppressionChapitre(null)} className={PILL_NEUTRE}>Annuler</button>
                                    </span>
                                  ) : (
                                    <button onClick={() => setEnConfirmationSuppressionChapitre(c.id)} className={PILL_DANGER}>🗑</button>
                                  )}
                                </div>
                              )}
                            </div>
                          ))}
                          {(chapitresParMatiere[m.id] || []).length === 0 && <p className="text-xs text-slate-400">Aucun chapitre.</p>}
                          {nouveauChapitreMatiereId === m.id ? (
                            <form onSubmit={(e) => creerNouveauChapitreAdmin(e, m.id)} className="flex items-center gap-1.5 pt-1">
                              <input value={nomNouveauChapitreAdmin} onChange={(e) => setNomNouveauChapitreAdmin(e.target.value)} placeholder="Nom du nouveau chapitre" className="flex-1 rounded-lg border border-slate-300 dark:border-slate-600 bg-transparent px-2 py-1 text-xs" autoFocus />
                              <button type="submit" disabled={enCoursChapitreAdmin || !nomNouveauChapitreAdmin.trim()} className="rounded-lg px-2 py-1 text-xs font-medium text-white disabled:opacity-50" style={{ background: "var(--azur)" }}>
                                {enCoursChapitreAdmin ? "..." : "Ajouter"}
                              </button>
                              <button type="button" onClick={() => { setNouveauChapitreMatiereId(null); setNomNouveauChapitreAdmin(""); }} className="text-xs text-slate-500 dark:text-slate-400 hover:underline">
                                Annuler
                              </button>
                            </form>
                          ) : (
                            <button type="button" onClick={() => setNouveauChapitreMatiereId(m.id)} className="text-xs font-medium hover:underline pt-1" style={{ color: "var(--azur)" }}>
                              + Nouveau chapitre
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </div>               ))}               {matieres.length === 0 && <p className="text-slate-500 dark:text-slate-400 text-xs">Aucune matière pour l&apos;instant.</p>}             </div>           </section>         )}       {supabaseConfigured && (<section><div className="flex items-center justify-between mb-3"><h2 className="font-display font-semibold">Diagnostic IA</h2><button onClick={testerIA} disabled={enCoursDiagnosticIA} className="text-sm font-medium rounded-lg px-3 py-1.5 border border-dashed border-slate-400 disabled:opacity-50">{enCoursDiagnosticIA ? "Test en cours..." : "Tester Claude et Gemini"}</button></div>{diagnosticIA && (<div className="space-y-2 text-sm">{diagnosticIA.erreur ? (<p className="text-red-600">{diagnosticIA.erreur}</p>) : (<><p className={diagnosticIA.claude?.ok ? "text-green-700 dark:text-green-400" : "text-red-600"}>Claude : {diagnosticIA.claude?.ok ? `OK (${diagnosticIA.claude.reponse})` : diagnosticIA.claude?.erreur}</p><p className={diagnosticIA.gemini?.ok ? "text-green-700 dark:text-green-400" : "text-red-600"}>Gemini : {diagnosticIA.gemini?.ok ? `OK (${diagnosticIA.gemini.reponse})` : diagnosticIA.gemini?.erreur}</p></>)}</div>)}</section>)}</main>     </>   ); }
