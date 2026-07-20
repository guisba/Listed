begin;

create extension if not exists pg_trgm with schema extensions;

create type public.preferred_theme as enum ('light', 'dark', 'dark-red');
create type public.member_role as enum ('owner', 'moderator', 'member');
create type public.session_kind as enum ('quick', 'group');
create type public.session_status as enum ('open', 'locked', 'deciding', 'closed', 'expired');
create type public.decision_method as enum ('multi_vote', 'single_vote', 'random', 'weighted_random', 'ranking', 'elimination', 'tournament', 'veto');
create type public.game_source as enum ('manual', 'steam');
create type public.ownership_status as enum ('owns', 'does_not_own', 'other_platform', 'unknown', 'subscription', 'free');
create type public.metadata_status as enum ('pending', 'complete', 'partial', 'failed', 'stale');

create schema if not exists private;
revoke all on schema private from public;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text check (char_length(display_name) between 2 and 40),
  avatar_url text,
  preferred_theme public.preferred_theme not null default 'dark',
  locale text not null default 'pt-BR' check (char_length(locale) between 2 and 12),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 3 and 80),
  description text check (char_length(description) <= 1000),
  owner_id uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.group_members (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.member_role not null default 'member',
  joined_at timestamptz not null default now(),
  unique (group_id, user_id)
);
create index groups_owner_id_idx on public.groups(owner_id);
create index group_members_user_id_idx on public.group_members(user_id);

create table public.sessions (
  id uuid primary key default gen_random_uuid(),
  group_id uuid references public.groups(id) on delete set null,
  kind public.session_kind not null default 'quick',
  owner_id uuid not null references auth.users(id) on delete restrict,
  title text not null check (char_length(title) between 3 and 80),
  description text check (char_length(description) <= 1000),
  public_code text not null unique check (public_code ~ '^[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{6}$'),
  status public.session_status not null default 'open',
  decision_method public.decision_method not null default 'multi_vote',
  max_participants smallint not null default 30 check (max_participants between 2 and 100),
  hide_results_until_closed boolean not null default false,
  expires_at timestamptz,
  last_activity_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint group_session_has_group check ((kind = 'group' and group_id is not null) or kind = 'quick')
);
create index sessions_owner_id_idx on public.sessions(owner_id);
create index sessions_group_id_idx on public.sessions(group_id) where group_id is not null;
create index sessions_active_expiry_idx on public.sessions(expires_at) where status not in ('closed', 'expired') and deleted_at is null;

create table public.session_members (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 2 and 40),
  role public.member_role not null default 'member',
  joined_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  removed_at timestamptz,
  unique (session_id, user_id)
);
create index session_members_user_id_idx on public.session_members(user_id);

create table public.session_invites (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(id) on delete cascade,
  code text not null unique,
  created_by uuid not null references auth.users(id) on delete restrict,
  expires_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);
create unique index one_active_session_invite_idx on public.session_invites(session_id) where revoked_at is null;
create index session_invites_created_by_idx on public.session_invites(created_by);

create table public.catalog_games (
  id uuid primary key default gen_random_uuid(),
  steam_appid bigint unique check (steam_appid is null or steam_appid > 0),
  source public.game_source not null default 'manual',
  name text not null check (char_length(name) between 2 and 160),
  normalized_name text not null,
  app_type text not null default 'game',
  store_url text,
  header_image text,
  cover_image text,
  short_description text check (char_length(short_description) <= 2000),
  platforms text[] not null default '{}',
  genres text[] not null default '{}',
  categories text[] not null default '{}',
  features text[] not null default '{}',
  is_free boolean not null default false,
  metadata_status public.metadata_status not null default 'pending',
  raw_metadata jsonb,
  source_updated_at timestamptz,
  cache_expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index catalog_games_name_trgm_idx on public.catalog_games using gin (normalized_name extensions.gin_trgm_ops);
create index catalog_games_features_idx on public.catalog_games using gin (features);

create table public.steam_app_index (
  appid bigint primary key check (appid > 0),
  name text not null,
  normalized_name text not null,
  app_type text not null default 'game',
  last_modified bigint,
  price_change_number bigint,
  indexed_at timestamptz not null default now()
);
create index steam_app_index_name_trgm_idx on public.steam_app_index using gin (normalized_name extensions.gin_trgm_ops);

create table public.session_games (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(id) on delete cascade,
  catalog_game_id uuid references public.catalog_games(id) on delete restrict,
  steam_appid bigint check (steam_appid is null or steam_appid > 0),
  source public.game_source not null,
  name text not null check (char_length(name) between 2 and 160),
  normalized_name text not null,
  image_url text,
  store_url text,
  platforms text[] not null default '{}',
  features text[] not null default '{}',
  min_players smallint check (min_players is null or min_players > 0),
  max_players smallint check (max_players is null or max_players > 0),
  notes text check (char_length(notes) <= 1000),
  added_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  removed_at timestamptz,
  constraint player_range_valid check (max_players is null or min_players is null or max_players >= min_players)
);
create index session_games_session_id_idx on public.session_games(session_id);
create index session_games_catalog_game_id_idx on public.session_games(catalog_game_id) where catalog_game_id is not null;
create index session_games_added_by_idx on public.session_games(added_by);
create unique index session_game_catalog_unique_idx on public.session_games(session_id, catalog_game_id) where catalog_game_id is not null and removed_at is null;
create unique index session_game_steam_unique_idx on public.session_games(session_id, steam_appid) where steam_appid is not null and removed_at is null;
create unique index session_game_manual_name_unique_idx on public.session_games(session_id, normalized_name) where catalog_game_id is null and steam_appid is null and removed_at is null;

create table public.votes (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(id) on delete cascade,
  session_game_id uuid not null references public.session_games(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (session_game_id, user_id)
);
create index votes_session_id_idx on public.votes(session_id);
create index votes_user_id_idx on public.votes(user_id);

create table public.game_ownership (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(id) on delete cascade,
  session_game_id uuid not null references public.session_games(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  status public.ownership_status not null default 'unknown',
  platform text,
  updated_at timestamptz not null default now(),
  unique (session_game_id, user_id)
);
create index game_ownership_session_id_idx on public.game_ownership(session_id);
create index game_ownership_user_id_idx on public.game_ownership(user_id);

create table public.user_game_library (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  catalog_game_id uuid not null references public.catalog_games(id) on delete cascade,
  platform text not null,
  ownership_type public.ownership_status not null,
  source text not null default 'manual',
  imported_at timestamptz,
  verified_at timestamptz,
  notes text check (char_length(notes) <= 1000),
  unique (user_id, catalog_game_id, platform)
);
create index user_game_library_catalog_game_id_idx on public.user_game_library(catalog_game_id);

create table public.decision_runs (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(id) on delete cascade,
  method public.decision_method not null,
  initiated_by uuid not null references auth.users(id) on delete restrict,
  seed text,
  snapshot jsonb not null default '{}',
  started_at timestamptz not null default now(),
  completed_at timestamptz
);
create index decision_runs_session_id_idx on public.decision_runs(session_id);
create index decision_runs_initiated_by_idx on public.decision_runs(initiated_by);

create table public.decision_results (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(id) on delete cascade,
  decision_run_id uuid not null references public.decision_runs(id) on delete cascade,
  session_game_id uuid not null references public.session_games(id) on delete restrict,
  chosen_at timestamptz not null default now(),
  played boolean,
  duration_minutes integer check (duration_minutes is null or duration_minutes >= 0),
  notes text check (char_length(notes) <= 1000)
);
create index decision_results_session_id_idx on public.decision_results(session_id);
create index decision_results_run_id_idx on public.decision_results(decision_run_id);
create index decision_results_game_id_idx on public.decision_results(session_game_id);

create table public.audit_logs (
  id bigint generated always as identity primary key,
  session_id uuid references public.sessions(id) on delete set null,
  actor_id uuid references auth.users(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index audit_logs_session_id_created_at_idx on public.audit_logs(session_id, created_at desc);
create index audit_logs_actor_id_idx on public.audit_logs(actor_id) where actor_id is not null;

create or replace function private.set_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at = now(); return new; end;
$$;

create trigger profiles_updated_at before update on public.profiles for each row execute function private.set_updated_at();
create trigger groups_updated_at before update on public.groups for each row execute function private.set_updated_at();
create trigger sessions_updated_at before update on public.sessions for each row execute function private.set_updated_at();
create trigger catalog_games_updated_at before update on public.catalog_games for each row execute function private.set_updated_at();
create trigger session_games_updated_at before update on public.session_games for each row execute function private.set_updated_at();
create trigger votes_updated_at before update on public.votes for each row execute function private.set_updated_at();
create trigger game_ownership_updated_at before update on public.game_ownership for each row execute function private.set_updated_at();

create or replace function private.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles(id, display_name)
  values (new.id, nullif(left(coalesce(new.raw_user_meta_data ->> 'display_name', ''), 40), ''))
  on conflict (id) do nothing;
  return new;
end;
$$;
create trigger on_auth_user_created after insert on auth.users for each row execute function private.handle_new_user();

create or replace function private.is_session_member(target_session_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.session_members sm
    where sm.session_id = target_session_id and sm.user_id = (select auth.uid()) and sm.removed_at is null
  );
$$;

create or replace function private.has_session_role(target_session_id uuid, allowed_roles public.member_role[])
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.session_members sm
    where sm.session_id = target_session_id and sm.user_id = (select auth.uid())
      and sm.role = any(allowed_roles) and sm.removed_at is null
  );
$$;

create or replace function private.generate_session_code()
returns text language plpgsql volatile set search_path = '' as $$
declare alphabet constant text := '23456789ABCDEFGHJKMNPQRSTUVWXYZ'; candidate text; i integer;
begin
  for i in 1..20 loop
    candidate := '';
    for j in 1..6 loop candidate := candidate || substr(alphabet, 1 + floor(random() * length(alphabet))::integer, 1); end loop;
    if not exists (select 1 from public.sessions where public_code = candidate) then return candidate; end if;
  end loop;
  raise exception 'Não foi possível gerar um código único';
end;
$$;

create or replace function private.enforce_vote_rules()
returns trigger language plpgsql security definer set search_path = '' as $$
declare current_method public.decision_method; current_status public.session_status;
begin
  select decision_method, status into current_method, current_status from public.sessions where id = new.session_id;
  if current_status not in ('open', 'deciding') then raise exception 'A votação está fechada'; end if;
  if not exists (select 1 from public.session_games where id = new.session_game_id and session_id = new.session_id and removed_at is null) then raise exception 'Jogo inválido'; end if;
  if current_method = 'single_vote' then delete from public.votes where session_id = new.session_id and user_id = new.user_id and session_game_id <> new.session_game_id; end if;
  return new;
end;
$$;
create trigger votes_enforce_rules before insert or update on public.votes for each row execute function private.enforce_vote_rules();

create or replace function private.protect_session_identity()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.owner_id <> old.owner_id or new.public_code <> old.public_code or new.kind <> old.kind or new.group_id is distinct from old.group_id then
    raise exception 'Campos de identidade da sessão exigem um fluxo administrativo dedicado';
  end if;
  new.last_activity_at := now();
  return new;
end;
$$;
create trigger sessions_protect_identity before update on public.sessions for each row execute function private.protect_session_identity();

alter table public.profiles enable row level security;
alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.sessions enable row level security;
alter table public.session_members enable row level security;
alter table public.session_invites enable row level security;
alter table public.catalog_games enable row level security;
alter table public.steam_app_index enable row level security;
alter table public.session_games enable row level security;
alter table public.votes enable row level security;
alter table public.game_ownership enable row level security;
alter table public.user_game_library enable row level security;
alter table public.decision_runs enable row level security;
alter table public.decision_results enable row level security;
alter table public.audit_logs enable row level security;

create policy profiles_select_own on public.profiles for select to authenticated using ((select auth.uid()) = id);
create policy profiles_update_own on public.profiles for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);
create policy groups_select_member on public.groups for select to authenticated using (exists (select 1 from public.group_members gm where gm.group_id = id and gm.user_id = (select auth.uid())));
create policy group_members_select_member on public.group_members for select to authenticated using (exists (select 1 from public.group_members self where self.group_id = group_id and self.user_id = (select auth.uid())));
create policy sessions_select_member on public.sessions for select to authenticated using (private.is_session_member(id));
create policy sessions_update_admin on public.sessions for update to authenticated using (private.has_session_role(id, array['owner','moderator']::public.member_role[])) with check (private.has_session_role(id, array['owner','moderator']::public.member_role[]));
create policy session_members_select_member on public.session_members for select to authenticated using (private.is_session_member(session_id));
create policy session_invites_select_admin on public.session_invites for select to authenticated using (private.has_session_role(session_id, array['owner','moderator']::public.member_role[]));
create policy catalog_games_select_authenticated on public.catalog_games for select to authenticated using (true);
create policy steam_index_select_authenticated on public.steam_app_index for select to authenticated using (true);
create policy session_games_select_member on public.session_games for select to authenticated using (private.is_session_member(session_id));
create policy session_games_insert_member on public.session_games for insert to authenticated with check (added_by = (select auth.uid()) and private.is_session_member(session_id) and exists (select 1 from public.sessions s where s.id = session_id and s.status = 'open' and s.deleted_at is null));
create policy session_games_update_admin on public.session_games for update to authenticated using (private.has_session_role(session_id, array['owner','moderator']::public.member_role[])) with check (private.has_session_role(session_id, array['owner','moderator']::public.member_role[]));
create policy votes_select_member on public.votes for select to authenticated using (private.is_session_member(session_id));
create policy votes_insert_own on public.votes for insert to authenticated with check (user_id = (select auth.uid()) and private.is_session_member(session_id));
create policy votes_update_own on public.votes for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy votes_delete_own on public.votes for delete to authenticated using (user_id = (select auth.uid()));
create policy ownership_select_member on public.game_ownership for select to authenticated using (private.is_session_member(session_id));
create policy ownership_insert_own on public.game_ownership for insert to authenticated with check (user_id = (select auth.uid()) and private.is_session_member(session_id));
create policy ownership_update_own on public.game_ownership for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy ownership_delete_own on public.game_ownership for delete to authenticated using (user_id = (select auth.uid()));
create policy library_select_own on public.user_game_library for select to authenticated using (user_id = (select auth.uid()));
create policy library_insert_own on public.user_game_library for insert to authenticated with check (user_id = (select auth.uid()));
create policy library_update_own on public.user_game_library for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy library_delete_own on public.user_game_library for delete to authenticated using (user_id = (select auth.uid()));
create policy decision_runs_select_member on public.decision_runs for select to authenticated using (private.is_session_member(session_id));
create policy decision_results_select_member on public.decision_results for select to authenticated using (private.is_session_member(session_id));
create policy audit_logs_select_admin on public.audit_logs for select to authenticated using (private.has_session_role(session_id, array['owner','moderator']::public.member_role[]));

create or replace function public.create_quick_session(session_title text, owner_display_name text, method public.decision_method default 'multi_vote', expiry_days integer default 7)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare uid uuid := (select auth.uid()); new_session public.sessions; clean_name text := btrim(owner_display_name);
begin
  if uid is null then raise exception 'Autenticação obrigatória'; end if;
  if char_length(btrim(session_title)) not between 3 and 80 or char_length(clean_name) not between 2 and 40 or expiry_days not between 1 and 30 then raise exception 'Dados da sessão inválidos'; end if;
  insert into public.sessions(owner_id, title, public_code, decision_method, expires_at)
  values (uid, btrim(session_title), private.generate_session_code(), method, now() + make_interval(days => expiry_days)) returning * into new_session;
  insert into public.session_members(session_id, user_id, display_name, role) values (new_session.id, uid, clean_name, 'owner');
  insert into public.session_invites(session_id, code, created_by, expires_at) values (new_session.id, new_session.public_code, uid, new_session.expires_at);
  insert into public.audit_logs(session_id, actor_id, action, entity_type, entity_id) values (new_session.id, uid, 'session.created', 'session', new_session.id);
  return jsonb_build_object('id', new_session.id, 'public_code', new_session.public_code);
end;
$$;

create or replace function public.join_session(session_code text, member_display_name text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare uid uuid := (select auth.uid()); target public.sessions; clean_name text := btrim(member_display_name); current_count integer;
begin
  if uid is null then raise exception 'Autenticação obrigatória'; end if;
  if char_length(clean_name) not between 2 and 40 then raise exception 'Nome inválido'; end if;
  select * into target from public.sessions where public_code = upper(btrim(session_code)) and deleted_at is null for update;
  if target.id is null then raise exception 'Sessão não encontrada'; end if;
  if target.status in ('closed', 'expired', 'locked') or (target.expires_at is not null and target.expires_at <= now()) then raise exception 'Esta sessão não aceita novas entradas'; end if;
  select count(*) into current_count from public.session_members where session_id = target.id and removed_at is null;
  if current_count >= target.max_participants then raise exception 'A sessão atingiu o limite de participantes'; end if;
  insert into public.session_members(session_id, user_id, display_name, role) values (target.id, uid, clean_name, 'member')
  on conflict (session_id, user_id) do update set display_name = excluded.display_name, removed_at = null, last_seen_at = now();
  update public.sessions set last_activity_at = now() where id = target.id;
  insert into public.audit_logs(session_id, actor_id, action, entity_type, entity_id) values (target.id, uid, 'member.joined', 'session_member', uid);
  return jsonb_build_object('id', target.id, 'public_code', target.public_code);
end;
$$;

create or replace function public.unaccent_safe(value text)
returns text language sql immutable parallel safe set search_path = '' as $$
  select translate(lower(coalesce(value, '')), 'áàâãäéèêëíìîïóòôõöúùûüç', 'aaaaaeeeeiiiiooooouuuuc');
$$;

create or replace function public.search_catalog_games(search_query text, result_limit integer default 8)
returns table(id uuid, steam_appid bigint, name text, header_image text, store_url text, platforms text[], features text[], metadata_status public.metadata_status)
language sql stable security invoker set search_path = '' as $$
  select cg.id, cg.steam_appid, cg.name, cg.header_image, cg.store_url, cg.platforms, cg.features, cg.metadata_status
  from public.catalog_games cg
  where extensions.similarity(cg.normalized_name, public.unaccent_safe(search_query)) > 0.15 or cg.normalized_name like '%' || public.unaccent_safe(search_query) || '%'
  order by extensions.similarity(cg.normalized_name, public.unaccent_safe(search_query)) desc, cg.name
  limit least(greatest(result_limit, 1), 20);
$$;

create or replace function public.draw_session_game(target_session_id uuid, weighted boolean default false)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare uid uuid := (select auth.uid()); selected_game uuid; run_id uuid; selected_method public.decision_method; vote_snapshot jsonb;
begin
  if not private.is_session_member(target_session_id) then raise exception 'Sem acesso à sessão'; end if;
  select decision_method into selected_method from public.sessions where id = target_session_id and status in ('open','deciding');
  if selected_method is null then raise exception 'Sessão não está aberta'; end if;
  select coalesce(jsonb_object_agg(game_id, vote_count), '{}'::jsonb) into vote_snapshot from (select sg.id game_id, count(v.id) vote_count from public.session_games sg left join public.votes v on v.session_game_id = sg.id where sg.session_id = target_session_id and sg.removed_at is null group by sg.id) counts;
  if weighted then
    select sg.id into selected_game from public.session_games sg left join public.votes v on v.session_game_id = sg.id where sg.session_id = target_session_id and sg.removed_at is null group by sg.id order by -ln(greatest(random(), 0.000001)) / greatest(count(v.id), 1) limit 1;
  else
    select sg.id into selected_game from public.session_games sg where sg.session_id = target_session_id and sg.removed_at is null order by random() limit 1;
  end if;
  if selected_game is null then raise exception 'Nenhum jogo elegível'; end if;
  insert into public.decision_runs(session_id, method, initiated_by, seed, snapshot, completed_at) values (target_session_id, case when weighted then 'weighted_random' else 'random' end, uid, gen_random_uuid()::text, vote_snapshot, now()) returning id into run_id;
  insert into public.decision_results(session_id, decision_run_id, session_game_id) values (target_session_id, run_id, selected_game);
  insert into public.audit_logs(session_id, actor_id, action, entity_type, entity_id, metadata) values (target_session_id, uid, 'decision.drawn', 'session_game', selected_game, jsonb_build_object('weighted', weighted));
  return jsonb_build_object('game_id', selected_game, 'run_id', run_id);
end;
$$;

create or replace function public.cleanup_expired_sessions(dry_run boolean default true, batch_size integer default 100)
returns integer language plpgsql security definer set search_path = '' as $$
declare processed integer;
begin
  select count(*) into processed from (select id from public.sessions where kind = 'quick' and status not in ('closed','expired') and expires_at <= now() and deleted_at is null limit least(greatest(batch_size, 1), 500)) candidates;
  if not dry_run then update public.sessions set status = 'expired', deleted_at = now() where id in (select id from public.sessions where kind = 'quick' and status not in ('closed','expired') and expires_at <= now() and deleted_at is null limit least(greatest(batch_size, 1), 500)); end if;
  return processed;
end;
$$;

revoke all on all tables in schema public from anon, authenticated;
grant usage on schema public to authenticated;
grant select, update on public.profiles to authenticated;
grant select on public.groups to authenticated;
grant select on public.group_members to authenticated;
grant select, update on public.sessions to authenticated;
grant select on public.session_members to authenticated;
grant select on public.session_invites to authenticated;
grant select on public.catalog_games to authenticated;
grant select on public.steam_app_index to authenticated;
grant select, insert, update on public.session_games to authenticated;
grant select, insert, update, delete on public.votes to authenticated;
grant select, insert, update, delete on public.game_ownership to authenticated;
grant select, insert, update, delete on public.user_game_library to authenticated;
grant select on public.decision_runs, public.decision_results, public.audit_logs to authenticated;
grant usage on schema private to authenticated;
grant execute on function private.is_session_member(uuid), private.has_session_role(uuid, public.member_role[]) to authenticated;

revoke all on function public.create_quick_session(text, text, public.decision_method, integer) from public, anon;
revoke all on function public.join_session(text, text) from public, anon;
revoke all on function public.search_catalog_games(text, integer) from public, anon;
revoke all on function public.draw_session_game(uuid, boolean) from public, anon;
revoke all on function public.cleanup_expired_sessions(boolean, integer) from public, anon, authenticated;
grant execute on function public.create_quick_session(text, text, public.decision_method, integer) to authenticated;
grant execute on function public.join_session(text, text) to authenticated;
grant execute on function public.search_catalog_games(text, integer) to authenticated;
grant execute on function public.draw_session_game(uuid, boolean) to authenticated;
grant execute on function public.cleanup_expired_sessions(boolean, integer) to service_role;

alter publication supabase_realtime add table public.sessions, public.session_members, public.session_games, public.votes, public.game_ownership, public.decision_results;

commit;
