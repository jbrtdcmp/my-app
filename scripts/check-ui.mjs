import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = new URL('../src/', import.meta.url);
const files = [];
async function walk(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) await walk(path);
    else if (/\.(tsx?|css)$/.test(entry.name)) files.push(path);
  }
}
await walk(fileURLToPath(root));

const failures = [];
const sourceByFile = new Map();
const tokens = await readFile(new URL('../src/styles/tokens.css', import.meta.url), 'utf8');
const styles = await readFile(new URL('../src/index.css', import.meta.url), 'utf8');
const authSource = await readFile(new URL('../src/screens/Auth.tsx', import.meta.url), 'utf8');
for (const file of files) {
  const source = await readFile(file, 'utf8');
  sourceByFile.set(file, source);
  for (const [pattern, message] of [
    [/(?:^|\s)(?:sm|md|lg):(?:h-|min-h-|text-)[^\s"'`}]*/m, 'breakpoint-specific control or typography size'],
    [/(?:^|\s)(?:text|h|min-h|max-h|w|min-w|max-w|top|right|bottom|left|p|px|py|gap)-\[[^\]]+\]/m, 'arbitrary size utility; use a token or semantic class'],
    [/(?:^|\s)text-\[(?:[0-9]|\.)[^\]]*\]/m, 'arbitrary font size; use the typography scale'],
  ]) {
    if (pattern.test(source)) failures.push(`${file}: ${message}`);
  }
  const spacingClass = /(?:^|\s)-?(?:(?:sm|md|lg|xl|2xl):)?(p|px|py|pt|pb|pl|pr|m|mx|my|mt|mb|ml|mr|gap|gap-x|gap-y|space-x|space-y)-([0-9]+(?:\.[0-9]+)?)(?=\s|$)/g;
  for (const match of source.matchAll(spacingClass)) {
    const family = match[1];
    const size = Number(match[2]);
    const semanticCard = size === 5 && ['p', 'px', 'py'].includes(family);
    const fractionalAlias = [0.5, 1.5, 2.5, 3.5].includes(size);
    const scaleUtility = [0, 1, 2, 3, 4, 6, 8].includes(size);
    if (!semanticCard && !fractionalAlias && !scaleUtility) {
      failures.push(`${file}: ${match[0].trim()} is outside the approved spacing scale`);
    }
  }
  if (file.endsWith('.css')) {
    const approvedPixels = new Set([0, 1, 2, 4, 8, 12, 16, 24, 32]);
    for (const declaration of source.matchAll(/\b(?:padding|margin|gap)(?:-[a-z]+)?:\s*([^;{}]+)/g)) {
      for (const value of declaration[1].matchAll(/(-?\d+(?:\.\d+)?)px/g)) {
        if (!approvedPixels.has(Math.abs(Number(value[1])))) {
          failures.push(`${file}: ${value[0]} in a padding/margin/gap declaration is outside the approved scale`);
        }
      }
    }
    const approvedFontPixels = new Set([11, 12, 14, 16, 18, 22]);
    for (const declaration of source.matchAll(/\bfont-size:\s*([^;{}]+)/g)) {
      for (const value of declaration[1].matchAll(/(\d+(?:\.\d+)?)px/g)) {
        if (!approvedFontPixels.has(Number(value[1]))) {
          failures.push(`${file}: ${value[0]} font size is outside the typography token scale`);
        }
      }
    }
  }
  if (file.endsWith('.tsx') && /(?:^|\s)(?:sm|md|lg):(?:p|px|py|pt|pb|pl|pr|gap|gap-x|gap-y)-[^\s"'`}]+/.test(source)) {
    failures.push(`${file}: breakpoint-specific spacing utility; use responsive page/card spacing tokens`);
  }
  for (const match of source.matchAll(/\bsize=\{(\d+)\}/g)) {
    if (![14, 16, 18, 20, 24].includes(Number(match[1]))) failures.push(`${file}: icon size ${match[1]}px is outside the shared icon scale`);
  }
  if (file.endsWith('.tsx') && /\btext-4xl\b/.test(source) && !(file.endsWith('Auth.tsx') && source.includes('text-4xl font-bold') && source.includes('>PASAKJA</h1>'))) {
    failures.push(`${file}: 4xl type is reserved for the splash logo`);
  }
  if (file.endsWith('.tsx')) {
    const classAttributes = [...source.matchAll(/\bclassName\s*=\s*(?:"([^"]*)"|'([^']*)'|{`([\s\S]*?)`})/g)];
    for (const attribute of classAttributes) {
      const classValue = attribute[1] ?? attribute[2] ?? attribute[3] ?? '';
      if (/(?:^|\s)(?:[a-z]+:)*(?:text|gap|space-[xy]|p[xytrbl]?|m[xytrbl]?|w|min-w|max-w|h|min-h|max-h|rounded|bg|border|grid-cols|leading|font)-[^\s"'`]*\$\{/.test(classValue)) {
        failures.push(`${file}: dynamically constructed Tailwind class; use complete static class names`);
      }
      for (const className of classValue.match(/\b(?:auth|app)-[A-Za-z][A-Za-z0-9_-]*/g) ?? []) {
        if (!styles.includes(`.${className}`)) {
          failures.push(`${file}: custom class ${className} has no matching CSS rule`);
        }
        if (!file.endsWith('navigation\\roleRoutes.ts') && /["'`]\/(?:passenger|driver|admin)\//.test(source)) {
          failures.push(`${file}: hard-coded role route; use roleRoutes.ts`);
        }
        if (!file.endsWith('navigation\\useBackNavigation.ts') && /(?:navigate\s*\(\s*-1|history\.back\s*\()/m.test(source)) {
          failures.push(`${file}: unguarded back navigation; use useBackNavigation`);
        }
      }

      for (const [name, pattern] of [
        ['TopBar', /\bfunction TopBar\b/g],
        ['BottomTabBar', /\bfunction BottomTabBar\b/g],
        ['StatCard', /\bfunction StatCard\b/g],
        ['StatusBadge', /\bfunction StatusBadge\b/g],
        ['ProfileLayout', /\bfunction ProfileLayout\b/g],
      ]) {
        const definitions = files.flatMap(file => {
          const source = sourceByFile.get(file) ?? '';
          return [...source.matchAll(pattern)].map(() => file);
        });
        if (definitions.length > 1) failures.push(`Duplicate ${name} component definitions: ${definitions.join(', ')}`);
      }
    }
  }
}

const token = name => Number(tokens.match(new RegExp(`--${name}:\\s*(\\d+)px`))?.[1] ?? 0);
if (token('control-default') < 36) failures.push('tokens.css: default controls must be at least 36px');
if (token('input-height') < 36) failures.push('tokens.css: inputs must be at least 36px');
if (token('type-body') < 13) failures.push('tokens.css: body text must be at least 13px');
if (token('button-hit-area') < 44 || token('tap-target-extension') < 4) failures.push('tokens.css: tappable controls need a minimum 44px hit area');
for (const [name, size] of [['control-small', 32], ['control-default', 40], ['control-large', 44], ['input-height', 40]]) {
  if (token(name) !== size) failures.push(`tokens.css: ${name} must resolve to ${size}px`);
}
for (const selector of ['.app-button--small', '.app-button--default', '.app-button--large', '.app-input']) {
  if (!styles.includes(selector)) failures.push(`index.css: missing shared sizing rule for ${selector}`);
}
for (const [pattern, message] of [
  [/className="auth-role-option__radio"[\s\S]*?type="radio"/, 'Auth role selection must use a styled, keyboard-focusable radio'],
  [/role="radiogroup"[\s\S]*?checked=\{role === selectedRole\}/, 'Auth role cards must expose their selected state'],
  [/ArrowRight|ArrowLeft|type="radio"/, 'Auth role selection must remain keyboard-operable'],
  [/auth-role-option--selected/, 'Auth role cards must have a selected-state style hook'],
  [/useState<Record<string, string>>\(\{\}\)/, 'Auth field errors must start hidden'],
  [/onBlur: \(\) => handleBlur\(name\)/, 'Auth field validation must be triggered by blur'],
  [/const handleBlur = \(field: AuthField\) => \{[\s\S]*?validateField\(field\)/, 'Auth field errors must be calculated on blur'],
  [/setSubmitAttempted\(true\)/, 'Auth submit attempts must expose field validation'],
  [/type=\{showPassword \? 'text' : 'password'\}/, 'Auth password visibility control is missing'],
  [/aria-pressed=\{showPassword\}/, 'Auth password visibility must expose its toggle state'],
  [/<IconAlertCircle size=\{14\}\/>/, 'Auth field errors must use an alert icon'],
  [/accept="image\/\*"/, 'Driver ID upload must restrict selection to images'],
  [/file\.size > 2 \* 1024 \* 1024/, 'Driver ID upload must enforce the 2 MB image limit'],
  [/className="auth-photo-preview"/, 'Driver ID upload must render its selected image preview'],
]) {
  if (!pattern.test(authSource)) failures.push(`Auth UI check: ${message}`);
}
if (!styles.includes(':not([class*="auth-"])')) failures.push('Auth UI check: shared button defaults must not override auth-specific controls');

if (failures.length) {
  console.error(`UI sizing check failed (${failures.length}):\n- ${failures.join('\n- ')}`);
  process.exitCode = 1;
} else {
  console.log(`UI sizing check passed across ${files.length} source files.`);
}
