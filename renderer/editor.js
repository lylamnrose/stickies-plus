import { Editor, Extension } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Placeholder from '@tiptap/extension-placeholder';
import Table from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableCell from '@tiptap/extension-table-cell';
import TableHeader from '@tiptap/extension-table-header';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import TextStyle from '@tiptap/extension-text-style';
import FontFamily from '@tiptap/extension-font-family';
import Color from '@tiptap/extension-color';
import Highlight from '@tiptap/extension-highlight';
import ImageNode from '@tiptap/extension-image';
import { Plugin } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';

const api = window.sticky;
const $ = (sel) => document.querySelector(sel);

// Keep in sync with the [data-color] blocks in styles.css and COLORS in main.js.
const COLORS = [
  'yellow', 'cream', 'orange', 'coral', 'pink', 'magenta',
  'purple', 'indigo', 'blue', 'sky', 'teal', 'green',
  'lime', 'sand', 'gray', 'white', 'slate', 'graphite',
];

// ---------------------------------------------------------------------------
// Fonts: all of these ship with macOS, so nothing needs to be bundled.
// Each entry is [menu label, CSS font stack].
// ---------------------------------------------------------------------------
const FONT_GROUPS = [
  {
    label: 'Clean',
    fonts: [
      ['Helvetica Neue', "'Helvetica Neue', Helvetica, sans-serif"],
      ['Avenir Next', "'Avenir Next', Avenir, sans-serif"],
      ['Futura', 'Futura, sans-serif'],
      ['Gill Sans', "'Gill Sans', sans-serif"],
      ['Optima', 'Optima, sans-serif'],
      ['Trebuchet MS', "'Trebuchet MS', sans-serif"],
      ['Verdana', 'Verdana, sans-serif'],
    ],
  },
  {
    label: 'Serif',
    fonts: [
      ['Georgia', 'Georgia, serif'],
      ['Palatino', 'Palatino, serif'],
      ['Baskerville', 'Baskerville, serif'],
      ['Times New Roman', "'Times New Roman', Times, serif"],
      ['Didot', 'Didot, serif'],
    ],
  },
  {
    label: 'Typewriter & code',
    fonts: [
      ['American Typewriter', "'American Typewriter', serif"],
      ['Courier New', "'Courier New', Courier, monospace"],
      ['Menlo', 'Menlo, monospace'],
    ],
  },
  {
    label: 'Handwriting & fun',
    fonts: [
      ['Marker Felt', "'Marker Felt', fantasy"],
      ['Noteworthy', 'Noteworthy, cursive'],
      ['Chalkboard SE', "'Chalkboard SE', cursive"],
      ['Bradley Hand', "'Bradley Hand', cursive"],
      ['Snell Roundhand', "'Snell Roundhand', cursive"],
      ['Brush Script MT', "'Brush Script MT', cursive"],
      ['Comic Sans MS', "'Comic Sans MS', cursive"],
      ['Papyrus', 'Papyrus, fantasy'],
    ],
  },
];

// Saved notes keep the font stack without quotes, so compare by first family name.
const firstFamily = (stack) =>
  String(stack || '').split(',')[0].trim().replace(/['"]/g, '').toLowerCase();

let fontSelect = null;
let sizeSelect = null;

function buildFontPicker(bar) {
  fontSelect = document.createElement('select');
  fontSelect.className = 'font-select';
  fontSelect.title = 'Font (applies to selected text, or what you type next)';
  fontSelect.setAttribute('aria-label', 'Font');

  const def = document.createElement('option');
  def.value = '';
  def.textContent = 'Default font';
  fontSelect.appendChild(def);

  for (const group of FONT_GROUPS) {
    const og = document.createElement('optgroup');
    og.label = group.label;
    for (const [label, stack] of group.fonts) {
      const opt = document.createElement('option');
      opt.value = stack;
      opt.textContent = label;
      opt.style.fontFamily = stack; // preview each name in its own font
      og.appendChild(opt);
    }
    fontSelect.appendChild(og);
  }

  fontSelect.addEventListener('change', () => {
    const chain = editor.chain().focus();
    if (fontSelect.value) chain.setFontFamily(fontSelect.value).run();
    else chain.unsetFontFamily().run();
  });

  // Size dropdown sits right after the font dropdown.
  sizeSelect = document.createElement('select');
  sizeSelect.className = 'font-select size-select';
  sizeSelect.title = 'Font size';
  sizeSelect.setAttribute('aria-label', 'Font size');
  const defSize = document.createElement('option');
  defSize.value = '';
  defSize.textContent = 'Size';
  sizeSelect.appendChild(defSize);
  for (const n of FONT_SIZES) {
    const opt = document.createElement('option');
    opt.value = n + 'px';
    opt.textContent = n;
    sizeSelect.appendChild(opt);
  }
  sizeSelect.addEventListener('change', () => {
    const chain = editor.chain().focus();
    if (sizeSelect.value) chain.setFontSize(sizeSelect.value).run();
    else chain.unsetFontSize().run();
  });

  const sep = document.createElement('span');
  sep.className = 'sep';
  bar.prepend(sep);
  bar.prepend(sizeSelect);
  bar.prepend(fontSelect);
}

function syncFont() {
  if (!fontSelect) return;
  const current = firstFamily(editor.getAttributes('textStyle').fontFamily);
  const match = [...fontSelect.options].find((o) => o.value && firstFamily(o.value) === current);
  // A font from somewhere else (pasted text) isn't in the list: show the default label.
  fontSelect.value = match ? match.value : '';

  if (sizeSelect) {
    const size = editor.getAttributes('textStyle').fontSize;
    const hit = [...sizeSelect.options].find((o) => o.value && o.value === size);
    sizeSelect.value = hit ? hit.value : '';
  }
}

// ---------------------------------------------------------------------------
// Small inline icons for the tool strip
// ---------------------------------------------------------------------------
const svg = (inner) =>
  `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`;

const ICON = {
  bullet: svg(
    '<circle cx="4.5" cy="6" r="1" fill="currentColor"/><circle cx="4.5" cy="12" r="1" fill="currentColor"/><circle cx="4.5" cy="18" r="1" fill="currentColor"/><path d="M10 6h11M10 12h11M10 18h11"/>'
  ),
  ordered: svg(
    '<text x="2" y="8" font-size="7" font-weight="700" fill="currentColor" stroke="none">1</text><text x="2" y="14" font-size="7" font-weight="700" fill="currentColor" stroke="none">2</text><text x="2" y="20" font-size="7" font-weight="700" fill="currentColor" stroke="none">3</text><path d="M10 6h11M10 12h11M10 18h11"/>'
  ),
  task: svg('<rect x="3" y="4" width="7" height="7" rx="1.5"/><path d="M4.6 7.6l1.4 1.4 2.4-2.8"/><path d="M13 7.5h8"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><path d="M13 17.5h8"/>'),
  table: svg('<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18M3 15h18M9.5 4v16M15 4v16"/>'),
  image: svg('<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="1.6"/><path d="M21 16l-5-5-9 9"/>'),
};

// ---------------------------------------------------------------------------
// Keep a blank paragraph after a table or image so you can always type below it
// ---------------------------------------------------------------------------
const TrailingParagraph = Extension.create({
  name: 'trailingParagraph',
  addProseMirrorPlugins() {
    return [
      new Plugin({
        appendTransaction: (_transactions, _oldState, state) => {
          const { doc, tr, schema } = state;
          const last = doc.lastChild;
          if (last && (last.type.name === 'table' || last.type.name === 'image')) {
            return tr.insert(doc.content.size, schema.nodes.paragraph.create());
          }
          return null;
        },
      }),
    ];
  },
});

// ---------------------------------------------------------------------------
// Font size: a custom attribute on the same "textStyle" mark that holds font
// family and color, so one <span> carries all three. Stored as e.g. "18px".
// ---------------------------------------------------------------------------
const FontSize = Extension.create({
  name: 'fontSize',
  addGlobalAttributes() {
    return [
      {
        types: ['textStyle'],
        attributes: {
          fontSize: {
            default: null,
            // Only keep px sizes (ours); pasted pt/em sizes from web pages are dropped.
            parseHTML: (el) => (/^\d+(\.\d+)?px$/.test(el.style.fontSize) ? el.style.fontSize : null),
            renderHTML: (attrs) => (attrs.fontSize ? { style: `font-size: ${attrs.fontSize}` } : {}),
          },
        },
      },
    ];
  },
  addCommands() {
    return {
      setFontSize:
        (size) =>
        ({ chain }) =>
          chain().setMark('textStyle', { fontSize: size }).run(),
      unsetFontSize:
        () =>
        ({ chain }) =>
          chain().setMark('textStyle', { fontSize: null }).removeEmptyTextStyle().run(),
    };
  },
});

// ---------------------------------------------------------------------------
// Scrolling tables: off by default (tables shrink to fit the note). When turned on
// for one table, its columns keep a readable width and the table scrolls sideways.
// ---------------------------------------------------------------------------
const ScrollableTable = Table.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      scroll: {
        default: false,
        parseHTML: (el) => el.getAttribute('data-scroll') === '1',
        renderHTML: (attrs) => (attrs.scroll ? { 'data-scroll': '1' } : {}),
      },
    };
  },
  addProseMirrorPlugins() {
    return [
      ...(this.parent?.() || []),
      new Plugin({
        props: {
          decorations: (state) => {
            const decos = [];
            state.doc.descendants((node, pos) => {
              if (node.type.name !== 'table') return true;
              if (node.attrs.scroll) {
                let cols = 0;
                node.firstChild?.forEach((cell) => { cols += cell.attrs.colspan || 1; });
                decos.push(Decoration.node(pos, pos + node.nodeSize, { class: 'scroll-table', style: `--cols: ${cols || 1}` }));
              }
              return false;
            });
            return decos.length ? DecorationSet.create(state.doc, decos) : null;
          },
        },
      }),
    ];
  },
});

function tableNodeAtCursor() {
  const { $from } = editor.state.selection;
  for (let d = $from.depth; d > 0; d--) {
    if ($from.node(d).type.name === 'table') return { node: $from.node(d), pos: $from.before(d) };
  }
  return null;
}

function toggleTableScroll() {
  const t = tableNodeAtCursor();
  if (!t) return;
  const tr = editor.state.tr.setNodeMarkup(t.pos, undefined, { ...t.node.attrs, scroll: !t.node.attrs.scroll });
  editor.view.dispatch(tr);
  editor.commands.focus();
}

// ---------------------------------------------------------------------------
// Table cell shading: a background-color attribute on header and body cells.
// ---------------------------------------------------------------------------
const cellShading = {
  backgroundColor: {
    default: null,
    parseHTML: (el) => el.getAttribute('data-bg') || el.style.backgroundColor || null,
    renderHTML: (attrs) =>
      attrs.backgroundColor
        ? { 'data-bg': attrs.backgroundColor, style: `background-color: ${attrs.backgroundColor}` }
        : {},
  },
};
const ShadedCell = TableCell.extend({
  addAttributes() {
    return { ...this.parent?.(), ...cellShading };
  },
});
const ShadedHeader = TableHeader.extend({
  addAttributes() {
    return { ...this.parent?.(), ...cellShading };
  },
});

// ---------------------------------------------------------------------------
// Palettes (mid-tone text colors read on both light and dark notes)
// ---------------------------------------------------------------------------
const TEXT_COLORS = [
  '#d32f2f', '#e65100', '#f9a825', '#2e7d32', '#00838f', '#1565c0',
  '#6a1b9a', '#c2185b', '#5d4037', '#455a64', '#000000', '#ffffff',
];
const HIGHLIGHT_COLORS = [
  '#fff176', '#aed581', '#80deea', '#f48fb1', '#ffb74d', '#ce93d8', '#ef9a9a', '#e0e0e0',
];
const CELL_COLORS = [
  '#fff59d', '#c5e1a5', '#80deea', '#f8bbd0', '#ffcc80', '#d1c4e9', '#ffcdd2', '#e0e0e0',
];
const FONT_SIZES = ['10', '11', '12', '13', '16', '18', '20', '24', '28', '32', '40', '48'];

// ---------------------------------------------------------------------------
// Color helpers
// ---------------------------------------------------------------------------
// Accepts "#abc", "abc", "#aabbcc" or "rgb(r, g, b)"; returns "#rrggbb" or null.
function toHex(color) {
  if (!color) return null;
  const s = String(color).trim().toLowerCase();
  let m = s.match(/^#?([0-9a-f]{3})$/);
  if (m) return '#' + m[1].split('').map((ch) => ch + ch).join('');
  m = s.match(/^#?([0-9a-f]{6})$/);
  if (m) return '#' + m[1];
  m = s.match(/^rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)/);
  if (m) {
    return '#' + [m[1], m[2], m[3]].map((n) => Math.min(255, Number(n)).toString(16).padStart(2, '0')).join('');
  }
  return null;
}

// hex -> [hue 0-360, saturation 0-100, lightness 0-100]
function hexToHsl(hex) {
  const n = parseInt(hex.slice(1), 16);
  const r = ((n >> 16) & 255) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
  }
  return [h, s * 100, l * 100];
}

function hslToHex(h, s, l) {
  s /= 100;
  l /= 100;
  const k = (n) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return '#' + [f(0), f(8), f(4)].map((x) => Math.round(x * 255).toString(16).padStart(2, '0')).join('');
}

// ---------------------------------------------------------------------------
// Custom color picker: a hex box plus hue / saturation / lightness sliders.
// onPreview fires while dragging, onCommit when you let go (or press Enter),
// onDone when Enter is pressed in the hex box.
// ---------------------------------------------------------------------------
function buildCustomPicker(initial, { onPreview, onCommit, onDone }) {
  const wrap = document.createElement('div');
  wrap.className = 'custom-picker';

  const label = document.createElement('div');
  label.className = 'custom-label';
  label.textContent = 'Custom color';

  const top = document.createElement('div');
  top.className = 'custom-top';
  const preview = document.createElement('span');
  preview.className = 'custom-preview';
  const hexInput = document.createElement('input');
  hexInput.type = 'text';
  hexInput.className = 'hex-input';
  hexInput.placeholder = '#RRGGBB';
  hexInput.maxLength = 7;
  hexInput.spellcheck = false;
  hexInput.setAttribute('aria-label', 'Hex color code');
  hexInput.title = 'Type a hex code like #ff8800, then press Return';
  top.append(preview, hexInput);

  const slider = (cls, name, max) => {
    const r = document.createElement('input');
    r.type = 'range';
    r.className = 'slider ' + cls;
    r.min = '0';
    r.max = String(max);
    r.step = '1';
    r.title = name;
    r.setAttribute('aria-label', name);
    return r;
  };
  const hue = slider('hue', 'Hue', 360);
  const sat = slider('sat', 'Saturation', 100);
  const lit = slider('lit', 'Lightness', 100);
  wrap.append(label, top, hue, sat, lit);

  hue.style.background =
    'linear-gradient(to right, hsl(0 100% 50%), hsl(60 100% 50%), hsl(120 100% 50%), hsl(180 100% 50%), hsl(240 100% 50%), hsl(300 100% 50%), hsl(360 100% 50%))';

  const hexNow = () => hslToHex(Number(hue.value), Number(sat.value), Number(lit.value));
  const paint = (hex) => {
    preview.style.background = hex;
    const h = Number(hue.value);
    const s = Number(sat.value);
    const l = Number(lit.value);
    sat.style.background = `linear-gradient(to right, hsl(${h} 0% ${l}%), hsl(${h} 100% ${l}%))`;
    lit.style.background = `linear-gradient(to right, #000, hsl(${h} ${s}% 50%), #fff)`;
  };
  const setFromHex = (hex) => {
    const [h, s, l] = hexToHsl(hex);
    hue.value = String(Math.round(h));
    sat.value = String(Math.round(s));
    lit.value = String(Math.round(l));
    paint(hex);
  };

  const applied = toHex(initial);
  const start = applied || '#4a90d9';
  setFromHex(start);
  hexInput.value = start;

  // Don't re-apply a color that is already applied.
  let lastCommitted = applied;
  const commit = (hex) => {
    if (hex === lastCommitted) return;
    lastCommitted = hex;
    onCommit(hex);
  };

  for (const r of [hue, sat, lit]) {
    r.addEventListener('input', () => {
      const hex = hexNow();
      hexInput.value = hex;
      hexInput.classList.remove('bad');
      paint(hex);
      if (onPreview) onPreview(hex);
    });
    r.addEventListener('change', () => commit(hexNow()));
  }

  hexInput.addEventListener('input', () => {
    const typed = hexInput.value.trim();
    const hex = toHex(typed);
    hexInput.classList.toggle('bad', !hex && typed !== '');
    if (hex) {
      setFromHex(hex);
      if (onPreview) onPreview(hex);
    }
  });
  hexInput.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const hex = toHex(hexInput.value.trim());
    if (!hex) {
      hexInput.classList.add('bad');
      return;
    }
    hexInput.value = hex;
    commit(hex);
    if (onDone) onDone();
  });
  hexInput.addEventListener('blur', () => {
    const hex = toHex(hexInput.value.trim());
    if (hex) commit(hex);
  });

  return wrap;
}

// ---------------------------------------------------------------------------
// Small color popup that opens above a toolbar button
// ---------------------------------------------------------------------------
let swatchPopup = null;
let popupOwner = null;

function closePopup() {
  if (swatchPopup) swatchPopup.hidden = true;
  popupOwner = null;
}

function openPopup(anchor, cfg) {
  if (!swatchPopup) {
    swatchPopup = document.createElement('div');
    swatchPopup.className = 'swatch-popup';
    // Keep the text selection when clicking swatches, but let the hex box and sliders work.
    swatchPopup.addEventListener('mousedown', (e) => {
      if (!e.target.closest('input')) e.preventDefault();
    });
    swatchPopup.addEventListener('click', (e) => e.stopPropagation());
    document.body.appendChild(swatchPopup);
  }
  if (popupOwner === anchor && !swatchPopup.hidden) {
    closePopup();
    return;
  }
  swatchPopup.textContent = '';

  const current = toHex(cfg.current);
  const grid = document.createElement('div');
  grid.className = 'swatch-grid';
  for (const color of cfg.colors) {
    const s = document.createElement('button');
    s.type = 'button';
    s.className = 'sw' + (toHex(color) === current ? ' current' : '');
    s.style.background = color;
    s.title = color;
    s.dataset.value = color;
    s.addEventListener('click', () => {
      cfg.onPick(color);
      closePopup();
    });
    grid.appendChild(s);
  }
  swatchPopup.appendChild(grid);

  swatchPopup.appendChild(
    buildCustomPicker(cfg.current, {
      onCommit: (hex) => cfg.onPick(hex),
      onDone: closePopup,
    })
  );

  const clear = document.createElement('button');
  clear.type = 'button';
  clear.className = 'sw-clear';
  clear.textContent = cfg.clearLabel;
  clear.addEventListener('click', () => {
    cfg.onPick(null);
    closePopup();
  });
  swatchPopup.appendChild(clear);

  swatchPopup.hidden = false;
  popupOwner = anchor;
  const r = anchor.getBoundingClientRect();
  const w = swatchPopup.offsetWidth || 170;
  swatchPopup.style.left = Math.max(4, Math.min(r.left, window.innerWidth - w - 4)) + 'px';
  swatchPopup.style.maxHeight = window.innerHeight - 8 + 'px';
  if (swatchPopup.offsetHeight > r.top - 8) {
    // Short note: no room above the button, so pin the popup to the top and let it scroll.
    swatchPopup.style.bottom = 'auto';
    swatchPopup.style.top = '4px';
  } else {
    swatchPopup.style.top = 'auto';
    swatchPopup.style.bottom = window.innerHeight - r.top + 4 + 'px';
  }
}

// ---------------------------------------------------------------------------
// Images. They are stored inside the note itself (as data), so a note stays one
// self-contained thing. Big pictures are scaled down first to keep notes small.
// ---------------------------------------------------------------------------
const SizedImage = ImageNode.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      // Display width as a percentage of the note ("50%"); null = natural size.
      width: {
        default: null,
        parseHTML: (el) => el.getAttribute('data-width') || (/%$/.test(el.style.width) ? el.style.width : null),
        renderHTML: (attrs) => (attrs.width ? { 'data-width': attrs.width, style: `width: ${attrs.width}` } : {}),
      },
    };
  },
});

const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/svg+xml', 'image/bmp', 'image/avif'];
const KEEP_BYTES = 600 * 1024; // smaller files go in untouched
const MAX_DIM = 1400; // larger pictures are scaled down to this many pixels on the long side
const CAP_BYTES = 3 * 1024 * 1024; // ceiling for one image

const readAsDataURL = (blob) =>
  new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = () => reject(new Error('Could not read that file.'));
    r.readAsDataURL(blob);
  });

const loadImg = (src) =>
  new Promise((resolve, reject) => {
    const img = new window.Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Couldn't open that image."));
    img.src = src;
  });

async function fileToImageSrc(file) {
  if (!IMAGE_TYPES.includes(file.type)) {
    throw new Error(
      /hei[cf]/i.test(file.type + file.name)
        ? "HEIC photos aren't supported. Export it as JPEG or PNG first."
        : "That file isn't a supported image type."
    );
  }
  const original = await readAsDataURL(file);
  // GIFs (animation) and SVGs (vector) can't be re-drawn without losing something; small files don't need it.
  if (file.type === 'image/gif' || file.type === 'image/svg+xml' || file.size <= KEEP_BYTES) {
    if (file.size > CAP_BYTES) throw new Error('That image is over 3 MB. Try a smaller one.');
    return original;
  }
  const img = await loadImg(original);
  const scale = Math.min(1, MAX_DIM / Math.max(img.naturalWidth, img.naturalHeight));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
  canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
  // WebP keeps transparency and is much smaller than PNG for photos.
  for (const quality of [0.85, 0.7, 0.5]) {
    const out = canvas.toDataURL('image/webp', quality);
    if (out.length * 0.75 <= CAP_BYTES) return out;
  }
  throw new Error('That image is too large, even after shrinking it.');
}

let toastTimer = null;
function showToast(message) {
  let t = $('#toast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'toast';
    t.className = 'toast';
    t.setAttribute('role', 'status');
    document.body.appendChild(t);
  }
  t.textContent = message;
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (t.hidden = true), 4500);
}

// Images go in one at a time, in order. `pos` (from a drop) says where the first one lands.
let imageQueue = Promise.resolve();
function insertImages(files, pos) {
  imageQueue = imageQueue.then(async () => {
    for (const file of files) {
      try {
        const src = await fileToImageSrc(file);
        const alt = (file.name || 'image').replace(/\.[^.]+$/, '');
        // The image plus an empty paragraph, so the cursor ends up below it, ready to type
        // (and a second image goes after the first instead of replacing it).
        const content = [{ type: 'image', attrs: { src, alt } }, { type: 'paragraph' }];
        const chain = editor.chain().focus();
        if (typeof pos === 'number') {
          chain.insertContentAt(pos, content);
          pos = undefined;
        } else if (editor.state.selection.node) {
          chain.insertContentAt(editor.state.selection.to, content); // an image is selected: add after it
        } else {
          chain.insertContent(content);
        }
        chain.run();
      } catch (err) {
        showToast(err.message || "Couldn't add that image.");
      }
    }
  });
  return imageQueue;
}

// ---------------------------------------------------------------------------
// Open an image large. The main process grows the note window for the duration,
// so this is an overlay in the same window, not another page.
// ---------------------------------------------------------------------------
let lightboxOpen = false;
let lightboxGrown = false; // is the note window temporarily enlarged?

function setGrown(grown) {
  lightboxGrown = grown;
  const btn = $('#lb-grow');
  btn.textContent = grown ? '⤡ Note size' : '⤢ Larger window';
  btn.title = grown ? 'Shrink the window back to the note size' : 'Grow the window to most of the screen';
  if (grown) api.zoomStart();
  else api.zoomEnd();
}

function openLightbox(src, alt) {
  if (!src) return;
  const box = $('#lightbox');
  $('#lb-img').src = src;
  $('#lb-img').alt = alt || '';
  box.classList.remove('actual');
  box.hidden = false;
  box.scrollTo(0, 0);
  closePopup();
  // Opens filling just the note; "Larger window" is there if you want more room.
  if (!lightboxOpen) {
    lightboxGrown = false;
    $('#lb-grow').textContent = '⤢ Larger window';
    $('#lb-grow').title = 'Grow the window to most of the screen';
  }
  lightboxOpen = true;
}

function closeLightbox() {
  if (!lightboxOpen) return;
  lightboxOpen = false;
  $('#lightbox').hidden = true;
  $('#lb-img').removeAttribute('src');
  if (lightboxGrown) setGrown(false); // the window goes back to the note's size
  if (editor) editor.commands.focus();
}

function wireLightbox() {
  const box = $('#lightbox');
  $('#lb-grow').addEventListener('click', (e) => {
    e.stopPropagation();
    setGrown(!lightboxGrown);
  });
  // Click the picture to switch between "fit the window" and actual size (scroll to look around).
  $('#lb-img').addEventListener('click', (e) => {
    e.stopPropagation();
    box.classList.toggle('actual');
  });
  $('#lb-close').addEventListener('click', (e) => {
    e.stopPropagation();
    closeLightbox();
  });
  box.addEventListener('click', closeLightbox); // clicking the dark area closes it
}

const imageFilesIn = (dt) =>
  dt && dt.files ? [...dt.files].filter((f) => f.type.startsWith('image/') || /\.hei[cf]$/i.test(f.name)) : [];

// ---------------------------------------------------------------------------
// Tool definitions
// ---------------------------------------------------------------------------
let editor;

const colorIndicator = (inner) => `<span class="swatch-ind">${inner}</span>`;
const HIGHLIGHTER = svg('<path d="M9 11l-5 5v4h4l5-5"/><path d="M15 5l4 4-7 7-4-4z"/>');

const MAIN_TOOLS = [
  { html: '<b>B</b>', title: 'Bold (⌘B)', run: (c) => c.toggleBold(), active: () => editor.isActive('bold') },
  { html: '<i>I</i>', title: 'Italic (⌘I)', run: (c) => c.toggleItalic(), active: () => editor.isActive('italic') },
  { html: '<u>U</u>', title: 'Underline (⌘U)', run: (c) => c.toggleUnderline(), active: () => editor.isActive('underline') },
  { html: '<s>S</s>', title: 'Strikethrough (⌘⇧S)', run: (c) => c.toggleStrike(), active: () => editor.isActive('strike') },
  {
    html: colorIndicator('<b>A</b>'),
    title: 'Text color',
    popup: () => ({
      colors: TEXT_COLORS,
      current: editor.getAttributes('textStyle').color,
      clearLabel: 'Default color',
      onPick: (c) => (c ? editor.chain().focus().setColor(c).run() : editor.chain().focus().unsetColor().run()),
    }),
    sync: (el) => setIndicator(el, editor.getAttributes('textStyle').color),
  },
  {
    html: colorIndicator(HIGHLIGHTER),
    title: 'Highlight',
    popup: () => ({
      colors: HIGHLIGHT_COLORS,
      current: editor.getAttributes('highlight').color,
      clearLabel: 'No highlight',
      onPick: (c) =>
        c ? editor.chain().focus().setHighlight({ color: c }).run() : editor.chain().focus().unsetHighlight().run(),
    }),
    sync: (el) => setIndicator(el, editor.getAttributes('highlight').color),
  },
  'sep',
  { html: '<b>H1</b>', title: 'Heading 1 (⌘⌥1)', run: (c) => c.toggleHeading({ level: 1 }), active: () => editor.isActive('heading', { level: 1 }) },
  { html: '<b>H2</b>', title: 'Heading 2 (⌘⌥2)', run: (c) => c.toggleHeading({ level: 2 }), active: () => editor.isActive('heading', { level: 2 }) },
  'sep',
  { html: ICON.bullet, title: 'Bulleted list (⌘⇧8)', run: (c) => c.toggleBulletList(), active: () => editor.isActive('bulletList') },
  { html: ICON.ordered, title: 'Numbered list (⌘⇧7)', run: (c) => c.toggleOrderedList(), active: () => editor.isActive('orderedList') },
  { html: ICON.task, title: 'Checklist (⌘⇧9)', run: (c) => c.toggleTaskList(), active: () => editor.isActive('taskList') },
  'sep',
  {
    html: ICON.table,
    title: 'Insert table',
    run: (c) => (editor.isActive('table') ? c : c.insertTable({ rows: 3, cols: 3, withHeaderRow: true })),
    active: () => editor.isActive('table'),
  },
  {
    html: ICON.image,
    title: 'Insert image (you can also paste or drag one in)',
    action: () => $('#image-input').click(),
  },
];

const IMAGE_TOOLS = [
  ...['25%', '50%', '75%', '100%'].map((w) => ({
    html: w,
    title: `Show at ${w} of the note width`,
    run: (c) => c.updateAttributes('image', { width: w }),
    active: () => editor.getAttributes('image').width === w,
  })),
  {
    html: 'Original',
    title: 'Natural size (only shrinks if wider than the note)',
    run: (c) => c.updateAttributes('image', { width: null }),
    active: () => !editor.getAttributes('image').width,
  },
  'sep',
  {
    html: 'Zoom',
    title: 'Open larger (or double-click the image)',
    action: () => {
      const node = editor.state.selection.node;
      if (node && node.type.name === 'image') openLightbox(node.attrs.src, node.attrs.alt);
    },
  },
  { html: '✕ Image', title: 'Delete image', run: (c) => c.deleteSelection(), cls: 'danger' },
];

const TABLE_TOOLS = [
  { html: '↑ Row', title: 'Add row above', run: (c) => c.addRowBefore() },
  { html: '↓ Row', title: 'Add row below', run: (c) => c.addRowAfter() },
  { html: '✕ Row', title: 'Delete row', run: (c) => c.deleteRow(), cls: 'danger' },
  'sep',
  { html: '← Col', title: 'Add column to the left', run: (c) => c.addColumnBefore() },
  { html: '→ Col', title: 'Add column to the right', run: (c) => c.addColumnAfter() },
  { html: '✕ Col', title: 'Delete column', run: (c) => c.deleteColumn(), cls: 'danger' },
  'sep',
  { html: 'Header', title: 'Toggle header row', run: (c) => c.toggleHeaderRow() },
  { html: 'Merge', title: 'Merge / split selected cells (drag across cells first)', run: (c) => c.mergeOrSplit() },
  {
    html: 'Cell color',
    title: 'Cell color (drag across cells to color several at once)',
    popup: () => ({
      colors: CELL_COLORS,
      current: editor.getAttributes('tableCell').backgroundColor || editor.getAttributes('tableHeader').backgroundColor,
      clearLabel: 'No fill',
      onPick: (c) => editor.chain().focus().setCellAttribute('backgroundColor', c).run(),
    }),
  },
  'sep',
  {
    html: 'Scroll',
    title: 'Scroll this table sideways and up/down instead of shrinking it to fit (click again to fit the note)',
    action: toggleTableScroll,
    active: () => !!tableNodeAtCursor()?.node.attrs.scroll,
  },
  { html: '✕ Table', title: 'Delete table', run: (c) => c.deleteTable(), cls: 'danger' },
];

function buildBar(container, tools, small) {
  for (const tool of tools) {
    if (tool === 'sep') {
      const s = document.createElement('span');
      s.className = 'sep';
      container.appendChild(s);
      continue;
    }
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'btn' + (small ? ' small' : '') + (tool.cls ? ' ' + tool.cls : '');
    b.innerHTML = tool.html;
    b.title = tool.title;
    // Keep the text cursor in the note when a button is pressed.
    b.addEventListener('mousedown', (e) => e.preventDefault());
    b.addEventListener('click', (e) => {
      if (tool.popup) {
        e.stopPropagation(); // don't let the outside-click handler close it right away
        openPopup(b, tool.popup());
        return;
      }
      closePopup();
      if (tool.action) {
        tool.action();
        return;
      }
      tool.run(editor.chain().focus()).run();
    });
    tool.el = b;
    container.appendChild(b);
  }
}

// Shows the current color as a small bar under the button's icon.
function setIndicator(el, color) {
  if (color) el.style.setProperty('--c', color);
  else el.style.removeProperty('--c');
}

function syncBars() {
  for (const tool of [...MAIN_TOOLS, ...IMAGE_TOOLS, ...TABLE_TOOLS]) {
    if (tool === 'sep' || !tool.el) continue;
    if (tool.active) tool.el.classList.toggle('on', !!tool.active());
    if (tool.sync) tool.sync(tool.el);
  }
  $('#tabletools').hidden = !editor.isActive('table');
  $('#imagetools').hidden = !editor.isActive('image');
  syncFont();
}

// ---------------------------------------------------------------------------
// Saving
// ---------------------------------------------------------------------------
let saveTimer = null;
function saveNow() {
  clearTimeout(saveTimer);
  saveTimer = null;
  if (editor) api.save(editor.getHTML());
}
function saveSoon() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveNow, 250);
}

// ---------------------------------------------------------------------------
// Title bar: close / new / color / pin / delete
// ---------------------------------------------------------------------------
// A note color is a preset name ("yellow") or a custom "#rrggbb". Custom colors set
// the same CSS variables the presets do, plus light or dark text to stay readable.
const CUSTOM_VARS = ['--bg', '--bar', '--ink-rgb'];

function applyCustomNoteColor(hex) {
  const [h, s, l] = hexToHsl(hex);
  const n = parseInt(hex.slice(1), 16);
  const luma = 0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255);
  const dark = luma < 128;
  const barL = l < 25 ? Math.min(l + 8, 100) : Math.max(l - 12, 0); // title/tool strip: a shade off the paper
  const st = document.body.style;
  st.setProperty('--bg', hex);
  st.setProperty('--bar', hslToHex(h, s, barL));
  st.setProperty('--ink-rgb', dark ? '240, 240, 242' : '42, 42, 36');
  st.colorScheme = dark ? 'dark' : '';
}

function clearCustomNoteColor() {
  for (const v of CUSTOM_VARS) document.body.style.removeProperty(v);
  document.body.style.colorScheme = '';
}

function setColor(color) {
  const isHex = /^#[0-9a-f]{6}$/i.test(color);
  document.body.dataset.color = isHex ? 'custom' : color;
  if (isHex) applyCustomNoteColor(color.toLowerCase());
  else clearCustomNoteColor();
  document.querySelectorAll('.swatch').forEach((s) => s.classList.toggle('current', s.dataset.color === color));
}

// The paper color currently showing, as hex (works for presets too).
function currentNoteHex() {
  return toHex(getComputedStyle(document.body).getPropertyValue('--bg'));
}

function setPinned(pinned) {
  const btn = $('#btn-pin');
  btn.classList.toggle('on', pinned);
  btn.title = pinned ? 'Pinned on top (click to unpin)' : 'Not pinned (click to keep on top)';
}

// ---------------------------------------------------------------------------
// Collapse to title bar (the window itself is resized by the main process)
// ---------------------------------------------------------------------------
function titleText() {
  const line = editor
    .getText({ blockSeparator: '\n' })
    .split('\n')
    .map((s) => s.trim())
    .find(Boolean);
  return line || (editor.getHTML().includes('<img') ? 'Image' : 'Empty note');
}

// ---------- contents sidebar (built from the note's headings) ----------
let tocKey = '';

function headingsOf() {
  const list = [];
  editor.state.doc.descendants((node, pos) => {
    if (node.type.name === 'heading' && node.textContent.trim()) {
      list.push({ pos, level: node.attrs.level, text: node.textContent.trim() });
    }
  });
  return list;
}

function renderToc() {
  const box = $('#toc-list');
  if (!box || $('#toc').hidden) return;
  const items = headingsOf();
  const key = JSON.stringify(items.map((i) => [i.level, i.text]));
  if (key !== tocKey) {
    tocKey = key;
    box.textContent = '';
    if (!items.length) {
      const d = document.createElement('div');
      d.className = 'toc-empty';
      d.textContent = 'Make a line a heading (H1 or H2) and it shows up here.';
      box.appendChild(d);
    }
    items.forEach((it, i) => {
      const b = document.createElement('button');
      b.className = 'toc-item l' + it.level;
      b.textContent = it.text;
      b.title = it.text;
      b.dataset.index = i;
      b.addEventListener('mousedown', (ev) => ev.preventDefault()); // keep the cursor in the note
      b.addEventListener('click', () => gotoHeading(i));
      box.appendChild(b);
    });
  }
  markCurrentHeading(items);
}

function headingEl(pos) {
  const el = editor.view.nodeDOM(pos);
  return el && el.nodeType === 1 ? el : null;
}

function gotoHeading(i) {
  const it = headingsOf()[i];
  if (!it) return;
  const el = headingEl(it.pos);
  editor.chain().setTextSelection(it.pos + 1).run();
  if (el) {
    const scroller = $('#editor');
    const top = el.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop - 6;
    scroller.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
  }
  editor.commands.focus();
}

function markCurrentHeading(items = headingsOf()) {
  const scroller = $('#editor');
  const line = scroller.getBoundingClientRect().top + 24;
  let current = -1;
  items.forEach((it, i) => {
    const el = headingEl(it.pos);
    if (el && el.getBoundingClientRect().top <= line) current = i;
  });
  if (current < 0 && items.length) current = 0;
  document.querySelectorAll('#toc-list .toc-item').forEach((b) => b.classList.toggle('current', Number(b.dataset.index) === current));
}

function setTocOpen(open, remember = true) {
  $('#toc').hidden = !open;
  $('#btn-toc').classList.toggle('on', open);
  tocKey = '';
  if (open) renderToc();
  if (remember) {
    try { localStorage.setItem('toc-open', open ? '1' : '0'); } catch (_) { /* fine without it */ }
  }
}

function setCollapsed(collapsed) {
  document.body.classList.toggle('collapsed', collapsed);
  $('#palette').hidden = true;
  closePopup();
  closeLightbox();
  $('#tb-title').textContent = collapsed ? titleText() : '';
  const btn = $('#btn-collapse');
  btn.title = collapsed ? 'Expand note (⌘M)' : 'Collapse note (⌘M)';
  btn.setAttribute('aria-label', btn.title);
  if (!collapsed) editor.commands.focus();
}

function setOpacityLabel(percent) {
  $('#opacity-val').textContent = percent + '%';
}

function wireTitleBar() {
  const palette = $('#palette');
  for (const color of COLORS) {
    const s = document.createElement('button');
    s.type = 'button';
    s.className = 'swatch';
    s.dataset.color = color;
    s.title = color[0].toUpperCase() + color.slice(1);
    s.addEventListener('click', (e) => {
      e.stopPropagation();
      setColor(color);
      api.setColor(color);
      palette.hidden = true;
    });
    $('#swatches').appendChild(s);
  }
  // Clicking inside the popover (sliding the opacity, etc.) shouldn't close it.
  palette.addEventListener('click', (e) => e.stopPropagation());
  $('#btn-collapse').addEventListener('click', () => api.toggleCollapse());

  $('#btn-close').addEventListener('click', () => {
    saveNow();
    api.close();
  });
  $('#btn-new').addEventListener('click', () => api.newNote());
  $('#btn-color').addEventListener('click', (e) => {
    e.stopPropagation();
    palette.hidden = !palette.hidden;
    if (!palette.hidden) {
      // Rebuild the custom picker each time so it starts from the note's current color.
      $('#custom-slot').replaceChildren(
        buildCustomPicker(currentNoteHex(), {
          onPreview: (hex) => {
            document.body.dataset.color = 'custom';
            applyCustomNoteColor(hex);
          },
          onCommit: (hex) => {
            setColor(hex);
            api.setColor(hex);
          },
          onDone: () => (palette.hidden = true),
        })
      );
    }
  });
  $('#btn-toc').addEventListener('click', () => setTocOpen($('#toc').hidden));
  $('#editor').addEventListener('scroll', () => markCurrentHeading(), { passive: true });
  $('#btn-behind').addEventListener('click', () => api.sendBehind());
  $('#btn-pin').addEventListener('click', async () => setPinned(await api.togglePin()));
  $('#btn-delete').addEventListener('click', () => {
    saveNow();
    api.remove();
  });

  document.addEventListener('click', () => {
    palette.hidden = true;
    closePopup();
  });
  document.addEventListener('keydown', (e) => {
    if (e.metaKey && e.shiftKey && e.key.toLowerCase() === 'l') {
      e.preventDefault();
      setTocOpen($('#toc').hidden);
      return;
    }
    if (e.key === 'Escape') {
      if (lightboxOpen) {
        closeLightbox();
        return;
      }
      palette.hidden = true;
      closePopup();
    }
  });
}

// ---------------------------------------------------------------------------
// Startup
// ---------------------------------------------------------------------------
async function init() {
  const note = await api.get();

  wireTitleBar();
  setColor(note.color);
  setPinned(note.pinned);

  const slider = $('#opacity');
  const percent = Math.round((typeof note.opacity === 'number' ? note.opacity : 1) * 100);
  slider.value = String(percent);
  setOpacityLabel(Number(slider.value));
  slider.addEventListener('input', () => {
    setOpacityLabel(Number(slider.value));
    api.setOpacity(Number(slider.value) / 100);
  });

  editor = new Editor({
    element: $('#editor'),
    content: note.html || '',
    autofocus: 'end',
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      Underline,
      TextStyle,
      FontFamily,
      FontSize,
      Color,
      Highlight.configure({ multicolor: true }),
      Placeholder.configure({ placeholder: 'Type a note…' }),
      TaskList,
      TaskItem.configure({ nested: true }),
      ScrollableTable.configure({ resizable: true }),
      TableRow,
      ShadedHeader,
      ShadedCell,
      SizedImage.configure({ allowBase64: true }),
      TrailingParagraph,
    ],
    editorProps: {
      // Double-click an image to open it large (a single click selects it for resizing).
      handleDoubleClickOn: (_view, _pos, node) => {
        if (node.type.name !== 'image') return false;
        openLightbox(node.attrs.src, node.attrs.alt);
        return true;
      },
      // Pasting a screenshot or a copied picture inserts it as an image.
      handlePaste: (_view, event) => {
        const files = imageFilesIn(event.clipboardData);
        if (!files.length) return false;
        event.preventDefault();
        insertImages(files);
        return true;
      },
      // Dragging image files onto the note drops them where you let go.
      handleDrop: (view, event) => {
        const files = imageFilesIn(event.dataTransfer);
        if (!files.length) return false;
        event.preventDefault();
        const at = view.posAtCoords({ left: event.clientX, top: event.clientY });
        insertImages(files, at ? at.pos : undefined);
        return true;
      },
    },
    onUpdate: () => { saveSoon(); renderToc(); },
    onTransaction: syncBars,
  });

  buildBar($('#maintools'), MAIN_TOOLS, false);
  buildFontPicker($('#maintools'));
  buildBar($('#tabletools'), TABLE_TOOLS, true);
  buildBar($('#imagetools'), IMAGE_TOOLS, true);
  wireLightbox();
  $('#image-input').addEventListener('change', (e) => {
    const files = [...e.target.files];
    e.target.value = '';
    insertImages(files);
  });
  syncBars();
  let wantToc = false;
  try { wantToc = localStorage.getItem('toc-open') === '1'; } catch (_) { /* ignore */ }
  setTocOpen(wantToc, false);

  setCollapsed(!!note.collapsed);
  api.onCollapsed(setCollapsed);

  // Fade chrome when the note isn't the active window; flush edits on blur.
  const setBlurred = (blurred) => document.body.classList.toggle('blurred', blurred);
  setBlurred(!document.hasFocus());
  window.addEventListener('focus', () => setBlurred(false));
  window.addEventListener('blur', () => {
    setBlurred(true);
    closePopup();
    saveNow();
  });
  window.addEventListener('beforeunload', saveNow);

  // Dropping a file on a note shouldn't navigate the window away.
  const stopFileDrop = (e) => {
    if (e.dataTransfer && e.dataTransfer.types && [...e.dataTransfer.types].includes('Files')) e.preventDefault();
  };
  window.addEventListener('dragover', stopFileDrop);
  window.addEventListener('drop', stopFileDrop);
}

init().catch((err) => {
  document.body.textContent = 'Could not load note: ' + err.message;
});
