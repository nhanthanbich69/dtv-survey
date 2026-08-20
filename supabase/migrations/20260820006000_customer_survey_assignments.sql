-- Phase 2: customer ownership, survey links, and internal assignments.

ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS code text,
  ADD COLUMN IF NOT EXISTS contact_person text,
  ADD COLUMN IF NOT EXISTS notes text,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active';

ALTER TABLE public.customers
  DROP CONSTRAINT IF EXISTS customers_status_check;
ALTER TABLE public.customers
  ADD CONSTRAINT customers_status_check CHECK (status IN ('active', 'inactive'));

CREATE UNIQUE INDEX IF NOT EXISTS customers_tenant_code_unique
  ON public.customers (tenant_id, lower(code))
  WHERE code IS NOT NULL AND length(trim(code)) > 0;

ALTER TABLE public.surveys
  ADD COLUMN IF NOT EXISTS customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL;
ALTER TABLE public.responses
  ADD COLUMN IF NOT EXISTS customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION public.validate_survey_customer_tenant()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.customer_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.customers c
    WHERE c.id = NEW.customer_id AND c.tenant_id = NEW.tenant_id
  ) THEN
    RAISE EXCEPTION 'Customer does not belong to the survey tenant';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS surveys_validate_customer_tenant ON public.surveys;
CREATE TRIGGER surveys_validate_customer_tenant
  BEFORE INSERT OR UPDATE OF tenant_id, customer_id ON public.surveys
  FOR EACH ROW EXECUTE FUNCTION public.validate_survey_customer_tenant();

CREATE TABLE IF NOT EXISTS public.survey_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  survey_id uuid NOT NULL REFERENCES public.surveys(id) ON DELETE CASCADE,
  assignee_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  assigned_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'assigned',
  assigned_at timestamptz NOT NULL DEFAULT now(),
  due_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT survey_assignments_status_check CHECK (status IN ('assigned', 'in_progress', 'completed', 'cancelled'))
);

CREATE UNIQUE INDEX IF NOT EXISTS survey_assignments_survey_assignee_unique
  ON public.survey_assignments (survey_id, assignee_id);
CREATE INDEX IF NOT EXISTS survey_assignments_tenant_idx
  ON public.survey_assignments (tenant_id, status);

DROP POLICY IF EXISTS surveys_authenticated_select ON public.surveys;
CREATE POLICY surveys_authenticated_select ON public.surveys
  FOR SELECT TO authenticated
  USING (
    public.is_admin()
    OR (
      tenant_id = public.current_tenant_id()
      AND (
        public.current_role() <> 'staff'
        OR created_by = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.survey_assignments a
          WHERE a.survey_id = surveys.id AND a.assignee_id = auth.uid()
        )
      )
    )
  );

CREATE OR REPLACE FUNCTION public.validate_assignment_tenant()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND public.current_role() = 'staff'
    AND (NEW.tenant_id, NEW.survey_id, NEW.assignee_id, NEW.assigned_by)
      IS DISTINCT FROM (OLD.tenant_id, OLD.survey_id, OLD.assignee_id, OLD.assigned_by) THEN
    RAISE EXCEPTION 'Staff can only update assignment status';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.surveys s
    WHERE s.id = NEW.survey_id AND s.tenant_id = NEW.tenant_id
  ) OR NOT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = NEW.assignee_id AND p.tenant_id = NEW.tenant_id AND p.status = 'active'
  ) OR NOT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = NEW.assigned_by AND p.tenant_id = NEW.tenant_id AND p.status = 'active'
  ) THEN
    RAISE EXCEPTION 'Assignment records must belong to the same tenant';
  END IF;
  IF NEW.status = 'completed' AND NEW.completed_at IS NULL THEN
    NEW.completed_at := now();
  ELSIF NEW.status <> 'completed' THEN
    NEW.completed_at := NULL;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS survey_assignments_validate_tenant ON public.survey_assignments;
CREATE TRIGGER survey_assignments_validate_tenant
  BEFORE INSERT OR UPDATE ON public.survey_assignments
  FOR EACH ROW EXECUTE FUNCTION public.validate_assignment_tenant();

CREATE OR REPLACE FUNCTION public.create_customer_from_response()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text;
  v_phone text;
  v_name text;
  v_existing_id uuid;
BEGIN
  v_name := NULLIF(trim(NEW.respondent_name), '');
  v_email := NULLIF(lower(trim(NEW.respondent_email)), '');
  v_phone := NULLIF(trim(NEW.respondent_phone), '');

  IF v_email IS NOT NULL THEN
    SELECT id INTO v_existing_id FROM public.customers
    WHERE tenant_id = NEW.tenant_id AND lower(email) = v_email LIMIT 1;
  END IF;
  IF v_existing_id IS NULL AND v_phone IS NOT NULL THEN
    SELECT id INTO v_existing_id FROM public.customers
    WHERE tenant_id = NEW.tenant_id AND phone = v_phone LIMIT 1;
  END IF;

  IF v_existing_id IS NOT NULL THEN
    UPDATE public.customers
    SET full_name = COALESCE(v_name, full_name), email = COALESCE(v_email, email),
        phone = COALESCE(v_phone, phone), source_response_id = NEW.id, updated_at = now()
    WHERE id = v_existing_id AND tenant_id = NEW.tenant_id;
  ELSE
    BEGIN
      INSERT INTO public.customers (tenant_id, full_name, email, phone, source_response_id)
      VALUES (NEW.tenant_id, v_name, v_email, v_phone, NEW.id)
      RETURNING id INTO v_existing_id;
    EXCEPTION WHEN unique_violation THEN
      SELECT id INTO v_existing_id FROM public.customers
      WHERE tenant_id = NEW.tenant_id AND (lower(email) = v_email OR phone = v_phone)
      LIMIT 1;
    END;
  END IF;

  IF v_existing_id IS NOT NULL THEN
    UPDATE public.responses SET customer_id = v_existing_id WHERE id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

DROP POLICY IF EXISTS customers_member_insert ON public.customers;
DROP POLICY IF EXISTS customers_member_update ON public.customers;
DROP POLICY IF EXISTS customers_member_delete ON public.customers;
CREATE POLICY customers_member_insert ON public.customers
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.current_tenant_id() AND public.current_role() IN ('admin', 'manager', 'staff'));
CREATE POLICY customers_member_update ON public.customers
  FOR UPDATE TO authenticated
  USING (public.is_admin() OR (tenant_id = public.current_tenant_id() AND public.current_role() IN ('manager', 'staff')))
  WITH CHECK (public.is_admin() OR (tenant_id = public.current_tenant_id() AND public.current_role() IN ('manager', 'staff')));
CREATE POLICY customers_member_delete ON public.customers
  FOR DELETE TO authenticated
  USING (public.is_admin() OR (tenant_id = public.current_tenant_id() AND public.current_role() = 'manager'));

ALTER TABLE public.survey_assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY assignments_admin_all ON public.survey_assignments
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY assignments_manager_all ON public.survey_assignments
  FOR ALL TO authenticated
  USING (tenant_id = public.current_tenant_id() AND public.current_role() = 'manager')
  WITH CHECK (tenant_id = public.current_tenant_id() AND public.current_role() = 'manager');
CREATE POLICY assignments_staff_select ON public.survey_assignments
  FOR SELECT TO authenticated
  USING (tenant_id = public.current_tenant_id() AND assignee_id = auth.uid());
CREATE POLICY assignments_staff_update ON public.survey_assignments
  FOR UPDATE TO authenticated
  USING (tenant_id = public.current_tenant_id() AND assignee_id = auth.uid())
  WITH CHECK (tenant_id = public.current_tenant_id() AND assignee_id = auth.uid());
CREATE POLICY assignments_viewer_select ON public.survey_assignments
  FOR SELECT TO authenticated
  USING (tenant_id = public.current_tenant_id() AND public.current_role() = 'viewer');

GRANT SELECT, INSERT, UPDATE, DELETE ON public.customers TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.survey_assignments TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.survey_assignments TO service_role;
