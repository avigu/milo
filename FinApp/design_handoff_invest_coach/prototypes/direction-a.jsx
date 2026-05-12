// direction-a.jsx — STRATEGY-FIRST mobile app
// User picks a strategy → sees matching stocks → sees the "why"

function DirA_Home({ risk }) {
  // Rank stocks by "opportunity size" (bigger = better opportunity, fit-weighted)
  const ranked = STOCKS
    .map((s, i) => {
      const strat = STRATEGIES.find(st => st.id === s.strategy);
      // opportunity = upside% estimate — synthesised from strategy + drop magnitude
      const upside = s.chg < 0 ? Math.min(45, Math.round(Math.abs(s.chg) * 2.2 + 8))
                                : Math.round(12 + (i % 3) * 6);
      const fit = 92 - i * 3;
      return { ...s, strat, upside, fit };
    })
    .sort((a, b) => b.upside - a.upside);

  return (
    <>
      <SkStatusBar />
      <SkTopBar title="Invest Coach" action="bell" />
      <div className="sk-screen-scroll" style={{ padding: '4px 14px 14px' }}>
        <div style={{ marginBottom: 12 }}>
          <div className="sk-h1" style={{ fontSize: 24 }}>
            Best <span className="sk-hi--blue">opportunities</span> today
          </div>
          <div className="sk-caption" style={{ marginTop: 2, fontSize: 12 }}>
            Sorted by expected upside · Matched to your <b>{risk}</b> profile
          </div>
        </div>

        {/* Strategy filter chips (secondary) */}
        <div style={{ display: 'flex', gap: 6, overflowX: 'auto', marginBottom: 12, paddingBottom: 2 }}>
          <span className="sk-tag sk-tag--ink" style={{ flexShrink: 0 }}>All · {ranked.length}</span>
          {STRATEGIES.map(s => (
            <span key={s.id} className="sk-tag" style={{ flexShrink: 0 }}>
              {s.name}
            </span>
          ))}
          <span className="sk-tag" style={{ flexShrink: 0 }}>
            <SkIcon name="filter" size={11} /> More
          </span>
        </div>

        {/* Ranked stock list */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {ranked.map((s, i) => (
            <div key={s.t} className="sk-card" style={{ padding: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                {/* Rank badge */}
                <div style={{
                  width: 22, height: 22, flexShrink: 0,
                  border: '1.5px solid #1a1a1a', borderRadius: '50%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontFamily: 'Kalam, cursive', fontWeight: 700, fontSize: 11,
                  background: i === 0 ? '#2F5DFF' : '#fdfcf8',
                  color: i === 0 ? '#fff' : '#1a1a1a',
                }}>{i + 1}</div>
                <div style={{
                  width: 34, height: 34, flexShrink: 0,
                  border: '1.5px solid #1a1a1a',
                  borderRadius: '8px 11px 7px 12px / 11px 7px 12px 8px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontFamily: 'Kalam, cursive', fontWeight: 700, fontSize: 11,
                }}>{s.t.slice(0, 2)}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="sk-h3" style={{ fontSize: 14 }}>{s.t} · {s.name}</div>
                  <div className="sk-caption" style={{ fontSize: 11 }}>
                    ${s.price.toFixed(2)} ·{' '}
                    <span style={{ color: s.chg < 0 ? '#b32121' : '#1a7a2e' }}>
                      {s.chg > 0 ? '+' : ''}{s.chg}%
                    </span>
                  </div>
                </div>
                {/* Opportunity size — the hero metric */}
                <div style={{ textAlign: 'right' }}>
                  <div className="sk-label" style={{ fontSize: 9 }}>upside</div>
                  <div style={{
                    fontFamily: 'Kalam, cursive', fontWeight: 700, fontSize: 18,
                    color: '#1a7a2e', lineHeight: 1,
                  }}>+{s.upside}%</div>
                </div>
              </div>

              {/* Aria intent per-stock */}
              <div style={{
                display: 'flex', alignItems: 'flex-start', gap: 6,
                padding: '7px 9px',
                background: '#D5DFFF44',
                border: '1px dashed #1C3FE5', borderRadius: 5,
                fontSize: 11.5, lineHeight: 1.35, color: '#1C3FE5',
                marginBottom: 8,
              }}>
                <SkIcon name="sparkle" size={11} />
                <span style={{ flex: 1 }}><b>Aria:</b> {s.why}</span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className="sk-tag" style={{ fontSize: 10 }}>{s.strat.name}</span>
                <SkSpark data={s.spark} variant={s.chg < 0 ? 'down' : 'up'} w={50} h={16} />
                <div style={{ flex: 1 }} />
                <span className="sk-caption" style={{ fontSize: 11 }}>fit <b style={{ color: '#2F5DFF' }}>{s.fit}</b></span>
                <SkIcon name="arrow-right" size={14} stroke={1.5} />
              </div>
            </div>
          ))}
        </div>
      </div>
      <SkMobileTabBar active="home" />
    </>
  );
}

function DirA_StrategyDetail({ sources }) {
  const strat = STRATEGIES[0]; // Bounce-Back
  const picks = STOCKS.filter(s => s.strategy === strat.id);
  return (
    <>
      <SkStatusBar />
      <SkTopBar title="Bounce-Back" back action="filter" />
      <div className="sk-screen-scroll" style={{ padding: '4px 14px 14px' }}>
        {/* Hero explainer */}
        <div className="sk-card" style={{ padding: 14, marginBottom: 14, background: '#D5DFFF66' }}>
          <div className="sk-h2" style={{ fontSize: 20, marginBottom: 6 }}>
            <span className="sk-hi--blue">Good company,</span> bad quarter
          </div>
          <div className="sk-caption" style={{ fontSize: 13 }}>
            We look for solid businesses that just had <u>one</u> bad report and the stock overreacted. History shows these often bounce back in 3–6 months.
          </div>
          <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
            {sources.map(src => <SkTag key={src} variant="ink">{src}</SkTag>)}
          </div>
        </div>

        {/* sort bar */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 10, alignItems: 'center' }}>
          <span className="sk-label">{picks.length} picks</span>
          <div style={{ flex: 1 }} />
          <span className="sk-tag">Best fit ▾</span>
        </div>

        {/* stock cards */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {picks.map((s, i) => (
            <div key={s.t} className="sk-card" style={{ padding: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <div style={{
                  width: 34, height: 34,
                  border: '1.5px solid #1a1a1a',
                  borderRadius: '8px 10px 7px 11px / 10px 7px 11px 8px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontFamily: 'Kalam, cursive', fontWeight: 700, fontSize: 11,
                }}>{s.t.slice(0, 2)}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="sk-h3" style={{ fontSize: 14 }}>{s.t} · {s.name}</div>
                  <div className="sk-caption" style={{ fontSize: 12 }}>${s.price.toFixed(2)} · <span style={{ color: s.chg < 0 ? '#b32121' : '#1a7a2e' }}>{s.chg > 0 ? '+' : ''}{s.chg}%</span></div>
                </div>
                <SkSpark data={s.spark} variant={i === 0 ? 'down' : 'blue'} w={56} h={22} />
                {i === 0 && <span className="sk-tag sk-tag--blue">Top pick</span>}
              </div>
              <div style={{
                padding: '8px 10px',
                background: '#f5f3ec',
                borderRadius: 6,
                fontSize: 12, lineHeight: 1.35,
              }}>
                <span className="sk-label" style={{ fontSize: 10 }}>Why:</span>
                <span style={{ marginLeft: 4 }}>{s.why}</span>
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                <SkBtn ghost style={{ flex: 1 }}>
                  <SkIcon name="star" size={14} /> Watch
                </SkBtn>
                <SkBtn primary style={{ flex: 1 }}>
                  See details →
                </SkBtn>
              </div>
            </div>
          ))}
        </div>
      </div>
      <SkMobileTabBar active="strat" />
    </>
  );
}

function DirA_StockDetail({ sources }) {
  const stock = STOCKS[0];
  return (
    <>
      <SkStatusBar />
      <SkTopBar title={stock.t} back action="star" />
      <div className="sk-screen-scroll" style={{ padding: '4px 14px 14px' }}>
        {/* Price */}
        <div style={{ marginBottom: 8 }}>
          <div className="sk-caption" style={{ fontSize: 12 }}>{stock.name}</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
            <div className="sk-h1" style={{ fontSize: 32 }}>${stock.price}</div>
            <div style={{ color: '#b32121', fontFamily: 'Kalam', fontWeight: 700, fontSize: 15 }}>
              {stock.chg}% today
            </div>
          </div>
          <span className="sk-tag sk-tag--blue">
            <SkIcon name="trend" size={12} /> Bounce-Back pick
          </span>
        </div>

        {/* Chart */}
        <div className="sk-ph" style={{ height: 120, marginTop: 12, marginBottom: 14 }}>
          <svg width="100%" height="100%" viewBox="0 0 280 100" preserveAspectRatio="none">
            <polyline points="0,20 30,25 60,40 90,35 120,30 150,50 180,45 210,70 240,85 280,80"
              fill="none" stroke="#1a1a1a" strokeWidth="2" />
            <line x1="0" y1="60" x2="280" y2="60" stroke="#2F5DFF" strokeWidth="1" strokeDasharray="4 3"/>
            <text x="4" y="56" fontFamily="Caveat" fontSize="12" fill="#2F5DFF">← fair value</text>
          </svg>
        </div>

        {/* AI Breakdown — the "why" */}
        <div className="sk-card" style={{ padding: 12, marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
            <SkIcon name="sparkle" size={16} />
            <div className="sk-h3" style={{ fontSize: 14 }}>Why Aria picked this</div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 13 }}>
            {sources.includes('Q reports') && (
              <div style={{ display: 'flex', gap: 8 }}>
                <span className="sk-check sk-check--on" style={{ marginTop: 2 }}></span>
                <span><b>Q reports:</b> Revenue <span className="sk-hi--green">+18%</span> YoY. Just one bad guidance.</span>
              </div>
            )}
            {sources.includes('Price') && (
              <div style={{ display: 'flex', gap: 8 }}>
                <span className="sk-check sk-check--on" style={{ marginTop: 2 }}></span>
                <span><b>Price:</b> Down <span className="sk-hi--pink">28%</span> in 40 days — overreaction.</span>
              </div>
            )}
            {sources.includes('Analyst') && (
              <div style={{ display: 'flex', gap: 8 }}>
                <span className="sk-check sk-check--on" style={{ marginTop: 2 }}></span>
                <span><b>Analysts:</b> 8 of 12 still rate Buy. Avg target $178.</span>
              </div>
            )}
            {sources.includes('News') && (
              <div style={{ display: 'flex', gap: 8 }}>
                <span className="sk-check sk-check--on" style={{ marginTop: 2 }}></span>
                <span><b>News:</b> Sentiment neutral, no scandals.</span>
              </div>
            )}
          </div>
        </div>

        {/* Fit score */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
          <div className="sk-card" style={{ flex: 1, padding: 10, textAlign: 'center' }}>
            <div className="sk-label">Fit</div>
            <div className="sk-num" style={{ fontSize: 28, color: '#2F5DFF' }}>82</div>
            <div className="sk-caption" style={{ fontSize: 11 }}>out of 100</div>
          </div>
          <div className="sk-card" style={{ flex: 1, padding: 10, textAlign: 'center' }}>
            <div className="sk-label">Target</div>
            <div className="sk-num" style={{ fontSize: 22 }}>$178</div>
            <div className="sk-caption" style={{ fontSize: 11, color: '#1a7a2e' }}>+25%</div>
          </div>
          <div className="sk-card" style={{ flex: 1, padding: 10, textAlign: 'center' }}>
            <div className="sk-label">Time</div>
            <div className="sk-num" style={{ fontSize: 22 }}>3–6m</div>
            <div className="sk-caption" style={{ fontSize: 11 }}>horizon</div>
          </div>
        </div>

        <SkBtn primary style={{ width: '100%', justifyContent: 'center', padding: 12 }}>
          Buy on my broker →
        </SkBtn>
        <div className="sk-caption" style={{ fontSize: 11, textAlign: 'center', marginTop: 6 }}>
          Opens eToro / IBKR / your choice
        </div>
      </div>
    </>
  );
}

Object.assign(window, { DirA_Home, DirA_StrategyDetail, DirA_StockDetail });
