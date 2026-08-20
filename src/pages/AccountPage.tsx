import { useState, type FormEvent } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/auth";
import { ROLE_LABEL } from "../lib/types";
import { friendlyError } from "../lib/errors";
import { Button } from "../components/ui";

export function AccountPage() {
  const { profile } = useAuth();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (password.length < 8) {
      setError("Mật khẩu mới cần ít nhất 8 ký tự.");
      return;
    }
    if (password !== confirm) {
      setError("Xác nhận mật khẩu không khớp.");
      return;
    }
    setBusy(true);
    setError(null);
    setMessage(null);
    const { error: err } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (err) setError(friendlyError(err, "Không đổi được mật khẩu."));
    else {
      setMessage("Đã cập nhật mật khẩu.");
      setPassword("");
      setConfirm("");
    }
  }

  return (
    <div className="stack" style={{ maxWidth: 520 }}>
      <div className="card card-pad stack">
        <div>
          <strong>Họ tên:</strong> {profile?.full_name || "—"}
        </div>
        <div>
          <strong>Email:</strong> {profile?.email}
        </div>
        <div>
          <strong>Vai trò:</strong> {profile ? ROLE_LABEL[profile.role] : "—"}
        </div>
      </div>
      <form className="card card-pad stack" onSubmit={onSubmit}>
        <strong>Đổi mật khẩu</strong>
        {error ? <div className="error">{error}</div> : null}
        {message ? <div className="success">{message}</div> : null}
        <label className="field">
          Mật khẩu mới
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </label>
        <label className="field">
          Xác nhận mật khẩu
          <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        </label>
        <Button type="submit" disabled={busy}>
          {busy ? "Đang lưu..." : "Cập nhật mật khẩu"}
        </Button>
      </form>
    </div>
  );
}
