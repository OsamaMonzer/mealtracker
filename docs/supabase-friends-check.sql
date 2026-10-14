-- Run in Supabase → SQL Editor before inviting friends.
-- 1) Is row-level security ON for every table? Every row should say true.
select relname as table_name, relrowsecurity as rls_on
from pg_class
where relnamespace = 'public'::regnamespace
  and relname in ('ingredients','recipes','recipe_ingredients','daily_logs','weight_logs','goals')
order by 1;

-- 2) Which policies exist? Each table needs rules limited to auth.uid().
select tablename, policyname, cmd, roles, qual, with_check
from pg_policies where schemaname = 'public' order by 1, 2;

-- 3) Ingredients with no owner are SHARED with every user (friends can see and log them, but not edit them).
select count(*) filter (where user_id is null) as shared_with_everyone,
       count(*) filter (where user_id is not null) as private
from ingredients;

-- ─────────────────────────────────────────────────────────────────────────────
-- FIX — only run this part if step 1 showed false or step 2 is missing a table.
-- It is safe to run more than once.
-- ─────────────────────────────────────────────────────────────────────────────
/*
do $$ declare t text; begin
  foreach t in array array['recipes','daily_logs','weight_logs','goals'] loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists own_rows on %I', t);
    execute format('create policy own_rows on %I for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid())', t);
  end loop;
end $$;

alter table ingredients enable row level security;
drop policy if exists read_own_or_shared on ingredients;
create policy read_own_or_shared on ingredients for select to authenticated using (user_id is null or user_id = auth.uid());
drop policy if exists write_own on ingredients;
create policy write_own on ingredients for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

alter table recipe_ingredients enable row level security;
drop policy if exists via_own_recipe on recipe_ingredients;
create policy via_own_recipe on recipe_ingredients for all to authenticated
  using (exists (select 1 from recipes r where r.id = recipe_id and r.user_id = auth.uid()))
  with check (exists (select 1 from recipes r where r.id = recipe_id and r.user_id = auth.uid()));
*/

-- Optional: make your existing ingredients private instead of shared
-- update ingredients set user_id = '9cc56a4b-9b15-4f91-83e1-42137709fe20' where user_id is null;
