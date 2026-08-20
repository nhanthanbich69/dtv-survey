/*
# Remove tenant scoping from surveys and responses

## Why
The app is being simplified: surveys no longer belong to a "khách hàng" (tenant).
Anyone with the public link can fill out a survey, and all authenticated staff
can see all surveys and responses — no tenant assignment required.

## Changes
1. Make `surveys.tenant_id` nullable (was NOT NULL).
2. Drop tenant-scoped RLS policies on `surveys` and `responses`.
3. Replace with simpler policies: all authenticated users can SELECT all
   surveys and responses; admin/manager/staff can write surveys; admin can
   delete; anon can still INSERT responses for published surveys.
4. No data loss — existing rows keep their tenant_id values, but new rows
   can have tenant_id = NULL.
*/

-- 1. Allow surveys.tenant_id to be NULL
ALTER TABLE public.surveys ALTER COLUMN tenant_id DROP NOT NULL;

-- 2. Drop tenant-scoped policies on surveys
DROP POLICY IF EXISTS "surveys_member_select" ON public.surveys;
DROP POLICY IF EXISTS "surveys_manager_insert" ON public.surveys;
DROP POLICY IF EXISTS "surveys_manager_update" ON public.surveys;
DROP POLICY IF EXISTS "surveys_staff_insert" ON public.surveys;
DROP POLICY IF EXISTS "surveys_staff_update" ON public.surveys;

-- 3. Replace with simpler policies (no tenant scoping)
-- All authenticated users can see all surveys
CREATE POLICY "surveys_auth_select" ON public.surveys FOR SELECT
  TO authenticated USING (true);

-- Admin and manager can insert surveys
CREATE POLICY "surveys_admin_manager_insert" ON public.surveys FOR INSERT
  TO authenticated WITH CHECK (is_admin() OR public.current_role() = 'manager');

-- Staff can insert draft surveys
CREATE POLICY "surveys_staff_insert" ON public.surveys FOR INSERT
  TO authenticated WITH CHECK (public.current_role() = 'staff' AND status = 'draft');

-- Admin and manager can update surveys
CREATE POLICY "surveys_admin_manager_update" ON public.surveys FOR UPDATE
  TO authenticated USING (is_admin() OR public.current_role() = 'manager')
  WITH CHECK (is_admin() OR public.current_role() = 'manager');

-- Staff can update draft surveys
CREATE POLICY "surveys_staff_update" ON public.surveys FOR UPDATE
  TO authenticated
  USING (public.current_role() = 'staff' AND status = 'draft')
  WITH CHECK (public.current_role() = 'staff' AND status = 'draft');

-- 4. Drop tenant-scoped policy on responses, replace with simple one
DROP POLICY IF EXISTS "responses_member_select" ON public.responses;
CREATE POLICY "responses_auth_select" ON public.responses FOR SELECT
  TO authenticated USING (true);
