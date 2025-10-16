import React, { useState, useEffect, useRef } from "react";

function PromptModal({
  title,
  message,
  initialValue = "",
  onConfirm,
  onCancel,
  confirmText = "Confirm",
  cancelText = "Cancel",
}) {
  const [inputValue, setInputValue] = useState(initialValue);
  const inputRef = useRef(null);

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, []);

  const handleBackdropClick = (e) => {
    if (e.target.className === "modal-backdrop") {
      onCancel();
    }
  };

  const handleConfirm = () => {
    onConfirm(inputValue);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      handleConfirm();
    } else if (e.key === "Escape") {
      onCancel();
    }
  };

  return (
    <div className="modal-backdrop" onClick={handleBackdropClick}>
      <div className="modal-content" onKeyDown={handleKeyDown}>
        <h2>{title}</h2>
        <div className="modal-body">
          <p>{message}</p>
          <input
            ref={inputRef}
            type="text"
            className="modal-input"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
          />
        </div>
        <div className="modal-footer">
          <button className="modal-button cancel" onClick={onCancel}>
            {cancelText}
          </button>
          <button className="modal-button confirm" onClick={handleConfirm}>
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}

export default PromptModal;
