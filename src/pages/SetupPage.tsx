import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { invokeFunction, supabase } from "../lib/supabase";
import { friendlyError } from "../lib/errors";
import { Button } from "../components/ui";

export function SetupPage() {
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    void supabase
      .rpc("needs_bootstrap")
      .then(({ data, error: rpcError }) => {
        if (rpcError) setAllowed(false);
        else setAllowed(Boolean(data));
      });
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const normalizedEmail = email.trim().toLowerCase();
    if (!password.trim()) {
      setError("Mật khẩu không được bỏ trống.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await invokeFunction("bootstrap-admin", {
        email: normalizedEmail,
        password,
        full_name: fullName,
      });
      const { error: loginError } = await supabase.auth.signInWithPassword({ email: normalizedEmail, password });
      if (loginError) throw loginError;
      navigate("/dashboard", { replace: true });
    } catch (err) {
      setError(friendlyError(err, "Không tạo được tài khoản quản trị."));
    } finally {
      setBusy(false);
    }
  }

  if (allowed === null) return <div className="auth-page">Đang kiểm tra...</div>;
  if (!allowed) {
    return (
      <div className="auth-page">
        <div className="card auth-card card-pad stack">
          <h1>Thiết lập đã hoàn tất</h1>
          <p className="lead">Hệ thống đã có quản trị viên. Vui lòng đăng nhập.</p>
          <Link className="btn btn-primary" to="/login">
            Về trang đăng nhập
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-page">
      <form className="card auth-card card-pad stack" onSubmit={onSubmit}>
        <div>
          <h1>Khởi tạo quản trị viên</h1>
          <p className="lead">Tạo tài khoản admin đầu tiên. Chỉ dùng một lần.</p>
        </div>
        {error ? <div className="error">{error}</div> : null}
        <label className="field">
          Họ tên
          <input required value={fullName} onChange={(e) => setFullName(e.target.value)} />
        </label>
        <label className="field">
          Email
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value.trim().toLowerCase())} />
        </label>
        <label className="field">
          Mật khẩu
          <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        </label>
        <Button type="submit" disabled={busy}>
          {busy ? "Đang tạo..." : "Tạo quản trị viên"}
        </Button>
      </form>
    </div>
  );
}
