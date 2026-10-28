import React from 'react';
import { ArrowLeft } from 'lucide-react';
import { useCeipal } from '../../ceipal-context';
import { EboardingSubModule } from '../../types';

export const EboardingHeader: React.FC = () => {
  const { eboardingSubModule, setEboardingSubModule, setActiveModule } = useCeipal();

  const subNav: { id: EboardingSubModule; label: string }[] = [
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'initiate', label: 'Initiate Onboarding' },
    { id: 'ready', label: 'Ready For Onboarding' },
  ];

  return (
    <>
      {/* Top thin navy strip */}
      <div className="h-[4px] w-full" style={{ backgroundColor: '#0a192f' }} />

      {/* Main eBoarding Header Bar (distinct navy-blue theme) */}
      <header
        className="ceipal-eboarding-gradient relative shadow-md select-none"
        style={{
          background: 'linear-gradient(90deg, #0d2a54 0%, #123e7a 100%)',
          color: '#ffffff',
        }}
      >
        <div className="flex items-center justify-between px-4 py-2 min-h-[50px]">
          {/* Left: Navigation back to ATS */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setActiveModule('jobs')}
              title="Return to Main ATS"
              className="p-1 hover:bg-white/15 rounded text-white mr-1"
              style={{ color: '#ffffff' }}
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
          </div>

          {/* Center: Sub-nav tabs */}
          <nav className="flex items-center gap-1.5 mx-4">
            {subNav.map((tab) => {
              const isActive = eboardingSubModule === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setEboardingSubModule(tab.id)}
                  className={`px-3.5 py-1.5 text-xs font-semibold tracking-wide transition-all rounded ${
                    isActive ? 'shadow-sm font-bold' : 'hover:bg-white/15'
                  }`}
                  style={
                    isActive
                      ? { backgroundColor: '#ffffff', color: '#0d2a54' }
                      : { backgroundColor: 'transparent', color: '#ffffff' }
                  }
                >
                  {tab.label}
                </button>
              );
            })}
          </nav>

          {/* Right spacer */}
          <div className="w-6" />
        </div>
      </header>
    </>
  );
};
