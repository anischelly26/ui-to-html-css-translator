import { useEffect, useRef, useState } from 'react';
import { Columns2, Code2, Eye, Image, Laptop, Layers2, Smartphone, Tablet } from 'lucide-react';
import type { Project } from '../types';
import { localDocument } from '../sample';

export type View = 'preview' | 'source' | 'compare' | 'code';
export type Device = 'desktop' | 'tablet' | 'mobile';
const widths = { desktop: 1080, tablet: 768, mobile: 390 };

interface Props {
  project: Project; document: string; selected: string | null; onSelect: (id: string) => void;
  view: View; onView: (view: View) => void; device: Device; onDevice: (device: Device) => void;
  overlay: boolean; onOverlay: () => void; children: React.ReactNode;
}

function Surface({ project, document, selected, onSelect, source, width, overlay }: {
  project: Project; document: string; selected: string | null; onSelect: (id: string) => void;
  source: boolean; width: number; overlay: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [available, setAvailable] = useState(800);
  useEffect(() => {
    const observer = new ResizeObserver(([entry]) => setAvailable(entry.contentRect.width));
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);
  const scale = Math.min(1, Math.max(1, available) / width);
  const image = project.result.image;
  const height = source && project.source ? width * image.height / image.width : 760;
  const selectedStyle = selected ? `<style>[data-element-id="${selected.replace(/[^a-zA-Z0-9_-]/g, '')}"] { outline: 2px solid #729b33; outline-offset: 5px; }</style>` : '';
  const frameDocument = source ? localDocument(project.baseline) : document;
  return <div ref={ref} className="surface-measure">
    <div className="surface-scaled" style={{ width: width * scale, height: height * scale }}>
      <div className="surface-inner" style={{ width, height, transform: `scale(${scale})` }}>
        {source && project.source ? <>
          <img className="source-image" src={project.source} alt="Uploaded screenshot for reconstruction" width={width} height={height} />
          {overlay ? <div className="detection-overlay" aria-label="Detected screenshot elements">
            {project.result.elements.map(element => <button key={element.id}
              className={`detection-box ${selected === element.id ? 'selected' : ''} ${element.confidence !== null && element.confidence < 65 ? 'uncertain' : ''}`}
              onClick={() => onSelect(element.id)} aria-label={`Inspect ${element.kind}: ${element.text}`} title={element.text}
              style={{ left: `${element.bounds.x / image.width * 100}%`, top: `${element.bounds.y / image.height * 100}%`,
                width: `${element.bounds.width / image.width * 100}%`, height: `${element.bounds.height / image.height * 100}%` }}>
              <span>{element.kind}</span>
            </button>)}
          </div> : null}
        </> : <iframe title={source ? 'Original sample interface' : 'Reconstructed interface preview'} sandbox=""
          referrerPolicy="no-referrer" srcDoc={frameDocument.replace('</head>', `${selectedStyle}</head>`)} />}
      </div>
    </div>
  </div>;
}

export function Canvas(props: Props) {
  const { project, view, onView, device, onDevice, overlay, onOverlay } = props;
  const empty = !project.code.html.trim();
  return <section className="canvas-panel" aria-label="Interface workspace">
    <div className="canvas-toolbar">
      <div className="canvas-tabs" role="tablist" aria-label="Workspace view">
        {([{ id: 'preview', label: 'Preview', icon: Eye }, { id: 'source', label: 'Source', icon: Image },
          { id: 'compare', label: 'Compare', icon: Columns2 }, { id: 'code', label: 'Code', icon: Code2 }] as const)
          .map(item => <button key={item.id} role="tab" aria-selected={view === item.id} aria-controls="workspace-content"
            className={view === item.id ? 'active' : ''} onClick={() => onView(item.id)}>
            <item.icon size={15} /><span>{item.label}</span></button>)}
      </div>
      <div className="device-switch" aria-label="Preview width">
        {([{ id: 'desktop', icon: Laptop, label: 'Desktop' }, { id: 'tablet', icon: Tablet, label: 'Tablet' },
          { id: 'mobile', icon: Smartphone, label: 'Mobile' }] as const).map(item =>
          <button key={item.id} title={`${item.label} · ${widths[item.id]}px`} aria-label={`${item.label} preview`}
            aria-pressed={device === item.id} className={device === item.id ? 'active' : ''} onClick={() => onDevice(item.id)}>
            <item.icon size={17} /></button>)}
      </div>
    </div>
    <div id="workspace-content" role="tabpanel" className={`canvas-content ${view === 'code' ? 'code-mode' : ''}`}>
      {view === 'code' ? props.children : <>
        <div className="canvas-meta"><span><span className="status-dot" />{project.sample ? 'EDITABLE EXAMPLE' : view === 'source' ? 'SOURCE IMAGE' : 'LIVE WORKSPACE'}</span>
          <span>{widths[device]} PX <span className="meta-separator">/</span> {device.toUpperCase()}</span></div>
        {empty && view !== 'source' ? <div className="preview-empty"><Layers2 size={32} /><h3>Your interface starts here.</h3>
          <p>Generate from your screenshot to bring the preview to life.</p><button className="button subtle" onClick={() => onView('source')}>Inspect source</button></div>
          : view === 'compare' ? <div className="compare-surfaces">
            <div><div className="surface-label">01 <span>{project.sample ? 'Original example' : 'Your screenshot'}</span></div>
              <Surface {...props} source width={widths[device]} /></div>
            <div><div className="surface-label">02 <span>Reconstructed interface</span></div>
              <Surface {...props} source={false} width={widths[device]} /></div>
          </div> : <Surface {...props} source={view === 'source'} width={widths[device]} />}
        <div className="canvas-bottom"><span><span className="tiny-cross">+</span> {project.sample ? 'An example to explore. Upload your own when ready.' : 'Your screenshot. Your code. Your browser.'}</span>
          {view === 'source' && project.source ? <button className={overlay ? 'active' : ''} aria-pressed={overlay} onClick={onOverlay}><Layers2 size={13} />Detection overlay</button>
            : <span>Responsive canvas</span>}</div>
      </>}
    </div>
  </section>;
}
