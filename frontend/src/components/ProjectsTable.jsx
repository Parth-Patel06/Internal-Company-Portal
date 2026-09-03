import React, { useEffect, useRef, useState } from "react";
import * as I from "lucide-react";
import { api, getToken, setToken, clearToken } from "../api";
import { normalizeRole, all } from "../utils/navigation";

function ProjectsTable({ rows, me, onEdit, onNextPhase, movingId }) {
  const role=normalizeRole(me.role), management=["CEO","ADMIN","HR"].includes(role);
  const fields=["name","description","lead_name","member_count","start_date","deadline","status","priority"];
  if(!rows.length)return <div className="card empty">No data available.</div>;
  return <div className="card tableWrap"><table className="projectsTable"><thead><tr>{fields.map(f=><th key={f}>{f.replaceAll("_"," ")}</th>)}<th>Progress</th><th>Actions</th></tr></thead><tbody>{rows.map(p=>{const progress=Math.max(0,Math.min(100,Number(p.progress||0)));const canEdit=management||Number(p.lead_id)===Number(me.id);const final=p.status==="Completed";return <tr key={p.id}>{fields.map(f=><td key={f}>{String(p[f]??"—")}</td>)}<td><div className="tableProgress"><div className="tableProgressTop"><span>{progress}%</span></div><div className="tableProgressTrack"><div className="tableProgressFill" style={{width:`${progress}%`}}/></div></div></td><td><div className="projectActions">{canEdit&&<button type="button" className="secondary smallAction" onClick={()=>onEdit(p)}>Edit</button>}{!final&&<button type="button" className="primary smallAction" disabled={progress<100||movingId===p.id} onClick={()=>onNextPhase(p)}>{movingId===p.id?"Moving...":"Next Phase"}</button>}{progress===100&&!final&&<small className="phaseReady">Ready</small>}{final&&<small className="phaseComplete">Final phase</small>}</div></td></tr>})}</tbody></table></div>;
}

export default ProjectsTable;
