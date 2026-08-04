// Petit moteur de rendu Markdown -> JSX, volontairement minimal (pas de
// dépendance npm supplémentaire à installer). Il couvre ce que Claude produit
// habituellement pour une synthèse de cours ou une liste d'exercices :
// titres (#, ##, ###), listes à puces / numérotées, gras/italique, citations
// (>), séparateurs (---) et paragraphes. Tout ce qui n'est pas reconnu est
// simplement affiché comme un paragraphe normal, donc rien n'est perdu.
"use client";

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

    const citation = t.match(/^>\s?(.*)$/);
    if (citation) {
      fermerListe();
      blocs.push(
        <blockquote
          key={`q-${cleBloc++}`}
          className="border-l-4 pl-3.5 py-1 mb-3.5 text-sm italic text-slate-600 dark:text-slate-400"
          style={{ borderColor: "#91CAFF" }}
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
