import { NavLink, Route, Routes, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import { Icons } from './lib/ui';

import Home from './pages/Home';
import AddMemory from './pages/AddMemory';
import Capture from './pages/Capture';
import Timeline from './pages/Timeline';
import RemindMe from './pages/RemindMe';
import Explore from './pages/Explore';
import Insights from './pages/Insights';
import Prompts from './pages/Prompts';
import Settings from './pages/Settings';

const NAV = [
  { to: '/',          label: 'Home',     icon: Icons.home },
  { to: '/timeline',  label: 'Timeline', icon: Icons.timeline },
  { to: '/capture',   label: 'Capture',  icon: Icons.plus },
  { to: '/explore',   label: 'Explore',  icon: Icons.book },
  { to: '/insights',  label: 'Insights', icon: Icons.chart },
];

export default function App() {
  const { pathname } = useLocation();

  // Each screen should start at the top, the way a native app behaves.
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);

  return (
    <div className="app">
      <main className="page">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/add" element={<AddMemory />} />
          <Route path="/capture" element={<Capture />} />
          <Route path="/timeline" element={<Timeline />} />
          <Route path="/remind-me" element={<RemindMe />} />
          <Route path="/explore" element={<Explore />} />
          <Route path="/explore/:lensId" element={<Explore />} />
          <Route path="/insights" element={<Insights />} />
          <Route path="/prompts" element={<Prompts />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="*" element={<Home />} />
        </Routes>
      </main>

      <nav className="nav" aria-label="Main">
        <div className="nav-inner">
          {NAV.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} end={to === '/'}>
              <Icon />
              <span>{label}</span>
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
