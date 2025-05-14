import { useState, useEffect, useCallback, RefObject, useRef } from 'react';

interface Position {
  x: number;
  y: number;
}

interface DraggableOptions {
  initialPosition?: Position;
  constrainElementSize?: number;
  dragThreshold?: number;
}

const DEFAULT_DRAG_THRESHOLD = 5;

export function useDraggable(
  ref: RefObject<HTMLElement>,
  options?: DraggableOptions
) {
  const elementSizeForConstraint = options?.constrainElementSize ?? (ref.current?.offsetWidth || 50);
  const dragThreshold = options?.dragThreshold ?? DEFAULT_DRAG_THRESHOLD;
  
  const [position, setPosition] = useState<Position>(() => {
    const initialX = options?.initialPosition?.x ?? (typeof window !== 'undefined' ? window.innerWidth / 2 : 0);
    const initialY = options?.initialPosition?.y ?? (typeof window !== 'undefined' ? window.innerHeight / 2 : 0);
    return {
      x: initialX - elementSizeForConstraint / 2,
      y: initialY - elementSizeForConstraint / 2,
    };
  });
  
  const [isDragging, setIsDragging] = useState(false);
  const [hasMovedBeyondThreshold, setHasMovedBeyondThreshold] = useState(false);
  const [dragOffset, setDragOffset] = useState<Position>({ x: 0, y: 0 });
  const [interactionStartScreenPosition, setInteractionStartScreenPosition] = useState<Position | null>(null);

  const isDraggingRef = useRef(isDragging);

  useEffect(() => {
    isDraggingRef.current = isDragging;
  }, [isDragging]);

  const getEventCoordinates = (event: MouseEvent | TouchEvent): Position => {
    if ('touches' in event) {
      // Ensure touches array is not empty
      if (event.touches.length > 0) {
        return { x: event.touches[0].clientX, y: event.touches[0].clientY };
      } else if (event.changedTouches.length > 0) { 
        // Fallback for touchend where `touches` is empty but `changedTouches` has info
        return { x: event.changedTouches[0].clientX, y: event.changedTouches[0].clientY };
      }
    }
    return { x: event.clientX, y: event.clientY };
  };

  const handleInteractionStart = useCallback((event: React.MouseEvent | React.TouchEvent) => {
    if (ref.current) {
      if ('button' in event && event.button !== 0) return; // Only main mouse button for mouse events

      // For touch events, prevent default to stop emulated mouse events and potential page scroll.
      if (event.type === 'touchstart') {
        console.log('[useDraggable] Touchstart detected, calling event.preventDefault()');
        event.preventDefault(); 
      }

      const coords = getEventCoordinates(event.nativeEvent as MouseEvent | TouchEvent);
      
      console.log('[useDraggable] handleInteractionStart triggered. Coords:', coords, 'Target:', event.target);
      
      setDragOffset({
        x: coords.x - ref.current.getBoundingClientRect().left,
        y: coords.y - ref.current.getBoundingClientRect().top,
      });
      setInteractionStartScreenPosition({ x: coords.x, y: coords.y });
      setHasMovedBeyondThreshold(false); // Reset this on new interaction start
      setIsDragging(true); 
      console.log('[useDraggable] handleInteractionStart: setIsDragging(true) called.');
    }
  }, [ref, dragThreshold, elementSizeForConstraint]); 

  useEffect(() => {
    const handleInteractionMove = (event: MouseEvent | TouchEvent) => {
      if (!isDraggingRef.current || !ref.current) return;

      if (event.type === 'touchmove') {
         event.preventDefault();
      }

      const coords = getEventCoordinates(event);

      if (interactionStartScreenPosition && !hasMovedBeyondThreshold) {
        const deltaX = coords.x - interactionStartScreenPosition.x;
        const deltaY = coords.y - interactionStartScreenPosition.y;
        if (Math.sqrt(deltaX * deltaX + deltaY * deltaY) > dragThreshold) {
          setHasMovedBeyondThreshold(true);
          console.log('[useDraggable] Moved beyond threshold.');
        }
      }

      let newX = coords.x - dragOffset.x;
      let newY = coords.y - dragOffset.y;

      const currentElementSize = options?.constrainElementSize ?? ref.current.offsetWidth;

      newX = Math.max(0, Math.min(newX, window.innerWidth - currentElementSize));
      newY = Math.max(0, Math.min(newY, window.innerHeight - currentElementSize));

      setPosition({ x: newX, y: newY });
    };

    const handleInteractionEnd = (event: MouseEvent | TouchEvent) => {
      console.log('[useDraggable] handleInteractionEnd triggered on window. Event type:', event.type);
      
      setIsDragging(false);
      console.log('[useDraggable] handleInteractionEnd: setIsDragging(false) called.');
      // Note: hasMovedBeyondThreshold is NOT reset here. It's reset at the START of a new interaction.
      // This is important for the RadialMenu to correctly determine if the release was a click/tap or end of drag.
    };

    if (isDragging) {
      console.log('[useDraggable] ADDING window event listeners (mouse & touch).');
      window.addEventListener('mousemove', handleInteractionMove);
      window.addEventListener('mouseup', handleInteractionEnd);
      window.addEventListener('touchmove', handleInteractionMove, { passive: false }); 
      window.addEventListener('touchend', handleInteractionEnd);
      
      document.body.style.userSelect = 'none';
      document.body.style.webkitUserSelect = 'none'; 
      document.body.style.msUserSelect = 'none'; 
    }

    return () => {
      console.log('[useDraggable] CLEANUP for event listener effect. REMOVING window event listeners (mouse & touch).');
      window.removeEventListener('mousemove', handleInteractionMove);
      window.removeEventListener('mouseup', handleInteractionEnd);
      window.removeEventListener('touchmove', handleInteractionMove);
      window.removeEventListener('touchend', handleInteractionEnd);
      
      document.body.style.userSelect = '';
      document.body.style.webkitUserSelect = '';
      document.body.style.msUserSelect = '';
    };
  }, [
    isDragging, 
    dragOffset, 
    ref, 
    options?.constrainElementSize, 
    interactionStartScreenPosition, 
    hasMovedBeyondThreshold, // This dependency is important
    dragThreshold, 
    setPosition
  ]);

  useEffect(() => {
    const handleResize = () => {
      if (ref.current) {
        const currentElementSize = options?.constrainElementSize ?? ref.current.offsetWidth;
        setPosition(prevPos => ({
          x: Math.max(0, Math.min(prevPos.x, window.innerWidth - currentElementSize)),
          y: Math.max(0, Math.min(prevPos.y, window.innerHeight - currentElementSize)),
        }));
      }
    };
    window.addEventListener('resize', handleResize);
    if (typeof window !== 'undefined') handleResize(); 
    return () => window.removeEventListener('resize', handleResize);
  }, [ref, options?.constrainElementSize, setPosition]);

  // Ensure hasMovedBeyondThreshold is also reset if isDragging becomes false externally or unexpectedly
  // Although current logic should handle it via new interaction start.
  // This effect might be redundant if interaction flow is strictly followed.
  useEffect(() => {
    if (!isDragging) {
      // setHasMovedBeyondThreshold(false); // Reconsidering this: it should only reset on a NEW interaction start.
                                        // Otherwise, a drag ending could reset it, and if an emulated click follows
                                        // without a new mousedown, it might toggle.
                                        // The current logic of resetting in handleInteractionStart is better.
    }
  }, [isDragging]);


  return { position, handleInteractionStart, isDragging, hasMovedBeyondThreshold };
}
