import React, { useState, useMemo, useCallback } from "react";
import AptitudeEditor from "./AptitudeEditor";
import ChecklistManager from "./ChecklistManager";
import Modal from "./Modal";

const gradeNameMap = { "1 Win Class": "Pre-OP", Open: "OP" };
const getDistanceCategory = (distance) => {
  if (distance < 1600) return "sprint";
  if (distance <= 1800) return "mile";
  if (distance <= 2400) return "medium";
  return "long";
};

const isSummerRace = (date) =>
  (date.includes("Year 2") || date.includes("Year 3")) &&
  (date.includes("July") || date.includes("August"));
const APTITUDE_RANKS = ["S", "A", "B", "C", "D", "E", "F", "G"];
const APTITUDE_VALUES = { S: 6, A: 5, B: 4, C: 3, D: 2, E: 1, F: 0, G: -1 };

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
  filters,
  setFilters,
  gradeFilters,
  setGradeFilters,
  showOptionalGrades,
  setShowOptionalGrades,
  careerRaceIds,
  setCareerRaceIds,
  warningRaceIds,
  gradeCounts,
  setCurrentChecklistName,
  getCareerRacesForChar, // Receive function from App
}) {
  const [isNoCareerMode, setIsNoCareerMode] = useState(false);
  const [alwaysShowCareer, setAlwaysShowCareer] = useState(true);
  const [modalState, setModalState] = useState({
    isOpen: false,
    characterToSelect: null,
  });

  const updateCharacterState = useCallback(
    (character, finalRaceSelection, newCareerRaceIds) => {
      setSelectedCharacter(character);
      setModifiedAptitudes({ ...character.aptitudes });
      setSearchTerm(character.name);
      setSelectedRaces(finalRaceSelection);
      setCareerRaceIds(newCareerRaceIds);
      setCurrentChecklistName(null);
    },
    [
      setCareerRaceIds,
      setModifiedAptitudes,
      setSelectedCharacter,
      setSelectedRaces,
      setSearchTerm,
      setCurrentChecklistName,
    ]
  );

  const handleCharacterSelect = useCallback(
    (character) => {
      if (selectedCharacter && character.name === selectedCharacter.name)
        return;

      const optionalRaces = new Set(
        [...selectedRaces].filter((id) => !careerRaceIds.has(id))
      );

      // BUG 2 FIX: Rely on careerRaceIds.size instead of selectedCharacter,
      // as selectedCharacter becomes null during search.
      if (!isNoCareerMode && careerRaceIds.size > 0 && optionalRaces.size > 0) {
        setModalState({ isOpen: true, characterToSelect: character });
        return;
      }

      const newCareerRaceIds = getCareerRacesForChar(character);
      const finalSelection = isNoCareerMode ? new Set() : newCareerRaceIds;
      updateCharacterState(character, finalSelection, newCareerRaceIds);
    },
    [
      selectedCharacter,
      selectedRaces,
      careerRaceIds,
      getCareerRacesForChar,
      isNoCareerMode,
      updateCharacterState,
    ]
  );

  const executeCharacterSwap = (keepOptional) => {
    const { characterToSelect } = modalState;
    if (!characterToSelect) return;
    const newCareerRaceIds = getCareerRacesForChar(characterToSelect);
    let finalRaceSelection = newCareerRaceIds;
    if (keepOptional) {
      const newCareerDates = new Set();
      allRaces.forEach((race) => {
        if (newCareerRaceIds.has(race.id)) newCareerDates.add(race.date);
      });
      const optionalRaces = new Set(
        [...selectedRaces].filter((id) => !careerRaceIds.has(id))
      );
      const keptOptionalRaces = new Set(
        [...optionalRaces].filter((id) => {
          const raceDate = allRaces.find((r) => r.id === id)?.date;
          return !newCareerDates.has(raceDate);
        })
      );
      finalRaceSelection = new Set([...newCareerRaceIds, ...keptOptionalRaces]);
      let minTrackApt = "S";
      let minDistApt = "S";
      keptOptionalRaces.forEach((raceId) => {
        const race = allRaces.find((r) => r.id === raceId);
        if (race) {
          const groundApt =
            race.ground === "Turf"
              ? characterToSelect.aptitudes.turf
              : characterToSelect.aptitudes.dirt;
          const distApt =
            characterToSelect.aptitudes[getDistanceCategory(race.distance)];
          if (APTITUDE_VALUES[groundApt] < APTITUDE_VALUES[minTrackApt])
            minTrackApt = groundApt;
          if (APTITUDE_VALUES[distApt] < APTITUDE_VALUES[minDistApt])
            minDistApt = distApt;
        }
      });
      const newFilters = { ...filters };
      if (APTITUDE_VALUES[minTrackApt] < APTITUDE_VALUES[filters.trackAptitude])
        newFilters.trackAptitude = minTrackApt;
      if (
        APTITUDE_VALUES[minDistApt] < APTITUDE_VALUES[filters.distanceAptitude]
      )
        newFilters.distanceAptitude = minDistApt;
      setFilters(newFilters);
    }
    updateCharacterState(
      characterToSelect,
      finalRaceSelection,
      newCareerRaceIds
    );
    setModalState({ isOpen: false, characterToSelect: null });
  };

  const handleNoCareerToggle = useCallback(
    (e) => {
      const isNowNoCareer = e.target.checked;
      if (isNowNoCareer && selectedRaces.size > 0) {
        if (
          !window.confirm("This will clear your current checklist. Continue?")
        ) {
          e.target.checked = false;
          return;
        }
      }
      setIsNoCareerMode(isNowNoCareer);
      setCareerRaceIds(new Set());
      setSelectedRaces(new Set());
      setCurrentChecklistName(null);
      if (!isNowNoCareer && selectedCharacter) {
        handleCharacterSelect(selectedCharacter);
      }
    },
    [
      selectedRaces,
      selectedCharacter,
      handleCharacterSelect,
      setCareerRaceIds,
      setSelectedRaces,
      setCurrentChecklistName,
    ]
  );

  const handleSearchChange = (e) => {
    const newSearchTerm = e.target.value;
    setSearchTerm(newSearchTerm);
    if (
      selectedCharacter &&
      newSearchTerm.toLowerCase() !== selectedCharacter.name.toLowerCase()
    ) {
      setSelectedCharacter(null);
      setModifiedAptitudes(null);
    }
  };

  const handleAptitudeChange = (aptitudeName, newValue) =>
    setModifiedAptitudes((prev) => ({ ...prev, [aptitudeName]: newValue }));
  const handleFilterChange = (event) => {
    const { name, value, type, checked } = event.target;
    setFilters((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };
  const handleGradeFilterChange = (event) =>
    setGradeFilters((prev) => ({
      ...prev,
      [event.target.name]: event.target.checked,
    }));
  const handleRaceCheck = (clickedRace) => {
    setCurrentChecklistName(null);
    const newSet = new Set(selectedRaces);
    if (!newSet.has(clickedRace.id)) {
      allRaces.forEach((race) => {
        if (race.date === clickedRace.date && race.id !== clickedRace.id)
          newSet.delete(race.id);
      });
      newSet.add(clickedRace.id);
    } else {
      newSet.delete(clickedRace.id);
    }
    setSelectedRaces(newSet);
  };

  const filteredCharacters = useMemo(() => {
    if (
      searchTerm === "" ||
      (selectedCharacter &&
        searchTerm.toLowerCase() === selectedCharacter.name.toLowerCase())
    )
      return [];
    return allCharacters.filter((char) =>
      char.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [allCharacters, searchTerm, selectedCharacter]);
  const shouldHighlightRace = useCallback(
    (race) => {
      if (!modifiedAptitudes) return false;
      const groundAptitude =
        race.ground === "Turf"
          ? modifiedAptitudes.turf
          : modifiedAptitudes.dirt;
      const distanceAptitude =
        modifiedAptitudes[getDistanceCategory(race.distance)];
      const trackMatch =
        APTITUDE_VALUES[groundAptitude] >=
        APTITUDE_VALUES[filters.trackAptitude];
      const distanceMatch =
        APTITUDE_VALUES[distanceAptitude] >=
        APTITUDE_VALUES[filters.distanceAptitude];
      return trackMatch && distanceMatch;
    },
    [modifiedAptitudes, filters.trackAptitude, filters.distanceAptitude]
  );
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
      const isCareerRace = careerRaceIds.has(race.id);
      if (alwaysShowCareer && isCareerRace) {
        return true;
      }

      if (filters.hideSummer && isSummerRace(race.date)) return false;
      const isCorrectYear =
        race.date.startsWith("Year 1") ||
        race.date.startsWith("Year 2") ||
        race.date.startsWith("Year 3");
      if (!isCorrectYear) return false;
      if (
        !isNoCareerMode &&
        careerRaceDates.has(race.date) &&
        !careerRaceIds.has(race.id)
      )
        return false;
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
    filters,
    shouldHighlightRace,
    careerRaceDates,
    careerRaceIds,
    isNoCareerMode,
    alwaysShowCareer,
  ]);

  let lastDate = null;
  const managerProps = {
    savedChecklists,
    selectedCharacter,
    onSave: handleSaveChecklist,
    onLoad: handleLoadChecklist,
    onDelete: handleDeleteChecklist,
    onRename: handleRenameChecklist,
    onImport: handleImportChecklists,
  };

  return (
    <>
      {modalState.isOpen && (
        <Modal
          title="Switch Character"
          onConfirm={() => executeCharacterSwap(false)}
          onCancel={() => executeCharacterSwap(true)}
          confirmText="Reset Optional"
          cancelText="Keep Optional"
        >
          <p>
            You have optional races selected. How would you like to proceed?
          </p>
          <p>
            <b>Reset Optional:</b> Clears all non-career races and loads the new
            character's career.
          </p>
          <p>
            <b>Keep Optional:</b> Keeps your selected optional races, removing
            only those that conflict with the new character's career. This will
            also change your filters to ensure all optional races show, make
            sure to double check filters and aptitudes after.
          </p>
        </Modal>
      )}
      <div className="container">
        <div className="left-panel">
          {/* ... Left Panel Content ... */}
          <div className="panel-section">
            <h2>1. Select Character</h2>
            <div className="free-play-toggle">
              <label>
                <input
                  id="no-career-checkbox"
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
                    <h4>Highlighting &amp; Hiding</h4>
                    <div className="aptitude-filter-item">
                      <label>Track Apt. &ge;</label>
                      <select
                        name="trackAptitude"
                        value={filters.trackAptitude}
                        onChange={handleFilterChange}
                      >
                        {APTITUDE_RANKS.map((r) => (
                          <option key={r} value={r}>
                            {r}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="aptitude-filter-item">
                      <label>Dist. Apt. &ge;</label>
                      <select
                        name="distanceAptitude"
                        value={filters.distanceAptitude}
                        onChange={handleFilterChange}
                      >
                        {APTITUDE_RANKS.map((r) => (
                          <option key={r} value={r}>
                            {r}
                          </option>
                        ))}
                      </select>
                    </div>
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
                    <label>
                      <input
                        type="checkbox"
                        name="hideSummer"
                        checked={filters.hideSummer}
                        onChange={handleFilterChange}
                      />{" "}
                      Hide Summer Races
                    </label>
                  </div>
                  <div className="filter-group">
                    <h4>Grade</h4>
                    <label>
                      <input
                        type="checkbox"
                        checked={alwaysShowCareer}
                        onChange={(e) => setAlwaysShowCareer(e.target.checked)}
                        disabled={isNoCareerMode}
                      />{" "}
                      Always Show Career
                    </label>
                    <hr />
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
                        onChange={(e) =>
                          setShowOptionalGrades(e.target.checked)
                        }
                      />{" "}
                      Show Pre-OP/OP
                    </label>
                  </div>
                </div>
              </div>
              <button
                className="generate-button"
                onClick={() => setPage("checklist")}
                disabled={selectedRaces.size === 0}
              >
                View Checklist ({selectedRaces.size})
              </button>
            </>
          )}
          <ChecklistManager {...managerProps} />
          <div className="panel-section data-source">
            <h2>Data Sources/Inspiration</h2>
            <p>
              Race data, Character career and aptitude data from{" "}
              <a
                href="https://gametora.com/umamusume"
                target="_blank"
                rel="noopener noreferrer"
              >
                GameTora
              </a>
            </p>
            <p>
              Race filtering inspired by GameTora's{" "}
              <a
                href="https://gametora.com/umamusume/race-scheduler"
                target="_blank"
                rel="noopener noreferrer"
              >
                race scheduler
              </a>
            </p>
          </div>
          <div className="panel-section known-issues">
            <h2>Known Issues/Caveats</h2>
            <ul>
              <li>Alternative career objectives are not yet implemented.</li>
              <li>
                Races from the JP version of the game are included which may not
                be present in EN yet.
              </li>
              <li>Mobile friendly view not supported at this time</li>
              <li>
                Debut and scenario specific races are hidden by default and not
                counted in the win total
              </li>
              <li>
                Loading a new checklist will always clear old optional races, to
                keep selected optional races, select a different character
                instead.
              </li>
            </ul>
          </div>
        </div>
        <div className="race-list-panel">
          <div className="race-list-header">
            <h2>Available Races ({displayRaces.length})</h2>
            <div className="grade-counter">
              <span className="counter-label">Total selected:</span>
              <span>G1: {gradeCounts.G1}</span>
              <span>G2: {gradeCounts.G2}</span>
              <span>G3: {gradeCounts.G3}</span>
            </div>
          </div>
          <div className="table-container">
            <table>
              <colgroup>
                <col className="col-select" />
                <col className="col-status" />
                <col className="col-career" />
                <col className="col-date" />
                <col className="col-grade" />
                <col className="col-name" />
                <col className="col-track" />
                <col className="col-dist-name" />
                <col className="col-dist-m" />
                <col className="col-exclusive" />
              </colgroup>
              <thead>
                <tr>
                  <th>Select</th>
                  <th>Status</th>
                  <th>Career</th>
                  <th>Date</th>
                  <th>Grade</th>
                  <th>Name</th>
                  <th>Track</th>
                  <th>Distance</th>
                  <th>(m)</th>
                  <th>Year Exclusive</th>
                </tr>
              </thead>
              <tbody>
                {displayRaces.map((race) => {
                  const isCareerRace = careerRaceIds.has(race.id);
                  const isWarning = warningRaceIds.has(race.id);
                  const isCheckboxDisabled = !isNoCareerMode && isCareerRace;
                  const rowClass = [];
                  if (shouldHighlightRace(race))
                    rowClass.push("highlighted-race");
                  if (lastDate !== null && race.date !== lastDate)
                    rowClass.push("date-group-start");
                  if (isWarning) rowClass.push("warning-race-row");
                  lastDate = race.date;
                  return (
                    <tr key={race.id} className={rowClass.join(" ")}>
                      <td>
                        <input
                          type="checkbox"
                          checked={selectedRaces.has(race.id)}
                          onChange={() => handleRaceCheck(race)}
                          disabled={isCheckboxDisabled}
                        />
                      </td>
                      <td className="status-column">
                        {isWarning && (
                          <div className="tooltip-container">
                            <span className="warning-icon">!</span>
                            <span className="tooltip-text">
                              Warning: 3+ consecutive races might cause skin
                              condition and mood down.
                            </span>
                          </div>
                        )}
                      </td>
                      <td>{isCareerRace ? "Yes" : "No"}</td>
                      <td>{race.date}</td>
                      <td>{gradeNameMap[race.grade] || race.grade}</td>
                      <td>{race.name}</td>
                      <td>{race.ground}</td>
                      <td className="distance-name-column">
                        {getDistanceCategory(race.distance)}
                      </td>
                      <td>{race.distance}</td>
                      <td>
                        {raceExclusivity.get(race.name) === 1 ? "Yes" : "No"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}

export default Planner;
