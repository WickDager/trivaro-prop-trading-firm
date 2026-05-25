'use client';

export function AuroraBackground() {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div className="absolute -inset-[100%] animate-aurora opacity-30">
        <div
          className="absolute left-1/4 top-1/4 h-[600px] w-[600px] rounded-full bg-teal-500/20 blur-[120px]"
        />
        <div
          className="absolute right-1/4 top-1/3 h-[500px] w-[500px] rounded-full bg-green-500/15 blur-[100px]"
        />
        <div
          className="absolute bottom-1/4 left-1/3 h-[400px] w-[400px] rounded-full bg-teal-500/10 blur-[80px]"
        />
      </div>
    </div>
  );
}
