import React from "react";

const EpithetStatusBadge = ({ status, isRecommended }) => {
  if (status === "impossible") {
    return <span className="epithet-badge impossible">Impossible</span>;
  }
  if (status === "complete") {
    return <span className="epithet-badge complete">Complete</span>;
  }
  if (isRecommended) {
    return <span className="epithet-badge recommended">Recommended</span>;
  }
  return <span className="epithet-badge not-recommended">Not Recommended</span>;
};

function EpithetHelper({ epithetStatus, onAddRaces }) {
  if (!epithetStatus || epithetStatus.length === 0) {
    return null;
  }

  // The <h2> "Epithet Helper" has been removed from here.
  // The title is now handled by the collapsible header in Planner.js.
  return (
    <div className="epithet-helper">
      <div className="epithet-list-container">
        {epithetStatus.map((epithet) => (
          <div key={epithet.name} className="epithet-item">
            <div className="epithet-header">
              <h4>{epithet.name}</h4>
              <EpithetStatusBadge
                status={epithet.status}
                isRecommended={epithet.isRecommended}
              />
            </div>
            <div className="epithet-progress">
              <span>
                Progress: {epithet.completedCount} / {epithet.requiredCount}
              </span>
            </div>
            {epithet.status !== "complete" &&
              epithet.status !== "impossible" && (
                <div className="epithet-actions">
                  <button
                    onClick={() => onAddRaces(epithet.missingRaces)}
                    disabled={epithet.missingRaces.length === 0}
                  >
                    Add Missing ({epithet.missingRaces.length})
                  </button>
                </div>
              )}
            {epithet.status === "impossible" && epithet.conflictReason && (
              <div className="epithet-reason">
                <span>Reason: {epithet.conflictReason}</span>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default EpithetHelper;
