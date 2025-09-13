import React from "react";
import "./ThemeToggle.css";

const ThemeToggle = ({ isDarkMode, onToggle }) => {
  return (
    <div className="theme-toggle-container">
      <label className="theme-toggle" htmlFor="theme-toggle-checkbox">
        <input
          id="theme-toggle-checkbox"
          type="checkbox"
          checked={isDarkMode}
          onChange={onToggle}
        />
        <span className="slider"></span>
        <span className="icon sun">☀️</span>
        <span className="icon moon">🌙</span>
      </label>
    </div>
  );
};

export default ThemeToggle;
