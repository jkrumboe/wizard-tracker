import '@/styles/components/DateFilterDropdown.css';

const DateFilterDropdown = ({
  value = '',
  onChange,
  className = ''
}) => {
  const handleDateChange = (e) => {
    onChange(e.target.value);
  };

  return (
    <div className={`date-filter-dropdown ${className}`}>
      <input
        type="date"
        value={value}
        onChange={handleDateChange}
        className="date-picker-input"
        placeholder="Filter by date"
      />
    </div>
  );
};

export default DateFilterDropdown;