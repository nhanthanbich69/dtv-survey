-- Restore tenant ownership for existing records and enforce it with RLS.

DO $$
DECLARE
  v_legacy_tenant_id uuid;
BEGIN
  SELECT id INTO v_legacy_tenant_id
  FROM public.tenants
  WHERE code = 'legacy'
  LIMIT 1;

  IF v_legacy_tenant_id IS NULL THEN
    INSERT INTO public.tenants (name, code, status)
    VALUES ('DTV Survey Legacy Workspace', 'legacy', 'active')
    RETURNING id INTO v_legacy_tenant_id;
  END IF;

  UPDATE public.profiles SET tenant_id = v_legacy_tenant_id WHERE tenant_id IS NULL;
  UPDATE public.surveys SET tenant_id = v_legacy_tenant_id WHERE tenant_id IS NULL;
END;
$$;

ALTER TABLE public.responses ADD COLUMN IF NOT EXISTS tenant_id uuid;
UPDATE public.responses r
SET tenant_id = s.tenant_id
FROM public.surveys s
WHERE r.survey_id = s.id
  AND r.tenant_id IS NULL;

DO $$
DECLARE
  v_legacy_tenant_id uuid;
BEGIN
  SELECT id INTO v_legacy_tenant_id FROM public.tenants WHERE code = 'legacy' LIMIT 1;
  UPDATE public.responses SET tenant_id = v_legacy_tenant_id WHERE tenant_id IS NULL;
END;
$$;

ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS tenant_id uuid;
UPDATE public.customers c
SET tenant_id = r.tenant_id
FROM public.responses r
WHERE c.source_response_id = r.id
  AND c.tenant_id IS NULL;

DO $$
DECLARE
  v_legacy_tenant_id uuid;
BEGIN
  SELECT id INTO v_legacy_tenant_id FROM public.tenants WHERE code = 'legacy' LIMIT 1;
  UPDATE public.customers SET tenant_id = v_legacy_tenant_id WHERE tenant_id IS NULL;
END;
$$;

ALTER TABLE public.profiles ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.surveys ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.responses ALTER COLUMN tenant_id SET NOT NULL;
ALTER TABLE public.customers ALTER COLUMN tenant_id SET NOT NULL;

DROP INDEX IF EXISTS public.customers_email_unique;
DROP INDEX IF EXISTS public.customers_phone_unique;
CREATE UNIQUE INDEX IF NOT EXISTS customers_tenant_email_unique
  ON public.customers (tenant_id, lower(email))
  WHERE email IS NOT NULL AND length(trim(email)) > 0;
CREATE UNIQUE INDEX IF NOT EXISTS customers_tenant_phone_unique
  ON public.customers (tenant_id, phone)
  WHERE phone IS NOT NULL AND length(trim(phone)) > 0;

CREATE OR REPLACE FUNCTION public.current_tenant_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT tenant_id
  FROM public.profiles
  WHERE id = auth.uid()
    AND status = 'active'
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.current_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role::text
  FROM public.profiles
  WHERE id = auth.uid()
    AND status = 'active'
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(public.current_role() = 'admin', false);
$$;

CREATE OR REPLACE FUNCTION public.set_response_tenant()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_id uuid;
BEGIN
  SELECT tenant_id INTO v_tenant_id
  FROM public.surveys
  WHERE id = NEW.survey_id
    AND status = 'published';

  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Survey is not published or does not exist';
  END IF;

  NEW.tenant_id := v_tenant_id;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.published_survey_tenant(p_survey_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT tenant_id
  FROM public.surveys
  WHERE id = p_survey_id
    AND status = 'published'
  LIMIT 1;
$$;

DROP TRIGGER IF EXISTS responses_set_tenant ON public.responses;
CREATE TRIGGER responses_set_tenant
  BEFORE INSERT ON public.responses
  FOR EACH ROW EXECUTE FUNCTION public.set_response_tenant();

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
    SELECT id INTO v_existing_id
    FROM public.customers
    WHERE tenant_id = NEW.tenant_id AND lower(email) = v_email
    LIMIT 1;
  END IF;

  IF v_existing_id IS NULL AND v_phone IS NOT NULL THEN
    SELECT id INTO v_existing_id
    FROM public.customers
    WHERE tenant_id = NEW.tenant_id AND phone = v_phone
    LIMIT 1;
  END IF;

  IF v_existing_id IS NOT NULL THEN
    BEGIN
      UPDATE public.customers
      SET full_name = COALESCE(v_name, full_name),
          email = COALESCE(v_email, email),
          phone = COALESCE(v_phone, phone),
          source_response_id = NEW.id,
          updated_at = now()
      WHERE id = v_existing_id AND tenant_id = NEW.tenant_id;
    EXCEPTION WHEN unique_violation THEN
      UPDATE public.customers
      SET full_name = COALESCE(v_name, full_name),
          source_response_id = NEW.id,
          updated_at = now()
      WHERE id = v_existing_id AND tenant_id = NEW.tenant_id;
    END;
  ELSE
    BEGIN
      INSERT INTO public.customers (tenant_id, full_name, email, phone, source_response_id)
      VALUES (NEW.tenant_id, v_name, v_email, v_phone, NEW.id);
    EXCEPTION WHEN unique_violation THEN
      RETURN NEW;
    END;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS responses_create_customer ON public.responses;
CREATE TRIGGER responses_create_customer
  AFTER INSERT ON public.responses
  FOR EACH ROW EXECUTE FUNCTION public.create_customer_from_response();

DO $$
DECLARE
  p record;
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['tenants', 'profiles', 'surveys', 'responses', 'customers'] LOOP
    FOR p IN
      SELECT policyname
      FROM pg_policies
      WHERE schemaname = 'public' AND tablename = t
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', p.policyname, t);
    END LOOP;
  END LOOP;
END;
$$;

ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.surveys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenants_admin_all ON public.tenants
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());
CREATE POLICY tenants_member_select ON public.tenants
  FOR SELECT TO authenticated
  USING (NOT public.is_admin() AND id = public.current_tenant_id());

CREATE POLICY profiles_admin_all ON public.profiles
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());
CREATE POLICY profiles_member_select ON public.profiles
  FOR SELECT TO authenticated
  USING (id = auth.uid() OR tenant_id = public.current_tenant_id());

CREATE POLICY surveys_authenticated_select ON public.surveys
  FOR SELECT TO authenticated
  USING (public.is_admin() OR tenant_id = public.current_tenant_id());
CREATE POLICY surveys_public_select ON public.surveys
  FOR SELECT TO anon
  USING (status = 'published');
CREATE POLICY surveys_authenticated_insert ON public.surveys
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_admin()
    OR (
      tenant_id = public.current_tenant_id()
      AND public.current_role() IN ('manager', 'staff')
      AND (public.current_role() = 'manager' OR status = 'draft')
    )
  );
CREATE POLICY surveys_admin_update ON public.surveys
  FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());
CREATE POLICY surveys_manager_update ON public.surveys
  FOR UPDATE TO authenticated
  USING (public.current_role() = 'manager' AND tenant_id = public.current_tenant_id())
  WITH CHECK (public.current_role() = 'manager' AND tenant_id = public.current_tenant_id());
CREATE POLICY surveys_staff_update ON public.surveys
  FOR UPDATE TO authenticated
  USING (
    public.current_role() = 'staff'
    AND tenant_id = public.current_tenant_id()
    AND created_by = auth.uid()
    AND status = 'draft'
  )
  WITH CHECK (
    public.current_role() = 'staff'
    AND tenant_id = public.current_tenant_id()
    AND created_by = auth.uid()
    AND status = 'draft'
  );
CREATE POLICY surveys_admin_delete ON public.surveys
  FOR DELETE TO authenticated
  USING (public.is_admin());

CREATE POLICY responses_authenticated_select ON public.responses
  FOR SELECT TO authenticated
  USING (public.is_admin() OR tenant_id = public.current_tenant_id());
CREATE POLICY responses_public_insert ON public.responses
  FOR INSERT TO anon
  WITH CHECK (
    tenant_id = public.published_survey_tenant(survey_id)
  );

CREATE POLICY customers_authenticated_select ON public.customers
  FOR SELECT TO authenticated
  USING (public.is_admin() OR tenant_id = public.current_tenant_id());

GRANT SELECT ON public.tenants, public.profiles, public.surveys, public.customers TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.profiles, public.surveys TO authenticated;
GRANT SELECT ON public.surveys TO anon;
GRANT INSERT ON public.responses TO anon;
GRANT SELECT ON public.responses TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customers TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.responses TO service_role;
