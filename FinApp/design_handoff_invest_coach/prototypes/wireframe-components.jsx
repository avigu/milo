// wireframe-components.jsx — shared sketchy components for all directions

// ─────────────────────────────────────────────────────────────
// Sketchy primitives
// ─────────────────────────────────────────────────────────────
function SkSpark({ data = [3, 5, 2, 6, 4, 7, 5, 8], w = 60, h = 20, variant = 'up' }) {
  const max = Math.max(...data), min = Math.min(...data);
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * (w - 2) + 1;
    const y = h - 1 - ((v - min) / Math.max(1, max - min)) * (h - 2);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
  return (
    <svg width={w} height={h} style={{ display: 'block' }}>
      <polyline points={pts} className={`sk-spark sk-spark--${variant}`} />
    </svg>
  );
}

function SkIcon({ name, size = 18, stroke = 1.5 }) {
  const props = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: stroke, strokeLinecap: 'round', strokeLinejoin: 'round' };
  switch (name) {
    case 'home': return <svg {...props}><path d="M3 11l9-7 9 7v9a2 2 0 01-2 2h-4v-6H9v6H5a2 2 0 01-2-2z"/></svg>;
    case 'search': return <svg {...props}><circle cx="11" cy="11" r="7"/><path d="M20 20l-3-3"/></svg>;
    case 'compass': return <svg {...props}><circle cx="12" cy="12" r="9"/><path d="M15 9l-2 5-5 2 2-5z"/></svg>;
    case 'bell': return <svg {...props}><path d="M6 9a6 6 0 0112 0v4l2 3H4l2-3z"/><path d="M10 19a2 2 0 004 0"/></svg>;
    case 'user': return <svg {...props}><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 4-6 8-6s8 2 8 6"/></svg>;
    case 'star': return <svg {...props}><path d="M12 3l3 6 6 .8-4.5 4.3 1.2 6.4L12 17.4 6.3 20.5l1.2-6.4L3 9.8 9 9z"/></svg>;
    case 'chat': return <svg {...props}><path d="M4 5h16v11H9l-5 4z"/></svg>;
    case 'chart': return <svg {...props}><path d="M4 19h16"/><path d="M6 15l3-4 3 2 5-7"/></svg>;
    case 'arrow-up': return <svg {...props}><path d="M12 19V5"/><path d="M6 11l6-6 6 6"/></svg>;
    case 'arrow-down': return <svg {...props}><path d="M12 5v14"/><path d="M18 13l-6 6-6-6"/></svg>;
    case 'arrow-right': return <svg {...props}><path d="M5 12h14"/><path d="M13 6l6 6-6 6"/></svg>;
    case 'sparkle': return <svg {...props}><path d="M12 3l1.5 5.5L19 10l-5.5 1.5L12 17l-1.5-5.5L5 10l5.5-1.5z"/><path d="M19 4l.6 1.8L21 6l-1.4.6L19 8l-.6-1.8L17 6l1.8-.6z"/></svg>;
    case 'filter': return <svg {...props}><path d="M4 5h16l-6 8v6l-4-2v-4z"/></svg>;
    case 'news': return <svg {...props}><rect x="3" y="5" width="14" height="14" rx="1"/><path d="M17 9h3v8a2 2 0 01-2 2H5"/><path d="M6 9h8M6 13h8M6 17h5"/></svg>;
    case 'book': return <svg {...props}><path d="M4 5a2 2 0 012-2h12v16H6a2 2 0 00-2 2z"/><path d="M4 19a2 2 0 012-2h12"/></svg>;
    case 'shield': return <svg {...props}><path d="M12 3l8 3v6c0 5-4 8-8 9-4-1-8-4-8-9V6z"/></svg>;
    case 'trend': return <svg {...props}><path d="M3 17l6-6 4 4 8-9"/><path d="M15 6h6v6"/></svg>;
    case 'dollar': return <svg {...props}><path d="M12 3v18"/><path d="M17 7H9.5a2.5 2.5 0 000 5h5a2.5 2.5 0 010 5H6"/></svg>;
    case 'plus': return <svg {...props}><path d="M12 5v14M5 12h14"/></svg>;
    case 'check': return <svg {...props}><path d="M5 13l4 4 10-10"/></svg>;
    case 'x': return <svg {...props}><path d="M6 6l12 12M6 18L18 6"/></svg>;
    case 'play': return <svg {...props}><path d="M7 4v16l13-8z" fill="currentColor"/></svg>;
    default: return null;
  }
}

function SkTag({ children, variant }) {
  return <span className={`sk-tag ${variant ? 'sk-tag--' + variant : ''}`}>{children}</span>;
}

function SkBtn({ children, primary, ghost, icon, onClick, style }) {
  return (
    <button className={`sk-btn ${primary ? 'sk-btn--primary' : ''} ${ghost ? 'sk-btn--ghost' : ''}`} onClick={onClick} style={style}>
      {icon && <SkIcon name={icon} size={16} />}
      {children}
    </button>
  );
}

// ─────────────────────────────────────────────────────────────
// The 5 strategies
// ─────────────────────────────────────────────────────────────
const STRATEGIES = [
  {
    id: 'bounce',
    name: 'Bounce-Back',
    sub: 'Good company, bad quarter',
    logic: 'Strong 5-yr record + one-off earnings miss = likely recovery.',
    icon: 'trend',
    risk: 'medium',
    sources: ['Q reports', 'Price history', 'News'],
  },
  {
    id: 'dip',
    name: 'Market Dip',
    sub: 'When the whole market drops',
    logic: 'External shock (war, rates) pushes quality stocks below fair value.',
    icon: 'arrow-down',
    risk: 'medium-high',
    sources: ['News', 'Price history', 'Analyst'],
  },
  {
    id: 'value',
    name: 'Undervalued',
    sub: 'Cheap by the numbers',
    logic: 'Low P/E + healthy cashflow + growing revenue = a bargain.',
    icon: 'dollar',
    risk: 'low-med',
    sources: ['Q reports', 'Analyst'],
  },
  {
    id: 'dividend',
    name: 'Steady Dividend',
    sub: 'Reliable income',
    logic: '20+ years of rising dividends, low debt, boring industry.',
    icon: 'shield',
    risk: 'low',
    sources: ['Q reports', 'Price history'],
  },
  {
    id: 'upgrade',
    name: 'Analyst Upgrade',
    sub: 'The pros are buying',
    logic: '3+ analysts raised their price target in the last 30 days.',
    icon: 'star',
    risk: 'medium',
    sources: ['Analyst', 'News'],
  },
];

// ─────────────────────────────────────────────────────────────
// Demo stock data
// ─────────────────────────────────────────────────────────────
const STOCKS = [
  { t: 'MSTR', name: 'MicroStrat', price: 142.30, chg: -12.4, strategy: 'bounce',   spark: [8,9,9,10,9,5,4,4], why: 'Revenue up 18% YoY but bad Q guidance spooked market. Cash strong.' },
  { t: 'PFE',  name: 'Pfizer',     price: 27.15,  chg: -3.1,  strategy: 'bounce',   spark: [9,8,7,6,5,4,4,5], why: 'Post-COVID reset near done. Pipeline looks solid per Q4 report.' },
  { t: 'BAC',  name: 'Bank of America', price: 34.20, chg: -5.8, strategy: 'dip',   spark: [8,7,6,5,4,5,4,3], why: 'Banking sector drop from rate fears. Dividend & book value intact.' },
  { t: 'TSM',  name: 'Taiwan Semi', price: 138.50, chg: -7.2, strategy: 'dip',      spark: [10,9,7,6,6,5,4,5], why: 'Geopolitical news pushed it 15% below analyst fair value.' },
  { t: 'GOOG', name: 'Alphabet',   price: 164.40, chg: +0.9, strategy: 'value',     spark: [4,4,5,5,6,6,7,7], why: 'P/E of 19 vs industry 28. Cashflow + growth both beating peers.' },
  { t: 'CVS',  name: 'CVS Health', price: 58.90,  chg: -1.2, strategy: 'value',     spark: [5,4,5,6,5,6,6,7], why: 'Trading at 0.3x sales — cheapest in its sector for years.' },
  { t: 'KO',   name: 'Coca-Cola',  price: 66.10,  chg: +0.3, strategy: 'dividend',  spark: [5,5,6,6,6,7,7,7], why: '62 yrs raising dividend. 3.1% yield, low payout ratio.' },
  { t: 'JNJ',  name: 'Johnson & J', price: 152.00, chg: +0.2, strategy: 'dividend', spark: [5,6,6,6,7,7,7,8], why: '61 yrs dividend growth. AAA credit rating.' },
  { t: 'NVDA', name: 'Nvidia',     price: 890.00, chg: +2.1, strategy: 'upgrade',   spark: [4,5,6,7,7,8,9,10], why: '7 analysts raised targets in 30 days. Avg +18%.' },
  { t: 'AMD',  name: 'AMD',        price: 164.20, chg: +1.4, strategy: 'upgrade',   spark: [5,5,6,7,7,8,8,9], why: '4 upgrades post-earnings. Consensus: strong buy.' },
];

Object.assign(window, { SkSpark, SkIcon, SkTag, SkBtn, STRATEGIES, STOCKS });
