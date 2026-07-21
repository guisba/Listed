begin;

-- Remove untouched development seed rows from runtime storage. Real provider
-- responses always set metadata_updated_at, last_import_attempt_at or raw_metadata.
delete from public.catalog_games cg
where cg.source = 'steam'
  and cg.metadata_status = 'partial'
  and cg.metadata_updated_at is null
  and cg.last_import_attempt_at is null
  and cg.raw_metadata is null
  and not exists (
    select 1
    from public.session_games sg
    where sg.catalog_game_id = cg.id
  );

commit;
