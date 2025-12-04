import React, { useRef, useState, useMemo } from "react";
import PromptModal from "./PromptModal";
import toast from "react-hot-toast";

function ChecklistManager({
  savedChecklists = [],
  onSave,
  onLoad,
  onDelete,
  onRename,
  onReorder,
  onExportSingle,
  onImportSingle,
  onImport,
  selectedCharacter,
  currentChecklistName,
  onSort,
}) {
  const fileInputRef = useRef(null);
  const singleFileInputRef = useRef(null);
  const [renameModalState, setRenameModalState] = useState({
    isOpen: false,
    oldName: "",
  });
  const [saveModalState, setSaveModalState] = useState({
    isOpen: false,
    defaultValue: "",
  });
  const [searchTerm, setSearchTerm] = useState("");

  const filteredChecklists = useMemo(() => {
    const lowercasedTerm = searchTerm.toLowerCase();
    if (!lowercasedTerm) {
      return savedChecklists;
    }
    return savedChecklists.filter(
      (checklist) =>
        checklist.name.toLowerCase().includes(lowercasedTerm) ||
        (checklist.characterName &&
          checklist.characterName.toLowerCase().includes(lowercasedTerm))
    );
  }, [savedChecklists, searchTerm]);

  const handleSaveClick = () => {
    const defaultName =
      currentChecklistName ||
      (selectedCharacter ? `${selectedCharacter.name} Run` : `My Plan`);
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

  const handleExportAllClick = () => {
    const jsonString = JSON.stringify(savedChecklists, null, 2);
    const blob = new Blob([jsonString], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "umamusume-race-planner-all.json";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleImportAllClick = () => {
    fileInputRef.current.click();
  };

  const handleImportSingleClick = () => {
    singleFileInputRef.current.click();
  };

  const handleFileChange = (event, isSingleImport) => {
    const file = event.target.files[0];
    if (file) {
      const MAX_FILE_SIZE_MB = 5;
      if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
        toast.error(`File size cannot exceed ${MAX_FILE_SIZE_MB}MB.`);
        event.target.value = null;
        return;
      }
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const importedData = JSON.parse(e.target.result);
          if (isSingleImport) {
            onImportSingle(importedData);
          } else {
            if (Array.isArray(importedData)) {
              onImport(importedData);
            } else {
              toast.error("Invalid file format for importing all checklists.");
            }
          }
        } catch (error) {
          toast.error("Error reading or parsing the file.");
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

      <div className="checklist-manager-content">
        <button
          className="manager-button"
          onClick={handleSaveClick}
          disabled={!selectedCharacter}
        >
          Save Current Checklist
        </button>

        {savedChecklists.length > 0 && (
          <>
            <input
              type="text"
              placeholder="Search checklists..."
              className="search-bar"
              style={{ marginTop: "15px", marginBottom: "5px" }}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <div className="saved-checklists-list">
              {filteredChecklists.map(({ name, characterName }, index) => {
                const originalIndex = savedChecklists.findIndex(
                  (c) => c.name === name
                );
                return (
                  <div key={name} className="saved-checklist-item">
                    <span className="checklist-name">
                      {name}
                      <span
                        style={{
                          fontSize: "0.8em",
                          color: "var(--color-text-secondary)",
                          marginLeft: "8px",
                          fontWeight: "normal",
                        }}
                      >
                        ({characterName || "Unknown"})
                      </span>
                    </span>

                    <div className="checklist-actions">
                      <button
                        onClick={() => onReorder(originalIndex, "up")}
                        disabled={searchTerm !== "" || originalIndex === 0}
                        title={
                          searchTerm !== ""
                            ? "Clear search to reorder"
                            : "Move Up"
                        }
                        aria-label="Move Up"
                      >
                        ↑
                      </button>
                      <button
                        onClick={() => onReorder(originalIndex, "down")}
                        disabled={
                          searchTerm !== "" ||
                          originalIndex === savedChecklists.length - 1
                        }
                        title={
                          searchTerm !== ""
                            ? "Clear search to reorder"
                            : "Move Down"
                        }
                        aria-label="Move Down"
                      >
                        ↓
                      </button>
                      <button
                        className="load-button"
                        onClick={() => onLoad(name)}
                      >
                        Load
                      </button>
                      <button onClick={() => handleRenameClick(name)}>
                        Rename
                      </button>
                      <button onClick={() => onExportSingle(name)}>
                        Export
                      </button>
                      <button
                        className="delete-button"
                        onClick={() => onDelete(name)}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
        <div className="io-buttons">
          <button
            className="manager-button"
            onClick={handleExportAllClick}
            disabled={savedChecklists.length === 0}
          >
            Export All
          </button>
          <button className="manager-button" onClick={handleImportAllClick}>
            Import All
          </button>
          <input
            type="file"
            accept=".json"
            ref={fileInputRef}
            style={{ display: "none" }}
            onChange={(e) => handleFileChange(e, false)}
          />
        </div>
        <div className="io-buttons" style={{ marginTop: "5px" }}>
          <button
            className="manager-button"
            style={{ width: "100%" }}
            onClick={handleImportSingleClick}
          >
            Import Single
          </button>
          <input
            type="file"
            accept=".json"
            ref={singleFileInputRef}
            style={{ display: "none" }}
            onChange={(e) => handleFileChange(e, true)}
          />
        </div>
        {savedChecklists.length > 1 && (
          <div className="io-buttons" style={{ marginTop: "5px" }}>
            <button className="manager-button" onClick={() => onSort("name")}>
              Sort by Name (A-Z)
            </button>
            <button
              className="manager-button"
              onClick={() => onSort("character")}
            >
              Sort by Character
            </button>
          </div>
        )}
      </div>
    </>
  );
}

export default ChecklistManager;
