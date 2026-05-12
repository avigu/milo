// direction-b.jsx — FEED-FIRST: daily opportunities like a news app

function DirB_Feed({ sources }) {
  const picks = [
    { stock: STOCKS[0], strat: STRATEGIES[0], tag: 'Big drop', tagVar: 'pink', hours: 2 },
    { stock: STOCKS[3], strat: STRATEGIES[1], tag: 'Market dip', tagVar: 'blue', hours: 5 },
    { stock: STOCKS[8], strat: STRATEGIES[4], tag: 'Upgrade', tagVar: 'green', hours: 8 },
    { stock: STOCKS[4], strat: STRATEGIES[2], tag: 'Undervalued', tagVar: '', hours: 12 },
    { stock: STOCKS[6], strat: STRATEGIES[3], tag: 'Dividend', tagVar: '', hours: 22 },
  ];
  return (
    <>
      <SkStatusBar />
      <div style={{ padding: '8px 14px 10px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <div className="sk-h1" style={{ fontSize: 24, flex: 1 }}>Today's picks</div>
        <SkIcon name="filter" size={18} />
        <SkIcon name="bell" size={18} />
      </div>
      <div style={{ padding: '0 14px 8px', display: 'flex', gap: 6, overflowX: 'auto' }}>
        {['All', 'Bounce', 'Dip', 'Upgrade', 'Value', 'Divy'].map((t, i) => (
          <span key={t} className={`sk-tag ${i === 0 ? 'sk-tag--ink' : ''}`} style={{ flexShrink: 0 }}>{t}</span>
        ))}
      </div>

      <div className="sk-screen-scroll" style={{ padding: '4px 14px 14px' }}>
        {/* hero card */}
        <div className="sk-card" style={{ padding: 0, marginBottom: 12, overflow: 'hidden' }}>
          <div style={{ background: '#D5DFFF', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 8 }}>
            <SkIcon name="sparkle" size={14} />
            <span className="sk-label" style={{ color: '#1C3FE5' }}>Aria's pick of the day</span>
            <div style={{ flex: 1 }} />
            <span className="sk-caption" style={{ fontSize: 11 }}>2h ago</span>
          </div>
          <div style={{ padding: 14 }}>
            <div className="sk-h2" style={{ fontSize: 20, marginBottom: 4 }}>
              MSTR dropped <span className="sk-hi--pink">28%</span> on a bad quarter
            </div>
            <div className="sk-caption" style={{ fontSize: 13, marginBottom: 10 }}>
              but the fundamentals are intact. Classic bounce-back setup.
            </div>
            <div className="sk-ph" style={{ height: 70, marginBottom: 10 }}>
              <svg width="100%" height="100%" viewBox="0 0 280 60" preserveAspectRatio="none">
                <polyline points="0,10 40,15 80,25 120,20 160,35 200,30 240,50 280,48"
                  fill="none" stroke="#1a1a1a" strokeWidth="2"/>
              </svg>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <SkTag variant="blue">Bounce-Back</SkTag>
              <div style={{ flex: 1 }} />
              <SkBtn primary>Read why →</SkBtn>
            </div>
          </div>
        </div>

        <div className="sk-label" style={{ margin: '14px 0 8px' }}>More opportunities</div>

        {picks.slice(1).map(({ stock, strat, tag, tagVar, hours }) => (
          <div key={stock.t} style={{
            display: 'flex', gap: 12, padding: '12px 4px',
            borderBottom: '1.5px dashed #c4c4c4',
          }}>
            <div style={{
              width: 42, height: 42, flexShrink: 0,
              border: '1.5px solid #1a1a1a',
              borderRadius: '10px 13px 9px 14px / 13px 9px 14px 10px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: 'Kalam', fontWeight: 700, fontSize: 12,
            }}>{stock.t}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', gap: 4, marginBottom: 2 }}>
                <SkTag variant={tagVar}>{tag}</SkTag>
                <span className="sk-caption" style={{ fontSize: 11 }}>{hours}h</span>
              </div>
              <div className="sk-h3" style={{ fontSize: 14, marginBottom: 2 }}>{stock.why}</div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <span className="sk-caption" style={{ fontSize: 12 }}>{stock.name}</span>
                <span style={{ color: stock.chg < 0 ? '#b32121' : '#1a7a2e', fontFamily: 'Kalam', fontWeight: 700, fontSize: 12 }}>
                  {stock.chg > 0 ? '+' : ''}{stock.chg}%
                </span>
                <div style={{ flex: 1 }} />
                <SkSpark data={stock.spark} variant={stock.chg < 0 ? 'down' : 'up'} w={48} h={18} />
              </div>
            </div>
          </div>
        ))}
      </div>
      <SkMobileTabBar active="home" />
    </>
  );
}

Object.assign(window, { DirB_Feed });
