-- Executar contra um banco local temporário. Este arquivo não cria dados persistentes.
begin;

do $$
declare missing_rls integer;
begin
  select count(*) into missing_rls
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity;
  if missing_rls <> 0 then raise exception '% tabelas públicas sem RLS', missing_rls; end if;
  if has_function_privilege('anon', 'public.create_quick_session(text,text,public.decision_method,integer)', 'execute') then
    raise exception 'anon não deve executar create_quick_session';
  end if;
end $$;

rollback;
