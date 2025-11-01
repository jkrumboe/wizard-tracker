import React, { useState, useEffect, useRef } from 'react';
import { getPlayerSuggestions, filterPlayerSuggestions } from '@/shared/utils/playerSuggestions';
import '@/styles/components/PlayerNameInput.css';

/**
 * Player Name Input with Autocomplete
 * Suggests player names from local storage based on user input
 */
const PlayerNameInput = ({ 
  value, 
  onChange, 
  placeholder = "Player name",
  className = "",
  ...inputProps 
}) => {
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [allPlayerNames, setAllPlayerNames] = useState([]);
  const inputRef = useRef(null);
  const suggestionsRef = useRef(null);

  // Load all player names on mount
  useEffect(() => {
    const playerNames = getPlayerSuggestions();
    setAllPlayerNames(playerNames);
  }, []);

  // Update suggestions when value changes
  useEffect(() => {
    if (value && value.trim()) {
      const filtered = filterPlayerSuggestions(value, allPlayerNames);
      setSuggestions(filtered);
      setShowSuggestions(filtered.length > 0);
      setSelectedIndex(-1);
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
      setSelectedIndex(-1);
    }
  }, [value, allPlayerNames]);

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        inputRef.current && 
        !inputRef.current.contains(event.target) &&
        suggestionsRef.current &&
        !suggestionsRef.current.contains(event.target)
      ) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleInputChange = (e) => {
    onChange(e);
  };

  const handleSuggestionClick = (suggestion) => {
    // Create a synthetic event to match the onChange signature
    const syntheticEvent = {
      target: { value: suggestion },
      currentTarget: { value: suggestion }
    };
    onChange(syntheticEvent);
    setShowSuggestions(false);
    setSelectedIndex(-1);
  };

  const handleKeyDown = (e) => {
    if (!showSuggestions || suggestions.length === 0) {
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => 
          prev < suggestions.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => prev > 0 ? prev - 1 : -1);
        break;
      case 'Enter':
        if (selectedIndex >= 0 && selectedIndex < suggestions.length) {
          e.preventDefault();
          handleSuggestionClick(suggestions[selectedIndex]);
        }
        break;
      case 'Escape':
        setShowSuggestions(false);
        setSelectedIndex(-1);
        break;
      default:
        break;
    }
  };

  const handleFocus = () => {
    if (value && value.trim() && suggestions.length > 0) {
      setShowSuggestions(true);
    }
  };

  return (
    <div className="player-name-input-wrapper">
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        onFocus={handleFocus}
        placeholder={placeholder}
        className={`player-name-input ${className}`}
        autoComplete="off"
        {...inputProps}
      />
      {showSuggestions && suggestions.length > 0 && (
        <ul ref={suggestionsRef} className="player-suggestions-list">
          {suggestions.map((suggestion, index) => (
            <li
              key={index}
              className={`player-suggestion-item ${index === selectedIndex ? 'selected' : ''}`}
              onClick={() => handleSuggestionClick(suggestion)}
              onMouseEnter={() => setSelectedIndex(index)}
            >
              {suggestion}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default PlayerNameInput;
