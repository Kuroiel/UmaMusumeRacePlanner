import React from "react";

const CollapsibleHeader = ({ title, isOpen, onToggle, children }) => (
  <h2 onClick={onToggle} className="collapsible-header">
    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
      {title}
      {children}
    </div>
    <span>{isOpen ? "▼" : "►"}</span>
  </h2>
);

export default CollapsibleHeader;
