import React from 'react';
import { RadialMenu, RadialMenuItem } from './components/RadialMenu';
import { Home, Settings, User, MessageSquare, Share2, ThumbsUp, Star, Bell, Search, Download } from 'lucide-react';

const App: React.FC = () => {
  const menuItems: RadialMenuItem[] = [
    { id: 'home', icon: Home, label: 'Home', action: () => console.log('Home clicked') },
    { id: 'settings', icon: Settings, label: 'Settings', action: () => console.log('Settings clicked') },
    { id: 'profile', icon: User, label: 'Profile', action: () => console.log('Profile clicked') },
    { id: 'messages', icon: MessageSquare, label: 'Messages', action: () => console.log('Messages clicked') },
    { id: 'share', icon: Share2, label: 'Share', action: () => console.log('Share clicked') },
    // Add more items to test repulsion with more elements
    { id: 'like', icon: ThumbsUp, label: 'Like', action: () => console.log('Like clicked') },
    { id: 'favorite', icon: Star, label: 'Favorite', action: () => console.log('Favorite clicked') },
    // { id: 'notifications', icon: Bell, label: 'Notifications', action: () => console.log('Notifications clicked') },
    // { id: 'search', icon: Search, label: 'Search', action: () => console.log('Search clicked') },
    // { id: 'download', icon: Download, label: 'Download', action: () => console.log('Download clicked') },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-700 flex flex-col items-center justify-center text-white relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-full opacity-10">
        {/* Decorative background pattern */}
        <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="smallGrid" width="20" height="20" patternUnits="userSpaceOnUse">
              <path d="M 20 0 L 0 0 0 20" fill="none" stroke="gray" strokeWidth="0.5"/>
            </pattern>
            <pattern id="grid" width="100" height="100" patternUnits="userSpaceOnUse">
              <rect width="100" height="100" fill="url(#smallGrid)"/>
              <path d="M 100 0 L 0 0 0 100" fill="none" stroke="gray" strokeWidth="1"/>
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />
        </svg>
      </div>
      
      <div className="relative z-10 text-center mb-8 p-4">
        <h1 className="text-4xl font-bold mb-2">Draggable Radial Menu</h1>
        <p className="text-lg text-slate-300">Click the button to open the menu, then drag it around!</p>
        <p className="text-sm text-slate-400 mt-2">Items will try to avoid screen edges.</p>
      </div>

      <RadialMenu items={menuItems} orbitRadius={120} itemSize={48} mainButtonSize={64} />

      <footer className="absolute bottom-4 text-center w-full text-slate-400 text-sm z-10">
        Built with React, Tailwind CSS, and Lucide Icons.
      </footer>
    </div>
  );
}

export default App;
