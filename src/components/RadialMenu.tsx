import React, { useState, useRef, useMemo, useEffect } from 'react';
import { Menu, X } from 'lucide-react';
import { useDraggable } from '../hooks/useDraggable';
import { useRepulsionAndOrbit, ItemPosition } from '../hooks/useRepulsionAndOrbit';

export interface RadialMenuItem {
  id: string;
  icon: React.ElementType;
  label: string;
  action?: () => void;
}

interface RadialMenuProps {
  items: RadialMenuItem[];
  orbitRadius?: number;
  itemSize?: number;
  mainButtonSize?: number;
  itemIconSize?: number;
  mainIconSize?: number;
  dragThreshold?: number;
}

const DEFAULT_ORBIT_RADIUS = 100;
const DEFAULT_ITEM_SIZE = 40;
const DEFAULT_MAIN_BUTTON_SIZE = 56;
const DEFAULT_ITEM_ICON_SIZE = 20;
const DEFAULT_MAIN_ICON_SIZE = 28;
const DEFAULT_DRAG_THRESHOLD = 5;
const TOGGLE_LOCK_DURATION = 100; // milliseconds

export const RadialMenu: React.FC<RadialMenuProps> = ({
  items,
  orbitRadius = DEFAULT_ORBIT_RADIUS,
  itemSize = DEFAULT_ITEM_SIZE,
  mainButtonSize = DEFAULT_MAIN_BUTTON_SIZE,
  itemIconSize = DEFAULT_ITEM_ICON_SIZE,
  mainIconSize = DEFAULT_MAIN_ICON_SIZE,
  dragThreshold = DEFAULT_DRAG_THRESHOLD,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isToggleLocked, setIsToggleLocked] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const { 
    position, 
    handleInteractionStart,
    hasMovedBeyondThreshold 
  } = useDraggable(menuRef, {
    initialPosition: { 
      x: typeof window !== 'undefined' ? window.innerWidth / 2 : 0, 
      y: typeof window !== 'undefined' ? window.innerHeight / 2 : 0,
    },
    constrainElementSize: mainButtonSize,
    dragThreshold: dragThreshold,
  });

  const itemPositions = useRepulsionAndOrbit({
    isOpen,
    centerPosition: position,
    numItems: items.length,
    orbitRadius,
    itemSize,
    mainButtonSize,
  });

  const handleMainButtonRelease = () => { 
    if (isToggleLocked) {
      console.log('[RadialMenu] Toggle is locked, ignoring release.');
      return;
    }

    console.log('[RadialMenu] handleMainButtonRelease. hasMovedBeyondThreshold:', hasMovedBeyondThreshold);
    if (!hasMovedBeyondThreshold) {
      console.log('[RadialMenu] Toggling menu.');
      setIsOpen(prev => !prev);
      setIsToggleLocked(true);
      setTimeout(() => {
        setIsToggleLocked(false);
        console.log('[RadialMenu] Toggle lock released.');
      }, TOGGLE_LOCK_DURATION);
    } else {
      console.log('[RadialMenu] Drag detected, not toggling menu.');
    }
  };

  const MainIcon = isOpen ? X : Menu;

  const memoizedItems = useMemo(() => {
    return items.map((item, index) => {
      const pos = itemPositions[index];
      if (!pos) return null;

      const itemStyleX = mainButtonSize / 2 + pos.x - itemSize / 2;
      const itemStyleY = mainButtonSize / 2 + pos.y - itemSize / 2;

      return (
        <div
          key={item.id}
          style={{
            position: 'absolute',
            width: itemSize,
            height: itemSize,
            left: `${itemStyleX}px`,
            top: `${itemStyleY}px`,
            opacity: isOpen ? 1 : 0,
            transform: `scale(${isOpen ? 1 : 0.5})`,
            transitionProperty: 'opacity, transform, left, top',
            transitionDuration: '0.3s',
            transitionTimingFunction: isOpen ? 'cubic-bezier(0.175, 0.885, 0.32, 1.275)' : 'ease-out',
          }}
          className="rounded-full bg-sky-500 hover:bg-sky-600 text-white flex items-center justify-center shadow-lg cursor-pointer"
          title={item.label}
          onClick={() => {
            console.log(`[RadialMenu] Item "${item.label}" clicked/tapped.`);
            item.action?.();
            setIsOpen(false); // Close menu after item action
          }}
        >
          <item.icon size={itemIconSize} />
        </div>
      );
    });
  }, [items, itemPositions, isOpen, mainButtonSize, itemSize, itemIconSize]);


  return (
    <div
      ref={menuRef}
      style={{
        position: 'fixed',
        left: `${position.x}px`,
        top: `${position.y}px`,
        width: mainButtonSize,
        height: mainButtonSize,
        zIndex: 1000,
        touchAction: 'none', 
      }}
    >
      <button
        type="button"
        onMouseDown={handleInteractionStart}
        onTouchStart={handleInteractionStart}
        onMouseUp={handleMainButtonRelease}
        onTouchEnd={handleMainButtonRelease}
        style={{
          width: mainButtonSize,
          height: mainButtonSize,
          position: 'relative',
          zIndex: 1,
        }}
        className="rounded-full bg-indigo-600 hover:bg-indigo-700 text-white flex items-center justify-center shadow-xl cursor-grab active:cursor-grabbing focus:outline-none focus:ring-2 focus:ring-indigo-400"
      >
        <MainIcon size={mainIconSize} />
      </button>

      <div className="absolute top-0 left-0" style={{pointerEvents: isOpen ? 'auto' : 'none'}}>
        {memoizedItems}
      </div>
    </div>
  );
};
