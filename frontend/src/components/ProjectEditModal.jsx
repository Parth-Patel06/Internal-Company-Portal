import React, { useEffect, useRef, useState } from "react";
import * as I from "lucide-react";
import { api, getToken, setToken, clearToken } from "../api";
import { normalizeRole, all } from "../utils/navigation";

function ProjectEditModal({ project, me, onClose, onSaved }) {
  const role=normalizeRole(me.role), management=["CEO","ADMIN","HR"].includes(role);
  const [users,setUsers]=useState([]), [members,setMembers]=useState([]), [saving,setSaving]=useState(false), [loading,setLoading]=useState(true), [error,setError]=useState("");
  const [form,setForm]=useState({name:project.name||"",description:project.description||"",lead_id:project.lead_id?String(project.lead_id):"",member_ids:[],start_date:project.start_date?String(project.start_date).slice(0,10):"",deadline:project.deadline?String(project.deadline).slice(0,10):"",status:project.status||"Planning",priority:project.priority||"Medium"});

  useEffect(()=>{let active=true; Promise.all([api(`/api/projects/${project.id}`),management?api("/api/users"):Promise.resolve([])]).then(([d,u])=>{if(!active)return; const m=Array.isArray(d.members)?d.members:[]; setMembers(m); setUsers(Array.isArray(u)?u:m); setForm(p=>({...p,member_ids:m.map(x=>Number(x.id))}));}).catch(e=>active&&setError(e.message||"Unable to load project details.")).finally(()=>active&&setLoading(false)); return()=>{active=false};},[project.id,management]);

  const setField=(k,v)=>setForm(p=>({...p,[k]:v}));
  const toggleMember=(id)=>setForm(p=>({...p,member_ids:p.member_ids.includes(Number(id))?p.member_ids.filter(x=>x!==Number(id)):[...p.member_ids,Number(id)]}));

  async function save(){
    if(management&&!form.name.trim()){setError("Project name is required.");return;}
    if(form.start_date&&form.deadline&&form.deadline<form.start_date){setError("Deadline cannot be before the start date.");return;}
    try{setSaving(true);setError("");const body={description:form.description.trim(),start_date:form.start_date||null,deadline:form.deadline||null,status:form.status,priority:form.priority};if(management)Object.assign(body,{name:form.name.trim(),lead_id:form.lead_id?Number(form.lead_id):null,member_ids:form.member_ids});await api(`/api/projects/${project.id}`,{method:"PUT",body});onSaved();}catch(e){setError(e.message||"Unable to update project.");}finally{setSaving(false);}
  }

  return <div className="portalModalBackdrop"><div className="portalModal projectCreateModal projectEditModal">
    <div className="portalModalHeader"><h2>Edit Project</h2><button type="button" className="modalClose" onClick={onClose} disabled={saving}>×</button></div>
    <div className="portalModalBody">
      {error&&<div className="formMessage error">{error}</div>}
      <label className="modalField"><span>Project Name *</span><input value={form.name} disabled={!management||loading} onChange={e=>setField("name",e.target.value)}/></label>
      <label className="modalField"><span>Description</span><textarea value={form.description} disabled={loading} onChange={e=>setField("description",e.target.value)}/></label>
      <div className="projectFormGrid">
        {management?<label className="modalField"><span>Project Lead</span><select value={form.lead_id} disabled={loading} onChange={e=>setField("lead_id",e.target.value)}><option value="">Select project lead</option>{users.map(u=><option key={u.id} value={u.id}>{u.full_name} ({u.employee_id||u.role})</option>)}</select></label>:<label className="modalField"><span>Project Lead</span><input value={project.lead_name||"—"} disabled/></label>}
        <label className="modalField"><span>Current Phase</span><select value={form.status} disabled={loading} onChange={e=>setField("status",e.target.value)}><option>Planning</option><option>Active</option><option>Review</option><option>Completed</option><option>On Hold</option><option>Cancelled</option></select></label>
        <label className="modalField"><span>Start Date</span><input type="date" value={form.start_date} disabled={loading} onChange={e=>setField("start_date",e.target.value)}/></label>
        <label className="modalField"><span>Deadline</span><input type="date" value={form.deadline} disabled={loading} onChange={e=>setField("deadline",e.target.value)}/></label>
        <label className="modalField"><span>Priority</span><select value={form.priority} disabled={loading} onChange={e=>setField("priority",e.target.value)}><option>Low</option><option>Medium</option><option>High</option><option>Critical</option></select></label>
      </div>
      <div className="projectMembers"><div className="projectMembersHead"><div><span>Project Members</span><small>{form.member_ids.length} selected</small></div></div>
      <div className="memberChecklist">{(management?users:members).map(u=>management?<label className="memberCheck" key={u.id}><input type="checkbox" checked={form.member_ids.includes(Number(u.id))} disabled={loading} onChange={()=>toggleMember(u.id)}/><span><b>{u.full_name}</b><small>{u.employee_id||"—"} · {u.role}</small></span></label>:<div className="memberCheck readOnlyMember" key={u.id}><span><b>{u.full_name}</b><small>{u.employee_id||"—"} · {u.role}</small></span></div>)}</div></div>
    </div>
    <div className="portalModalActions"><button type="button" className="secondary" onClick={onClose} disabled={saving}>Cancel</button><button type="button" className="primary" onClick={save} disabled={saving||loading}>{saving?"Saving...":"Save Changes"}</button></div>
  </div></div>;
}

export default ProjectEditModal;
