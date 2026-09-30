import { ArrowUpRight, Code2, RotateCcw } from 'lucide-react';
import { PORTFOLIO_URL, SOURCE_URL } from '../config';
import { Dialog } from './Dialog';

export function DemoNotice({ onEdit, onExample }: { onEdit: () => void; onExample: () => void }) {
  return <section className="demo-notice" aria-label="Interactive demo information">
    <div><span className="mini-label">TRY FORM · NO SIGN-IN</span><h2>Interactive demo</h2>
      <p>Edit HTML and CSS, test three preview widths, save a workspace and download a protected HTML preview.</p>
      <p className="field-note">Screenshot OCR, element correction, AI generation and ZIP export require the full Python studio.</p></div>
    <div className="demo-actions"><button className="button generate-button" onClick={onEdit}><Code2 size={15} />Edit the example</button>
      <button className="button subtle" onClick={onExample}><RotateCcw size={15} />Load example</button>
      <a href={`${PORTFOLIO_URL}#missions`}>← Back to portfolio</a></div>
  </section>;
}

export function DemoInfo({ onClose }: { onClose: () => void }) {
  return <Dialog title="Explore FORM in your browser." onClose={onClose}><div className="settings-content">
    <p className="dialog-description">This is the actual studio interface in browser demo mode. Your edits, uploaded images and saved workspaces stay on this device. No processing server or paid API is contacted.</p>
    <div className="demo-capabilities"><h3>Available here</h3><p>HTML/CSS editing, source comparison, desktop/tablet/mobile previews, light/dark themes, autosave, workspace backup/import and protected HTML downloads.</p>
      <h3>Available in the full app</h3><p>Screenshot OCR, detected-element corrections, optional Ollama vision generation and sanitized HTML/CSS ZIP export run through the Python server.</p></div>
    <a className="button generate-button" href={`${SOURCE_URL}#quick-start`} target="_blank" rel="noopener noreferrer">Run the full studio<ArrowUpRight size={15} /></a>
    <p className="field-note">The sample is an editable example, not a live OCR result. Downloads contain a restricted preview document; scripts and external resources are disabled.</p>
  </div></Dialog>;
}
