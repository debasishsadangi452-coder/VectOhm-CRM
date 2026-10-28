import React, { useEffect } from 'react';
import { CeipalProvider, useCeipal } from './ceipal-context';
import { CeipalHeader } from './ceipal-header';
import { CeipalRightDrawer } from './ceipal-right-drawer';
import { HomeDashboardView } from './views/home-dashboard';
import { JobPostingView } from './views/job-posting-view';
import { ApplicantsView } from './views/applicants-view';
import { ClientView } from './views/client-view';
import { VendorView } from './views/vendor-view';
import { PlacementsView } from './views/placements-view';
import { LeadsView } from './views/leads-view';
import { SettingsView } from './views/settings-view';
import { EboardingShell } from './views/eboarding/eboarding-shell';
import { CeipalModule } from './types';

interface CeipalAppProps {
  searchTab?: string;
  searchAction?: string;
}

const CeipalAppContent: React.FC<CeipalAppProps> = ({ searchTab, searchAction }) => {
  const { activeModule, setActiveModule, setIsCreatingJob, setIsCreatingApplicant } = useCeipal();

  const prevActionRef = React.useRef<string | undefined>(searchAction);

  // Reactively synchronize route tab parameter
  useEffect(() => {
    if (
      searchTab &&
      [
        'home',
        'jobs',
        'applicants',
        'clients',
        'vendors',
        'eboarding',
        'placements',
        'leads',
        'settings',
      ].includes(searchTab)
    ) {
      setActiveModule(searchTab as CeipalModule);
    }
  }, [searchTab, setActiveModule]);

  // Reactively synchronize route searchAction parameter
  useEffect(() => {
    if (searchAction === 'create' || searchAction === 'create-job') {
      setIsCreatingJob(true);
      setIsCreatingApplicant(false);
    } else if (searchAction === 'create-applicant') {
      setIsCreatingApplicant(true);
      setIsCreatingJob(false);
    } else if (prevActionRef.current && !searchAction) {
      setIsCreatingJob(false);
      setIsCreatingApplicant(false);
    }
    prevActionRef.current = searchAction;
  }, [searchAction, setIsCreatingJob, setIsCreatingApplicant]);

  // If in eBoarding sub-application, render eBoarding with its own distinct header
  if (activeModule === 'eboarding') {
    return (
      <div className="min-h-screen bg-[#eef1f6] text-slate-800 font-sans antialiased">
        <EboardingShell />
        <CeipalRightDrawer />
      </div>
    );
  }

  // Standard Ceipal ATS Pages with Persistent Header
  return (
    <div className="min-h-screen bg-[#eef1f6] text-slate-800 font-sans antialiased flex flex-col">
      {/* Persistent Ceipal Deep Blue Gradient Header */}
      <CeipalHeader />

      {/* Main Viewport Content */}
      <main className="flex-1 flex flex-col min-w-0">
        {activeModule === 'home' && <HomeDashboardView />}
        {activeModule === 'jobs' && <JobPostingView />}
        {activeModule === 'applicants' && <ApplicantsView />}
        {activeModule === 'clients' && <ClientView />}
        {activeModule === 'vendors' && <VendorView />}
        {activeModule === 'placements' && <PlacementsView />}
        {activeModule === 'leads' && <LeadsView />}
        {activeModule === 'settings' && <SettingsView />}
      </main>

      {/* Docked Collapsible Right Drawer */}
      <CeipalRightDrawer />
    </div>
  );
};

export const CeipalApp: React.FC<CeipalAppProps> = (props) => {
  return (
    <CeipalProvider>
      <CeipalAppContent {...props} />
    </CeipalProvider>
  );
};

export default CeipalApp;
