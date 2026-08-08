-- Build Your Block — social layer (leaderboard + visiting blocks)
-- No PII stored: just a player-chosen display name and their city snapshot.
-- RLS on with no table policies => anon can only go through the SECURITY DEFINER
-- functions below (which control exactly what is exposed).

create table if not exists public.blocks (
  id uuid primary key,
  name text not null,
  level int not null default 1,
  net_worth bigint not null default 0,
  city jsonb,
  updated_at timestamptz not null default now()
);
alter table public.blocks enable row level security;

create or replace function public.block_upsert(p_id uuid, p_name text, p_level int, p_net bigint, p_city jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into public.blocks(id, name, level, net_worth, city, updated_at)
  values (p_id,
          left(coalesce(nullif(trim(p_name), ''), 'Builder'), 20),
          greatest(1, coalesce(p_level, 1)),
          greatest(0, coalesce(p_net, 0)),
          p_city, now())
  on conflict (id) do update
    set name = excluded.name, level = excluded.level,
        net_worth = excluded.net_worth, city = excluded.city, updated_at = now();
end $$;

create or replace function public.block_leaderboard(p_limit int default 25)
returns table(id uuid, name text, level int, net_worth bigint)
language sql security definer set search_path = public as $$
  select id, name, level, net_worth
  from public.blocks
  order by net_worth desc, level desc, updated_at desc
  limit least(coalesce(p_limit, 25), 50);
$$;

create or replace function public.block_get(p_id uuid)
returns table(id uuid, name text, level int, net_worth bigint, city jsonb)
language sql security definer set search_path = public as $$
  select id, name, level, net_worth, city from public.blocks where id = p_id;
$$;

grant execute on function public.block_upsert(uuid, text, int, bigint, jsonb) to anon, authenticated;
grant execute on function public.block_leaderboard(int) to anon, authenticated;
grant execute on function public.block_get(uuid) to anon, authenticated;
