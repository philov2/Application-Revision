import { supabase } from "@/lib/supabaseClient";

const LABEL_ROLE = { parent: "parent", soutien: "soutien", admin: "administrateur" };

function mapDevoir(row) {
    return {
          id: row.id,
          matiere: row.matiere?.nom || "",
          chapitre: row.chapitre?.nom || "",
          type: row.type,
          echeance: row.date_echeance,
          statut: row.statut,
          date_realisation: row.date_realisation ? row.date_realisation.slice(0, 10) : null,
          origine: row.createur ? row.createur.nom + " (" + (LABEL_ROLE[row.createur.role] || row.createur.role) + ")" : "",
    };
}

export async function chargerDevoirs(enfantId) {
    const { data, error } = await supabase
      .from("devoirs")
      .select("id, type, date_echeance, statut, date_realisation, matiere:matieres(nom), chapitre:chapitres(nom), createur:comptes!cree_par(nom, role)")
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
