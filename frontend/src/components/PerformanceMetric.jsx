import React from 'react';

const PerformanceMetric = ({ label, value, target, isAboveTarget, targetLine }) => {
  // Calculate if the metric is above or below target
  const isBelowTarget = !isAboveTarget && value < target;
  const isAtTarget = value >= target && !isAboveTarget || value <= target && isAboveTarget;
  const showTargetLine = targetLine !== undefined ? targetLine : true;

  // Calculate percentage for the progress bar (capped at 100%)
  let percentage = Math.min(Math.round((value / target) * 100), 100);
  
  // For metrics where lower is better, invert the percentage calculation
  if (isAboveTarget) {
    percentage = Math.min(Math.round((1 - (value / (target * 2))) * 100), 100);
  }
  
  // Calculate target position for the marker
  // For metrics where higher is better, target position is simply the percentage of target
  // For metrics where lower is better, the target position is relative to max scale (target*2)
  const targetPosition = isAboveTarget ? 
    Math.min(Math.round((target / (value > target ? value * 1.5 : target * 2)) * 100), 100) :
    Math.min(Math.round((target / (target * 1.5)) * 100), 100);

  return (
    <div className="performance-metric">
      <div className="metric-header">
        <span className="metric-label">{label}</span>
        <span className="metric-value">
          {value}
          <span className="trend-icon">{isBelowTarget ? '↓' : isAtTarget ? '→' : '↑'}</span>
        </span>
      </div>
      <div className="metric-bar-container">
        {/* Target marker */}
        {showTargetLine && <div 
          className="target-marker"
          style={{ left: `${targetPosition}%` }}
          title={`Target: ${target}`}
        />}
        <div 
          className={`metric-bar ${isBelowTarget ? 'below-target' : 'above-target'}`}
          style={{ width: `${percentage}%` }}
        ></div>
      </div>
    </div>
  );
};

export default PerformanceMetric;
