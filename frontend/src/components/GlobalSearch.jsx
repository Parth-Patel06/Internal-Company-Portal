import React, { useEffect, useRef, useState } from "react";
import * as I from "lucide-react";
import { api, getToken, setToken, clearToken } from "../api";
import { normalizeRole, all } from "../utils/navigation";

function GlobalSearch({ open, onClose, onSelect }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const inputRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setResults([]);
    setMessage("");
    const timer = setTimeout(() => inputRef.current?.focus(), 50);
    return () => clearTimeout(timer);
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const term = query.trim();

    if (term.length < 2) {
      setResults([]);
      setLoading(false);
      setMessage(term ? "Type at least 2 characters to search." : "");
      return;
    }

    let active = true;
    const timer = setTimeout(async () => {
      try {
        setLoading(true);
        setMessage("");
        const data = await api(`/api/search?q=${encodeURIComponent(term)}`);
        if (!active) return;
        const next = Array.isArray(data.results) ? data.results : [];
        setResults(next);
        if (!next.length) setMessage("No matching records found.");
      } catch (err) {
        if (!active) return;
        setResults([]);
        setMessage(err.message || "Search is unavailable right now.");
      } finally {
        if (active) setLoading(false);
      }
    }, 250);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [query, open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="globalSearchBackdrop" onMouseDown={onClose}>
      <div
        className="globalSearchPanel"
        role="dialog"
        aria-modal="true"
        aria-label="Global search"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="globalSearchInputWrap">
          <I.Search size={20} />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search employees, projects, tasks, announcements..."
            aria-label="Search the portal"
          />
          <button type="button" onClick={onClose} aria-label="Close search">
            <I.X size={19} />
          </button>
        </div>

        <div className="globalSearchMeta">
          {loading
            ? "Searching..."
            : query.trim().length >= 2
              ? `${results.length} result(s)`
              : "Search across the portal"}
        </div>

        <div className="globalSearchResults">
          {results.map((result) => {
            const Icon =
              result.type === "Employee" ? I.User :
              result.type === "Project" ? I.FolderKanban :
              result.type === "Task" ? I.ListChecks :
              I.Megaphone;

            return (
              <button
                type="button"
                className="globalSearchResult"
                key={result.id}
                onClick={() => onSelect(result)}
              >
                <span className="globalSearchResultIcon"><Icon size={18} /></span>
                <span className="globalSearchResultText">
                  <b>{result.title}</b>
                  {result.subtitle && <small>{result.subtitle}</small>}
                </span>
                <span className="globalSearchType">{result.type}</span>
              </button>
            );
          })}

          {!loading && !results.length && (
            <div className="globalSearchEmpty">
              {message || "Start typing to search."}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default GlobalSearch;
