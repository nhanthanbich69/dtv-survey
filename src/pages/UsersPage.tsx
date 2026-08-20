import { useEffect, useState, type FormEvent } from "react";
import { invokeFunction, supabase } from "../lib/supabase";
import { useAuth } from "../lib/auth";
import { friendlyError } from "../lib/errors";
import { formatDateTime } from "../lib/survey";
import { ROLE_LABEL, type Profile, type Role } from "../lib/types";
import { AdminOnly } from "../components/layout";
import { Button, Modal, Spinner, useToast } from "../components/ui";
import { asList } from "../lib/cast";

export function UsersPage() {
  return (
    <AdminOnly>
      <UsersAdmin />
    </AdminOnly>
  );
}

function UsersAdmin() {
  const { session } = useAuth();
  const [rows, setRows] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<Profile | null>(null);
  const toast = useToast();

  async function load() {
    setLoading(true);
    const { data: users } = await supabase.from("profiles").select("*").order("created_at", { ascending: false });
    setRows(asList<Profile>(users));
    setLoading(false);
  }

  useEffect(() => {
    void load();
  }, []);

  return (
    <div>
      <div className="page-head">
        <div>
          <h3 style={{ margin: 0 }}>Người dùng</h3>
          <p>Chỉ quản trị viên được tạo và thay đổi tài khoản.</p>
        </div>
        <Button onClick={() => setOpen(true)}>Tạo tài khoản</Button>
      </div>
      <div className="card">
        {loading ? <Spinner /> : null}
        {!loading && rows.length === 0 ? <div className="empty">Chưa có người dùng.</div> : null}
        {!loading && rows.length > 0 ? (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Họ tên</th>
                  <th>Email</th>
                  <th>Vai trò</th>
                  <th>Trạng thái</th>
                  <th>Ngày tạo</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((u) => (
                  <tr key={u.id}>
                    <td>{u.full_name || "—"}</td>
                    <td>{u.email}</td>
                    <td>{ROLE_LABEL[u.role]}</td>
                    <td>
                      <span className={`badge ${u.status}`}>{u.status === "active" ? "Hoạt động" : "Ngưng"}</span>
                    </td>
                    <td>{formatDateTime(u.created_at)}</td>
                    <td>
                      <button className="btn btn-ghost btn-sm" onClick={() => setEdit(u)}>
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
        <UserForm
          token={session?.access_token}
          onClose={() => setOpen(false)}
          onSaved={() => {
            setOpen(false);
            toast.show("Đã tạo tài khoản.");
            void load();
          }}
        />
      ) : null}
      {edit ? (
        <UserForm
          token={session?.access_token}
          existing={edit}
          onClose={() => setEdit(null)}
          onSaved={() => {
            setEdit(null);
            toast.show("Đã cập nhật tài khoản.");
            void load();
          }}
        />
      ) : null}
      {toast.node}
    </div>
  );
}

function UserForm({
  token,
  existing,
  onClose,
  onSaved,
}: {
  token?: string;
  existing?: Profile;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [fullName, setFullName] = useState(existing?.full_name ?? "");
  const [email, setEmail] = useState(existing?.email ?? "");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Role>(existing?.role ?? "staff");
  const [status, setStatus] = useState(existing?.status ?? "active");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const normalizedEmail = email.trim().toLowerCase();
    if (!existing && password.length < 8) {
      setError("Mật khẩu cần ít nhất 8 ký tự.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await invokeFunction(
        "admin-users",
        {
          action: existing ? "update" : "create",
          id: existing?.id,
          email: normalizedEmail,
          password: password || undefined,
          full_name: fullName,
          role,
          tenant_id: null,
          status,
        },
        token,
      );
      onSaved();
    } catch (err) {
      setError(friendlyError(err, "Không lưu được tài khoản."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title={existing ? "Cập nhật người dùng" : "Tạo người dùng"} onClose={onClose}>
      <form className="stack" onSubmit={onSubmit}>
        {error ? <div className="error">{error}</div> : null}
        <label className="field">
          Họ tên
          <input required value={fullName} onChange={(e) => setFullName(e.target.value)} />
        </label>
        <label className="field">
          Email
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value.trim().toLowerCase())} disabled={Boolean(existing)} />
        </label>
        <label className="field">
          {existing ? "Mật khẩu mới (để trống nếu giữ nguyên)" : "Mật khẩu"}
          <input type="password" minLength={existing ? undefined : 8} value={password} onChange={(e) => setPassword(e.target.value)} />
        </label>
        <label className="field">
          Vai trò
          <select value={role} onChange={(e) => setRole(e.target.value as Role)}>
            {(Object.keys(ROLE_LABEL) as Role[]).map((r) => (
              <option key={r} value={r}>
                {ROLE_LABEL[r]}
              </option>
            ))}
          </select>
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
