/*
# Fix service_role DML grants on all tables

## Why
The `service_role` bypasses RLS but still needs table-level GRANTs to read/write.
Currently it only has REFERENCES, TRIGGER, TRUNCATE on all four tables — it is
missing INSERT, SELECT, UPDATE, DELETE. This causes edge functions
(bootstrap-admin, admin-users) to fail when inserting into `profiles`,
producing the error "Không lưu được hồ sơ quản trị viên."

## Changes
1. GRANT INSERT, SELECT, UPDATE, DELETE on all public tables TO service_role.
2. No schema changes, no RLS policy changes, no data changes.
*/

GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tenants TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.surveys TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.responses TO service_role;
