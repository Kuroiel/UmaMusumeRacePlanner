import React from "react";

const APTITUDE_RANKS = ["S", "A", "B", "C", "D", "E", "F", "G"];

const APTITUDE_GROUPS = {
  Surface: ["turf", "dirt"],
  Distance: ["sprint", "mile", "medium", "long"],
};

function AptitudeEditor({ aptitudes, onAptitudeChange }) {
  if (!aptitudes) return null;
  return (
    <div className="aptitude-editor">
      <h2>2. Edit Aptitudes</h2>
      {Object.entries(APTITUDE_GROUPS).map(([groupName, groupAptitudes]) => (
        <div key={groupName} className="aptitude-group">
          <h4>{groupName}</h4>
          <div className="aptitude-grid">
            {groupAptitudes.map((name) => (
              <div key={name} className="aptitude-item">
                <label>{name.charAt(0).toUpperCase() + name.slice(1)}</label>
                <select
                  value={aptitudes[name]}
                  onChange={(e) => onAptitudeChange(name, e.target.value)}
                >
                  {APTITUDE_RANKS.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export default AptitudeEditor;
