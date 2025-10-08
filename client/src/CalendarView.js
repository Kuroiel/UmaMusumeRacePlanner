import React from "react";

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const YEARS = ["Junior Year", "Classic Year", "Senior Year"];

const getShortGrade = (grade) => {
  if (grade.startsWith("G")) return grade;
  if (grade === "OP" || grade === "Open") return "OP";
  if (grade === "Pre-OP") return "Pre-OP";
  return grade;
};

function CalendarView({ races, careerRaceIds, setPage }) {
  const calendarData = React.useMemo(() => {
    const turns = Array.from({ length: 72 }, (_, i) => ({
      turnValue: i + 1,
      races: [],
    }));

    races.forEach((race) => {
      if (race.turnValue > 0 && race.turnValue <= 72) {
        turns[race.turnValue - 1].races.push(race);
      }
    });

    return turns;
  }, [races]);

  return (
    <div className="calendar-page">
      <div className="calendar-header">
        <button className="back-button" onClick={() => setPage("planner")}>
          &larr; Back to Planner
        </button>
        <h2>3-Year Race Calendar</h2>
        <div />
      </div>

      <div className="calendar-container">
        {YEARS.map((year, yearIndex) => (
          <div key={year} className="calendar-year">
            <h3 className="year-title">{year}</h3>
            <div className="months-grid">
              {MONTHS.map((month, monthIndex) => {
                const turnIndexOffset = yearIndex * 24 + monthIndex * 2;
                const earlyTurn = calendarData[turnIndexOffset];
                const lateTurn = calendarData[turnIndexOffset + 1];

                return (
                  <div key={month} className="calendar-month">
                    <div className="month-header">{month}</div>
                    <div className="turns-container">
                      <div className="calendar-turn">
                        <span className="turn-label">E</span>
                        {earlyTurn.races.map((race) => (
                          <div
                            key={race.id}
                            className={`calendar-race-entry ${
                              careerRaceIds.has(race.id) ? "career" : "optional"
                            }`}
                            title={`${race.name} (${race.grade})`}
                          >
                            <span className="race-grade">
                              {getShortGrade(race.grade)}
                            </span>
                            <span className="race-name">{race.name}</span>
                          </div>
                        ))}
                      </div>
                      <div className="calendar-turn">
                        <span className="turn-label">L</span>
                        {lateTurn.races.map((race) => (
                          <div
                            key={race.id}
                            className={`calendar-race-entry ${
                              careerRaceIds.has(race.id) ? "career" : "optional"
                            }`}
                            title={`${race.name} (${race.grade})`}
                          >
                            <span className="race-grade">
                              {getShortGrade(race.grade)}
                            </span>
                            <span className="race-name">{race.name}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default CalendarView;
