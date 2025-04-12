"use client"

import { useState, useEffect, useRef } from "react"

const NumberPicker = ({ value, onChange, min = 0, max = 10, title = "Select a number" }) => {
  const [isOpen, setIsOpen] = useState(false)
  const [currentValue, setCurrentValue] = useState(value || 0)
  const modalRef = useRef(null)

  // Reset to initial value when modal opens
  useEffect(() => {
    if (isOpen) {
      setCurrentValue(value)
    }
  }, [isOpen, value])

  // Close modal when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (modalRef.current && !modalRef.current.contains(event.target)) {
        setIsOpen(false)
      }
    }

    // Close on ESC key
    const handleEscKey = (event) => {
      if (event.key === 'Escape') {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside)
      document.addEventListener("keydown", handleEscKey)
      // Lock body scroll when popup is open
      document.body.style.overflow = 'hidden'
    } else {
      document.removeEventListener("mousedown", handleClickOutside)
      document.removeEventListener("keydown", handleEscKey)
      // Restore body scroll when popup is closed
      document.body.style.overflow = ''
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
      document.removeEventListener("keydown", handleEscKey)
      document.body.style.overflow = ''
    }
  }, [isOpen])

  const increment = (step) => {
    setCurrentValue(prev => {
      const newValue = prev + step
      return Math.min(max, Math.max(min, newValue))
    })
  }

  const reset = () => {
    setCurrentValue(min)
  }

  return (
    <div className="number-picker">
      <button
        className="number-display"
        onClick={() => setIsOpen(true)}
        aria-label={`Current value: ${value}. Click to change.`}
      >
        {value}
      </button>

      {isOpen && (
        <div className="number-picker-modal-overlay">
          <div className="number-picker-modal" ref={modalRef}>
            <div className="number-picker-header">
              <h3>{title}</h3>
              <button className="close-button" onClick={() => setIsOpen(false)} aria-label="Close">
                ×
              </button>
            </div>

            <div className="number-picker-value">{currentValue}</div>

            <div className="increment-controls">
              <button 
                className="increment-button" 
                onClick={() => increment(1)}
                disabled={currentValue >= max}
              >
                +1
              </button>
              <button 
                className="increment-button" 
                onClick={() => increment(2)}
                disabled={currentValue + 2 > max}
              >
                +2
              </button>
              {max >= 5 && (
                <button 
                  className="increment-button" 
                  onClick={() => increment(5)}
                  disabled={currentValue + 5 > max}
                >
                  +5
                </button>
              )}
              <button 
                className="reset-button" 
                onClick={reset}
                disabled={currentValue === min}
              >
                Reset
              </button>
            </div>

            <button
              className="confirm-button"
              onClick={() => {
                onChange(currentValue)
                setIsOpen(false)
              }}
            >
              Set Value
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default NumberPicker