-- Create a customer record only after a public survey response is submitted.
-- This is additive and does not change the existing tenants or survey flows.

CREATE TABLE IF NOT EXISTS public.customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text,
  email text,
  phone text,
  source_response_id uuid UNIQUE REFERENCES public.responses(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS customers_email_unique
  ON public.customers (lower(email))
  WHERE email IS NOT NULL AND length(trim(email)) > 0;

CREATE UNIQUE INDEX IF NOT EXISTS customers_phone_unique
  ON public.customers (phone)
  WHERE phone IS NOT NULL AND length(trim(phone)) > 0;

ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "customers_auth_select" ON public.customers;
CREATE POLICY "customers_auth_select" ON public.customers
  FOR SELECT TO authenticated USING (true);

CREATE OR REPLACE FUNCTION public.create_customer_from_response()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.customers (full_name, email, phone, source_response_id)
  VALUES (
    NULLIF(trim(NEW.respondent_name), ''),
    NULLIF(lower(trim(NEW.respondent_email)), ''),
    NULLIF(trim(NEW.respondent_phone), ''),
    NEW.id
  )
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS responses_create_customer ON public.responses;
CREATE TRIGGER responses_create_customer
  AFTER INSERT ON public.responses
  FOR EACH ROW EXECUTE FUNCTION public.create_customer_from_response();

GRANT SELECT ON public.customers TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customers TO service_role;