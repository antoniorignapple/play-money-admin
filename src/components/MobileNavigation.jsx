import { useEffect, useRef, useState } from 'react';
import { Menu, Search, X, ChevronRight, LogOut, Wallet, BarChart3, Calculator, RefreshCw } from 'lucide-react';
import { TabItem } from './TabItem';
import { APP_VERSION } from '../config/release';

const MOBILE_TABS = [
  { id: 'cassa', label: 'CASSA', icon: Wallet },
  { id: 'analisi', label: 'ANALISI', icon: BarChart3 },
  { id: 'conteggi', label: 'CONTEGGI', icon: Calculator, RefreshCw },
];

export function MobileNavigation({ page, pages, onNavigate, open, onOpenChange, onSearch, onLogout }) {
  const drawer = useRef(null);
  const menuButton = useRef(null);
  const [query, setQuery] = useState('');
  const gesture = useRef(null);
  const [drawerOffset, setDrawerOffset] = useState(null);
  const [keyboard, setKeyboard] = useState(false);
  const activeTab = page === 'contabilita-conteggi' ? 'conteggi' : page === 'contabilita-cassa' ? 'cassa' : page;
  useEffect(() => {
    if (open) { drawer.current?.showModal(); }
    else if (drawer.current?.open) { drawer.current.close(); menuButton.current?.focus(); }
  }, [open]);
  useEffect(() => {
    const viewport = window.visualViewport;
    const update = () => {
      const editing = /INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName || '');
      setKeyboard(Boolean(editing && viewport && viewport.height < window.innerHeight - 120));
      document.documentElement.style.setProperty('--mobile-viewport-height', `${viewport?.height || window.innerHeight}px`);
    };
    viewport?.addEventListener('resize', update);
    document.addEventListener('focusin', update); document.addEventListener('focusout', update);
    update();
    return () => { viewport?.removeEventListener('resize', update); document.removeEventListener('focusin', update); document.removeEventListener('focusout', update); document.documentElement.style.removeProperty('--mobile-viewport-height'); };
  }, []);
  // Same horizontal direction lock as Dipendenti; vertical gestures keep scrolling.
  useEffect(() => {
    const width = () => Math.min(window.innerWidth * .88, 356);
    const start = event => {
      const touch = event.touches?.[0];
      if (!touch || event.touches.length !== 1 || (!open && touch.clientX > 24) || (open && touch.clientX > width())) return;
      if (!open && document.querySelector('dialog[open]')) return;
      gesture.current = { mode:open ? 'close' : 'open', x:touch.clientX, y:touch.clientY, lastX:touch.clientX, time:performance.now(), velocity:0, axis:null };
    };
    const move = event => {
      const g=gesture.current, t=event.touches?.[0]; if(!g || !t) return;
      const dx=t.clientX-g.x, dy=t.clientY-g.y;
      if(!g.axis && (Math.abs(dx)>7 || Math.abs(dy)>7)) g.axis=Math.abs(dx)>Math.abs(dy)*1.15 ? 'x' : 'y';
      if(g.axis!=='x') return;
      event.preventDefault();
      const now=performance.now();g.velocity=(t.clientX-g.lastX)/Math.max(1,now-g.time);g.lastX=t.clientX;g.time=now;
      if(g.mode==='open') onOpenChange(true);
      setDrawerOffset(Math.max(-width(),Math.min(0,g.mode==='open' ? -width()+Math.max(0,dx) : Math.min(0,dx))));
    };
    const end = event => {
      const g=gesture.current;gesture.current=null;if(!g) return;
      if(g.axis==='x') {
        const dx=(event.changedTouches?.[0]?.clientX ?? g.lastX)-g.x;
        const visible=g.mode==='open' ? Math.max(0,dx) : width()+Math.min(0,dx);
        onOpenChange(event.type!=='touchcancel' && (g.velocity>.42 || (g.velocity>=-.42 && visible>width()*.48)));
      }
      setDrawerOffset(null);
    };
    window.addEventListener('touchstart',start,{passive:true});window.addEventListener('touchmove',move,{passive:false});
    window.addEventListener('touchend',end);window.addEventListener('touchcancel',end);
    return () => { window.removeEventListener('touchstart',start);window.removeEventListener('touchmove',move);window.removeEventListener('touchend',end);window.removeEventListener('touchcancel',end); };
  }, [open,onOpenChange]);
  const label = pages.find(item => item.id === page)?.label || 'Analisi';
  const navigate = id => { onNavigate(id); onOpenChange(false); };
  const results = pages.filter(item => `${item.label} ${item.hint}`.toLocaleLowerCase('it').includes(query.toLocaleLowerCase('it')));
  return <>
    <header className="pm-mobile-header">
      <div className="pm-mobile-header-panel">
        <button ref={menuButton} type="button" className="pm-mobile-control" aria-label="Apri menu" aria-expanded={open} aria-controls="admin-mobile-menu" onClick={() => { setQuery(''); onOpenChange(true); }}><Menu size={22}/></button>
        <div className="pm-mobile-title"><span>PLAY MONEY ADMIN</span><strong>{(page === 'analisi' ? 'ANALISI' : label).toLocaleUpperCase('it')}</strong></div>
        <button type="button" className="pm-mobile-control" aria-label="Cerca sezioni" onClick={onSearch}><Search size={21}/></button>
      {['cassa', 'analisi', 'conteggi'].includes(page) && <button type="button" className="pm-mobile-control" aria-label={`Aggiorna ${page}`} onClick={() => window.dispatchEvent(new Event('admin-page-refresh'))}><RefreshCw size={21}/></button>}
      </div>
    </header>
    <nav className={`pm-mobile-tabbar ${keyboard ? 'pm-keyboard-hidden' : ''}`} aria-label="Navigazione principale">
      <div className="pm-mobile-tabs">
        {MOBILE_TABS.some(item => item.id === activeTab) && <span className="pm-tabpill" style={{ left: `calc(${MOBILE_TABS.findIndex(item => item.id === activeTab) * 100 / 3}% + 4px)` }} aria-hidden="true"/>}
        {MOBILE_TABS.map(item => <TabItem key={item.id} {...item} activeTab={activeTab} setActiveTab={navigate}/>)}
      </div>
    </nav>
    <dialog ref={drawer} id="admin-mobile-menu" className="pm-mobile-drawer" style={drawerOffset === null ? undefined : {transform:`translateX(${drawerOffset}px)`,animation:'none'}} aria-labelledby="admin-menu-title" onCancel={() => onOpenChange(false)} onClose={() => onOpenChange(false)} onClick={event => { if (event.target === event.currentTarget) onOpenChange(false); }}>
      <div className="pm-mobile-drawer-panel">
        <header className="pm-mobile-drawer-brand">
          <img src="/app-icon.png" alt=""/><div><span>PLAY MONEY</span><h2 id="admin-menu-title">ADMIN <small>{APP_VERSION}</small></h2></div>
          <button type="button" className="pm-mobile-control" aria-label="Chiudi menu" onClick={() => onOpenChange(false)} autoFocus><X size={22}/></button>
        </header>
        <label className="pm-mobile-menu-search"><Search size={19}/><input placeholder="Cerca una sezione" aria-label="Cerca nel menu" value={query} onChange={event => setQuery(event.target.value)}/></label>
        <nav className="pm-mobile-menu-list" aria-label="Tutte le sezioni">
          <p>Il tuo spazio di lavoro</p>
          {results.map(item => { const Icon = item.iconCmp; return <button type="button" key={item.id} aria-current={page === item.id ? 'page' : undefined} onClick={() => navigate(item.id)}>
            <span className="pm-mobile-menu-icon"><Icon size={21}/></span><span><strong>{(item.id === 'analisi' ? 'ANALISI' : item.label).toLocaleUpperCase('it')}</strong></span><ChevronRight size={18}/>
          </button>; })}
          {!results.length && <p role="status">Nessuna sezione trovata.</p>}
        </nav>
        <button type="button" className="pm-mobile-logout" onClick={onLogout}><LogOut size={20}/> Esci dall’account</button>
      </div>
    </dialog>
  </>;
}
