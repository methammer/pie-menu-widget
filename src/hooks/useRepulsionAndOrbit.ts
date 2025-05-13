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

const VERY_SMALL_NUMBER = 0.00001; // Used for float comparisons

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

    const numAngleSamples = 180; 
    const angleSampleStep = (2 * Math.PI) / numAngleSamples;
    const safeAnglesInfo: { angle: number; safe: boolean }[] = [];
    for (let i = 0; i < numAngleSamples; i++) {
      const angle = i * angleSampleStep;
      safeAnglesInfo.push({ angle, safe: isAngleSafe(angle) });
    }

    const safeArcs: { start: number; end: number; length: number }[] = [];
    let currentArcStartAngle: number | null = null;

    for (let i = 0; i <= numAngleSamples; i++) { 
      const isCurrentSampleSafe = i < numAngleSamples ? safeAnglesInfo[i].safe : false; 
      const currentSampleAngle = i < numAngleSamples ? safeAnglesInfo[i].angle : 2 * Math.PI; 

      if (isCurrentSampleSafe && currentArcStartAngle === null) {
        currentArcStartAngle = currentSampleAngle;
      } else if (!isCurrentSampleSafe && currentArcStartAngle !== null) {
        if (currentSampleAngle > currentArcStartAngle) { // Ensure arc has positive length
            safeArcs.push({ start: currentArcStartAngle, end: currentSampleAngle, length: currentSampleAngle - currentArcStartAngle });
        }
        currentArcStartAngle = null;
      }
    }
    
    if (safeAnglesInfo[0].safe && safeAnglesInfo[numAngleSamples - 1].safe && safeArcs.length > 1) {
        const firstArcIndex = safeArcs.findIndex(arc => Math.abs(arc.start - 0) < VERY_SMALL_NUMBER || Math.abs(arc.start - safeAnglesInfo[0].angle) < VERY_SMALL_NUMBER);
        const lastArcIndex = safeArcs.findIndex(arc => Math.abs(arc.end - 2 * Math.PI) < VERY_SMALL_NUMBER || Math.abs(arc.end - (safeAnglesInfo[numAngleSamples-1].angle + angleSampleStep)) < VERY_SMALL_NUMBER);

        if (firstArcIndex !== -1 && lastArcIndex !== -1 && firstArcIndex !== lastArcIndex) {
            const firstArc = safeArcs[firstArcIndex];
            const lastArc = safeArcs[lastArcIndex];

            // Remove old arcs
            const newSafeArcs = safeArcs.filter((_, index) => index !== firstArcIndex && index !== lastArcIndex);
            
            // Add merged arc
            newSafeArcs.push({
                start: lastArc.start, 
                end: firstArc.end + 2 * Math.PI, 
                length: lastArc.length + firstArc.length
            });
            safeArcs.splice(0, safeArcs.length, ...newSafeArcs); // Replace safeArcs content
        }
    }

    if (safeArcs.length === 0) return [];

    let totalSafeAngleLength = safeArcs.reduce((sum, arc) => sum + arc.length, 0);
    
    if (totalSafeAngleLength < VERY_SMALL_NUMBER) { // If total safe length is negligible, effectively no space
        // Consider placing all items at a single point (e.g., middle of the largest (or first) tiny arc)
        // For now, returning empty means they won't be shown, which might be better than an unclickable stack.
        // Or, if we must show them, this is where extreme stacking occurs.
        // Let's try to stack them in the middle of the first (potentially tiny) arc.
        const newPositions: ItemPosition[] = [];
        const fallbackAngle = (safeArcs[0].start + safeArcs[0].length / 2) % (2 * Math.PI);
        for (let i = 0; i < numItems; i++) {
            newPositions.push({
                x: orbitRadius * Math.cos(fallbackAngle),
                y: orbitRadius * Math.sin(fallbackAngle),
                angle: fallbackAngle,
            });
        }
        return newPositions.sort((a,b) => a.angle - b.angle); // All angles are same, but good practice
    }

    const newPositions: ItemPosition[] = [];
    if (numItems === 0) return newPositions;

    const anglePerSlot = totalSafeAngleLength / numItems; 
    
    safeArcs.sort((a, b) => a.start - b.start);

    for (let itemIndex = 0; itemIndex < numItems; itemIndex++) {
      const itemCenterInConcatenatedSpace = (itemIndex + 0.5) * anglePerSlot;
      let foundPositionForItem = false;
      
      let currentArcAccumulatedLength = 0;
      for (const arc of safeArcs) {
        // Check if the item's center falls within the current arc segment in the concatenated space
        // Add tolerance for floating point comparisons
        if (itemCenterInConcatenatedSpace >= currentArcAccumulatedLength - VERY_SMALL_NUMBER &&
            itemCenterInConcatenatedSpace < currentArcAccumulatedLength + arc.length + VERY_SMALL_NUMBER) { 
            
            // Clamp the angle within the arc to avoid overshooting due to tolerance
            const angleWithinArcRaw = itemCenterInConcatenatedSpace - currentArcAccumulatedLength;
            const angleWithinArc = Math.max(0, Math.min(angleWithinArcRaw, arc.length)); // Clamp to [0, arc.length]
            
            let finalAngle = arc.start + angleWithinArc;
            finalAngle = finalAngle % (2 * Math.PI); // Normalize angle

            newPositions.push({
                x: orbitRadius * Math.cos(finalAngle),
                y: orbitRadius * Math.sin(finalAngle),
                angle: finalAngle,
            });
            foundPositionForItem = true;
            break; 
        }
        currentArcAccumulatedLength += arc.length;
      }
      
      if (!foundPositionForItem) {
        // This fallback should ideally not be reached if totalSafeAngleLength > 0 and logic is perfect.
        // It indicates an issue mapping itemCenterInConcatenatedSpace to an arc, likely due to float precision
        // accumulation or if totalSafeAngleLength is inconsistent with summed arc lengths.
        console.warn("RadialMenu: Item could not be placed in any safe arc. Defaulting placement to start of first safe arc.", 
          { itemIndex, itemCenterInConcatenatedSpace, totalSafeAngleLength, safeArcs });

        // Robust fallback: place it at the start of the first safe arc.
        // Since safeArcs.length > 0 is guaranteed here, safeArcs[0] is accessible.
        const fallbackAngle = safeArcs[0].start % (2 * Math.PI);
        newPositions.push({
            x: orbitRadius * Math.cos(fallbackAngle),
            y: orbitRadius * Math.sin(fallbackAngle),
            angle: fallbackAngle,
        });
      }
    }
    
    return newPositions.sort((a, b) => a.angle - b.angle);

  }, [isOpen, centerPosition, numItems, orbitRadius, itemSize, mainButtonSize, viewportSize]);

  useEffect(() => {
    setItemPositions(calculatedPositions);
  }, [calculatedPositions]);

  return itemPositions;
}
