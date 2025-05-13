import { useState, useEffect, useMemo } from 'react';

export interface ItemPosition {
  x: number; // Relative to main button center
  y: number; // Relative to main button center
  angle: number; // In radians
}

interface RepulsionOrbitOptions {
  isOpen: boolean;
  centerPosition: { x: number; y: number }; // Absolute top-left of the draggable container
  numItems: number;
  orbitRadius: number;
  itemSize: number;
  mainButtonSize: number;
}

export function useRepulsionAndOrbit({
  isOpen,
  centerPosition,
  numItems,
  orbitRadius,
  itemSize,
  mainButtonSize,
}: RepulsionOrbitOptions): ItemPosition[] {
  const [itemPositions, setItemPositions] = useState<ItemPosition[]>([]);
  
  const [viewportSize, setViewportSize] = useState(() => ({
    width: typeof window !== 'undefined' ? window.innerWidth : 0,
    height: typeof window !== 'undefined' ? window.innerHeight : 0,
  }));

  useEffect(() => {
    const handleResize = () => {
      setViewportSize({ width: window.innerWidth, height: window.innerHeight });
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('resize', handleResize);
      return () => window.removeEventListener('resize', handleResize);
    }
    return () => {};
  }, []);

  const calculatedPositions = useMemo(() => {
    if (!isOpen || numItems === 0 || typeof window === 'undefined' || orbitRadius <= 0) {
      return [];
    }

    const mainButtonCenterX = centerPosition.x + mainButtonSize / 2;
    const mainButtonCenterY = centerPosition.y + mainButtonSize / 2;
    const halfItem = itemSize / 2;

    const isAngleSafe = (angle: number): boolean => {
      const itemAbsX = mainButtonCenterX + orbitRadius * Math.cos(angle);
      const itemAbsY = mainButtonCenterY + orbitRadius * Math.sin(angle);

      return (
        itemAbsX - halfItem >= 0 &&
        itemAbsX + halfItem <= viewportSize.width &&
        itemAbsY - halfItem >= 0 &&
        itemAbsY + halfItem <= viewportSize.height
      );
    };

    const numAngleSamples = 180; // Check every 2 degrees (360 / 180 = 2)
    const angleSampleStep = (2 * Math.PI) / numAngleSamples;
    const safeAnglesInfo: { angle: number; safe: boolean }[] = [];
    for (let i = 0; i < numAngleSamples; i++) {
      const angle = i * angleSampleStep;
      safeAnglesInfo.push({ angle, safe: isAngleSafe(angle) });
    }

    const safeArcs: { start: number; end: number; length: number }[] = [];
    let currentArcStartAngle: number | null = null;

    for (let i = 0; i <= numAngleSamples; i++) { // Iterate one past to handle arc ending at the very end
      const isCurrentSampleSafe = i < numAngleSamples ? safeAnglesInfo[i].safe : false; // Treat position after last sample as unsafe to close any open arc
      const currentSampleAngle = i < numAngleSamples ? safeAnglesInfo[i].angle : 2 * Math.PI; // Angle for this virtual position

      if (isCurrentSampleSafe && currentArcStartAngle === null) {
        currentArcStartAngle = currentSampleAngle;
      } else if (!isCurrentSampleSafe && currentArcStartAngle !== null) {
        // Arc ends *before* this unsafe sample, i.e., at currentSampleAngle
        safeArcs.push({ start: currentArcStartAngle, end: currentSampleAngle, length: currentSampleAngle - currentArcStartAngle });
        currentArcStartAngle = null;
      }
    }
    
    // Handle wrap-around case: if the first segment (starting at 0) and last segment (ending at 2*PI) are safe, merge them.
    if (safeAnglesInfo[0].safe && safeAnglesInfo[numAngleSamples - 1].safe && safeArcs.length > 1) {
        const firstArc = safeArcs.shift(); // Arc starting near 0
        const lastArc = safeArcs.pop();   // Arc ending near 2*PI
        if (firstArc && lastArc) {
          // The merged arc starts at lastArc.start and conceptually ends at firstArc.end + 2*PI
          // Its length is the sum of their original lengths.
          safeArcs.push({
              start: lastArc.start, 
              end: firstArc.end + 2 * Math.PI, // e.g. 0.2rad + 6.28rad = 6.48rad
              length: lastArc.length + firstArc.length
          });
        } else { // Should not happen if logic is correct, but put them back if one was missing
            if (firstArc) safeArcs.unshift(firstArc);
            if (lastArc) safeArcs.push(lastArc);
        }
    }

    if (safeArcs.length === 0) return [];

    let totalSafeAngleLength = safeArcs.reduce((sum, arc) => sum + arc.length, 0);
    
    // Prevent division by zero or extremely small lengths causing issues
    if (totalSafeAngleLength < 0.001) return [];


    const positions: ItemPosition[] = [];
    if (numItems === 0) return positions;

    // Distribute items across all safe arcs proportionally.
    const anglePerSlot = totalSafeAngleLength / numItems; 
    let accumulatedAngleInConcatenatedSpace = 0; // Tracks progress through the total available safe angle

    // Sort arcs by their start angle to process them in visual order (especially after potential merge)
    safeArcs.sort((a, b) => a.start - b.start);

    for (let itemIndex = 0; itemIndex < numItems; itemIndex++) {
      const itemCenterInConcatenatedSpace = (itemIndex + 0.5) * anglePerSlot;
      let foundPositionForItem = false;
      
      let currentArcAccumulatedLength = 0;
      for (const arc of safeArcs) {
        if (itemCenterInConcatenatedSpace >= currentArcAccumulatedLength &&
            itemCenterInConcatenatedSpace < currentArcAccumulatedLength + arc.length + 0.0001) { // Add epsilon for float comparisons at boundary
            
            const angleWithinArc = itemCenterInConcatenatedSpace - currentArcAccumulatedLength;
            let finalAngle = arc.start + angleWithinArc;
            
            finalAngle = finalAngle % (2 * Math.PI); // Normalize angle to be within [0, 2*PI)

            positions[itemIndex] = {
                x: orbitRadius * Math.cos(finalAngle),
                y: orbitRadius * Math.sin(finalAngle),
                angle: finalAngle,
            };
            foundPositionForItem = true;
            break; 
        }
        currentArcAccumulatedLength += arc.length;
      }
       // If somehow a position wasn't found (e.g. float precision issues with totalSafeAngleLength)
       // This fallback is unlikely if logic is sound but good for robustness.
      if (!foundPositionForItem && positions.length < numItems && safeArcs.length > 0) {
        // Place it in the middle of the first/largest arc as a fallback (crude)
        const fallbackArc = safeArcs[0];
        const fallbackAngle = (fallbackArc.start + fallbackArc.length / 2) % (2 * Math.PI);
         positions[itemIndex] = {
            x: orbitRadius * Math.cos(fallbackAngle),
            y: orbitRadius * Math.sin(fallbackAngle),
            angle: fallbackAngle,
        };
      }
    }
    
    // Ensure all items got a position, filter out any undefined if fallbacks failed.
    // The direct assignment positions[itemIndex] should preserve order.
    return positions.filter(p => p).sort((a, b) => a.angle - b.angle);

  }, [isOpen, centerPosition, numItems, orbitRadius, itemSize, mainButtonSize, viewportSize]);

  useEffect(() => {
    setItemPositions(calculatedPositions);
  }, [calculatedPositions]);

  return itemPositions;
}
