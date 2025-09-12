// src/App.js
import React, { useState, useEffect } from "react";
import Planner from "./Planner";
import Checklist from "./Checklist";
import "./App.css";

function App() {
  // --- CORE STATE ---
  const [page, setPage] = useState("planner");
  const [allRaces, setAllRaces] = useState([]);
  const [allCharacters, setAllCharacters] = useState([]);
  const [raceExclusivity, setRaceExclusivity] = useState(new Map());

  // --- LIFTED STATE FOR PERSISTENCE ---
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCharacter, setSelectedCharacter] = useState(null);
  const [modifiedAptitudes, setModifiedAptitudes] = useState(null);
  const [selectedRaces, setSelectedRaces] = useState(new Set());
  const [checklistData, setChecklistData] = useState({});
  const [savedChecklists, setSavedChecklists] = useState([]);
  // NEW: Filters are now managed here so they can be saved and restored
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

  // --- DATA FETCHING & INITIAL LOAD ---
  useEffect(() => {
    Promise.all([
      fetch("/data/races.json").then((res) => res.json()),
      fetch("/data/characters.json").then((res) => res.json()),
    ]).then(([raceData, charData]) => {
      setAllRaces(raceData);
      setAllCharacters(charData.sort((a, b) => a.name.localeCompare(b.name)));
      const counts = new Map();
      raceData.forEach((race) =>
        counts.set(race.name, (counts.get(race.name) || 0) + 1)
      );
      setRaceExclusivity(counts);
    });
    try {
      const storedChecklists = localStorage.getItem("umamusume-checklists");
      if (storedChecklists) setSavedChecklists(JSON.parse(storedChecklists));
    } catch (error) {
      console.error("Error parsing checklists from localStorage:", error);
    }
  }, []);

  // --- HANDLERS ---
  const handleChecklistDataChange = (raceId, field, value) => {
    setChecklistData((prev) => {
      const currentData = prev[raceId] || { ran: false, won: false, notes: "" };
      const newData = { ...currentData, [field]: value };
      if (field === "won" && value === true) newData.ran = true;
      if (field === "ran" && value === false) newData.won = false;
      return { ...prev, [raceId]: newData };
    });
  };

  const updateLocalStorage = (newChecklists) => {
    setSavedChecklists(newChecklists);
    localStorage.setItem("umamusume-checklists", JSON.stringify(newChecklists));
  };

  // NEW: Handler to reset Ran/Won status
  const handleResetChecklistStatus = () => {
    if (
      window.confirm(
        "Are you sure you want to reset all 'Ran' and 'Won' statuses for this checklist? Notes will be kept."
      )
    ) {
      setChecklistData((prev) => {
        const newData = { ...prev };
        Object.keys(newData).forEach((raceId) => {
          newData[raceId] = { ...newData[raceId], ran: false, won: false };
        });
        return newData;
      });
    }
  };

  // NEW: Handler to clear all notes
  const handleClearChecklistNotes = () => {
    if (
      window.confirm(
        "Are you sure you want to clear all notes for this checklist? Ran/Won statuses will be kept."
      )
    ) {
      setChecklistData((prev) => {
        const newData = { ...prev };
        Object.keys(newData).forEach((raceId) => {
          newData[raceId] = { ...newData[raceId], notes: "" };
        });
        return newData;
      });
    }
  };

  const handleSaveChecklist = (name) => {
    // FIX: Include filters in the saved object
    const newChecklist = {
      name,
      characterName: selectedCharacter?.name || "Unknown",
      modifiedAptitudes,
      selectedRaceIds: Array.from(selectedRaces),
      checklistData,
      filters,
      gradeFilters,
      showOptionalGrades, // Save all filter states
      savedAt: new Date().toISOString(),
    };
    const existingIndex = savedChecklists.findIndex((c) => c.name === name);
    let newChecklists;
    if (existingIndex > -1) {
      // FIX: Add confirmation before overwriting an existing checklist
      if (
        window.confirm(
          `A checklist named "${name}" already exists. Do you want to overwrite it?`
        )
      ) {
        newChecklists = [...savedChecklists];
        newChecklists[existingIndex] = newChecklist;
      } else {
        return; // User cancelled the overwrite
      }
    } else {
      newChecklists = [...savedChecklists, newChecklist];
    }
    updateLocalStorage(newChecklists);
    alert(`Checklist "${name}" saved!`);
  };

  const handleLoadChecklist = (name) => {
    const checklistToLoad = savedChecklists.find((c) => c.name === name);
    if (checklistToLoad) {
      const character = allCharacters.find(
        (c) => c.name === checklistToLoad.characterName
      );
      if (character) {
        setSelectedCharacter(character);
        setSearchTerm(character.name);
      }
      // Restore all state, including filters
      setModifiedAptitudes(checklistToLoad.modifiedAptitudes);
      setSelectedRaces(new Set(checklistToLoad.selectedRaceIds));
      setChecklistData(checklistToLoad.checklistData || {});
      setFilters(
        checklistToLoad.filters || {
          trackIsAPlus: false,
          distanceIsAPlus: false,
          hideNonHighlighted: false,
        }
      );
      setGradeFilters(
        checklistToLoad.gradeFilters || { G1: true, G2: true, G3: true }
      );
      setShowOptionalGrades(checklistToLoad.showOptionalGrades || false);
      alert(`Checklist "${name}" loaded!`);
    }
  };

  const handleDeleteChecklist = (name) => {
    if (window.confirm(`Are you sure you want to delete "${name}"?`)) {
      updateLocalStorage(savedChecklists.filter((c) => c.name !== name));
    }
  };
  const handleRenameChecklist = (oldName, newName) => {
    if (!newName || newName.trim() === "") {
      alert("New name cannot be empty.");
      return;
    }
    if (savedChecklists.some((c) => c.name === newName)) {
      alert("A checklist with that name already exists.");
      return;
    }
    updateLocalStorage(
      savedChecklists.map((c) =>
        c.name === oldName ? { ...c, name: newName } : c
      )
    );
  };
  const handleImportChecklists = (importedChecklists) => {
    if (
      window.confirm(`This will overwrite all saved checklists. Are you sure?`)
    ) {
      updateLocalStorage(importedChecklists);
      alert(`Imported ${importedChecklists.length} checklists!`);
    }
  };

  const plannerProps = {
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
  };

  const checklistProps = {
    races: allRaces.filter((r) => selectedRaces.has(r.id)),
    checklistData,
    onChecklistDataChange: handleChecklistDataChange,
    setPage,
    onResetStatus: handleResetChecklistStatus,
    onClearNotes: handleClearChecklistNotes,
  };

  return (
    <div className="App">
      <header className="App-header">
        <h1>Umamusume Race Scheduler</h1>
      </header>
      <main>
        {page === "planner" && <Planner {...plannerProps} />}
        {page === "checklist" && <Checklist {...checklistProps} />}
      </main>
    </div>
  );
}

export default App;
