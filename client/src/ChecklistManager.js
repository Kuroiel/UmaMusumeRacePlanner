import React, { useRef, useState } from "react";
import PromptModal from "./PromptModal";

function ChecklistManager({
  savedChecklists = [],
  onSave,
  onLoad,
  onDelete,
  onRename,
  onImport,
  selectedCharacter,
}) {
  const fileInputRef = useRef(null);
  const [renameModalState, setRenameModalState] = useState({
    isOpen: false,
    oldName: "",
  });
  const [saveModalState, setSaveModalState] = useState({
    isOpen: false,
    defaultValue: "",
  });

  const handleSaveClick = () => {
    const defaultName = selectedCharacter
      ? `${selectedCharacter.name} Run`
      : `My Plan`;
    setSaveModalState({ isOpen: true, defaultValue: defaultName });
  };

  const handleSaveConfirm = (name) => {
    if (name) {
      onSave(name);
    }
    setSaveModalState({ isOpen: false, defaultValue: "" });
  };

  const handleSaveCancel = () => {
    setSaveModalState({ isOpen: false, defaultValue: "" });
  };

  const handleRenameClick = (oldName) => {
    setRenameModalState({ isOpen: true, oldName });
  };

  const handleRenameConfirm = (newName) => {
    const { oldName } = renameModalState;
    if (newName && newName !== oldName) {
      onRename(oldName, newName);
    }
    setRenameModalState({ isOpen: false, oldName: "" });
  };

  const handleRenameCancel = () => {
    setRenameModalState({ isOpen: false, oldName: "" });
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
            alert("Invalid file format.");
          }
        } catch (error) {
          alert("Error reading or parsing the file.");
        }
      };
      reader.readAsText(file);
      event.target.value = null;
    }
  };

  return (
    <>
      {renameModalState.isOpen && (
        <PromptModal
          title="Rename Checklist"
          message={`Enter a new name for "${renameModalState.oldName}":`}
          initialValue={renameModalState.oldName}
          onConfirm={handleRenameConfirm}
          onCancel={handleRenameCancel}
          confirmText="Rename"
        />
      )}

      {saveModalState.isOpen && (
        <PromptModal
          title="Save Checklist"
          message="Enter a name for this checklist:"
          initialValue={saveModalState.defaultValue}
          onConfirm={handleSaveConfirm}
          onCancel={handleSaveCancel}
          confirmText="Save"
        />
      )}

      <div className="panel-section">
        <h2>Checklist Manager</h2>
        <button
          className="manager-button"
          onClick={handleSaveClick}
          disabled={!selectedCharacter}
        >
          Save Current Checklist
        </button>

        {savedChecklists.length > 0 && (
          <div className="saved-checklists-list">
            {savedChecklists.map(({ name }) => (
              <div key={name} className="saved-checklist-item">
                <span className="checklist-name">{name}</span>
                <div className="checklist-actions">
                  <button onClick={() => onLoad(name)}>Load</button>
                  <button onClick={() => handleRenameClick(name)}>
                    Rename
                  </button>
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
    </>
  );
}

export default ChecklistManager;
