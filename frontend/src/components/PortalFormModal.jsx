import React, { useEffect, useRef, useState } from "react";
import * as I from "lucide-react";
import { api, getToken, setToken, clearToken } from "../api";
import { normalizeRole, all } from "../utils/navigation";

function PortalFormModal({ title, fields, values, setValues, onClose, onSubmit, submitting }) {
  return (
    <div className="portalModalBackdrop" role="presentation">
      <div className="portalModal" role="dialog" aria-modal="true">
        <div className="portalModalHeader"><h2>{title}</h2><button type="button" className="modalClose" onClick={onClose} aria-label="Close">×</button></div>
        <div className="portalModalBody">
          {fields.map((field) => (
            <label key={field.name} className="modalField"><span>{field.label}</span>
              {field.type === "textarea" ? <textarea value={values[field.name] || ""} placeholder={field.placeholder || ""} onChange={(e) => setValues((p) => ({ ...p, [field.name]: e.target.value }))} /> : <input type={field.type || "text"} value={values[field.name] || ""} placeholder={field.placeholder || ""} onChange={(e) => setValues((p) => ({ ...p, [field.name]: e.target.value }))} />}
            </label>
          ))}
        </div>
        <div className="portalModalActions"><button type="button" className="secondary" onClick={onClose} disabled={submitting}>Cancel</button><button type="button" className="primary" onClick={onSubmit} disabled={submitting}>{submitting ? "Saving..." : "Save"}</button></div>
      </div>
    </div>
  );
}

export default PortalFormModal;
