import { useState, type ReactNode } from "react";
import { NavLink, Navigate, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { ROLE_LABEL } from "../lib/types";
import { Button, Spinner } from "./ui";

const LINKS = [
  { to: "/dashboard", label: "Tổng quan" },
  { to: "/surveys", label: "Khảo sát" },
  { to: "/users", label: "Người dùng", admin: true },
  { to: "/account", label: "Tài khoản" },
];

export function RequireAuth({ children }: { children?: ReactNode }) {
  const { loading, session } = useAuth();
  const location = useLocation();
  if (loading) return <Spinner />;
  if (!session) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return children ? <>{children}</> : <Outlet />;
}

export function GuestOnly({ children }: { children: ReactNode }) {
  const { loading, session } = useAuth();
  if (loading) return <Spinner />;
  if (session) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

export function AdminOnly({ children }: { children: ReactNode }) {
  const { isAdmin, loading } = useAuth();
  if (loading) return <Spinner />;
  if (!isAdmin) {
    return (
      <div className="card card-pad error">Bạn không có quyền truy cập trang này.</div>
    );
  }
  return <>{children}</>;
}

export function AppShell({ title }: { title: string }) {
  const { profile, signOut, isAdmin } = useAuth();
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  return (
    <div className="app-shell">
      <aside className={`sidebar ${open ? "open" : ""}`}>
        <div className="brand">
          <h1>DTV SURVEY</h1>
          <p>Quản lý khảo sát khách hàng</p>
        </div>
        <nav className="nav" onClick={() => setOpen(false)}>
          {LINKS.filter((l) => !l.admin || isAdmin).map((l) => (
            <NavLink key={l.to} to={l.to} className={({ isActive }) => (isActive ? "active" : "")}>
              {l.label}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-user">
          <strong>{profile?.full_name || profile?.email}</strong>
          <span>{profile ? ROLE_LABEL[profile.role] : ""}</span>
        </div>
      </aside>
      <div className="main">
        <header className="topbar">
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <button className="menu-btn" type="button" onClick={() => setOpen((v) => !v)}>
              Menu
            </button>
            <h2>{title}</h2>
          </div>
          <Button
            variant="ghost"
            className="btn-sm"
            onClick={async () => {
              await signOut();
              navigate("/login");
            }}
          >
            Đăng xuất
          </Button>
        </header>
        <div className="content">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
