export function GridPattern() {
  return (
    <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden opacity-[0.03]">
      <div
        className="h-full w-full animate-grid-scroll"
        style={{
          backgroundImage: `
            linear-gradient(rgba(0, 217, 255, 1) 1px, transparent 1px),
            linear-gradient(90deg, rgba(0, 217, 255, 1) 1px, transparent 1px)
          `,
          backgroundSize: '40px 40px',
        }}
      />
    </div>
  );
}
