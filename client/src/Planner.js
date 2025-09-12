// src/Planner.js
import React, { useState, useMemo, useCallback } from "react";
import AptitudeEditor from "./AptitudeEditor";
import ChecklistManager from "./ChecklistManager";

const gradeNameMap = { "1 Win Class": "Pre-OP", Open: "OP" };
const isRankAPlus = (rank) => rank === "A" || rank === "S";
const getDistanceCategory = (distance) => {
  if (distance <= 1400) return "short";
  if (distance <= 1800) return "mile";
  if (distance <= 2400) return "medium";
  return "long";
};
const normalizeDateForMatching = (dateString) => {
  const yearMatch = dateString.match(/Junior|Year 1/i)
    ? "Y1"
    : dateString.match(/Classic|Year 2/i)
    ? "Y2"
    : dateString.match(/Senior|Year 3/i)
    ? "Y3"
    : null;
  const monthMatch = dateString.match(
    /(January|February|March|April|May|June|July|August|September|October|November|December)/i
  );
  const halfMatch = dateString.match(/(Early|Late)/i);
  if (!yearMatch || !monthMatch || !halfMatch) return null;
  return `${yearMatch}-${monthMatch[0]}-${halfMatch[0]}`;
};

function Planner({
  allRaces,
  allCharacters,
  raceExclusivity,
  searchTerm,
  setSearchTerm,
  selectedCharacter,
  setSelectedCharacter,
  modifiedAptitudes,
  setModifiedAptitudes,
  selectedRaces,
  setSelectedRaces,
  setPage,
  savedChecklists,
  handleSaveChecklist,
  handleLoadChecklist,
  handleDeleteChecklist,
  handleRenameChecklist,
  handleImportChecklists,
}) {
  const [filters, setFilters] = useState({
    trackIsAPlus: false,
    distanceIsAPlus: false,
    hideNonHighlighted: false,
  });
  const [gradeFilters, setGradeFilters] = useState({
    G1: true,
    G2: true,
    G3: true,
  });
  const [showOptionalGrades, setShowOptionalGrades] = useState(false);
  const [isNoCareerMode, setIsNoCareerMode] = useState(false);
  const [careerRaceIds, setCareerRaceIds] = useState(new Set());

  const handleCharacterSelect = (character) => {
    if (
      selectedCharacter &&
      selectedRaces.size > 0 &&
      character.name !== selectedCharacter.name
    ) {
      if (
        !window.confirm(
          "Changing characters will reset your current checklist. Are you sure?"
        )
      )
        return;
    }
    setSelectedCharacter(character);
    setModifiedAptitudes({ ...character.aptitudes });
    setSearchTerm(character.name);

    if (!isNoCareerMode) {
      const raceIdsToSelect = new Set();
      character.careerObjectives.forEach((obj) => {
        if (obj.type === "Race") {
          const processObjective = (objective) => {
            if (!objective) return;
            const raceNameMatch = objective.description.match(
              /(?:in the|the)\s+(.*)/
            );
            if (!raceNameMatch) return;
            const raceName = raceNameMatch[1].trim();
            if (raceName.toLowerCase().includes("make debut")) return;
            const normalizedDate = normalizeDateForMatching(objective.details);
            if (!normalizedDate) return;
            const foundRace = allRaces.find((race) => {
              const raceDate = normalizeDateForMatching(race.date);
              return (
                race.name.trim() === raceName && raceDate === normalizedDate
              );
            });
            if (foundRace) raceIdsToSelect.add(foundRace.id);
          };
          processObjective(obj);
        }
      });
      setSelectedRaces(raceIdsToSelect);
      setCareerRaceIds(raceIdsToSelect);
    } else {
      setSelectedRaces(new Set());
      setCareerRaceIds(new Set());
    }
  };

  const handleNoCareerToggle = (e) => {
    const isNowNoCareer = e.target.checked;
    if (isNowNoCareer && selectedRaces.size > 0) {
      if (
        !window.confirm(
          "Checking 'No career objectives' will clear your current checklist. Continue?"
        )
      ) {
        return;
      }
    }
    setIsNoCareerMode(isNowNoCareer);
    setSelectedRaces(new Set());
    setCareerRaceIds(new Set());
    if (!isNowNoCareer && selectedCharacter) {
      handleCharacterSelect(selectedCharacter);
    }
  };

  const handleSearchChange = (e) => {
    setSearchTerm(e.target.value);
    if (selectedCharacter) {
      setSelectedCharacter(null);
      setModifiedAptitudes(null);
      setSelectedRaces(new Set());
      setCareerRaceIds(new Set());
    }
  };

  const handleAptitudeChange = (aptitudeName, newValue) =>
    setModifiedAptitudes((prev) => ({ ...prev, [aptitudeName]: newValue }));
  const handleFilterChange = (event) =>
    setFilters((prev) => ({
      ...prev,
      [event.target.name]: event.target.checked,
    }));
  const handleGradeFilterChange = (event) =>
    setGradeFilters((prev) => ({
      ...prev,
      [event.target.name]: event.target.checked,
    }));
  const handleRaceCheck = (raceId) => {
    const newSet = new Set(selectedRaces);
    if (newSet.has(raceId)) newSet.delete(raceId);
    else newSet.add(raceId);
    setSelectedRaces(newSet);
  };

  const filteredCharacters = useMemo(() => {
    if (searchTerm === "" || selectedCharacter) return [];
    return allCharacters.filter((char) =>
      char.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [allCharacters, searchTerm, selectedCharacter]);
  const shouldHighlightRace = useCallback(
    (race) => {
      if (
        !modifiedAptitudes ||
        (!filters.trackIsAPlus && !filters.distanceIsAPlus)
      )
        return false;
      const groundAptitude =
        race.ground === "Turf"
          ? modifiedAptitudes.turf
          : modifiedAptitudes.dirt;
      const distanceAptitude =
        modifiedAptitudes[getDistanceCategory(race.distance)];
      const trackMatch = !filters.trackIsAPlus || isRankAPlus(groundAptitude);
      const distanceMatch =
        !filters.distanceIsAPlus || isRankAPlus(distanceAptitude);
      return trackMatch && distanceMatch;
    },
    [modifiedAptitudes, filters.trackIsAPlus, filters.distanceIsAPlus]
  );

  // --- MODIFIED: Moved this logic block before displayRaces ---
  const careerRaceDates = useMemo(() => {
    const dates = new Set();
    allRaces.forEach((race) => {
      if (careerRaceIds.has(race.id)) dates.add(race.date);
    });
    return dates;
  }, [careerRaceIds, allRaces]);

  const displayRaces = useMemo(() => {
    const activeGradeFilters = Object.keys(gradeFilters).filter(
      (g) => gradeFilters[g]
    );
    return allRaces.filter((race) => {
      const isCorrectYear =
        race.date.startsWith("Year 1") ||
        race.date.startsWith("Year 2") ||
        race.date.startsWith("Year 3");
      if (!isCorrectYear) return false;

      // --- NEW: Logic to hide conflicting races ---
      // If it's a career day, only show the career race, unless in No Career mode.
      if (
        !isNoCareerMode &&
        careerRaceDates.has(race.date) &&
        !careerRaceIds.has(race.id)
      ) {
        return false;
      }

      const displayGrade = gradeNameMap[race.grade] || race.grade;
      if (displayGrade === "Debut" || displayGrade === "Maiden") return false;
      if (
        !showOptionalGrades &&
        (displayGrade === "OP" || displayGrade === "Pre-OP")
      )
        return false;
      const isGGrade = ["G1", "G2", "G3"].includes(displayGrade);
      if (isGGrade && !activeGradeFilters.includes(displayGrade)) return false;
      if (filters.hideNonHighlighted && !shouldHighlightRace(race))
        return false;
      return true;
    });
  }, [
    allRaces,
    gradeFilters,
    showOptionalGrades,
    filters.hideNonHighlighted,
    shouldHighlightRace,
    isNoCareerMode,
    careerRaceDates,
    careerRaceIds,
  ]);

  let lastDate = null;
  const managerProps = {
    savedChecklists,
    onSave: handleSaveChecklist,
    onLoad: handleLoadChecklist,
    onDelete: handleDeleteChecklist,
    onRename: handleRenameChecklist,
    onImport: handleImportChecklists,
  };

  return (
    <div className="container">
      <div className="left-panel">
        <div className="panel-section">
          <h2>1. Select Character</h2>
          <div className="free-play-toggle">
            <label>
              <input
                type="checkbox"
                checked={isNoCareerMode}
                onChange={handleNoCareerToggle}
              />{" "}
              No career objectives
            </label>
          </div>
          <input
            type="text"
            placeholder="Search..."
            className="search-bar"
            value={searchTerm}
            onChange={handleSearchChange}
          />
          <ul className="character-list">
            {filteredCharacters.map((char) => (
              <li key={char.name} onClick={() => handleCharacterSelect(char)}>
                {char.name}
              </li>
            ))}
          </ul>
        </div>
        {selectedCharacter && (
          <>
            <div className="panel-section">
              <AptitudeEditor
                aptitudes={modifiedAptitudes}
                onAptitudeChange={handleAptitudeChange}
              />
            </div>
            <div className="panel-section">
              <h2>3. Filters</h2>
              <div className="filter-grid">
                <div className="filter-group">
                  <h4>Highlighting</h4>
                  <label>
                    <input
                      type="checkbox"
                      name="trackIsAPlus"
                      checked={filters.trackIsAPlus}
                      onChange={handleFilterChange}
                    />{" "}
                    Track is A+
                  </label>
                  <label>
                    <input
                      type="checkbox"
                      name="distanceIsAPlus"
                      checked={filters.distanceIsAPlus}
                      onChange={handleFilterChange}
                    />{" "}
                    Distance is A+
                  </label>
                  <hr />
                  <label>
                    <input
                      type="checkbox"
                      name="hideNonHighlighted"
                      checked={filters.hideNonHighlighted}
                      onChange={handleFilterChange}
                    />{" "}
                    Hide Unsuitable
                  </label>
                </div>
                <div className="filter-group">
                  <h4>Grade</h4>
                  <label>
                    <input
                      type="checkbox"
                      name="G1"
                      checked={gradeFilters.G1}
                      onChange={handleGradeFilterChange}
                    />{" "}
                    G1
                  </label>
                  <label>
                    <input
                      type="checkbox"
                      name="G2"
                      checked={gradeFilters.G2}
                      onChange={handleGradeFilterChange}
                    />{" "}
                    G2
                  </label>
                  <label>
                    <input
                      type="checkbox"
                      name="G3"
                      checked={gradeFilters.G3}
                      onChange={handleGradeFilterChange}
                    />{" "}
                    G3
                  </label>
                  <hr />
                  <label>
                    <input
                      type="checkbox"
                      checked={showOptionalGrades}
                      onChange={(e) => setShowOptionalGrades(e.target.checked)}
                    />{" "}
                    Show Pre-OP/OP
                  </label>
                </div>
              </div>
            </div>
            <button
              className="generate-button"
              onClick={() => setPage("checklist")}
            >
              View Checklist ({selectedRaces.size})
            </button>
          </>
        )}
        <ChecklistManager {...managerProps} />
        <div className="panel-section known-issues">
          <h2>Known Issues</h2>
          <ul>
            <li>
              Alternative career objectives (from tooltips on the source
              website) are not yet implemented.
            </li>
          </ul>
        </div>
      </div>{" "}
      <div className="race-list-panel"></div>
      <div className="race-list-panel">
        <h2>Available Races ({displayRaces.length})</h2>
        <table>
          {/* --- MODIFIED: Column order changed --- */}
          <thead>
            <tr>
              <th>Select</th>
              <th>Career</th>
              <th>Date</th>
              <th>Grade</th>
              <th>Name</th>
              <th>Track</th>
              <th>Distance</th>
              <th>Exclusive</th>
            </tr>
          </thead>
          <tbody>
            {displayRaces.map((race) => {
              const currentDate = race.date;
              const isNewDateGroup =
                lastDate !== null && currentDate !== lastDate;
              lastDate = currentDate;
              const isCareerRace = careerRaceIds.has(race.id);
              // --- MODIFIED: Simplified locking logic ---
              const isCheckboxDisabled = !isNoCareerMode && isCareerRace;
              const rowClass = [];
              if (shouldHighlightRace(race)) rowClass.push("highlighted-race");
              if (isNewDateGroup) rowClass.push("date-group-start");
              return (
                <tr key={race.id} className={rowClass.join(" ")}>
                  <td>
                    <input
                      type="checkbox"
                      checked={selectedRaces.has(race.id)}
                      onChange={() => handleRaceCheck(race.id)}
                      disabled={isCheckboxDisabled}
                    />
                  </td>
                  {/* --- MODIFIED: Column order changed --- */}
                  <td>{isCareerRace ? "Yes" : "No"}</td>
                  <td>{race.date}</td>
                  <td>{gradeNameMap[race.grade] || race.grade}</td>
                  <td>{race.name}</td>
                  <td>{race.ground}</td>
                  <td>{race.distance}m</td>
                  <td>{raceExclusivity.get(race.name) === 1 ? "Yes" : "No"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default Planner;
