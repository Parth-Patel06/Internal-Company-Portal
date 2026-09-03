import React, { useEffect, useMemo, useState } from "react";
import { api } from "../api";

function formatDate(value) {
  if (!value) return "—";
  const d = new Date(`${String(value).slice(0, 10)}T00:00:00`);
  if (Number.isNaN(d.getTime())) return String(value).slice(0, 10);
  return d.toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
}

function levelClass(level) {
  return String(level || "L1").toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

export default function Profile({ me, refresh }) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ type: "", text: "" });
  const [overview, setOverview] = useState({ tasks: [], projects: [] });
  const [values, setValues] = useState({
    full_name: me?.full_name || "",
    mobile: me?.mobile || "",
    address: me?.address || "",
    photo_url: me?.photo_url || "",
  });

  useEffect(() => {
    setValues({
      full_name: me?.full_name || "",
      mobile: me?.mobile || "",
      address: me?.address || "",
      photo_url: me?.photo_url || "",
    });
  }, [me]);

  useEffect(() => {
    let active = true;
    api("/api/profile/overview")
      .then((data) => active && setOverview(data || { tasks: [], projects: [] }))
      .catch(() => active && setOverview({ tasks: [], projects: [] }));
    return () => { active = false; };
  }, [me?.id]);

  const initials = useMemo(() => {
    const name = String(me?.full_name || "User").trim();
    return name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "U";
  }, [me?.full_name]);

  async function handlePhoto(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setMessage({ type: "error", text: "Please select an image file." });
      return;
    }

    try {
      const dataUrl = await new Promise((resolve, reject) => {
        const image = new Image();
        const reader = new FileReader();
        reader.onload = () => { image.src = reader.result; };
        reader.onerror = reject;
        image.onload = () => {
          const max = 420;
          const scale = Math.min(1, max / Math.max(image.width, image.height));
          const canvas = document.createElement("canvas");
          canvas.width = Math.max(1, Math.round(image.width * scale));
          canvas.height = Math.max(1, Math.round(image.height * scale));
          canvas.getContext("2d").drawImage(image, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL("image/jpeg", 0.78));
        };
        image.onerror = reject;
        reader.readAsDataURL(file);
      });
      setValues((v) => ({ ...v, photo_url: dataUrl }));
      setMessage({ type: "success", text: "Photo selected. Save changes to apply it." });
    } catch {
      setMessage({ type: "error", text: "Unable to process that image." });
    }
  }

  async function saveProfile() {
    try {
      setSaving(true);
      setMessage({ type: "", text: "" });
      const result = await api("/api/profile", {
        method: "PUT",
        body: {
          full_name: values.full_name.trim(),
          mobile: values.mobile.trim(),
          address: values.address.trim(),
          photo_url: values.photo_url,
        },
      });
      setMessage({ type: "success", text: result.message || "Profile updated successfully." });
      setEditing(false);
      await refresh();
    } catch (error) {
      setMessage({ type: "error", text: error.message || "Unable to update profile." });
    } finally {
      setSaving(false);
    }
  }

  const statusText = me?.permanent
    ? "Permanent"
    : me?.end_date
      ? `Until ${formatDate(me.end_date)}`
      : "—";

  return (
    <div className="profilePage">
      {message.text && <div className={`formMessage ${message.type}`}>{message.text}</div>}

      <div className="profile card">
        <div className="profileHead">
          <div className={`profilePhotoWrap level-${levelClass(me?.employee_level)}`}>
            <div className="photo level profilePhoto">
              {values.photo_url ? <img src={values.photo_url} alt="Profile" /> : initials}
            </div>
            {editing && (
              <label className="photoUploadButton">
                Change photo
                <input type="file" accept="image/*" onChange={handlePhoto} />
              </label>
            )}
          </div>

          <div className="profileIdentity">
            <span className="profileLevelBadge">{me?.employee_level || "L1"}</span>
            <h2>{me?.full_name}</h2>
            <p>{me?.designation || "—"} · {me?.department || "—"}</p>
          </div>

          <button className="primary profileEditButton" onClick={() => { setEditing((v) => !v); setMessage({ type: "", text: "" }); }} disabled={saving}>
            {editing ? "Cancel Edit" : "Edit Profile"}
          </button>
        </div>

        {editing ? (
          <div className="profileEditForm">
            <label className="modalField"><span>Full Name *</span><input value={values.full_name} onChange={(e) => setValues((v) => ({ ...v, full_name: e.target.value }))} /></label>
            <label className="modalField"><span>Mobile Number</span><input value={values.mobile} onChange={(e) => setValues((v) => ({ ...v, mobile: e.target.value }))} /></label>
            <label className="modalField profileAddressField"><span>Address</span><textarea value={values.address} onChange={(e) => setValues((v) => ({ ...v, address: e.target.value }))} /></label>
            <div className="profileEditActions">
              <button type="button" className="secondary" onClick={() => setEditing(false)}>Cancel</button>
              <button className="primary" onClick={saveProfile} disabled={saving}>{saving ? "Saving..." : "Save Changes"}</button>
            </div>
          </div>
        ) : (
          <div className="detailGrid">
            {[
              ["Employee ID", me?.employee_id],
              ["Company ID", me?.company_id],
              ["Email", me?.email],
              ["Mobile", me?.mobile],
              ["Address", me?.address],
              ["Department", me?.department],
              ["Designation", me?.designation],
              ["Employee Level", me?.employee_level],
              ["Joining Date", formatDate(me?.joining_date)],
              ["Employment Status", statusText],
              ["Role", me?.role],
              ["Mentor", me?.assigned_mentor],
            ].map(([label, value]) => <div className="detail" key={label}><small>{label}</small><b>{value || "—"}</b></div>)}
          </div>
        )}
      </div>

      <div className="profileOverviewGrid">
        <section className="card profileDeadlineCard">
          <div className="sectionHeading"><div><span className="sectionKicker">WORK</span><h3>Assigned Deadlines</h3></div><span>{overview.tasks.length} tasks</span></div>
          {overview.tasks.length ? overview.tasks.map((task) => (
            <div className="deadlineRow" key={task.id}>
              <div><b>{task.title}</b><small>{task.project_name || "Unassigned project"}</small></div>
              <div className="deadlineDate"><strong>{formatDate(task.deadline)}</strong><small>{task.assignment_status || task.status || "Pending"}</small></div>
            </div>
          )) : <div className="emptyState">No assigned task deadlines yet.</div>}
        </section>

        <section className="card profileDeadlineCard">
          <div className="sectionHeading"><div><span className="sectionKicker">PROJECTS</span><h3>Assigned Projects</h3></div><span>{overview.projects.length} projects</span></div>
          {overview.projects.length ? overview.projects.map((project) => (
            <div className="deadlineRow" key={project.id}>
              <div><b>{project.name}</b><small>{project.status || "Planning"} · {project.progress ?? 0}% complete</small></div>
              <div className="deadlineDate"><strong>{project.deadline ? formatDate(project.deadline) : "No deadline"}</strong></div>
            </div>
          )) : <div className="emptyState">No assigned projects yet.</div>}
        </section>
      </div>
    </div>
  );
}
