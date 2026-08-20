/*
# Remove tenant scoping (idempotent re-run)

Some policies from a prior partial run already exist. Drop them first,
then recreate. Also make surveys.tenant_id nullable if not already.
*/

-- Drop any existing policies (from current or prior runs)
DROP POLICY IF EXISTS "surveys_member_select" ON public.surveys;
DROP POLICY IF EXISTS "surveys_manager_insert" ON public.surveys;
DROP POLICY IF EXISTS "surveys_manager_update" ON public.surveys;
DROP POLICY IF EXISTS "surveys_staff_insert" ON public.surveys;
DROP POLICY IF EXISTS "surveys_staff_update" ON public.surveys;
DROP POLICY IF EXISTS "surveys_auth_select" ON public.surveys;
DROP POLICY IF EXISTS "surveys_admin_manager_insert" ON public.surveys;
DROP POLICY IF EXISTS "surveys_admin_manager_update" ON public.surveys;
DROP POLICY IF EXISTS "responses_member_select" ON public.responses;
DROP POLICY IF EXISTS "responses_auth_select" ON public.responses;

-- Make tenant_id nullable
ALTER TABLE public.surveys ALTER COLUMN tenant_id DROP NOT NULL;

-- Recreate policies (no tenant scoping)
CREATE POLICY "surveys_auth_select" ON public.surveys FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "surveys_admin_manager_insert" ON public.surveys FOR INSERT
  TO authenticated WITH CHECK (is_admin() OR public.current_role() = 'manager');

CREATE POLICY "surveys_staff_insert" ON public.surveys FOR INSERT
  TO authenticated WITH CHECK (public.current_role() = 'staff' AND status = 'draft');

CREATE POLICY "surveys_admin_manager_update" ON public.surveys FOR UPDATE
  TO authenticated USING (is_admin() OR public.current_role() = 'manager')
  WITH CHECK (is_admin() OR public.current_role() = 'manager');

CREATE POLICY "surveys_staff_update" ON public.surveys FOR UPDATE
  TO authenticated
  USING (public.current_role() = 'staff' AND status = 'draft')
  WITH CHECK (public.current_role() = 'staff' AND status = 'draft');

CREATE POLICY "responses_auth_select" ON public.responses FOR SELECT
  TO authenticated USING (true);
