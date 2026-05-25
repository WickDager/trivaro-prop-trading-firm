'use client';

export function FloatingOrbs() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute -right-20 -top-20 h-64 w-64 animate-float rounded-full bg-teal-500/5 blur-[64px]" />
      <div
        className="absolute -bottom-32 -left-20 h-80 w-80 animate-float rounded-full bg-green-500/5 blur-[80px]"
        style={{ animationDelay: '-3s' }}
      />
      <div
        className="absolute left-1/2 top-1/3 h-48 w-48 animate-pulse-slow rounded-full bg-teal-500/5 blur-[48px]"
      />
    </div>
  );
}
