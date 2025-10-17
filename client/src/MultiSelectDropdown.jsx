import React, { useState, useEffect, useRef } from "react";

function MultiSelectDropdown({ name, options, selected, onChange }) {
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [wrapperRef]);

  const handleSelect = (optionValue) => {
    const newSelected = selected.includes(optionValue)
      ? selected.filter((item) => item !== optionValue)
      : [...selected, optionValue];
    onChange(name, newSelected);
  };

  const displayText =
    selected.length === 0
      ? `Any ${name}`
      : selected.length === 1
      ? options.find((o) => o.value === selected[0])?.label ?? selected[0]
      : selected.length === options.length
      ? `All ${name}s`
      : selected.length > 2
      ? `${selected.length} of ${options.length} selected`
      : selected.join(", ");

  return (
    <div className="multi-select-dropdown" ref={wrapperRef}>
      <div className="multi-select-display" onClick={() => setIsOpen(!isOpen)}>
        <span>{displayText}</span>
        <span>{isOpen ? "▲" : "▼"}</span>
      </div>
      {isOpen && (
        <div className="multi-select-options">
          {options.map((option) => (
            <label key={option.value}>
              <input
                type="checkbox"
                checked={selected.includes(option.value)}
                onChange={() => handleSelect(option.value)}
              />
              {option.label}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

export default MultiSelectDropdown;
