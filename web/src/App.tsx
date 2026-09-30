import { useCallback, useEffect, useEffectEvent, useRef, useState } from 'react';
import { ArrowDownToLine, ArrowRight, ArrowUpRight, BookOpen, Check, ChevronRight, CircleAlert, Command,
  FileImage, FolderOpen, Grid2X2, ImagePlus, Loader2, Menu, Moon, Plus, Settings2, ShieldCheck, Sparkles,
  Sun, Trash2, Undo2, Upload, X, Zap } from 'lucide-react';
import { api, download, setAccessKey, wait } from './api';
import { Canvas } from './components/Canvas';
import type { Device, View } from './components/Canvas';
import { Dialog } from './components/Dialog';
import { DemoInfo, DemoNotice } from './components/DemoNotice';
import { Editor } from './components/Editor';
import { Inspector } from './components/Inspector';
import { sampleProject } from './sample';
import { useWorkspace } from './hooks/useWorkspace';
import { usePreview } from './hooks/usePreview';
import { isProject, workspaceName } from './workspace';
import type { Code, Element, Engine, Engines, Health, Job, Project } from './types';
import { IS_DEMO, SOURCE_URL } from './config';

const stages = ['queued', 'preparing', 'detecting', 'generating', 'reviewing'];
const stageLabels: Record<string, string> = { queued: 'Waiting for a processing slot', preparing: 'Preparing your screenshot',
  detecting: 'Reading text and structure', generating: 'Building your interface', reviewing: 'Preparing your workspace' };

export default function App() {
  const [toast, setToast] = useState<{ message: string; undo?: () => Promise<void> } | null>(null);
  const notify = useCallback((message: string) => setToast({ message }), []);
  const workspace = useWorkspace(notify);
  const { project, saved, saveStatus } = workspace;
  const [view, setView] = useState<View>('preview');
  const [device, setDevice] = useState<Device>('desktop');
  const [selected, setSelected] = useState<string | null>(null);
  const [overlay, setOverlay] = useState(true);
  const [theme, setTheme] = useState(() => { try { return localStorage.getItem('form-theme') === 'dark' ? 'dark' : 'light'; } catch { return 'light'; } });
  const [health, setHealth] = useState<Health | null>(null);
  const [engines, setEngines] = useState<Engines | null>(null);
  const [engine, setEngine] = useState<Engine>('local');
  const [job, setJob] = useState<Job | null>(null);
  const [busy, setBusy] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState('');
  const [dialog, setDialog] = useState<'guide' | 'projects' | 'settings' | null>(null);
  const [mobileMenu, setMobileMenu] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [keyInput, setKeyInput] = useState('');
  const fileInput = useRef<HTMLInputElement>(null);
  const workspaceInput = useRef<HTMLInputElement>(null);
  const file = useRef<File | null>(null);
  const controller = useRef<AbortController | null>(null);
  const jobId = useRef<string | null>(null);
  const operation = useRef(false);
  const connectionRevision = useRef(0);
  const preview = usePreview(project.code, engines);

  const beginOperation = useCallback(() => {
    if (operation.current) return false;
    operation.current = true; setBusy(true); return true;
  }, []);
  function endOperation() { operation.current = false; setBusy(false); }

  const connect = useCallback(async () => {
    if (IS_DEMO) return false;
    const revision = ++connectionRevision.current;
    const results = await Promise.allSettled([api.health(), api.engines()]);
    if (revision !== connectionRevision.current) return false;
    setHealth(results[0].status === 'fulfilled' ? results[0].value : null);
    setEngines(results[1].status === 'fulfilled' ? results[1].value : null);
    if (results[1].status === 'fulfilled') return true;
    return false;
  }, []);

  useEffect(() => {
    void connect();
    return () => { connectionRevision.current++; controller.current?.abort(); };
  }, [connect]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try { localStorage.setItem('form-theme', theme); } catch { /* Theme is still applied for this session. */ }
  }, [theme]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 4500);
    return () => window.clearTimeout(timer);
  }, [toast]);

  async function upload(image: File) {
    if (operation.current) { notify('Finish or cancel the current operation before uploading another image.'); return; }
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(image.type)) { setError('Choose a PNG, JPEG, or WebP screenshot.'); return; }
    if (image.size > 8 * 1024 * 1024) { setError('Choose a screenshot smaller than 8 MB.'); return; }
    if (!beginOperation()) return;
    try {
      const bitmap = await createImageBitmap(image);
      if (bitmap.width * bitmap.height > 12_000_000) { bitmap.close(); throw new Error('Choose a screenshot with fewer than 12 million pixels.'); }
      const scale = Math.min(1, 2400 / Math.max(bitmap.width, bitmap.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(bitmap.width * scale); canvas.height = Math.round(bitmap.height * scale);
      const context = canvas.getContext('2d');
      if (!context) { bitmap.close(); throw new Error('This browser could not read the screenshot.'); }
      context.fillStyle = '#ffffff'; context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height); bitmap.close();
      const source = canvas.toDataURL('image/webp', .92);
      file.current = image;
      const code = { html: '', css: '' };
      workspace.open({ version: 1, id: crypto.randomUUID(), name: (image.name.replace(/\.[^.]+$/, '') || 'Untitled screenshot').slice(0, 80),
        updated: Date.now(), source, sample: false, code, baseline: code,
        result: { code, elements: [], image: { width: canvas.width, height: canvas.height, background: '#ffffff' },
          engine: 'local', duration_ms: 0, warnings: [], palette: [] } }, true);
      setSelected(null); setError(''); setView('source'); setDialog(null); setMobileMenu(false);
      notify(IS_DEMO ? 'Screenshot saved in this browser. OCR processing requires the full Python studio.' : 'Screenshot ready. Choose an engine and generate your interface.');
    } catch (error) { setError(error instanceof Error ? error.message : 'This image could not be opened.'); }
    finally { endOperation(); }
  }

  const paste = useEffectEvent((event: ClipboardEvent) => {
      const image = [...(event.clipboardData?.items ?? [])].find(item => item.type.startsWith('image/'))?.getAsFile();
      if (image && !dialog && !busy) { event.preventDefault(); void upload(image); }
  });
  const keys = useEffectEvent((event: KeyboardEvent) => {
      if (event.key === 'Escape' && mobileMenu) { setMobileMenu(false); return; }
      const tag = (event.target as HTMLElement)?.tagName;
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(tag) || dialog) return;
      if (event.key === '/') { event.preventDefault(); document.querySelector<HTMLInputElement>('[aria-label="Search detected elements"]')?.focus(); }
      if ((event.ctrlKey || event.metaKey) && event.key === 'o') { event.preventDefault(); fileInput.current?.click(); }
  });
  useEffect(() => {
    const onPaste = (event: ClipboardEvent) => paste(event);
    const onKey = (event: KeyboardEvent) => keys(event);
    document.addEventListener('paste', onPaste); document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('paste', onPaste); document.removeEventListener('keydown', onKey); };
  }, []);

  async function generate() {
    if (!project.source || !beginOperation()) return;
    const snapshot = project;
    const abort = new AbortController(); controller.current = abort; jobId.current = null;
    setBusy(true); setError(''); setJob({ id: '', status: 'queued', progress: 0, error: null, result: null });
    try {
      let input: Blob;
      if (file.current) input = file.current;
      else if (/^data:image\/(png|jpeg|webp);base64,/.test(snapshot.source!)) input = await (await fetch(snapshot.source!)).blob();
      else throw new Error('The saved screenshot could not be read. Upload it again.');
      const submitted = await api.submit(input, engine, abort.signal); jobId.current = submitted.id;
      const deadline = Date.now() + 180_000;
      while (!abort.signal.aborted) {
        if (Date.now() > deadline) { void api.cancel(submitted.id).catch(() => {}); throw new Error('The conversion timed out. Try a smaller screenshot or local reconstruction.'); }
        const update = await api.job(submitted.id, abort.signal); setJob(update);
        if (update.status === 'failed') throw new Error(update.error || 'Conversion failed. Try a different screenshot.');
        if (update.status === 'cancelled') throw new DOMException('Aborted', 'AbortError');
        if (update.status === 'complete' && update.result) {
          const result = update.result;
          workspace.update(value => ({ ...value, result, code: result.code, baseline: result.code }), true);
          setView('compare'); setSelected(null);
          notify(`Reconstructed ${result.elements.length} elements. Review the result before exporting.`);
          break;
        }
        await wait(550, abort.signal);
      }
    } catch (error) {
      if (!(error instanceof DOMException && error.name === 'AbortError')) setError(error instanceof Error ? error.message : 'The conversion could not finish.');
    } finally { controller.current = null; jobId.current = null; endOperation(); setJob(null); }
  }

  function cancel() {
    controller.current?.abort();
    if (jobId.current) void api.cancel(jobId.current).catch(() => notify('The server may finish its current processing step before cancelling.'));
    notify('Conversion cancelled. Your workspace is unchanged.');
  }

  function changeCode(code: Code) {
    workspace.update(value => ({ ...value, code }));
  }

  async function apply(element: Element) {
    if (!beginOperation()) return;
    setError('');
    try {
      const elements = project.result.elements.map(value => value.id === element.id ? element : value);
      const code = await api.regenerate(elements, project.result.image);
      workspace.update(value => ({ ...value, code, baseline: code, result: { ...value.result, code, elements } }), true);
      setView('preview'); notify('Correction applied. Undo restores the previous code and elements.');
    } catch (error) { setError(error instanceof Error ? error.message : 'This correction could not be applied.'); }
    finally { endOperation(); }
  }

  async function exportCode() {
    if (IS_DEMO) {
      download(new Blob([preview.document], { type: 'text/html;charset=utf-8' }), 'form-preview.html');
      notify('Protected HTML preview downloaded. Use the full studio for HTML/CSS ZIP export.');
      return;
    }
    setExporting(true); setError('');
    try { download(await api.export(project.code, workspaceName(project.name)), 'form-interface.zip'); notify('Your HTML and CSS export is ready.'); }
    catch (error) { setError(error instanceof Error ? error.message : 'Export failed. Check the server connection.'); }
    finally { setExporting(false); }
  }

  function openProject(item: Project) {
    if (operation.current) { notify('Finish or cancel the current operation before switching workspaces.'); return; }
    workspace.open(item); file.current = null; setSelected(null); setView(item.code.html ? 'preview' : 'source');
    setError(''); setDialog(null); setMobileMenu(false);
  }

  async function backupWorkspace() {
    download(new Blob([JSON.stringify(project, null, 2)], { type: 'application/json' }), 'form-workspace.json');
    notify('Workspace backup downloaded. Keep it with your source screenshot.');
  }

  async function importWorkspace(input: File) {
    if (!beginOperation()) return;
    try {
      if (input.size > 13_000_000) throw new Error('This workspace backup is too large.');
      const restored: unknown = JSON.parse(await input.text());
      if (!isProject(restored)) throw new Error('This is not a valid FORM workspace backup.');
      workspace.open({ ...restored, id: crypto.randomUUID(), updated: Date.now() }, true);
      file.current = null; setSelected(null); setView(restored.code.html ? 'preview' : 'source');
      setError(''); setDialog(null); setMobileMenu(false);
      notify('Workspace imported. Your original saved copies are unchanged.');
    } catch (error) { setError(error instanceof Error ? error.message : 'This workspace backup could not be read.'); }
    finally { endOperation(); }
  }

  const confidenceValues = project.result.elements.flatMap(element => element.confidence === null ? [] : [element.confidence]);
  const confidence = confidenceValues.length ? Math.round(confidenceValues.reduce((a, b) => a + b, 0) / confidenceValues.length) : null;
  const activeStage = job ? stages.indexOf(job.status) : -1;

  return <div className={`app-shell ${mobileMenu ? 'menu-open' : ''}`}
    onDragOver={event => { if (event.dataTransfer.types.includes('Files')) { event.preventDefault(); setDragging(true); } }}
    onDragLeave={event => { if (!event.currentTarget.contains(event.relatedTarget as Node)) setDragging(false); }}
    onDrop={event => { event.preventDefault(); setDragging(false); if (event.dataTransfer.files.length) void upload(event.dataTransfer.files[0]); }}>
    <a className="skip-link" href="#main-workspace">Skip to workspace</a>
    <input ref={fileInput} type="file" accept="image/png,image/jpeg,image/webp" className="hidden-input" aria-label="Upload screenshot"
      onChange={event => { const image = event.target.files?.[0]; if (image) void upload(image); event.target.value = ''; }} />
    <input ref={workspaceInput} type="file" accept="application/json,.json" className="hidden-input" aria-label="Import workspace backup"
      onChange={event => { const input = event.target.files?.[0]; if (input) void importWorkspace(input); event.target.value = ''; }} />
    {mobileMenu ? <button className="sidebar-backdrop" aria-label="Close navigation" onClick={() => setMobileMenu(false)} /> : null}
    <aside className="sidebar" aria-label="Main navigation">
      <button className="brand-lockup" onClick={() => openProject(sampleProject())} aria-label="FORM home"><span className="brand-mark"><Command size={22} /></span><span>form<span className="brand-period">.</span></span><span className="brand-beta">STUDIO</span></button>
      <div className="workspace-switch"><span className="workspace-avatar">AC</span><div><strong>Creative workspace</strong><span>Vision → code</span></div></div>
      <span className="nav-section">WORKSPACE</span>
      <nav className="main-nav"><button className="active" onClick={() => { setDialog(null); setMobileMenu(false); }}><Grid2X2 size={18} />Design studio<span className="nav-current" /></button>
        <button onClick={() => setDialog('projects')}><FolderOpen size={18} />My workspaces<span className="nav-count">{saved.length}</span></button>
        <button onClick={() => setDialog('guide')}><BookOpen size={18} />Quick guide<ArrowUpRight size={13} /></button></nav>
      <div className="recent-heading"><span className="nav-section">RECENT</span><button aria-label="Upload a new screenshot" onClick={() => fileInput.current?.click()}><Plus size={15} /></button></div>
      <div className="recent-projects">{saved.length ? saved.slice(0, 4).map(item => <button className={item.id === project.id ? 'current' : ''} key={item.id} onClick={() => openProject(item)}><FileImage size={14} /><span>{item.name}</span></button>)
        : <button className="current" onClick={() => openProject(sampleProject())}><FileImage size={14} /><span>Orbit — sample workspace</span></button>}</div>
      <div className="sidebar-spacer" />
      <div className="sidebar-callout"><span className="callout-icon"><Sparkles size={17} /></span><h3>From pixels<br />to possibilities.</h3><p>Give your next idea<br />a head start.</p><button onClick={() => { if (IS_DEMO) { setView('code'); setMobileMenu(false); } else fileInput.current?.click(); }}>{IS_DEMO ? 'Make the example yours' : 'Start from a screenshot'}<ArrowRight size={15} /></button></div>
      <button className="connection" onClick={() => setDialog('settings')}><span className={`status-dot ${health || IS_DEMO ? '' : 'offline'}`} /><span>{IS_DEMO ? 'Browser demo · about processing' : health ? 'Processing server connected' : 'Explore offline'}</span><Settings2 size={14} /></button>
      <div className="sidebar-user"><span className="user-avatar">AC</span><div><strong>Anis Chelli</strong><span>Personal workspace</span></div><button aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} theme`} title="Change theme" onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}>{theme === 'light' ? <Moon size={17} /> : <Sun size={17} />}</button></div>
    </aside>

    <main className="main" id="main-workspace">
      <header className="topbar"><div className="breadcrumb"><button className="menu-toggle" aria-label="Open navigation" onClick={() => setMobileMenu(true)}><Menu size={19} /></button><span>Workspace</span><ChevronRight size={13} /><strong>Design studio</strong></div>
        <div className="topbar-right"><span className="local-pill"><ShieldCheck size={13} />{IS_DEMO ? 'Browser demo' : 'Local-first'}</span><button className="icon-button" aria-label={IS_DEMO ? 'Demo information' : 'Connection settings'} onClick={() => setDialog('settings')}><Settings2 size={17} /></button></div></header>
      <div className="main-content">
        {IS_DEMO ? <DemoNotice onEdit={() => setView('code')} onExample={() => openProject({ ...sampleProject(), id: crypto.randomUUID() })} /> : null}
        <section className="intro"><div><div className="eyebrow"><span />VISION TO CODE, WITHOUT THE GUESSWORK</div><h1>Make pixels programmable<span>.</span></h1><p>{IS_DEMO ? 'Explore the studio. Make the example your own. Keep your work in this browser.' : 'Your screenshot, transformed into a starting point you can actually build on.'}</p></div>
          <button className="button upload-button" onClick={() => fileInput.current?.click()} disabled={busy}><Plus size={17} />New screenshot</button></section>
        <div className="workflow-strip"><span><span className="step-bubble">1</span>Bring a screenshot</span><ChevronRight size={13} /><span><span className="step-bubble">2</span>Understand the structure</span><ChevronRight size={13} /><span><span className="step-bubble">3</span>Make it your own</span><span className="workflow-hint">Thoughtful tools. Better starting points.</span></div>

        <section className="project-bar" aria-label="Current workspace"><div className="project-title"><span className="project-file-icon"><FileImage size={19} /></span><div><input aria-label="Workspace name" value={project.name} maxLength={80} disabled={busy}
          onChange={event => workspace.update(value => ({ ...value, name: event.target.value }))}
          onBlur={() => { if (!project.name.trim()) workspace.update(value => ({ ...value, name: workspaceName(value.name) })); }} /><span><span className="save-dot" /><span role="status" aria-live="polite">{saveStatus}</span>{project.sample ? <span className="sample-badge">SAMPLE</span> : null}</span></div></div>
          <div className="project-actions"><button className="icon-button" aria-label="Undo last reconstruction change" disabled={!workspace.canUndo || busy} onClick={() => { workspace.undo(); notify('Previous reconstruction and elements restored.'); }} title="Undo"><Undo2 size={17} /></button>
            <button className="button subtle" disabled={!project.code.html || exporting || busy} onClick={() => void exportCode()}>{exporting ? <Loader2 className="spinning" size={15} /> : <ArrowDownToLine size={15} />}{IS_DEMO ? 'Download HTML' : 'Export code'}</button></div></section>

        {error ? <div className="error-banner" role="alert"><CircleAlert size={18} /><span>{error}</span><button aria-label="Dismiss error" onClick={() => setError('')}><X size={16} /></button></div> : null}

        <div className="studio-grid"><div className="workspace-column">
          <Canvas project={project} document={preview.document} selected={selected} onSelect={setSelected} view={view} onView={setView}
            device={device} onDevice={setDevice} overlay={overlay} onOverlay={() => setOverlay(value => !value)}>
            <Editor code={project.code} disabled={busy} onChange={changeCode} onReset={() => { workspace.update(value => ({ ...value, code: { ...value.baseline } }), true); notify('Generated code restored.'); }} notify={notify} />
          </Canvas>
          {IS_DEMO ? <div className="generation-bar"><div className="engine-choice"><span className="engine-icon"><Zap size={17} /></span><div className="demo-engine"><span>SCREENSHOT PROCESSING</span><strong>Available in the full Python studio</strong></div></div>
            <a className="button generate-button" href={`${SOURCE_URL}#quick-start`} target="_blank" rel="noopener noreferrer">Run full studio<ArrowUpRight size={16} /></a></div>
          : <div className="generation-bar"><div className="engine-choice"><span className="engine-icon"><Zap size={17} /></span><label><span>RECONSTRUCTION ENGINE</span><select aria-label="Reconstruction engine" value={engine} disabled={busy} onChange={event => setEngine(event.target.value as Engine)}><option value="local">Local vision + OCR</option><option value="ollama" disabled={!engines?.ollama}>{engines?.ollama ? `Vision model · ${engines.model}` : 'Vision model · connect Ollama'}</option></select></label></div>
            {health && !engines ? <button className="button generate-button" onClick={() => setDialog('settings')}><Settings2 size={16} />Connect processing<ArrowRight size={16} /></button>
              : <button className="button generate-button" disabled={!project.source || busy || !health || (engine === 'local' && !engines?.local)} onClick={() => void generate()}><Sparkles size={16} />Generate interface<ArrowUpRight size={16} /></button>}</div>}
          {job ? <div className="progress-panel" role="status" aria-live="polite"><div><Loader2 size={17} className="spinning" /><strong>{stageLabels[job.status] || 'Processing screenshot'}</strong><button onClick={cancel}>Cancel</button></div><div className="progress-track"><span style={{ width: `${job.progress}%` }} /></div><div className="progress-stages">{['Prepare', 'Detect', 'Generate', 'Review'].map((label, i) => <span key={label} className={activeStage >= i + 1 ? 'done' : ''}>{label}</span>)}</div></div> : null}
          <div className="metric-row"><div><span className="metric-icon"><Grid2X2 size={15} /></span><span>Elements<strong>{project.result.elements.length}<small>{project.sample ? 'example layers' : 'detected'}</small></strong></span></div>
            <div><span className="metric-icon"><TypeConfidence /></span><span>OCR confidence<strong>{confidence !== null ? `${confidence}%` : '—'}<small>{confidence !== null ? 'mean text confidence' : 'no OCR run'}</small></strong></span></div>
            <div><span className="metric-icon"><Zap size={15} /></span><span>Processing time<strong>{project.result.duration_ms ? `${(project.result.duration_ms / 1000).toFixed(1)}s` : '—'}<small>{project.result.duration_ms ? project.result.engine === 'local' ? 'local reconstruction' : 'vision model' : 'not measured'}</small></strong></span></div></div>
          {project.result.warnings.length && !project.sample ? <details className="warnings"><summary><CircleAlert size={14} />Review notes<span>{project.result.warnings.length}</span></summary><ul>{project.result.warnings.map(note => <li key={note}>{note}</li>)}</ul></details> : null}
        </div><Inspector project={project} selected={selected} onSelect={id => { setSelected(id); if (project.source) setView('source'); }} onApply={apply} busy={busy} readOnly={IS_DEMO} /></div>
        <footer className="main-footer"><span>FORM STUDIO <span>© {new Date().getFullYear()}</span></span><span><span className="status-dot" />{preview.status}<span className="footer-dot">·</span>Built from the VERMEG experiment</span></footer>
      </div>
    </main>

    {dragging ? <div className="drag-overlay"><ImagePlus size={42} /><h2>Drop your next idea here.</h2><p>PNG, JPEG, or WebP · up to 8 MB</p></div> : null}
    {toast ? <div className="toast" role="status"><Check size={17} /><span>{toast.message}</span>{toast.undo ? <button onClick={() => {
      void toast.undo!().then(() => notify('Workspace restored.')).catch(error => notify(error.message));
    }}>Undo</button> : null}<button aria-label="Dismiss notification" onClick={() => setToast(null)}><X size={14} /></button></div> : null}
    {dialog === 'guide' ? <Dialog title="A better starting point, in three steps." onClose={() => setDialog(null)}><div className="guide-content">
      <div><span>01</span><h3>{IS_DEMO ? 'Explore the example.' : 'Bring your screenshot.'}</h3><p>{IS_DEMO ? 'The Orbit workspace is a labeled example. Open Code to change its HTML and CSS, or upload an image to inspect and save it locally.' : 'Upload, drop, or paste a PNG, JPEG, or WebP. Clear text and uncropped controls work best.'}</p></div>
      <div><span>02</span><h3>{IS_DEMO ? 'Review at three widths.' : 'Generate. Then look closely.'}</h3><p>{IS_DEMO ? 'Preview your code at desktop, tablet and mobile widths. Compare it with the original example; no OCR confidence or processing time is invented.' : 'Local reconstruction reads text and estimates rows. Optional Ollama vision can interpret more complex layouts. Inspect low-confidence text and correct component types.'}</p></div>
      <div><span>03</span><h3>Make it your own.</h3><p>Edit HTML and CSS, test three viewport widths, and export an inert standalone page. Generated interfaces are starting points that need your review.</p></div>
      <div className="guide-shortcuts"><kbd>⌘ / Ctrl + O</kbd>Upload<kbd>/</kbd>Find a layer<kbd>Paste</kbd>Image from clipboard</div>
      <button className="button generate-button" onClick={() => { setDialog(null); if (IS_DEMO) setView('code'); else fileInput.current?.click(); }}><Upload size={16} />{IS_DEMO ? 'Open code editor' : 'Bring a screenshot'}</button></div></Dialog> : null}
    {dialog === 'projects' ? <Dialog title="Your workspaces" onClose={() => setDialog(null)}><div className="projects-dialog"><p className="dialog-description">Saved in this browser. Export a backup to keep work outside this device.</p>
      {saved.length ? saved.map(item => <div className="saved-project" key={item.id}><button onClick={() => openProject(item)}><FileImage size={21} /><span><strong>{item.name || 'Untitled workspace'}</strong><small>{new Date(item.updated).toLocaleDateString()} · {item.result.elements.length} elements</small></span><ArrowUpRight size={16} /></button>
        <button className="icon-button" title="Remove saved copy; open workspace stays available" aria-label={`Remove saved copy of ${item.name}`} onClick={() => {
          void workspace.remove(item).then(() => setToast({ message: 'Saved copy removed. You can undo this removal.', undo: () => workspace.recover(item) })).catch(error => notify(error.message));
        }}><Trash2 size={16} /></button></div>) : <div className="projects-empty"><FolderOpen size={30} /><h3>A clean slate.</h3><p>Upload your first screenshot and your workspace will save here.</p></div>}
      <div className="backup-actions"><button className="button subtle" onClick={() => void backupWorkspace()}><ArrowDownToLine size={15} />Back up current workspace</button>
        <button className="button subtle" disabled={busy} onClick={() => workspaceInput.current?.click()}><Upload size={15} />Import backup</button></div></div></Dialog> : null}
    {dialog === 'settings' && IS_DEMO ? <DemoInfo onClose={() => setDialog(null)} /> : dialog === 'settings' ? <Dialog title="Your processing connection" onClose={() => setDialog(null)}><div className="settings-content"><p className="dialog-description">Screenshots are processed by your configured Python server. Workspaces stay in this browser.</p>
      <div className="connection-status"><span className={`status-dot ${health ? '' : 'offline'}`} /><strong>{health ? `Server connected · v${health.version}` : 'Processing server unavailable'}</strong></div>
      <label className="field-label">Server access key<input type="password" autoComplete="off" value={keyInput} placeholder={health?.access_key_required ? 'Enter the configured server key' : 'Optional for a local server'} onChange={event => setKeyInput(event.target.value)} /></label>
      <p className="field-note">Held in memory for this session. It is never saved with your workspace.</p>
      <button className="button generate-button" onClick={() => { setAccessKey(keyInput); void connect().then(ok => { notify(ok ? 'Processing connection refreshed.' : 'The server or key could not be verified.'); if (ok) setDialog(null); }); }}>Save and test connection<ArrowRight size={15} /></button>
      <div className="engine-status"><div><span>Local OCR</span><strong>{engines?.local ? 'Available' : 'Unavailable'}</strong></div><div><span>Ollama vision</span><strong>{engines?.ollama ? engines.model : 'Not connected'}</strong></div></div>
      <p className="field-note">To use the vision model, start Ollama and install the model configured on the server. No paid API is needed.</p></div></Dialog> : null}
  </div>;
}

function TypeConfidence() { return <ShieldCheck size={15} />; }
