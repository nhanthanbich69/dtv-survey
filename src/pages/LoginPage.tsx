import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { friendlyError } from "../lib/errors";
import { Button } from "../components/ui";
import { GuestOnly } from "../components/layout";
import { useAuth } from "../lib/auth";

export function LoginPage() {
  return (
    <GuestOnly>
      <LoginForm />
    </GuestOnly>
  );
}

export function RegisterPage() {
  return (
    <GuestOnly>
      <RegisterForm />
    </GuestOnly>
  );
}

function LoginForm() {
  const { denial, refresh } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(denial);
  const [busy, setBusy] = useState(false);
  const [needsBootstrap, setNeedsBootstrap] = useState<boolean | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    void supabase
      .rpc("needs_bootstrap")
      .then(({ data, error: rpcError }) => {
        if (rpcError) setNeedsBootstrap(false);
        else setNeedsBootstrap(Boolean(data));
      });
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const normalizedEmail = email.trim().toLowerCase();
    setBusy(true);
    setError(null);
    const { error: authError } = await supabase.auth.signInWithPassword({ email: normalizedEmail, password });
    if (authError) {
      setBusy(false);
      setError(friendlyError(authError, "Không đăng nhập được."));
      return;
    }
    await refresh();
    const { data } = await supabase.auth.getSession();
    setBusy(false);
    if (!data.session) {
      setError("Tài khoản không thể đăng nhập. Kiểm tra trạng thái hoặc liên hệ quản trị viên.");
      return;
    }
    navigate("/dashboard", { replace: true });
  }

  return (
    <div className="auth-page">
      <form className="card auth-card card-pad stack" onSubmit={onSubmit}>
        <div>
          <h1>DTV Survey</h1>
          <p className="lead">Đăng nhập để quản lý khảo sát</p>
        </div>
        {error ? <div className="error">{error}</div> : null}
        <label className="field">
          Email
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value.trim().toLowerCase())} autoComplete="username" />
        </label>
        <label className="field">
          Mật khẩu
          <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
        </label>
        <Button type="submit" disabled={busy}>
          {busy ? "Đang đăng nhập..." : "Đăng nhập"}
        </Button>
        <p className="hint">
          Chưa có tài khoản? <Link to="/register">Đăng ký tài khoản mới</Link>
        </p>
        {needsBootstrap === true ? (
          <p className="hint">
            Hệ thống chưa có quản trị viên. <Link to="/setup">Thiết lập tài khoản quản trị đầu tiên</Link>
          </p>
        ) : null}
      </form>
    </div>
  );
}

function RegisterForm() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!fullName.trim()) {
      setError("Vui lòng nhập họ tên.");
      return;
    }
    if (!password.trim()) {
      setError("Mật khẩu không được bỏ trống.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const normalizedEmail = email.trim().toLowerCase();
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: normalizedEmail,
        password,
        options: { data: { full_name: fullName.trim() } },
      });
      if (signUpError) throw signUpError;
      const userId = data.user?.id;
      if (!userId) throw new Error("Không tạo được tài khoản.");

      const { error: profileError } = await supabase.from("profiles").upsert({
        id: userId,
        email: normalizedEmail,
        full_name: fullName.trim(),
        role: "staff",
        tenant_id: null,
        status: "active",
      }, { onConflict: "id" });
      if (profileError) throw profileError;

      const { error: loginError } = await supabase.auth.signInWithPassword({ email: normalizedEmail, password });
      if (loginError) throw loginError;

      navigate("/dashboard", { replace: true });
    } catch (err) {
      setError(friendlyError(err, "Không tạo được tài khoản người dùng."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-page">
      <form className="card auth-card card-pad stack" onSubmit={onSubmit}>
        <div>
          <h1>Đăng ký tài khoản</h1>
          <p className="lead">Tạo tài khoản người dùng thường để truy cập hệ thống.</p>
        </div>
        {error ? <div className="error">{error}</div> : null}
        <label className="field">
          Họ tên
          <input required value={fullName} onChange={(e) => setFullName(e.target.value)} />
        </label>
        <label className="field">
          Email
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value.trim().toLowerCase())} autoComplete="username" />
        </label>
        <label className="field">
          Mật khẩu
          <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />
        </label>
        <Button type="submit" disabled={busy}>
          {busy ? "Đang tạo..." : "Tạo tài khoản"}
        </Button>
        <p className="hint">
          Đã có tài khoản? <Link to="/login">Quay lại đăng nhập</Link>
        </p>
      </form>
    </div>
  );
}
