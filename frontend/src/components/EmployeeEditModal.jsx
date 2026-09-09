import { useEffect, useMemo, useState } from "react";
import { api } from "../api";
import { normalizeRole, hasPermission } from "../utils/navigation";

const LEVELS = ["L1","L2","L3","L4","L5","L6","L7","L8","L9","L10"];
const ROLES = ["CEO","ADMIN","HR","EMPLOYEE","INTERN"];
const TABS = ["Profile", "Employment", "Permissions", "Account"];

function allowedRoles(actorRole) {
  const role = normalizeRole(actorRole);
  if (role === "CEO") return ROLES;
  if (role === "ADMIN") return ["HR","EMPLOYEE","INTERN"];
  if (role === "HR") return ["HR","EMPLOYEE","INTERN"];
  return [];
}

function labelize(value) {
  return String(value || "")
    .split(".").pop().replaceAll("_", " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function EmployeeEditModal({ user, actorRole, permissions, onClose, onSaved }) {
  const actor = normalizeRole(actorRole);
  const canPermissions = hasPermission(permissions, "employees.manage_permissions");
  const canEditEmployee = hasPermission(permissions, "employees.edit");
  const canManageRoles = hasPermission(permissions, "employees.manage_roles");
  const canAccount = hasPermission(permissions, "account.manage");
  const roleOptions = allowedRoles(actor);
  const [tab, setTab] = useState("Profile");
  const [saving, setSaving] = useState(false);
  const [loadingPermissions, setLoadingPermissions] = useState(canPermissions);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(""), 4000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const [permissionRows, setPermissionRows] = useState([]);
  const [form, setForm] = useState({
    full_name: user.full_name || "",
    employee_id: user.employee_id || "",
    email: user.email || "",
    mobile: user.mobile || "",
    address: user.address || "",
    role: normalizeRole(user.role),
    employee_level: String(user.employee_level || "L1"),
    department: user.department || "",
    designation: user.designation || "",
    employment_type: user.employment_type || "permanent",
    company_id: user.company_id || "",
    joining_date: user.joining_date ? String(user.joining_date).slice(0,10) : "",
    end_date: user.end_date ? String(user.end_date).slice(0,10) : "",
    permanent: user.permanent !== false,
    assigned_mentor: user.assigned_mentor || "",
    must_change_password: Boolean(user.must_change_password),
  });

  useEffect(() => {
    let cancelled = false;
    if (!canPermissions) return undefined;
    setLoadingPermissions(true);
    api(`/api/users/${user.id}/permissions`)
      .then((data) => { if (!cancelled) setPermissionRows(data.permissions || []); })
      .catch((e) => { if (!cancelled) setError(e.message || "Unable to load permissions."); })
      .finally(() => { if (!cancelled) setLoadingPermissions(false); });
    return () => { cancelled = true; };
  }, [user.id, canPermissions]);

  const grouped = useMemo(() => permissionRows.reduce((acc, p) => {
  const key = p.module || "OTHER";
  (acc[key] ||= []).push(p);
  return acc;
}, {}), [permissionRows]);

  function setField(name, value) {
    setForm((prev) => ({ ...prev, [name]: value }));
    setError(""); setNotice("");
  }

  function setPermission(key, access) {
    setPermissionRows((prev) => prev.map((p) => p.permission_key === key ? { ...p, access, source: access === "DEFAULT" ? "ROLE" : "CUSTOM" } : p));
  }

  async function save() {
    setSaving(true); setError(""); setNotice("");
    try {
      const payload = { ...form, employee_id: undefined, reason: "Employee details updated" };
      const updated = await api(`/api/users/${user.id}`, { method: "PUT", body: payload });
      if (canPermissions) {
        await api(`/api/users/${user.id}/permissions`, {
          method: "PUT",
          body: {
            permissions: permissionRows.map((p) => ({ permission_key: p.permission_key, access: p.source === "CUSTOM" ? p.access : "DEFAULT" })),
            reason: "Employee permissions updated",
          },
        });
      }
      setNotice("Employee updated successfully.");
      onSaved?.(updated.user || updated);
      setTimeout(() => onClose(), 650);
    } catch (e) {
      setError(e.message || "Unable to save employee.");
    } finally { setSaving(false); }
  }

  return (
    <div className="portalModalBackdrop" onMouseDown={(e) => e.target === e.currentTarget && !saving && onClose()}>
      <div className="portalModal employeeEditModal" role="dialog" aria-modal="true">
        <div className="employeeEditHeader">
          <div>
            <h3>Edit Employee</h3>
            <p>{form.full_name || "Employee"} · {form.employee_id}</p>
          </div>
          <button type="button" className="iconButton" onClick={onClose} disabled={saving}>×</button>
        </div>

        <div className="employeeEditTabs">
          {TABS.filter((x) => (x !== "Permissions" || canPermissions) && (x !== "Account" || canAccount)).map((name) => (
            <button key={name} type="button" className={tab === name ? "active" : ""} onClick={() => setTab(name)}>{name}</button>
          ))}
        </div>

        {error && <div className="formMessage error">{error}</div>}
        {notice && <div className="formMessage success">{notice}</div>}

        <div className="employeeEditBody">
          {tab === "Profile" && (
            <div className="formGrid employeeEditGrid">
              <label>Full Name<input value={form.full_name} onChange={(e) => setField("full_name", e.target.value)} /></label>
              <label>Employee ID<input value={form.employee_id} disabled /></label>
              <label>Email<input type="email" value={form.email} onChange={(e) => setField("email", e.target.value)} /></label>
              <label>Mobile<input value={form.mobile} onChange={(e) => setField("mobile", e.target.value)} /></label>
              <label className="fullWidth">Address<textarea value={form.address} onChange={(e) => setField("address", e.target.value)} rows="3" /></label>
            </div>
          )}

          {tab === "Employment" && (
            <div className="formGrid employeeEditGrid">
              <label>Role<select disabled={!canManageRoles || saving} value={form.role} onChange={(e) => setField("role", e.target.value)}>{roleOptions.map((r) => <option key={r}>{r}</option>)}</select></label>
              <label>Employee Level<select value={form.employee_level} disabled={form.role === "INTERN"} onChange={(e) => setField("employee_level", e.target.value)}>{form.role === "INTERN" ? <option>Intern</option> : LEVELS.map((l) => <option key={l}>{l}</option>)}</select></label>
              <label>Department<input value={form.department} onChange={(e) => setField("department", e.target.value)} /></label>
              <label>Designation<input value={form.designation} onChange={(e) => setField("designation", e.target.value)} /></label>
              <label>Employment Type<input value={form.employment_type} onChange={(e) => setField("employment_type", e.target.value)} /></label>
              <label>Company ID<input value={form.company_id} onChange={(e) => setField("company_id", e.target.value)} /></label>
              <label>Joining Date<input type="date" value={form.joining_date} onChange={(e) => setField("joining_date", e.target.value)} /></label>
              <label>End Date<input type="date" value={form.end_date} onChange={(e) => setField("end_date", e.target.value)} /></label>
              <label>Assigned Mentor<input value={form.assigned_mentor} onChange={(e) => setField("assigned_mentor", e.target.value)} /></label>
              <label className="checkboxField"><input type="checkbox" checked={form.permanent} disabled={form.role === "INTERN"} onChange={(e) => setField("permanent", e.target.checked)} /> Permanent employee</label>
              <div className="promotionHint"><strong>Promotion:</strong> changing Employee Level records the old/new level, role, date and reason in the promotion history.</div>
            </div>
          )}

          {tab === "Permissions" && canPermissions && (
            <div>
              {loadingPermissions ? <div className="empty">Loading permissions...</div> : Object.keys(grouped).map((module) => (
                <section className="permissionSection" key={module}>
                  <h4>{module}</h4>
                  <div className="permissionList">
                    {grouped[module].map((p) => (
                      <div className="permissionRow" key={p.permission_key}>
                        <div><strong>{p.permission_name || labelize(p.permission_key)}</strong><small>{p.description}</small></div>
                        <select value={p.source === "CUSTOM" ? p.access : "DEFAULT"} onChange={(e) => setPermission(p.permission_key, e.target.value)}>
                          <option value="DEFAULT">Default</option><option value="ALLOW">Allow</option><option value="DENY">Deny</option>
                        </select>
                      </div>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}

          {tab === "Account" && canAccount && (
            <div className="accountEditPanel">
              <div className="accountStatusCard"><span>Status</span><strong>{user.blocked ? "Blocked" : String(user.employment_status || "Active")}</strong></div>
              <label className="checkboxField"><input type="checkbox" checked={form.must_change_password} disabled={actor === "HR"} onChange={(e) => setField("must_change_password", e.target.checked)} /> Require password change on next login</label>
              <p className="muted">Block/unblock and offboarding remain separate management actions.</p>
            </div>
          )}
        </div>

        <div className="modalActions">
          <button type="button" className="secondary" disabled={saving} onClick={onClose}>Cancel</button>
          <button type="button" className="primary" disabled={saving || loadingPermissions} onClick={save}>{saving ? "Saving..." : "Save Changes"}</button>
        </div>
      </div>
    </div>
  );
}
