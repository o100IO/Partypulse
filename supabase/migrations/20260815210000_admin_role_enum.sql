-- Must be its own migration/transaction before using 'admin' in SQL
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'admin';
