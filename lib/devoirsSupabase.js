import { supabase } from "@/lib/supabaseClient";

const LABEL_ROLE = { parent: "parent", soutien: "soutien", admin: "administrateur" };

function derniereReponseExercice(liste) {
  if (!liste || liste.length === 0) return null;
  const triee = [...liste].sort((a, b) => (b.date_soumission || "").localeCompare(a.date_soumission || ""));
  const r = triee[0];
  // Compat : les anciennes réponses n'ont qu'une seule photo (photo_url).
  // Les nouvelles réponses stockent une liste de fichiers (fichiers_urls).
  const fichiersUrls = r.fichiers_urls && r.fichiers_urls.length > 0 ? r.fichiers_urls : (r.photo_url ? [r.photo_url] : []);
  return {
    id: r.id,
    fichiersUrls,
    note: r.note,
    commentaire: r.commentaire,
    dateSoumission: r.date_soumission,
  };
}

function mapDevoir(row) {
  return {
    id: row.id,
    enfantId: row.enfant_id,
    matiereId: row.matiere_id,
    chapitreId: row.chapitre_id,
    matiere: row.matiere?.nom || "",
    chapitre: row.chapitre?.nom || "",
    titre: row.titre || "",
    type: row.type,
    echeance: row.date_echeance,
    statut: row.statut,
    date_realisation: row.date_realisation ? row.date_realisation.slice(0, 10) : null,
    origine: row.createur ? row.createur.nom + " (" + (LABEL_ROLE[row.createur.role] || row.createur.role) + ")" : "",
    reponseExercice: derniereReponseExercice(row.reponses_exercices),
    document: row.document
      ? {
          id: row.document.id,
          nom: row.document.nom,
          type: row.document.type,
          fichierUrl: row.document.fichier_url,
          generePasIA: row.document.genere_par_ia,
          format: row.document.format,
        }
      : null,
  };
}

export async function chargerDevoirs(enfantId) {
  const { data, error } = await supabase
    .from("devoirs")
    .select("id, enfant_id, type, titre, date_echeance, statut, date_realisation, matiere_id, chapitre_id, document_id, matiere:matieres(nom), chapitre:chapitres(nom), createur:comptes!cree_par(nom, role), reponses_exercices(id, photo_url, fichiers_urls, note, commentaire, date_soumission), document:documents(id, nom, type, fichier_url, genere_par_ia, format)")
    .eq("enfant_id", enfantId)
    .order("date_echeance");
  if (error) throw error;
  return (data || []).map(mapDevoir);
}

export async function creerDevoir({ enfantId, matiereId, chapitreId, documentId, titre, type, dateEcheance, creePar }) {
  const { error } = await supabase.from("devoirs").insert({
    enfant_id: enfantId,
    matiere_id: matiereId,
    chapitre_id: chapitreId || null,
    document_id: documentId || null,
    titre: titre || null,
    type,
    date_echeance: dateEcheance,
    cree_par: creePar,
  });
  if (error) throw error;
}

export async function basculerStatutDevoir(devoirId, nouveauStatut) {
  const { error } = await supabase
    .from("devoirs")
    .update({
      statut: nouveauStatut,
      date_realisation: nouveauStatut === "fait" ? new Date().toISOString().slice(0, 10) : null,
    })
    .eq("id", devoirId);
  if (error) throw error;
}

export async function modifierDevoir(devoirId, { matiereId, chapitreId, documentId, titre, type, dateEcheance }) {
  const { error } = await supabase
    .from("devoirs")
    .update({
      matiere_id: matiereId,
      chapitre_id: chapitreId || null,
      document_id: documentId || null,
      titre: titre || null,
      type,
      date_echeance: dateEcheance,
    })
    .eq("id", devoirId);
  if (error) throw error;
}

export async function supprimerDevoir(devoirId) {
  const { error } = await supabase.from("devoirs").delete().eq("id", devoirId);
  if (error) throw error;
}
