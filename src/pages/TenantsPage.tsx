import { useEffect, useState, type FormEvent } from "react";
import { supabase } from "../lib/supabase";
import { friendlyError } from "../lib/errors";
import { formatDateTime } from "../lib/survey";
import type { Tenant } from "../lib/types";
import { AdminOnly } from "../components/layout";
import { Button, Modal, Spinner, useToast } from "../components/ui";

export function TenantsPage() {
  return (
    <AdminOnly>
      <TenantsAdmin />
    </AdminOnly>
  );
}

function TenantsAdmin() {
  const [rows, setRows] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<Tenant | null>(null);
  const toast = useToast();

  async function load() {
    setLoading(true);
    const { data } = await supabase.from("tenants").select("*").order("created_at", { ascending: false });
    setRows((data ?? []) as unknown as Tenant[]);
    setLoading(false);
  }

  useEffect(() => {
    void load();
  }, []);

  return (
    <div>
      <div className="page-head">
        <div>
          <h3 style={{ margin: 0 }}>Khách hàng</h3>
          <p>Quản lý tenant / khách hàng sử dụng hệ thống.</p>
        </div>
        <Button onClick={() => setOpen(true)}>Thêm khách hàng</Button>
      </div>
      <div className="card">
        {loading ? <Spinner /> : null}
        {!loading && rows.length === 0 ? <div className="empty">Chưa có khách hàng.</div> : null}
        {!loading && rows.length > 0 ? (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Tên</th>
                  <th>Mã</th>
                  <th>Trạng thái</th>
                  <th>Ngày tạo</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((t) => (
                  <tr key={t.id}>
                    <td>{t.name}</td>
                    <td>{t.code}</td>
                    <td>
                      <span className={`badge ${t.status}`}>{t.status === "active" ? "Hoạt động" : "Ngưng"}</span>
                    </td>
                    <td>{formatDateTime(t.created_at)}</td>
                    <td>
                      <button className="btn btn-ghost btn-sm" onClick={() => setEdit(t)}>
                        Sửa
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>
      {open ? (
        <TenantForm
          onClose={() => setOpen(false)}
          onSaved={() => {
            setOpen(false);
            toast.show("Đã tạo khách hàng.");
            void load();
          }}
        />
      ) : null}
      {edit ? (
        <TenantForm
          existing={edit}
          onClose={() => setEdit(null)}
          onSaved={() => {
            setEdit(null);
            toast.show("Đã cập nhật khách hàng.");
            void load();
          }}
        />
      ) : null}
      {toast.node}
    </div>
  );
}

function TenantForm({
  existing,
  onClose,
  onSaved,
}: {
  existing?: Tenant;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(existing?.name ?? "");
  const [code, setCode] = useState(existing?.code ?? "");
  const [status, setStatus] = useState(existing?.status ?? "active");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const payload = { name: name.trim(), code: code.trim().toUpperCase(), status };
    const q = existing
      ? supabase.from("tenants").update(payload).eq("id", existing.id)
      : supabase.from("tenants").insert(payload);
    const { error: err } = await q;
    setBusy(false);
    if (err) setError(friendlyError(err, "Không lưu được khách hàng. Mã có thể bị trùng."));
    else onSaved();
  }

  return (
    <Modal title={existing ? "Cập nhật khách hàng" : "Thêm khách hàng"} onClose={onClose}>
      <form className="stack" onSubmit={onSubmit}>
        {error ? <div className="error">{error}</div> : null}
        <label className="field">
          Tên
          <input required value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label className="field">
          Mã
          <input required value={code} onChange={(e) => setCode(e.target.value)} />
        </label>
        <label className="field">
          Trạng thái
          <select value={status} onChange={(e) => setStatus(e.target.value as "active" | "inactive")}>
            <option value="active">Hoạt động</option>
            <option value="inactive">Ngưng</option>
          </select>
        </label>
        <Button type="submit" disabled={busy}>
          {busy ? "Đang lưu..." : "Lưu"}
        </Button>
      </form>
    </Modal>
  );
}
