"use client"

import { useState, useEffect, useRef } from "react"

const NumberPicker = ({ value, onChange, min = 0, max = 10, title = "Select a number" }) => {
  const [isOpen, setIsOpen] = useState(false)
  const [currentValue, setCurrentValue] = useState(value || 0)
  const modalRef = useRef(null)
  const buttonRef = useRef(null)
  const isClosingRef = useRef(false)

  // Update currentValue only when value prop changes and modal is closed
  useEffect(() => {
    if (!isOpen && !isClosingRef.current) {
      setCurrentValue(value || 0)
    }
  }, [value, isOpen])

  // Close modal when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      // Don't close if we're already closing
      if (isClosingRef.current) return
      
      if (modalRef.current && !modalRef.current.contains(event.target) && 
          buttonRef.current && !buttonRef.current.contains(event.target)) {
        isClosingRef.current = true
        setIsOpen(false)
        setTimeout(() => {
          isClosingRef.current = false
        }, 100)
      }
    }

    // Close on ESC key
    const handleEscKey = (event) => {
      if (event.key === 'Escape' && !isClosingRef.current) {
        isClosingRef.current = true
        setIsOpen(false)
        setTimeout(() => {
          isClosingRef.current = false
        }, 100)
      }
    }

    if (isOpen) {
      // Use setTimeout to avoid immediate closing
      setTimeout(() => {
        document.addEventListener("mousedown", handleClickOutside)
        document.addEventListener("keydown", handleEscKey)
      }, 50)
      
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

  const handleOpenModal = (e) => {
    e.preventDefault()
    e.stopPropagation()
    
    if (isClosingRef.current) return
    
    setCurrentValue(value || 0) // Reset to current value when opening
    setIsOpen(true)
  }
  const increment = (step) => {
    setCurrentValue(prev => {
      const newValue = prev + step
      return Math.min(max, Math.max(min, newValue))
    })
  }

  const reset = () => {
    setCurrentValue(min)
  }
  const handleConfirm = (e) => {
    e.preventDefault()
    e.stopPropagation()
    
    if (isClosingRef.current) return
    
    isClosingRef.current = true
    onChange(currentValue)
    setIsOpen(false)
    
    setTimeout(() => {
      isClosingRef.current = false
    }, 100)
  }

  const handleCloseModal = (e) => {
    e.preventDefault()
    e.stopPropagation()
    
    if (isClosingRef.current) return
    
    isClosingRef.current = true
    setIsOpen(false)
    
    setTimeout(() => {
      isClosingRef.current = false
    }, 100)
  }

  return (
    <div className="number-picker">
      <button
        ref={buttonRef}
        className="number-display"
        onClick={handleOpenModal}
        aria-label={`Current value: ${value}. Click to change.`}
        type="button"
      >
        {value}
      </button>      {isOpen && (
        <div className="number-picker-modal-overlay" onClick={handleCloseModal}>
          <div className="number-picker-modal" ref={modalRef} onClick={(e) => e.stopPropagation()}>
            <div className="number-picker-header">
              <h3>{title}</h3>
              <button className="close-button" onClick={handleCloseModal} aria-label="Close">
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
            </div>            <button
              className="confirm-button"
              onClick={handleConfirm}
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