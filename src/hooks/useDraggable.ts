import { useState, useEffect, useCallback, RefObject } from 'react';

interface Position {
  x: number;
  y: number;
}

interface DraggableOptions {
  initialPosition?: Position;
  constrainElementSize?: number; // The size of the element to use for viewport collision
}

export function useDraggable(
  ref: RefObject<HTMLElement>,
  options?: DraggableOptions
) {
  const elementSizeForConstraint = options?.constrainElementSize ?? (ref.current?.offsetWidth || 50);
  
  const [position, setPosition] = useState<Position>(() => {
    const initialX = options?.initialPosition?.x ?? (typeof window !== 'undefined' ? window.innerWidth / 2 : 0);
    const initialY = options?.initialPosition?.y ?? (typeof window !== 'undefined' ? window.innerHeight / 2 : 0);
    // Adjust initial position to be centered if constrainElementSize is provided
    return {
      x: initialX - elementSizeForConstraint / 2,
      y: initialY - elementSizeForConstraint / 2,
    };
  });
  
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState<Position>({ x: 0, y: 0 });

  const handleMouseDown = useCallback((event: React.MouseEvent) => {
    // Only allow left-button drag
    if (event.button !== 0) return;
    
    if (ref.current) {
      setIsDragging(true);
      const rect = ref.current.getBoundingClientRect();
      setDragOffset({
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
      });
      // Prevent text selection during drag
      event.preventDefault();
    }
  }, [ref]);

  useEffect(() => {
    const handleMouseMove = (event: MouseEvent) => {
      if (!isDragging || !ref.current) return;

      let newX = event.clientX - dragOffset.x;
      let newY = event.clientY - dragOffset.y;

      const currentElementSize = options?.constrainElementSize ?? ref.current.offsetWidth;

      newX = Math.max(0, Math.min(newX, window.innerWidth - currentElementSize));
      newY = Math.max(0, Math.min(newY, window.innerHeight - currentElementSize));

      setPosition({ x: newX, y: newY });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      document.body.style.userSelect = 'none'; // Prevent text selection globally
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      document.body.style.userSelect = '';
    };
  }, [isDragging, dragOffset, ref, options?.constrainElementSize]);

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
    // Call once to set initial position correctly
    if (typeof window !== 'undefined') handleResize();
    return () => window.removeEventListener('resize', handleResize);
  }, [ref, options?.constrainElementSize]);

  return { position, handleMouseDown, isDragging };
}
