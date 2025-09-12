// src/Checklist.js
import React from "react";

function Checklist({
  races,
  checklistData,
  onChecklistDataChange,
  setPage,
  onResetStatus,
  onClearNotes,
}) {
  const handleStatusChange = (raceId, statusType, value) =>
    onChecklistDataChange(raceId, statusType, value);
  const handleNotesChange = (raceId, newNotes) =>
    onChecklistDataChange(raceId, "notes", newNotes);

  return (
    <div className="checklist-page">
      <div className="checklist-page-header">
        <button className="back-button" onClick={() => setPage("planner")}>
          &larr; Back to Planner
        </button>
        <h2>Active Checklist</h2>
        {/* --- NEW: Action Buttons --- */}
        <div className="checklist-page-actions">
          <button className="action-button" onClick={onResetStatus}>
            Reset Ran/Won Status
          </button>
          <button className="action-button clear-button" onClick={onClearNotes}>
            Clear All Notes
          </button>
        </div>
      </div>
      <div className="checklist-container">
        {races.map((race) => {
          const data = checklistData[race.id] || {
            ran: false,
            won: false,
            notes: "",
          };
          return (
            <div key={race.id} className="checklist-item">
              <div className="checklist-item-info">
                <h3>{race.name}</h3>
                <span>
                  {race.date} | {gradeNameMap[race.grade] || race.grade} |{" "}
                  {race.ground} {race.distance}m
                </span>
              </div>
              <div className="checklist-item-actions">
                <div className="checklist-item-controls">
                  <label>
                    <input
                      type="checkbox"
                      checked={data.ran}
                      onChange={(e) =>
                        handleStatusChange(race.id, "ran", e.target.checked)
                      }
                    />{" "}
                    Ran
                  </label>
                  <label>
                    <input
                      type="checkbox"
                      checked={data.won}
                      onChange={(e) =>
                        handleStatusChange(race.id, "won", e.target.checked)
                      }
                    />{" "}
                    Won
                  </label>
                </div>
                <textarea
                  placeholder="Notes..."
                  value={data.notes}
                  onChange={(e) => handleNotesChange(race.id, e.target.value)}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const gradeNameMap = { "1 Win Class": "Pre-OP", Open: "OP" };
export default Checklist;
