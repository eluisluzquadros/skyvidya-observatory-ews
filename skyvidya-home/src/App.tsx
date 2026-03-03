/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import Navigation from './components/Navigation';
import SideNav from './components/SideNav';
import Hero from './components/Hero';
import Diagnostic from './components/Diagnostic';
import TheBridge from './components/TheBridge';
import MissionControl from './components/MissionControl';
import StrategicFramework from './components/StrategicFramework';
import Ecosystem from './components/Ecosystem';
import Transmission from './components/Transmission';
import Dock from './components/Dock';
import FloatingAssistant from './components/FloatingAssistant';

export default function App() {
  return (
    <div className="relative w-full min-h-screen bg-background-dark flex flex-col items-center justify-between">
      <Navigation />
      <SideNav />
      <Hero />
      <Ecosystem />
      <Diagnostic />
      <TheBridge />
      <MissionControl />
      <StrategicFramework />
      <Transmission />
      <Dock />
      <FloatingAssistant />
    </div>
  );
}
