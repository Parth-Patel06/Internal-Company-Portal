import { useState } from "react";
import { normalizeRole, hasPermission } from "../utils/navigation";
import EmployeeEditModal from "./EmployeeEditModal";
import { formatCompanyDate, formatCompanyDateTime, formatCompanyTime } from "../utils/dateTime";

function canBlockTarget(actorRole, actorId, row) {
  const actor = normalizeRole(actorRole);
  const target = normalizeRole(row.role);

  if (!["CEO", "ADMIN", "HR"].includes(actor)) return false;
  if (target === "CEO") return false;
  if (actorId != null && Number(actorId) === Number(row.id)) return false;

  return true;
}

function canOffboardTarget(actorRole, actorId, row) {
  const actor = normalizeRole(actorRole);
  const target = normalizeRole(row.role);

  if (!["CEO", "ADMIN", "HR"].includes(actor)) return false;
  if (target === "CEO") return false;
  if (actorId != null && Number(actorId) === Number(row.id)) return false;

  if (actor === "CEO") return true;
  if (actor === "ADMIN") return ["HR", "EMPLOYEE", "INTERN"].includes(target);
  if (actor === "HR") return ["EMPLOYEE", "INTERN"].includes(target);

  return false;
}

function canEditRoleTarget(actorRole, actorId, row) {
  const actor = normalizeRole(actorRole);
  const target = normalizeRole(row.role);

  if (!["CEO", "ADMIN", "HR"].includes(actor)) return false;
  if (target === "CEO") return false;
  if (actorId != null && Number(actorId) === Number(row.id)) return false;

  if (actor === "CEO") return true;
  if (actor === "ADMIN") return ["HR", "EMPLOYEE", "INTERN"].includes(target);
  if (actor === "HR") return ["EMPLOYEE", "INTERN"].includes(target);

  return false;
}

function getAllowedRoles(actorRole) {
  const actor = normalizeRole(actorRole);
  if (actor === "CEO") return ["ADMIN", "HR", "EMPLOYEE", "INTERN"];
  if (actor === "ADMIN") return ["HR", "EMPLOYEE", "INTERN"];
  if (actor === "HR") return ["EMPLOYEE", "INTERN"];
  return [];
}

function getEmploymentStatus(row) {
  const status = String(row.employment_status || "ACTIVE").trim().toUpperCase();
  if (status === "OFFBOARDING") return "OFFBOARDING";
  if (status === "EXITED") return "EXITED";
  return "ACTIVE";
}

function StatusBadge({ row }) {
  const status = getEmploymentStatus(row);

  if (status === "OFFBOARDING") {
    return <span className="statusBadge" style={{ background: "#fff4d6", color: "#8a5a00" }}>Offboarding</span>;
  }

  if (status === "EXITED") {
    return <span className="statusBadge" style={{ background: "#fee2e2", color: "#b42318" }}>Exited</span>;
  }

  if (row.blocked) {
    return <span className="statusBadge" style={{ background: "#fee2e2", color: "#b42318" }}>Blocked</span>;
  }

  return <span className="statusBadge" style={{ background: "#dcfce7", color: "#15803d" }}>Active</span>;
}

function List({
  rows,
  fields,
  actorRole,
  actorId,
  onBlockToggle,
  onOffboard,
  onCancelOffboarding,
  onEmployeeUpdated,
  permissions,
}) {
  const [pendingBlock, setPendingBlock] = useState(null);
  const [busy, setBusy] = useState(false);
  const [roleEditor, setRoleEditor] = useState(null);

  const actor = normalizeRole(actorRole);
  const managementRole = ["CEO", "ADMIN", "HR"].includes(actor);
  const canEditEmployee = hasPermission(permissions, "employees.edit");
  const canBlockEmployee = hasPermission(permissions, "employees.block");
  const canOffboardEmployee = hasPermission(permissions, "offboarding.manage");

  if (!rows || rows.length === 0) {
    return <div className="card empty">No data available.</div>;
  }

  if (!fields || fields.length === 0) {
    return <div className="card empty">Records found, but no display fields are available.</div>;
  }

  return (
    <>
      <div className="card tableWrap">
        <table>
          <thead>
            <tr>
              {fields.map((field) => (
                <th key={field}>{field.replaceAll("_", " ")}</th>
              ))}
              {managementRole && <th>Actions</th>}
            </tr>
          </thead>

          <tbody>
            {rows.map((row, index) => {
              const targetRole = normalizeRole(row.role);
              const isCEO = targetRole === "CEO";
              const status = getEmploymentStatus(row);
              const isOffboarding = status === "OFFBOARDING";
              const isExited = status === "EXITED";
              const blockAllowed = canBlockEmployee && canBlockTarget(actor, actorId, row);
              const manageAllowed = canOffboardEmployee && canOffboardTarget(actor, actorId, row);
              const roleEditAllowed = canEditEmployee && canEditRoleTarget(actor, actorId, row);

              return (
                <tr key={row.id || index}>
                  {fields.map((field) => (
                    <td key={field}>
                      {field === "blocked" ? (
                        <StatusBadge row={row} />
                      ) : field === "employment_status" ? (
                        <StatusBadge row={row} />
                      ) : typeof row[field] === "boolean" ? (
                        row[field] ? "Yes" : "No"
                      ) : ["login_at", "logout_at", "created_at", "updated_at", "reviewed_at", "approved_at", "processed_at"].includes(field) ? (
                        formatCompanyDateTime(row[field])
                      ) : ["check_in", "check_out"].includes(field) ? (
                        formatCompanyTime(row[field])
                      ) : ["work_date", "from_date", "to_date", "start_date", "end_date", "deadline", "due_date", "date"].includes(field) ? (
                        formatCompanyDate(row[field])
                      ) : (
                        String(row[field] ?? "—")
                      )}
                    </td>
                  ))}

                  {managementRole && (
                    <td>
                      {isCEO ? (
                        <span className="muted">Protected</span>
                      ) : isExited ? (
                        <span className="muted">Exited</span>
                      ) : isOffboarding ? (
                        <div className="listActions" style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                          <span className="muted">Offboarding</span>
                          {canOffboardEmployee && onCancelOffboarding && (
                            <button
                              type="button"
                              className="secondary smallAction"
                              disabled={busy}
                              onClick={() => onCancelOffboarding(row)}
                            >
                              Cancel Offboarding
                            </button>
                          )}
                        </div>
                      ) : (
                        <div className="listActions" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                          {manageAllowed && onOffboard && (
                            <button
                              type="button"
                              className="secondary smallAction"
                              onClick={() => onOffboard(row)}
                            >
                              Manage
                            </button>
                          )}

                          {roleEditAllowed && (
                            <button
                              type="button"
                              className="secondary smallAction"
                              onClick={() => setRoleEditor(row)}
                            >
                              Edit
                            </button>
                          )}

                          {blockAllowed && onBlockToggle && (
                            <button
                              type="button"
                              className={row.blocked ? "secondary smallAction" : "primary smallAction"}
                              onClick={() => setPendingBlock(row)}
                            >
                              {row.blocked ? "Unblock" : "Block"}
                            </button>
                          )}
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


      {roleEditor && (
        <EmployeeEditModal
          user={roleEditor}
          actorRole={actor}
          permissions={permissions}
          onClose={() => setRoleEditor(null)}
          onSaved={() => {
            setRoleEditor(null);
            onEmployeeUpdated?.();
          }}
        />
      )}

      {pendingBlock && (
        <div
          className="portalModalBackdrop"
          onClick={() => !busy && setPendingBlock(null)}
        >
          <div className="portalModal" onClick={(e) => e.stopPropagation()}>
            <h3>{pendingBlock.blocked ? "Unblock account?" : "Block account?"}</h3>
            <p>
              {pendingBlock.blocked
                ? `Unblock ${pendingBlock.full_name || "this user"}? They will be able to sign in again.`
                : `Block ${pendingBlock.full_name || "this user"}? They will no longer be able to sign in.`}
            </p>

            <div className="modalActions">
              <button
                type="button"
                className="secondary"
                disabled={busy}
                onClick={() => setPendingBlock(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className={pendingBlock.blocked ? "primary" : "danger"}
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  try {
                    await onBlockToggle?.(pendingBlock);
                    setPendingBlock(null);
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                {busy ? "Saving..." : pendingBlock.blocked ? "Unblock" : "Block"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default List;
