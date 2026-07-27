-- "moderator" remains readable for backward compatibility with the currently
-- deployed client; all new role writes use "co_owner".
alter type public.member_role add value if not exists 'co_owner';
alter type public.preferred_theme add value if not exists 'purple';
alter type public.preferred_theme add value if not exists 'oled-black';
