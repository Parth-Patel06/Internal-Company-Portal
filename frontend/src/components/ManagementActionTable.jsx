import React, { useEffect, useRef, useState } from "react";
import * as I from "lucide-react";
import { api, getToken, setToken, clearToken } from "../api";
import { normalizeRole, all } from "../utils/navigation";

function ManagementActionTable({ rows, fields, type, canManage, onStatusChange, role }) {
  if (!rows || !rows.length) return <div className="card empty">No data available.</div>;

  if (type === "salary") {
    return (
      <div className="salaryList">
        {rows.map((row, index) => {
          const targetRole = String(row.employee_role || "").toUpperCase();
          const managementSalary = ["ADMIN", "HR"].includes(targetRole);
          const status = String(row.status || "Pending Review");
          const canReview = canManage && !managementSalary && ["Pending Review", "Reviewed"].includes(status) && ["CEO", "ADMIN", "HR"].includes(String(role || "").toUpperCase());
          const canApprove = canManage && ["Pending Review", "Reviewed"].includes(status) && (managementSalary ? String(role || "").toUpperCase() === "CEO" : ["CEO", "ADMIN", "HR"].includes(String(role || "").toUpperCase()));
          const canSendBack = canApprove || canReview;
          return (
            <div className="card salaryCard" key={row.id || index}>
              <div className="salaryCardHead">
                <div><h3>{row.full_name || "Employee"}</h3><small>{row.employee_id || "—"} · {row.department || "—"} · {row.designation || "—"}</small></div>
                <span className={`statusBadge ${status.toLowerCase().replaceAll(" ", "-")}`}>{status}</span>
              </div>
              <div className="salaryGrid">
                {[["Salary Month",row.month],["Basic Salary",row.basic_salary],["HRA",row.hra],["Allowances",row.allowances],["Overtime",row.overtime_pay], ["Gross Salary",row.gross_salary],["Deductions",row.deductions],["Net Salary",row.net_salary]].map(([label,value]) => (
                  <div className="salaryMetric" key={label}><span>{label}</span><b>{label === "Salary Month" ? String(value ?? "—") : `₹${Number(value || 0).toLocaleString("en-IN", {minimumFractionDigits:2, maximumFractionDigits:2})}`}</b></div>
                ))}
              </div>
              <div className="salaryAudit">
                <span>Reviewed by: {row.reviewed_by_name || "—"}</span><span>Reviewed: {row.reviewed_at ? new Date(row.reviewed_at).toLocaleString() : "—"}</span>
                <span>Approved by: {row.approved_by_name || "—"}</span><span>Approved: {row.approved_at ? new Date(row.approved_at).toLocaleString() : "—"}</span>
                <span>Processed by: {row.processed_by_name || "—"}</span><span>Processed: {row.processed_at ? new Date(row.processed_at).toLocaleString() : "—"}</span>
              </div>
              {canManage && (canReview || canApprove) && (
                <div className="projectActions salaryActions">
                  {canReview && <button className="primary smallAction" onClick={() => onStatusChange("salary", row.id, "review")}>Mark Reviewed</button>}
                  {canApprove && <button className="primary smallAction" onClick={() => onStatusChange("salary", row.id, "approve")}>{managementSalary ? "CEO Approve & Process" : "Approve & Process"}</button>}
                  {canSendBack && <button className="secondary smallAction" onClick={() => onStatusChange("salary", row.id, "send_back")}>Send Back</button>}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  }

  const processedStatus = "Approved";
  return (
    <div className="card tableWrap"><table><thead><tr>{fields.map((field)=><th key={field}>{field.replaceAll("_"," ")}</th>)}{canManage&&<th>Actions</th>}</tr></thead>
      <tbody>{rows.map((row,index)=>{const currentStatus=String(row.status||"").trim(); const isFinal=["Approved","Rejected"].includes(currentStatus); return <tr key={row.id||index}>{fields.map((field)=><td key={field}>{typeof row[field]==="boolean"?(row[field]?"Yes":"No"):String(row[field]??"—")}</td>)}{canManage&&<td>{isFinal?<span>{currentStatus}</span>:<div className="projectActions"><button type="button" className="primary smallAction" onClick={()=>onStatusChange(type,row.id,processedStatus)}>Approve</button><button type="button" className="secondary smallAction" onClick={()=>onStatusChange(type,row.id,"Rejected")}>Reject</button></div>}</td>}</tr>})}</tbody></table></div>
  );
}

export default ManagementActionTable;
