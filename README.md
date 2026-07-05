# Application de révision — MVP

Squelette de l'application (web PWA) décrite dans le DCF v1.0 et son addendum.
Voir aussi `Note technique - Architecture PWA.docx` (dossier parent) pour le détail des choix.

## État actuel

- La structure du projet (Next.js, App Router, Tailwind)
- Le schéma de base de données complet du MVP (`supabase/schema.sql`), les règles d'accès (`supabase/policies.sql`) et les données initiales (`supabase/seed.sql`)
- **Jalon 1 (authentification et comptes réels)** : demande de compte Parent publique (`/demande`), validation par l'administrateur (`/admin`), création directe d'un enfant par un parent, demande de compte Soutien par un parent (avec choix des matières), redirection après connexion selon le rôle réel, et protection de chaque tableau de bord par rôle (`components/AuthGuard.js`)
- Les 4 tableaux de bord (Parent, Enfant, Soutien, Administrateur)
- La configuration PWA de base (`public/manifest.json`)

Tant qu'aucun projet Supabase n'est connecté, l'application tourne en « mode démonstration » avec des données d'exemple (`lib/sampleData.js`), pour prévisualiser l'interface sans rien configurer.

## Lancer le projet en local

```bash
npm install
npm run dev
```

Puis ouvrir http://localhost:3000

## Connecter les vraies données (Supabase)

1. Créer un compte gratuit sur https://supabase.com et un nouveau projet.
2. Dans l'éditeur SQL du projet, exécuter dans l'ordre `supabase/schema.sql`, `supabase/policies.sql`, puis `supabase/seed.sql` (ce dernier crée les 8 matières réelles de Rose, avec leur couleur).
3. Copier `.env.local.example` en `.env.local` et renseigner les trois valeurs trouvées dans Settings > API : le "Project URL", la "publishable key" et la "secret key" (voir avertissement dans le fichier — la secret key ne doit jamais être exposée au navigateur).
4. Dans Supabase > Authentication > URL Configuration, renseigner l'URL de l'application une fois déployée (ex. https://application-revision.vercel.app), pour que les emails d'invitation redirigent au bon endroit.
5. Créer le tout premier compte administrateur (Philippe) : Authentication > Users > "Add user", puis dans le SQL Editor :
   ```sql
   insert into comptes (id, email, nom, role, statut)
   values ('<uuid-affiché-dans-Users>', '<email-de-philippe>', 'Philippe', 'admin', 'actif');
   ```
6. Redémarrer `npm run dev` (ou redéployer) : le bandeau « mode démonstration » disparaît.

## Parcours de création des comptes (Jalon 1)

1. Philippe (admin) se connecte sur `/login`.
2. JC et Virginie vont sur `/demande`, indiquent leur nom et email → la demande apparaît dans `/admin`.
3. Philippe clique « Valider » → le compte est créé et un email d'invitation est envoyé automatiquement (choix du mot de passe).
4. Une fois connecté(e), JC ou Virginie clique « + Ajouter un enfant » dans son tableau de bord Parent pour créer le compte de Rose (aucune validation admin nécessaire, conforme au DCF).
5. JC ou Virginie clique « + Demander un compte soutien », renseigne Viviane et coche ses 4 matières → Philippe valide sur `/admin` → le compte de Viviane est créé et automatiquement rattaché à Rose pour ces 4 matières.

Note sur les emails : Supabase envoie ces invitations avec son service intégré, suffisant pour le volume d'une famille (quelques emails). Si les emails n'arrivent pas, vérifier le dossier spam et l'étape 4 ci-dessus (URL Configuration).

## Prochaines étapes (voir Note technique, section 4)

- ~~Jalon 1 : authentification réelle + validation des comptes par l'administrateur~~ (fait)
- Jalon 2 : gestion des matières / chapitres / documents (import de fichiers)
- Jalon 3 : création des devoirs, tableaux de bord connectés aux vraies données
- Jalon 4 : exercices (photo + notation) et tests QCM auto-notés
- Jalon 5 : mise en ligne (Vercel + Supabase)
- Jalon 6 (V2) : génération de contenu par IA, messagerie interne, notifications push

## Icônes de l'application

Le manifest (`public/manifest.json`) référence `icon-192.png` et `icon-512.png`, à ajouter dans `public/` avant la mise en ligne (logo de l'application aux couleurs bleu #91CAFF / rose #F7CEE6).
