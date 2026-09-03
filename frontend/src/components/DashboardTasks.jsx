import React, { useEffect, useRef, useState } from "react";
import * as I from "lucide-react";
import { api, getToken, setToken, clearToken } from "../api";
import { normalizeRole, all } from "../utils/navigation";

function DashboardTasks({ dashboard, me, onRefresh }) {
  const role = normalizeRole(me.role);
  const management = ["CEO", "ADMIN", "HR"].includes(role);
  const [projects, setProjects] = useState([]);
  const [members, setMembers] = useState([]);
  const [selectedProject, setSelectedProject] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [message, setMessage] = useState({ type: "", text: "" });
  const [saving, setSaving] = useState(false);
  
  useEffect(() => {
    if (message.type !== "success" || !message.text) return;
    const timer = window.setTimeout(() => {
      setMessage({ type: "", text: "" });
    }, 3000);
    return () => window.clearTimeout(timer);
  }, [message.type, message.text]);

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

export default DashboardTasks;
