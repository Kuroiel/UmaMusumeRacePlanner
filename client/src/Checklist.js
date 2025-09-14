import React, { useMemo, useCallback } from "react";

const gradeNameMap = { "1 Win Class": "Pre-OP", Open: "OP" };
const getDistanceCategory = (distance) => {
  if (distance < 1600) return "sprint";
  if (distance <= 1800) return "mile";
  if (distance <= 2400) return "medium";
  return "long";
};

const formatChecklistDate = (dateString) => {
  const parts = dateString.split(" - ");
  if (parts.length !== 3) return dateString; // Fallback for unexpected formats

  const [yearPart, monthPart, halfPart] = parts;

  let formattedYear = yearPart;
  if (yearPart === "Year 1") formattedYear = "Junior Year";
  else if (yearPart === "Year 2") formattedYear = "Classic Year";
  else if (yearPart === "Year 3") formattedYear = "Senior Year";

  return `${formattedYear} - ${halfPart} ${monthPart}`;
};

const ProgressHelper = ({ nextRace, onUpdateNextRace }) => {
  const isComplete = !nextRace;

  if (isComplete) {
    return (
      <div className="progress-helper progress-helper-complete">
        🎉 All Races Complete! 🎉
      </div>
    );
  }

  return (
    <div className="progress-helper">
      <div className="progress-label">Next Race:</div>
      <div className="progress-race-name">
        {nextRace.name}{" "}
        {nextRace.isCareer && (
          <span className="career-race-indicator">Career</span>
        )}
      </div>
      <div className="progress-race-date">
        🗓️ {formatChecklistDate(nextRace.date)}
      </div>
      <div className="progress-actions">
        <button
          className="progress-action-button ran"
          onClick={() => onUpdateNextRace("ran", true)}
          disabled={isComplete}
        >
          Mark as Ran
        </button>
        <button
          className="progress-action-button won"
          onClick={() => onUpdateNextRace("won", true)}
          disabled={isComplete}
        >
          Mark as Won
        </button>
        <button
          className="progress-action-button skip"
          onClick={() => onUpdateNextRace("skipped", true)}
          disabled={isComplete || (nextRace && nextRace.isCareer)}
        >
          Mark as Skipped
        </button>
      </div>
    </div>
  );
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
  careerRaceIds,
  selectedCharacter,
  smartAddedRaceIds,
}) {
  const nextRace = useMemo(() => {
    const firstUnfinishedRace = races.find((race) => {
      const data = checklistData[race.id];
      return !(data?.ran || data?.won || data?.skipped);
    });

    // Also attach career status for the helper buttons
    if (firstUnfinishedRace) {
      return {
        ...firstUnfinishedRace,
        isCareer:
          selectedCharacter && careerRaceIds.has(firstUnfinishedRace.id),
      };
    }
    return null;
  }, [races, checklistData, careerRaceIds, selectedCharacter]);

  const handleUpdateNextRace = useCallback(
    (field, value) => {
      if (nextRace) {
        onChecklistDataChange(nextRace.id, field, value);
      }
    },
    [nextRace, onChecklistDataChange]
  );

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
            Reset All Status
          </button>
          <button className="action-button clear-button" onClick={onClearNotes}>
            Clear All Notes
          </button>
        </div>
      </div>

      {races.length > 0 && (
        <>
          {/* --- NEW: Render Progress Helper --- */}
          <div className="checklist-sticky-header">
            <ProgressHelper
              nextRace={nextRace}
              onUpdateNextRace={handleUpdateNextRace}
            />

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
          </div>
        </>
      )}

      <div className="checklist-container">
        {races.map((race) => {
          const data = checklistData[race.id] || {
            ran: false,
            won: false,
            notes: "",
            skipped: false,
          };
          const isWarning = warningRaceIds.has(race.id);
          const isCareer = selectedCharacter && careerRaceIds.has(race.id);
          const isNextRace = nextRace && nextRace.id === race.id;
          const isSmartAdded = smartAddedRaceIds.has(race.id); // NEW: Check if race is smart-added

          const itemClass = `checklist-item ${
            isWarning ? "warning-race-row" : ""
          } ${isNextRace ? "next-race-item" : ""} ${
            isSmartAdded ? "smart-added-item" : "" // NEW: Conditionally add class
          }`;

          return (
            <div key={race.id} className={itemClass}>
              <div className="checklist-item-info">
                <h3>
                  {/* NEW: Add icon for smart-added races */}
                  {isSmartAdded && (
                    <span
                      className="smart-add-indicator"
                      title="This race was automatically added."
                    >
                      ✨
                    </span>
                  )}
                  {race.name}
                  {isCareer && (
                    <span className="career-race-indicator">Career</span>
                  )}

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

                <span className="checklist-item-meta">
                  <span className="checklist-item-date">
                    🗓️ {formatChecklistDate(race.date)}
                  </span>
                  {" | "}
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

                  <label className={isCareer ? "control-disabled" : ""}>
                    <input
                      type="checkbox"
                      checked={data.skipped}
                      onChange={(e) =>
                        onChecklistDataChange(
                          race.id,
                          "skipped",
                          e.target.checked
                        )
                      }
                      disabled={isCareer}
                    />{" "}
                    Skip
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
