import React from "react";

const gradeNameMap = { "1 Win Class": "Pre-OP", Open: "OP" };
const getDistanceCategory = (distance) => {
  if (distance < 1600) return "sprint";
  if (distance <= 1800) return "mile";
  if (distance <= 2400) return "medium";
  return "long";
};

const formatChecklistDate = (dateString) => {
  const parts = dateString.split(" - ");
  if (parts.length !== 3) return dateString;

  const [yearPart, monthPart, halfPart] = parts;

  let formattedYear = yearPart;
  if (yearPart === "Year 1") formattedYear = "Junior Year";
  else if (yearPart === "Year 2") formattedYear = "Classic Year";
  else if (yearPart === "Year 3") formattedYear = "Senior Year";

  return `${formattedYear} - ${halfPart} ${monthPart}`;
};

function Checklist({
  races,
  checklistData,
  onChecklistDataChange,
  setPage,
  onResetStatus,
  onClearNotes,
  warningRaceIds,
  gradeCounts,
  wonCount,
  currentChecklistName,
}) {
  return (
    <div className="checklist-page">
      <div className="checklist-page-header">
        <button className="back-button" onClick={() => setPage("planner")}>
          &larr; Back to Planner
        </button>
        <div style={{ textAlign: "center", gridColumn: 2 }}>
          <h2>Active Checklist</h2>
          {currentChecklistName && (
            <h4 className="current-checklist-name">({currentChecklistName})</h4>
          )}
        </div>
        <div className="checklist-page-actions">
          <button className="action-button" onClick={onResetStatus}>
            Reset Ran/Won Status
          </button>
          <button className="action-button clear-button" onClick={onClearNotes}>
            Clear All Notes
          </button>
        </div>
      </div>

      {races.length > 0 && (
        <div className="grade-counter checklist-page-counter">
          <span className="counter-label">Total selected:</span>
          <span>G1: {gradeCounts.G1}</span>
          <span>G2: {gradeCounts.G2}</span>
          <span>G3: {gradeCounts.G3}</span>
          <span className="counter-label">Won:</span>
          <span>
            {wonCount} / {races.length}
          </span>
        </div>
      )}

      <div className="checklist-container">
        {races.map((race) => {
          const data = checklistData[race.id] || {
            ran: false,
            won: false,
            notes: "",
          };
          const isWarning = warningRaceIds.has(race.id);
          const itemClass = `checklist-item ${
            isWarning ? "warning-race-row" : ""
          }`;
          return (
            <div key={race.id} className={itemClass}>
              <div className="checklist-item-info">
                <h3>
                  {race.name}

                  {isWarning && (
                    <div className="tooltip-container">
                      <span className="warning-icon">!</span>
                      <span className="tooltip-text checklist-tooltip">
                        Warning: 3+ consecutive races might cause skin condition
                        and mood down.
                      </span>
                    </div>
                  )}
                </h3>

                <span>
                  {formatChecklistDate(race.date)} |{" "}
                  {gradeNameMap[race.grade] || race.grade} | {race.ground}{" "}
                  {getDistanceCategory(race.distance)} ({race.distance}m)
                </span>
              </div>
              <div className="checklist-item-actions">
                <div className="checklist-item-controls">
                  <label>
                    <input
                      type="checkbox"
                      checked={data.ran}
                      onChange={(e) =>
                        onChecklistDataChange(race.id, "ran", e.target.checked)
                      }
                    />{" "}
                    Ran
                  </label>
                  <label>
                    <input
                      type="checkbox"
                      checked={data.won}
                      onChange={(e) =>
                        onChecklistDataChange(race.id, "won", e.target.checked)
                      }
                    />{" "}
                    Won
                  </label>
                </div>
                <textarea
                  placeholder="Notes..."
                  value={data.notes}
                  onChange={(e) =>
                    onChecklistDataChange(race.id, "notes", e.target.value)
                  }
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default Checklist;
