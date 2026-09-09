import React from "react";
import { Menu, X } from "lucide-react";

/**
 * Responsive navigation controls only.
 * Page navigation and business logic stay in main.jsx.
 */
export default function ResponsiveLayout({ mobileOpen, onToggle, onClose }) {
  return (
    <>
      <button
        type="button"
        className={`responsiveHamburger ${mobileOpen ? "open" : ""}`}
        onClick={onToggle}
        aria-label={mobileOpen ? "Close navigation" : "Open navigation"}
        aria-expanded={mobileOpen}
        title={mobileOpen ? "Close navigation" : "Open navigation"}
      >
        {mobileOpen ? <X size={20} strokeWidth={2} /> : <Menu size={20} strokeWidth={2} />}
      </button>

      {mobileOpen && (
        <button
          type="button"
          className="responsiveSidebarOverlay"
          onPointerDown={onClose}
          onTouchStart={onClose}
          aria-label="Close navigation"
        />
      )}
    </>
  );
}
