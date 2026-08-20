import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { formatDateTime } from "../lib/survey";
import type { Customer } from "../lib/types";
import { Button, Modal, Spinner, useToast } from "../components/ui";
import { useAuth } from "../lib/auth";

export function CustomersPage() {
  const { profile, isAdmin, canManageCustomers } = useAuth();
  const [rows, setRows] = useState<Customer[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Customer | null | undefined>(undefined);
  const toast = useToast();

  async function load() {
    setLoading(true);
    const customerQuery = supabase.from("customers").select("*").order("created_at", { ascending: false });
    if (!isAdmin && profile?.tenant_id) customerQuery.eq("tenant_id", profile.tenant_id);
    const { data, error: queryError } = await customerQuery;
    if (queryError) setError("Không tải được danh sách khách hàng.");
    else setRows((data ?? []) as unknown as Customer[]);
    setLoading(false);
  }

  useEffect(() => { void load(); }, [isAdmin, profile?.tenant_id]);

  const normalized = query.trim().toLowerCase();
  const filtered = rows.filter((customer) =>
    [customer.full_name, customer.code, customer.contact_person, customer.email, customer.phone]
      .some((value) => (value ?? "").toLowerCase().includes(normalized)),
  );

  return (
    <div>
      <div className="page-head">
        <div><h3 style={{ margin: 0 }}>Khách hàng</h3><p>Quản lý khách hàng và lịch sử khảo sát.</p></div>
        {canManageCustomers ? <Button onClick={() => setEditing(null)}>Tạo khách hàng</Button> : null}
      </div>
      {error ? <div className="error">{error}</div> : null}
      <div className="card">
        <div className="card-pad"><label className="field">Tìm kiếm<input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Tên, mã, email, số điện thoại" /></label></div>
        {loading ? <Spinner /> : null}
        {!loading && !filtered.length ? <div className="empty">Chưa có khách hàng phù hợp.</div> : null}
        {!loading && filtered.length ? <div className="table-wrap"><table className="data"><thead><tr><th>Khách hàng</th><th>Liên hệ</th><th>Trạng thái</th><th>Ngày tạo</th><th></th></tr></thead><tbody>
          {filtered.map((customer) => <tr key={customer.id}>
            <td><Link to={`/customers/${customer.id}`}><strong>{customer.full_name || "Chưa có tên"}</strong></Link><div className="hint">{customer.code || "Không có mã"}</div></td>
            <td>{customer.contact_person || customer.email || customer.phone || "—"}</td>
            <td><span className={`badge ${customer.status}`}>{customer.status === "active" ? "Hoạt động" : "Ngưng"}</span></td>
            <td>{formatDateTime(customer.created_at)}</td>
            <td>{canManageCustomers ? <Button variant="ghost" className="btn-sm" onClick={() => setEditing(customer)}>Sửa</Button> : null}</td>
          </tr>)}
        </tbody></table></div> : null}
      </div>
      {editing !== undefined ? <CustomerForm existing={editing} tenantId={profile?.tenant_id} onClose={() => setEditing(undefined)} onSaved={() => { setEditing(undefined); toast.show("Đã lưu khách hàng."); void load(); }} /> : null}
      {toast.node}
    </div>
  );
}

function CustomerForm({ existing, tenantId, onClose, onSaved }: { existing: Customer | null; tenantId?: string; onClose: () => void; onSaved: () => void }) {
  const [fullName, setFullName] = useState(existing?.full_name ?? "");
  const [code, setCode] = useState(existing?.code ?? "");
  const [contactPerson, setContactPerson] = useState(existing?.contact_person ?? "");
  const [email, setEmail] = useState(existing?.email ?? "");
  const [phone, setPhone] = useState(existing?.phone ?? "");
  const [notes, setNotes] = useState(existing?.notes ?? "");
  const [status, setStatus] = useState<Customer["status"]>(existing?.status ?? "active");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!fullName.trim()) { setError("Vui lòng nhập tên khách hàng."); return; }
    if (!existing && !tenantId) { setError("Tài khoản chưa được gán vào tenant."); return; }
    setBusy(true); setError(null);
    const fields = { full_name: fullName.trim(), code: code.trim() || null, contact_person: contactPerson.trim() || null, email: email.trim().toLowerCase() || null, phone: phone.trim() || null, notes: notes.trim() || null, status };
    const result = existing ? await supabase.from("customers").update(fields).eq("id", existing.id) : await supabase.from("customers").insert({ ...fields, tenant_id: tenantId });
    setBusy(false);
    if (result.error) setError("Không lưu được khách hàng. Mã, email hoặc số điện thoại có thể đã tồn tại.");
    else onSaved();
  }

  return <Modal title={existing ? "Sửa khách hàng" : "Tạo khách hàng"} onClose={onClose}><form className="stack" onSubmit={submit}>
    {error ? <div className="error">{error}</div> : null}
    <div className="form-grid two"><label className="field">Tên khách hàng<input required value={fullName} onChange={(e) => setFullName(e.target.value)} /></label><label className="field">Mã khách hàng<input value={code} onChange={(e) => setCode(e.target.value)} /></label></div>
    <div className="form-grid two"><label className="field">Người liên hệ<input value={contactPerson} onChange={(e) => setContactPerson(e.target.value)} /></label><label className="field">Điện thoại<input value={phone} onChange={(e) => setPhone(e.target.value)} /></label></div>
    <label className="field">Email<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></label>
    <label className="field">Ghi chú<textarea value={notes} onChange={(e) => setNotes(e.target.value)} /></label>
    <label className="field">Trạng thái<select value={status} onChange={(e) => setStatus(e.target.value as Customer["status"])}><option value="active">Hoạt động</option><option value="inactive">Ngưng</option></select></label>
    <Button type="submit" disabled={busy}>{busy ? "Đang lưu..." : "Lưu khách hàng"}</Button>
  </form></Modal>;
}
