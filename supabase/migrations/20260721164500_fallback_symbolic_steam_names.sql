begin;

create or replace function public.normalize_steam_name(value text)
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$
  select coalesce(
    nullif(
      btrim(
        regexp_replace(
          regexp_replace(
            translate(
              lower(extensions.unaccent('extensions.unaccent'::regdictionary, coalesce(value, ''))),
              $chars$'’`´$chars$,
              ''
            ),
            '[^[:alnum:]]+',
            ' ',
            'g'
          ),
          '[[:space:]]+',
          ' ',
          'g'
        )
      ),
      ''
    ),
    lower(btrim(coalesce(value, '')))
  );
$$;

update public.steam_app_index
set normalized_name = public.normalize_steam_name(name)
where normalized_name is distinct from public.normalize_steam_name(name);

commit;
