import React, { useState, useEffect, useMemo } from "react";
import toast, { Toaster } from "react-hot-toast";
import Planner from "./Planner";
import Checklist from "./Checklist";
import ThemeToggle from "./ThemeToggle";
import "./App.css";
import raceData from "./data/races.json";
import charData from "./data/characters.json";

const ConfirmationToast = ({ t, onConfirm, onCancel, message }) => (
  <div className="confirmation-toast">
    <span>{message}</span>
    <div className="toast-buttons">
      {/* UPDATED: Swapped button order */}
      <button
        className="toast-button cancel"
        onClick={() => {
          if (onCancel) onCancel();
          toast.dismiss(t.id);
        }}
      >
        Cancel
      </button>
      <button
        className="toast-button confirm"
        onClick={() => {
          onConfirm();
          toast.dismiss(t.id);
        }}
      >
        Confirm
      </button>
    </div>
  </div>
);

const getTurnValue = (dateString) => {
  const yearMatch = dateString.match(/Junior|Year 1/i)
    ? 1
    : dateString.match(/Classic|Year 2/i)
    ? 2
    : dateString.match(/Senior|Year 3/i)
    ? 3
    : 0;
  const monthMap = {
    January: 1,
    February: 2,
    March: 3,
    April: 4,
    May: 5,
    June: 6,
    July: 7,
    August: 8,
    September: 9,
    October: 10,
    November: 11,
    December: 12,
  };
  const monthMatch = dateString.match(
    /(January|February|March|April|May|June|July|August|September|October|November|December)/i
  );
  const halfMatch = dateString.match(/(Early|Late)/i);
  if (!yearMatch || !monthMatch || !halfMatch) return -1;
  const month = monthMap[monthMatch[0]];
  const half = halfMatch[0] === "Early" ? 1 : 2;
  return (yearMatch - 1) * 24 + (month - 1) * 2 + half;
};

function App() {
  // --- NEW: Dark Mode State Management ---
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const savedTheme = localStorage.getItem("theme");
    if (savedTheme) {
      return savedTheme === "dark";
    }
    // If no theme is saved, use the user's system preference
    return (
      window.matchMedia &&
      window.matchMedia("(prefers-color-scheme: dark)").matches
    );
  });

  useEffect(() => {
    if (isDarkMode) {
      document.body.classList.add("dark-mode");
      localStorage.setItem("theme", "dark");
    } else {
      document.body.classList.remove("dark-mode");
      localStorage.setItem("theme", "light");
    }
  }, [isDarkMode]);
  // --- END of Dark Mode State Management ---

  const [page, setPage] = useState("planner");
  const [allRaces, setAllRaces] = useState([]);
  // ... (rest of your state variables remain the same) ...
  const [allCharacters, setAllCharacters] = useState([]);
  const [raceExclusivity, setRaceExclusivity] = useState(new Map());
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCharacter, setSelectedCharacter] = useState(null);
  const [modifiedAptitudes, setModifiedAptitudes] = useState(null);
  const [selectedRaces, setSelectedRaces] = useState(new Set());
  const [checklistData, setChecklistData] = useState({});
  const [savedChecklists, setSavedChecklists] = useState([]);
  const [filters, setFilters] = useState({
    trackAptitude: "A",
    distanceAptitude: "A",
    hideNonHighlighted: false,
    hideSummer: false,
  });
  const [gradeFilters, setGradeFilters] = useState({
    G1: true,
    G2: true,
    G3: true,
  });
  const [showOptionalGrades, setShowOptionalGrades] = useState(false);
  const [careerRaceIds, setCareerRaceIds] = useState(new Set());

  useEffect(() => {
    const racesWithTurns = raceData.map((race) => ({
      ...race,
      turnValue: getTurnValue(race.date),
    }));
    const transformedCharData = charData.map((char) => {
      const newAptitudes = { ...char.aptitudes };
      if (newAptitudes.short !== undefined) {
        newAptitudes.sprint = newAptitudes.short;
        delete newAptitudes.short;
      }
      return { ...char, aptitudes: newAptitudes };
    });
    setAllRaces(racesWithTurns);
    setAllCharacters(
      transformedCharData.sort((a, b) => a.name.localeCompare(b.name))
    );
    const counts = new Map();
    raceData.forEach((race) =>
      counts.set(race.name, (counts.get(race.name) || 0) + 1)
    );
    setRaceExclusivity(counts);
    try {
      const storedChecklists = localStorage.getItem("umamusume-checklists");
      if (storedChecklists) setSavedChecklists(JSON.parse(storedChecklists));
    } catch (error) {
      console.error("Error parsing checklists from localStorage:", error);
      localStorage.removeItem("umamusume-checklists");
    }
  }, []);

  // ... (all your other useMemo hooks and handlers remain exactly the same) ...
  const warningRaceIds = useMemo(() => {
    const warnings = new Set();
    if (selectedRaces.size < 3) return warnings;
    const sortedSelectedRaces = allRaces
      .filter((race) => selectedRaces.has(race.id))
      .sort((a, b) => a.turnValue - b.turnValue);
    for (let i = 2; i < sortedSelectedRaces.length; i++) {
      const race3 = sortedSelectedRaces[i];
      const race2 = sortedSelectedRaces[i - 1];
      const race1 = sortedSelectedRaces[i - 2];
      const isConsecutive =
        race3.turnValue === race2.turnValue + 1 &&
        race2.turnValue === race1.turnValue + 1;
      if (isConsecutive && !careerRaceIds.has(race3.id)) {
        warnings.add(race3.id);
      }
    }
    return warnings;
  }, [selectedRaces, careerRaceIds, allRaces]);

  const gradeCounts = useMemo(() => {
    const counts = { G1: 0, G2: 0, G3: 0 };
    selectedRaces.forEach((raceId) => {
      const race = allRaces.find((r) => r.id === raceId);
      if (race && counts[race.grade] !== undefined) {
        counts[race.grade]++;
      }
    });
    return counts;
  }, [selectedRaces, allRaces]);

  const wonCount = useMemo(() => {
    return Array.from(selectedRaces).filter(
      (raceId) => checklistData[raceId]?.won
    ).length;
  }, [selectedRaces, checklistData]);

  const allHandlers = useMemo(
    () => ({
      handleChecklistDataChange: (raceId, field, value) => {
        setChecklistData((prev) => {
          const currentData = prev[raceId] || {
            ran: false,
            won: false,
            notes: "",
          };
          const newData = { ...currentData, [field]: value };
          if (field === "won" && value === true) newData.ran = true;
          if (field === "ran" && value === false) newData.won = false;
          return { ...prev, [raceId]: newData };
        });
      },
      updateLocalStorage: (newChecklists) => {
        setSavedChecklists(newChecklists);
        localStorage.setItem(
          "umamusume-checklists",
          JSON.stringify(newChecklists)
        );
      },
      handleResetChecklistStatus: () => {
        const resetAction = () => {
          setChecklistData((prev) => {
            const newData = { ...prev };
            Object.keys(newData).forEach((raceId) => {
              newData[raceId] = { ...newData[raceId], ran: false, won: false };
            });
            return newData;
          });
          toast.success("Ran/Won statuses have been reset.");
        };
        toast(
          (t) => (
            <ConfirmationToast
              t={t}
              onConfirm={resetAction}
              message="Reset all 'Ran' and 'Won' statuses? Notes will be kept."
            />
          ),
          { duration: Infinity }
        );
      },
      handleClearChecklistNotes: () => {
        const clearAction = () => {
          setChecklistData((prev) => {
            const newData = { ...prev };
            Object.keys(newData).forEach((raceId) => {
              newData[raceId] = { ...newData[raceId], notes: "" };
            });
            return newData;
          });
          toast.success("All notes have been cleared.");
        };
        toast(
          (t) => (
            <ConfirmationToast
              t={t}
              onConfirm={clearAction}
              message="Clear all notes? Ran/Won statuses will be kept."
            />
          ),
          { duration: Infinity }
        );
      },
      handleSaveChecklist: (name) => {
        const newChecklist = {
          name,
          characterName: selectedCharacter?.name || "Unknown",
          modifiedAptitudes,
          selectedRaceIds: Array.from(selectedRaces),
          checklistData,
          filters,
          gradeFilters,
          showOptionalGrades,
          savedAt: new Date().toISOString(),
        };
        const existingIndex = savedChecklists.findIndex((c) => c.name === name);
        if (existingIndex > -1) {
          const overwriteAction = () => {
            const newChecklists = [...savedChecklists];
            newChecklists[existingIndex] = newChecklist;
            allHandlers.updateLocalStorage(newChecklists);
            toast.success(`Checklist "${name}" overwritten!`);
          };
          toast(
            (t) => (
              <ConfirmationToast
                t={t}
                onConfirm={overwriteAction}
                message={`Overwrite existing checklist "${name}"?`}
              />
            ),
            { duration: Infinity }
          );
        } else {
          const newChecklists = [...savedChecklists, newChecklist];
          allHandlers.updateLocalStorage(newChecklists);
          toast.success(`Checklist "${name}" saved!`);
        }
      },
      handleLoadChecklist: (name) => {
        const checklistToLoad = savedChecklists.find((c) => c.name === name);
        if (checklistToLoad) {
          const character = allCharacters.find(
            (c) => c.name === checklistToLoad.characterName
          );
          if (character) {
            setSelectedCharacter(character);
            setSearchTerm(character.name);
          }
          setModifiedAptitudes(checklistToLoad.modifiedAptitudes);
          setSelectedRaces(new Set(checklistToLoad.selectedRaceIds));
          setChecklistData(checklistToLoad.checklistData || {});
          setFilters(
            checklistToLoad.filters || {
              trackAptitude: "A",
              distanceAptitude: "A",
              hideNonHighlighted: false,
              hideSummer: false,
            }
          );
          setGradeFilters(
            checklistToLoad.gradeFilters || { G1: true, G2: true, G3: true }
          );
          setShowOptionalGrades(checklistToLoad.showOptionalGrades || false);
          toast.success(`Checklist "${name}" loaded!`);
        }
      },
      handleDeleteChecklist: (name) => {
        const deleteAction = () => {
          allHandlers.updateLocalStorage(
            savedChecklists.filter((c) => c.name !== name)
          );
          toast.success(`Deleted "${name}".`);
        };
        toast(
          (t) => (
            <ConfirmationToast
              t={t}
              onConfirm={deleteAction}
              message={`Delete checklist "${name}"? This cannot be undone.`}
            />
          ),
          { duration: Infinity }
        );
      },
      handleRenameChecklist: (oldName, newName) => {
        if (!newName || newName.trim() === "") {
          toast.error("New name cannot be empty.");
          return;
        }
        if (savedChecklists.some((c) => c.name === newName)) {
          toast.error("A checklist with that name already exists.");
          return;
        }
        allHandlers.updateLocalStorage(
          savedChecklists.map((c) =>
            c.name === oldName ? { ...c, name: newName } : c
          )
        );
        toast.success(`Renamed to "${newName}".`);
      },
      handleImportChecklists: (importedChecklists) => {
        if (!Array.isArray(importedChecklists)) {
          toast.error(
            "Import failed: File data is not a valid checklist array."
          );
          return;
        }
        const validatedChecklists = [];
        for (const item of importedChecklists) {
          if (
            typeof item === "object" &&
            item !== null &&
            typeof item.name === "string" &&
            Array.isArray(item.selectedRaceIds)
          ) {
            const sanitizedItem = {
              name: String(item.name).slice(0, 100),
              characterName: String(item.characterName || "Unknown"),
              modifiedAptitudes: item.modifiedAptitudes || null,
              selectedRaceIds: item.selectedRaceIds,
              checklistData: item.checklistData || {},
              filters: item.filters || {},
              gradeFilters: item.gradeFilters || {},
              showOptionalGrades: !!item.showOptionalGrades,
              savedAt: item.savedAt || new Date().toISOString(),
            };
            validatedChecklists.push(sanitizedItem);
          }
        }
        if (validatedChecklists.length !== importedChecklists.length) {
          toast(
            "Warning: Some checklists in the file appeared to be malformed and were skipped.",
            { icon: "⚠️" }
          );
        }
        if (validatedChecklists.length > 0) {
          const importAction = () => {
            allHandlers.updateLocalStorage(validatedChecklists);
            toast.success(`Imported ${validatedChecklists.length} checklists!`);
          };
          toast(
            (t) => (
              <ConfirmationToast
                t={t}
                onConfirm={importAction}
                message={`This will overwrite all current checklists with ${validatedChecklists.length} imported one(s). Are you sure?`}
              />
            ),
            { duration: Infinity }
          );
        } else {
          toast.error("Import failed: No valid checklists found in the file.");
        }
      },
    }),
    [
      savedChecklists,
      selectedCharacter,
      modifiedAptitudes,
      selectedRaces,
      checklistData,
      filters,
      gradeFilters,
      showOptionalGrades,
      allCharacters,
    ]
  );

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
    ...allHandlers,
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
  };
  const checklistProps = {
    races: allRaces
      .filter((r) => selectedRaces.has(r.id))
      .sort((a, b) => a.turnValue - b.turnValue),
    checklistData,
    onChecklistDataChange: allHandlers.handleChecklistDataChange,
    setPage,
    onResetStatus: allHandlers.handleResetChecklistStatus,
    onClearNotes: allHandlers.handleClearChecklistNotes,
    warningRaceIds,
    gradeCounts,
    wonCount,
  };

  return (
    <div className="App">
      <Toaster position="top-center" reverseOrder={false} />
      <header className="App-header">
        <h1>Umamusume Race Scheduler</h1>
        {/* NEW: Render the toggle and pass props */}
        <ThemeToggle
          isDarkMode={isDarkMode}
          onToggle={() => setIsDarkMode(!isDarkMode)}
        />
      </header>
      <main>
        {page === "planner" && <Planner {...plannerProps} />}
        {page === "checklist" && <Checklist {...checklistProps} />}
      </main>
    </div>
  );
}

export default App;
