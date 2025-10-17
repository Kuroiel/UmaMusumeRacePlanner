import React from "react";

function Modal({
  title,
  children,
  onConfirm,
  onCancel,
  confirmText = "Confirm",
  cancelText = "Cancel",
}) {
  const handleBackdropClick = (e) => {
    if (e.target.className === "modal-backdrop") {
      onCancel();
    }
  };
  return (
    <div className="modal-backdrop" onClick={handleBackdropClick}>
      <div
        className="modal-content"
        role="dialog"
        aria-labelledby="modal-title"
        aria-modal="true"
      >
        <h2 id="modal-title">{title}</h2>
        <div className="modal-body">{children}</div>
        <div className="modal-footer">
          <button className="modal-button cancel" onClick={onCancel}>
            {cancelText}
          </button>
          <button className="modal-button confirm" onClick={onConfirm}>
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
export default Modal;
