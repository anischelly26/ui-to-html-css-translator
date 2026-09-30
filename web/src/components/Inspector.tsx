import { useEffect, useState } from 'react';
import { ArrowUpRight, ChevronDown, CircleAlert, Layers2, MousePointer2, Search, SlidersHorizontal, Type } from 'lucide-react';
import type { Element, Kind, Project } from '../types';

export function Inspector({ project, selected, onSelect, onApply, busy }: { project: Project; selected: string | null;
  onSelect: (id: string) => void; onApply: (element: Element) => Promise<void>; busy: boolean }) {
  const [filter, setFilter] = useState('');
  const [lowOnly, setLowOnly] = useState(false);
  const selectedElement = project.result.elements.find(element => element.id === selected);
  const [draft, setDraft] = useState<Element | undefined>(selectedElement);
  useEffect(() => setDraft(selectedElement), [selectedElement]);
  const elements = project.result.elements.filter(element => (!lowOnly || (element.confidence !== null && element.confidence < 65))
    && `${element.kind} ${element.text}`.toLowerCase().includes(filter.toLowerCase()));
  const uncertain = project.result.elements.filter(element => element.confidence !== null && element.confidence < 65).length;
  return <aside className="inspector" aria-label="Reconstruction inspector">
    <div className="inspector-title"><h2>Inspector</h2><SlidersHorizontal size={16} /></div>
    <div className="inspector-intro"><div><span className="mini-label">{project.sample ? 'EXAMPLE STRUCTURE' : 'DETECTED STRUCTURE'}</span><p>Every detail, in view.</p></div><span className="count-tag">{project.result.elements.length}</span></div>
    <label className="search-field"><Search size={14} /><input aria-label="Search detected elements" placeholder="Find an element…" value={filter} onChange={event => setFilter(event.target.value)} /><kbd>/</kbd></label>
    <div className="layers-heading"><span>ELEMENTS</span><button onClick={() => setLowOnly(value => !value)} aria-pressed={lowOnly}
      className={lowOnly ? 'active' : ''} title="Show elements with OCR confidence below 65%">{lowOnly ? 'Needs review' : 'All layers'}<ChevronDown size={12} /></button></div>
    <div className="element-list">
      {elements.length ? elements.map(element => <button className={`element-row ${selected === element.id ? 'active' : ''}`} key={element.id} onClick={() => onSelect(element.id)}>
        <span className="element-icon">{element.kind === 'button' ? <MousePointer2 size={14} /> : element.kind === 'container' ? <Layers2 size={14} /> : <Type size={14} />}</span>
        <span className="element-name"><strong>{element.text || 'Untitled element'}</strong><span>{element.kind}</span></span>
        {element.confidence !== null ? <span className={`confidence ${element.confidence < 65 ? 'low' : ''}`}>{Math.round(element.confidence)}%</span> : <span className="sample-layer">EX</span>}
      </button>) : <div className="layers-empty"><Layers2 size={22} /><p>{filter || lowOnly ? 'No matching elements.' : 'Your detected elements will appear here.'}</p></div>}
    </div>
    {draft ? <div className="element-properties">
      <div className="section-heading"><span>SELECTED ELEMENT</span><span className="selected-dot" /></div>
      <label className="field-label">Content<textarea value={draft.text} disabled={busy} onChange={event => setDraft({ ...draft, text: event.target.value })} rows={3} maxLength={3000} /></label>
      <label className="field-label">Component type<select value={draft.kind} disabled={busy} onChange={event => setDraft({ ...draft, kind: event.target.value as Kind })}>
        <option value="text">Text</option><option value="heading">Heading</option><option value="button">Button</option><option value="input">Input</option><option value="container">Container</option>
      </select></label>
      <div className="property-colors"><label className="field-label">Background<input aria-label="Element background" type="color" disabled={busy} value={draft.color} onChange={event => setDraft({ ...draft, color: event.target.value })} /></label>
        <label className="field-label">Text color<input aria-label="Element text color" type="color" disabled={busy} value={draft.foreground} onChange={event => setDraft({ ...draft, foreground: event.target.value })} /></label></div>
      <button className="button apply-button" disabled={busy} onClick={() => void onApply(draft)}>Apply correction<ArrowUpRight size={15} /></button>
      <p className="field-note">Rebuilds the local layout from corrected elements. Code edits can be recovered with Undo.</p>
    </div> : null}
    <div className="palette-section"><div className="section-heading"><span>COLOR PALETTE</span><span>{project.result.palette.length} tones</span></div>
      <div className="palette">{project.result.palette.map(color => <div key={color} title={color}><span style={{ background: color }} /><code>{color}</code></div>)}</div>
      {!project.result.palette.length ? <p className="field-note">Colors appear after reconstruction.</p> : null}</div>
    <div className="review-note"><CircleAlert size={17} /><div><strong>{project.sample ? 'Explore the example' : uncertain ? `${uncertain} elements need a closer look` : 'Keep a human in the loop'}</strong>
      <p>{project.sample ? 'Change the code, try mobile view, then make something your own.' : 'OCR confidence measures text recognition, not visual fidelity. Component types are estimates.'}</p></div></div>
  </aside>;
}
