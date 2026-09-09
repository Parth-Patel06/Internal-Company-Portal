import React, { useEffect, useMemo, useState } from "react";
import { api, getToken, API_BASE } from "../api";
import { hasPermission } from "../utils/navigation";
function fmtDate(value) {
  if (!value) return "—";
  return new Date(value).toLocaleString();
}

function CodeManagement({ me, permissions = [] }) {
  const [repos, setRepos] = useState([]);
  const [projects, setProjects] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [selectedProjectId, setSelectedProjectId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [tab, setTab] = useState("files");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState({ type: "", text: "" });
  const [createOpen, setCreateOpen] = useState(false);
  const [repoForm, setRepoForm] = useState({ name: "", project_id: "", branch: "main" });
  const [file, setFile] = useState(null);
  const [filePath, setFilePath] = useState("");
  const [commitMessage, setCommitMessage] = useState("");
  const [mrForm, setMrForm] = useState({ title: "", description: "", source_branch: "", target_branch: "main" });
  const [deleteTarget, setDeleteTarget] = useState(null);

  const projectMap = useMemo(() => {
    const map = new Map();
    projects.forEach((project) => map.set(Number(project.id), project));
    return map;
  }, [projects]);

  const visibleRepos = useMemo(() => {
    if (!selectedProjectId) return repos;
    return repos.filter((repo) => Number(repo.project_id) === Number(selectedProjectId));
  }, [repos, selectedProjectId]);

  const selectedProject = selectedProjectId ? projectMap.get(Number(selectedProjectId)) : null;
  const isSelectedProjectLead = Boolean(selectedProject && Number(selectedProject.lead_id) === Number(me?.id));
  const canCreateRepo = isSelectedProjectLead && hasPermission(permissions, "code.create_repository");
  const canUpload = Boolean(detail?.canManage && hasPermission(permissions, "code.upload"));
  const canDownload = Boolean(detail?.canView && hasPermission(permissions, "code.download"));
  const canDeleteFiles = Boolean(detail?.canManage && hasPermission(permissions, "code.delete_files"));
  const canCreateMR = Boolean(detail?.canManage && hasPermission(permissions, "code.create_mr"));
  const canReviewMR = Boolean(detail?.canManage && hasPermission(permissions, "code.review_mr"));
  const canApproveMR = Boolean(detail?.canManage && hasPermission(permissions, "code.approve_mr"));
  const canMergeMR = Boolean(detail?.canManage && hasPermission(permissions, "code.merge"));

  const currentRepo = detail?.repository;


  async function loadRepos() {
    try {
      const [repoRows, projectRows] = await Promise.all([
        api("/api/repos"),
        api("/api/projects")
      ]);
      const nextRepos = Array.isArray(repoRows) ? repoRows : [];
      const nextProjects = Array.isArray(projectRows) ? projectRows : [];
      setRepos(nextRepos);
      setProjects(nextProjects);

      if (!selectedProjectId && nextProjects.length) {
        setSelectedProjectId(Number(nextProjects[0].id));
      }
      if (selectedProjectId && !nextProjects.some((p) => Number(p.id) === Number(selectedProjectId))) {
        setSelectedProjectId(nextProjects[0]?.id ? Number(nextProjects[0].id) : null);
      }
      if (selectedId && !nextRepos.some((r) => Number(r.id) === Number(selectedId))) {
        setSelectedId(null);
      }
    } catch (err) {
      setNotice({ type: "error", text: err.message || "Unable to load repositories." });
    }
  }

  async function loadDetail(id) {
    if (!id) {
      setDetail(null);
      return;
    }
    try {
      const result = await api(`/api/repos/${id}`);
      setDetail(result);
      setMrForm((v) => ({ ...v, target_branch: result.repository.branch || "main" }));
    } catch (err) {
      setNotice({ type: "error", text: err.message || "Unable to load repository." });
    }
  }

  useEffect(() => { loadRepos(); }, []);
  useEffect(() => {
    const projectRepos = visibleRepos;
    if (!projectRepos.length) {
      setSelectedId(null);
      return;
    }
    if (!selectedId || !projectRepos.some((repo) => Number(repo.id) === Number(selectedId))) {
      setSelectedId(projectRepos[0].id);
    }
  }, [selectedProjectId, repos]);
  useEffect(() => { loadDetail(selectedId); }, [selectedId]);



  async function createRepo(e) {
    e.preventDefault();
    setBusy(true);
    try {
      const result = await api("/api/repos", {
        method: "POST",
        body: {
          name: repoForm.name.trim(),
          project_id: Number(repoForm.project_id),
          branch: repoForm.branch.trim() || "main"
        }
      });
      setCreateOpen(false);
      setRepoForm({ name: "", project_id: "", branch: "main" });
      setSelectedId(result.id);
      setNotice({ type: "success", text: "Repository created." });
      await loadRepos();
    } catch (err) {
      setNotice({ type: "error", text: err.message || "Unable to create repository." });
    } finally {
      setBusy(false);
    }
  }

  async function uploadFile(e) {
    e.preventDefault();
    if (!file || !detail) return;
    setBusy(true);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("path", filePath.trim() || file.name);
      form.append("message", commitMessage.trim() || `Upload ${file.name}`);
      form.append("branch", detail.repository.branch || "main");

      await api(`/api/repos/${detail.repository.id}/files`, {
        method: "POST",
        body: form
      });

      setFile(null);
      setFilePath("");
      setCommitMessage("");
      e.target.reset();
      setNotice({ type: "success", text: "Code uploaded and a new version was created." });
      await loadRepos();
      await loadDetail(detail.repository.id);
    } catch (err) {
      setNotice({ type: "error", text: err.message || "Unable to upload code." });
    } finally {
      setBusy(false);
    }
  }

  async function createMergeRequest(e) {
    e.preventDefault();
    if (!detail) return;
    setBusy(true);
    try {
      await api(`/api/repos/${detail.repository.id}/merge-requests`, {
        method: "POST",
        body: mrForm
      });
      setMrForm((v) => ({ ...v, title: "", description: "", source_branch: "" }));
      setNotice({ type: "success", text: "Merge request created." });
      await loadDetail(detail.repository.id);
    } catch (err) {
      setNotice({ type: "error", text: err.message || "Unable to create merge request." });
    } finally {
      setBusy(false);
    }
  }

  async function updateMR(id, status) {
    if (!detail) return;
    setBusy(true);
    try {
      await api(`/api/repos/${detail.repository.id}/merge-requests/${id}`, {
        method: "PATCH",
        body: { status }
      });
      setNotice({ type: "success", text: `Merge request ${status.toLowerCase()}.` });
      await loadDetail(detail.repository.id);
    } catch (err) {
      setNotice({ type: "error", text: err.message || "Unable to update merge request." });
    } finally {
      setBusy(false);
    }
  }

  async function downloadFile(fileRow) {
    if (!detail) return;
    try {
      setBusy(true);
      const token = getToken();
      const base = API_BASE;
      const response = await fetch(
        `${base}/api/repos/${detail.repository.id}/files/${fileRow.id}/download`,
        {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        }
      );

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.message || `Download failed (${response.status})`);
      }

      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = fileRow.original_name || fileRow.path.split("/").pop() || "download";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(blobUrl);
    } catch (err) {
      setNotice({ type: "error", text: err.message || "Unable to download file." });
    } finally {
      setBusy(false);
    }
  }

  async function deleteFile() {
    if (!detail || !deleteTarget) return;
    setBusy(true);
    try {
      await api(`/api/repos/${detail.repository.id}/files/${deleteTarget.id}`, {
        method: "DELETE",
      });
      setDeleteTarget(null);
      setNotice({ type: "success", text: "File deleted." });
      await loadRepos();
      await loadDetail(detail.repository.id);
    } catch (err) {
      setNotice({ type: "error", text: err.message || "Unable to delete file." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="codeManagementPage">
      <div className="moduleTop">
        <div className="codeProjectPicker">
          <label className="codeProjectLabel" htmlFor="code-project-select">Projects</label>
          <div className="codeProjectSelectWrap">
            <select
              id="code-project-select"
              className="codeProjectSelect"
              value={selectedProjectId || ""}
              onChange={(e) => {
                setSelectedProjectId(e.target.value ? Number(e.target.value) : null);
                setSelectedId(null);
                setDetail(null);
              }}
            >
              <option value="">Select Project</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>{project.name}</option>
              ))}
            </select>
          </div>
          <p>{visibleRepos.length} repository/repositories in this project</p>
        </div>
        {canCreateRepo && (
          <button
            className="primary"
            onClick={() => {
              setRepoForm({ name: "", project_id: String(selectedProjectId || ""), branch: "main" });
              setCreateOpen(true);
            }}
          >+ New Repository</button>
        )}
      </div>

      {notice.text && <div className={`formMessage ${notice.type}`}>{notice.text}</div>}

      <div className="codeWorkspace">
        <section className="codeRepoList">
          <div className="codeSectionTitle">Repositories</div>
          {!selectedProjectId && <div className="codeEmpty">Select a project to view its repository.</div>}
          {selectedProjectId && visibleRepos.length === 0 && <div className="codeEmpty">No repository has been created for this project yet.</div>}
          {visibleRepos.map((repo) => (
            <button
              type="button"
              key={repo.id}
              className={`codeRepoItem ${Number(selectedId) === Number(repo.id) ? "active" : ""}`}
              onClick={() => setSelectedId(repo.id)}
            >
              <strong>{repo.name}</strong>
              <span>{repo.project_name || "Project"} · {repo.branch || "main"}</span>
            </button>
          ))}
        </section>

        <section className="codeRepoDetail">
          {!detail && <div className="codeEmpty large">Select a repository to start.</div>}

          {detail && (
            <>
              <div className="codeRepoHeader">
                <div>
                  <div className="eyebrow">CODE REPOSITORY</div>
                  <h2>{detail.repository.name}</h2>
                  <p>{detail.repository.project_name || "Project"} · {detail.repository.branch || "main"} · Updated {fmtDate(detail.repository.updated_at)}</p>
                </div>
                <span className="codeAccessBadge">{detail.canManage ? "Can manage" : "Read only"}</span>
              </div>

              <div className="codeTabs">
                {[
                  ["files", "Files"],
                  ["versions", `Versions (${detail.versions.length})`],
                  ["activity", `Activity (${detail.activity?.length || 0})`],
                  ["merge", `Merge Requests (${detail.mergeRequests.length})`]
                ].map(([key, label]) => (
                  <button type="button" key={key} className={tab === key ? "active" : ""} onClick={() => setTab(key)}>
                    {label}
                  </button>
                ))}
              </div>

              {tab === "files" && (
                <>
                  {canUpload && (
                    <form className="codeUploadBox" onSubmit={uploadFile}>
                      <div>
                        <strong>Push / upload code</strong>
                        <span>Create a new repository version from an uploaded file.</span>
                      </div>
                      <input type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} required />
                      <input value={filePath} onChange={(e) => setFilePath(e.target.value)} placeholder="Repository path (e.g. src/App.jsx)" />
                      <input value={commitMessage} onChange={(e) => setCommitMessage(e.target.value)} placeholder="Version message" />
                      <button className="primary" disabled={busy || !file}>Upload & Version</button>
                    </form>
                  )}

                  <div className="codeTableWrap">
                    <table className="codeTable">
                      <thead><tr><th>Path</th><th>Type</th><th>Size</th><th>Version</th><th>Uploaded By</th><th>Uploaded At</th><th></th></tr></thead>
                      <tbody>
                        {detail.files.length === 0 && <tr><td colSpan="7" className="codeTableEmpty">No files in this repository yet.</td></tr>}
                        {detail.files.map((f) => (
                          <tr key={f.id}>
                            <td><strong>{f.path}</strong></td>
                            <td>{f.mime_type || "file"}</td>
                            <td>{Math.ceil(Number(f.size || 0) / 1024)} KB</td>
                            <td>v{f.version_no || "—"}</td>
                            <td><strong>{f.uploaded_by_name || "Unknown"}</strong></td>
                            <td>{fmtDate(f.created_at)}</td>
                            <td>
                              <div className="codeFileActions">
                                {detail.canView && (
                                  <button type="button" className="secondary" onClick={() => downloadFile(f)} disabled={busy}>
                                    Download
                                  </button>
                                )}
                                {canUpload && (
                                  <button
                                    type="button"
                                    className="danger"
                                    onClick={() => setDeleteTarget(f)}
                                    disabled={busy}
                                  >
                                    Delete
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}

              {tab === "versions" && (
                <div className="codeVersionList">
                  {detail.versions.length === 0 && <div className="codeEmpty">No versions yet. Upload code to create the first version.</div>}
                  {detail.versions.map((v) => (
                    <div className="codeVersionItem" key={v.id}>
                      <div><strong>v{v.version_no}</strong><span>{v.message}</span></div>
                      <small>{v.created_by_name || "Unknown"} · {fmtDate(v.created_at)}</small>
                    </div>
                  ))}
                </div>
              )}

              {tab === "activity" && (
                <div className="codeActivityList">
                  {(!detail.activity || detail.activity.length === 0) && (
                    <div className="codeEmpty">No repository activity yet.</div>
                  )}
                  {detail.activity?.map((item) => {
                    const labels = {
                      REPOSITORY_CREATED: "created the repository",
                      FILE_UPLOADED: "uploaded a file",
                      FILE_DELETED: "deleted a file",
                      MERGE_REQUEST_CREATED: "created a merge request",
                      MERGE_REQUEST_STATUS_CHANGED: "changed a merge request status"
                    };
                    const details = item.details || {};
                    return (
                      <div className="codeActivityItem" key={item.id}>
                        <div className="codeActivityIcon">{item.action === "FILE_UPLOADED" ? "↑" : item.action === "FILE_DELETED" ? "×" : "•"}</div>
                        <div className="codeActivityContent">
                          <strong>{item.created_by_name || "Unknown user"}</strong>
                          <span>{labels[item.action] || item.action.replaceAll("_", " ").toLowerCase()}</span>
                          {item.target_name && <b>{item.target_name}</b>}
                          {item.action === "FILE_UPLOADED" && details.version_no && (
                            <small>Version v{details.version_no} · {details.message || "Upload"}</small>
                          )}
                          {item.action === "MERGE_REQUEST_STATUS_CHANGED" && details.status && (
                            <small>Status: {details.status}</small>
                          )}
                        </div>
                        <time>{fmtDate(item.created_at)}</time>
                      </div>
                    );
                  })}
                </div>
              )}

              {tab === "merge" && (
                <>
                  {canCreateMR && <form className="codeMRForm" onSubmit={createMergeRequest}>
                    <div className="codeSectionTitle">Raise merge request</div>
                    <input value={mrForm.title} onChange={(e) => setMrForm({ ...mrForm, title: e.target.value })} placeholder="Merge request title" required />
                    <textarea value={mrForm.description} onChange={(e) => setMrForm({ ...mrForm, description: e.target.value })} placeholder="Describe the change" rows="3" />
                    <div className="codeMRGrid">
                      <input value={mrForm.source_branch} onChange={(e) => setMrForm({ ...mrForm, source_branch: e.target.value })} placeholder="Source branch" required />
                      <input value={mrForm.target_branch} onChange={(e) => setMrForm({ ...mrForm, target_branch: e.target.value })} placeholder="Target branch" required />
                    </div>
                    <button className="primary" disabled={busy}>Create Merge Request</button>
                  </form>}

                  <div className="codeMRList">
                    {detail.mergeRequests.length === 0 && <div className="codeEmpty">No merge requests yet.</div>}
                    {detail.mergeRequests.map((mr) => (
                      <div className="codeMRItem" key={mr.id}>
                        <div className="codeMRTop">
                          <div><strong>#{mr.id} {mr.title}</strong><span>{mr.source_branch} → {mr.target_branch}</span></div>
                          <span className={`codeStatus ${String(mr.status).toLowerCase()}`}>{mr.status}</span>
                        </div>
                        {mr.description && <p>{mr.description}</p>}
                        <small>{mr.created_by_name || "Unknown"} · {fmtDate(mr.created_at)}</small>
                        {(canReviewMR || canApproveMR || canMergeMR) && mr.status === "OPEN" && (
                          <div className="codeMRActions">
                            {canApproveMR && <button type="button" className="secondary" onClick={() => updateMR(mr.id, "APPROVED")} disabled={busy}>Approve</button>}
                            {canReviewMR && <button type="button" className="secondary" onClick={() => updateMR(mr.id, "REJECTED")} disabled={busy}>Reject</button>}
                            {canMergeMR && <button type="button" className="primary" onClick={() => updateMR(mr.id, "MERGED")} disabled={busy}>Merge</button>}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </>
              )}
            </>
          )}
        </section>
      </div>

      {deleteTarget && (
        <div
          className="portalModalBackdrop"
          onMouseDown={(e) => e.target === e.currentTarget && !busy && setDeleteTarget(null)}
        >
          <div className="portalModal codeConfirmModal" role="dialog" aria-modal="true">
            <div className="portalModalHeader">
              <div>
                <div className="eyebrow">CODE MANAGEMENT</div>
                <h2>Delete File</h2>
              </div>
              <button
                type="button"
                className="modalClose"
                onClick={() => !busy && setDeleteTarget(null)}
                aria-label="Close"
              >
                ×
              </button>
            </div>

            <div className="portalModalBody codeConfirmBody">
              <p>Are you sure you want to delete this uploaded file?</p>
              <strong>{deleteTarget.path}</strong>
              <small>This removes the file from the repository. This action cannot be undone.</small>
            </div>

            <div className="portalModalFooter">
              <button
                type="button"
                className="secondary"
                onClick={() => setDeleteTarget(null)}
                disabled={busy}
              >
                Cancel
              </button>
              <button
                type="button"
                className="danger"
                onClick={deleteFile}
                disabled={busy}
              >
                {busy ? "Deleting..." : "Delete File"}
              </button>
            </div>
          </div>
        </div>
      )}

      {createOpen && (
        <div className="portalModalBackdrop" onMouseDown={(e) => e.target === e.currentTarget && setCreateOpen(false)}>
          <div className="portalModal codeCreateModal">
            <div className="portalModalHeader">
              <div><div className="eyebrow">CODE MANAGEMENT</div><h2>Create Repository</h2></div>
              <button type="button" className="modalClose" onClick={() => setCreateOpen(false)}>×</button>
            </div>
            <form className="portalModalBody codeCreateForm" onSubmit={createRepo}>
              <input value={repoForm.name} onChange={(e) => setRepoForm({ ...repoForm, name: e.target.value })} placeholder="Repository name" required />
              <select value={repoForm.project_id} disabled required>
                <option value="">Select project</option>
                {selectedProject && <option value={selectedProject.id}>{selectedProject.name}</option>}
              </select>
              <input value={repoForm.branch} onChange={(e) => setRepoForm({ ...repoForm, branch: e.target.value })} placeholder="Default branch" />
              <div className="portalModalFooter"><button type="button" className="secondary" onClick={() => setCreateOpen(false)}>Cancel</button><button className="primary" disabled={busy}>Create Repository</button></div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default CodeManagement;
