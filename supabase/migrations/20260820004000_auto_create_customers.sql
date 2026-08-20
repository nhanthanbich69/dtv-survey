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

-- Hàm xử lý chuẩn hóa: Chống trùng chéo index thông minh (UPSERT an toàn)
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

  -- 1. Tìm ID khách hàng cũ dựa trên Email trước
  IF v_email IS NOT NULL THEN
    SELECT id INTO v_existing_id FROM public.customers WHERE lower(email) = v_email LIMIT 1;
  END IF;

  -- 2. Nếu không trùng Email, kiểm tra tiếp xem có trùng Số điện thoại không
  IF v_existing_id IS NULL AND v_phone IS NOT NULL THEN
    SELECT id INTO v_existing_id FROM public.customers WHERE phone = v_phone LIMIT 1;
  END IF;

  -- 3. Tiến hành ghi nhận thông tin
  IF v_existing_id IS NOT NULL THEN
    -- TRƯỜNG HỢP TRÙNG: Cập nhật bản ghi cũ
    BEGIN
      UPDATE public.customers
      SET 
        full_name = COALESCE(v_name, full_name),
        email = COALESCE(v_email, email),
        phone = COALESCE(v_phone, phone),
        source_response_id = NEW.id,
        updated_at = now()
      WHERE id = v_existing_id;
    EXCEPTION WHEN unique_violation THEN
      -- Nếu việc cập nhật SĐT/Email gây xung đột với một khách hàng khác (trùng chéo), 
      -- chỉ cập nhật Tên và liên kết câu trả lời để không làm sập tiến trình gửi Form.
      UPDATE public.customers
      SET 
        full_name = COALESCE(v_name, full_name),
        source_response_id = NEW.id,
        updated_at = now()
      WHERE id = v_existing_id;
    END;
  ELSE
    -- TRƯỜNG HỢP MỚI: Thêm mới hoàn toàn
    BEGIN
      INSERT INTO public.customers (full_name, email, phone, source_response_id)
      VALUES (v_name, v_email, v_phone, NEW.id);
    EXCEPTION WHEN unique_violation THEN
      -- Đề phòng xung đột dữ liệu đồng thời lúc gửi (Concurrency)
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

GRANT SELECT ON public.customers TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customers TO service_role;