import type { Code, Project } from './types';

// An editable example, deliberately identified as a sample; no fabricated OCR or latency metrics.
const code: Code = {
  html: `<main class="orbit">
  <header class="top"><strong class="brand">orbit<span>®</span></strong><nav aria-label="Main"><a>Product</a><a>Resources</a><button type="button">Get started ↗</button></nav></header>
  <section class="hero"><span class="eyebrow">A LITTLE LESS NOISE. A LOT MORE CLARITY.</span><h1 data-element-id="sample-title">Your work.<br>Your rhythm.</h1><p data-element-id="sample-text">A calmer space for your team's brightest ideas.<br>From the first spark to the next big thing.</p><button class="primary" type="button" data-element-id="sample-button">Find your flow ↗</button><div class="note">Free to start. Room to grow.</div></section>
  <section class="features" aria-label="Features"><article><span>01 / FOCUS</span><h2>Space to think.</h2><p>Keep the important things in sight.</p></article><article><span>02 / TOGETHER</span><h2>Better in sync.</h2><p>One place. Everyone on the same page.</p></article><article><span>03 / MOMENTUM</span><h2>Keep moving.</h2><p>Less friction between idea and done.</p></article></section>
  <footer>MAKE ROOM FOR WHAT'S NEXT.<span>Made for humans.</span></footer>
</main>`,
  css: `* { box-sizing: border-box; } body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #252b20; background: #f7f8ee; } .orbit { max-width: 1080px; margin: auto; padding: 32px 48px; } .top { display: flex; justify-content: space-between; align-items: center; gap: 20px; } .brand { font-size: 30px; letter-spacing: -2px; } .brand span { font-size: 13px; vertical-align: top; } nav { display: flex; align-items: center; gap: 26px; font-size: 12px; } button { font: inherit; cursor: pointer; } nav button { background: none; border: 1px solid #bdc2b3; border-radius: 100px; padding: 10px 17px; } .hero { padding: 65px 0 54px; } .eyebrow { font-size: 10px; letter-spacing: 1.9px; } h1 { margin: 24px 0; font-size: clamp(50px, 8vw, 86px); line-height: 1.02; letter-spacing: -5px; font-weight: 500; } .hero p { font-size: 15px; line-height: 1.7; color: #66705b; } .primary { margin-top: 19px; padding: 15px 24px; border: none; border-radius: 100px; background: #cfec85; color: #252b20; font-size: 13px; font-weight: 600; } .note { margin-top: 15px; font-size: 10px; color: #747d6a; } .features { display: grid; grid-template-columns: repeat(3, 1fr); gap: 28px; border-top: 1px solid #dfe2d4; padding: 26px 0 32px; } .features span { font-size: 9px; letter-spacing: 1px; color: #76816a; } h2 { margin: 16px 0 10px; font-size: 18px; letter-spacing: -.5px; font-weight: 500; } .features p { font-size: 11px; line-height: 1.5; color: #737c69; } footer { display: flex; justify-content: space-between; gap: 15px; padding-top: 21px; border-top: 1px solid #dfe2d4; font-size: 9px; letter-spacing: 1px; } footer span { letter-spacing: 0; color: #737c69; } :focus-visible { outline: 3px solid #4c6d21; outline-offset: 3px; } @media(max-width: 600px) { .orbit { padding: 22px; } .hero { padding: 46px 0 36px; } nav a { display: none; } h1 { letter-spacing: -3px; } .features { grid-template-columns: 1fr; gap: 14px; } }`,
};

export function sampleProject(): Project {
  return { version: 1, id: 'sample-orbit', name: 'Orbit — a calmer workspace', updated: Date.now(), source: null,
    code: { ...code }, baseline: { ...code }, sample: true,
    result: { code: { ...code }, elements: [
      { id: 'sample-title', kind: 'heading', text: 'Your work. Your rhythm.', confidence: null, bounds: { x: 48, y: 162, width: 570, height: 175 }, color: '#f7f8ee', foreground: '#252b20' },
      { id: 'sample-text', kind: 'text', text: "A calmer space for your team's brightest ideas.", confidence: null, bounds: { x: 48, y: 366, width: 380, height: 45 }, color: '#f7f8ee', foreground: '#66705b' },
      { id: 'sample-button', kind: 'button', text: 'Find your flow ↗', confidence: null, bounds: { x: 48, y: 439, width: 160, height: 45 }, color: '#cfec85', foreground: '#252b20' },
    ], image: { width: 1080, height: 760, background: '#f7f8ee' }, engine: 'local', duration_ms: 0,
    warnings: ['This is an editable sample workspace. Upload a screenshot to run actual detection.'], palette: ['#f7f8ee', '#252b20', '#cfec85', '#66705b'] },
  };
}

export function localDocument(code: Code): string {
  // The frame has no sandbox permissions, and its CSP blocks scripts, networking, forms, and navigation.
  // Full-studio previews/ZIP exports use API sanitation. Demo HTML downloads retain this restricted CSP.
  // Template contents are inert while parsing, including image/resource loading.
  const parsed = document.createElement('template');
  parsed.innerHTML = code.html;
  parsed.content.querySelectorAll('script,iframe,object,embed,svg,math,style,meta,link,base,template').forEach(el => el.remove());
  parsed.content.querySelectorAll('*').forEach(el => {
    [...el.attributes].forEach(attr => {
      if (attr.name.startsWith('on') || ['src', 'srcset', 'poster', 'background', 'href', 'action', 'formaction', 'srcdoc', 'style'].includes(attr.name)) el.removeAttribute(attr.name);
    });
    if (el.tagName === 'BUTTON') el.setAttribute('type', 'button');
  });
  const css = code.css.replace(/</g, '\\3c ').replace(/>/g, '\\3e ');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src 'none'; form-action 'none'; base-uri 'none'; navigate-to 'none';"><style>${css}</style></head><body>${parsed.innerHTML}</body></html>`;
}
