import type { ReactNode } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { authApi } from "../../api/auth";
import { useAuth } from "../../auth/AuthContext";

interface NavItem {
  to: string;
  label: string;
  icon: ReactNode;
  adminOnly?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { to: "/", label: "Dashboard", icon: <IconDashboard /> },
  { to: "/accounts", label: "IMAP-Konten", icon: <IconMail /> },
  { to: "/chains", label: "Aktionsketten", icon: <IconChain /> },
  { to: "/printers", label: "Drucker", icon: <IconPrinter /> },
  { to: "/logs", label: "Logs", icon: <IconLogs /> },
  { to: "/users", label: "Benutzer", icon: <IconUsers />, adminOnly: true },
];

export function AppShell({ title, actions, children }: { title: string; actions?: ReactNode; children: ReactNode }) {
  const { user, refresh } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const onLogout = async () => {
    await authApi.logout();
    await refresh();
    navigate("/login");
  };

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <span className="sidebar-brand-mark">SM</span>
          <span className="sidebar-brand-name">Sentinel Mail</span>
        </div>
        <nav className="sidebar-nav">
          {NAV_ITEMS.filter((item) => !item.adminOnly || user?.role === "admin").map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className={"sidebar-link" + (location.pathname === item.to ? " active" : "")}
            >
              {item.icon}
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>
        <div className="sidebar-footer">
          <Link to="/profile" className={"sidebar-user" + (location.pathname === "/profile" ? " active" : "")}>
            <span className="avatar">{user?.email?.[0]?.toUpperCase() ?? "?"}</span>
            <span className="sidebar-user-info">
              <span className="sidebar-user-email">{user?.email}</span>
              <span className={"role-badge" + (user?.role === "admin" ? " role-admin" : "")}>{user?.role}</span>
            </span>
          </Link>
          <button className="btn btn-ghost btn-block" onClick={onLogout}>
            <IconLogout />
            Abmelden
          </button>
        </div>
      </aside>
      <div className="shell-main">
        <header className="topbar">
          <h1>{title}</h1>
          {actions && <div className="topbar-actions">{actions}</div>}
        </header>
        <main className="content">{children}</main>
      </div>
    </div>
  );
}

function IconDashboard() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="9" rx="1.5" />
      <rect x="14" y="3" width="7" height="5" rx="1.5" />
      <rect x="14" y="12" width="7" height="9" rx="1.5" />
      <rect x="3" y="16" width="7" height="5" rx="1.5" />
    </svg>
  );
}

function IconMail() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m3 7 9 6 9-6" />
    </svg>
  );
}

function IconChain() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
      <path d="M9.5 9.5 14.5 14.5" />
      <path d="M14 6.5h4a1.5 1.5 0 0 1 1.5 1.5v2" />
    </svg>
  );
}

function IconPrinter() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 9V3h12v6" />
      <rect x="4" y="9" width="16" height="8" rx="1.5" />
      <path d="M6 14h12v7H6z" />
    </svg>
  );
}

function IconLogs() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 4h16v16H4z" opacity="0" />
      <path d="M6 4h9l3 3v13H6z" />
      <path d="M9 12h6M9 16h6M9 8h3" />
    </svg>
  );
}

function IconUsers() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9" cy="8" r="3.2" />
      <path d="M2.5 20c0-3.5 2.9-6 6.5-6s6.5 2.5 6.5 6" />
      <circle cx="17.5" cy="9" r="2.4" />
      <path d="M21.5 20c-.1-2.7-1.6-4.7-3.7-5.6" />
    </svg>
  );
}

function IconLogout() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <path d="M16 17l5-5-5-5" />
      <path d="M21 12H9" />
    </svg>
  );
}
