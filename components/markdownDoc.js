// Petit moteur de rendu Markdown -> JSX, volontairement minimal (pas de
// dépendance npm supplémentaire à installer). Il couvre ce que Claude produit
// habituellement pour une synthèse de cours ou une liste d'exercices :
// titres (#, ##, ###), listes à puces / numérotées, tableaux, gras/italique,
// citations (>), séparateurs (---) et paragraphes. Tout ce qui n'est pas
// reconnu est simplement affiché comme un paragraphe normal, donc rien n'est
// perdu.
"use client";

// Une ligne de tableau markdown ressemble à "| a | b | c |" (les barres de
// début/fin sont optionnelles). La ligne de séparation ressemble à
// "|---|:---:|---:|".
function estLigneTableau(t) {
  return /^\|?.+\|.*\|?$/.test(t) && t.includes("|");
}
function estLigneSeparationTableau(t) {
  return /^\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)+\|?$/.test(t);
}
function celluleDeLigne(t) {
  let s = t.trim();
  if (s.startsWith("|")) s = s.slice(1);
  if (s.endsWith("|")) s = s.slice(0, -1);
  return s.split("|").map((c) => c.trim());
}

function renduInline(texte, cleBase) {
  // Découpe une ligne en morceaux gras / italique / code, dans cet ordre.
  const morceaux = [];
  let reste = texte;
  let cle = 0;
  const motif = /(\*\*(.+?)\*\*|__(.+?)__|`(.+?)`|\*(.+?)\*|_(.+?)_)/;
  while (reste.length > 0) {
    const m = reste.match(motif);
    if (!m) {
      morceaux.push(reste);
      break;
    }
    if (m.index > 0) morceaux.push(reste.slice(0, m.index));
    if (m[2] !== undefined || m[3] !== undefined) {
      morceaux.push(
        <strong key={`${cleBase}-${cle++}`} className="font-semibold text-slate-900 dark:text-white">
          {m[2] ?? m[3]}
        </strong>
      );
    } else if (m[4] !== undefined) {
      morceaux.push(
        <code key={`${cleBase}-${cle++}`} className="px-1 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-[0.85em] font-mono">
          {m[4]}
        </code>
      );
    } else {
      morceaux.push(
        <em key={`${cleBase}-${cle++}`} className="italic">
          {m[5] ?? m[6]}
        </em>
      );
    }
    reste = reste.slice(m.index + m[0].length);
  }
  return morceaux;
}

export function MarkdownDoc({ texte }) {
  const lignes = (texte || "").replace(/\r\n/g, "\n").split("\n");
  const blocs = [];
  let listeCourante = null; // { type: "ul" | "ol", items: [] }
  let cleBloc = 0;

  function fermerListe() {
    if (!listeCourante) return;
    const ListeTag = listeCourante.type === "ol" ? "ol" : "ul";
    blocs.push(
      <ListeTag
        key={`liste-${cleBloc++}`}
        className={`${listeCourante.type === "ol" ? "list-decimal" : "list-disc"} pl-6 space-y-1.5 text-sm text-slate-700 dark:text-slate-300 mb-4`}
      >
        {listeCourante.items.map((item, i) => (
          <li key={i}>{renduInline(item, `li-${cleBloc}-${i}`)}</li>
        ))}
      </ListeTag>
    );
    listeCourante = null;
  }

  for (let i = 0; i < lignes.length; i++) {
    const ligne = lignes[i];
    const t = ligne.trim();

    if (t === "") {
      fermerListe();
      continue;
    }

    if (/^---+$/.test(t)) {
      fermerListe();
      blocs.push(<hr key={`hr-${cleBloc++}`} className="my-6 border-slate-200 dark:border-slate-700" />);
      continue;
    }

    const titre = t.match(/^(#{1,4})\s+(.*)$/);
    if (titre) {
      fermerListe();
      const niveau = titre[1].length;
      const classes = {
        1: "text-xl font-bold text-slate-900 dark:text-white mt-2 mb-3",
        2: "text-lg font-bold text-slate-900 dark:text-white mt-6 mb-2.5",
        3: "text-base font-semibold text-slate-900 dark:text-white mt-5 mb-2",
        4: "text-sm font-semibold text-slate-800 dark:text-slate-100 mt-4 mb-1.5 uppercase tracking-wide",
      }[niveau];
      const Tag = `h${Math.min(niveau + 1, 4)}`;
      blocs.push(
        <Tag key={`h-${cleBloc++}`} className={classes}>
          {renduInline(titre[2], `h-${cleBloc}`)}
        </Tag>
      );
      continue;
    }

    const puce = t.match(/^[-*]\s+(.*)$/);
    if (puce) {
      if (!listeCourante || listeCourante.type !== "ul") {
        fermerListe();
        listeCourante = { type: "ul", items: [] };
      }
      listeCourante.items.push(puce[1]);
      continue;
    }

    const numero = t.match(/^\d+[.)]\s+(.*)$/);
    if (numero) {
      if (!listeCourante || listeCourante.type !== "ol") {
        fermerListe();
        listeCourante = { type: "ol", items: [] };
      }
      listeCourante.items.push(numero[1]);
      continue;
    }

    if (estLigneTableau(t) && i + 1 < lignes.length && estLigneSeparationTableau(lignes[i + 1].trim())) {
      fermerListe();
      const enTetes = celluleDeLigne(t);
      const lignesTableau = [];
      let j = i + 2;
      while (j < lignes.length && estLigneTableau(lignes[j].trim()) && lignes[j].trim() !== "") {
        lignesTableau.push(celluleDeLigne(lignes[j]));
        j++;
      }
      const cleTableau = cleBloc++;
      blocs.push(
        <div key={`tbl-wrap-${cleTableau}`} className="mb-4 overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/70">
                {enTetes.map((c, ci) => (
                  <th
                    key={ci}
                    className="text-left font-semibold text-slate-700 dark:text-slate-200 px-3 py-2 border-b border-slate-200 dark:border-slate-700"
                  >
                    {renduInline(c, `tbl-${cleTableau}-h-${ci}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {lignesTableau.map((ligneCells, li) => (
                <tr key={li} className={li % 2 === 1 ? "bg-slate-50/60 dark:bg-slate-800/30" : undefined}>
                  {ligneCells.map((c, ci) => (
                    <td key={ci} className="px-3 py-1.5 text-slate-700 dark:text-slate-300 border-b border-slate-100 dark:border-slate-800">
                      {renduInline(c, `tbl-${cleTableau}-${li}-${ci}`)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      i = j - 1;
      continue;
    }

    const citation = t.match(/^>\s?(.*)$/);
    if (citation) {
      fermerListe();
      blocs.push(
        <blockquote
          key={`q-${cleBloc++}`}
          className="border-l-4 pl-3.5 py-1 mb-3.5 text-sm italic text-slate-600 dark:text-slate-400"
          style={{ borderColor: "#4169E1" }}
        >
          {renduInline(citation[1], `q-${cleBloc}`)}
        </blockquote>
      );
      continue;
    }

    fermerListe();
    blocs.push(
      <p key={`p-${cleBloc++}`} className="text-sm leading-relaxed text-slate-700 dark:text-slate-300 mb-3.5">
        {renduInline(t, `p-${cleBloc}`)}
      </p>
    );
  }
  fermerListe();

  return <div>{blocs}</div>;
}
