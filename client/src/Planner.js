import React, { useState, useMemo, useCallback, useEffect } from "react";
import toast from "react-hot-toast";
import AptitudeEditor from "./AptitudeEditor";
import ChecklistManager from "./ChecklistManager";
import Modal from "./Modal";
import EpithetHelper from "./EpithetHelper";

const gradeNameMap = { "1 Win Class": "Pre-OP", Open: "OP" };
const getDistanceCategory = (distance) => {
  if (distance < 1600) return "sprint";
  if (distance <= 1800) return "mile";
  if (distance <= 2400) return "medium";
  return "long";
};

const areAptitudesEqual = (a, b) => {
  if (!a || !b) return a === b;
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  if (aKeys.length !== bKeys.length) return false;
  for (const key of aKeys) {
    if (a[key] !== b[key]) return false;
  }
  return true;
};

const isSummerRace = (date) =>
  (date.includes("Classic Year") || date.includes("Senior Year")) &&
  (date.includes("July") || date.includes("August"));
const APTITUDE_RANKS = ["S", "A", "B", "C", "D", "E", "F", "G"];
const APTITUDE_VALUES = { S: 6, A: 5, B: 4, C: 3, D: 2, E: 1, F: 0, G: -1 };

const CollapsibleHeader = ({ title, isOpen, onToggle, children }) => (
  <h2 onClick={onToggle} className="collapsible-header">
    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
      {title}
      {children}
    </div>
    <span>{isOpen ? "▼" : "►"}</span>
  </h2>
);

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
  handleReorderChecklist,
  handleImportChecklists,
  currentChecklistName,
  filters,
  setFilters,
  gradeFilters,
  setGradeFilters,
  yearFilters,
  setYearFilters,
  trackFilters,
  setTrackFilters,
  distanceFilters,
  setDistanceFilters,
  showOptionalGrades,
  setShowOptionalGrades,
  careerRaceIds,
  setCareerRaceIds,
  warningRaceIds,
  gradeCounts,
  distanceCounts,
  setCurrentChecklistName,
  getCareerRacesForChar,
  isNoCareerMode,
  setIsNoCareerMode,
  alwaysShowCareer,
  setAlwaysShowCareer,
  totalSelectedCount,
  combinedRaceIds,
  epithetStatus,
  handleAddEpithetRaces,
}) {
  const [modalState, setModalState] = useState({
    isOpen: false,
    characterToSelect: null,
  });
  const [raceSearchTerm, setRaceSearchTerm] = useState("");
  const [showBackToTop, setShowBackToTop] = useState(false);

  useEffect(() => {
    const tableContainer = document.querySelector(".table-container");
    const handleScroll = () => {
      if (tableContainer && tableContainer.scrollTop > 300) {
        setShowBackToTop(true);
      } else {
        setShowBackToTop(false);
      }
    };
    if (tableContainer) {
      tableContainer.addEventListener("scroll", handleScroll);
    }
    return () => {
      if (tableContainer) {
        tableContainer.removeEventListener("scroll", handleScroll);
      }
    };
  }, []);

  const scrollToTop = () => {
    const tableContainer = document.querySelector(".table-container");
    if (tableContainer) {
      tableContainer.scrollTo({
        top: 0,
        behavior: "smooth",
      });
    }
  };

  const [panelsOpen, setPanelsOpen] = useState(() => {
    try {
      const savedPanels = localStorage.getItem("umamusume-panel-state");
      return savedPanels
        ? JSON.parse(savedPanels)
        : {
            aptitudes: true,
            filters: true,
            epithets: true,
            manager: true,
            epithetList: false,
            sources: false,
            issues: false,
          };
    } catch {
      return {
        aptitudes: true,
        filters: true,
        epithets: true,
        manager: true,
        epithetList: false,
        sources: false,
        issues: false,
      };
    }
  });

  const togglePanel = (panelName) => {
    setPanelsOpen((prev) => {
      const newState = { ...prev, [panelName]: !prev[panelName] };
      localStorage.setItem("umamusume-panel-state", JSON.stringify(newState));
      return newState;
    });
  };

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
      let filtersChanged = false;
      if (
        APTITUDE_VALUES[minTrackApt] < APTITUDE_VALUES[filters.trackAptitude]
      ) {
        newFilters.trackAptitude = minTrackApt;
        filtersChanged = true;
      }
      if (
        APTITUDE_VALUES[minDistApt] < APTITUDE_VALUES[filters.distanceAptitude]
      ) {
        newFilters.distanceAptitude = minDistApt;
        filtersChanged = true;
      }
      setFilters(newFilters);
      if (filtersChanged) {
        toast.info("Aptitude filters were adjusted to show all kept races.", {
          duration: 4000,
        });
      }
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
      setIsNoCareerMode,
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
  const handleYearFilterChange = (event) =>
    setYearFilters((prev) => ({
      ...prev,
      [event.target.name]: event.target.checked,
    }));
  const handleTrackFilterChange = (event) =>
    setTrackFilters((prev) => ({
      ...prev,
      [event.target.name]: event.target.checked,
    }));
  const handleDistanceFilterChange = (event) =>
    setDistanceFilters((prev) => ({
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

  const handleResetAptitudes = useCallback(
    (e) => {
      e.stopPropagation();
      if (selectedCharacter) {
        setModifiedAptitudes({ ...selectedCharacter.aptitudes });
        toast.success("Aptitudes reset to default.");
      }
    },
    [selectedCharacter, setModifiedAptitudes]
  );

  const aptitudesAreModified = useMemo(() => {
    if (!selectedCharacter || !modifiedAptitudes) return false;
    return !areAptitudesEqual(selectedCharacter.aptitudes, modifiedAptitudes);
  }, [selectedCharacter, modifiedAptitudes]);

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
    const activeYearFilters = Object.keys(yearFilters).filter(
      (y) => yearFilters[y]
    );
    const activeTrackFilters = Object.keys(trackFilters).filter(
      (t) => trackFilters[t]
    );
    const activeDistanceFilters = Object.keys(distanceFilters).filter(
      (d) => distanceFilters[d]
    );

    return allRaces.filter((race) => {
      const displayGrade = gradeNameMap[race.grade] || race.grade;
      if (displayGrade === "Debut" || displayGrade === "Maiden") return false;

      const isCareerRace = careerRaceIds.has(race.id);
      if (alwaysShowCareer && isCareerRace) {
        return true;
      }

      if (
        raceSearchTerm &&
        !race.name.toLowerCase().includes(raceSearchTerm.toLowerCase())
      ) {
        return false;
      }

      const raceYear = race.date.split(" - ")[0];
      if (!activeYearFilters.includes(raceYear)) return false;
      if (!activeTrackFilters.includes(race.ground)) return false;
      if (!activeDistanceFilters.includes(getDistanceCategory(race.distance)))
        return false;

      if (filters.hideSummer && isSummerRace(race.date)) return false;

      if (
        !isNoCareerMode &&
        careerRaceDates.has(race.date) &&
        !careerRaceIds.has(race.id)
      ) {
        return false;
      }

      if (
        !showOptionalGrades &&
        (displayGrade === "OP" || displayGrade === "Pre-OP")
      ) {
        return false;
      }
      const isGGrade = ["G1", "G2", "G3"].includes(displayGrade);
      if (isGGrade && !activeGradeFilters.includes(displayGrade)) return false;

      if (filters.hideNonHighlighted && !shouldHighlightRace(race))
        return false;

      return true;
    });
  }, [
    allRaces,
    gradeFilters,
    yearFilters,
    trackFilters,
    distanceFilters,
    showOptionalGrades,
    filters,
    shouldHighlightRace,
    careerRaceDates,
    careerRaceIds,
    isNoCareerMode,
    alwaysShowCareer,
    raceSearchTerm,
  ]);

  const getRaceRowClass = useCallback(
    (race) => {
      const classes = [];
      if (shouldHighlightRace(race)) {
        classes.push("highlighted-race");
      }
      if (warningRaceIds.has(race.id)) {
        classes.push("warning-race-row");
      }
      return classes.join(" ");
    },
    [shouldHighlightRace, warningRaceIds]
  );

  const getGradeBubbleClass = useCallback(
    (race) => {
      const classes = ["grade-bubble"];
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
    },
    [careerRaceIds]
  );

  let lastDate = null;
  const managerProps = {
    savedChecklists,
    selectedCharacter,
    onSave: handleSaveChecklist,
    onLoad: handleLoadChecklist,
    onDelete: handleDeleteChecklist,
    onRename: handleRenameChecklist,
    onReorder: handleReorderChecklist,
    onImport: handleImportChecklists,
    currentChecklistName,
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
                <CollapsibleHeader
                  title="2. Edit Aptitudes"
                  isOpen={panelsOpen.aptitudes}
                  onToggle={() => togglePanel("aptitudes")}
                >
                  {aptitudesAreModified && (
                    <button
                      className="action-button"
                      style={{ padding: "3px 8px", fontSize: "0.8em" }}
                      onClick={handleResetAptitudes}
                    >
                      Reset to Default
                    </button>
                  )}
                </CollapsibleHeader>

                {panelsOpen.aptitudes && (
                  <AptitudeEditor
                    aptitudes={modifiedAptitudes}
                    onAptitudeChange={handleAptitudeChange}
                  />
                )}
              </div>
              <div className="panel-section">
                <CollapsibleHeader
                  title="3. Filters"
                  isOpen={panelsOpen.filters}
                  onToggle={() => togglePanel("filters")}
                />
                {panelsOpen.filters && (
                  <div className="filters-container">
                    <div className="filter-group">
                      <h4>Minimum Aptitudes</h4>
                      <div className="aptitude-filter-item-group">
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
                      </div>
                      <hr />
                      <div className="show-hide-grid">
                        <label>
                          <input
                            type="checkbox"
                            checked={alwaysShowCareer}
                            onChange={(e) =>
                              setAlwaysShowCareer(e.target.checked)
                            }
                            disabled={isNoCareerMode}
                          />{" "}
                          Always Show Career Races
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
                        <label>
                          <input
                            type="checkbox"
                            name="hideNonHighlighted"
                            checked={filters.hideNonHighlighted}
                            onChange={handleFilterChange}
                          />{" "}
                          Hide Unsuitable Races
                        </label>
                        <label>
                          <input
                            type="checkbox"
                            checked={showOptionalGrades}
                            onChange={(e) =>
                              setShowOptionalGrades(e.target.checked)
                            }
                          />{" "}
                          Show Pre-OP/OP Races
                        </label>
                      </div>
                    </div>

                    <div className="checkbox-filter-grid">
                      <div className="filter-group">
                        <h4>Track</h4>
                        {Object.keys(trackFilters).map((track) => (
                          <label key={track}>
                            <input
                              type="checkbox"
                              name={track}
                              checked={trackFilters[track]}
                              onChange={handleTrackFilterChange}
                            />{" "}
                            {track}
                          </label>
                        ))}
                      </div>
                      <div className="filter-group">
                        <h4>Distance</h4>
                        {Object.keys(distanceFilters).map((dist) => (
                          <label key={dist}>
                            <input
                              type="checkbox"
                              name={dist}
                              checked={distanceFilters[dist]}
                              onChange={handleDistanceFilterChange}
                            />{" "}
                            {dist.charAt(0).toUpperCase() + dist.slice(1)}
                          </label>
                        ))}
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
                      </div>
                      <div className="filter-group">
                        <h4>Year</h4>
                        {Object.keys(yearFilters).map((year) => (
                          <label key={year}>
                            <input
                              type="checkbox"
                              name={year}
                              checked={yearFilters[year]}
                              onChange={handleYearFilterChange}
                            />{" "}
                            {year}
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
              <div className="panel-section">
                <CollapsibleHeader
                  title="Epithet Helper"
                  isOpen={panelsOpen.epithets}
                  onToggle={() => togglePanel("epithets")}
                />
                {panelsOpen.epithets && (
                  <EpithetHelper
                    epithetStatus={epithetStatus}
                    onAddRaces={handleAddEpithetRaces}
                  />
                )}
              </div>
            </>
          )}
          <div className="panel-section">
            <CollapsibleHeader
              title="Checklist Manager"
              isOpen={panelsOpen.manager}
              onToggle={() => togglePanel("manager")}
            />
            {panelsOpen.manager && <ChecklistManager {...managerProps} />}
          </div>

          <div className="panel-section">
            <CollapsibleHeader
              title="Epithet Bonus Races"
              isOpen={panelsOpen.epithetList}
              onToggle={() => togglePanel("epithetList")}
            />
            {panelsOpen.epithetList && (
              <div className="epithet-list">
                <ul>
                  <li>
                    <strong>Classic Triple Crown:</strong> Satsuki Sho, Tokyo
                    Yushun, Kikuka Sho
                  </li>
                  <li>
                    <strong>Triple Tiara:</strong> Oka Sho, Japanese Oaks, Shuka
                    Sho
                  </li>
                  <li>
                    <strong>Spring Senior Triple Crown:</strong> Osaka Hai,
                    Tenno Sho (Spring), Takarazuka Kinen
                  </li>
                  <li>
                    <strong>Autumn Senior Triple Crown:</strong> Tenno Sho
                    (Autumn), Japan Cup, Arima Kinen
                  </li>
                  <li>
                    <strong>Tenno Sweep:</strong> Tenno Sho (Spring), Tenno Sho
                    (Autumn)
                  </li>
                  <li>
                    <strong>Dual Gran Prix:</strong> Takarazuka Kinen, Arima
                    Kinen
                  </li>
                  <li>
                    <strong>Dual Miles:</strong> Yasuda Kinen, Mile Championship
                  </li>
                  <li>
                    <strong>Dual Sprints:</strong> Takamatsunomiya Kinen,
                    Sprinters Stakes
                  </li>
                  <li>
                    <strong>Dual Dirt:</strong> Champions Cup, February Stakes
                  </li>
                </ul>
              </div>
            )}
          </div>

          <div className="panel-section">
            <CollapsibleHeader
              title="Known Issues/Caveats"
              isOpen={panelsOpen.issues}
              onToggle={() => togglePanel("issues")}
            />
            {panelsOpen.issues && (
              <div className="known-issues">
                <ul>
                  <li>
                    PLEASE EXPORT OFTEN. If something happens, without a file to
                    import, there is currently NO option to restore lost
                    checklists.
                  </li>
                  <li>
                    Alternative career objectives are not yet implemented.
                  </li>
                  <li>
                    Races from the JP version of the game are included which may
                    not be present in EN yet.
                  </li>
                  <li>
                    Debut and scenario specific races are hidden and not counted
                    in the win total. Debut race is not taken into account for
                    turn count before your first scheduled race post debut.
                  </li>
                  <li>
                    Loading a new checklist will always clear old optional
                    races, to keep selected optional races, select a different
                    character instead.
                  </li>
                  <li>
                    Choosing races and finding a character that can run those
                    races is not supported. Please use GameTora for that
                    functionality.
                  </li>
                  <li>
                    Race notes are race specific so when running the same race
                    for different Umas you will see the stats you recorded
                    before. Keep in mind each Uma is different, stats that work
                    for one Uma might not work for another.
                  </li>
                  <li>
                    If you skip a race early for any reason, ie: low stats, the
                    turn counter will not be accurate as it calculates turns
                    based on the most recent race.
                  </li>
                </ul>
              </div>
            )}
          </div>
          <div className="panel-section">
            <CollapsibleHeader
              title="Data Sources/Inspiration"
              isOpen={panelsOpen.sources}
              onToggle={() => togglePanel("sources")}
            />
            {panelsOpen.sources && (
              <div className="data-source">
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
            )}
          </div>
        </div>
        <div className="race-list-panel">
          <div className="race-list-header">
            <div className="race-list-title-group">
              <h2>Available Races ({displayRaces.length})</h2>
              <input
                type="text"
                placeholder="Search race name..."
                className="search-bar"
                style={{ marginBottom: 0, width: "200px" }}
                value={raceSearchTerm}
                onChange={(e) => setRaceSearchTerm(e.target.value)}
              />
            </div>
            <div className="race-list-actions">
              <button
                className="generate-button"
                onClick={() => setPage("checklist")}
                disabled={totalSelectedCount === 0}
              >
                View Checklist ({totalSelectedCount})
              </button>
            </div>
            <div className="grade-counter">
              <span className="counter-label">Grades:</span>
              <span>G1: {gradeCounts.G1}</span>
              <span>G2: {gradeCounts.G2}</span>
              <span>G3: {gradeCounts.G3}</span>
              <span className="counter-label">Distances:</span>
              <span>Sprint: {distanceCounts.sprint}</span>
              <span>Mile: {distanceCounts.mile}</span>
              <span>Medium: {distanceCounts.medium}</span>
              <span>Long: {distanceCounts.long}</span>
            </div>
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
                  const rowClass = getRaceRowClass(race);
                  const gradeBubbleClass = getGradeBubbleClass(race);

                  const isDateGroupStart =
                    lastDate !== null && race.date !== lastDate;
                  lastDate = race.date;

                  return (
                    <tr
                      key={race.id}
                      className={`${rowClass} ${
                        isDateGroupStart ? "date-group-start" : ""
                      }`}
                    >
                      <td>
                        <input
                          type="checkbox"
                          checked={combinedRaceIds.has(race.id)}
                          onChange={() => handleRaceCheck(race)}
                          disabled={!isNoCareerMode && isCareerRace}
                        />
                      </td>
                      <td className="status-column">
                        {warningRaceIds.has(race.id) && (
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
                      <td>
                        <span className={gradeBubbleClass}>
                          {gradeNameMap[race.grade] || race.grade}
                        </span>
                      </td>
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
            {showBackToTop && (
              <button className="back-to-top-button" onClick={scrollToTop}>
                ↑
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

export default Planner;
