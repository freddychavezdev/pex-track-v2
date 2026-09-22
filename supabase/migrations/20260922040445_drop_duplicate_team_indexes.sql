-- The *_id_idx indexes cover the same single columns and are retained.
-- Keeping duplicate B-tree indexes adds write and maintenance cost without
-- improving query plans.
drop index if exists public.teams_technician_one_idx;
drop index if exists public.teams_technician_two_idx;
