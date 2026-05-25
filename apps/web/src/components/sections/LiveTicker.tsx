'use client';

const tickerItems = [
  { symbol: 'EUR/USD', price: '1.08245', change: '+0.12%', up: true },
  { symbol: 'GBP/USD', price: '1.26893', change: '-0.05%', up: false },
  { symbol: 'BTC/USD', price: '67,432', change: '+2.34%', up: true },
  { symbol: 'ETH/USD', price: '3,521', change: '+1.87%', up: true },
  { symbol: 'XAU/USD', price: '2,358.40', change: '+0.45%', up: true },
  { symbol: 'S&P 500', price: '5,234.18', change: '-0.23%', up: false },
  { symbol: 'NASDAQ', price: '16,432.55', change: '+0.67%', up: true },
  { symbol: 'US30', price: '39,128.43', change: '+0.31%', up: true },
];

export function LiveTicker() {
  const items = [...tickerItems, ...tickerItems];

  return (
    <div className="overflow-hidden border-y border-teal-500/10 bg-navy-900/50 py-3">
      <div className="flex animate-ticker gap-12">
        {items.map((item, i) => (
          <div key={i} className="flex shrink-0 items-center gap-3">
            <span className="text-sm font-semibold text-white">{item.symbol}</span>
            <span className="font-mono text-sm text-text-secondary">{item.price}</span>
            <span
              className={`text-xs font-medium ${
                item.up ? 'text-green-400' : 'text-red-400'
              }`}
            >
              {item.change}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
