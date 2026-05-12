// direction-d.jsx — DESKTOP DASHBOARD: all 5 strategies scanned at once

function DirD_Desktop({ sources, risk }) {
  return (
    <div style={{ height: '100%', display: 'flex', fontFamily: 'Kalam, cursive' }}>
      {/* Sidebar */}
      <div style={{
        width: 180, borderRight: '1.5px solid #1a1a1a',
        padding: '18px 14px', flexShrink: 0,
        background: '#f5f3ec',
      }}>
        <div className="sk-h2" style={{ fontSize: 18, marginBottom: 14 }}>
          Invest<br/>Coach
        </div>
        <div className="sk-label" style={{ marginBottom: 6 }}>Strategies</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 18 }}>
          {STRATEGIES.map((s, i) => (
            <div key={s.id} style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '6px 8px',
              borderRadius: 6, fontSize: 12,
              background: i === 0 ? '#D5DFFF' : 'transparent',
              border: i === 0 ? '1.5px solid #1a1a1a' : '1.5px solid transparent',
              fontWeight: i === 0 ? 700 : 400,
            }}>
              <SkIcon name={s.icon} size={14} />
              {s.name}
            </div>
          ))}
        </div>
        <div className="sk-label" style={{ marginBottom: 6 }}>Your risk</div>
        <span className="sk-tag sk-tag--blue">{risk}</span>
        <div style={{ marginTop: 20 }} className="sk-label">Links</div>
        <div style={{ fontSize: 12, lineHeight: 1.8, color: '#4a4a4a' }}>
          <div>Watchlist</div>
          <div>Learn</div>
          <div>Settings</div>
        </div>
      </div>

      {/* Main */}
      <div style={{ flex: 1, overflow: 'auto', padding: '18px 22px' }}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 16 }}>
          <div>
            <div className="sk-h1" style={{ fontSize: 26 }}>Opportunity scan</div>
            <div className="sk-caption">Last updated 2 min ago · 47 stocks matched</div>
          </div>
          <div style={{ flex: 1 }} />
          <SkBtn icon="filter">Filter</SkBtn>
        </div>

        {/* Top row — 3 strategy cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 16 }}>
          {[STRATEGIES[0], STRATEGIES[1], STRATEGIES[4]].map(strat => {
            const picks = STOCKS.filter(s => s.strategy === strat.id);
            return (
              <div key={strat.id} className="sk-card" style={{ padding: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <SkIcon name={strat.icon} size={16} />
                  <div className="sk-h3" style={{ fontSize: 14 }}>{strat.name}</div>
                  <div style={{ flex: 1 }} />
                  <span className="sk-tag sk-tag--blue">{picks.length}</span>
                </div>
                <div className="sk-caption" style={{ fontSize: 12, marginBottom: 8 }}>{strat.logic}</div>
                {/* Aria intent per card */}
                <div style={{
                  display: 'flex', alignItems: 'flex-start', gap: 6,
                  padding: '6px 8px', marginBottom: 8,
                  background: '#D5DFFF55',
                  border: '1px dashed #1C3FE5', borderRadius: 5,
                  fontSize: 11, lineHeight: 1.35, color: '#1C3FE5',
                }}>
                  <SkIcon name="sparkle" size={11} />
                  <span><b>Aria:</b> {picks[0] ? `Top pick is ${picks[0].t} — ${picks[0].why.split('.')[0].toLowerCase()}.` : 'No strong signals today.'}</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {picks.map((s, i) => (
                    <div key={s.t} style={{
                      display: 'flex', flexDirection: 'column', gap: 4,
                      padding: '6px 8px',
                      background: '#fdfcf8',
                      border: '1.2px solid #c4c4c4',
                      borderRadius: 4,
                      fontSize: 12,
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontWeight: 700, width: 40 }}>{s.t}</span>
                        <span style={{ flex: 1, color: '#4a4a4a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</span>
                        <span style={{ color: s.chg < 0 ? '#b32121' : '#1a7a2e', fontWeight: 700 }}>
                          {s.chg > 0 ? '+' : ''}{s.chg}%
                        </span>
                        <SkSpark data={s.spark} variant={s.chg < 0 ? 'down' : 'up'} w={40} h={16}/>
                      </div>
                      {/* Aria intent per stock */}
                      <div style={{
                        display: 'flex', alignItems: 'flex-start', gap: 4,
                        fontSize: 10.5, color: '#1C3FE5', lineHeight: 1.3,
                      }}>
                        <SkIcon name="sparkle" size={10} />
                        <span style={{ flex: 1 }}>{s.why}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* Table + AI panel */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: 14 }}>
          <div className="sk-card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{
              padding: '10px 12px', borderBottom: '1.5px dashed #c4c4c4',
              display: 'flex', alignItems: 'center',
            }}>
              <div className="sk-h3" style={{ fontSize: 14 }}>All matches</div>
              <div style={{ flex: 1 }} />
              <span className="sk-caption" style={{ fontSize: 11 }}>sorted by fit score</span>
            </div>
            <table style={{
              width: '100%', borderCollapse: 'collapse',
              fontFamily: 'Kalam, cursive', fontSize: 12,
            }}>
              <thead>
                <tr style={{ background: '#f5f3ec' }}>
                  {['Stock', 'Strategy', 'Price', '30d', 'Fit', 'Why'].map(h => (
                    <th key={h} style={{
                      padding: '8px 10px', textAlign: 'left',
                      fontWeight: 500, color: '#4a4a4a',
                      borderBottom: '1.5px solid #1a1a1a',
                      fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.3,
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {STOCKS.slice(0, 6).map(s => {
                  const strat = STRATEGIES.find(st => st.id === s.strategy);
                  const fit = 90 - STOCKS.indexOf(s) * 3;
                  return (
                    <tr key={s.t} style={{ borderBottom: '1px dashed #c4c4c4' }}>
                      <td style={{ padding: '8px 10px' }}>
                        <div style={{ fontWeight: 700 }}>{s.t}</div>
                        <div style={{ color: '#8a8a8a', fontSize: 11 }}>{s.name}</div>
                      </td>
                      <td style={{ padding: '8px 10px' }}>
                        <SkTag>{strat.name}</SkTag>
                      </td>
                      <td style={{ padding: '8px 10px', fontWeight: 700 }}>${s.price}</td>
                      <td style={{ padding: '8px 10px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ color: s.chg < 0 ? '#b32121' : '#1a7a2e', fontWeight: 700 }}>
                            {s.chg > 0 ? '+' : ''}{s.chg}%
                          </span>
                          <SkSpark data={s.spark} variant={s.chg < 0 ? 'down' : 'up'} w={40} h={14}/>
                        </div>
                      </td>
                      <td style={{ padding: '8px 10px' }}>
                        <span style={{
                          display: 'inline-block', padding: '2px 8px',
                          background: fit > 80 ? '#D5DFFF' : '#f5f3ec',
                          border: '1px solid #1a1a1a', borderRadius: 999,
                          fontWeight: 700, color: fit > 80 ? '#1C3FE5' : '#1a1a1a',
                        }}>{fit}</span>
                      </td>
                      <td style={{ padding: '8px 10px', color: '#4a4a4a', maxWidth: 260 }}>
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                          {s.why}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Aria side panel */}
          <div className="sk-card" style={{ padding: 14, background: '#D5DFFF33' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <SkIcon name="sparkle" size={16} />
              <div className="sk-h3" style={{ fontSize: 14 }}>Aria's summary</div>
            </div>
            <div style={{ fontSize: 13, lineHeight: 1.5, marginBottom: 12 }}>
              Based on <span className="sk-hi--blue">{sources.length} sources</span> and your <b>{risk}</b> risk level:
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 12 }}>
              <div style={{ padding: 8, background: '#fff', borderRadius: 6, border: '1px solid #c4c4c4' }}>
                <b>🎯 Best overall:</b> MSTR (bounce-back, fit 90)
              </div>
              <div style={{ padding: 8, background: '#fff', borderRadius: 6, border: '1px solid #c4c4c4' }}>
                <b>🛡 Safest:</b> KO (dividend, fit 91)
              </div>
              <div style={{ padding: 8, background: '#fff', borderRadius: 6, border: '1px solid #c4c4c4' }}>
                <b>🚀 Most upside:</b> TSM (dip, +40% target)
              </div>
            </div>
            <div style={{ marginTop: 12, padding: 8, background: '#fff48a55', borderRadius: 6, fontSize: 12 }}>
              <b>Heads up:</b> 3 of the 5 strategies are flashing signals right now — unusual. Market may be at a turning point.
            </div>
          </div>
        </div>

        {/* sources footer */}
        <div style={{ marginTop: 16, display: 'flex', gap: 6, alignItems: 'center' }}>
          <span className="sk-label">Scanning:</span>
          {sources.map(src => <SkTag key={src}>{src}</SkTag>)}
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { DirD_Desktop });
