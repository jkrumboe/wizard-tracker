const StatCard = ({ title, value, change }) => {
  const hasChange = change !== undefined
  const isPositive = hasChange && change > 0
  const changeClass = isPositive ? "positive" : "negative"
  const changeIcon = isPositive ? "↑" : "↓"

  return (
    <div className="stat-card">
      <div className="stat-title">{title}</div>
      <div className="stat-value">{value}</div>
      {hasChange && (
        <div className={`stat-change ${changeClass}`}>
          {changeIcon} {Math.abs(change)}
        </div>
      )}
    </div>
  )
}

export default StatCard

