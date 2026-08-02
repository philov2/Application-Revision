// Calcule les indicateurs des cases resume des tableaux de bord (Parent,
// Enfant, Soutien) a partir d'une liste de devoirs.
//
// IMPORTANT : la "semaine" scolaire va du SAMEDI au VENDREDI, et non du
// lundi au dimanche (semaine calendaire classique). Un devoir est considere
// "en retard de plus d'une semaine" si son echeance est anterieure au samedi
// qui a ouvert la semaine derniere (donc absente a la fois de la semaine en
// cours et de la semaine derniere).

// Renvoie le samedi (00:00) qui ouvre la semaine contenant `date`.
function debutSemaine(date) {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    const jour = d.getDay(); // 0 = dimanche ... 6 = samedi
  const decalage = (jour + 1) % 7; // samedi -> 0, dimanche -> 1, ..., vendredi -> 6
  d.setDate(d.getDate() - decalage);
    return d;
}

export function calculerStatsDevoirs(devoirs, aujourdHui = new Date()) {
    const today = new Date(aujourdHui);
    today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString().slice(0, 10);

  const debutSemaineEnCours = debutSemaine(today);
    const seuilRetardSemaine = new Date(debutSemaineEnCours);
    seuilRetardSemaine.setDate(seuilRetardSemaine.getDate() - 7); // debut de la semaine derniere

  let aFaireAujourdhui = 0;
  let totalAFaire = 0; // nombre total de devoirs non faits (toutes echeances confondues) ; voir "Total des devoirs a faire"
    let enRetard = 0;
    let realisesDansLesDelais = 0;
    let retardPlusUneSemaine = 0;

  for (const d of devoirs || []) {
    if (!d.echeance) continue;
    const echeance = new Date(d.echeance + "T00:00:00");

  if (d.statut === "fait") {
    const dateRealisation = d.date_realisation ? new Date(d.date_realisation) : null;
    if (!dateRealisation || dateRealisation <= echeance) {
      realisesDansLesDelais++;
    }
    continue;
  }

  totalAFaire++;

  if (d.echeance === todayStr) {
    aFaireAujourdhui++;
  }
    if (echeance < today) {
      enRetard++;
      if (echeance < seuilRetardSemaine) {
        retardPlusUneSemaine++;
      }
    }
  }

return { aFaireAujourdhui, totalAFaire, enRetard, realisesDansLesDelais, retardPlusUneSemaine };
}

// Devoirs de type "exercice" dont la réponse a été envoyée par l'enfant
// (statut passé automatiquement à "fait" lors de l'envoi) mais pas encore
// corrigés par le parent ou le soutien (aucune note donnée). Affichés dans
// une section dédiée "À corriger" (Parent/Soutien) ou "Fait - en attente de
// correction" (Enfant), séparée des "Devoirs faits" (déjà corrigés) et des
// "Devoirs à faire".
export function filtrerDevoirsEnAttenteCorrection(devoirs) {
  return (devoirs || []).filter(
    (d) => d.type === "exercice" && d.statut === "fait" && d.reponseExercice && d.reponseExercice.note == null
  );
}

// Renvoie uniquement les devoirs "faits" dont la date de realisation se
// situe depuis le debut de la semaine derniere (samedi->vendredi). Les
// devoirs faits plus anciennement disparaissent de la liste affichee. Les
// exercices en attente de correction sont exclus d'ici : ils apparaissent
// dans leur propre section (voir filtrerDevoirsEnAttenteCorrection).
export function filtrerDevoirsFaitsRecents(devoirs, aujourdHui = new Date()) {
        const today = new Date(aujourdHui);
        today.setHours(0, 0, 0, 0);

        const debutSemaineEnCours = debutSemaine(today);
        const seuilSemaineDerniere = new Date(debutSemaineEnCours);
        seuilSemaineDerniere.setDate(seuilSemaineDerniere.getDate() - 7);

        return (devoirs || []).filter((d) => {
                    if (d.statut !== "fait") return false;
                    if (d.type === "exercice" && d.reponseExercice && d.reponseExercice.note == null) return false;
                    if (!d.date_realisation) return false;
                    const dateRealisation = new Date(d.date_realisation);
                    return dateRealisation >= seuilSemaineDerniere;
        });
}
