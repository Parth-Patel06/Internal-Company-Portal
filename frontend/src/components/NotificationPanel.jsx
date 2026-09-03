import React, { useEffect, useRef, useState } from "react";
import * as I from "lucide-react";
import { api, getToken, setToken, clearToken } from "../api";
import { normalizeRole, all } from "../utils/navigation";

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

export default NotificationPanel;
