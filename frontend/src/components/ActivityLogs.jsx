import { useEffect, useState } from "react";
import { api } from "../api";

import List from "./List";
function ActivityLogs() {
  const [rows, setRows] = useState([]);
  const [message, setMessage] = useState("");

  useEffect(() => {
    api("/api/activity")
      .then((result) => {
        const data = Array.isArray(result) ? result : [];
        // Always show currently active sessions first, then newest logged-out sessions.
        data.sort((a, b) => {
          const aActive = a.logout_at == null;
          const bActive = b.logout_at == null;
          if (aActive !== bActive) return aActive ? -1 : 1;

          const aTime = new Date(a.login_at).getTime();
          const bTime = new Date(b.login_at).getTime();
          return bTime - aTime;
        });
        setRows(data);
      })
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

export default ActivityLogs;
