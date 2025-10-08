import React, { useMemo, useCallback, useState, useEffect } from "react";

const gradeNameMap = { "1 Win Class": "Pre-OP", Open: "OP" };
const getDistanceCategory = (distance) => {
  if (distance < 1600) return "sprint";
  if (distance <= 1800) return "mile";
  if (distance <= 2400) return "medium";
  return "long";
};

const capitalize = (s) => {
  if (typeof s !== "string") return "";
  return s.charAt(0).toUpperCase() + s.slice(1);
};

const formatChecklistDate = (dateString) => {
  const parts = dateString.split(" - ");
  if (parts.length !== 3) return dateString;

  const [yearPart, monthPart, halfPart] = parts;

  return `${yearPart} - ${halfPart} ${monthPart}`;
};

const getGradeBubbleClass = (race, careerRaceIds) => {
  const classes = ["grade-bubble", "mini"];
  const isCareerRace = careerRaceIds.has(race.id);
  if (isCareerRace) {
    classes.push("career-bubble");
  } else if (race.grade === "G1") {
    classes.push("g1-bubble");
  } else if (race.grade === "G2") {
    classes.push("g2-bubble");
  } else if (race.grade === "G3") {
    classes.push("g3-bubble");
  }
  return classes.join(" ");
};

const ProgressHelper = ({
  nextRace,
  onUpdateNextRace,
  onChecklistDataChange,
  raceExclusivity,
  previouslyWon,
  nextInstancePlanned,
  races,
  careerRaceIds,
}) => {
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const isComplete = !nextRace;

  const { turnsUntil, upcomingRaces } = useMemo(() => {
    if (isComplete || !races || races.length === 0) {
      return { turnsUntil: 0, upcomingRaces: [] };
    }

    const nextRaceIndex = races.findIndex((r) => r.id === nextRace.id);

    let prevTurn = 0;
    if (nextRaceIndex > 0) {
      prevTurn = races[nextRaceIndex - 1].turnValue;
    }

    const turnsUntil = nextRace.turnValue - prevTurn - 1;
    const upcoming = races
      .slice(nextRaceIndex + 1, nextRaceIndex + 4)
      .map((race, i, arr) => {
        const prevRaceTurn =
          i === 0 ? nextRace.turnValue : arr[i - 1].turnValue;
        return {
          ...race,
          turnsAfterPrev: race.turnValue - prevRaceTurn - 1,
        };
      });

    return { turnsUntil, upcomingRaces: upcoming };
  }, [isComplete, races, nextRace]);

  if (isComplete) {
    return (
      <div className="progress-helper progress-helper-complete">
        🎉 All Races Complete! 🎉
      </div>
    );
  }

  const notes = nextRace.notes;
  const isExclusive = raceExclusivity.get(nextRace.name) === 1;
  const gradeBubbleClass = getGradeBubbleClass(nextRace, careerRaceIds);

  return (
    <div className="progress-helper">
      <div className="progress-race-info">
        <div className="progress-label">Next Race:</div>
        <div className="progress-race-name">
          <span className={gradeBubbleClass}>
            {gradeNameMap[nextRace.grade] || nextRace.grade}
          </span>
          {nextRace.name}{" "}
          {nextRace.isCareer && (
            <span className="career-race-indicator">Career</span>
          )}
          {isExclusive && !nextRace.isCareer && (
            <span className="exclusive-race-indicator">Exclusive</span>
          )}
          {previouslyWon && (
            <div className="tooltip-container">
              <span className="smart-add-indicator">✅</span>
              <span className="tooltip-text checklist-tooltip">
                A previous instance of this race was already won.
              </span>
            </div>
          )}
          {nextInstancePlanned && (
            <div className="tooltip-container">
              <span className="smart-add-indicator">📅</span>
              <span className="tooltip-text checklist-tooltip">
                Next year's instance of this race is also planned.
              </span>
            </div>
          )}
        </div>
        <div className="progress-race-meta">
          <span>🗓️ {formatChecklistDate(nextRace.date)}</span>
          {" | "}
          {nextRace.ground}
          {" | "}
          {capitalize(getDistanceCategory(nextRace.distance))} (
          {nextRace.distance}
          m)
        </div>
        <textarea
          className="progress-notes-textarea"
          placeholder="Notes for this race..."
          value={notes}
          onChange={(e) =>
            onChecklistDataChange(nextRace.id, "notes", e.target.value)
          }
          disabled={isComplete}
        />
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

      <div
        className="progress-details-toggle"
        onClick={() => setIsDetailsOpen(!isDetailsOpen)}
      >
        <h4>Schedule Details</h4>
        <span>{isDetailsOpen ? "▼" : "►"}</span>
      </div>

      {isDetailsOpen && (
        <div className="progress-details-content">
          <div className="turn-counter">
            <span className="turn-count">{turnsUntil}</span> Turns Until Next
            Race
          </div>
          {upcomingRaces.length > 0 && (
            <div className="upcoming-races-preview">
              <h4>Upcoming:</h4>
              <ul>
                {upcomingRaces.map((race) => (
                  <li key={race.id}>
                    <span className="upcoming-date">
                      +{race.turnsAfterPrev} turns
                    </span>
                    <span className="upcoming-name">
                      {race.name}
                      {careerRaceIds.has(race.id) && (
                        <span className="career-race-indicator mini">C</span>
                      )}
                    </span>
                    <span className={getGradeBubbleClass(race, careerRaceIds)}>
                      {gradeNameMap[race.grade] || race.grade}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
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
  distanceCounts,
  wonCount,
  currentChecklistName,
  careerRaceIds,
  selectedCharacter,
  smartAddedRaceIds,
  raceExclusivity,
  combinedRaceIds,
  filters,
  setFilters,
  totalBaseFans,
  estimatedTotalFans,
  fanBonus,
  setFanBonus,
}) {
  const [showBackToTop, setShowBackToTop] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 300) {
        setShowBackToTop(true);
      } else {
        setShowBackToTop(false);
      }
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  const handleFilterChange = (event) => {
    const { name, checked } = event.target;
    setFilters((prev) => ({
      ...prev,
      [name]: checked,
    }));
  };

  const nextRace = useMemo(() => {
    const firstUnfinishedRace = races.find((race) => {
      const data = checklistData[race.id];
      return !(data?.ran || data?.won || data?.skipped);
    });

    if (firstUnfinishedRace) {
      return {
        ...firstUnfinishedRace,
        isCareer:
          selectedCharacter && careerRaceIds.has(firstUnfinishedRace.id),
        notes: checklistData[firstUnfinishedRace.id]?.notes || "",
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

  const wonRaceNames = useMemo(() => {
    const names = new Set();
    races.forEach((race) => {
      if (checklistData[race.id]?.won) {
        names.add(race.name);
      }
    });
    return names;
  }, [races, checklistData]);

  const getChecklistItemClass = useCallback(
    (race) => {
      const classes = ["checklist-item"];
      const isCareer = selectedCharacter && careerRaceIds.has(race.id);
      const isNext = nextRace && nextRace.id === race.id;
      const isSmartAdded = smartAddedRaceIds.has(race.id);
      const isWarning = warningRaceIds.has(race.id);

      if (isCareer) {
        classes.push("career-race-row");
      } else if (race.grade === "G1") {
        classes.push("g1-race-row");
      } else if (race.grade === "G2") {
        classes.push("g2-race-row");
      } else if (race.grade === "G3") {
        classes.push("g3-race-row");
      }

      if (isWarning) classes.push("warning-race-row");
      if (isNext) classes.push("next-race-item");
      if (isSmartAdded) classes.push("smart-added-item");

      return classes.join(" ");
    },
    [
      careerRaceIds,
      nextRace,
      selectedCharacter,
      smartAddedRaceIds,
      warningRaceIds,
    ]
  );

  const nextRaceInfo = useMemo(() => {
    if (!nextRace) return { previouslyWon: false, nextInstancePlanned: false };
    const isExclusive = raceExclusivity.get(nextRace.name) === 1;
    const previouslyWon =
      !nextRace.isCareer && !isExclusive && wonRaceNames.has(nextRace.name);
    const nextInstancePlanned =
      !isExclusive &&
      races.some(
        (r) =>
          r.name === nextRace.name &&
          r.turnValue > nextRace.turnValue &&
          combinedRaceIds.has(r.id)
      );
    return { previouslyWon, nextInstancePlanned };
  }, [nextRace, raceExclusivity, wonRaceNames, races, combinedRaceIds]);

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
          <div className="checklist-sticky-header">
            <div className="next-race-panel">
              <ProgressHelper
                nextRace={nextRace}
                onUpdateNextRace={handleUpdateNextRace}
                onChecklistDataChange={onChecklistDataChange}
                raceExclusivity={raceExclusivity}
                previouslyWon={nextRaceInfo.previouslyWon}
                nextInstancePlanned={nextRaceInfo.nextInstancePlanned}
                races={races}
                careerRaceIds={careerRaceIds}
              />
            </div>

            <div className="grade-counter checklist-page-counter">
              <span className="counter-label">Selected:</span>
              <span>G1: {gradeCounts.G1}</span>
              <span>G2: {gradeCounts.G2}</span>
              <span>G3: {gradeCounts.G3}</span>
              <span className="counter-label">Distances:</span>
              <span>Sprint: {distanceCounts.sprint}</span>
              <span>Mile: {distanceCounts.mile}</span>
              <span>Medium: {distanceCounts.medium}</span>
              <span>Long: {distanceCounts.long}</span>
              <span className="counter-label">Won:</span>
              <span>
                {wonCount} / {races.length}
              </span>
            </div>
            <div
              className="grade-counter checklist-page-counter"
              style={{
                borderTop: "1px solid var(--color-border-light)",
                paddingTop: "15px",
              }}
            >
              <span className="counter-label">Fan Info:</span>
              <div className="fan-input-group">
                <label htmlFor="fanBonus">Fan Bonus %:</label>
                <input
                  id="fanBonus"
                  type="number"
                  value={fanBonus}
                  onChange={(e) => setFanBonus(e.target.value)}
                  className="fan-bonus-input"
                />
              </div>
              <span>
                Base: <strong>{totalBaseFans.toLocaleString()}</strong>
              </span>
              <span>
                Est. Total:{" "}
                <strong>{estimatedTotalFans.toLocaleString()}</strong>
                <div className="tooltip-container">
                  <span
                    className="warning-icon"
                    style={{ marginLeft: "5px", fontSize: "0.8em" }}
                  >
                    ?
                  </span>
                  <span className="tooltip-text">
                    An estimate based on gaining 1st place in all selected races
                    with the specified fan bonus.
                  </span>
                </div>
              </span>
            </div>
          </div>
          <div className="checklist-options">
            <label>
              <input
                type="checkbox"
                name="preventWarningAdd"
                checked={filters.preventWarningAdd}
                onChange={handleFilterChange}
              />
              Prevent Smart Adding of races that would cause 3+ consecutive
              races
            </label>
            <div className="color-legend">
              <span className="legend-item">
                <span className="legend-color-box career"></span>Career
              </span>
              <span className="legend-item">
                <span className="legend-color-box g1"></span>G1
              </span>
              <span className="legend-item">
                <span className="legend-color-box g2"></span>G2
              </span>
              <span className="legend-item">
                <span className="legend-color-box g3"></span>G3
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
          const isCareer = selectedCharacter && careerRaceIds.has(race.id);
          const isSmartAdded = smartAddedRaceIds.has(race.id);
          const isExclusive = raceExclusivity.get(race.name) === 1;

          const previouslyWon =
            !isCareer && !isExclusive && wonRaceNames.has(race.name);

          const nextInstancePlanned =
            !isExclusive &&
            races.some(
              (r) =>
                r.name === race.name &&
                r.turnValue > race.turnValue &&
                combinedRaceIds.has(r.id)
            );

          const itemClass = getChecklistItemClass(race);

          return (
            <div key={race.id} className={itemClass}>
              <div className="checklist-item-info">
                <h3>
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
                  {isExclusive && !isCareer && (
                    <span className="exclusive-race-indicator">Exclusive</span>
                  )}
                  {previouslyWon && (
                    <div className="tooltip-container">
                      <span className="smart-add-indicator">✅</span>
                      <span className="tooltip-text checklist-tooltip">
                        A previous instance of this race was already won.
                      </span>
                    </div>
                  )}
                  {nextInstancePlanned && (
                    <div className="tooltip-container">
                      <span className="smart-add-indicator">📅</span>
                      <span className="tooltip-text checklist-tooltip">
                        Next year's instance of this race is also planned.
                      </span>
                    </div>
                  )}
                  {warningRaceIds.has(race.id) && (
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
                  {gradeNameMap[race.grade] || race.grade} | {race.ground}
                  {" | "}
                  {capitalize(getDistanceCategory(race.distance))} (
                  {race.distance}m)
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
      {showBackToTop && (
        <button className="back-to-top-button" onClick={scrollToTop}>
          ↑
        </button>
      )}
    </div>
  );
}

export default Checklist;
