import React, { useRef } from "react";

function ChecklistManager({
  savedChecklists,
  onSave,
  onLoad,
  onDelete,
  onRename,
  onImport,
}) {
  const fileInputRef = useRef(null);

  const handleSaveClick = () => {
    const name = prompt("Enter a name for this checklist:", "");
    if (name) {
      onSave(name);
    }
  };

  const handleRenameClick = (oldName) => {
    const newName = prompt(`Enter a new name for "${oldName}":`, oldName);
    if (newName && newName !== oldName) {
      onRename(oldName, newName);
    }
  };

  const handleExportClick = () => {
    const jsonString = JSON.stringify(savedChecklists, null, 2);
    const blob = new Blob([jsonString], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "umamusume-checklists.json";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleImportClick = () => {
    fileInputRef.current.click();
  };

  const handleFileChange = (event) => {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const importedData = JSON.parse(e.target.result);
          if (Array.isArray(importedData)) {
            onImport(importedData);
          } else {
            alert(
              "Invalid file format. Please import a valid checklist JSON file."
            );
          }
        } catch (error) {
          alert("Error reading or parsing the file.");
        }
      };
      reader.readAsText(file);
      event.target.value = null; // Reset the input so you can import the same file again
    }
  };

  return (
    <div className="panel-section">
      <h2>Checklist Manager</h2>
      <button className="manager-button" onClick={handleSaveClick}>
        Save Current Checklist
      </button>

      {savedChecklists.length > 0 && (
        <div className="saved-checklists-list">
          {savedChecklists.map(({ name }) => (
            <div key={name} className="saved-checklist-item">
              <span className="checklist-name">{name}</span>
              <div className="checklist-actions">
                <button onClick={() => onLoad(name)}>Load</button>
                <button onClick={() => handleRenameClick(name)}>Rename</button>
                <button
                  className="delete-button"
                  onClick={() => onDelete(name)}
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="io-buttons">
        <button
          className="manager-button"
          onClick={handleExportClick}
          disabled={savedChecklists.length === 0}
        >
          Export All
        </button>
        <button className="manager-button" onClick={handleImportClick}>
          Import All
        </button>
        <input
          type="file"
          accept=".json"
          ref={fileInputRef}
          style={{ display: "none" }}
          onChange={handleFileChange}
        />
      </div>
    </div>
  );
}

export default ChecklistManager;
