import './DateFilterDropdown.css';
import { useRef } from 'react';

const DateFilterDropdown = ({ 
  value = '', 
  onChange, 
  className = ''
}) => {
  const inputRef = useRef(null);

  const handleDateChange = (e) => {
    onChange(e.target.value);
  };

  const handleClear = (e) => {
    e.stopPropagation();
    onChange('');
  };

  const handleContainerClick = () => {
    if (inputRef.current) {
      inputRef.current.focus();
      inputRef.current.showPicker?.();
    }
  };

  const formatDisplayDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      year: 'numeric'
    });
  };

  return (
    <div className={`date-filter-dropdown ${className}`}>
      <div className="date-filter-container" onClick={handleContainerClick}>
        <input
          ref={inputRef}
          type="date"
          value={value}
          onChange={handleDateChange}
          className="date-picker-input"
        />
        {value && (
          <span className="date-display">
            {formatDisplayDate(value)}
            <button 
              className="clear-date-btn"
              onClick={handleClear}
              type="button"
              aria-label="Clear date filter"
            >
              ×
            </button>
          </span>
        )}
        {!value && (
          <span className="date-placeholder">
            Filter by date
          </span>
        )}
      </div>
    </div>
  );
};

export default DateFilterDropdown;
