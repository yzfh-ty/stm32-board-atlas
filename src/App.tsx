import { useCallback, useEffect, useRef, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { BoardViewer, modelUrl } from './BoardViewer';
import type { CameraAction, ViewPreset } from './BoardViewer';
import { allVisible, categories, partMap, parts } from './board-data';
import type { CategoryId } from './board-data';

const paths: Record<string, ReactNode> = {
  search: <><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 4 4" /></>,
  info: <><circle cx="12" cy="12" r="9" /><path d="M12 11v6m0-10v.1" /></>,
  reset: <path d="M3 10a9 9 0 1 1 2 8M3 4v6h6" />,
  rotate: <><path d="M4 9a8 8 0 1 1 1 9M4 4v5h5" /><path d="M10 9v6l5-3-5-3Z" /></>,
  pause: <path d="M9 5v14M15 5v14" />,
  close: <path d="m6 6 12 12M6 18 18 6" />,
  chevron: <path d="m9 5 7 7-7 7" />,
  focus: <><path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5" /><circle cx="12" cy="12" r="3" /></>,
  isolate: <><rect x="8" y="8" width="8" height="8" rx="1" /><path d="M3 8V3h5m8 0h5v5M3 16v5h5m13-5v5h-5" /></>,
  layers: <path d="m3 7 9-5 9 5-9 5-9-5Zm0 5 9 5 9-5M3 17l9 5 9-5" />,
  chip: <><rect x="6" y="6" width="12" height="12" rx="2" /><path d="M9 1v5m6-5v5M9 18v5m6-5v5M1 9h5m-5 6h5m12-6h5m-5 6h5" /></>,
  arrow: <path d="M6 18 18 6M6 6h12v12" />,
  label: <><path d="M20 12 12 20 3 11V3h8l9 9Z" /><circle cx="7.5" cy="7.5" r="1" /></>,
  plus: <path d="M12 5v14M5 12h14" />, minus: <path d="M5 12h14" />,
  download: <path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5" />,
};
function Icon({ name, size = 18 }: { name: string; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}
const viewOptions: [ViewPreset, string, string][] = [
  ['overview', '¾', '三分之四视角'], ['top', 'T', '俯视图'], ['front', 'F', '正视图'], ['side', 'S', '侧视图'], ['back', 'B', '后视图'],
];
export default function App() {
  const [visible, setVisible] = useState(allVisible);
  const [selected, setSelected] = useState<string | null>(null);
  const [isolated, setIsolated] = useState(false);
  const [explode, setExplode] = useState(0);
  const [rotating, setRotating] = useState(false);
  const [labels, setLabels] = useState(false);
  const [cameraAction, setCameraAction] = useState<CameraAction>({ view: 'overview', sequence: 0 });
  const [expanded, setExpanded] = useState<CategoryId | null>(null);
  const [query, setQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [help, setHelp] = useState(false);
  const [mobilePanel, setMobilePanel] = useState(false);
  const [ready, setReady] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const searchInput = useRef<HTMLInputElement>(null);
  const selectedPart = selected ? partMap[selected] : null;
  const visibleParts = parts.filter(p => visible[p.category] && (!isolated || p.id === selected));
  const found = parts.filter(p => (p.name + ' ' + p.ref + ' ' + p.id + ' ' + categories.find(c => c.id === p.category)?.name).toLowerCase().includes(query.trim().toLowerCase())).slice(0, 9);
  const onReady = useCallback(() => setReady(true), []);
  const select = useCallback((id: string | null) => {
    setSelected(id); setIsolated(false); setSearchOpen(false); setMobilePanel(false);
    if (id) setVisible(previous => ({ ...previous, [partMap[id].category]: true }));
  }, []);
  const changeView = useCallback((view: ViewPreset) => {
    setRotating(false); setCameraAction(p => ({ view, sequence: p.sequence + 1 }));
  }, []);
  const reset = useCallback(() => {
    setVisible(allVisible()); setSelected(null); setIsolated(false); setExplode(0); setRotating(false);
    setLabels(false); setQuery(''); setExpanded(null); setSearchOpen(false);
    setCameraAction(p => ({ view: 'overview', sequence: p.sequence + 1 }));
  }, []);
  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => { setReducedMotion(media.matches); if (media.matches) setRotating(false); };
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      const editing = event.target instanceof HTMLElement && (['INPUT', 'TEXTAREA', 'SELECT'].includes(event.target.tagName) || event.target.isContentEditable);
      if (event.key === 'Escape') { setSearchOpen(false); setHelp(false); setSelected(null); setIsolated(false); searchInput.current?.blur(); }
      if (editing || event.ctrlKey || event.metaKey || event.altKey) return;
      if (event.key === '/') { event.preventDefault(); searchInput.current?.focus(); setSearchOpen(true); }
      if (event.key.toLowerCase() === 'r') reset();
      if (['1', '2', '3', '4', '5'].includes(event.key)) changeView(viewOptions[Number(event.key) - 1][0]);
    };
    window.addEventListener('keydown', keydown); return () => window.removeEventListener('keydown', keydown);
  }, [reset, changeView]);
  function toggleCategory(id: CategoryId) {
    setVisible(previous => ({ ...previous, [id]: !previous[id] }));
    if (selected && partMap[selected].category === id) { setSelected(null); setIsolated(false); }
  }
  function preset(mode: 'all' | 'core' | 'io') {
    setVisible(Object.fromEntries(categories.map(c => [c.id, mode === 'all' || c.id === 'pcb' || (mode === 'core' ? ['core', 'clock', 'power', 'boot'].includes(c.id) : c.id === 'io')])) as Record<CategoryId, boolean>);
    setSelected(null); setIsolated(false);
  }
  const presetName = categories.every(c => visible[c.id]) ? 'all' : visible.io && !visible.core ? 'io' : !visible.io && visible.core ? 'core' : '';
  return <main className="atlas">
    <a className="skip-link" href="#systems-panel">跳到元件控制面板</a>
    <div className="scene-stage"><BoardViewer selected={selected} onSelect={select} visible={visible} isolated={isolated} explode={explode}
      rotating={rotating} labels={labels} reducedMotion={reducedMotion} cameraAction={cameraAction} onReady={onReady} /></div>
    <header className="identity">
      <p className="eyebrow"><i /> INTERACTIVE BOARD ATLAS</p>
      <h1>STM32F103C8T6 <span className="badge-3d">3D</span></h1>
      <p className="subtitle">31 个可选元件<span>·</span>最小系统板</p>
      <div className="board-profile"><span className="profile-icon"><Icon name="chip" size={20} /></span><div><strong>STM32 / Blue board</strong><small>52 × 23 mm · Cortex-M3</small></div><span className="profile-dot" title="外观展示模型" /></div>
    </header>
    <div className="search-area">
      <div className={'search-box' + (searchOpen ? ' is-open' : '')}><Icon name="search" size={17} />
        <input ref={searchInput} aria-label="搜索元件" placeholder="查找一个元件" value={query} onFocus={() => setSearchOpen(true)}
          onChange={e => { setQuery(e.target.value); setSearchOpen(true); }} onKeyDown={e => { if (e.key === 'Enter' && found[0]) { select(found[0].id); searchInput.current?.blur(); } }} />
        {query ? <button className="bare clear-search" aria-label="清空搜索" onClick={() => { setQuery(''); searchInput.current?.focus(); }}><Icon name="close" size={14} /></button> : <kbd>/</kbd>}
      </div>
      <button className={'icon-button help-button' + (help ? ' is-active' : '')} aria-label="操作说明" aria-pressed={help} onClick={() => { setHelp(!help); setSearchOpen(false); }}><Icon name="info" /></button>
      {searchOpen && <div className="search-results surface"><div className="results-title"><span>{query ? '搜索结果' : '探索元件'}</span><span>{found.length} 项</span></div>
        {found.length ? found.map(p => <button key={p.id} className="search-result" onClick={() => select(p.id)}><span className="result-ref">{p.ref}</span><span>{p.name}<small>{categories.find(c => c.id === p.category)?.name}</small></span><Icon name="arrow" size={14} /></button>) : <p className="empty-results">没有找到相关元件，试试 MCU、晶振或 USB。</p>}
        <div className="search-hint"><kbd>Enter</kbd> 选择首个结果 <kbd>Esc</kbd> 关闭</div></div>}
    </div>
    {searchOpen && <button className="search-dismiss" tabIndex={-1} aria-label="关闭搜索结果" onClick={() => setSearchOpen(false)} />}
    <aside className={'systems surface' + (mobilePanel ? ' mobile-open' : '')} id="systems-panel" aria-label="元件系统">
      <div className="panel-heading"><h2>元件系统</h2><span className="count-badge">7</span></div>
      <div className="presets" aria-label="显示预设">{([['all', '全部'], ['core', '核心系统'], ['io', '接口']] as const).map(([id, text]) => <button key={id} onClick={() => preset(id)} aria-pressed={presetName === id} className={presetName === id ? 'active' : ''}>{text}</button>)}</div>
      <div className="system-list">{categories.map(category => {
        const children = parts.filter(p => p.category === category.id);
        return <div className={'system-item' + (!visible[category.id] ? ' is-hidden' : '')} key={category.id}><div className="system-row">
          <button className="system-name bare" aria-expanded={expanded === category.id} onClick={() => setExpanded(expanded === category.id ? null : category.id)}><span className="category-dot" style={{ background: category.color }} /><span>{category.name}</span><span className={'tree-chevron' + (expanded === category.id ? ' open' : '')}><Icon name="chevron" size={11} /></span></button>
          <span className="system-count">{children.length}</span><button role="switch" className="switch" aria-checked={visible[category.id]} aria-label={'显示' + category.name} onClick={() => toggleCategory(category.id)}><span /></button></div>
          {expanded === category.id && <div className="part-tree">{children.map(p => <button key={p.id} className={selected === p.id ? 'selected' : ''} onClick={() => select(p.id)}><span>{p.ref}</span>{p.name}</button>)}</div>}</div>;
      })}</div>
      <div className="panel-footer"><span role="status" aria-live="polite" aria-atomic="true">{visibleParts.length} 个元件可见</span><button className="bare" onClick={() => {
        const hide = categories.some(c => visible[c.id]); setVisible(Object.fromEntries(categories.map(c => [c.id, !hide])) as Record<CategoryId, boolean>); setSelected(null); setIsolated(false);
      }}>{categories.some(c => visible[c.id]) ? '隐藏全部' : '显示全部'}</button></div>
    </aside>
    <nav className="view-tools surface" aria-label="模型视角">{viewOptions.map(([view, symbol, title], index) => <button key={view} title={title + '（' + (index + 1) + '）'} aria-label={title} aria-pressed={cameraAction.view === view && !cameraAction.focus} className={cameraAction.view === view && !cameraAction.focus ? 'active' : ''} onClick={() => changeView(view)}>{symbol}</button>)}
      <span className="tool-divider" /><button title="自动旋转" aria-label={rotating ? '暂停旋转' : '自动旋转'} aria-pressed={rotating} disabled={reducedMotion} className={rotating ? 'active' : ''} onClick={() => setRotating(!rotating)}><Icon name={rotating ? 'pause' : 'rotate'} size={19} /></button>
      <button title="元件标注" aria-label="元件标注" aria-pressed={labels} className={labels ? 'active' : ''} onClick={() => setLabels(!labels)}><Icon name="label" size={18} /></button>
      <button title="放大" aria-label="放大模型" onClick={() => setCameraAction(p => ({ view: p.view, sequence: p.sequence + 1, zoom: 0.8 }))}><Icon name="plus" size={18} /></button>
      <button title="缩小" aria-label="缩小模型" onClick={() => setCameraAction(p => ({ view: p.view, sequence: p.sequence + 1, zoom: 1.25 }))}><Icon name="minus" size={18} /></button>
      <span className="tool-divider" /><button title="重置全部（R）" aria-label="重置全部" onClick={reset}><Icon name="reset" size={18} /></button>
    </nav>
    {selectedPart && <aside className="detail surface" aria-label="元件详情"><div className="detail-topline"><span><i style={{ background: categories.find(c => c.id === selectedPart.category)?.color }} />{categories.find(c => c.id === selectedPart.category)?.name}</span><button className="bare close-detail" aria-label="关闭元件详情" onClick={() => { setSelected(null); setIsolated(false); }}><Icon name="close" size={16} /></button></div>
      <span className="component-ref">{selectedPart.ref}</span><h2>{selectedPart.name}</h2><p className="detail-description">{selectedPart.description}</p>
      <dl>{selectedPart.specs.map(([key, value]) => <div key={key}><dt>{key}</dt><dd>{value}</dd></div>)}</dl>
      <div className="detail-actions"><button className={isolated ? 'active' : ''} aria-pressed={isolated} onClick={() => {
        setIsolated(!isolated); if (!isolated) setCameraAction(p => ({ view: p.view, sequence: p.sequence + 1, focus: selectedPart.id })); else changeView('overview');
      }}><Icon name={isolated ? 'layers' : 'isolate'} size={16} />{isolated ? '显示整体' : '单独查看'}</button>
      <button onClick={() => { setRotating(false); setCameraAction(p => ({ view: p.view, sequence: p.sequence + 1, focus: selectedPart.id })); }}><Icon name="focus" size={16} />聚焦</button></div></aside>}
    {help && <aside className="help-card surface" aria-label="操作说明"><div className="panel-heading"><h2>从整体，到每一个元件</h2><button className="bare" aria-label="关闭操作说明" onClick={() => setHelp(false)}><Icon name="close" size={16} /></button></div>
      <p>拖动旋转，滚轮或双指缩放。点击板上的元件查看说明，也可以通过搜索或左侧分类选择。</p><ul><li>底部滑块：展开 / 组装模型</li><li>数字键 1—5：切换视角</li><li>/：搜索元件　R：恢复初始状态</li></ul>
      <p className="model-note">这是按真实比例制作的外观模型，走线与布局用于展示，不提供电路仿真或生产文件。</p><a href={modelUrl} download><Icon name="download" size={15} />下载交互模型 · GLB</a></aside>}
    <section className="explosion surface" aria-label="爆炸展开控制"><div className="explode-main"><div className="explode-heading"><label htmlFor="explode">展开电路板</label><output htmlFor="explode">{Math.round(explode * 100)} <small>%</small></output></div>
      <input id="explode" aria-label="展开程度" aria-valuetext={Math.round(explode * 100) + '% 展开'} type="range" min="0" max="100" value={Math.round(explode * 100)} onChange={e => setExplode(Number(e.target.value) / 100)} style={{ '--progress': explode * 100 + '%' } as CSSProperties} /><div className="range-captions"><span>完整组装</span><span>探索每个元件</span></div></div>
      <button className="explode-reset bare" aria-label="收回展开的元件" onClick={() => setExplode(0)}><Icon name="reset" size={18} /><span>复原</span></button></section>
    <button className={'mobile-systems-button surface' + (mobilePanel ? ' active' : '')} aria-label="展开元件系统面板" aria-expanded={mobilePanel} onClick={() => setMobilePanel(!mobilePanel)}><Icon name="layers" />元件系统<span>{visibleParts.length}</span></button>
    <footer className="atlas-footer"><p>拖动旋转<span>·</span>滚轮缩放<span>·</span>点击探索</p><div><span className={'ready-status' + (ready ? ' loaded' : '')}><i />{ready ? '模型已就绪' : '模型载入中'}</span><a href="https://github.com/vinaysingh-05/human-atlas" target="_blank" rel="noreferrer">灵感来源<Icon name="arrow" size={13} /></a></div></footer>
  </main>;
}
