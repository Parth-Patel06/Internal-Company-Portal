import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import * as I from "lucide-react";
import { api, getToken, setToken, clearToken } from "./api";
import "./styles.css";

import triobyteLogo from "./Triobyte.jpeg";
const all = [
  ["Dashboard", "LayoutDashboard"],
  ["Employees", "Users"],
  ["Intern Management", "GraduationCap"],
  ["Projects", "FolderKanban"],
  ["Tasks", "ListChecks"],
  ["Attendance", "CalendarDays"],
  ["Leave Management", "Umbrella"],
  ["Daily Work", "ClipboardList"],
  ["Code Management", "GitBranch"],
  ["Chat", "MessagesSquare"],
  ["Salary", "Banknote"],
  ["Overtime", "Timer"],
  ["Announcements", "Megaphone"],
  ["Calendar", "Calendar"],
  ["Organization", "Network"],
  ["Profile", "CircleUser"],
  ["Settings", "Settings"],
];

function normalizeRole(role) {
  return String(role || "").toUpperCase();
}

function allowed(role) {
  const r = normalizeRole(role);

  let items = [
    "Dashboard",
    "Profile",
    "Settings",
    "Announcements",
    "Calendar",
  ];

  if (r === "EMPLOYEE") {
    items.push(
      "Projects",
      "Tasks",
      "Attendance",
      "Leave Management",
      "Daily Work",
      "Code Management",
      "Chat"
    );
  }

  if (r === "INTERN") {
    items.push(
      "Projects",
      "Tasks",
      "Attendance",
      "Daily Work",
      "Code Management",
      "Chat"
    );
  }

  if (["CEO", "ADMIN", "HR"].includes(r)) {
  items = [
    "Dashboard",
    "Employees",
    "Intern Management",
    "Projects",
    "Tasks",
    "Attendance",
    "Leave Management",
    "Daily Work",
    "Salary",
    "Overtime",
    "Announcements",
    "Calendar",
    "Organization",
    "Profile",
    "Settings",
    "Chat",
    "Code Management",
  ];
}

  if (r === "HR") {
    items = items.filter((x) => x !== "Code Management");
  }

  return all.filter(([name]) => items.includes(name));
}


const sidebarGroups = [
  {
    id: "workspace",
    label: "Workspace",
    icon: "LayoutGrid",
    items: ["Dashboard", "Projects", "Tasks", "Chat", "Calendar"],
  },
  {
    id: "people",
    label: "People",
    icon: "Users",
    items: ["Employees", "Intern Management", "Attendance", "Leave Management", "Daily Work", "Salary", "Overtime"],
  },
  {
    id: "company",
    label: "Company",
    icon: "Building2",
    items: ["Announcements", "Organization"],
  },
  {
    id: "tools",
    label: "Tools",
    icon: "Wrench",
    items: ["Code Management"],
  },
  {
    id: "account",
    label: "Account",
    icon: "CircleUser",
    items: ["Profile", "Settings"],
  },
];

function buildSidebarGroups(role) {
  const allowedNames = new Set(allowed(role).map(([name]) => name));

  return sidebarGroups
    .map((group) => ({
      ...group,
      items: group.items
        .filter((name) => allowedNames.has(name))
        .map((name) => all.find(([itemName]) => itemName === name))
        .filter(Boolean),
    }))
    .filter((group) => group.items.length > 0);
}

function Login({ onLogin }) {
  const [email, setEmail] = useState("admin@triobyte.demo");
  const [password, setPassword] = useState("Demo@123");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function login(e) {
    e.preventDefault();

    clearToken();

    setLoading(true);
    setMessage("");

    try {
      const data = await api("/auth/login", {
        method: "POST",
        body: {
          email,
          password,
        },
      });

      if (!data.token) {
        throw new Error("Login succeeded but token was not returned.");
      }

      setToken(data.token);

      await onLogin();
    } catch (err) {
      clearToken();
      setMessage(err.message || "Login failed");
    } finally {
      setLoading(false);
    }
  }

  async function forgotPassword() {
    try {
      setMessage("");

      const result = await api("/auth/forgot-password", {
        method: "POST",
        body: {
          email,
        },
      });

      setMessage(result.message || "Password reset request submitted.");
    } catch (err) {
      setMessage(err.message || "Unable to process request.");
    }
  }

  return (
    <div className="login">
      <div className="loginBackdrop">
        <span className="loginOrb orbOne" />
        <span className="loginOrb orbTwo" />
        <span className="loginGrid" />
      </div>
      <div className="loginShell">
        <div className="loginIntro">
          <div className="loginBrandLockup">
            <img src={triobyteLogo} className="loginIntroLogo" alt="TrioByte Technology" />
            <div className="loginBrandText">
              <div className="loginBrandName">TRIOBYTE</div>
              <div className="loginBrandTagline">TECHNOLOGY</div>
            </div>
          </div>
          <div>
            <span className="loginKicker">ONE WORKSPACE. ONE FLOW.</span>
            <h1>Work together.<br />Move forward.</h1>
            <p>A focused workspace for projects, people, progress, and everything that keeps TrioByte moving.</p>
          </div>
          <div className="loginFeatureList">
            <span>Projects</span><span>People</span><span>Progress</span>
          </div>
        </div>
        <div className="loginCard">
        <img src={triobyteLogo} className="loginLogo" alt="TrioByte Technology" />

        <h1>Welcome back</h1>

        <p>Sign in to your company portal</p>

        <form onSubmit={login}>
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Company email"
          />

          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
          />

          <button type="submit" disabled={loading}>
            {loading ? "Signing In..." : "Sign In"}
          </button>
        </form>

        <button
          type="button"
          className="link"
          onClick={forgotPassword}
        >
          Forgot Password?
        </button>

        {message && (
          <div className="notice">
            {message}
          </div>
        )}

        <div className="demo">
          Demo password: <b>Demo@123</b>
          <br />

          <small>
            CEO, Admin, HR, Employee and Intern accounts are seeded.
          </small>
        </div>
      </div>
      </div>
    </div>
  );
}

function ForcePasswordChange({
  me,
  onPasswordChanged
}) {
  const [newPassword, setNewPassword] =
    useState("");

  const [confirmPassword, setConfirmPassword] =
    useState("");

  const [message, setMessage] =
    useState("");

  const [loading, setLoading] =
    useState(false);

  async function updatePassword(e) {
    e.preventDefault();

    setMessage("");

    if (newPassword.length < 6) {
      setMessage(
        "Password must be at least 6 characters."
      );

      return;
    }

    if (
      newPassword !== confirmPassword
    ) {
      setMessage(
        "Passwords do not match."
      );

      return;
    }

    setLoading(true);

    try {
      await api(
        "/api/settings/password",
        {
          method: "PUT",

          body: {
            currentPassword: "",
            newPassword
          }
        }
      );

      setMessage(
        "Password created successfully."
      );

      await onPasswordChanged();

    } catch (err) {
      setMessage(
        err.message ||
        "Unable to update password."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login">
      <div className="loginCard">

        <img
          src={triobyteLogo}
          className="loginLogo"
        />

        <h1>Create new password</h1>

        <p>
          Your account was created with a
          default password. Please create
          your personal password to continue.
        </p>

        <form
          onSubmit={updatePassword}
        >
          <input
            type="password"
            placeholder="Create new password"
            value={newPassword}
            onChange={(e) =>
              setNewPassword(
                e.target.value
              )
            }
          />

          <input
            type="password"
            placeholder="Confirm new password"
            value={confirmPassword}
            onChange={(e) =>
              setConfirmPassword(
                e.target.value
              )
            }
          />

          <button
            type="submit"
            disabled={loading}
          >
            {loading
              ? "Updating..."
              : "Continue to Portal"}
          </button>
        </form>

        {message && (
          <div className="notice">
            {message}
          </div>
        )}

        <button
          type="button"
          className="link"
          onClick={() => {
            clearToken();
            window.location.reload();
          }}
        >
          Back to Login
        </button>

      </div>
    </div>
  );
}


function GlobalSearch({ open, onClose, onSelect }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const inputRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setResults([]);
    setMessage("");
    const timer = setTimeout(() => inputRef.current?.focus(), 50);
    return () => clearTimeout(timer);
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const term = query.trim();

    if (term.length < 2) {
      setResults([]);
      setLoading(false);
      setMessage(term ? "Type at least 2 characters to search." : "");
      return;
    }

    let active = true;
    const timer = setTimeout(async () => {
      try {
        setLoading(true);
        setMessage("");
        const data = await api(`/api/search?q=${encodeURIComponent(term)}`);
        if (!active) return;
        const next = Array.isArray(data.results) ? data.results : [];
        setResults(next);
        if (!next.length) setMessage("No matching records found.");
      } catch (err) {
        if (!active) return;
        setResults([]);
        setMessage(err.message || "Search is unavailable right now.");
      } finally {
        if (active) setLoading(false);
      }
    }, 250);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [query, open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="globalSearchBackdrop" onMouseDown={onClose}>
      <div
        className="globalSearchPanel"
        role="dialog"
        aria-modal="true"
        aria-label="Global search"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="globalSearchInputWrap">
          <I.Search size={20} />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search employees, projects, tasks, announcements..."
            aria-label="Search the portal"
          />
          <button type="button" onClick={onClose} aria-label="Close search">
            <I.X size={19} />
          </button>
        </div>

        <div className="globalSearchMeta">
          {loading
            ? "Searching..."
            : query.trim().length >= 2
              ? `${results.length} result(s)`
              : "Search across the portal"}
        </div>

        <div className="globalSearchResults">
          {results.map((result) => {
            const Icon =
              result.type === "Employee" ? I.User :
              result.type === "Project" ? I.FolderKanban :
              result.type === "Task" ? I.ListChecks :
              I.Megaphone;

            return (
              <button
                type="button"
                className="globalSearchResult"
                key={result.id}
                onClick={() => onSelect(result)}
              >
                <span className="globalSearchResultIcon"><Icon size={18} /></span>
                <span className="globalSearchResultText">
                  <b>{result.title}</b>
                  {result.subtitle && <small>{result.subtitle}</small>}
                </span>
                <span className="globalSearchType">{result.type}</span>
              </button>
            );
          })}

          {!loading && !results.length && (
            <div className="globalSearchEmpty">
              {message || "Start typing to search."}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}



function NotificationPanel({ open, onClose, onUnreadChange }) {
  const [items, setItems] = useState([]);
  const [message, setMessage] = useState("");

  async function load() {
    try {
      const result = await api("/api/notifications");
      const rows = Array.isArray(result.notifications) ? result.notifications : [];
      setItems(rows);
      onUnreadChange?.(Number(result.unread || 0));
      setMessage("");
    } catch (err) {
      setMessage(err.message || "Unable to load notifications.");
    }
  }

  useEffect(() => {
    if (open) load();
  }, [open]);

  if (!open) return null;

  async function markRead(id) {
    try {
      await api(`/api/notifications/${id}/read`, { method: "PUT" });
      await load();
    } catch (err) {
      setMessage(err.message || "Unable to update notification.");
    }
  }

  async function markAll() {
    try {
      await api("/api/notifications/read-all", { method: "PUT" });
      await load();
    } catch (err) {
      setMessage(err.message || "Unable to update notifications.");
    }
  }

  return (
    <div className="notificationBackdrop" onMouseDown={onClose}>
      <div className="notificationPanel" onMouseDown={(e) => e.stopPropagation()}>
        <div className="notificationHead">
          <div><h3>Notifications</h3><small>{items.filter((x) => !x.read).length} unread</small></div>
          <div className="notificationHeadActions">
            <button type="button" onClick={markAll}>Mark all read</button>
            <button type="button" className="notificationClose" onClick={onClose} aria-label="Close"><I.X size={18} /></button>
          </div>
        </div>
        {message && <div className="formMessage error">{message}</div>}
        <div className="notificationList">
          {!items.length && <div className="globalSearchEmpty">No notifications yet.</div>}
          {items.map((item) => (
            <button
              type="button"
              key={item.id}
              className={`notificationItem ${item.read ? "read" : "unread"}`}
              onClick={() => !item.read && markRead(item.id)}
            >
              <span className="notificationDot" />
              <span>
                <b>{item.title}</b>
                {item.body && <small>{item.body}</small>}
                <em>{item.created_at ? new Date(item.created_at).toLocaleString() : ""}</em>
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function ActivityLogs() {
  const [rows, setRows] = useState([]);
  const [message, setMessage] = useState("");

  useEffect(() => {
    api("/api/activity")
      .then((result) => setRows(Array.isArray(result) ? result : []))
      .catch((err) => setMessage(err.message || "Unable to load activity."));
  }, []);

  return (
    <div className="activitySection">
      <h2>Employee Login Activity</h2>
      {message && <div className="formMessage error">{message}</div>}
      <List
        rows={rows}
        fields={["full_name", "employee_id", "role", "login_at", "logout_at", "session_status"]}
      />
    </div>
  );
}


function App() {
  const [me, setMe] = useState(null);
  const [page, setPage] = useState("Dashboard");
  const [theme, setTheme] = useState(
    localStorage.getItem("tb_theme") || "dark"
  );
  const [data, setData] = useState({});
  const [loading, setLoading] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const profileMenuRef = useRef(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [openSidebarGroups, setOpenSidebarGroups] = useState({});

  async function loadMe() {
    try {
      const result = await api("/api/me");

      setMe(result);
      return result;
    } catch (err) {
      clearToken();
      setMe(null);
      throw err;
    }
  }

  useEffect(() => {
    if (getToken()) {
      loadMe().catch(() => {});
    }
  }, []);

  useEffect(() => {
    function closeProfileMenu(event) {
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target)) {
        setProfileMenuOpen(false);
      }
    }

    if (profileMenuOpen) {
      document.addEventListener("mousedown", closeProfileMenu);
    }

    return () => document.removeEventListener("mousedown", closeProfileMenu);
  }, [profileMenuOpen]);

  useEffect(() => {
    if (!me) return;
    let active = true;
    const loadUnread = () => {
      api("/api/notifications")
        .then((result) => {
          if (active) setUnreadCount(Number(result.unread || 0));
        })
        .catch(() => {});
    };
    loadUnread();
    const timer = setInterval(loadUnread, 30000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [me]);

  useEffect(() => {
    if (!me) return;

    const runAutoLogout = async () => {
      try { await api("/api/logout", { method: "POST" }); } catch (_) {}
      clearToken();
      setMe(null);
      window.location.reload();
    };

    const now = new Date();
    const target = new Date(now);
    target.setHours(23, 0, 0, 0);
    if (target <= now) target.setDate(target.getDate() + 1);

    const timeout = setTimeout(runAutoLogout, target.getTime() - now.getTime());
    return () => clearTimeout(timeout);
  }, [me]);

  // IMPORTANT:
  // Use braces so this effect returns nothing.
  useEffect(() => {
    document.body.dataset.theme = theme;
  }, [theme]);

  const refreshCurrentPage = () => {
    setReloadKey((key) => key + 1);
  };

  useEffect(() => {
    if (!me) return;

    const paths = {
  Dashboard: "dashboard",
  Employees: "users",
  "Intern Management": "users",
  Projects: "projects",
  Tasks: "dashboard",
  Attendance: "attendance",
  "Leave Management": "leave",
  "Daily Work": "daily-work",
  Salary: "salary",
  Overtime: "overtime",
  Announcements: "announcements",
  "Code Management": "repos",
  Chat: "chat",
};

    const path = paths[page];

    if (!path) return;

    let active = true;

    setLoading(true);

    api("/api/" + path)
      .then((result) => {
        if (active) {
          setData({
            [page]: result,
          });
        }
      })
      .catch(() => {
        if (active) {
          setData({
            [page]: [],
          });
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [page, me, reloadKey]);



  if (!getToken() || !me) {
    return <Login onLogin={loadMe} />;
  }

  const role =
  normalizeRole(me.role);

const requiresPasswordChange =
  ["EMPLOYEE", "INTERN"].includes(role) &&
  me.must_change_password === true;

if (requiresPasswordChange) {
  return (
    <ForcePasswordChange
      me={me}
      onPasswordChanged={loadMe}
    />
  );
}

  async function logout() {
    try {
      await api("/api/logout", { method: "POST" });
    } catch (_) {
      // The local logout must still complete even if the server is unavailable.
    }
    clearToken();
    setMe(null);
    window.location.reload();
  }

  const sidebarMenuGroups = buildSidebarGroups(me.role);
  const activeGroupId = sidebarMenuGroups.find((group) =>
    group.items.some(([name]) => name === page)
  )?.id;

  return (
    <div className={`app ${sidebarCollapsed ? "sidebarCollapsed" : ""}`}>
      <aside>
        <button
          type="button"
          className="sidebarToggle"
          onClick={() => setSidebarCollapsed((value) => !value)}
          aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {sidebarCollapsed ? <I.ChevronRight size={18} /> : <I.ChevronLeft size={18} />}
        </button>

        <div className="brand">
          <img src={triobyteLogo} className="brandImage" alt="TrioByte" />
          <div className="brandText">
            <div className="brandName">TRIOBYTE</div>
            <div className="brandTagline">TECHNOLOGY</div>
          </div>
        </div>

        <nav className="sidebarNav">
          {sidebarMenuGroups.map((group) => {
            const GroupIcon = I[group.icon] || I.Circle;
            const isActiveGroup = group.id === activeGroupId;
            const isOpen = sidebarCollapsed ? false : (openSidebarGroups[group.id] ?? isActiveGroup);

            return (
              <div
                className={`navGroup ${isOpen ? "open" : ""} ${isActiveGroup ? "containsActive" : ""}`}
                key={group.id}
              >
                <button
                  type="button"
                  className="navGroupTrigger"
                  onClick={() =>
                    setOpenSidebarGroups((current) => ({
                      ...current,
                      [group.id]: !(current[group.id] ?? isActiveGroup),
                    }))
                  }
                  aria-expanded={isOpen}
                >
                  <span className="navGroupTitle">
                    <GroupIcon size={16} />
                    <span>{group.label}</span>
                  </span>
                  <I.ChevronDown className="navGroupChevron" size={16} />
                </button>

                <div className="navSubmenu">
                  <div className="navSubmenuInner">
                    {group.items.map(([name, icon]) => {
                      const Icon = I[icon] || I.Circle;
                      return (
                        <button
                          key={name}
                          className={`navSubmenuItem ${page === name ? "active" : ""}`}
                          onClick={() => setPage(name)}
                        >
                          <Icon size={17} />
                          <span className="navLabel">{name}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })}
        </nav>

        <div className="user">
          <div className="avatar">
            {me.full_name?.[0] || "U"}
          </div>

          <div>
            <b>{me.full_name}</b>

            <small>
              {me.designation || me.role}
            </small>
          </div>

          <button
            className="logout"
            onClick={logout}
          >
            <I.LogOut size={17} />
          </button>
        </div>
      </aside>

      <main>
        <header>
          <span>
            <span className="workspaceLabel">Workspace</span>
            <span className="headerSlash">/</span>
            <strong>{page}</strong>
          </span>

          <div className="headerActions">
            <div className="themeQuickSwitch" aria-label="Theme">
              {["light", "dark", "accent"].map((item) => (
                <button
                  key={item}
                  type="button"
                  className={theme === item ? "active" : ""}
                  onClick={() => {
                    setTheme(item);
                    localStorage.setItem("tb_theme", item);
                  }}
                  title={item[0].toUpperCase() + item.slice(1)}
                >
                  {item === "light" ? <I.Sun size={15} /> : item === "dark" ? <I.Moon size={15} /> : <I.Sparkles size={15} />}
                </button>
              ))}
            </div>
            <button
              type="button"
              className="headerIconButton"
              onClick={() => setSearchOpen(true)}
              aria-label="Search"
              title="Search"
            >
              <I.Search size={19} />
            </button>

            <button
              type="button"
              className="headerIconButton notificationBell"
              onClick={() => setNotificationOpen(true)}
              aria-label="Notifications"
              title="Notifications"
            >
              <I.Bell size={19} />
              {unreadCount > 0 && <span className="notificationBadge">{unreadCount > 9 ? "9+" : unreadCount}</span>}
            </button>

            <div className="profileMenuWrap" ref={profileMenuRef}>
              <button
                type="button"
                className="topAvatar profileMenuTrigger"
                onClick={() => setProfileMenuOpen((open) => !open)}
                aria-label="Open profile menu"
                aria-expanded={profileMenuOpen}
                title="Account"
              >
                {me.full_name?.[0] || "U"}
              </button>

              {profileMenuOpen && (
                <div className="profileDropdown">
                  <div className="profileDropdownUser">
                    <div className="profileDropdownAvatar">
                      {me.full_name?.[0] || "U"}
                    </div>
                    <div>
                      <b>{me.full_name}</b>
                      <small>{me.designation || me.role}</small>
                    </div>
                  </div>

                  <div className="profileDropdownDivider" />

                  <button
                    type="button"
                    onClick={() => {
                      setPage("Profile");
                      setProfileMenuOpen(false);
                    }}
                  >
                    <I.UserCircle size={17} />
                    Profile
                  </button>

                  <button
                    type="button"
                    className="profileDropdownLogout"
                    onClick={logout}
                  >
                    <I.LogOut size={17} />
                    Log out
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        <GlobalSearch
          open={searchOpen}
          onClose={() => setSearchOpen(false)}
          onSelect={(result) => {
            setPage(result.page);
            setSearchOpen(false);
          }}
        />

        <NotificationPanel
          open={notificationOpen}
          onClose={() => setNotificationOpen(false)}
          onUnreadChange={setUnreadCount}
        />

        <section className="content">
          <div className="eyebrow">
            TRIOBYTE PORTAL
          </div>

          <h1>{page}</h1>

          {me.must_change_password && (
            <div className="warning">
              You must change the default password before using the portal.
            </div>
          )}

          <Page
            page={page}
            me={me}
            data={data[page]}
            loading={loading}
            theme={theme}
            setTheme={setTheme}
            refresh={loadMe}
            refreshPage={refreshCurrentPage}
          />
        </section>
      </main>
    </div>
  );
}

function PortalFormModal({ title, fields, values, setValues, onClose, onSubmit, submitting }) {
  return (
    <div className="portalModalBackdrop" role="presentation">
      <div className="portalModal" role="dialog" aria-modal="true">
        <div className="portalModalHeader"><h2>{title}</h2><button type="button" className="modalClose" onClick={onClose} aria-label="Close">×</button></div>
        <div className="portalModalBody">
          {fields.map((field) => (
            <label key={field.name} className="modalField"><span>{field.label}</span>
              {field.type === "textarea" ? <textarea value={values[field.name] || ""} placeholder={field.placeholder || ""} onChange={(e) => setValues((p) => ({ ...p, [field.name]: e.target.value }))} /> : <input type={field.type || "text"} value={values[field.name] || ""} placeholder={field.placeholder || ""} onChange={(e) => setValues((p) => ({ ...p, [field.name]: e.target.value }))} />}
            </label>
          ))}
        </div>
        <div className="portalModalActions"><button type="button" className="secondary" onClick={onClose} disabled={submitting}>Cancel</button><button type="button" className="primary" onClick={onSubmit} disabled={submitting}>{submitting ? "Saving..." : "Save"}</button></div>
      </div>
    </div>
  );
}


function ProjectCreateModal({ onClose, onCreated }) {
  const [users, setUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [submittingProject, setSubmittingProject] = useState(false);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    name: "",
    description: "",
    lead_id: "",
    member_ids: [],
    start_date: "",
    deadline: "",
    status: "Planning",
    priority: "Medium",
  });

  useEffect(() => {
    let active = true;

    api("/api/users")
      .then((rows) => {
        if (active) setUsers(Array.isArray(rows) ? rows : []);
      })
      .catch((err) => {
        if (active) {
          setError(err.message || "Unable to load employees.");
        }
      })
      .finally(() => {
        if (active) setLoadingUsers(false);
      });

    return () => {
      active = false;
    };
  }, []);

  function setField(name, value) {
    setForm((previous) => ({
      ...previous,
      [name]: value,
    }));
  }

  function toggleMember(userId) {
    const id = Number(userId);

    setForm((previous) => ({
      ...previous,
      member_ids: previous.member_ids.includes(id)
        ? previous.member_ids.filter((memberId) => memberId !== id)
        : [...previous.member_ids, id],
    }));
  }

  async function createProject() {
    const name = form.name.trim();

    if (!name) {
      setError("Project name is required.");
      return;
    }

    if (
      form.start_date &&
      form.deadline &&
      form.deadline < form.start_date
    ) {
      setError("Deadline cannot be before the start date.");
      return;
    }

    try {
      setSubmittingProject(true);
      setError("");

      await api("/api/projects", {
        method: "POST",
        body: {
          name,
          description: form.description.trim(),
          lead_id: form.lead_id ? Number(form.lead_id) : null,
          member_ids: form.member_ids,
          start_date: form.start_date || null,
          deadline: form.deadline || null,
          status: form.status,
          priority: form.priority,
        },
      });

      onCreated();
    } catch (err) {
      setError(err.message || "Unable to create project.");
    } finally {
      setSubmittingProject(false);
    }
  }

  return (
    <div className="portalModalBackdrop" role="presentation">
      <div className="portalModal projectCreateModal" role="dialog" aria-modal="true">
        <div className="portalModalHeader">
          <h2>Create Project</h2>
          <button
            type="button"
            className="modalClose"
            onClick={onClose}
            disabled={submittingProject}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="portalModalBody">
          {error && (
            <div className="formMessage error">
              {error}
            </div>
          )}

          <label className="modalField">
            <span>Project Name *</span>
            <input
              type="text"
              value={form.name}
              placeholder="Enter project name"
              onChange={(e) => setField("name", e.target.value)}
            />
          </label>

          <label className="modalField">
            <span>Description</span>
            <textarea
              value={form.description}
              placeholder="Describe the project"
              onChange={(e) => setField("description", e.target.value)}
            />
          </label>

          <div className="projectFormGrid">
            <label className="modalField">
              <span>Project Lead</span>
              <select
                value={form.lead_id}
                onChange={(e) => setField("lead_id", e.target.value)}
                disabled={loadingUsers}
              >
                <option value="">Select project lead</option>
                {users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.full_name} ({user.employee_id || user.role})
                  </option>
                ))}
              </select>
            </label>

            <label className="modalField">
              <span>Status</span>
              <select
                value={form.status}
                onChange={(e) => setField("status", e.target.value)}
              >
                <option value="Planning">Planning</option>
                <option value="Active">Active</option>
                <option value="On Hold">On Hold</option>
                <option value="Completed">Completed</option>
                <option value="Cancelled">Cancelled</option>
              </select>
            </label>

            <label className="modalField">
              <span>Start Date</span>
              <input
                type="date"
                value={form.start_date}
                onChange={(e) => setField("start_date", e.target.value)}
              />
            </label>

            <label className="modalField">
              <span>Deadline</span>
              <input
                type="date"
                value={form.deadline}
                onChange={(e) => setField("deadline", e.target.value)}
              />
            </label>

            <label className="modalField">
              <span>Priority</span>
              <select
                value={form.priority}
                onChange={(e) => setField("priority", e.target.value)}
              >
                <option value="Low">Low</option>
                <option value="Medium">Medium</option>
                <option value="High">High</option>
                <option value="Critical">Critical</option>
              </select>
            </label>
          </div>

          <div className="projectMembers">
            <div className="projectMembersHead">
              <div>
                <span>Project Members</span>
                <small>
                  {form.member_ids.length} selected
                </small>
              </div>
            </div>

            {loadingUsers ? (
              <p className="memberLoading">
                Loading employees...
              </p>
            ) : (
              <div className="memberChecklist">
                {users.map((user) => (
                  <label
                    className="memberCheck"
                    key={user.id}
                  >
                    <input
                      type="checkbox"
                      checked={form.member_ids.includes(user.id)}
                      onChange={() => toggleMember(user.id)}
                    />

                    <span>
                      <b>{user.full_name}</b>
                      <small>
                        {user.employee_id || "—"} · {user.role}
                      </small>
                    </span>
                  </label>
                ))}
              </div>
            )}

            <small className="memberHint">
              The selected project lead is automatically added as a member.
            </small>
          </div>
        </div>

        <div className="portalModalActions">
          <button
            type="button"
            className="secondary"
            onClick={onClose}
            disabled={submittingProject}
          >
            Cancel
          </button>

          <button
            type="button"
            className="primary"
            onClick={createProject}
            disabled={submittingProject || loadingUsers}
          >
            {submittingProject ? "Creating..." : "Create Project"}
          </button>
        </div>
      </div>
    </div>
  );
}


function DashboardTasks({ dashboard, me, onRefresh }) {
  const role = normalizeRole(me.role);
  const management = ["CEO", "ADMIN", "HR"].includes(role);
  const [projects, setProjects] = useState([]);
  const [members, setMembers] = useState([]);
  const [selectedProject, setSelectedProject] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [message, setMessage] = useState({ type: "", text: "" });
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    title: "", description: "", assignee_ids: [], start_date: "", deadline: "", priority: "Medium"
  });

  useEffect(() => {
    api("/api/projects").then((rows) => {
      setProjects(Array.isArray(rows) ? rows : []);
    }).catch(() => {});
  }, []);

  const leadProjectIds = new Set(
    projects.filter((p) => Number(p.lead_id) === Number(me.id)).map((p) => Number(p.id))
  );
  const canCreate = management || leadProjectIds.size > 0;

  async function chooseProject(id) {
    setSelectedProject(id);
    setForm((f) => ({ ...f, assignee_ids: [] }));
    if (!id) { setMembers([]); return; }
    try {
      const result = await api(`/api/projects/${id}`);
      setMembers(Array.isArray(result.members) ? result.members : []);
    } catch (err) {
      setMessage({ type: "error", text: err.message || "Unable to load project members." });
    }
  }

  function toggleAssignee(id) {
    id = Number(id);
    setForm((f) => ({
      ...f,
      assignee_ids: f.assignee_ids.includes(id)
        ? f.assignee_ids.filter((x) => x !== id)
        : [...f.assignee_ids, id]
    }));
  }

  async function createTask() {
    if (!form.title.trim() || !selectedProject || !form.assignee_ids.length) {
      setMessage({ type: "error", text: "Project, task title, and at least one assignee are required." });
      return;
    }
    try {
      setSaving(true);
      setMessage({ type: "", text: "" });
      await api("/api/tasks", {
        method: "POST",
        body: { ...form, title: form.title.trim(), project_id: Number(selectedProject) }
      });
      setMessage({ type: "success", text: "Task created successfully." });
      setForm({ title: "", description: "", assignee_ids: [], start_date: "", deadline: "", priority: "Medium" });
      setSelectedProject("");
      setMembers([]);
      setShowForm(false);
      onRefresh();
    } catch (err) {
      setMessage({ type: "error", text: err.message || "Unable to create task." });
    } finally {
      setSaving(false);
    }
  }

  async function updateProgress(task, progress) {
    try {
      await api(`/api/tasks/${task.id}/progress`, {
        method: "PUT",
        body: { progress: Number(progress) }
      });
      onRefresh();
    } catch (err) {
      setMessage({ type: "error", text: err.message || "Unable to update progress." });
    }
  }

  const tasks = dashboard.tasks || [];

  return (
    <div className="dashboardTasks">
      <div className="moduleTop">
        <div>
          <h2>Tasks</h2>
          <p>{tasks.length} task(s) visible to you</p>
        </div>
        {canCreate && (
          <button className="primary" onClick={() => setShowForm((v) => !v)}>
            {showForm ? "Close" : "+ Create Task"}
          </button>
        )}
      </div>

      {message.text && <div className={`formMessage ${message.type}`}>{message.text}</div>}

      {showForm && (
        <div className="card taskCreatePanel">
          <h3>Create Task</h3>
          <div className="projectFormGrid">
            <label className="modalField"><span>Project *</span>
              <select value={selectedProject} onChange={(e) => chooseProject(e.target.value)}>
                <option value="">Select project</option>
                {projects.filter((p) => management || Number(p.lead_id) === Number(me.id)).map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </label>
            <label className="modalField"><span>Priority</span>
              <select value={form.priority} onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value }))}>
                <option>Low</option><option>Medium</option><option>High</option><option>Critical</option>
              </select>
            </label>
            <label className="modalField"><span>Start Date</span>
              <input type="date" value={form.start_date} onChange={(e) => setForm((f) => ({ ...f, start_date: e.target.value }))} />
            </label>
            <label className="modalField"><span>Deadline</span>
              <input type="date" value={form.deadline} onChange={(e) => setForm((f) => ({ ...f, deadline: e.target.value }))} />
            </label>
          </div>
          <label className="modalField"><span>Task Title *</span>
            <input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="Enter task title" />
          </label>
          <label className="modalField"><span>Description</span>
            <textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} placeholder="Describe the work to be done" />
          </label>
          <div className="projectMembers">
            <div className="projectMembersHead"><div><span>Assign To *</span><small>{form.assignee_ids.length} selected</small></div></div>
            <div className="memberChecklist">
              {members.map((user) => (
                <label className="memberCheck" key={user.id}>
                  <input type="checkbox" checked={form.assignee_ids.includes(Number(user.id))} onChange={() => toggleAssignee(user.id)} />
                  <span><b>{user.full_name}</b><small>{user.employee_id || "—"} · {user.role}</small></span>
                </label>
              ))}
              {selectedProject && !members.length && <p className="memberLoading">No project members available.</p>}
            </div>
          </div>
          <button className="primary" onClick={createTask} disabled={saving}>{saving ? "Creating..." : "Create Task"}</button>
        </div>
      )}

      <div className="taskGrid">
        {tasks.length === 0 ? <div className="card"><p>No tasks to show.</p></div> : tasks.map((task) => {
          const isAssigned = task.my_progress !== undefined && task.my_progress !== null;
          const progress = isAssigned ? Number(task.my_progress) : Number(task.overall_progress || 0);
          return (
            <div className="card taskCard" key={task.id}>
              <div className="taskCardTop">
                <div><h3>{task.title}</h3><small>{task.project_name || "No project"}</small></div>
                <b>{task.priority}</b>
              </div>
              {task.description && <p>{task.description}</p>}
              <div className="taskMeta">
                <span>Status: {isAssigned ? task.my_status : task.status}</span>
                <span>Assigned by: {task.assigned_by_name || "—"}</span>
                <span>Deadline: {task.deadline ? String(task.deadline).slice(0,10) : "—"}</span>
                {!isAssigned && <span>{task.completed_count || 0}/{task.assignee_count || 0} completed</span>}
              </div>
              <div className="taskProgressLabel"><span>{isAssigned ? "My Progress" : "Overall Progress"}</span><b>{progress}%</b></div>
              <div className="taskProgressTrack"><div className="taskProgressFill" style={{ width: `${progress}%` }} /></div>
              {isAssigned && (
                <div className="taskProgressControl">
                  <input type="range" min="0" max="100" step="5" value={progress} onChange={(e) => updateProgress(task, e.target.value)} />
                  <select value={progress} onChange={(e) => updateProgress(task, e.target.value)}>
                    {[0,10,20,30,40,50,60,70,80,90,100].map((v) => <option key={v} value={v}>{v}%</option>)}
                  </select>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}


function ProjectEditModal({ project, me, onClose, onSaved }) {
  const role=normalizeRole(me.role), management=["CEO","ADMIN","HR"].includes(role);
  const [users,setUsers]=useState([]), [members,setMembers]=useState([]), [saving,setSaving]=useState(false), [loading,setLoading]=useState(true), [error,setError]=useState("");
  const [form,setForm]=useState({name:project.name||"",description:project.description||"",lead_id:project.lead_id?String(project.lead_id):"",member_ids:[],start_date:project.start_date?String(project.start_date).slice(0,10):"",deadline:project.deadline?String(project.deadline).slice(0,10):"",status:project.status||"Planning",priority:project.priority||"Medium"});

  useEffect(()=>{let active=true; Promise.all([api(`/api/projects/${project.id}`),management?api("/api/users"):Promise.resolve([])]).then(([d,u])=>{if(!active)return; const m=Array.isArray(d.members)?d.members:[]; setMembers(m); setUsers(Array.isArray(u)?u:m); setForm(p=>({...p,member_ids:m.map(x=>Number(x.id))}));}).catch(e=>active&&setError(e.message||"Unable to load project details.")).finally(()=>active&&setLoading(false)); return()=>{active=false};},[project.id,management]);

  const setField=(k,v)=>setForm(p=>({...p,[k]:v}));
  const toggleMember=(id)=>setForm(p=>({...p,member_ids:p.member_ids.includes(Number(id))?p.member_ids.filter(x=>x!==Number(id)):[...p.member_ids,Number(id)]}));

  async function save(){
    if(management&&!form.name.trim()){setError("Project name is required.");return;}
    if(form.start_date&&form.deadline&&form.deadline<form.start_date){setError("Deadline cannot be before the start date.");return;}
    try{setSaving(true);setError("");const body={description:form.description.trim(),start_date:form.start_date||null,deadline:form.deadline||null,status:form.status,priority:form.priority};if(management)Object.assign(body,{name:form.name.trim(),lead_id:form.lead_id?Number(form.lead_id):null,member_ids:form.member_ids});await api(`/api/projects/${project.id}`,{method:"PUT",body});onSaved();}catch(e){setError(e.message||"Unable to update project.");}finally{setSaving(false);}
  }

  return <div className="portalModalBackdrop"><div className="portalModal projectCreateModal projectEditModal">
    <div className="portalModalHeader"><h2>Edit Project</h2><button type="button" className="modalClose" onClick={onClose} disabled={saving}>×</button></div>
    <div className="portalModalBody">
      {error&&<div className="formMessage error">{error}</div>}
      <label className="modalField"><span>Project Name *</span><input value={form.name} disabled={!management||loading} onChange={e=>setField("name",e.target.value)}/></label>
      <label className="modalField"><span>Description</span><textarea value={form.description} disabled={loading} onChange={e=>setField("description",e.target.value)}/></label>
      <div className="projectFormGrid">
        {management?<label className="modalField"><span>Project Lead</span><select value={form.lead_id} disabled={loading} onChange={e=>setField("lead_id",e.target.value)}><option value="">Select project lead</option>{users.map(u=><option key={u.id} value={u.id}>{u.full_name} ({u.employee_id||u.role})</option>)}</select></label>:<label className="modalField"><span>Project Lead</span><input value={project.lead_name||"—"} disabled/></label>}
        <label className="modalField"><span>Current Phase</span><select value={form.status} disabled={loading} onChange={e=>setField("status",e.target.value)}><option>Planning</option><option>Active</option><option>Review</option><option>Completed</option><option>On Hold</option><option>Cancelled</option></select></label>
        <label className="modalField"><span>Start Date</span><input type="date" value={form.start_date} disabled={loading} onChange={e=>setField("start_date",e.target.value)}/></label>
        <label className="modalField"><span>Deadline</span><input type="date" value={form.deadline} disabled={loading} onChange={e=>setField("deadline",e.target.value)}/></label>
        <label className="modalField"><span>Priority</span><select value={form.priority} disabled={loading} onChange={e=>setField("priority",e.target.value)}><option>Low</option><option>Medium</option><option>High</option><option>Critical</option></select></label>
      </div>
      <div className="projectMembers"><div className="projectMembersHead"><div><span>Project Members</span><small>{form.member_ids.length} selected</small></div></div>
      <div className="memberChecklist">{(management?users:members).map(u=>management?<label className="memberCheck" key={u.id}><input type="checkbox" checked={form.member_ids.includes(Number(u.id))} disabled={loading} onChange={()=>toggleMember(u.id)}/><span><b>{u.full_name}</b><small>{u.employee_id||"—"} · {u.role}</small></span></label>:<div className="memberCheck readOnlyMember" key={u.id}><span><b>{u.full_name}</b><small>{u.employee_id||"—"} · {u.role}</small></span></div>)}</div></div>
    </div>
    <div className="portalModalActions"><button type="button" className="secondary" onClick={onClose} disabled={saving}>Cancel</button><button type="button" className="primary" onClick={save} disabled={saving||loading}>{saving?"Saving...":"Save Changes"}</button></div>
  </div></div>;
}

function ProjectsTable({ rows, me, onEdit, onNextPhase, movingId }) {
  const role=normalizeRole(me.role), management=["CEO","ADMIN","HR"].includes(role);
  const fields=["name","description","lead_name","member_count","start_date","deadline","status","priority"];
  if(!rows.length)return <div className="card empty">No data available.</div>;
  return <div className="card tableWrap"><table className="projectsTable"><thead><tr>{fields.map(f=><th key={f}>{f.replaceAll("_"," ")}</th>)}<th>Progress</th><th>Actions</th></tr></thead><tbody>{rows.map(p=>{const progress=Math.max(0,Math.min(100,Number(p.progress||0)));const canEdit=management||Number(p.lead_id)===Number(me.id);const final=p.status==="Completed";return <tr key={p.id}>{fields.map(f=><td key={f}>{String(p[f]??"—")}</td>)}<td><div className="tableProgress"><div className="tableProgressTop"><span>{progress}%</span></div><div className="tableProgressTrack"><div className="tableProgressFill" style={{width:`${progress}%`}}/></div></div></td><td><div className="projectActions">{canEdit&&<button type="button" className="secondary smallAction" onClick={()=>onEdit(p)}>Edit</button>}{!final&&<button type="button" className="primary smallAction" disabled={progress<100||movingId===p.id} onClick={()=>onNextPhase(p)}>{movingId===p.id?"Moving...":"Next Phase"}</button>}{progress===100&&!final&&<small className="phaseReady">Ready</small>}{final&&<small className="phaseComplete">Final phase</small>}</div></td></tr>})}</tbody></table></div>;
}


function Page({
  page,
  me,
  data,
  loading,
  theme,
  setTheme,
  refresh,
  refreshPage,
}) {
  // ALL HOOKS MUST BE HERE.
  // Never put useState inside an if statement.

  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [notice, setNotice] = useState({ type: "", message: "" });
  const [modal, setModal] = useState(null);
  const [modalValues, setModalValues] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [editingProject, setEditingProject] = useState(null);
  const [movingProjectId, setMovingProjectId] = useState(null);
  const [editingProfile, setEditingProfile] = useState(false);
  const [profileValues, setProfileValues] = useState({
    full_name: me?.full_name || "",
    mobile: me?.mobile || "",
    address: me?.address || ""
  });

  useEffect(() => {
    setProfileValues({
      full_name: me?.full_name || "",
      mobile: me?.mobile || "",
      address: me?.address || ""
    });
  }, [me]);

  function openModal(type, values = {}) { setModal(type); setModalValues(values); setNotice({ type: "", message: "" }); }
  function closeModal() { if (!submitting) { setModal(null); setModalValues({}); } }

  async function moveProjectToNextPhase(project) {
    try {
      setMovingProjectId(project.id);
      setNotice({ type: "", message: "" });
      const result = await api(`/api/projects/${project.id}/next-phase`, { method: "POST" });
      setNotice({ type: "success", message: result.message || "Project moved to the next phase." });
      refreshPage();
    } catch (err) {
      setNotice({ type: "error", message: err.message || "Unable to move project to the next phase." });
    } finally {
      setMovingProjectId(null);
    }
  }

  async function updateRecordStatus(type, id, status) {
    try {
      setNotice({ type: "", message: "" });
      const endpoint = type === "leave" ? `/api/leave/${id}` : `/api/salary/${id}`;
      const result = await api(endpoint, {
        method: "PUT",
        body: { status },
      });
      setNotice({
        type: "success",
        message: result.message || `${type === "leave" ? "Leave request" : "Salary record"} ${status.toLowerCase()} successfully.`,
      });
      refreshPage();
    } catch (err) {
      setNotice({
        type: "error",
        message: err.message || "Unable to update the record.",
      });
    }
  }

  async function submit(path, body) {
    try {
      setSubmitting(true);
      setNotice({ type: "", message: "" });
      await api(path, { method: "POST", body });
      setNotice({ type: "success", message: "Saved successfully." });
      setModal(null);
      setModalValues({});
      if (["Projects", "Leave Management", "Salary"].includes(page)) {
        window.setTimeout(() => refreshPage(), 300);
      }
    } catch (err) {
      setNotice({ type: "error", message: err.message || "Unable to save. Please try again." });
    } finally {
      setSubmitting(false);
    }
  }

  if (page === "Dashboard") {
    const dashboard = data || {};

    return (
      <>
        <div className="grid stats">
          <Card n={dashboard.stats?.team ?? 0} t="Team Members" />
          <Card n={dashboard.stats?.projects ?? 0} t="Projects" />
          <Card n={dashboard.stats?.tasks ?? 0} t="Tasks" />
        </div>

        <h2>Active Projects</h2>
        <List rows={dashboard.projects || []} fields={["name", "deadline", "status", "progress"]} />

        <h2>Announcements</h2>
        <List rows={dashboard.announcements || []} fields={["title", "content", "body"]} />
      </>
    );
  }

  if (page === "Tasks") {
    const dashboard = data || {};
    return (
      <DashboardTasks
        dashboard={dashboard}
        me={me}
        onRefresh={() => window.location.reload()}
      />
    );
  }

  if (page === "Profile") {
    async function saveProfile() {
      try {
        setSubmitting(true);
        setNotice({ type: "", message: "" });

        const result = await api("/api/profile", {
          method: "PUT",
          body: {
            full_name: profileValues.full_name.trim(),
            mobile: profileValues.mobile.trim(),
            address: profileValues.address.trim()
          }
        });

        setNotice({
          type: "success",
          message: result.message || "Profile updated successfully."
        });
        setEditingProfile(false);
        await refresh();
      } catch (err) {
        setNotice({
          type: "error",
          message: err.message || "Unable to update profile."
        });
      } finally {
        setSubmitting(false);
      }
    }

    return (
      <>
        {notice.message && (
          <div className={`formMessage ${notice.type}`}>
            {notice.message}
          </div>
        )}

        <div className="profile card">
          <div className="profileHead">
            <div className="photo level">
              {me.full_name?.[0] || "U"}
            </div>

            <div>
              <h2>{me.full_name}</h2>
              <p>
                {me.designation || "—"}
                {" · "}
                {me.department || "—"}
              </p>
            </div>

            <button
              className="primary profileEditButton"
              onClick={() => {
                setEditingProfile((value) => !value);
                setNotice({ type: "", message: "" });
              }}
              disabled={submitting}
            >
              {editingProfile ? "Cancel Edit" : "Edit Profile"}
            </button>
          </div>

          {editingProfile ? (
            <div className="profileEditForm">
              <label className="modalField">
                <span>Full Name *</span>
                <input
                  value={profileValues.full_name}
                  onChange={(e) =>
                    setProfileValues((v) => ({
                      ...v,
                      full_name: e.target.value
                    }))
                  }
                />
              </label>

              <label className="modalField">
                <span>Mobile Number</span>
                <input
                  value={profileValues.mobile}
                  onChange={(e) =>
                    setProfileValues((v) => ({
                      ...v,
                      mobile: e.target.value
                    }))
                  }
                  placeholder="Enter mobile number"
                />
              </label>

              <label className="modalField profileAddressField">
                <span>Address</span>
                <textarea
                  value={profileValues.address}
                  onChange={(e) =>
                    setProfileValues((v) => ({
                      ...v,
                      address: e.target.value
                    }))
                  }
                  placeholder="Enter your address"
                />
              </label>

              <div className="profileEditActions">
                <button
                  type="button"
                  className="secondary"
                  onClick={() => {
                    setEditingProfile(false);
                    setProfileForm({
                      full_name: me?.full_name || "",
                      mobile: me?.mobile || "",
                      address: me?.address || "",
                    });
                    setProfileMessage("");
                  }}
                >
                  Cancel
                </button>
                <button
                  className="primary"
                  onClick={saveProfile}
                  disabled={submitting}
                >
                  {submitting ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </div>
          ) : (
            <div className="detailGrid">
              {[
                ["Employee ID", me.employee_id],
                ["Company ID", me.company_id],
                ["Email", me.email],
                ["Mobile", me.mobile],
                ["Address", me.address],
                ["Department", me.department],
                ["Designation", me.designation],
                ["Employee Level", me.employee_level],
                [
                  "Joining Date",
                  me.joining_date
                    ? String(me.joining_date).slice(0, 10)
                    : null
                ],
                [
                  "Employment Status",
                  me.permanent ? "Permanent" :
                    (me.end_date
                      ? `Until ${String(me.end_date).slice(0, 10)}`
                      : "—")
                ],
                ["Role", me.role]
              ].map(([label, value]) => (
                <div className="detail" key={label}>
                  <small>{label}</small>
                  <b>{value || "—"}</b>
                </div>
              ))}
            </div>
          )}
        </div>
      </>
    );
  }

  if (page === "Settings") {
    async function updatePassword() {
      try {
        await api("/api/settings/password", {
          method: "PUT",
          body: {
            currentPassword: oldPassword,
            newPassword,
          },
        });

        setNotice({ type: "success", message: "Password updated successfully." });

        setOldPassword("");
        setNewPassword("");

        await refresh();
      } catch (err) {
        setNotice({ type: "error", message: err.message || "Unable to update password." });
      }
    }

    return (
      <>
        {notice.message && <div className={`formMessage ${notice.type}`}>{notice.message}</div>}
        <div className="card settings">
        <h2>Appearance</h2>

        <div className="themes">
          {["light", "dark", "accent"].map((currentTheme) => (
            <button
              key={currentTheme}
              className={
                theme === currentTheme
                  ? "selected"
                  : ""
              }
              onClick={() => {
                setTheme(currentTheme);

                localStorage.setItem(
                  "tb_theme",
                  currentTheme
                );
              }}
            >
              {currentTheme[0].toUpperCase() +
                currentTheme.slice(1)}
            </button>
          ))}
        </div>

        <h2>Security</h2>

        <p>
          Change your company portal password.
        </p>

        <input
          type="password"
          placeholder="Current password"
          value={oldPassword}
          onChange={(e) =>
            setOldPassword(e.target.value)
          }
        />

        <input
          type="password"
          placeholder="New password"
          value={newPassword}
          onChange={(e) =>
            setNewPassword(e.target.value)
          }
        />

        <button
          className="primary"
          onClick={updatePassword}
        >
          Update Password
        </button>
        </div>
      </>
    );
  }

  if (page === "Calendar") {
    return <CompanyCalendar me={me} />;
  }

  if (
    page === "Employees" ||
    page === "Intern Management"
  ) {
    const rows = (data || []).filter((user) => {
      if (page === "Intern Management") {
        return normalizeRole(user.role) === "INTERN";
      }

      return true;
    });

    const role = normalizeRole(me.role);

    return (
      <>
        <div className="toolbar">
          <p>
            {page === "Employees"
              ? "Manage company employees and create new accounts."
              : "Track intern details and restrictions."}
          </p>

          {["CEO", "ADMIN", "HR"].includes(role) && (
            <button
              className="primary"
              onClick={() => {
                document
                  .getElementById("create")
                  ?.classList.toggle("hide");
              }}
            >
              + Create New Employee
            </button>
          )}
        </div>

        <CreateUser
  id="create"
  currentRole={role}
/>

        <List
          rows={rows}
          fields={[
            "employee_id",
            "full_name",
            "email",
            "role",
            "department",
            "designation",
            "employee_level",
          ]}
        />
      </>
    );
  }

  

  if (
    [
      "Projects",
      "Attendance",
      "Leave Management",
      "Daily Work",
      "Salary",
      "Overtime",
      "Announcements",
      "Code Management",
      "Chat",
    ].includes(page)
  ) {
    const rows = Array.isArray(data) ? data : [];

    const hidden = [
      "id",
      "password_hash",
      "user_id",
      "project_id",
      "assigned_to",
      "assignee_id",
      "created_by",
      "reviewed_by",
      "owner_id",
      "receiver_id",
      "sender_id",
      "lead_id",
      "created_by_name",
    ];

    const fields =
      page === "Projects"
        ? [
            "name",
            "description",
            "lead_name",
            "member_count",
            "start_date",
            "deadline",
            "status",
            "priority",
            "progress",
          ].filter((field) =>
            rows.some((row) =>
              Object.prototype.hasOwnProperty.call(row, field)
            )
          )
        : rows[0]
          ? Object.keys(rows[0])
              .filter((key) => !hidden.includes(key))
              .slice(0, 7)
          : [];

    const role = normalizeRole(me.role);

    return (
      <>
        <div className="moduleTop">
          <p>
            {loading
              ? "Loading..."
              : `${rows.length} record(s)`}
          </p>

          {page === "Projects" && ["CEO", "ADMIN", "HR"].includes(role) && (
  <button
    className="primary"
    onClick={() => openModal("project")}
  >
    + Create Project
  </button>
)}

{page === "Leave Management" && (
  <button
    className="primary"
    onClick={() =>
      openModal("leave", {
        from_date: "",
        to_date: "",
        reason: "",
      })
    }
  >
    Request Leave
  </button>
)}

          
          {page === "Daily Work" && <button className="primary" onClick={() => openModal("work", { content: "", progress: "50" })}>Add Work Log</button>}
          {page === "Announcements" && ["CEO", "ADMIN", "HR"].includes(role) && <button className="primary" onClick={() => openModal("announcement", { title: "", content: "" })}>New Announcement</button>}
        </div>

        {notice.message && <div className={`formMessage ${notice.type}`}>{notice.message}</div>}

        {modal === "project" && <ProjectCreateModal onClose={closeModal} onCreated={() => { closeModal(); refreshPage(); }} />}
        {editingProject && <ProjectEditModal project={editingProject} me={me} onClose={() => setEditingProject(null)} onSaved={() => { setEditingProject(null); refreshPage(); }} />}


        {modal === "leave" && <PortalFormModal title="Request Leave" fields={[{ name: "from_date", label: "From date", type: "date" }, { name: "to_date", label: "To date", type: "date" }, { name: "reason", label: "Reason", type: "textarea", placeholder: "Enter the reason for leave" }]} values={modalValues} setValues={setModalValues} onClose={closeModal} submitting={submitting} onSubmit={() => { if (!modalValues.from_date || !modalValues.to_date) { setNotice({ type: "error", message: "Please select both leave dates." }); return; } submit("/api/leave", { from_date: modalValues.from_date, to_date: modalValues.to_date, reason: modalValues.reason || "" }); }} />}

        {modal === "work" && <PortalFormModal title="Add Work Log" fields={[{ name: "content", label: "Work completed", type: "textarea", placeholder: "Describe what you worked on" }, { name: "progress", label: "Progress (%)", type: "number" }]} values={modalValues} setValues={setModalValues} onClose={closeModal} submitting={submitting} onSubmit={() => { if (!modalValues.content?.trim()) { setNotice({ type: "error", message: "Please enter your work details." }); return; } submit("/api/daily-work", { content: modalValues.content.trim(), progress: Number(modalValues.progress || 0) }); }} />}

        {modal === "announcement" && <PortalFormModal title="New Announcement" fields={[{ name: "title", label: "Title", type: "text", placeholder: "Announcement title" }, { name: "content", label: "Message", type: "textarea", placeholder: "Write the announcement" }]} values={modalValues} setValues={setModalValues} onClose={closeModal} submitting={submitting} onSubmit={() => { if (!modalValues.title?.trim()) { setNotice({ type: "error", message: "Announcement title is required." }); return; } submit("/api/announcements", { title: modalValues.title.trim(), content: modalValues.content || "" }); }} />}

        {page === "Projects" ? (
          <ProjectsTable
            rows={rows}
            me={me}
            onEdit={setEditingProject}
            onNextPhase={moveProjectToNextPhase}
            movingId={movingProjectId}
          />
        ) : page === "Leave Management" ? (
          <ManagementActionTable
            rows={rows}
            fields={fields}
            type="leave"
            canManage={["CEO", "ADMIN", "HR"].includes(role)}
            onStatusChange={updateRecordStatus}
          />
        ) : page === "Salary" ? (
          <ManagementActionTable
            rows={rows}
            fields={fields}
            type="salary"
            canManage={["CEO", "ADMIN", "HR"].includes(role)}
            onStatusChange={updateRecordStatus}
          />
        ) : (
          <List rows={rows} fields={fields} />
        )}

        {page === "Attendance" && ["CEO", "ADMIN", "HR"].includes(role) && (
          <ActivityLogs />
        )}
      </>
    );
  }

  return (
    <div className="card">
      <h2>{page}</h2>

      <p>
        This functional demo module is ready.
      </p>
    </div>
  );
}

function CompanyCalendar({ me }) {
  const [viewDate, setViewDate] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  const dateKey = (value) => {
    if (!value) return null;
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return null;
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  };

  const normalizeRows = (rows, type, titleField, dateFields) =>
    (Array.isArray(rows) ? rows : []).flatMap((row) => {
      const rawDate = dateFields.map((field) => row[field]).find(Boolean);
      const date = dateKey(rawDate);
      if (!date) return [];
      return [{
        id: `${type}-${row.id ?? Math.random()}`,
        type,
        date,
        title: row[titleField] || row.title || row.name || type,
        description: row.description || row.content || row.reason || row.status || "",
      }];
    });

  useEffect(() => {
    let active = true;
    setLoading(true);
    Promise.allSettled([
      api("/api/attendance"),
      api("/api/daily-work"),
      api("/api/leave"),
      api("/api/projects"),
      api("/api/announcements"),
    ]).then((results) => {
      if (!active) return;
      const values = results.map((result) => result.status === "fulfilled" ? result.value : []);
      const next = [
        ...normalizeRows(values[0], "attendance", "status", ["work_date", "date", "created_at"]),
        ...normalizeRows(values[1], "work", "content", ["work_date", "date", "created_at"]),
        ...normalizeRows(values[2], "leave", "leave_type", ["start_date", "from_date", "date"]),
        ...normalizeRows(values[3], "project", "name", ["deadline", "due_date", "date"]),
        ...normalizeRows(values[4], "announcement", "title", ["created_at", "date"]),
      ];
      setEvents(next);
      setLoading(false);
    });
    return () => { active = false; };
  }, []);

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const first = new Date(year, month, 1);
  const start = new Date(year, month, 1 - first.getDay());
  const today = new Date();
  const cells = Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return date;
  });

  const sameDay = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  const keyFor = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  const eventsFor = (date) => events.filter((event) => event.date === keyFor(date));
  const selectedEvents = eventsFor(selectedDate);
  const monthLabel = viewDate.toLocaleDateString(undefined, { month: "long", year: "numeric" });
  const selectedLabel = selectedDate.toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "long", day: "numeric" });
  const subtitle = ["EMPLOYEE", "INTERN"].includes(normalizeRole(me.role)) ? "Your activity, attendance and deadlines" : "Company activity, attendance, work and deadlines";
  const icons = { login: I.LogIn, attendance: I.CalendarCheck, work: I.ClipboardList, leave: I.Umbrella, project: I.FolderKanban, announcement: I.Megaphone };

  return (
    <div className="companyCalendarWrap">
      <div className="card companyCalendar">
        <div className="calendarHeader">
          <div><div className="calendarTitle">{monthLabel}</div><div className="calendarSubtitle">{subtitle}</div></div>
          <div className="calendarControls">
            <button type="button" onClick={() => setViewDate(new Date(year, month - 1, 1))} aria-label="Previous month"><I.ChevronLeft size={18} /></button>
            <button type="button" className="todayControl" onClick={() => { const d = new Date(); setViewDate(d); setSelectedDate(d); }}>Today</button>
            <button type="button" onClick={() => setViewDate(new Date(year, month + 1, 1))} aria-label="Next month"><I.ChevronRight size={18} /></button>
          </div>
        </div>
        <div className="calendarLegend">{[["attendance","Attendance"],["work","Work log"],["leave","Leave"],["project","Project deadline"],["announcement","Announcement"]].map(([type,label]) => <span key={type}><i className={`legendDot ${type}`} />{label}</span>)}</div>
        {loading && <div className="calendarLoading">Loading calendar activity…</div>}
        <div className="companyCalendarGrid">
          {["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map((day) => <div className="calendarDayName" key={day}>{day}</div>)}
          {cells.map((date) => {
            const dayEvents = eventsFor(date);
            const preview = dayEvents.slice(0, 3);
            const classes = ["companyCalendarDate", date.getMonth() !== month ? "otherMonth" : "", sameDay(date, today) ? "today" : "", sameDay(date, selectedDate) ? "selectedDate" : ""].filter(Boolean).join(" ");
            return <button type="button" key={date.toISOString()} className={classes} onClick={() => setSelectedDate(date)} title={`${date.toLocaleDateString(undefined,{weekday:"long",month:"long",day:"numeric",year:"numeric"})}${dayEvents.length ? ` — ${dayEvents.map((e)=>e.title).join(", ")}` : " — No recorded activity"}`}><strong className="dateNumber">{date.getDate()}</strong><div className="calendarEventList">{preview.map((event) => <span key={event.id} className={`calendarEvent ${event.type}`}>{event.title}</span>)}{dayEvents.length > 3 && <span className="moreEvents">+{dayEvents.length - 3} more</span>}</div></button>;
          })}
        </div>
      </div>
      <div className="card calendarDetails">
        <div className="calendarDetailsHead"><div><div className="eyebrow">SELECTED DAY</div><h2>{selectedLabel}</h2></div><span>{selectedEvents.length} activity item{selectedEvents.length === 1 ? "" : "s"}</span></div>
        {selectedEvents.length ? <div className="activityTimeline">{selectedEvents.map((event) => { const Icon = icons[event.type] || I.CalendarDays; return <div className={`activityItem ${event.type}`} key={event.id}><div className="activityIcon"><Icon size={18} /></div><div className="activityBody"><b>{event.title}</b>{event.description && <p>{event.description}</p>}</div></div>; })}</div> : <div className="calendarEmpty">No recorded activity for this day.</div>}
      </div>
    </div>
  );
}

function CreateUser({
  id,
  currentRole
}) {
  const [form, setForm] = useState({
    role: "employee",
    default_password: "Demo@123",
  });

  const [message, setMessage] = useState({
    type: "",
    text: "",
  });

  const [creating, setCreating] = useState(false);

  function setField(key, value) {
    setForm((previous) => ({
      ...previous,
      [key]: value,
    }));
  }

  async function createUser() {
  if (
    !form.full_name?.trim() ||
    !form.email?.trim()
  ) {
    setMessage({
      type: "error",
      text: "Full name and company email are required.",
    });

    return;
  }

  try {
    setCreating(true);

    setMessage({
      type: "",
      text: "",
    });

    await api("/api/users", {
      method: "POST",
      body: form,
    });

    setMessage({
      type: "success",
      text:
        `${form.role === "intern"
          ? "Intern"
          : "Employee"} account created successfully. ` +
        "Default password: Demo@123",
    });

    setForm({
      role: "employee",
      default_password: "Demo@123",
    });

    window.setTimeout(() => {
      window.location.reload();
    }, 1500);

  } catch (err) {
    setMessage({
      type: "error",
      text:
        err.message ||
        "Unable to create the account.",
    });

  } finally {
    setCreating(false);
  }
}

  return (
    <div
      id={id}
      className="create hide card"
    >
      <h2>Create New Employee</h2>

      {message.text && (
  <div
    className={
      message.type === "success"
        ? "formMessage success"
        : "formMessage error"
    }
  >
    {message.text}
  </div>
)}

      <div className="formGrid">
        {[
          ["full_name", "Full name"],
          ["email", "Company email"],
          ["employee_id", "Employee ID"],
          ["department", "Department"],
          ["designation", "Designation"],
          ["mobile", "Mobile"],
        ].map(([key, placeholder]) => (
          <input
            key={key}
            placeholder={placeholder}
            value={form[key] || ""}
            onChange={(e) =>
              setField(key, e.target.value)
            }
          />
        ))}
      </div>

      <select
  value={form.role}
  onChange={(e) =>
    setField(
      "role",
      e.target.value.toLowerCase()
    )
  }
>
  <option value="employee">
    EMPLOYEE
  </option>

  <option value="intern">
    INTERN
  </option>

  {currentRole !== "HR" && (
    <>
      <option value="hr">
        HR
      </option>

      <option value="admin">
        ADMIN
      </option>
    </>
  )}
</select>

     <button
  className="primary"
  onClick={createUser}
  disabled={creating}
>
  {creating
    ? "Creating Account..."
    : "Create Account"}
</button>
    </div>
  );
}


function ManagementActionTable({
  rows,
  fields,
  type,
  canManage,
  onStatusChange,
}) {
  if (!rows || !rows.length) {
    return <div className="card empty">No data available.</div>;
  }

  const statusLabel = type === "leave" ? "Approve" : "Approve";
  const processedStatus = type === "leave" ? "Approved" : "Processed";

  return (
    <div className="card tableWrap">
      <table>
        <thead>
          <tr>
            {fields.map((field) => (
              <th key={field}>{field.replaceAll("_", " ")}</th>
            ))}
            {canManage && <th>Actions</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => {
            const currentStatus = String(row.status || "").trim();
            const isFinal = ["Approved", "Rejected", "Processed"].includes(currentStatus);

            return (
              <tr key={row.id || index}>
                {fields.map((field) => (
                  <td key={field}>
                    {typeof row[field] === "boolean"
                      ? row[field] ? "Yes" : "No"
                      : String(row[field] ?? "—")}
                  </td>
                ))}
                {canManage && (
                  <td>
                    {isFinal ? (
                      <span>{currentStatus}</span>
                    ) : (
                      <div className="projectActions">
                        <button
                          type="button"
                          className="primary smallAction"
                          onClick={() =>
                            onStatusChange(type, row.id, processedStatus)
                          }
                        >
                          {statusLabel}
                        </button>
                        <button
                          type="button"
                          className="secondary smallAction"
                          onClick={() =>
                            onStatusChange(type, row.id, "Rejected")
                          }
                        >
                          Reject
                        </button>
                      </div>
                    )}
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function List({ rows, fields }) {
  if (!rows || !rows.length) {
    return (
      <div className="card empty">
        No data available.
      </div>
    );
  }

  if (!fields.length) {
    return (
      <div className="card empty">
        Records found, but no display fields are available.
      </div>
    );
  }

  return (
    <div className="card tableWrap">
      <table>
        <thead>
          <tr>
            {fields.map((field) => (
              <th key={field}>
                {field.replaceAll("_", " ")}
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {rows.map((row, index) => (
            <tr key={row.id || index}>
              {fields.map((field) => (
                <td key={field}>
                  {field === "progress" && row[field] !== undefined && row[field] !== null
                    ? (
                      <div className="tableProgress">
                        <div className="tableProgressTop"><span>{Number(row[field] || 0)}%</span></div>
                        <div className="tableProgressTrack">
                          <div className="tableProgressFill" style={{ width: `${Math.max(0, Math.min(100, Number(row[field] || 0)))}%` }} />
                        </div>
                      </div>
                    )
                    : typeof row[field] === "boolean"
                      ? row[field]
                        ? "Yes"
                        : "No"
                      : String(row[field] ?? "—")}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Card({ n, t }) {
  return (
    <div className="card stat">
      <b>{n}</b>
      <span>{t}</span>
    </div>
  );
}

createRoot(
  document.getElementById("root")
).render(<App />);
