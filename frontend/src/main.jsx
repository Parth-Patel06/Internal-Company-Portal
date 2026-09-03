import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import * as I from "lucide-react";
import { api, getToken, setToken, clearToken } from "./api";
import "./styles.css";

import Login from "./components/Login";
import ForcePasswordChange from "./components/ForcePasswordChange";
import GlobalSearch from "./components/GlobalSearch";
import NotificationPanel from "./components/NotificationPanel";
import ActivityLogs from "./components/ActivityLogs";
import PortalFormModal from "./components/PortalFormModal";
import ProjectCreateModal from "./components/ProjectCreateModal";
import DashboardTasks from "./components/DashboardTasks";
import ProjectEditModal from "./components/ProjectEditModal";
import ProjectsTable from "./components/ProjectsTable";
import CompanyCalendar from "./components/CompanyCalendar";
import CreateUser from "./components/CreateUser";
import ManagementActionTable from "./components/ManagementActionTable";
import List from "./components/List";
import Card from "./components/Card";
import Chat from "./components/Chat";
import { normalizeRole, buildSidebarGroups, all } from "./utils/navigation";
import triobyteLogo from "./Triobyte.jpeg";

function EmployeeManagement({ rows, reload, internsOnly, currentRole, currentUserId }) {
  const [selectedUser, setSelectedUser] = useState(null);
  const [offboardingOpen, setOffboardingOpen] = useState(false);
  const [cancelTarget, setCancelTarget] = useState(null);
  const [form, setForm] = useState({
    last_working_day: new Date().toISOString().slice(0, 10),
    reason: "",
    retention_days: 30,
  });
  const [message, setMessage] = useState({ type: "", text: "" });
  const [busy, setBusy] = useState(false);

  const role = normalizeRole(currentRole);
  const management = ["CEO", "ADMIN", "HR"].includes(role);

  function today() {
    return new Date().toISOString().slice(0, 10);
  }

  function openOffboarding(user) {
    setSelectedUser(user);
    setForm({
      last_working_day: today(),
      reason: "",
      retention_days: 30,
    });
    setMessage({ type: "", text: "" });
    setOffboardingOpen(true);
  }

  async function toggleBlock(user) {
    setMessage({ type: "", text: "" });
    try {
      const endpoint = user.blocked
        ? `/api/users/${user.id}/unblock`
        : `/api/users/${user.id}/block`;
      await api(endpoint, { method: "POST" });
      setMessage({
        type: "success",
        text: user.blocked ? "Account unblocked." : "Account blocked.",
      });
      reload();
    } catch (err) {
      setMessage({
        type: "error",
        text: err.message || "Unable to update account.",
      });
    }
  }

  async function startOffboarding() {
    if (!selectedUser) return;

    const reason = form.reason.trim();
    if (!form.last_working_day) {
      setMessage({ type: "error", text: "Last working day is required." });
      return;
    }
    if (!reason) {
      setMessage({ type: "error", text: "Reason for leaving is required." });
      return;
    }
    if (![30, 60, 90].includes(Number(form.retention_days))) {
      setMessage({ type: "error", text: "Retention period must be 30, 60, or 90 days." });
      return;
    }

    setBusy(true);
    setMessage({ type: "", text: "" });

    try {
      await api(`/api/users/${selectedUser.id}/offboarding/start`, {
        method: "POST",
        body: {
          last_working_day: form.last_working_day,
          reason,
          retention_days: Number(form.retention_days),
        },
      });

      setOffboardingOpen(false);
      setSelectedUser(null);
      setMessage({
        type: "success",
        text: "Offboarding started. Portal access and company email login are now disabled.",
      });
      reload();
    } catch (err) {
      setMessage({
        type: "error",
        text: err.message || "Unable to start offboarding.",
      });
    } finally {
      setBusy(false);
    }
  }

  async function cancelOffboarding() {
    if (!cancelTarget) return;

    setBusy(true);
    try {
      await api(`/api/users/${cancelTarget.id}/offboarding/cancel`, {
        method: "POST",
      });
      setCancelTarget(null);
      setMessage({
        type: "success",
        text: "Offboarding cancelled and the account was restored to Active.",
      });
      reload();
    } catch (err) {
      setMessage({
        type: "error",
        text: err.message || "Unable to cancel offboarding.",
      });
    } finally {
      setBusy(false);
    }
  }

  if (!management) {
    return (
      <div className="toolbar">
        <p>{internsOnly ? "Track intern details and restrictions." : "Manage company employees and create new accounts."}</p>
      </div>
    );
  }

  return (
    <>
      <div className="toolbar">
        <p>{internsOnly ? "Track intern details and restrictions." : "Manage company employees and create new accounts."}</p>
      </div>

      {message.text && (
        <div className={`formMessage ${message.type}`}>
          {message.text}
        </div>
      )}

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
          "blocked",
        ]}
        actorRole={role}
        actorId={currentUserId}
        onBlockToggle={toggleBlock}
        onOffboard={openOffboarding}
        onCancelOffboarding={setCancelTarget}
      />

      {offboardingOpen && selectedUser && (
        <div
          className="portalModalBackdrop"
          onClick={() => !busy && setOffboardingOpen(false)}
        >
          <div
            className="portalModal"
            onClick={(e) => e.stopPropagation()}
            style={{ width: "min(560px, calc(100vw - 32px))", maxWidth: 560 }}
          >
            <div style={{ padding: "22px 24px 18px", borderBottom: "1px solid var(--border)" }}>
              <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: ".16em", color: "#25466f", marginBottom: 7 }}>
                START OFFBOARDING
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "center" }}>
                <h2 style={{ margin: 0, color: "var(--text)" }}>{selectedUser.full_name}</h2>
                <button
                  type="button"
                  className="modalClose"
                  onClick={() => !busy && setOffboardingOpen(false)}
                  aria-label="Close"
                >
                  ×
                </button>
              </div>
            </div>

            <div style={{ padding: 24 }}>
              <div
                style={{
                  background: "#5a3f13",
                  color: "#f8dda0",
                  border: "1px solid #c58a19",
                  borderRadius: 12,
                  padding: "14px 16px",
                  fontWeight: 600,
                  lineHeight: 1.45,
                  marginBottom: 22,
                }}
              >
                ⚠ This will immediately block portal login and mark the company email login as disabled. It does not delete the mailbox.
              </div>

              <div className="detailGrid" style={{ margin: "0 0 20px" }}>
                {[
                  ["Full Name", selectedUser.full_name],
                  ["Employee ID", selectedUser.employee_id],
                  ["Role", selectedUser.role],
                  ["Department", selectedUser.department],
                  ["Company Email", selectedUser.email],
                ].map(([label, value]) => (
                  <div className="detail" key={label}>
                    <small>{label}</small>
                    <b>{value || "—"}</b>
                  </div>
                ))}
              </div>

              <label className="modalField">
                <span>Last Working Day *</span>
                <input
                  type="date"
                  min={today()}
                  value={form.last_working_day}
                  onChange={(e) => setForm((v) => ({ ...v, last_working_day: e.target.value }))}
                />
              </label>

              <label className="modalField">
                <span>Reason for Leaving *</span>
                <textarea
                  value={form.reason}
                  onChange={(e) => setForm((v) => ({ ...v, reason: e.target.value }))}
                  placeholder="Enter the reason for leaving"
                />
              </label>

              <label className="modalField">
                <span>Data Retention Period *</span>
                <select
                  value={form.retention_days}
                  onChange={(e) => setForm((v) => ({ ...v, retention_days: Number(e.target.value) }))}
                >
                  <option value={30}>30 days</option>
                  <option value={60}>60 days</option>
                  <option value={90}>90 days</option>
                </select>
              </label>

              <div className="warning" style={{ marginTop: 18 }}>
                System access will be disabled immediately. The company email will be deactivated, incoming mail will be forwarded to the fixed company address, and an automatic reply will be sent. Company work and audit history are preserved permanently for CEO, Admin and HR.
              </div>
            </div>

            <div className="modalActions">
              <button
                type="button"
                className="secondary"
                disabled={busy}
                onClick={() => setOffboardingOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="primary"
                disabled={busy}
                onClick={startOffboarding}
              >
                {busy ? "Starting..." : "Start Offboarding"}
              </button>
            </div>
          </div>
        </div>
      )}

      {cancelTarget && (
        <div
          className="portalModalBackdrop"
          onClick={() => !busy && setCancelTarget(null)}
        >
          <div className="portalModal" onClick={(e) => e.stopPropagation()}>
            <h3>Cancel Offboarding?</h3>
            <p>
              This requires confirmation. Cancelling will restore <b>{cancelTarget.full_name}</b> to Active and reactivate portal/email access.
            </p>
            <div className="modalActions">
              <button
                type="button"
                className="secondary"
                disabled={busy}
                onClick={() => setCancelTarget(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="primary"
                disabled={busy}
                onClick={cancelOffboarding}
              >
                {busy ? "Saving..." : "Confirm Cancellation"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
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
      const isSalary = type === "salary";
      const endpoint = isSalary ? `/api/salary/${id}/approval` : `/api/leave/${id}`;
      const body = isSalary
        ? { action: status }
        : { status };
      const result = await api(endpoint, { method: "PUT", body });
      setNotice({
        type: "success",
        message: result.message || "Updated successfully.",
      });
      refreshPage();
    } catch (err) {
      setNotice({ type: "error", message: err.message || "Unable to update the record." });
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

  if (page === "Chat") {
    return <Chat me={me} />;
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
      <EmployeeManagement
        rows={rows}
        currentRole={role}
        currentUserId={me.id}
        reload={refreshPage}
        internsOnly={page === "Intern Management"}
      />
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
            role={role}
          />
        ) : page === "Salary" ? (
          <ManagementActionTable
            rows={rows}
            fields={fields}
            type="salary"
            canManage={["CEO", "ADMIN", "HR"].includes(role)}
            onStatusChange={updateRecordStatus}
            role={role}
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

createRoot(
  document.getElementById("root")
).render(<App />);