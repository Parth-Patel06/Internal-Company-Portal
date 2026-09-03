import React, { useEffect, useRef, useState } from "react";
import * as I from "lucide-react";
import { api, getToken, setToken, clearToken } from "../api";
import { normalizeRole, all } from "../utils/navigation";

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

export default ProjectCreateModal;
