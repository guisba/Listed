create or replace function private.enforce_vote_rules()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_method public.decision_method;
  current_status public.session_status;
  is_locked boolean;
  allow_changes boolean;
  max_votes smallint;
  existing_vote_count integer;
begin
  select s.decision_method, s.status, ss.voting_locked, ss.allow_vote_changes, ss.max_votes_per_member
  into current_method, current_status, is_locked, allow_changes, max_votes
  from public.sessions s
  join public.session_settings ss on ss.session_id = s.id
  where s.id = new.session_id;

  if current_status not in ('open', 'deciding') or is_locked then
    raise exception 'A votação está fechada';
  end if;
  if not exists (
    select 1
    from public.session_games
    where id = new.session_game_id
      and session_id = new.session_id
      and removed_at is null
  ) then
    raise exception 'Jogo inválido';
  end if;
  if tg_op = 'UPDATE' and not allow_changes then
    raise exception 'A alteração de voto está desativada';
  end if;

  if tg_op = 'UPDATE' then
    select count(*) into existing_vote_count
    from public.votes v
    where v.session_id = new.session_id
      and v.user_id = new.user_id
      and v.id <> old.id;
  else
    select count(*) into existing_vote_count
    from public.votes v
    where v.session_id = new.session_id
      and v.user_id = new.user_id;
  end if;

  if max_votes > 0 and existing_vote_count >= max_votes then
    raise exception 'Limite de votos atingido';
  end if;

  if current_method = 'single_vote' then
    if not allow_changes and existing_vote_count > 0 then
      raise exception 'A alteração de voto está desativada';
    end if;
    delete from public.votes
    where session_id = new.session_id
      and user_id = new.user_id
      and session_game_id <> new.session_game_id;
  end if;
  return new;
end;
$$;

drop policy votes_insert_own on public.votes;
create policy votes_insert_own
on public.votes for insert to authenticated
with check (
  user_id = (select auth.uid())
  and private.is_session_member(session_id)
  and exists (
    select 1
    from public.session_settings ss
    where ss.session_id = votes.session_id and not ss.voting_locked
  )
);

drop policy votes_update_own on public.votes;
create policy votes_update_own
on public.votes for update to authenticated
using (
  user_id = (select auth.uid())
  and exists (
    select 1
    from public.session_settings ss
    where ss.session_id = votes.session_id
      and not ss.voting_locked
      and ss.allow_vote_changes
  )
)
with check (
  user_id = (select auth.uid())
  and exists (
    select 1
    from public.session_settings ss
    where ss.session_id = votes.session_id
      and not ss.voting_locked
      and ss.allow_vote_changes
  )
);

drop policy votes_delete_own on public.votes;
create policy votes_delete_own
on public.votes for delete to authenticated
using (
  user_id = (select auth.uid())
  and exists (
    select 1
    from public.session_settings ss
    where ss.session_id = votes.session_id
      and not ss.voting_locked
      and ss.allow_vote_changes
  )
);

create or replace function public.join_session(session_code text, member_display_name text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  target public.sessions;
  target_settings public.session_settings;
  clean_name text := btrim(member_display_name);
  current_count integer;
  is_anonymous_user boolean;
begin
  if uid is null then raise exception 'Autenticação obrigatória'; end if;
  if char_length(clean_name) not between 2 and 40 then raise exception 'Nome inválido'; end if;

  select * into target
  from public.sessions
  where public_code = upper(btrim(session_code)) and deleted_at is null
  for update;

  if target.id is null then raise exception 'Sessão não encontrada'; end if;
  select * into target_settings
  from public.session_settings
  where session_id = target.id;

  if exists (
    select 1
    from public.session_bans
    where session_id = target.id and user_id = uid and revoked_at is null
  ) then
    raise exception 'Acesso bloqueado nesta sessão';
  end if;
  if target.status in ('closed', 'expired', 'locked')
    or (target.expires_at is not null and target.expires_at <= now()) then
    raise exception 'Esta sessão não aceita novas entradas';
  end if;

  select coalesce(is_anonymous, false) into is_anonymous_user
  from auth.users
  where id = uid;
  if is_anonymous_user and not target_settings.allow_anonymous_members then
    raise exception 'Participantes anônimos não são permitidos';
  end if;

  select count(*) into current_count
  from public.session_members
  where session_id = target.id and removed_at is null;
  if current_count >= target.max_participants then
    raise exception 'A sessão atingiu o limite de participantes';
  end if;

  insert into public.session_members(session_id, user_id, display_name, role)
  values (target.id, uid, clean_name, 'member')
  on conflict (session_id, user_id) do update
    set display_name = excluded.display_name,
        role = case
          when public.session_members.role = 'owner' then 'owner'::public.member_role
          else 'member'::public.member_role
        end,
        removed_at = null,
        last_seen_at = now();

  update public.sessions set last_activity_at = now() where id = target.id;
  insert into public.audit_logs(session_id, actor_id, action, entity_type, entity_id)
  values (target.id, uid, 'member.joined', 'session_member', uid);
  return jsonb_build_object('id', target.id, 'public_code', target.public_code);
end;
$$;
