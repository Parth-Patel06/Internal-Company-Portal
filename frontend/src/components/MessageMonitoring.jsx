import { useEffect, useState } from "react";
import * as I from "lucide-react";
import { api } from "../api";
import { normalizeRole, hasPermission } from "../utils/navigation";

function formatDateTime(value) {
  if (!value) return "—";
  return new Date(value).toLocaleString([], {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDateInput(value) {
  return value || "";
}

export default function MessageMonitoring({ me, permissions }) {
  const role = normalizeRole(me?.role);
  const allowed = hasPermission(permissions, "message_monitoring.view");
  const PAGE_SIZE = 50;
  const [rows, setRows] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [showDeleted, setShowDeleted] = useState(true);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ page: 1, page_size: PAGE_SIZE, total: 0, total_pages: 1 });
  const [stats, setStats] = useState({ total: 0, active: 0, deleted: 0 });

  async function loadMessages(nextPage = page) {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set("search", search.trim());
      if (employeeId) params.set("employee_id", employeeId);
      if (from) params.set("from", from);
      if (to) params.set("to", to);
      params.set("include_deleted", String(showDeleted));
      params.set("page", String(nextPage));
      params.set("limit", String(PAGE_SIZE));
      const result = await api(`/api/chat/monitoring?${params.toString()}`);
      setRows(Array.isArray(result?.rows) ? result.rows : []);
      setPagination(result?.pagination || { page: nextPage, page_size: PAGE_SIZE, total: 0, total_pages: 1 });
      setStats(result?.stats || { total: 0, active: 0, deleted: 0 });
      setPage(Number(result?.pagination?.page || nextPage));
    } catch (err) {
      setRows([]);
      setPagination({ page: nextPage, page_size: PAGE_SIZE, total: 0, total_pages: 1 });
      setStats({ total: 0, active: 0, deleted: 0 });
      setError(err.message || "Unable to load message monitoring.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!allowed) return;
    api("/api/users")
      .then((result) => setUsers(Array.isArray(result) ? result : []))
      .catch(() => setUsers([]));
  }, [allowed]);

  useEffect(() => {
    if (!allowed) return;
    loadMessages(1);
    // Filters intentionally trigger a fresh first page only when Apply is pressed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allowed, showDeleted]);

  const firstItem = pagination.total === 0 ? 0 : (pagination.page - 1) * pagination.page_size + 1;
  const lastItem = Math.min(pagination.page * pagination.page_size, pagination.total);

  if (!allowed) {
    return (
      <div className="monitoringDenied card">
        <I.ShieldAlert size={28} />
        <h2>Access restricted</h2>
        <p>Message Monitoring is available only to HR, Admin, and CEO.</p>
      </div>
    );
  }

  return (
    <div className="messageMonitoringPage">
      <div className="messageMonitoringIntro">
        <div><p>Review company chat history for safety and compliance.</p></div>
        <button className="primary monitoringRefresh" onClick={() => loadMessages(page)} disabled={loading}>
          <I.RefreshCw size={16} className={loading ? "monitoringSpin" : ""} /> Refresh
        </button>
      </div>

      <div className="monitoringStats">
        <div className="monitoringStat card"><span>Total messages</span><strong>{stats.total}</strong></div>
        <div className="monitoringStat card"><span>Active messages</span><strong>{stats.active}</strong></div>
        <div className="monitoringStat card"><span>Deleted messages</span><strong>{stats.deleted}</strong></div>
      </div>

      <section className="monitoringFilters card">
        <div className="monitoringFilterSearch">
          <I.Search size={17} />
          <input value={search} onChange={(event) => setSearch(event.target.value)} onKeyDown={(event) => event.key === "Enter" && loadMessages(1)} placeholder="Search message, employee, or conversation..." />
        </div>
        <select value={employeeId} onChange={(event) => setEmployeeId(event.target.value)}>
          <option value="">All employees</option>
          {users.map((user) => <option key={user.id} value={user.id}>{user.full_name} · {user.employee_id}</option>)}
        </select>
        <label className="monitoringDateField"><span>From</span><input type="date" value={from} onChange={(event) => setFrom(event.target.value)} /></label>
        <label className="monitoringDateField"><span>To</span><input type="date" value={to} onChange={(event) => setTo(event.target.value)} /></label>
        <button type="button" className="monitoringApplyButton" onClick={() => loadMessages(1)}><I.Filter size={16} /> Filter</button>
        <button type="button" className={`monitoringToggle ${showDeleted ? "active" : ""}`} onClick={() => setShowDeleted((value) => !value)} title={showDeleted ? "Hide deleted messages" : "Show deleted messages"}>
          {showDeleted ? <I.Eye size={16} /> : <I.EyeOff size={16} />}{showDeleted ? "Showing deleted" : "Hide deleted"}
        </button>
      </section>

      {error && <div className="formMessage error">{error}</div>}

      <section className="monitoringTableCard card">
        <div className="monitoringTableHeader">
          <div><h2>Chat history</h2><span>{loading ? "Loading messages..." : `${firstItem}–${lastItem} of ${pagination.total} message(s)`}</span></div>
          <span className="monitoringReadOnly"><I.LockKeyhole size={14} /> Read only</span>
        </div>
        <div className="monitoringTableWrap">
          <table className="monitoringTable">
            <thead><tr><th>Time</th><th>Conversation</th><th>Sender</th><th>Recipient</th><th>Message</th><th>Type</th><th>Status</th><th>Read</th></tr></thead>
            <tbody>
              {rows.map((row) => {
                const isGroup = row.conversation_type === "group";
                const groupTotal = Number(row.group_recipient_count || 0);
                const groupRead = Math.min(Number(row.group_read_count || 0), groupTotal);
                return (
                  <tr key={row.id} className={row.deleted_at ? "isDeleted" : ""}>
                    <td className="monitoringTime">{formatDateTime(row.created_at)}</td>
                    <td><strong>{row.conversation_name || "Direct chat"}</strong><small>{isGroup ? "Group" : "Direct"}</small></td>
                    <td><strong>{row.sender_name || "Unknown"}</strong><small>{row.sender_employee_id || "—"}</small></td>
                    <td><strong>{row.receiver_name || (isGroup ? "Group members" : "—")}</strong><small>{row.receiver_employee_id || "—"}</small></td>
                    <td className="monitoringBody">{row.body || "—"}</td>
                    <td><span className="monitoringType">{row.message_type || "text"}</span></td>
                    <td>{row.deleted_at ? <span className="monitoringStatus deleted">Deleted</span> : <span className="monitoringStatus active">Active</span>}{row.deleted_at && <small>by {row.deleted_by_name || "Admin"}</small>}</td>
                    <td>{isGroup ? <span className="monitoringReadCount">{groupTotal ? `${groupRead}/${groupTotal}` : "—"}</span> : (row.read_at ? formatDateTime(row.read_at) : "—")}</td>
                  </tr>
                );
              })}
              {!loading && rows.length === 0 && <tr><td colSpan="8" className="monitoringEmpty">No messages match the selected filters.</td></tr>}
            </tbody>
          </table>
        </div>
        {pagination.total_pages > 1 && (
          <div className="monitoringPagination">
            <span>Page {pagination.page} of {pagination.total_pages}</span>
            <div className="monitoringPaginationButtons">
              <button type="button" disabled={loading || pagination.page <= 1} onClick={() => loadMessages(pagination.page - 1)}><I.ChevronLeft size={15} /> Previous</button>
              <button type="button" disabled={loading || pagination.page >= pagination.total_pages} onClick={() => loadMessages(pagination.page + 1)}>Next <I.ChevronRight size={15} /></button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
