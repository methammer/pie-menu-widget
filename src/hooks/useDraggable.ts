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
  const [mouseDownScreenPosition, setMouseDownScreenPosition] = useState<Position | null>(null);

  const isDraggingRef = useRef(isDragging);

  // console.log('[useDraggable] Hook instance. Initial isDragging:', isDragging);

  useEffect(() => {
    // console.log(`[useDraggable] Syncing isDraggingRef.current. Old: ${isDraggingRef.current}, New isDragging state: ${isDragging}`);
    isDraggingRef.current = isDragging;
  }, [isDragging]);

  const handleMouseDown = useCallback((event: React.MouseEvent) => {
    if (event.button !== 0) return; // Only main button
    
    if (ref.current) {
      console.log('[useDraggable] handleMouseDown triggered. Target:', event.target);
      event.preventDefault(); // Important to prevent text selection, etc.
      
      setDragOffset({
        x: event.clientX - ref.current.getBoundingClientRect().left,
        y: event.clientY - ref.current.getBoundingClientRect().top,
      });
      setMouseDownScreenPosition({ x: event.clientX, y: event.clientY });
      setHasMovedBeyondThreshold(false); // Reset threshold flag on new mousedown
      setIsDragging(true); 
      console.log('[useDraggable] handleMouseDown: setIsDragging(true) called. isDraggingRef will update.');
    }
  }, [ref]); // Dependencies are stable or setters

  useEffect(() => {
    // console.log(`[useDraggable] Event listener effect RUNNING. Current isDragging state: ${isDragging}, isDraggingRef.current: ${isDraggingRef.current}`);

    const handleMouseMove = (event: MouseEvent) => {
      // console.log(`[useDraggable] handleMouseMove triggered. isDraggingRef.current: ${isDraggingRef.current}`);
      if (!isDraggingRef.current || !ref.current) {
        // if (!isDraggingRef.current) console.log('[useDraggable] handleMouseMove: bailing out, isDraggingRef.current is false.');
        // if (!ref.current) console.log('[useDraggable] handleMouseMove: bailing out, ref.current is null.');
        return;
      }
      // console.log('[useDraggable] handleMouseMove: PROCESSING movement.');

      if (mouseDownScreenPosition && !hasMovedBeyondThreshold) {
        const deltaX = event.clientX - mouseDownScreenPosition.x;
        const deltaY = event.clientY - mouseDownScreenPosition.y;
        if (Math.sqrt(deltaX * deltaX + deltaY * deltaY) > dragThreshold) {
          setHasMovedBeyondThreshold(true);
          // console.log('[useDraggable] Drag threshold EXCEEDED.');
        }
      }

      let newX = event.clientX - dragOffset.x;
      let newY = event.clientY - dragOffset.y;

      const currentElementSize = options?.constrainElementSize ?? ref.current.offsetWidth;

      newX = Math.max(0, Math.min(newX, window.innerWidth - currentElementSize));
      newY = Math.max(0, Math.min(newY, window.innerHeight - currentElementSize));

      setPosition({ x: newX, y: newY });
    };

    const handleMouseUp = (event: MouseEvent) => {
      // This listener is on WINDOW
      console.log('[useDraggable] handleMouseUp triggered on window. Event target:', event.target);
      setIsDragging(false);
      console.log('[useDraggable] handleMouseUp: setIsDragging(false) called. isDraggingRef will update.');
      // hasMovedBeyondThreshold is NOT reset here; it's reset on the next mousedown.
      // This allows RadialMenu's onMouseUp to check its final value.
    };

    if (isDragging) {
      console.log('[useDraggable] ADDING window event listeners (mousemove, mouseup).');
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp); // This is the crucial one
      document.body.style.userSelect = 'none'; // Prevent text selection during drag
    } else {
      // console.log('[useDraggable] isDragging is false, NOT adding listeners (or they should be cleaned up by now).');
    }

    return () => {
      console.log('[useDraggable] CLEANUP for event listener effect. REMOVING window event listeners (mousemove, mouseup).');
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      document.body.style.userSelect = '';
    };
    // Dependencies for adding/removing listeners:
    // - isDragging: Core trigger
    // - dragOffset, mouseDownScreenPosition, hasMovedBeyondThreshold, dragThreshold: These are used by handleMouseMove.
    //   If they change while isDragging is true, we want the LATEST versions of these in the closure of handleMouseMove.
    //   React will re-run the effect, remove old listeners (with stale closures), and add new ones (with fresh closures).
    // - ref, options?.constrainElementSize: Used by handleMouseMove.
    // - setPosition: Stable.
  }, [isDragging, dragOffset, ref, options?.constrainElementSize, mouseDownScreenPosition, hasMovedBeyondThreshold, dragThreshold, setPosition]);

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

  return { position, handleMouseDown, isDragging, hasMovedBeyondThreshold };
}
