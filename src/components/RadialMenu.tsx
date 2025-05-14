import React, { useState, useRef, useMemo } from 'react';
import { Menu, X } from 'lucide-react';
import { useDraggable } from '../hooks/useDraggable';
import { useRepulsionAndOrbit } from '../hooks/useRepulsionAndOrbit';

export interface RadialMenuItem {
  id: string;
  icon: React.ElementType;
  label: string;
  description?: string;
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
  hoverScale?: number;
}

const DEFAULT_ORBIT_RADIUS = 100;
const DEFAULT_ITEM_SIZE = 40;
const DEFAULT_MAIN_BUTTON_SIZE = 56;
const DEFAULT_ITEM_ICON_SIZE = 20;
const DEFAULT_MAIN_ICON_SIZE = 28;
const DEFAULT_DRAG_THRESHOLD = 5;
const TOGGLE_LOCK_DURATION = 100;
const DEFAULT_HOVER_SCALE = 1.3;
const HOVER_CONTENT_SCALE_FACTOR = 0.6; // Content shrinks by 20% on hover

export const RadialMenu: React.FC<RadialMenuProps> = ({
  items,
  orbitRadius = DEFAULT_ORBIT_RADIUS,
  itemSize = DEFAULT_ITEM_SIZE,
  mainButtonSize = DEFAULT_MAIN_BUTTON_SIZE,
  itemIconSize = DEFAULT_ITEM_ICON_SIZE,
  mainIconSize = DEFAULT_MAIN_ICON_SIZE,
  dragThreshold = DEFAULT_DRAG_THRESHOLD,
  hoverScale = DEFAULT_HOVER_SCALE,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isToggleLocked, setIsToggleLocked] = useState(false);
  const [hoveredItemId, setHoveredItemId] = useState<string | null>(null);
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
    if (isToggleLocked) return;

    if (!hasMovedBeyondThreshold) {
      setIsOpen(prev => !prev);
      setIsToggleLocked(true);
      setTimeout(() => setIsToggleLocked(false), TOGGLE_LOCK_DURATION);
    }
  };

  const MainIcon = isOpen ? X : Menu;

  const memoizedItems = useMemo(() => {
    return items.map((item, index) => {
      const pos = itemPositions[index];
      if (!pos) return null;

      const isHovered = item.id === hoveredItemId;
      
      const itemStyleX = mainButtonSize / 2 + pos.x - itemSize / 2;
      const itemStyleY = mainButtonSize / 2 + pos.y - itemSize / 2;

      const itemContainerScale = isOpen ? (isHovered ? hoverScale : 1) : 0.5;
      
      // Determine if the special layout for description (flex-start, padding) is active
      const isDescriptionLayoutActive = isHovered && isOpen && item.description;

      // Scale content if item is hovered and menu is open
      const contentScale = (isHovered && isOpen) ? HOVER_CONTENT_SCALE_FACTOR : 1;
      const displayedIconSize = itemIconSize * contentScale;
      const descriptionFontSize = (itemIconSize * 0.45) * contentScale; // Base size * 0.45, then scaled

      // Adjust padding and margin based on the actual displayed icon size and layout state
      const currentContentWrapperPaddingTop = isDescriptionLayoutActive ? `${displayedIconSize * 0.25}px` : '0px';
      const currentTextMarginTop = isDescriptionLayoutActive ? `${displayedIconSize * 0.20}px` : '0px';
      
      const currentPaddingOnItemContainer = (isHovered && isOpen) ? '0px' : '2px';


      return (
        <div // Item Container (Outer circle)
          key={item.id}
          style={{
            position: 'absolute',
            width: itemSize, 
            height: itemSize, 
            left: `${itemStyleX}px`,
            top: `${itemStyleY}px`,
            opacity: isOpen ? 1 : 0,
            transform: `scale(${itemContainerScale})`,
            transformOrigin: 'center center',
            transitionProperty: 'opacity, transform, z-index, padding', 
            transitionDuration: '0.3s',
            transitionTimingFunction: isOpen ? 'cubic-bezier(0.175, 0.885, 0.32, 1.275)' : 'ease-out',
            zIndex: isHovered ? 10 : 5,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: currentPaddingOnItemContainer,
          }}
          className="rounded-full bg-sky-500 hover:bg-sky-600 text-white shadow-lg cursor-pointer"
          title={!isHovered || !isOpen || !item.description ? item.label : ''}
          onMouseEnter={() => isOpen && setHoveredItemId(item.id)}
          onMouseLeave={() => isOpen && setHoveredItemId(null)}
          onClick={() => {
            item.action?.();
            setIsOpen(false); 
            setHoveredItemId(null);
          }}
        >
          <div // Content Wrapper (Inner flex container)
            style={{
              width: '100%', 
              height: '100%',
              transitionProperty: 'padding-top', 
              transitionDuration: '0.3s',
              transitionTimingFunction: 'cubic-bezier(0.175, 0.885, 0.32, 1.275)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center', 
              justifyContent: isDescriptionLayoutActive ? 'flex-start' : 'center', 
              textAlign: 'center',
              paddingTop: currentContentWrapperPaddingTop, 
              overflow: 'hidden', 
              borderRadius: 'inherit',
            }}
          >
            <div style={{ flexShrink: 0 }}> {/* Icon wrapper */}
              <item.icon size={displayedIconSize} />
            </div>
            {isDescriptionLayoutActive && ( // Only render span if description layout is active
              <span style={{ 
                fontSize: `${descriptionFontSize}px`, 
                marginTop: currentTextMarginTop, 
                lineHeight: '1.2', 
                userSelect: 'none',
                width: '90%', 
                textAlign: 'center',
                whiteSpace: 'normal', 
                wordBreak: 'break-word',
              }}>
                {item.description}
              </span>
            )}
          </div>
        </div>
      );
    });
  }, [items, itemPositions, isOpen, mainButtonSize, itemSize, itemIconSize, hoveredItemId, hoverScale]);


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

      <div 
        className="absolute"
        style={{
          top: `0px`, 
          left: `0px`,
          width: `${mainButtonSize}px`,
          height: `${mainButtonSize}px`,
          pointerEvents: isOpen ? 'auto' : 'none',
        }}
      >
        {memoizedItems}
      </div>
    </div>
  );
};
