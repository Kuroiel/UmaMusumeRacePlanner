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
          /(?:in the|the)\s+(.*)/
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
          return race.name.trim() === raceName && raceDate === normalizedDate;
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
    if (isConsecutive && !careerRaceIds.has(race3.id)) {
      warnings.add(race3.id);
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
      trackAptitude: "A",
      distanceAptitude: "A",
      hideNonHighlighted: false,
      hideSummer: false,
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
      setIsAppInitialized(false); // Prevent app from trying to render
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
        const race = allRaces.find((r) => r.id === raceId);
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
    }, [combinedRaceIds, allRaces, checklistData]);

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
      const race = allRaces.find((r) => r.id === id);
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
  ]);

  const handleAddEpithetRaces = useCallback(
    (racesToAdd) => {
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

      racesToAddByName.forEach((instances, name) => {
        const sortedInstances = instances.sort(
          (a, b) => a.turnValue - b.turnValue
        );
        let added = false;
        for (const instance of sortedInstances) {
          if (currentRaceDates.has(instance.date)) continue;

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

          if (!potentialWarnings.has(instance.id)) {
            finalRacesToAdd.add(instance.id);
            added = true;
            break;
          }
        }

        if (!added) {
          racesThatCauseWarnings.add(name);
          const fallbackInstance = sortedInstances.find(
            (r) => !currentRaceDates.has(r.date)
          );
          if (fallbackInstance) {
            finalRacesToAdd.add(fallbackInstance.id);
          }
        }
      });

      if (racesThatCauseWarnings.size > 0) {
        const raceNames = Array.from(racesThatCauseWarnings).join(", ");
        toast.error(
          `Could not add the following race(s) without causing a 3-race warning: ${raceNames}. The earliest available instance was added instead.`,
          { duration: 6000 }
        );
      }

      const datesOfRacesToAdd = new Set();
      allRaces.forEach((r) => {
        if (finalRacesToAdd.has(r.id)) {
          datesOfRacesToAdd.add(r.date);
        }
      });

      const filteredSelectedRaces = new Set(
        [...selectedRaces].filter((id) => {
          const race = allRaces.find((r) => r.id === id);
          return !datesOfRacesToAdd.has(race.date);
        })
      );

      const newSelectedRaces = new Set([
        ...filteredSelectedRaces,
        ...finalRacesToAdd,
      ]);

      setSelectedRaces(newSelectedRaces);
      setCurrentChecklistName(null);
      toast.success(`Added ${finalRacesToAdd.size} race(s) to your schedule!`);
    },
    [allRaces, combinedRaceIds, careerRaceIds, selectedRaces]
  );

  const handleChecklistDataChange = useCallback(
    (raceId, field, value) => {
      const currentData = checklistData[raceId] || {
        ran: false,
        won: false,
        notes: "",
        skipped: false,
      };
      const newData = { ...currentData, [field]: value };
      const raceToUpdate = allRaces.find((r) => r.id === raceId);
      if (!raceToUpdate) return;

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
              const conflict = allScheduledDates.get(futureInstance.date);
              if (conflict.name !== futureInstance.name) {
                toast.error(
                  `Cannot add next instance of race: Conflicts with ${
                    conflict.isCareer
                      ? "the career race:"
                      : "the selected race:"
                  } ${conflict.name}.`,
                  { duration: 4000 }
                );
              }
            } else {
              const potentialIds = new Set([
                ...combinedRaceIds,
                futureInstance.id,
              ]);
              potentialIds.delete(raceId);
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
                potentialWarnings.has(futureInstance.id) &&
                filters.preventWarningAdd
              ) {
                toast(
                  (t) => (
                    <ConfirmationToast
                      t={t}
                      onConfirm={addRaceAction}
                      message="Adding this race will cause a 3+ consecutive race warning. Add it anyway?"
                    />
                  ),
                  { duration: Infinity }
                );
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
              `Removed automatically added instance of "${futureInstance.name}".`
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
    },
    [
      allRaces,
      careerRaceIds,
      raceExclusivity,
      smartAddedRaceIds,
      filters.preventWarningAdd,
      combinedRaceIds,
      checklistData,
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
    const resetAction = () => {
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
      toast.success("Ran/Won/Skipped statuses have been reset.");
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
  }, []);

  const handleClearChecklistNotes = useCallback(() => {
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
  }, []);

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
          toast.success(`Checklist "${name}" overwritten!`);
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
        toast.success(`Checklist "${name}" saved!`);
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
            trackAptitude: "A",
            distanceAptitude: "A",
            hideNonHighlighted: false,
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
        toast.success(`Checklist "${name}" loaded!`);
      }
    },
    [savedChecklists, allCharacters, getCareerRacesForChar]
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
          toast.success(`Deleted "${name}" and cleared the planner.`);
        } else {
          toast.success(`Deleted "${name}".`);
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
    [savedChecklists, currentChecklistName, updateLocalStorage]
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
      toast.success(`Renamed to "${newName}".`);
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
          // Sort by character, then by name for characters that are the same
          const charCompare = a.characterName.localeCompare(b.characterName);
          if (charCompare !== 0) return charCompare;
          return a.name.localeCompare(b.name);
        }
        return 0;
      });
      updateLocalStorage(sorted);
      toast.success(
        `Checklists sorted by ${sortBy === "name" ? "name" : "character"}.`
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
      toast.success(`Exported "${name}"!`);
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
        toast.success(`Imported checklist "${sanitizedChecklist.name}"!`);
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
    [updateLocalStorage]
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
    setIsNoCareerMode,
    alwaysShowCareer,
    setAlwaysShowCareer,
    totalSelectedCount: combinedRaceIds.size,
    combinedRaceIds,
    epithetStatus,
    handleAddEpithetRaces,
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
    toast.success(`Checklist "${checklistToImport.name}" was overwritten!`);
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
