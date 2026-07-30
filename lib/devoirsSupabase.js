import { supabase } from "@/lib/supabaseClient";

const LABEL_ROLE = { parent: "parent", soutien: "soutien", admin: "administrateur" };

function derniereReponseExercice(liste) {
  if (!liste || liste.length === 0) return null;
  const triee = [...liste].sort((a, b) => (b.date_soumission || "").localeCompare(a.date_soumission || ""));
  const r = triee[0];
  return {
    id: r.id,
    photoUrl: r.photo_url,
    note: r.note,
    commentaire: r.commentaire,
    dateSoumission: r.date_soumission,
  };
}

function mapDevoir(row) {
  return {
    id: row.id,
    matiereId: row.matiere_id,
    chapitreId: row.chapitre_id,
    matiere: row.matiere?.nom || "",
    chapitre: row.chapitre?.nom || "",
    type: row.type,
    echeance: row.date_echeance,
    statut: row.statut,
    date_realisation: row.date_realisation ? row.date_realisation.slice(0, 10) : null,
    origine: row.createur ? row.createur.nom + " (" + (LABEL_ROLE[row.createur.role] || row.createur.role) + ")" : "",
    reponseExercice: derniereReponseExercice(row.reponses_exercices),
  };
}

export async function chargerDevoirs(enfantId) {
  const { data, error } = await supabase
    .from("devoirs")
    .select("id, type, date_echeance, statut, date_realisation, matiere_id, chapitre_id, matiere:matieres(nom), chapitre:chapitres(nom), createur:comptes!cree_par(nom, role), reponses_exercices(id, photo_url, note, commentaire, date_soumission)")
    .eq("enfant_id", enfantId)
    .order("date_echeance");
  if (error) throw error;
  return (data || []).map(mapDevoir);
}

export async function creerDevoir({ enfantId, matiereId, chapitreId, type, dateEcheance, creePar }) {
  const { error } = await supabase.from("devoirs").insert({
    enfant_id: enfantId,
    matiere_id: matiereId,
    chapitre_id: chapitreId || null,
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

export async function modifierDevoir(devoirId, { matiereId, chapitreId, type, dateEcheance }) {
  const { error } = await supabase
    .from("devoirs")
    .update({
      matiere_id: matiereId,
      chapitre_id: chapitreId || null,
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
