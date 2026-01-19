const StatCard = ({ title, icon, value, change, color }) => {
  const hasChange = change !== undefined
  const isPositive = hasChange && change > 0
  const changeClass = isPositive ? "positive" : "negative"
  const changeIcon = isPositive ? "↑" : "↓"

  const colorStyles = color ? {
    background: color === 'green' ? 'rgba(29, 191, 115, 0.1)' : color === 'red' ? 'rgba(239, 68, 68, 0.1)' : undefined,
    border: color === 'green' ? '2px solid #1DBF73' : color === 'red' ? '2px solid #EF4444' : undefined,
    '--stat-color': color === 'green' ? '#1DBF73' : color === 'red' ? '#EF4444' : undefined
  } : {}

  return (
    <div className="stat-card" style={colorStyles}>
      {icon ? (
        <div className="stat-icon" style={{ color: colorStyles['--stat-color'] }} title={title}>{icon}</div>
      ) : (
        <div className="stat-title">{title}</div>
      )}
      <div className="stat-value" style={colorStyles['--stat-color'] ? { color: colorStyles['--stat-color'] } : {}}>{value}</div>
      {hasChange && (
        <div className={`stat-change ${changeClass}`}>
          {changeIcon} {Math.abs(change)}
        </div>
      )}
    </div>
  )
}

export default StatCard

