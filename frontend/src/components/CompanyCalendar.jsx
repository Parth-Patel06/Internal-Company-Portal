import React, { useEffect, useRef, useState } from "react";
import * as I from "lucide-react";
import { api, getToken, setToken, clearToken } from "../api";
import { normalizeRole, all } from "../utils/navigation";

function CompanyCalendar({ me }) {
  const [viewDate, setViewDate] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  const dateKey = (value) => {
    if (!value) return null;
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return null;
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  };

  const normalizeRows = (rows, type, titleField, dateFields) =>
    (Array.isArray(rows) ? rows : []).flatMap((row) => {
      const rawDate = dateFields.map((field) => row[field]).find(Boolean);
      const date = dateKey(rawDate);
      if (!date) return [];
      return [{
        id: `${type}-${row.id ?? Math.random()}`,
        type,
        date,
        title: row[titleField] || row.title || row.name || type,
        description: row.description || row.content || row.reason || row.status || "",
      }];
    });

  useEffect(() => {
    let active = true;
    setLoading(true);
    Promise.allSettled([
      api("/api/attendance"),
      api("/api/daily-work"),
      api("/api/leave"),
      api("/api/projects"),
      api("/api/announcements"),
    ]).then((results) => {
      if (!active) return;
      const values = results.map((result) => result.status === "fulfilled" ? result.value : []);
      const next = [
        ...normalizeRows(values[0], "attendance", "status", ["work_date", "date", "created_at"]),
        ...normalizeRows(values[1], "work", "content", ["work_date", "date", "created_at"]),
        ...normalizeRows(values[2], "leave", "leave_type", ["start_date", "from_date", "date"]),
        ...normalizeRows(values[3], "project", "name", ["deadline", "due_date", "date"]),
        ...normalizeRows(values[4], "announcement", "title", ["created_at", "date"]),
      ];
      setEvents(next);
      setLoading(false);
    });
    return () => { active = false; };
  }, []);

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const first = new Date(year, month, 1);
  const start = new Date(year, month, 1 - first.getDay());
  const today = new Date();
  const cells = Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return date;
  });

  const sameDay = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  const keyFor = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  const eventsFor = (date) => events.filter((event) => event.date === keyFor(date));
  const selectedEvents = eventsFor(selectedDate);
  const monthLabel = viewDate.toLocaleDateString(undefined, { month: "long", year: "numeric" });
  const selectedLabel = selectedDate.toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "long", day: "numeric" });
  const subtitle = ["EMPLOYEE", "INTERN"].includes(normalizeRole(me.role)) ? "Your activity, attendance and deadlines" : "Company activity, attendance, work and deadlines";
  const icons = { login: I.LogIn, attendance: I.CalendarCheck, work: I.ClipboardList, leave: I.Umbrella, project: I.FolderKanban, announcement: I.Megaphone };

  return (
    <div className="companyCalendarWrap">
      <div className="card companyCalendar">
        <div className="calendarHeader">
          <div><div className="calendarTitle">{monthLabel}</div><div className="calendarSubtitle">{subtitle}</div></div>
          <div className="calendarControls">
            <button type="button" onClick={() => setViewDate(new Date(year, month - 1, 1))} aria-label="Previous month"><I.ChevronLeft size={18} /></button>
            <button type="button" className="todayControl" onClick={() => { const d = new Date(); setViewDate(d); setSelectedDate(d); }}>Today</button>
            <button type="button" onClick={() => setViewDate(new Date(year, month + 1, 1))} aria-label="Next month"><I.ChevronRight size={18} /></button>
          </div>
        </div>
        <div className="calendarLegend">{[["attendance","Attendance"],["work","Work log"],["leave","Leave"],["project","Project deadline"],["announcement","Announcement"]].map(([type,label]) => <span key={type}><i className={`legendDot ${type}`} />{label}</span>)}</div>
        {loading && <div className="calendarLoading">Loading calendar activity…</div>}
        <div className="companyCalendarGrid">
          {["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map((day) => <div className="calendarDayName" key={day}>{day}</div>)}
          {cells.map((date) => {
            const dayEvents = eventsFor(date);
            const preview = dayEvents.slice(0, 3);
            const classes = ["companyCalendarDate", date.getMonth() !== month ? "otherMonth" : "", sameDay(date, today) ? "today" : "", sameDay(date, selectedDate) ? "selectedDate" : ""].filter(Boolean).join(" ");
            return <button type="button" key={date.toISOString()} className={classes} onClick={() => setSelectedDate(date)} title={`${date.toLocaleDateString(undefined,{weekday:"long",month:"long",day:"numeric",year:"numeric"})}${dayEvents.length ? ` — ${dayEvents.map((e)=>e.title).join(", ")}` : " — No recorded activity"}`}><strong className="dateNumber">{date.getDate()}</strong><div className="calendarEventList">{preview.map((event) => <span key={event.id} className={`calendarEvent ${event.type}`}>{event.title}</span>)}{dayEvents.length > 3 && <span className="moreEvents">+{dayEvents.length - 3} more</span>}</div></button>;
          })}
        </div>
      </div>
      <div className="card calendarDetails">
        <div className="calendarDetailsHead"><div><div className="eyebrow">SELECTED DAY</div><h2>{selectedLabel}</h2></div><span>{selectedEvents.length} activity item{selectedEvents.length === 1 ? "" : "s"}</span></div>
        {selectedEvents.length ? <div className="activityTimeline">{selectedEvents.map((event) => { const Icon = icons[event.type] || I.CalendarDays; return <div className={`activityItem ${event.type}`} key={event.id}><div className="activityIcon"><Icon size={18} /></div><div className="activityBody"><b>{event.title}</b>{event.description && <p>{event.description}</p>}</div></div>; })}</div> : <div className="calendarEmpty">No recorded activity for this day.</div>}
      </div>
    </div>
  );
}

export default CompanyCalendar;
