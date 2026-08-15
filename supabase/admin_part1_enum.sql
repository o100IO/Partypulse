-- Run AFTER base schema exists on aravfgeswpnnceujngmb
-- In SQL Editor: run this whole file (two statements are separate migrations; if enum error, run part 1 alone first, then part 2)

-- PART 1
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'admin';
