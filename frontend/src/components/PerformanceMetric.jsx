import React from 'react';

const PerformanceMetric = ({ label, value, target, isAboveTarget, targetLine }) => {
  // Calculate if the metric is above or below target
  const isBelowTarget = !isAboveTarget && value < target;
  const isAtTarget = value >= target && !isAboveTarget || value <= target && isAboveTarget;
  const showTargetLine = targetLine !== undefined ? targetLine : true;

  // Calculate percentage for the progress bar (capped at 100%)
  let percentage;
  if (target <= 0) {
    percentage = 0; // Handle edge case
  } else if (isAboveTarget) {
    // For metrics where lower is better
    const maxValue = target * 2;
    percentage = Math.max(
      0,
      Math.min(Math.round((1 - value / maxValue) * 100), 100)
    );
  } else {
    // For metrics where higher is better
    percentage = Math.min(Math.round((value / target) * 100), 100);
  }  
  // Calculate target position for the marker
  let targetPosition;
  if (isAboveTarget) {
    // For metrics where lower is better
    // Determine the scale maximum based on current value
    const scaleMaximum = value > target ? value * 1.5 : target * 2;
    // Calculate what percentage the target is of the maximum scale
    const targetPercentage = (target / scaleMaximum) * 100;
    // Ensure the percentage doesn't exceed 100%
    targetPosition = Math.min(Math.round(targetPercentage), 100);
  } else {
    // For metrics where higher is better
    // Use a consistent scale that's 1.5x the target for better visualization
    const scaleMaximum = target * 1.5;
    // Calculate what percentage the target is of the maximum scale
    const targetPercentage = (target / scaleMaximum) * 100;
    // Ensure the percentage doesn't exceed 100%
    targetPosition = Math.min(Math.round(targetPercentage), 100);
  }

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
