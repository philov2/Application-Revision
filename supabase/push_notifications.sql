-- Jalon "notifications push" — à exécuter une seule fois dans l'éditeur SQL
-- de Supabase (Project > SQL Editor), APRÈS avoir ajouté les 3 variables
-- d'environnement dans Vercel (voir message à côté de ce fichier).
--
-- Contenu :
--   1. Table push_subscriptions (un abonnement par appareil/navigateur).
--   2. RLS sur cette table.
--   3. Extension pg_net (permet à Postgres d'appeler une URL en HTTP).
--   4. Fonction générique notifier_push() qui appelle l'API de l'appli.
--   5. Trois déclencheurs : nouveau message, nouveau devoir, devoir corrigé.

-- 1. Table des abonnements push -------------------------------------------
create table if not exists push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  compte_id uuid references comptes(id) on delete cascade not null,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);

alter table push_subscriptions enable row level security;

create policy "un compte gere ses propres abonnements push" on push_subscriptions
for all using (compte_id = auth.uid())
with check (compte_id = auth.uid());

-- 2. pg_net : permet à une fonction Postgres d'appeler une URL en HTTP -----
create extension if not exists pg_net;

-- 3. Fonction générique d'envoi ---------------------------------------------
-- Remplace <SECRET> par la même valeur que PUSH_WEBHOOK_SECRET dans Vercel.
-- Remplace l'URL si un jour le nom de domaine change.
create or replace function notifier_push(p_compte_ids uuid[], p_titre text, p_corps text, p_url text default '/')
returns void
language plpgsql
security definer
as $$
begin
  if p_compte_ids is null or array_length(p_compte_ids, 1) is null then
    return;
  end if;
  perform net.http_post(
    url := 'https://application-revision.vercel.app/api/push/envoyer',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-push-secret', '0a83c47aaafb43060b10428c719e56f9af787f42f7f1d81a'),
    body := jsonb_build_object('compteIds', to_jsonb(p_compte_ids), 'titre', p_titre, 'corps', p_corps, 'url', p_url)
  );
end;
$$;

-- 4. Déclencheur : nouveau message -----------------------------------------
-- Notifie tout le monde dans le fil de la famille (parent(s), soutien(s),
-- admin) sauf l'auteur du message ; ou uniquement le destinataire choisi si
-- le message est adressé à quelqu'un en particulier.
create or replace function trig_notifier_nouveau_message()
returns trigger
language plpgsql
security definer
as $$
declare
  v_destinataires uuid[];
begin
  if new.destinataire_id is not null then
    if new.destinataire_id <> new.auteur_id then
      v_destinataires := array[new.destinataire_id];
    end if;
  else
    select array_agg(distinct id) into v_destinataires
    from (
      select parent_id as id from liens_parent_enfant where enfant_id = new.enfant_id
      union
      select soutien_id as id from liens_soutien where enfant_id = new.enfant_id
      union
      select id from comptes where role = 'admin'
      union
      select new.enfant_id as id
    ) t
    where id <> new.auteur_id;
  end if;

  perform notifier_push(v_destinataires, 'Nouveau message', 'Vous avez un nouveau message dans la messagerie.', '/');
  return new;
end;
$$;

drop trigger if exists on_nouveau_message_push on messages;
create trigger on_nouveau_message_push
after insert on messages
for each row execute function trig_notifier_nouveau_message();

-- 5. Déclencheur : nouveau devoir -------------------------------------------
-- Notifie l'enfant concerné.
create or replace function trig_notifier_nouveau_devoir()
returns trigger
language plpgsql
security definer
as $$
declare
  v_matiere text;
  v_label_type text;
begin
  select nom into v_matiere from matieres where id = new.matiere_id;
  v_label_type := case new.type
    when 'revision' then 'Réviser le cours'
    when 'exercice' then 'Exercices'
    when 'test' then 'Test'
    else new.type::text
  end;
  perform notifier_push(array[new.enfant_id], 'Nouveau devoir', coalesce(v_matiere || ' · ', '') || v_label_type, '/enfant');
  return new;
end;
$$;

drop trigger if exists on_nouveau_devoir_push on devoirs;
create trigger on_nouveau_devoir_push
after insert on devoirs
for each row execute function trig_notifier_nouveau_devoir();

-- 6. Déclencheur : exercice corrigé -----------------------------------------
-- Notifie l'enfant dès qu'une note est renseignée pour la première fois.
create or replace function trig_notifier_correction()
returns trigger
language plpgsql
security definer
as $$
declare
  v_enfant_id uuid;
  v_matiere text;
begin
  if old.note is null and new.note is not null then
    select d.enfant_id, m.nom into v_enfant_id, v_matiere
    from devoirs d
    left join matieres m on m.id = d.matiere_id
    where d.id = new.devoir_id;

    if v_enfant_id is not null then
      perform notifier_push(array[v_enfant_id], 'Devoir corrigé', coalesce(v_matiere || ' — ', '') || new.note || '/20', '/enfant');
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists on_correction_exercice_push on reponses_exercices;
create trigger on_correction_exercice_push
after update on reponses_exercices
for each row execute function trig_notifier_correction();
