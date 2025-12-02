import React, { useState, useEffect, useMemo, useCallback } from "react";
import toast, { Toaster } from "react-hot-toast";
import Planner from "./Planner";
import Checklist from "./Checklist";
import CalendarView from "./CalendarView";
import ThemeToggle from "./ThemeToggle";
import Modal from "./Modal";
import "./App.css";
import raceData from "./data/races_detailed.json";
import charData from "./data/characters.json";
import epithetData from "./data/epithets.json";
import fanOverrides from "./data/fan_overrides.json";

const APTITUDE_VALUES = { S: 6, A: 5, B: 4, C: 3, D: 2, E: 1, F: 0, G: -1 };
const FAN_PLACEMENT_MULTIPLIERS = {
  1: 1.0, // 1st Place
  2: 0.4, // 2nd Place
  3: 0.25, // 3rd Place
  4: 0.15, // 4th Place
  5: 0.1, // 5th Place
};

/**
 * Calculates the fan reward for a given placement based on the 1st place prize.
 * @param {number} firstPlaceFans - The number of fans for 1st place.
 * @param {number} placement - The placement to calculate for (e.g., 2 for 2nd).
 * @returns {number} The calculated number of fans, rounded.
 */
export const calculateFansByPlacement = (firstPlaceFans, placement) => {
  const multiplier = FAN_PLACEMENT_MULTIPLIERS[placement];
  if (typeof firstPlaceFans !== "number" || !multiplier) {
    return 0;
  }
  return Math.round(firstPlaceFans * multiplier);
};
export const getDistanceCategory = (distance) => {
  if (distance < 1600) return "sprint";
  if (distance <= 1800) return "mile";
  if (distance <= 2400) return "medium";
  return "long";
};

const AUTOSAVE_KEY = "umamusume-autosave-session";

const migrateYearFilters = (filters) => {
  if (filters && filters["Year 1"] !== undefined) {
    return {
      "Junior Year": filters["Year 1"],
      "Classic Year": filters["Year 2"],
      "Senior Year": filters["Year 3"],
    };
  }
  return filters;
};

const loadAutosavedState = () => {
  try {
    const savedStateJSON = localStorage.getItem(AUTOSAVE_KEY);
    if (savedStateJSON) {
      const state = JSON.parse(savedStateJSON);

      if (state.yearFilters) {
        state.yearFilters = migrateYearFilters(state.yearFilters);
      }
      return state;
    }
  } catch (error) {
    console.error("Failed to parse autosaved state:", error);
    localStorage.removeItem(AUTOSAVE_KEY);
  }
  return null;
};

const initialAutosavedState = loadAutosavedState();

const getTurnValue = (dateString) => {
  const yearMatch = dateString.match(/Junior/i)
    ? 1
    : dateString.match(/Classic/i)
    ? 2
    : dateString.match(/Senior/i)
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

const normalizeDateForMatching = (dateString) => {
  const yearMatch = dateString.match(/Junior/i)
    ? "Y1"
    : dateString.match(/Classic/i)
    ? "Y2"
    : dateString.match(/Senior/i)
    ? "Y3"
    : null;
  const monthMatch = dateString.match(
    /(January|February|March|April|May|June|July|August|September|October|November|December)/i
  );
  const halfMatch = dateString.match(/(Early|Late)/i);
  if (!yearMatch || !monthMatch || !halfMatch) return null;
  return `${yearMatch}-${monthMatch[0]}-${halfMatch[0]}`;
};

const getCareerRacesForCharUtil = (character, allRaces) => {
  const ids = new Set();
  if (!character || !character.careerObjectives) return ids;

  character.careerObjectives.forEach((obj) => {
    if (obj.type === "Race") {
      const processObjective = (objective) => {
        if (!objective) return;
        const raceNameMatch = objective.description.match(
          /(?:in the|the)\s+([^,]+)/
        );
        if (!raceNameMatch) return;
        const raceName = raceNameMatch[1].trim();
        if (raceName.toLowerCase().includes("make debut")) return;

        let details = objective.details;
        details = details.replace(/Year 1/i, "Junior");
        details = details.replace(/Year 2/i, "Classic");
        details = details.replace(/Year 3/i, "Senior");
        const normalizedDate = normalizeDateForMatching(details);

        if (!normalizedDate) return;
        const foundRace = allRaces.find((race) => {
          const raceDate = normalizeDateForMatching(race.date);
          return (
            race.name.trim() === raceName &&
            raceDate &&
            raceDate.startsWith(normalizedDate)
          );
        });
        if (foundRace) {
          ids.add(foundRace.id);
        } else {
          console.warn(
            `Career objective race "${raceName}" on date "${details}" not found in master race list for character ${character.name}.`
          );
        }
      };
      processObjective(obj);
    }
  });
  return ids;
};

const calculateWarningIds = (raceIdSet, allRaces, careerRaceIds) => {
  const warnings = new Set();
  if (raceIdSet.size < 3) return warnings;

  const sortedSelectedRaces = allRaces
    .filter((race) => raceIdSet.has(race.id))
    .sort((a, b) => a.turnValue - b.turnValue);

  for (let i = 2; i < sortedSelectedRaces.length; i++) {
    const race3 = sortedSelectedRaces[i];
    const race2 = sortedSelectedRaces[i - 1];
    const race1 = sortedSelectedRaces[i - 2];

    const isConsecutive =
      race3.turnValue === race2.turnValue + 1 &&
      race2.turnValue === race1.turnValue + 1;

    if (isConsecutive) {
      if (!careerRaceIds.has(race3.id)) {
        warnings.add(race3.id);
      }
    }
  }
  return warnings;
};

const ConfirmationToast = ({ t, onConfirm, onCancel, message }) => {
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Enter") {
        onConfirm();
        toast.dismiss(t.id);
      } else if (e.key === "Escape") {
        if (onCancel) onCancel();
        toast.dismiss(t.id);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [t, onConfirm, onCancel]);

  return (
    <div className="confirmation-toast">
      <span>{message}</span>
      <div className="toast-buttons">
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
};

function App() {
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const savedTheme = localStorage.getItem("theme");
    if (savedTheme) {
      return savedTheme === "dark";
    }
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

  const [page, setPage] = useState("planner");
  const [previousPage, setPreviousPage] = useState("planner");

  const navigateTo = (newPage) => {
    setPreviousPage(page);
    setPage(newPage);
  };
  const [allRaces, setAllRaces] = useState([]);
  const [allCharacters, setAllCharacters] = useState([]);
  const [raceExclusivity, setRaceExclusivity] = useState(new Map());
  const [isAppInitialized, setIsAppInitialized] = useState(false);
  const [lastAction, setLastAction] = useState(null);

  const handleUndo = useCallback(() => {
    if (lastAction && lastAction.undo) {
      lastAction.undo();
      setLastAction(null);
    }
  }, [lastAction]);

  const performActionWithUndo = useCallback(
    (actionFn, message, beforeState) => {
      actionFn();
      setLastAction({
        message,
        undo: () => {
          setSelectedRaces(beforeState.selectedRaces);
          setSmartAddedRaceIds(beforeState.smartAddedRaceIds);
          setChecklistData(beforeState.checklistData);
          toast.success("Action undone!", { duration: 3000 });
        },
      });
    },
    []
  );

  const [searchTerm, setSearchTerm] = useState(
    initialAutosavedState?.searchTerm ?? ""
  );
  const [selectedCharacter, setSelectedCharacter] = useState(null);
  const [modifiedAptitudes, setModifiedAptitudes] = useState(
    initialAutosavedState?.modifiedAptitudes || null
  );
  const [selectedRaces, setSelectedRaces] = useState(
    new Set(initialAutosavedState?.selectedRaces || [])
  );
  const [checklistData, setChecklistData] = useState(
    initialAutosavedState?.checklistData || {}
  );
  const [filters, setFilters] = useState(
    initialAutosavedState?.filters || {
      trackAptitude: "B",
      distanceAptitude: "A",
      hideNonHighlighted: true,
      hideSummer: true,
      preventWarningAdd: true,
    }
  );
  const [gradeFilters, setGradeFilters] = useState(
    initialAutosavedState?.gradeFilters || { G1: true, G2: true, G3: true }
  );
  const [yearFilters, setYearFilters] = useState(
    initialAutosavedState?.yearFilters || {
      "Junior Year": true,
      "Classic Year": true,
      "Senior Year": true,
    }
  );
  const [trackFilters, setTrackFilters] = useState(
    initialAutosavedState?.trackFilters || { Turf: true, Dirt: true }
  );
  const [distanceFilters, setDistanceFilters] = useState(
    initialAutosavedState?.distanceFilters || {
      sprint: true,
      mile: true,
      medium: true,
      long: true,
    }
  );

  const [showOptionalGrades, setShowOptionalGrades] = useState(
    initialAutosavedState?.showOptionalGrades ?? false
  );
  const [isNoCareerMode, setIsNoCareerMode] = useState(
    initialAutosavedState?.isNoCareerMode ?? false
  );
  const [alwaysShowCareer, setAlwaysShowCareer] = useState(
    initialAutosavedState?.alwaysShowCareer ?? true
  );
  const [smartAddedRaceIds, setSmartAddedRaceIds] = useState(
    new Set(initialAutosavedState?.smartAddedRaceIds || [])
  );

  const [savedChecklists, setSavedChecklists] = useState([]);
  const [currentChecklistName, setCurrentChecklistName] = useState(null);
  const [careerRaceIds, setCareerRaceIds] = useState(new Set());

  const [overwriteModal, setOverwriteModal] = useState({
    isOpen: false,
    name: "",
    onConfirm: () => {},
  });
  const [importConflictModal, setImportConflictModal] = useState({
    isOpen: false,
    checklistToImport: null,
  });

  const [fanBonus, setFanBonus] = useState(
    initialAutosavedState?.fanBonus ?? 0
  );
  const [showOnlySelected, setShowOnlySelected] = useState(false);
  const [isCompactMode, setIsCompactMode] = useState(
    initialAutosavedState?.isCompactMode ?? false
  );

  const raceMap = useMemo(() => {
    return new Map(allRaces.map((race) => [race.id, race]));
  }, [allRaces]);

  useEffect(() => {
    if (
      !raceData ||
      raceData.length === 0 ||
      !charData ||
      charData.length === 0
    ) {
      toast.error(
        "Critical data files failed to load. The app cannot continue. Please try refreshing the page.",
        { duration: Infinity }
      );
      console.error("raceData or charData is empty or failed to load.");
      setIsAppInitialized(false);
      return;
    }
    let processedRaces = raceData.map((race) => {
      let date = race.date;
      date = date.replace(/Year 1/i, "Junior Year");
      date = date.replace(/Year 2/i, "Classic Year");
      date = date.replace(/Year 3/i, "Senior Year");
      return {
        ...race,
        date,
        turnValue: getTurnValue(date),
      };
    });

    processedRaces = processedRaces.map((race) => {
      const originalFans = race.fans_gained;
      if (fanOverrides[String(originalFans)] !== undefined) {
        return { ...race, fans_gained: fanOverrides[String(originalFans)] };
      }
      return race;
    });

    setAllRaces(processedRaces);

    const transformedCharData = charData.map((char) => {
      const newAptitudes = { ...char.aptitudes };
      if (newAptitudes.short !== undefined) {
        newAptitudes.sprint = newAptitudes.short;
        delete newAptitudes.short;
      }
      return { ...char, aptitudes: newAptitudes };
    });
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
    setIsAppInitialized(true);
  }, []);

  useEffect(() => {
    if (
      allCharacters.length > 0 &&
      initialAutosavedState?.selectedCharacterName
    ) {
      const character = allCharacters.find(
        (c) => c.name === initialAutosavedState.selectedCharacterName
      );
      if (character) {
        setSelectedCharacter(character);
        if (!initialAutosavedState.modifiedAptitudes) {
          setModifiedAptitudes({ ...character.aptitudes });
        }
        const newCareerRaceIds = getCareerRacesForCharUtil(character, allRaces);
        setCareerRaceIds(newCareerRaceIds);
      }
    }
  }, [allCharacters, allRaces]);

  useEffect(() => {
    if (!isAppInitialized) {
      return;
    }
    const stateToSave = {
      searchTerm,
      selectedCharacterName: selectedCharacter ? selectedCharacter.name : null,
      modifiedAptitudes,
      selectedRaces: Array.from(selectedRaces),
      checklistData,
      filters,
      gradeFilters,
      yearFilters,
      trackFilters,
      distanceFilters,
      showOptionalGrades,
      isNoCareerMode,
      alwaysShowCareer,
      smartAddedRaceIds: Array.from(smartAddedRaceIds),
      fanBonus,
      isCompactMode,
    };
    try {
      localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(stateToSave));
    } catch (error) {
      if (error.name === "QuotaExceededError") {
        toast.error(
          "Browser storage is full. Cannot save session. Please clear some space or your changes may be lost.",
          { duration: 10000 }
        );
      } else {
        console.error("Failed to autosave state:", error);
      }
    }
  }, [
    isAppInitialized,
    searchTerm,
    selectedCharacter,
    modifiedAptitudes,
    selectedRaces,
    checklistData,
    filters,
    gradeFilters,
    yearFilters,
    trackFilters,
    distanceFilters,
    showOptionalGrades,
    isNoCareerMode,
    alwaysShowCareer,
    smartAddedRaceIds,
    fanBonus,
    isCompactMode,
  ]);

  const combinedRaceIds = useMemo(
    () => new Set([...selectedRaces, ...smartAddedRaceIds]),
    [selectedRaces, smartAddedRaceIds]
  );

  const warningRaceIds = useMemo(
    () => calculateWarningIds(combinedRaceIds, allRaces, careerRaceIds),
    [combinedRaceIds, allRaces, careerRaceIds]
  );

  const { gradeCounts, distanceCounts, wonCount, totalBaseFans } =
    useMemo(() => {
      const counts = { G1: 0, G2: 0, G3: 0 };
      const distCounts = { sprint: 0, mile: 0, medium: 0, long: 0 };
      let localWonCount = 0;
      let fans = 0;

      combinedRaceIds.forEach((raceId) => {
        const race = raceMap.get(raceId);
        if (race) {
          if (counts[race.grade] !== undefined) {
            counts[race.grade]++;
          }
          const category = getDistanceCategory(race.distance);
          if (distCounts[category] !== undefined) {
            distCounts[category]++;
          }

          if (typeof race.fans_gained === "number" && race.fans_gained > 100) {
            fans += race.fans_gained;
          }
        }
        if (checklistData[raceId]?.won) {
          localWonCount++;
        }
      });

      return {
        gradeCounts: counts,
        distanceCounts: distCounts,
        wonCount: localWonCount,
        totalBaseFans: fans,
      };
    }, [combinedRaceIds, raceMap, checklistData]);

  const estimatedTotalFans = useMemo(() => {
    const bonus = 1 + (Number(fanBonus) || 0) / 100;
    return Math.round(totalBaseFans * bonus);
  }, [totalBaseFans, fanBonus]);

  const getCareerRacesForChar = useCallback(
    (character) => {
      return getCareerRacesForCharUtil(character, allRaces);
    },
    [allRaces]
  );

  const epithetStatus = useMemo(() => {
    if (!selectedCharacter || !modifiedAptitudes) {
      return [];
    }

    const careerRaceDates = new Map();
    careerRaceIds.forEach((id) => {
      const race = raceMap.get(id);
      if (race) careerRaceDates.set(race.date, race.name);
    });

    const isRaceSuitable = (race) => {
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
    };

    return epithetData.map((epithet) => {
      const requiredRaces = epithet.races.flatMap((name) =>
        allRaces.filter((r) => r.name === name)
      );

      let status = "available";
      let isRecommended = true;
      let conflictReason = "";

      const uniqueRequiredRaces = [
        ...new Map(
          requiredRaces
            .sort((a, b) => b.turnValue - a.turnValue)
            .map((r) => [r.name, r])
        ).values(),
      ];

      const completedRaces = uniqueRequiredRaces.filter((reqRace) =>
        allRaces.some(
          (selRace) =>
            combinedRaceIds.has(selRace.id) && selRace.name === reqRace.name
        )
      );

      const missingRaces = uniqueRequiredRaces.filter(
        (reqRace) =>
          !completedRaces.some((compRace) => compRace.name === reqRace.name)
      );

      for (const race of missingRaces) {
        if (
          careerRaceDates.has(race.date) &&
          careerRaceDates.get(race.date) !== race.name
        ) {
          status = "impossible";
          conflictReason = `${
            race.name
          } conflicts with the career race ${careerRaceDates.get(race.date)}.`;
          break;
        }
      }

      if (status !== "impossible") {
        if (missingRaces.length === 0) {
          status = "complete";
        } else {
          isRecommended = missingRaces.every(isRaceSuitable);
        }
      } else {
        isRecommended = false;
      }

      return {
        name: epithet.name,
        requiredCount: uniqueRequiredRaces.length,
        completedCount: completedRaces.length,
        missingRaces: missingRaces,
        status,
        isRecommended,
        conflictReason,
      };
    });
  }, [
    allRaces,
    combinedRaceIds,
    careerRaceIds,
    modifiedAptitudes,
    filters.trackAptitude,
    filters.distanceAptitude,
    selectedCharacter,
    raceMap,
  ]);

  const handleAddEpithetRaces = useCallback(
    (racesToAdd) => {
      const beforeState = {
        selectedRaces: new Set(selectedRaces),
        smartAddedRaceIds: new Set(smartAddedRaceIds),
        checklistData: { ...checklistData },
      };

      const racesToAddByName = new Map();
      racesToAdd.forEach((race) => {
        if (!racesToAddByName.has(race.name)) {
          racesToAddByName.set(race.name, []);
        }
        racesToAddByName.get(race.name).push(race);
      });

      const currentRaceDates = new Map();
      allRaces.forEach((r) => {
        if (combinedRaceIds.has(r.id)) {
          currentRaceDates.set(r.date, r.name);
        }
      });

      const finalRacesToAdd = new Set();
      const racesThatCauseWarnings = new Set();
      const racesSkippedDueToWarningFilter = new Set();

      racesToAddByName.forEach((instances, name) => {
        const sortedInstances = instances.sort(
          (a, b) => a.turnValue - b.turnValue
        );
        let added = false;
        for (const instance of sortedInstances) {
          if (currentRaceDates.has(instance.date)) continue;

          const currentWarnings = calculateWarningIds(
            combinedRaceIds,
            allRaces,
            careerRaceIds
          );
          const potentialIds = new Set([
            ...combinedRaceIds,
            ...finalRacesToAdd,
            instance.id,
          ]);
          const potentialWarnings = calculateWarningIds(
            potentialIds,
            allRaces,
            careerRaceIds
          );

          if (potentialWarnings.size <= currentWarnings.size) {
            finalRacesToAdd.add(instance.id);
            added = true;
            break;
          }
        }

        if (!added) {
          if (filters.preventWarningAdd) {
            racesSkippedDueToWarningFilter.add(name);
          } else {
            racesThatCauseWarnings.add(name);
            const fallbackInstance = sortedInstances.find(
              (r) => !currentRaceDates.has(r.date)
            );
            if (fallbackInstance) {
              finalRacesToAdd.add(fallbackInstance.id);
            }
          }
        }
      });

      if (racesSkippedDueToWarningFilter.size > 0) {
        const raceNames = Array.from(racesSkippedDueToWarningFilter).join(", ");
        toast.error(
          `Could not add: ${raceNames}. Adding them would cause 3+ consecutive races, and your filter is preventing this.`,
          { duration: 6000 }
        );
      }

      if (racesThatCauseWarnings.size > 0) {
        const raceNames = Array.from(racesThatCauseWarnings).join(", ");
        toast.error(
          `Added with warning: ${raceNames}. The earliest available instance of these races causes a 3+ consecutive race warning.`,
          { duration: 6000 }
        );
      }

      const datesOfRacesToAdd = new Set();
      allRaces.forEach((r) => {
        if (finalRacesToAdd.has(r.id)) {
          datesOfRacesToAdd.add(r.date);
        }
      });

      const newSelectedRaces = new Set([...selectedRaces]);
      datesOfRacesToAdd.forEach((date) => {
        allRaces.forEach((r) => {
          if (r.date === date) newSelectedRaces.delete(r.id);
        });
      });

      finalRacesToAdd.forEach((id) => newSelectedRaces.add(id));

      const action = () => {
        setSelectedRaces(newSelectedRaces);
      };

      const message = `Added ${finalRacesToAdd.size} race(s).`;
      performActionWithUndo(action, message, beforeState);
      if (finalRacesToAdd.size > 0) {
        toast.success(
          `Added ${finalRacesToAdd.size} race(s) to your schedule!`,
          { duration: 3000 }
        );
      }
    },
    [
      allRaces,
      combinedRaceIds,
      careerRaceIds,
      selectedRaces,
      filters.preventWarningAdd,
      performActionWithUndo,
      checklistData,
      smartAddedRaceIds,
    ]
  );

  const handleChecklistDataChange = useCallback(
    (raceId, field, value) => {
      const raceToUpdate = raceMap.get(raceId);
      if (!raceToUpdate) return;

      const isStatusChange = field !== "notes";
      let beforeState;
      if (isStatusChange) {
        beforeState = {
          selectedRaces: new Set(selectedRaces),
          smartAddedRaceIds: new Set(smartAddedRaceIds),
          checklistData: { ...checklistData },
        };
      }

      const action = () => {
        const currentData = checklistData[raceId] || {
          ran: false,
          won: false,
          notes: "",
          skipped: false,
        };
        const newData = { ...currentData, [field]: value };

        const wasTrigger =
          (field === "skipped" && currentData.skipped === false) ||
          (field === "ran" &&
            currentData.ran === false &&
            currentData.won === false);
        const isTrigger =
          (field === "skipped" && value === true) ||
          (field === "ran" && value === true && !newData.won);
        const isUndo = wasTrigger && !isTrigger;

        if (
          !careerRaceIds.has(raceId) &&
          (isTrigger || isUndo) &&
          raceExclusivity.get(raceToUpdate.name) > 1
        ) {
          const futureInstance = allRaces
            .filter(
              (r) =>
                r.name === raceToUpdate.name &&
                r.turnValue > raceToUpdate.turnValue
            )
            .sort((a, b) => a.turnValue - b.turnValue)[0];

          if (futureInstance) {
            if (isTrigger) {
              const allScheduledDates = new Map();
              allRaces.forEach((r) => {
                if (combinedRaceIds.has(r.id) && r.id !== raceId) {
                  allScheduledDates.set(r.date, {
                    name: r.name,
                    isCareer: careerRaceIds.has(r.id),
                    id: r.id,
                  });
                }
              });

              if (allScheduledDates.has(futureInstance.date)) {
              } else {
                const currentWarnings = calculateWarningIds(
                  combinedRaceIds,
                  allRaces,
                  careerRaceIds
                );
                const potentialIds = new Set([...combinedRaceIds]);
                potentialIds.delete(raceId);
                potentialIds.add(futureInstance.id);

                const potentialWarnings = calculateWarningIds(
                  potentialIds,
                  allRaces,
                  careerRaceIds
                );

                const addRaceAction = () => {
                  setSmartAddedRaceIds((prev) =>
                    new Set(prev).add(futureInstance.id)
                  );
                  setSelectedRaces((prev) => {
                    const newSet = new Set(prev);
                    newSet.delete(raceId);
                    return newSet;
                  });
                  toast(
                    "Found a later version of this race and added it to your checklist.",
                    { icon: "✨" }
                  );
                };

                if (
                  potentialWarnings.size > currentWarnings.size &&
                  filters.preventWarningAdd
                ) {
                } else {
                  addRaceAction();
                }
              }
            } else if (isUndo && smartAddedRaceIds.has(futureInstance.id)) {
              setSmartAddedRaceIds((prev) => {
                const newSet = new Set(prev);
                newSet.delete(futureInstance.id);
                return newSet;
              });
              toast.success(
                `Removed automatically added instance of "${futureInstance.name},{duration: 3000}".`
              );
            }
          }
        }

        setChecklistData((prev) => {
          if (field === "won" && value === true) {
            newData.ran = true;
            newData.skipped = false;
          } else if (field === "ran" && value === true) {
            newData.skipped = false;
          } else if (field === "ran" && value === false) {
            newData.won = false;
          } else if (field === "skipped" && value === true) {
            newData.ran = false;
            newData.won = false;
          }
          return { ...prev, [raceId]: newData };
        });
      };

      if (isStatusChange) {
        const message = `Marked '${raceToUpdate.name}' as ${field}.`;
        performActionWithUndo(action, message, beforeState);
      } else {
        action();
      }
    },
    [
      allRaces,
      careerRaceIds,
      raceExclusivity,
      smartAddedRaceIds,
      filters.preventWarningAdd,
      combinedRaceIds,
      checklistData,
      performActionWithUndo,
      selectedRaces,
      raceMap,
    ]
  );

  const updateLocalStorage = useCallback((newChecklists) => {
    setSavedChecklists(newChecklists);
    try {
      localStorage.setItem(
        "umamusume-checklists",
        JSON.stringify(newChecklists)
      );
    } catch (error) {
      if (error.name === "QuotaExceededError") {
        toast.error(
          "Browser storage is full. Cannot save checklists. Please clear some space.",
          { duration: 10000 }
        );
      } else {
        console.error("Failed to save checklists:", error);
      }
    }
  }, []);

  const handleResetChecklistStatus = useCallback(() => {
    const beforeState = {
      selectedRaces: new Set(selectedRaces),
      smartAddedRaceIds: new Set(smartAddedRaceIds),
      checklistData: { ...checklistData },
    };

    const resetAction = () => {
      const action = () => {
        setSmartAddedRaceIds(new Set());
        setChecklistData((prev) => {
          const newData = { ...prev };
          Object.keys(newData).forEach((raceId) => {
            newData[raceId] = {
              ...newData[raceId],
              ran: false,
              won: false,
              skipped: false,
            };
          });
          return newData;
        });
      };
      performActionWithUndo(action, "Reset all statuses.", beforeState);
      toast.success("Ran/Won/Skipped statuses have been reset.", {
        duration: 3000,
      });
    };

    toast(
      (t) => (
        <ConfirmationToast
          t={t}
          onConfirm={resetAction}
          message="Reset all 'Ran', 'Won', and 'Skipped' statuses? Notes will be kept."
        />
      ),
      { duration: Infinity }
    );
  }, [performActionWithUndo, checklistData, selectedRaces, smartAddedRaceIds]);

  const handleClearChecklistNotes = useCallback(() => {
    const beforeState = {
      selectedRaces: new Set(selectedRaces),
      smartAddedRaceIds: new Set(smartAddedRaceIds),
      checklistData: { ...checklistData },
    };
    const clearAction = () => {
      const action = () => {
        setChecklistData((prev) => {
          const newData = { ...prev };
          Object.keys(newData).forEach((raceId) => {
            newData[raceId] = { ...newData[raceId], notes: "" };
          });
          return newData;
        });
      };
      performActionWithUndo(action, "Cleared all notes.", beforeState);
      toast.success("All notes have been cleared.", { duration: 3000 });
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
  }, [performActionWithUndo, checklistData, selectedRaces, smartAddedRaceIds]);

  const handleSaveChecklist = useCallback(
    (name) => {
      const finalSelectedRaces = new Set([
        ...selectedRaces,
        ...smartAddedRaceIds,
      ]);

      const newChecklist = {
        name,
        characterName: selectedCharacter?.name || "Unknown",
        modifiedAptitudes,
        selectedRaceIds: Array.from(finalSelectedRaces),
        checklistData,
        filters,
        gradeFilters,
        yearFilters,
        trackFilters,
        distanceFilters,
        showOptionalGrades,
        fanBonus,
        savedAt: new Date().toISOString(),
      };
      const existingIndex = savedChecklists.findIndex((c) => c.name === name);
      if (existingIndex > -1) {
        const overwriteAction = () => {
          const newChecklists = [...savedChecklists];
          newChecklists[existingIndex] = newChecklist;
          updateLocalStorage(newChecklists);
          setCurrentChecklistName(name);
          toast.success(`Checklist "${name}" overwritten!`, { duration: 3000 });
        };

        setOverwriteModal({
          isOpen: true,
          name: name,
          onConfirm: overwriteAction,
        });
      } else {
        const newChecklists = [...savedChecklists, newChecklist];
        updateLocalStorage(newChecklists);
        setCurrentChecklistName(name);
        toast.success(`Checklist "${name}" saved!`, { duration: 3000 });
      }
      setSelectedRaces(finalSelectedRaces);
      setSmartAddedRaceIds(new Set());
    },
    [
      savedChecklists,
      selectedCharacter,
      modifiedAptitudes,
      selectedRaces,
      checklistData,
      filters,
      gradeFilters,
      yearFilters,
      trackFilters,
      distanceFilters,
      showOptionalGrades,
      smartAddedRaceIds,
      fanBonus,
      updateLocalStorage,
    ]
  );

  const handleLoadChecklist = useCallback(
    (name) => {
      setSmartAddedRaceIds(new Set());
      const checklistToLoad = savedChecklists.find((c) => c.name === name);
      if (checklistToLoad) {
        const character = allCharacters.find(
          (c) => c.name === checklistToLoad.characterName
        );

        if (character) {
          const newCareerRaceIds = getCareerRacesForChar(character);
          setCareerRaceIds(newCareerRaceIds);
          setSelectedCharacter(character);
          setSearchTerm(character.name);
        } else {
          setCareerRaceIds(new Set());
          setSelectedCharacter(null);
          setSearchTerm("");
        }

        setModifiedAptitudes(checklistToLoad.modifiedAptitudes);
        setSelectedRaces(new Set(checklistToLoad.selectedRaceIds));
        setChecklistData(checklistToLoad.checklistData || {});
        setFilters(
          checklistToLoad.filters || {
            trackAptitude: "B",
            distanceAptitude: "A",
            hideNonHighlighted: true,
            hideSummer: true,
            preventWarningAdd: true,
          }
        );
        setGradeFilters(
          checklistToLoad.gradeFilters || { G1: true, G2: true, G3: true }
        );
        setYearFilters(
          migrateYearFilters(checklistToLoad.yearFilters) || {
            "Junior Year": true,
            "Classic Year": true,
            "Senior Year": true,
          }
        );
        setTrackFilters(
          checklistToLoad.trackFilters || { Turf: true, Dirt: true }
        );
        setDistanceFilters(
          checklistToLoad.distanceFilters || {
            sprint: true,
            mile: true,
            medium: true,
            long: true,
          }
        );
        setShowOptionalGrades(checklistToLoad.showOptionalGrades || false);
        setFanBonus(checklistToLoad.fanBonus || 0);
        setCurrentChecklistName(name);
        toast.success(`Checklist "${name}" loaded!`, { duration: 3000 });
      }
    },
    [savedChecklists, allCharacters, getCareerRacesForChar, setSearchTerm]
  );

  const handleDeleteChecklist = useCallback(
    (name) => {
      const deleteAction = () => {
        updateLocalStorage(savedChecklists.filter((c) => c.name !== name));

        if (currentChecklistName === name) {
          setSelectedRaces(new Set());
          setSmartAddedRaceIds(new Set());
          setChecklistData({});
          setSelectedCharacter(null);
          setModifiedAptitudes(null);
          setSearchTerm("");
          setCareerRaceIds(new Set());
          setCurrentChecklistName(null);
          toast.success(`Deleted "${name}" and cleared the planner.`, {
            duration: 3000,
          });
        } else {
          toast.success(`Deleted "${name}".`, { duration: 3000 });
        }
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
    [savedChecklists, currentChecklistName, updateLocalStorage, setSearchTerm]
  );

  const handleRenameChecklist = useCallback(
    (oldName, newName) => {
      if (!newName || newName.trim() === "") {
        toast.error("New name cannot be empty.");
        return;
      }
      if (savedChecklists.some((c) => c.name === newName)) {
        toast.error("A checklist with that name already exists.");
        return;
      }
      updateLocalStorage(
        savedChecklists.map((c) =>
          c.name === oldName ? { ...c, name: newName } : c
        )
      );
      if (currentChecklistName === oldName) {
        setCurrentChecklistName(newName);
      }
      toast.success(`Renamed to "${newName}".`, { duration: 3000 });
    },
    [savedChecklists, currentChecklistName, updateLocalStorage]
  );

  const handleReorderChecklist = useCallback(
    (index, direction) => {
      if (
        (index === 0 && direction === "up") ||
        (index === savedChecklists.length - 1 && direction === "down")
      ) {
        return;
      }

      const newIndex = direction === "up" ? index - 1 : index + 1;
      const newList = [...savedChecklists];

      [newList[index], newList[newIndex]] = [newList[newIndex], newList[index]];

      updateLocalStorage(newList);
    },
    [savedChecklists, updateLocalStorage]
  );

  const handleSortChecklists = useCallback(
    (sortBy) => {
      const sorted = [...savedChecklists].sort((a, b) => {
        if (sortBy === "name") {
          return a.name.localeCompare(b.name);
        }
        if (sortBy === "character") {
          const charCompare = a.characterName.localeCompare(b.characterName);
          if (charCompare !== 0) return charCompare;
          return a.name.localeCompare(b.name);
        }
        return 0;
      });
      updateLocalStorage(sorted);
      toast.success(
        `Checklists sorted by ${sortBy === "name" ? "name" : "character"}.`,
        { duration: 3000 }
      );
    },
    [savedChecklists, updateLocalStorage]
  );

  const handleExportSingleChecklist = useCallback(
    (name) => {
      const checklist = savedChecklists.find((c) => c.name === name);
      if (!checklist) {
        toast.error("Could not find checklist to export.");
        return;
      }
      const jsonString = JSON.stringify(checklist, null, 2);
      const blob = new Blob([jsonString], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${name}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success(`Exported "${name}"!`, { duration: 3000 });
    },
    [savedChecklists]
  );

  const handleImportSingleChecklist = useCallback(
    (importedChecklist) => {
      if (
        typeof importedChecklist !== "object" ||
        importedChecklist === null ||
        typeof importedChecklist.name !== "string" ||
        !Array.isArray(importedChecklist.selectedRaceIds)
      ) {
        toast.error(
          "Import failed: File data is not a valid checklist object."
        );
        return;
      }
      const validRaceIds = new Set(allRaces.map((r) => r.id));
      const originalIdCount = importedChecklist.selectedRaceIds.length;
      const validatedRaceIds = importedChecklist.selectedRaceIds.filter((id) =>
        validRaceIds.has(id)
      );
      const removedCount = originalIdCount - validatedRaceIds.length;

      if (removedCount > 0) {
        toast.warn(
          `${removedCount} race(s) from the imported file were not found in the current race data and have been ignored.`
        );
      }
      const sanitizedChecklist = {
        name: String(importedChecklist.name).slice(0, 100),
        characterName: String(importedChecklist.characterName || "Unknown"),
        modifiedAptitudes: importedChecklist.modifiedAptitudes || null,
        selectedRaceIds: validatedRaceIds,
        checklistData: importedChecklist.checklistData || {},
        filters: importedChecklist.filters || {},
        gradeFilters: importedChecklist.gradeFilters || {},
        yearFilters: migrateYearFilters(importedChecklist.yearFilters) || {
          "Junior Year": true,
          "Classic Year": true,
          "Senior Year": true,
        },
        trackFilters: importedChecklist.trackFilters || {
          Turf: true,
          Dirt: true,
        },
        distanceFilters: importedChecklist.distanceFilters || {
          sprint: true,
          mile: true,
          medium: true,
          long: true,
        },
        showOptionalGrades: !!importedChecklist.showOptionalGrades,
        fanBonus: importedChecklist.fanBonus || 0,
        savedAt: importedChecklist.savedAt || new Date().toISOString(),
      };

      const existingIndex = savedChecklists.findIndex(
        (c) => c.name === sanitizedChecklist.name
      );
      if (existingIndex > -1) {
        setImportConflictModal({
          isOpen: true,
          checklistToImport: sanitizedChecklist,
        });
      } else {
        updateLocalStorage([...savedChecklists, sanitizedChecklist]);
        toast.success(`Imported checklist "${sanitizedChecklist.name}"!`, {
          duration: 3000,
        });
      }
    },
    [savedChecklists, updateLocalStorage, allRaces]
  );

  const handleImportChecklists = useCallback(
    (importedChecklists) => {
      if (!Array.isArray(importedChecklists)) {
        toast.error("Import failed: File data is not a valid checklist array.");
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
            yearFilters: migrateYearFilters(item.yearFilters) || {
              "Junior Year": true,
              "Classic Year": true,
              "Senior Year": true,
            },
            trackFilters: item.trackFilters || { Turf: true, Dirt: true },
            distanceFilters: item.distanceFilters || {
              sprint: true,
              mile: true,
              medium: true,
              long: true,
            },
            showOptionalGrades: !!item.showOptionalGrades,
            fanBonus: item.fanBonus || 0,
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
          updateLocalStorage(validatedChecklists);
          setCurrentChecklistName(null);
          toast.success(`Imported ${validatedChecklists.length} checklists!`, {
            duration: 3000,
          });
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
    [updateLocalStorage]
  );

  const handleRemoveRace = useCallback(
    (raceIdToRemove) => {
      const race = raceMap.get(raceIdToRemove);
      if (!race) return;

      const beforeState = {
        selectedRaces: new Set(selectedRaces),
        smartAddedRaceIds: new Set(smartAddedRaceIds),
        checklistData: { ...checklistData },
      };

      const action = () => {
        setSelectedRaces((prev) => {
          const newSet = new Set(prev);
          newSet.delete(raceIdToRemove);
          return newSet;
        });
        setSmartAddedRaceIds((prev) => {
          const newSet = new Set(prev);
          newSet.delete(raceIdToRemove);
          return newSet;
        });
      };

      const message = `Removed '${race.name}'.`;
      performActionWithUndo(action, message, beforeState);
    },
    [
      raceMap,
      selectedRaces,
      smartAddedRaceIds,
      checklistData,
      performActionWithUndo,
    ]
  );

  const handleRequestNoCareerToggle = (isChecked) => {
    if (isChecked && combinedRaceIds.size > 0) {
      toast(
        (t) => (
          <ConfirmationToast
            t={t}
            onConfirm={() => {
              setIsNoCareerMode(true);
              setCareerRaceIds(new Set());
              setSelectedRaces(new Set());
              setCurrentChecklistName(null);
            }}
            message="This will clear your current checklist. Continue?"
          />
        ),
        { duration: Infinity }
      );
    } else {
      setIsNoCareerMode(isChecked);
      if (isChecked) {
        setCareerRaceIds(new Set());
        setSelectedRaces(new Set());
      } else {
        if (selectedCharacter) {
          const newCareerRaceIds = getCareerRacesForChar(selectedCharacter);
          setCareerRaceIds(newCareerRaceIds);
          setSelectedRaces(new Set(newCareerRaceIds));
        }
      }
      setCurrentChecklistName(null);
    }
  };

  const handleClearOptionalRaces = useCallback(() => {
    const clearAction = () => {
      const beforeState = {
        selectedRaces: new Set(selectedRaces),
        smartAddedRaceIds: new Set(smartAddedRaceIds),
        checklistData: { ...checklistData },
      };
      const action = () => {
        setSelectedRaces(new Set(careerRaceIds));
        setCurrentChecklistName(null);
        toast.success("All optional races have been cleared.", {
          duration: 3000,
        });
      };
      performActionWithUndo(action, "Cleared optional races.", beforeState);
    };

    toast(
      (t) => (
        <ConfirmationToast
          t={t}
          onConfirm={clearAction}
          message="Are you sure you want to clear all non-career races?"
        />
      ),
      { duration: Infinity }
    );
  }, [
    careerRaceIds,
    selectedRaces,
    smartAddedRaceIds,
    checklistData,
    performActionWithUndo,
  ]);

  const handleBatchSelect = useCallback(
    (criteria, visibleRaces) => {
      const beforeState = {
        selectedRaces: new Set(selectedRaces),
        smartAddedRaceIds: new Set(smartAddedRaceIds),
        checklistData: { ...checklistData },
      };

      const action = () => {
        setCurrentChecklistName(null);
        if (criteria.mode === "maximize") {
          const racesByTurn = new Map();
          const maxTurn = 72;
          const careerTurns = criteria.careerRaceTurns || new Set();

          for (const race of visibleRaces) {
            if (careerTurns.has(race.turnValue)) continue;
            if (!racesByTurn.has(race.turnValue)) {
              racesByTurn.set(race.turnValue, []);
            }
            racesByTurn.get(race.turnValue).push(race);
          }

          const dp = new Array(maxTurn + 1).fill(null).map(() => ({
            fans: 0,
            races: [],
            lastTwoTurns: [false, false],
          }));

          for (let t = 1; t <= maxTurn; t++) {
            const prevTurnIsCareer = careerTurns.has(t - 1);
            const prevPrevTurnIsCareer = careerTurns.has(t - 2);

            const prev = dp[t - 1];
            dp[t] = {
              ...prev,
              lastTwoTurns: [prev.lastTwoTurns[1] || prevTurnIsCareer, false],
            };

            if (racesByTurn.has(t)) {
              for (const race of racesByTurn.get(t)) {
                if (typeof race.fans_gained !== "number") continue;

                if (
                  filters.preventWarningAdd &&
                  (prev.lastTwoTurns[0] || prevPrevTurnIsCareer) &&
                  (prev.lastTwoTurns[1] || prevTurnIsCareer)
                ) {
                  continue;
                }

                const newFans = prev.fans + race.fans_gained;
                if (newFans > dp[t].fans) {
                  dp[t] = {
                    fans: newFans,
                    races: [...prev.races, race.id],
                    lastTwoTurns: [
                      prev.lastTwoTurns[1] || prevTurnIsCareer,
                      true,
                    ],
                  };
                }
              }
            }
          }
          const optimalRaceIds = new Set(dp[maxTurn].races);
          setSelectedRaces(new Set([...careerRaceIds, ...optimalRaceIds]));
          toast.success("Optimal fan schedule selected!", { duration: 3000 });
        } else {
          const racesToProcess = visibleRaces.filter((race) => {
            if (
              criteria.grade.length > 0 &&
              !criteria.grade.includes(race.grade)
            )
              return false;
            if (
              criteria.track.length > 0 &&
              !criteria.track.includes(race.ground)
            )
              return false;
            if (
              criteria.distance.length > 0 &&
              !criteria.distance.includes(getDistanceCategory(race.distance))
            )
              return false;
            if (
              criteria.year.length > 0 &&
              !criteria.year.some((year) => race.date.startsWith(year))
            )
              return false;
            return true;
          });

          if (racesToProcess.length === 0) {
            toast.error("No visible races match the selected criteria.");
            return;
          }

          if (criteria.mode === "select") {
            const newSelectedRaces = new Set(selectedRaces);
            const scheduledDates = new Set();
            newSelectedRaces.forEach((id) => {
              const race = raceMap.get(id);
              if (race) scheduledDates.add(race.date);
            });
            careerRaceIds.forEach((id) => {
              const race = raceMap.get(id);
              if (race) scheduledDates.add(race.date);
            });

            let addedCount = 0;
            racesToProcess.forEach((race) => {
              if (!scheduledDates.has(race.date)) {
                if (filters.preventWarningAdd) {
                  const currentWarnings = calculateWarningIds(
                    newSelectedRaces,
                    allRaces,
                    careerRaceIds
                  );
                  const potentialRaces = new Set([
                    ...newSelectedRaces,
                    race.id,
                  ]);
                  const potentialWarnings = calculateWarningIds(
                    potentialRaces,
                    allRaces,
                    careerRaceIds
                  );
                  if (potentialWarnings.size > currentWarnings.size) {
                    return;
                  }
                }
                newSelectedRaces.add(race.id);
                scheduledDates.add(race.date);
                addedCount++;
              }
            });
            setSelectedRaces(newSelectedRaces);
            toast.success(`Selected ${addedCount} race(s) matching criteria.`, {
              duration: 3000,
            });
          } else if (criteria.mode === "unselect") {
            const racesToRemoveIds = new Set(racesToProcess.map((r) => r.id));
            const newSelectedRaces = new Set(
              [...selectedRaces].filter(
                (id) => !racesToRemoveIds.has(id) || careerRaceIds.has(id)
              )
            );
            const removedCount = selectedRaces.size - newSelectedRaces.size;
            setSelectedRaces(newSelectedRaces);
            toast.success(`Unselected ${removedCount} race(s).`, {
              duration: 3000,
            });
          }
        }
      };

      const message = `Performed multi-select action.`;
      performActionWithUndo(action, message, beforeState);
    },
    [
      allRaces,
      selectedRaces,
      careerRaceIds,
      checklistData,
      filters.preventWarningAdd,
      performActionWithUndo,
      smartAddedRaceIds,
      raceMap,
    ]
  );

  const checklistRaces = useMemo(
    () =>
      allRaces
        .filter((r) => combinedRaceIds.has(r.id))
        .sort((a, b) => a.turnValue - b.turnValue),
    [allRaces, combinedRaceIds]
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
    setPage: navigateTo,
    savedChecklists,
    handleSaveChecklist,
    handleLoadChecklist,
    handleDeleteChecklist,
    handleRenameChecklist,
    handleReorderChecklist,
    handleSortChecklists,
    handleExportSingleChecklist,
    handleImportSingleChecklist,
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
    onRequestNoCareerToggle: handleRequestNoCareerToggle,
    alwaysShowCareer,
    setAlwaysShowCareer,
    totalSelectedCount: combinedRaceIds.size,
    combinedRaceIds,
    epithetStatus,
    handleAddEpithetRaces,
    onBatchSelect: handleBatchSelect,
    onClearOptionalRaces: handleClearOptionalRaces,
    showOnlySelected,
    setShowOnlySelected,
    totalBaseFans,
    estimatedTotalFans,
    fanBonus,
    setFanBonus,
    isCompactMode,
    setIsCompactMode,
  };

  const checklistProps = {
    races: checklistRaces,
    checklistData,
    onChecklistDataChange: handleChecklistDataChange,
    onRemoveRace: handleRemoveRace,
    setPage: navigateTo,
    onResetStatus: handleResetChecklistStatus,
    onClearNotes: handleClearChecklistNotes,
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
    isCompactMode,
    setIsCompactMode,
    lastAction,
    onUndo: handleUndo,
  };

  const calendarProps = {
    races: checklistRaces,
    careerRaceIds,
    setPage,
    previousPage,
  };

  const handleConfirmImportOverwrite = () => {
    const { checklistToImport } = importConflictModal;
    if (!checklistToImport) return;

    const newChecklists = savedChecklists.map((c) =>
      c.name === checklistToImport.name ? checklistToImport : c
    );
    updateLocalStorage(newChecklists);
    toast.success(`Checklist "${checklistToImport.name}" was overwritten!`, {
      duration: 3000,
    });
    setImportConflictModal({ isOpen: false, checklistToImport: null });
  };

  return (
    <div className={`App ${isCompactMode ? "compact-mode" : ""}`}>
      <Toaster position="top-center" reverseOrder={false} />
      <header className="App-header">
        <h1>UmaMusume Race Planner</h1>
        <ThemeToggle
          isDarkMode={isDarkMode}
          onToggle={() => setIsDarkMode(!isDarkMode)}
        />
      </header>
      <main>
        {page === "planner" && <Planner {...plannerProps} />}
        {page === "checklist" && <Checklist {...checklistProps} />}
        {page === "calendar" && <CalendarView {...calendarProps} />}
      </main>

      {overwriteModal.isOpen && (
        <Modal
          title="Overwrite Checklist"
          onConfirm={() => {
            overwriteModal.onConfirm();
            setOverwriteModal({ isOpen: false, name: "", onConfirm: () => {} });
          }}
          onCancel={() =>
            setOverwriteModal({ isOpen: false, name: "", onConfirm: () => {} })
          }
          confirmText="Overwrite"
        >
          <p>
            A checklist named "<strong>{overwriteModal.name}</strong>" already
            exists. Do you want to overwrite it?
          </p>
        </Modal>
      )}

      {importConflictModal.isOpen && (
        <Modal
          title="Import Conflict"
          onConfirm={handleConfirmImportOverwrite}
          onCancel={() =>
            setImportConflictModal({ isOpen: false, checklistToImport: null })
          }
          confirmText="Overwrite"
        >
          <p>
            A checklist named "
            <strong>{importConflictModal.checklistToImport?.name}</strong>"
            already exists. Do you want to overwrite it with the imported file?
          </p>
        </Modal>
      )}
      <footer>
        <p>
          This is a fan-made project and is not affiliated with Cygames, Inc.
        </p>
      </footer>
    </div>
  );
}

export default App;
