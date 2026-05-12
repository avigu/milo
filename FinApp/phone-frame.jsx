// phone-frame.jsx — Lightweight sketchy phone frame (no iOS chrome overhead)

function SkPhone({ children, width = 320, height = 640, label }) {
  return (
    <div style={{ position: 'relative' }}>
      {label && (
        <div style={{
          position: 'absolute', top: -28, left: 4,
          fontFamily: 'Caveat, cursive', fontSize: 16,
          color: 'rgba(60,50,40,0.75)', fontWeight: 600,
        }}>{label}</div>
      )}
      <div style={{
        width, height,
        background: '#fdfcf8',
        border: '2.5px solid #1a1a1a',
        borderRadius: '38px 40px 37px 41px / 40px 37px 41px 38px',
        padding: 8,
        boxShadow: '4px 5px 0 0 rgba(26,26,26,0.15)',
        position: 'relative',
        boxSizing: 'border-box',
      }}>
        {/* notch */}
        <div style={{
          position: 'absolute', top: 12, left: '50%', transform: 'translateX(-50%)',
          width: 90, height: 18, background: '#1a1a1a',
          borderRadius: '9999px',
          zIndex: 10,
        }} />
        <div style={{
          width: '100%', height: '100%',
          background: '#fdfcf8',
          border: '1.5px solid #1a1a1a',
          borderRadius: '30px 32px 29px 33px / 32px 29px 33px 30px',
          overflow: 'hidden',
          position: 'relative',
          display: 'flex', flexDirection: 'column',
        }}>
          {children}
        </div>
      </div>
    </div>
  );
}

function SkStatusBar() {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '12px 22px 4px', fontFamily: 'Kalam, cursive', fontSize: 12,
      fontWeight: 700, color: '#1a1a1a', flexShrink: 0,
    }}>
      <span>9:41</span>
      <span style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
        <span>•••</span><span>∎∎∎</span><span>▮</span>
      </span>
    </div>
  );
}

function SkMobileTabBar({ active = 'home' }) {
  const items = [
    { id: 'home',   label: 'Home',    icon: 'home' },
    { id: 'strat',  label: 'Ideas',   icon: 'compass' },
    { id: 'watch',  label: 'Watch',   icon: 'star' },
    { id: 'learn',  label: 'Learn',   icon: 'book' },
    { id: 'me',     label: 'Me',      icon: 'user' },
  ];
  return (
    <div className="sk-tabbar" style={{ flexShrink: 0 }}>
      {items.map(it => (
        <div key={it.id} className={`sk-tabbar__item ${active === it.id ? 'sk-tabbar__item--on' : ''}`}>
          <SkIcon name={it.icon} size={20} />
          <span>{it.label}</span>
        </div>
      ))}
    </div>
  );
}

function SkTopBar({ title, back, action }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '6px 16px 8px', flexShrink: 0,
    }}>
      <div style={{ width: 28 }}>
        {back && <SkIcon name="arrow-right" size={18} stroke={1.5} />}
      </div>
      <div className="sk-h3">{title}</div>
      <div style={{ width: 28, display: 'flex', justifyContent: 'flex-end' }}>
        {action && <SkIcon name={action} size={18} />}
      </div>
    </div>
  );
}

Object.assign(window, { SkPhone, SkStatusBar, SkMobileTabBar, SkTopBar });
