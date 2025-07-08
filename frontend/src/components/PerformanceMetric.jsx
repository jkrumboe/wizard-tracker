import React from 'react';

const PerformanceMetric = ({ 
  label, 
  value, 
  target, 
  targetMin, 
  targetMax, 
  isAboveTarget, 
  targetLine, 
  isPercentage = false,
  isBadWhenAboveMax = false 
}) => {
  // Use targetMin and targetMax if provided, otherwise use target as a single point
  const hasRange = targetMin !== undefined && targetMax !== undefined;
  
  // Calculate if the metric is within target range
  const isWithinRange = hasRange && value >= targetMin && value <= targetMax;
  // const isBelowTarget = !isWithinRange && ((hasRange && value < targetMin) || (!hasRange && !isAboveTarget && value < target));
  // const isAboveTargetValue = !isWithinRange && ((hasRange && value > targetMax) || (!hasRange && isAboveTarget && value > target));
  
  // Determine if the value is good or needs improvement based on the direction and range
  const isGood = hasRange ? 
    (isWithinRange || (!isBadWhenAboveMax && value > targetMax)) : 
    (isAboveTarget ? value <= target : value >= target);
  
  const showTargetLine = targetLine !== undefined ? targetLine : true;

  // Calculate percentage for the progress bar (capped at 100%)
  let percentage;
  
  if (isPercentage) {
    // For percentage metrics, use actual percentage value directly (0-100 scale)
    percentage = Math.min(Math.max(0, value), 100);
  } else if (hasRange) {
    // For a range, we use the range as the scale
    const rangeSize = targetMax - targetMin;
    if (rangeSize <= 0) {
      percentage = 50; // Default to middle for invalid ranges
    } else {
      const normalizedValue = Math.min(Math.max(value, 0), targetMax * 1.5);
      percentage = Math.min((normalizedValue / (targetMax * 1.5)) * 100, 100);
    }
  } else {
    // Use original logic for single target value
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
  }
  
  // Calculate marker positions for min and max values
  let minTargetPosition, maxTargetPosition;
  
  if (isPercentage) {
    // For percentage metrics, position markers at their actual percentage values
    if (hasRange) {
      minTargetPosition = Math.min(targetMin, 100);
      maxTargetPosition = Math.min(targetMax, 100);
    } else {
      minTargetPosition = Math.min(target, 100);
      maxTargetPosition = minTargetPosition;
    }
  } else if (hasRange) {
    // For a target range, calculate positions for both min and max
    const scale = targetMax * 1.5; // Use 1.5x the max target as the scale
    minTargetPosition = Math.min(Math.round((targetMin / scale) * 100), 100);
    maxTargetPosition = Math.min(Math.round((targetMax / scale) * 100), 100);
  } else {
    // For a single target, use the original calculation
    if (isAboveTarget) {
      // For metrics where lower is better
      const scaleMaximum = value > target ? value * 1.5 : target * 2;
      // Calculate what percentage the target is of the maximum scale
      const targetPercentage = (target / scaleMaximum) * 100;
      // Ensure the percentage doesn't exceed 100%
      minTargetPosition = Math.min(Math.round(targetPercentage), 100);
      maxTargetPosition = minTargetPosition; // Same position for both markers
    } else {
      // For metrics where higher is better
      // Use a consistent scale that's 1.5x the target for better visualization
      const scaleMaximum = target * 1.5;
      // Calculate what percentage the target is of the maximum scale
      const targetPercentage = (target / scaleMaximum) * 100;
      // Ensure the percentage doesn't exceed 100%
      minTargetPosition = Math.min(Math.round(targetPercentage), 100);
      maxTargetPosition = minTargetPosition; // Same position for both markers
    }
  }

  // Determine the trend icon based on value position relative to target(s)
  // let trendIcon;
  // if (hasRange) {
  //   if (value < targetMin) trendIcon = '↓';
  //   else if (value > targetMax) trendIcon = '↑';
  //   else trendIcon = '→';
  // } else {
  //   if (isBelowTarget) trendIcon = '↓';
  //   else if (isAboveTargetValue) trendIcon = '↑';
  //   else trendIcon = '→';
  // }

  return (
    <div className="performance-metric">
      <div className="metric-header">
        <span className="metric-label">{label}</span>
        <span className="metric-value">
          {isPercentage ? `${value}%` : value}
          {/* <span className="trend-icon">{trendIcon}</span> */}
        </span>
      </div>
      <div className="metric-bar-container">
        {/* Target markers */}
        {showTargetLine && hasRange ? (
          <>
            <div 
              className="target-marker target-min"
              style={{ left: `${minTargetPosition}%` }}
              title={`Target Min: ${targetMin}`}
            >
              <div className={`target-value-label ${minTargetPosition < 10 ? 'target-value-label-left-edge' : ''}`}>
                {isPercentage ? `${targetMin}%` : targetMin}
              </div>
            </div>
            <div 
              className="target-marker target-max"
              style={{ left: `${maxTargetPosition}%` }}
              title={`Target Max: ${targetMax}`}
            >
              <div className={`target-value-label ${maxTargetPosition > 90 ? 'target-value-label-right-edge' : ''}`}>
                {isPercentage ? `${targetMax}%` : targetMax}
              </div>
            </div>
            <div 
              className="target-range"
              style={{ 
                left: `${minTargetPosition}%`,
                width: `${maxTargetPosition - minTargetPosition}%` 
              }}
              title={`Target Range: ${targetMin}-${targetMax}`}
            >
            </div>
          </>
        ) : (
          showTargetLine && (
            <div 
              className="target-marker"
              style={{ left: `${minTargetPosition}%` }}
              title={`Target: ${target}`}
            >
              <div className={`target-value-label ${
                minTargetPosition < 10 
                  ? 'target-value-label-left-edge' 
                  : minTargetPosition > 90 
                    ? 'target-value-label-right-edge' 
                    : ''
              }`}>
                {isPercentage ? `${target}%` : target}
              </div>
            </div>
          )
        )}
        <div 
          className={`metric-bar ${isGood ? 'above-target' : 'below-target'}`}
          style={{ width: `${percentage}%` }}
        ></div>
      </div>
    </div>
  );
};

export default PerformanceMetric;
