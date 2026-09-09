import { useEffect, useState } from "react";
import * as I from "lucide-react";
import { api } from "../api";

function getNotificationPage(item) {
  const text = `${item?.title || ""} ${item?.body || ""}`.toLowerCase();

  if (/\b(chat|message|messaged|group chat|direct message|voice message|file message)\b/.test(text)) return "Chat";
  if (/\b(attendance|absent|late|check[- ]?in|check[- ]?out)\b/.test(text)) return "Attendance";
  if (/\b(leave|time off|vacation)\b/.test(text)) return "Leave Management";
  if (/\b(daily work|work completion)\b/.test(text)) return "Daily Work";
  if (/\b(task|tasks|deadline|deadlines|assigned|assignment)\b/.test(text)) return "Tasks";
  if (/\b(project|projects|project member)\b/.test(text)) return "Projects";
  if (/\b(announcement|announcements)\b/.test(text)) return "Announcements";
  if (/\b(overtime)\b/.test(text)) return "Overtime";
  if (/\b(salary|payroll)\b/.test(text)) return "Salary";
  if (/\b(profile|employee profile)\b/.test(text)) return "Profile";
  return null;
}

function NotificationPanel({ open, onClose, onUnreadChange, onNavigate }) {
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

  async function handleNotificationClick(item) {
    if (!item.read) {
      try {
        await api(`/api/notifications/${item.id}/read`, { method: "PUT" });
      } catch (_) {}
    }

    const targetPage = getNotificationPage(item);

    if (targetPage && onNavigate) {
      onNavigate(targetPage);
      onClose?.();
    } else {
      await load();
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
          <div>
            <h3>Notifications</h3>
            <small>{items.filter((x) => !x.read).length} unread</small>
          </div>
          <div className="notificationHeadActions">
            <button type="button" onClick={markAll}>Mark all read</button>
            <button type="button" className="notificationClose" onClick={onClose} aria-label="Close">
              <I.X size={18} />
            </button>
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
              onClick={() => handleNotificationClick(item)}
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

export default NotificationPanel;
