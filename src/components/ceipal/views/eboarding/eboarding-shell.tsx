import React from 'react';
import { useCeipal } from '../../ceipal-context';
import { EboardingHeader } from './eboarding-header';
import { EboardingDashboardView } from './eboarding-dashboard';
import { InitiateOnboardingView } from './initiate-onboarding';
import { ReadyForOnboardingView } from './ready-for-onboarding';

export const EboardingShell: React.FC = () => {
  const { eboardingSubModule } = useCeipal();

  return (
    <div className="flex flex-col min-h-screen bg-[#eef1f6]">
      {/* Dedicated eBoarding Header */}
      <EboardingHeader />

      {/* Dynamic Sub-Module Body */}
      <div className="flex-1 flex flex-col">
        {eboardingSubModule === 'dashboard' && <EboardingDashboardView />}
        {eboardingSubModule === 'initiate' && <InitiateOnboardingView />}
        {eboardingSubModule === 'ready' && <ReadyForOnboardingView />}
      </div>
    </div>
  );
};
