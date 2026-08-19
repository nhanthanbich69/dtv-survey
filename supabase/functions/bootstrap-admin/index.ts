import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(url, serviceKey);
    const { count } = await admin
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("role", "admin");
    if ((count ?? 0) > 0) {
      return json({ error: "Hệ thống đã có quản trị viên." }, 403);
    }
    const body = await req.json();
    const email = String(body.email ?? "").trim().toLowerCase();
    const password = String(body.password ?? "");
    const fullName = String(body.full_name ?? "").trim();
    if (!email || !password || password.length < 8 || !fullName) {
      return json({ error: "Thông tin không hợp lệ." }, 400);
    }
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName },
      app_metadata: { role: "admin" },
    });
    if (error || !data.user) {
      return json({ error: "Không tạo được tài khoản. Email có thể đã tồn tại." }, 400);
    }
    const { error: pErr } = await admin.from("profiles").insert({
      id: data.user.id,
      email,
      full_name: fullName,
      role: "admin",
      tenant_id: null,
      status: "active",
    });
    if (pErr) {
      await admin.auth.admin.deleteUser(data.user.id);
      return json({ error: "Không lưu được hồ sơ quản trị viên." }, 500);
    }
    return json({ ok: true });
  } catch {
    return json({ error: "Không thể hoàn tất thiết lập." }, 500);
  }
});
