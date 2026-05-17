import fs from 'node:fs/promises';
import path from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import sharp from 'sharp';

const execFileAsync = promisify(execFile);
const root = process.cwd();
const outDir = path.join(root, 'out');
const frameDir = path.join(outDir, 'launch-frames');
const width = 1280;
const height = 720;
const fps = 24;
const duration = 15;
const totalFrames = fps * duration;
const alertText =
  'CRITICAL p99_latency_checkout_service > 2000ms for 8m. Error budget burn 14x.';

const esc = (value) =>
  String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));
const ease = (t) => 1 - Math.pow(1 - clamp(t), 3);
const fade = (t, start, length) => ease((t - start) / length);
const rise = (t, start, amount = 24) => {
  const p = fade(t, start, 0.8);
  return {opacity: p, y: (1 - p) * amount};
};

function textLines(text, maxChars) {
  const words = text.split(' ');
  const lines = [];
  let current = '';
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > maxChars && current) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function textBlock(lines, x, y, size, color = '#f4f4f2', weight = 800, lineHeight = 1.18) {
  return lines
    .map(
      (line, index) =>
        `<text x="${x}" y="${y + index * size * lineHeight}" fill="${color}" font-size="${size}" font-weight="${weight}" font-family="Menlo, Consolas, monospace">${esc(line)}</text>`,
    )
    .join('');
}

function pill(x, y, w, label, fill = '#101011', stroke = 'rgba(255,255,255,0.18)', color = '#f4f4f2') {
  return `<rect x="${x}" y="${y}" width="${w}" height="38" rx="9" fill="${fill}" stroke="${stroke}"/>
    <text x="${x + 16}" y="${y + 25}" fill="${color}" font-size="16" font-weight="800" font-family="Menlo, Consolas, monospace">${esc(label)}</text>`;
}

function panel(x, y, w, h, content, opacity = 1) {
  return `<g opacity="${opacity}"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="16" fill="rgba(12,12,13,0.94)" stroke="rgba(255,255,255,0.15)"/>${content}</g>`;
}

function perceptionScene(x, y, w, h, opacity = 1) {
  const cx = x + w / 2;
  const bottom = y + h - 70;
  return `<g opacity="${opacity}">
    <defs>
      <radialGradient id="haze" cx="50%" cy="12%" r="75%"><stop offset="0%" stop-color="#00ffaf" stop-opacity="0.28"/><stop offset="55%" stop-color="#082015" stop-opacity="0.18"/><stop offset="100%" stop-color="#040505" stop-opacity="0.95"/></radialGradient>
      <linearGradient id="road" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#004a40" stop-opacity="0.38"/><stop offset="0.55" stop-color="#061011" stop-opacity="0.86"/><stop offset="1" stop-color="#030405"/></linearGradient>
    </defs>
    <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="16" fill="url(#road)" stroke="rgba(255,255,255,0.14)"/>
    <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="16" fill="url(#haze)"/>
    <polygon points="${x + w * 0.43},${y + 35} ${x + w * 0.57},${y + 35} ${x + w * 0.94},${y + h} ${x + w * 0.06},${y + h}" fill="rgba(255,255,255,0.035)"/>
    <line x1="${cx}" y1="${y + 40}" x2="${cx}" y2="${y + h}" stroke="#ffb31a" stroke-width="5" opacity="0.8"/>
    <line x1="${cx - 70}" y1="${y + 70}" x2="${x + 170}" y2="${y + h}" stroke="#00ff74" stroke-width="3" opacity="0.62"/>
    <line x1="${cx + 80}" y1="${y + 70}" x2="${x + w - 160}" y2="${y + h}" stroke="#00ff74" stroke-width="3" opacity="0.62"/>
    ${[-54, -36, -18, 18, 36, 54]
      .map((a, i) => {
        const color = ['#2ffff0', '#ffb31a', '#00ff74', '#00ff74', '#ff3c87', '#2ffff0'][i];
        const len = h * 0.72;
        const rad = ((a - 90) * Math.PI) / 180;
        const x2 = cx + Math.cos(rad) * len;
        const y2 = bottom + Math.sin(rad) * len;
        return `<line x1="${cx}" y1="${bottom}" x2="${x2}" y2="${y2}" stroke="${color}" stroke-width="2" opacity="0.92"/>`;
      })
      .join('')}
    ${[0, 1, 2, 3, 4, 5].map((i) => `<rect x="${x + 120 + i * 78}" y="${y + h - 94}" width="34" height="8" fill="rgba(255,255,255,0.18)" transform="skewX(-28)"/>`).join('')}
    <rect x="${cx - 170}" y="${y + 190}" width="52" height="30" rx="14" fill="rgba(0,255,112,0.12)" stroke="#00ff74" stroke-width="3"/>
    <rect x="${cx + 10}" y="${y + 145}" width="58" height="34" rx="14" fill="rgba(0,255,112,0.12)" stroke="#00ff74" stroke-width="3"/>
    <rect x="${cx + 165}" y="${y + 195}" width="58" height="34" rx="14" fill="rgba(0,255,112,0.12)" stroke="#00ff74" stroke-width="3"/>
    <rect x="${cx + 250}" y="${y + 145}" width="74" height="95" rx="7" fill="rgba(0,255,112,0.12)" stroke="#00ff74" stroke-width="3"/>
    <rect x="${x + 92}" y="${y + 270}" width="16" height="48" rx="8" fill="rgba(255,72,129,0.12)" stroke="#ff4881" stroke-width="3"/>
    <rect x="${x + w - 110}" y="${y + 270}" width="16" height="48" rx="8" fill="rgba(255,72,129,0.12)" stroke="#ff4881" stroke-width="3"/>
    <g>
      <rect x="${cx - 58}" y="${bottom - 34}" width="116" height="78" rx="42" fill="#e9fbff"/>
      <rect x="${cx - 36}" y="${bottom - 22}" width="72" height="30" rx="18" fill="#092125"/>
      <circle cx="${cx - 28}" cy="${bottom + 24}" r="13" fill="#111"/>
      <circle cx="${cx + 28}" cy="${bottom + 24}" r="13" fill="#111"/>
      <rect x="${cx - 44}" y="${bottom + 18}" width="88" height="9" rx="5" fill="#e65353"/>
    </g>
  </g>`;
}

function frameSvg(frame) {
  const t = frame / fps;
  const intro = 1 - fade(t, 4.1, 0.7);
  const perception = fade(t, 3.6, 0.9) * (1 - fade(t, 10.7, 0.8));
  const war = fade(t, 7.2, 0.7) * (1 - fade(t, 12.2, 0.6));
  const handoff = fade(t, 10.7, 0.6) * (1 - fade(t, 13.6, 0.5));
  const close = fade(t, 13.2, 0.7);
  const hero = rise(t, 0.2, 34);
  const consoleIn = rise(t, 0.7, 30);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    <defs>
      <radialGradient id="bg1" cx="28%" cy="14%" r="60%"><stop offset="0" stop-color="#00ffaf" stop-opacity="0.14"/><stop offset="1" stop-color="#040505" stop-opacity="0"/></radialGradient>
      <radialGradient id="bg2" cx="72%" cy="46%" r="62%"><stop offset="0" stop-color="#2f73ff" stop-opacity="0.14"/><stop offset="1" stop-color="#040505" stop-opacity="0"/></radialGradient>
    </defs>
    <rect width="100%" height="100%" fill="#040505"/>
    <rect width="100%" height="100%" fill="url(#bg1)"/>
    <rect width="100%" height="100%" fill="url(#bg2)"/>
    <g>
      <text x="36" y="56" fill="#f4f4f2" font-size="36" font-weight="900" font-family="Menlo, Consolas, monospace">Triage Bob</text>
      <text x="36" y="86" fill="#9d9d9d" font-size="17" font-family="Menlo, Consolas, monospace">On-call response console</text>
      ${pill(780, 28, 170, 'IBM Bob connected', '#f2f2f0', 'transparent', '#111')}
      ${pill(965, 28, 155, 'Supabase ready')}
      ${pill(1135, 28, 112, 'Handoff')}
    </g>
    <g opacity="${intro}">
      <g opacity="${hero.opacity}" transform="translate(0 ${hero.y})">
        ${pill(54, 170, 210, '2 AM INCIDENT RESPONSE', 'rgba(47,115,255,0.16)', 'rgba(47,115,255,0.7)', '#bcd0ff')}
        ${textBlock(textLines('From raw alert to first action in 60 seconds.', 17), 54, 250, 58)}
        ${textBlock(['Built for the engineer who just got paged', 'and needs clarity now.'], 58, 442, 24, '#a7a7a7', 500)}
      </g>
      <g opacity="${consoleIn.opacity}" transform="translate(0 ${consoleIn.y})">
        ${panel(650, 165, 560, 360, `
          <text x="690" y="220" fill="#8e8e8e" font-size="20" font-weight="900" font-family="Menlo, Consolas, monospace">ALERT TRANSLATOR</text>
          <rect x="690" y="252" width="480" height="132" rx="12" fill="#111112" stroke="rgba(255,255,255,0.18)" stroke-dasharray="8 8"/>
          ${textBlock(textLines(alertText, 34), 716, 302, 24)}
          <rect x="690" y="414" width="142" height="60" rx="10" fill="#351414"/>
          <text x="714" y="452" fill="#ffd1d1" font-size="20" font-weight="900" font-family="Menlo, Consolas, monospace">Critical</text>
          <rect x="846" y="414" width="180" height="60" rx="10" fill="#151516"/>
          <text x="870" y="452" fill="#f4f4f2" font-size="18" font-weight="900" font-family="Menlo, Consolas, monospace">checkout-service</text>
          <rect x="1040" y="414" width="130" height="60" rx="10" fill="#151516"/>
          <text x="1072" y="452" fill="#f4f4f2" font-size="20" font-weight="900" font-family="Menlo, Consolas, monospace">86%</text>
        `)}
      </g>
    </g>
    <g opacity="${perception}">
      ${perceptionScene(54, 138, 620, 452)}
      <g transform="translate(705 145)">
        ${pill(0, 0, 112, 'Critical', 'rgba(216,75,75,0.20)', 'rgba(216,75,75,0.5)', '#ffd1d1')}
        ${textBlock(textLines('Know what broke before the second page.', 18), 0, 100, 45)}
        ${textBlock(textLines('Bob turns a raw production alert into plain English, likely files, recent commits, and first checks.', 44), 0, 260, 21, '#a7a7a7', 500)}
        ${['Confirm deploy timing', 'Check dependency saturation', 'Prepare rollback path']
          .map((s, i) => `<rect x="0" y="${360 + i * 62}" width="470" height="48" rx="10" fill="#111112" stroke="rgba(255,255,255,0.15)"/><circle cx="26" cy="${385 + i * 62}" r="15" fill="#f2f2f0"/><text x="21" y="${391 + i * 62}" fill="#111" font-size="16" font-weight="900" font-family="Menlo, Consolas, monospace">${i + 1}</text><text x="58" y="${391 + i * 62}" fill="#f4f4f2" font-size="20" font-weight="900" font-family="Menlo, Consolas, monospace">${esc(s)}</text>`)
          .join('')}
      </g>
    </g>
    <g opacity="${war}">
      ${panel(54, 154, 720, 420, `
        <text x="94" y="216" fill="#8e8e8e" font-size="20" font-weight="900" font-family="Menlo, Consolas, monospace">SHIFT BRAIN</text>
        ${textBlock(textLines('Return to any incident with full context.', 20), 94, 300, 50)}
        ${['02:14 Bob mapped alert to checkout-service', '02:18 Maya confirmed deploy timing', '02:23 Rollback owner assigned']
          .map((s, i) => `<rect x="96" y="${410 + i * 54}" width="585" height="38" rx="8" fill="#151516"/><rect x="96" y="${410 + i * 54}" width="3" height="38" fill="#5ce8db"/><text x="116" y="${436 + i * 54}" fill="#cfcfcf" font-size="19" font-family="Menlo, Consolas, monospace">${esc(s)}</text>`)
          .join('')}
      `)}
      ${panel(810, 154, 416, 420, `
        <text x="850" y="216" fill="#8e8e8e" font-size="20" font-weight="900" font-family="Menlo, Consolas, monospace">LAST COMMITS</text>
        ${['9f31c22 retry wrapper', '4ab8d90 latency dimensions', '16de45a timeout handling']
          .map((s, i) => `<rect x="850" y="${260 + i * 74}" width="320" height="48" rx="10" fill="#151516" stroke="rgba(255,255,255,0.13)"/><text x="872" y="${292 + i * 74}" fill="#f4f4f2" font-size="19" font-weight="900" font-family="Menlo, Consolas, monospace">${esc(s)}</text>`)
          .join('')}
      `)}
    </g>
    <g opacity="${handoff}">
      ${panel(54, 154, 1172, 420, `
        <text x="94" y="224" fill="#bff5ca" font-size="22" font-weight="900" font-family="Menlo, Consolas, monospace">HANDOFF GENERATOR</text>
        ${textBlock(textLines('One click at end of shift.', 18), 94, 310, 56)}
        ${textBlock(['Structured summary, open questions, mitigation status, and next owner.'], 98, 430, 22, '#a7a7a7', 500)}
        <rect x="700" y="214" width="445" height="260" rx="12" fill="#141415" stroke="rgba(255,255,255,0.15)"/>
        ${textBlock(['# Bob on Call Handoff', '', 'Severity: Critical', 'Service: checkout-service', 'Next: rollback or disable retry flag', 'Owner: Maya'], 732, 262, 22, '#d7d7d7', 700, 1.35)}
      `)}
    </g>
    <g opacity="${close}">
      <rect width="100%" height="100%" fill="rgba(4,5,5,0.9)"/>
      ${textBlock(['Bob on Call'], 430, 330, 76)}
      ${textBlock(["Saving an engineer's sanity at 2 AM."], 332, 412, 30, '#bdbdbd', 500)}
    </g>
  </svg>`;
}

await fs.rm(frameDir, {recursive: true, force: true});
await fs.mkdir(frameDir, {recursive: true});
await fs.mkdir(outDir, {recursive: true});

const concurrency = 8;
let nextFrame = 0;
async function worker() {
  while (nextFrame < totalFrames) {
    const frame = nextFrame;
    nextFrame += 1;
    const file = path.join(frameDir, `frame-${String(frame).padStart(4, '0')}.png`);
    await sharp(Buffer.from(frameSvg(frame))).png().toFile(file);
    if (frame % 48 === 0) console.log(`Rendered frame ${frame}/${totalFrames}`);
  }
}

await Promise.all(Array.from({length: concurrency}, worker));

const output = path.join(outDir, 'triage-bob-launch.mp4');
await execFileAsync('ffmpeg', [
  '-y',
  '-framerate',
  String(fps),
  '-i',
  path.join(frameDir, 'frame-%04d.png'),
  '-c:v',
  'libx264',
  '-pix_fmt',
  'yuv420p',
  '-movflags',
  '+faststart',
  output,
]);

console.log(output);
