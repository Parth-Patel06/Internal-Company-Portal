import React, { useEffect, useRef, useState } from "react";
import * as I from "lucide-react";
import { api, getToken, setToken, clearToken } from "../api";
import { normalizeRole, all } from "../utils/navigation";

import List from "./List";
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

export default ActivityLogs;
