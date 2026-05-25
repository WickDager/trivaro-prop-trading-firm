export function GradientMesh() {
  return (
    <svg
      className="pointer-events-none absolute inset-0 -z-10 h-full w-full opacity-20"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <radialGradient id="mesh-grad-1" cx="20%" cy="30%" r="50%">
          <stop offset="0%" stopColor="#00D9FF" stopOpacity="0.3" />
          <stop offset="100%" stopColor="#00D9FF" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="mesh-grad-2" cx="80%" cy="70%" r="50%">
          <stop offset="0%" stopColor="#00FF88" stopOpacity="0.2" />
          <stop offset="100%" stopColor="#00FF88" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="100%" height="100%" fill="url(#mesh-grad-1)" />
      <rect width="100%" height="100%" fill="url(#mesh-grad-2)" />
    </svg>
  );
}
