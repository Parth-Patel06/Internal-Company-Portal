import { useEffect, useMemo, useState } from "react";
import { api } from "../api";
import "./Profile.css";

function formatDate(value) {
  if (!value) return "—";
  const d = new Date(`${String(value).slice(0, 10)}T00:00:00`);
  if (Number.isNaN(d.getTime())) return String(value).slice(0, 10);
  return d.toLocaleDateString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function levelClass(level) {
  return String(level || "L1")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-");
}

function display(value) {
  return value || "—";
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

  async function loadOverview() {
    try {
      const data = await api("/api/profile/overview");
      setOverview({
        tasks: Array.isArray(data?.tasks) ? data.tasks : [],
        projects: Array.isArray(data?.projects) ? data.projects : [],
      });
    } catch (error) {
      console.error("PROFILE OVERVIEW ERROR:", error);
      setOverview({ tasks: [], projects: [] });
    }
  }

  useEffect(() => {
    loadOverview();
  }, [me?.id]);

  const initials = useMemo(() => {
    const name = String(me?.full_name || "User").trim();
    return (
      name
        .split(/\s+/)
        .slice(0, 2)
        .map((part) => part[0])
        .join("")
        .toUpperCase() || "U"
    );
  }, [me?.full_name]);

  const statusText = me?.permanent
    ? "Permanent"
    : me?.end_date
      ? `Until ${formatDate(me.end_date)}`
      : "—";

  async function handlePhoto(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setMessage({ type: "error", text: "Please select an image file." });
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      setMessage({
        type: "error",
        text: "Profile photo must be 2 MB or smaller.",
      });
      return;
    }

    try {
      const dataUrl = await new Promise((resolve, reject) => {
        const image = new Image();
        const reader = new FileReader();

        reader.onload = () => {
          image.src = reader.result;
        };
        reader.onerror = reject;

        image.onload = () => {
          const max = 420;
          const scale = Math.min(
            1,
            max / Math.max(image.width, image.height)
          );

          const canvas = document.createElement("canvas");
          canvas.width = Math.max(1, Math.round(image.width * scale));
          canvas.height = Math.max(1, Math.round(image.height * scale));

          const ctx = canvas.getContext("2d");
          if (!ctx) {
            reject(new Error("Unable to process image."));
            return;
          }

          ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL("image/jpeg", 0.78));
        };

        image.onerror = reject;
        reader.readAsDataURL(file);
      });

      setValues((current) => ({ ...current, photo_url: dataUrl }));
      setMessage({
        type: "success",
        text: "Photo selected. Save changes to apply it.",
      });
    } catch {
      setMessage({
        type: "error",
        text: "Unable to process that image.",
      });
    }
  }

  function cancelEdit() {
    setEditing(false);
    setValues({
      full_name: me?.full_name || "",
      mobile: me?.mobile || "",
      address: me?.address || "",
      photo_url: me?.photo_url || "",
    });
    setMessage({ type: "", text: "" });
  }

  async function saveProfile() {
    if (!values.full_name.trim()) {
      setMessage({ type: "error", text: "Full Name is required." });
      return;
    }

    try {
      setSaving(true);
      setMessage({ type: "", text: "" });

      const result = await api("/api/profile", {
        method: "PUT",
        body: {
          full_name: values.full_name.trim(),
          mobile: values.mobile.trim(),
          address: values.address.trim(),
          photo_url: values.photo_url || null,
        },
      });

      setMessage({
        type: "success",
        text: result.message || "Profile updated successfully.",
      });

      setEditing(false);
      await refresh();
      await loadOverview();
    } catch (error) {
      setMessage({
        type: "error",
        text: error.message || "Unable to update profile.",
      });
    } finally {
      setSaving(false);
    }
  }

  const profileImage = editing ? values.photo_url : me?.photo_url;

  return (
    <div className="profilePage profileRedesign">
      <div className="profilePageIntro">
        <div>
          <span className="profilePageKicker">TRIOBYTE PORTAL</span>
          <h1>Profile</h1>
          <p>Manage your personal information and view your work details.</p>
        </div>
        {!editing && (
          <button
            type="button"
            className="primary profileHeroEdit"
            onClick={() => {
              setMessage({ type: "", text: "" });
              setEditing(true);
            }}
          >
            Edit Profile
          </button>
        )}
      </div>

      {message.text && (
        <div
          className={`profileFormMessage ${message.type}`}
          role={message.type === "error" ? "alert" : "status"}
        >
          <span className="profileMessageIcon">
            {message.type === "error" ? "!" : "✓"}
          </span>
          <span>{message.text}</span>
        </div>
      )}

      <section className="profileHeroCard">
        <div className="profileHeroAccent" />

        <div className="profileHeroContent">
          <div className="profileAvatarColumn">
            <div className={`profileAvatar profileAvatar-${levelClass(me?.employee_level)}`}>
              {profileImage ? (
                <img src={profileImage} alt="Profile" />
              ) : (
                initials
              )}
            </div>

            {editing && (
              <label className="profilePhotoButton">
                <span>Change photo</span>
                <input type="file" accept="image/*" onChange={handlePhoto} />
              </label>
            )}
          </div>

          <div className="profileHeroIdentity">
            <div className="profileIdentityTop">
              <span className="profileLevelBadge">
                {me?.employee_level || "L1"}
              </span>
              <span className="profileStatusBadge">
                <i />
                {me?.employment_status || "Active"}
              </span>
            </div>

            <h2>{display(me?.full_name)}</h2>
            <p>
              {display(me?.designation)}
              <span>•</span>
              {display(me?.department)}
            </p>

            <div className="profileHeroMeta">
              <span>
                <b>Employee ID</b>
                {display(me?.employee_id)}
              </span>
              <span>
                <b>Joined</b>
                {formatDate(me?.joining_date)}
              </span>
            </div>
          </div>
        </div>
      </section>

      {editing ? (
        <section className="profileCard profileEditCard">
          <div className="profileSectionHeader">
            <div>
              <span className="profileSectionKicker">PERSONAL</span>
              <h3>Edit personal information</h3>
              <p>Update the details that are allowed to be changed.</p>
            </div>
          </div>

          <div className="profileEditGrid">
            <label className="profileField">
              <span>Full Name <em>*</em></span>
              <input
                value={values.full_name}
                onChange={(e) =>
                  setValues((v) => ({ ...v, full_name: e.target.value }))
                }
                placeholder="Enter your full name"
                autoComplete="name"
              />
            </label>

            <label className="profileField">
              <span>Mobile Number</span>
              <input
                value={values.mobile}
                onChange={(e) =>
                  setValues((v) => ({ ...v, mobile: e.target.value }))
                }
                placeholder="Enter mobile number"
                autoComplete="tel"
              />
            </label>

            <label className="profileField profileFieldFull">
              <span>Address</span>
              <textarea
                value={values.address}
                onChange={(e) =>
                  setValues((v) => ({ ...v, address: e.target.value }))
                }
                placeholder="Enter your address"
                rows={4}
              />
            </label>
          </div>

          <div className="profileReadonlyNotice">
            <span>i</span>
            <p>
              Company-controlled information such as employee ID, department,
              designation, role and joining date cannot be edited here.
            </p>
          </div>

          <div className="profileEditActions">
            <button
              type="button"
              className="secondary"
              onClick={cancelEdit}
              disabled={saving}
            >
              Cancel
            </button>
            <button
              type="button"
              className="primary"
              onClick={saveProfile}
              disabled={saving || !values.full_name.trim()}
            >
              {saving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </section>
      ) : (
        <section className="profileCard">
          <div className="profileSectionHeader">
            <div>
              <span className="profileSectionKicker">PROFILE DETAILS</span>
              <h3>Personal & employment information</h3>
            </div>
          </div>

          <div className="profileDetailsGrid">
            {[
              ["Employee ID", me?.employee_id, "identity"],
              ["Company ID", me?.company_id, "identity"],
              ["Email", me?.email, "contact"],
              ["Mobile Number", me?.mobile, "contact"],
              ["Address", me?.address, "contact", true],
              ["Department", me?.department, "work"],
              ["Designation", me?.designation, "work"],
              ["Employee Level", me?.employee_level, "work"],
              ["Joining Date", formatDate(me?.joining_date), "work"],
              ["Employment Status", statusText, "work"],
              ["Role", me?.role, "work"],
              ["Mentor", me?.assigned_mentor, "work"],
            ].map(([label, value, group, full]) => (
              <div
                className={`profileDetailItem ${full ? "profileDetailFull" : ""}`}
                key={label}
              >
                <span className={`profileDetailIcon profileIcon-${group}`}>
                  {group === "identity" ? "ID" : group === "contact" ? "@" : "•"}
                </span>
                <div>
                  <small>{label}</small>
                  <strong>{display(value)}</strong>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="profileOverviewGrid">
        <section className="profileCard profileOverviewCard">
          <div className="profileSectionHeader profileOverviewHeader">
            <div>
              <span className="profileSectionKicker">WORK</span>
              <h3>Assigned Deadlines</h3>
            </div>
            <span className="profileCountBadge">
              {overview.tasks.length} {overview.tasks.length === 1 ? "task" : "tasks"}
            </span>
          </div>

          <div className="profileOverviewList">
            {overview.tasks.length ? (
              overview.tasks.map((task) => (
                <div className="profileOverviewRow" key={task.id}>
                  <div className="profileOverviewMain">
                    <span className="profileOverviewDot" />
                    <div>
                      <strong>{display(task.title)}</strong>
                      <small>
                        {task.project_name || "Unassigned project"}
                      </small>
                    </div>
                  </div>
                  <div className="profileDeadline">
                    <strong>
                      {task.deadline ? formatDate(task.deadline) : "No deadline"}
                    </strong>
                    <small>
                      {task.assignment_status || task.status || "Pending"}
                    </small>
                  </div>
                </div>
              ))
            ) : (
              <div className="profileEmptyState">
                <span>✓</span>
                <div>
                  <strong>No assigned deadlines</strong>
                  <small>You currently have no task deadlines to display.</small>
                </div>
              </div>
            )}
          </div>
        </section>

        <section className="profileCard profileOverviewCard">
          <div className="profileSectionHeader profileOverviewHeader">
            <div>
              <span className="profileSectionKicker">PROJECTS</span>
              <h3>Assigned Projects</h3>
            </div>
            <span className="profileCountBadge">
              {overview.projects.length}{" "}
              {overview.projects.length === 1 ? "project" : "projects"}
            </span>
          </div>

          <div className="profileOverviewList">
            {overview.projects.length ? (
              overview.projects.map((project) => (
                <div className="profileOverviewRow" key={project.id}>
                  <div className="profileOverviewMain">
                    <span className="profileProjectMark">
                      {(project.name || "P").slice(0, 1).toUpperCase()}
                    </span>
                    <div>
                      <strong>{display(project.name)}</strong>
                      <small>
                        {project.status || "Planning"} ·{" "}
                        {project.progress ?? 0}% complete
                      </small>
                    </div>
                  </div>
                  <div className="profileDeadline">
                    <strong>
                      {project.deadline
                        ? formatDate(project.deadline)
                        : "No deadline"}
                    </strong>
                    <small>Deadline</small>
                  </div>
                </div>
              ))
            ) : (
              <div className="profileEmptyState">
                <span>—</span>
                <div>
                  <strong>No assigned projects</strong>
                  <small>You currently have no projects to display.</small>
                </div>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
