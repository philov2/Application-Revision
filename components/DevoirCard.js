// Données d'exemple utilisées uniquement tant que le projet Supabase n'est pas
// encore connecté (voir README.md). Reflètent la composition réelle de la
// famille (voir supabase/seed.sql) pour prévisualiser l'interface avec des
// données proches du réel, en attendant la création des vrais comptes.

// Palette de 8 couleurs franches et bien distinctes (une par matière), pour
// repérer une matière au premier coup d'œil sur les cases de devoirs et les
// listes de matières.
export const matieres = [
  { id: "m1", nom: "Mathématiques", couleur: "#3B82F6" },
  { id: "m7", nom: "Physique-Chimie", couleur: "#8B5CF6" },
  { id: "m6", nom: "Technologie", couleur: "#F97316" },
  { id: "m8", nom: "Sciences de la Vie et de la Terre", couleur: "#22C55E" },
  { id: "m5", nom: "Histoire-Géographie", couleur: "#EAB308" },
  { id: "m3", nom: "Anglais", couleur: "#EF4444" },
  { id: "m4", nom: "Allemand", couleur: "#06B6D4" },
  { id: "m2", nom: "Français", couleur: "#EC4899" },
];

// Répartition réelle des soutiens par matière (voir Addendum au DCF) :
// - Viviane : Allemand, Français, Anglais, Histoire-Géographie
// - Philippe (administrateur) : Mathématiques, Technologie, Physique-Chimie,
//   Sciences de la Vie et de la Terre, Histoire-Géographie, Anglais
export const devoirsEnfant = [
  { id: "d1", matiere: "Mathématiques", chapitre: "Fractions", type: "revision", echeance: "2026-07-06", statut: "a_faire", origine: "Philippe (soutien)" },
  { id: "d2", matiere: "Français", chapitre: "Le passé simple", type: "exercice", echeance: "2026-07-07", statut: "a_faire", origine: "Viviane (soutien)" },
  { id: "d3", matiere: "Histoire-Géographie", chapitre: "La Révolution française", type: "test", echeance: "2026-07-05", statut: "fait", origine: "Virginie (parent)" },
  { id: "d4", matiere: "Anglais", chapitre: "Present perfect", type: "revision", echeance: "2026-07-08", statut: "a_faire", origine: "JC (parent)" },
];

export const enfants = [
  { id: "e1", nom: "Rose", niveau: "4ème (collège)", devoirsAFaire: 3, devoirsFaits: 1 },
];

export const demandesAdmin = [
  { id: "r1", type: "Nouveau compte Soutien", nom: "Viviane", email: "à renseigner", date: "2026-07-04" },
];          <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold ${COULEUR_DATE[statut]}`}>
            {dateLabel}
          </span>
          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-600">
            {devoir.origine}
          </span>
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm shrink-0">
        <input type="checkbox" checked={fait} onChange={() => onToggle?.(devoir.id)} className="h-5 w-5" />
        {fait ? "Fait" : "À faire"}
      </label>
    </div>
  );
}          <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold ${COULEUR_DATE[statut]}`}>
            {dateLabel}
          </span>
          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-600">
            {devoir.origine}
          </span>
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm shrink-0">
        <input type="checkbox" checked={fait} onChange={() => onToggle?.(devoir.id)} className="h-5 w-5" />
        {fait ? "Fait" : "À faire"}
      </label>
    </div>
  );
}
