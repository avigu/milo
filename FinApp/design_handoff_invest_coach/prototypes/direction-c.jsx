// direction-c.jsx — AI CHAT-FIRST: Aria leads you through reasoning

function DirC_Chat() {
  return (
    <>
      <SkStatusBar />
      <div style={{ padding: '8px 14px 10px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{
          width: 32, height: 32, background: '#2F5DFF',
          border: '1.5px solid #1a1a1a',
          borderRadius: '8px 11px 7px 12px / 11px 7px 12px 8px',
          display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff',
        }}>
          <SkIcon name="sparkle" size={16} />
        </div>
        <div style={{ flex: 1 }}>
          <div className="sk-h3" style={{ fontSize: 14 }}>Aria</div>
          <div className="sk-caption" style={{ fontSize: 11 }}>your coach · online</div>
        </div>
        <SkIcon name="bell" size={18} />
      </div>

      <div className="sk-screen-scroll" style={{ padding: '8px 14px 8px', flex: 1 }}>
        {/* Aria msg */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 14, alignItems: 'flex-start' }}>
          <div style={{
            width: 26, height: 26, background: '#D5DFFF',
            border: '1.5px solid #1a1a1a', borderRadius: 6, flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}><SkIcon name="sparkle" size={12} /></div>
          <div className="sk-card" style={{ padding: 10, flex: 1, background: '#f5f3ec' }}>
            <div style={{ fontSize: 13, lineHeight: 1.4 }}>
              Morning Sam 👋 I found <span className="sk-hi--blue">3 opportunities</span> matching your profile. Want me to walk you through them?
            </div>
          </div>
        </div>

        {/* user reply */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 14 }}>
          <div className="sk-card" style={{
            padding: '8px 12px', maxWidth: '75%',
            background: '#2F5DFF', color: '#fff', border: '1.5px solid #1a1a1a',
          }}>
            <div style={{ fontSize: 13 }}>Yes, start with the safest one</div>
          </div>
        </div>

        {/* Aria rich msg */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 14, alignItems: 'flex-start' }}>
          <div style={{
            width: 26, height: 26, background: '#D5DFFF',
            border: '1.5px solid #1a1a1a', borderRadius: 6, flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}><SkIcon name="sparkle" size={12} /></div>
          <div style={{ flex: 1 }}>
            <div className="sk-card" style={{ padding: 10, background: '#f5f3ec', marginBottom: 8 }}>
              <div style={{ fontSize: 13, lineHeight: 1.4 }}>
                Good call. Here's <b>Coca-Cola (KO)</b> — a <span className="sk-hi">Steady Dividend</span> pick:
              </div>
            </div>

            {/* Stock card embedded in chat */}
            <div className="sk-card" style={{ padding: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <div style={{
                  width: 32, height: 32,
                  border: '1.5px solid #1a1a1a',
                  borderRadius: '8px 11px 7px 12px / 11px 7px 12px 8px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontFamily: 'Kalam', fontWeight: 700, fontSize: 11,
                }}>KO</div>
                <div style={{ flex: 1 }}>
                  <div className="sk-h3" style={{ fontSize: 13 }}>Coca-Cola</div>
                  <div className="sk-caption" style={{ fontSize: 11 }}>$66.10 · yield 3.1%</div>
                </div>
                <SkSpark data={[5,5,6,6,6,7,7,7]} variant="up" w={44} h={18}/>
              </div>
              <div style={{ padding: 8, background: '#fdfcf8', borderRadius: 5, fontSize: 12, lineHeight: 1.4 }}>
                62 years of raising dividends. Boring, reliable, recession-proof. Fit score <b style={{ color: '#2F5DFF' }}>91</b>.
              </div>
            </div>
            <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
              <SkBtn ghost style={{ fontSize: 12, padding: '5px 10px' }}>Tell me more</SkBtn>
              <SkBtn ghost style={{ fontSize: 12, padding: '5px 10px' }}>Too safe?</SkBtn>
              <SkBtn ghost style={{ fontSize: 12, padding: '5px 10px' }}>Next pick</SkBtn>
            </div>
          </div>
        </div>
      </div>

      {/* input */}
      <div style={{
        display: 'flex', gap: 8, padding: '8px 14px 10px',
        borderTop: '1.5px solid #1a1a1a', flexShrink: 0, alignItems: 'center',
      }}>
        <div className="sk-input" style={{ flex: 1, fontSize: 13, color: '#8a8a8a' }}>
          Ask anything about investing…
        </div>
        <div style={{
          width: 36, height: 36, background: '#2F5DFF',
          border: '1.5px solid #1a1a1a',
          borderRadius: '8px 11px 7px 12px / 11px 7px 12px 8px',
          display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff',
        }}><SkIcon name="arrow-up" size={16} /></div>
      </div>
    </>
  );
}

Object.assign(window, { DirC_Chat });
