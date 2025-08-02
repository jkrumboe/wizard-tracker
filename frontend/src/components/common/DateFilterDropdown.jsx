import '@/styles/components/DateFilterDropdown.css';


const DateFilterDropdown = ({
  value = '',
  onChange,
  className = ''
}) => {
  const handleDateChange = (e) => {
    onChange(e.target.value);
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

  const handleClear = () => {
    onChange('');
  };

  return (
    <div className={`date-filter-dropdown ${className}`}>
      <div className="date-filter-container">
        {!value ? (
          <input
            type="date"
            value={value}
            onChange={handleDateChange}
            className="date-picker-input visible"
            placeholder="Filter by date"
          />
        ) : (
          <div className="date-display-wrapper">
            <span className="date-display">
              {formatDisplayDate(value)}
            </span>
            <button 
              className="clear-date-btn"
              onClick={handleClear}
              type="button"
              aria-label="Clear date filter"
            >
              ×
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default DateFilterDropdown;