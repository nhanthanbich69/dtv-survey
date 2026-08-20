import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const ROLES = new Set(["admin", "manager", "staff", "viewer"]);

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: cors });
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const authHeader = req.headers.get("Authorization") ?? "";
    const userClient = createClient(url, anon, { global: { headers: { Authorization: authHeader } } });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) return json({ error: "Phiên đăng nhập không hợp lệ." }, 401);

    const admin = createClient(url, serviceKey);
    const { data: caller } = await admin
      .from("profiles")
      .select("role, status, tenant_id")
      .eq("id", userData.user.id)
      .maybeSingle();
    if (!caller || caller.role !== "admin" || caller.status !== "active" || !caller.tenant_id) {
      return json({ error: "Bạn không có quyền quản lý người dùng." }, 403);
    }

    const body = await req.json();
    const action = body.action as string;
    const role = String(body.role ?? "staff");
    if (!ROLES.has(role)) return json({ error: "Vai trò không hợp lệ." }, 400);
    const tenantId = caller.tenant_id;
    const fullName = String(body.full_name ?? "").trim();
    const email = String(body.email ?? "").trim().toLowerCase();
    const status = body.status === "inactive" ? "inactive" : "active";

    if (action === "create") {
      const password = String(body.password ?? "");
      if (!email || !fullName || password.length < 8) {
        return json({ error: "Thông tin tài khoản không hợp lệ." }, 400);
      }
      const { data, error } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name: fullName },
        app_metadata: { role },
      });
      if (error || !data.user) return json({ error: "Không tạo được tài khoản. Email có thể đã tồn tại." }, 400);
      const { error: pErr } = await admin.from("profiles").insert({
        id: data.user.id,
        email,
        full_name: fullName,
        role,
        tenant_id: tenantId,
        status,
      });
      if (pErr) {
        await admin.auth.admin.deleteUser(data.user.id);
        return json({ error: "Không lưu được hồ sơ người dùng." }, 500);
      }
      return json({ ok: true, id: data.user.id });
    }

    if (action === "update") {
      const id = String(body.id ?? "");
      if (!id) return json({ error: "Thiếu mã người dùng." }, 400);
      const patch: Record<string, unknown> = {
        full_name: fullName,
        role,
        status,
      };
      const { error: pErr } = await admin.from("profiles").update(patch).eq("id", id);
      if (pErr) return json({ error: "Không cập nhật được hồ sơ." }, 400);
      if (body.password) {
        const password = String(body.password);
        if (password.length < 8) return json({ error: "Mật khẩu cần ít nhất 8 ký tự." }, 400);
        const { error } = await admin.auth.admin.updateUserById(id, { password });
        if (error) return json({ error: "Không cập nhật được mật khẩu." }, 400);
      }
      await admin.auth.admin.updateUserById(id, { app_metadata: { role } });
      return json({ ok: true });
    }

    return json({ error: "Yêu cầu không hợp lệ." }, 400);
  } catch {
    return json({ error: "Không thể hoàn tất yêu cầu." }, 500);
  }
});
