'use client';

import { cn } from '@/lib/utils';
import { Check } from 'lucide-react';

const phases = [
  { id: 1, label: 'Phase 1', description: '8% profit target' },
  { id: 2, label: 'Phase 2', description: '8% profit target' },
  { id: 3, label: 'Funded', description: 'Live account' },
];

interface PhaseProgressProps {
  currentPhase: number;
}

export function PhaseProgress({ currentPhase }: PhaseProgressProps) {
  return (
    <div className="flex flex-col items-center">
      {/* Circles + connector lines */}
      <div className="flex w-full items-center">
        {phases.map((phase, i) => {
          const isCompleted = currentPhase > phase.id;
          const isCurrent = currentPhase === phase.id;

          return (
            <div key={phase.id} className="flex flex-1 items-center">
              <div
                className={cn(
                  'flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 text-sm font-bold transition-all',
                  isCompleted && 'border-green-400 bg-green-500/20 text-green-400',
                  isCurrent && 'border-teal-400 bg-teal-500/20 text-teal-400',
                  !isCompleted && !isCurrent && 'border-navy-500 bg-navy-700 text-text-muted',
                )}
              >
                {isCompleted ? <Check className="h-5 w-5" /> : phase.id}
              </div>
              {i < phases.length - 1 && (
                <div
                  className={cn(
                    'mx-1 h-0.5 flex-1 sm:mx-3',
                    isCompleted ? 'bg-green-400/50' : 'bg-navy-500',
                  )}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Labels below */}
      <div className="mt-2 flex w-full">
        {phases.map((phase) => (
          <div key={phase.id} className="flex-1 text-center">
            <p className="text-xs font-medium">{phase.label}</p>
            <p className="text-[10px] text-text-muted">{phase.description}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
