import test from 'node:test';
import assert from 'node:assert/strict';
import 'fake-indexeddb/auto';
import { sampleProject } from '../src/sample.ts';
import { checkpoint, isProject, restore, workspaceName } from '../src/workspace.ts';
import { forgetProject, projects, saveProject } from '../src/storage.ts';

test('an exported example is a valid, restorable workspace', () => {
  assert.equal(isProject(JSON.parse(JSON.stringify(sampleProject()))), true);
});

for (const [name, corrupt] of [
  ['fractional image dimensions', p => { p.result.image.width = 12.5; }],
  ['coerced image dimensions', p => { p.result.image.height = '760'; }],
  ['bounds outside the screenshot', p => { p.result.elements[0].bounds.width = 2400; }],
  ['duplicate layer identifiers', p => { p.result.elements[1].id = p.result.elements[0].id; }],
  ['non-finite confidence', p => { p.result.elements[0].confidence = NaN; }],
  ['oversized code', p => { p.code.html = 'x'.repeat(150_001); }],
  ['negative processing time', p => { p.result.duration_ms = -1; }],
  ['unsafe source URL', p => { p.source = 'https://example.test/image.png'; }],
  ['broken nested object', p => { p.result.image = null; }],
]) {
  test(`backup import rejects ${name}`, () => {
    const project = sampleProject();
    corrupt(project);
    assert.equal(isProject(project), false);
  });
}

test('undo restores code, inspector elements, and the generated baseline together', () => {
  const original = sampleProject();
  const previous = checkpoint(original);
  const edited = { ...original, name: 'My renamed workspace', code: { html: 'edited', css: '' },
    baseline: { html: 'new baseline', css: '' }, result: { ...original.result, elements: [] } };
  const restored = restore(edited, previous);
  assert.equal(restored.name, 'My renamed workspace');
  assert.deepEqual(restored.code, original.code);
  assert.deepEqual(restored.baseline, original.baseline);
  assert.deepEqual(restored.result.elements, original.result.elements);
});

test('blank names have a usable export title', () => {
  assert.equal(workspaceName('  '), 'Untitled workspace');
  assert.equal(workspaceName('  My interface  '), 'My interface');
});

test('workspaces survive storage round trips and deletion only removes the saved copy', async () => {
  const project = { ...sampleProject(), id: 'storage-round-trip' };
  await saveProject(project);
  const saved = (await projects()).find(item => item.id === project.id);
  assert.deepEqual(saved, project);
  assert.notEqual(saved, project);
  await forgetProject(project.id);
  assert.equal((await projects()).some(item => item.id === project.id), false);
  assert.ok(project.code.html.includes('Your work'));
});

test('invalid workspaces cannot be committed to browser storage', async () => {
  const project = sampleProject();
  project.result.elements[0].bounds.x = 3000;
  await assert.rejects(saveProject(project), /invalid data/);
});
