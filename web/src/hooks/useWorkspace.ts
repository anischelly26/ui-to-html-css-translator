import { useCallback, useEffect, useRef, useState } from 'react';
import { sampleProject } from '../sample';
import { forgetProject, projects, saveProject } from '../storage';
import { checkpoint, restore } from '../workspace';
import type { WorkspaceSnapshot } from '../workspace';
import type { Project } from '../types';

export function useWorkspace(notify: (message: string) => void) {
  const [project, setProject] = useState<Project>(sampleProject);
  const [saved, setSaved] = useState<Project[]>([]);
  const [saveStatus, setSaveStatus] = useState('Example workspace');
  const [history, setHistory] = useState<WorkspaceSnapshot[]>([]);
  const current = useRef(project);
  const dirty = useRef(false);
  const interacted = useRef(false);
  const revision = useRef(0);
  const timer = useRef<number | undefined>(undefined);

  const remember = useCallback((item: Project) => {
    setSaved(items => [item, ...items.filter(value => value.id !== item.id)].sort((a, b) => b.updated - a.updated));
  }, []);

  const persist = useCallback(async (item: Project, version: number) => {
    try {
      await saveProject(item);
      remember(item);
      if (revision.current === version && current.current === item) {
        dirty.current = false;
        setSaveStatus('Saved on this device');
      }
    } catch {
      if (revision.current === version) setSaveStatus('Export to keep changes');
      notify('This workspace could not be saved. Export a backup to keep your changes.');
    }
  }, [notify, remember]);

  const flush = useCallback(() => {
    window.clearTimeout(timer.current);
    if (dirty.current) void persist(current.current, revision.current);
  }, [persist]);

  useEffect(() => {
    let active = true;
    void projects().then(items => {
      if (!active) return;
      setSaved(items);
      if (items.length && !interacted.current) {
        current.current = items[0];
        setProject(items[0]);
        setSaveStatus('Saved on this device');
      }
    }).catch(() => { if (active) notify('Browser storage is unavailable. You can still work and export a backup.'); });
    return () => { active = false; };
  }, [notify]);

  useEffect(() => {
    if (!dirty.current) return;
    const version = revision.current;
    setSaveStatus('Saving…');
    timer.current = window.setTimeout(() => void persist(project, version), 850);
    return () => window.clearTimeout(timer.current);
  }, [project, persist]);

  useEffect(() => {
    const hidden = () => { if (document.visibilityState === 'hidden') flush(); };
    document.addEventListener('visibilitychange', hidden);
    window.addEventListener('pagehide', flush);
    return () => {
      document.removeEventListener('visibilitychange', hidden);
      window.removeEventListener('pagehide', flush);
      window.clearTimeout(timer.current);
    };
  }, [flush]);

  function update(change: (value: Project) => Project, keepHistory = false) {
    const previous = current.current;
    const next = { ...change(previous), updated: Date.now() };
    if (keepHistory) setHistory(items => [...items.slice(-11), checkpoint(previous)]);
    interacted.current = true; dirty.current = true; revision.current++;
    current.current = next; setProject(next);
  }

  function open(item: Project, isNew = false) {
    flush();
    revision.current++; interacted.current = true; dirty.current = isNew;
    current.current = item; setProject(item); setHistory([]);
    setSaveStatus(isNew ? 'Saving…' : item.sample ? 'Example workspace' : 'Saved on this device');
  }

  function undo() {
    const previous = history.at(-1);
    if (!previous) return;
    update(value => restore(value, previous));
    setHistory(items => items.slice(0, -1));
  }

  async function remove(item: Project) {
    if (current.current.id === item.id) {
      window.clearTimeout(timer.current);
      revision.current++; dirty.current = false;
    }
    await forgetProject(item.id);
    setSaved(items => items.filter(value => value.id !== item.id));
    if (current.current.id === item.id) setSaveStatus('Saved copy removed · edit to save again');
  }

  async function recover(item: Project) {
    await saveProject(item);
    remember(item);
    if (current.current.id === item.id && !dirty.current) setSaveStatus('Saved on this device');
  }

  return { project, saved, saveStatus, canUndo: history.length > 0, update, open, undo, remove, recover };
}
