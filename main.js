const {
  app,
  BrowserWindow,
  Tray,
  Menu,
  ipcMain,
  globalShortcut,
  nativeImage,
  screen,
  dialog,
  shell,
} = require('electron');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const IS_MAC = process.platform === 'darwin';

// Note colors (paper color; the matching title-bar shades live in styles.css).
const COLORS = {
  yellow: '#fff3a3',
  cream: '#fff8e6',
  orange: '#ffddb5',
  coral: '#ffc9c2',
  pink: '#ffd1dc',
  magenta: '#f6c6ea',
  purple: '#e2d6ff',
  indigo: '#cfd3ff',
  blue: '#cde7ff',
  sky: '#c6f0f7',
  teal: '#bfeee3',
  green: '#d4f4c7',
  lime: '#e7f5b0',
  sand: '#eadcc0',
  gray: '#e9e9ec',
  white: '#ffffff',
  slate: '#3a4556',
  graphite: '#2b2b30',
};
// A note's color is either one of the names above or a custom "#rrggbb" value.
const HEX_COLOR = /^#[0-9a-f]{6}$/i;
const isNamedColor = (c) => typeof c === 'string' && Object.prototype.hasOwnProperty.call(COLORS, c);
const isValidColor = (c) => isNamedColor(c) || (typeof c === 'string' && HEX_COLOR.test(c));
const paper = (c) => (isNamedColor(c) ? COLORS[c] : HEX_COLOR.test(c) ? c : COLORS.yellow);

// New notes cycle through these so a pile of notes isn't all one color.
const NEW_NOTE_COLORS = ['yellow', 'pink', 'blue', 'green', 'purple', 'orange', 'teal', 'coral'];

const MIN_W = 220;
const MIN_H = 150;
const COLLAPSED_H = 28; // a collapsed note is just its title bar
const MAX_SIZE = 100000;
const MIN_OPACITY = 0.35;

const WELCOME_HTML =
  '<h2>Welcome to Stickies Plus</h2>' +
  '<p>This note floats above your browser and other windows. Format with the bar below: <strong>bold</strong>, <em>italics</em>, headings and lists.</p>' +
  '<ul data-type="taskList">' +
  '<li data-type="taskItem" data-checked="true"><label><input type="checkbox" checked="checked"><span></span></label><div><p>Checklists work</p></div></li>' +
  '<li data-type="taskItem" data-checked="false"><label><input type="checkbox"><span></span></label><div><p>Try the table button</p></div></li>' +
  '</ul>' +
  '<table><tbody>' +
  '<tr><th><p>Item</p></th><th><p>Notes</p></th></tr>' +
  '<tr><td><p>Tab</p></td><td><p>moves between cells</p></td></tr>' +
  '</tbody></table>' +
  '<p>Pin = keep on top. Dot = color and translucency. Arrow (or ⌘M) = collapse to a title bar. Ctrl+Opt+N = new note from anywhere.</p>';

// ---------------------------------------------------------------------------
// State + persistence
// ---------------------------------------------------------------------------
let store = { notes: [] };
const windows = new Map(); // note id -> BrowserWindow
const idByWin = new WeakMap(); // BrowserWindow -> note id
let tray = null;
let allHidden = false;
let saveTimer = null;
let trayTimer = null;
let transformed = false; // has macOS process type already been switched to UIElement?
const zoomed = new WeakMap(); // window -> the bounds it had before an image was opened large

function storeFile() {
  return path.join(app.getPath('userData'), 'notes.json');
}

function loadStore() {
  try {
    const parsed = JSON.parse(fs.readFileSync(storeFile(), 'utf8'));
    store = { notes: Array.isArray(parsed.notes) ? parsed.notes : [] };
  } catch {
    store = { notes: [] };
  }
}

function saveStoreNow() {
  clearTimeout(saveTimer);
  saveTimer = null;
  try {
    const file = storeFile();
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const tmp = file + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(store, null, 2));
    fs.renameSync(tmp, file); // atomic replace so a crash can't corrupt notes
  } catch (err) {
    console.error('Could not save notes:', err);
  }
}

function saveStoreSoon() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveStoreNow, 300);
}

const findNote = (id) => store.notes.find((n) => n.id === id);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function plainText(html) {
  return String(html || '')
    .replace(/<(br|\/p|\/h[1-6]|\/li|\/tr)\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .trim();
}

function isEmpty(html) {
  return !plainText(html) && !/<(table|img)\b/i.test(html || '');
}

function preview(html) {
  const first = plainText(html).split('\n').find((l) => l.trim());
  if (!first) return /<img\b/i.test(html || '') ? 'Image note' : 'Empty note';
  const line = first.trim();
  return line.length > 34 ? line.slice(0, 33) + '…' : line;
}

function fitToDisplay(b) {
  const onScreen = screen.getAllDisplays().some((d) => {
    const a = d.workArea;
    return (
      b.x < a.x + a.width - 40 &&
      b.x + b.width > a.x + 40 &&
      b.y >= a.y - 10 &&
      b.y < a.y + a.height - 40
    );
  });
  if (onScreen) return b;
  const a = screen.getPrimaryDisplay().workArea;
  return { ...b, x: a.x + a.width - b.width - 40, y: a.y + 60 };
}

// ---------------------------------------------------------------------------
// Note windows
// ---------------------------------------------------------------------------
function applyPin(win, pinned) {
  if (win.isDestroyed()) return;
  if (pinned) {
    // 'floating' keeps the note above normal app windows (browser, editor...).
    win.setAlwaysOnTop(true, 'floating');
    if (IS_MAC) {
      // Show on every Space and above full-screen apps. The first call switches
      // the process to a menu-bar style app (no Dock icon); later calls skip that.
      win.setVisibleOnAllWorkspaces(true, {
        visibleOnFullScreen: true,
        skipTransformProcessType: transformed,
      });
      transformed = true;
    }
  } else {
    win.setAlwaysOnTop(false);
    if (IS_MAC) {
      win.setVisibleOnAllWorkspaces(false, { skipTransformProcessType: true });
    }
  }
}

// Opening an image large: the note window grows to most of the screen, then goes back.
// The enlarged size is never saved as the note's size (see rememberBounds).
function startZoom(win) {
  if (!win || win.isDestroyed() || zoomed.has(win)) return;
  const b = win.getBounds();
  const wa = screen.getDisplayMatching(b).workArea;
  const w = Math.min(wa.width - 80, Math.max(b.width, Math.round(wa.width * 0.7)));
  const h = Math.min(wa.height - 80, Math.max(b.height, Math.round(wa.height * 0.8)));
  zoomed.set(win, { x: b.x, y: b.y, width: b.width, height: b.height });
  win.setBounds(
    { x: Math.round(wa.x + (wa.width - w) / 2), y: Math.round(wa.y + (wa.height - h) / 2), width: w, height: h },
    true
  );
}

function endZoom(win) {
  const original = zoomed.get(win);
  if (!original) return;
  zoomed.delete(win);
  if (!win.isDestroyed()) win.setBounds(original, true);
}

// Collapse a note down to just its title bar (and back), like Apple Stickies.
function setCollapsed(note, win, collapsed) {
  if (!win || win.isDestroyed() || !!note.collapsed === collapsed) return;
  endZoom(win); // never collapse (or remember the size of) an enlarged window
  const b = win.getBounds();
  if (collapsed) {
    note.bounds = { x: b.x, y: b.y, width: b.width, height: b.height }; // remember full size
    note.collapsed = true;
    win.setMinimumSize(MIN_W, COLLAPSED_H);
    win.setMaximumSize(MAX_SIZE, COLLAPSED_H);
    win.setBounds({ x: b.x, y: b.y, width: b.width, height: COLLAPSED_H }, true);
  } else {
    note.collapsed = false;
    const height = Math.max(MIN_H, (note.bounds && note.bounds.height) || 320);
    // Keep the expanded note on screen if it was collapsed near the bottom edge.
    const wa = screen.getDisplayMatching(b).workArea;
    const y = Math.min(b.y, Math.max(wa.y, wa.y + wa.height - height));
    win.setMaximumSize(MAX_SIZE, MAX_SIZE);
    win.setMinimumSize(MIN_W, MIN_H);
    win.setBounds({ x: b.x, y, width: b.width, height }, true);
    note.bounds = { x: b.x, y, width: b.width, height };
  }
  win.webContents.send('note:collapsed', note.collapsed);
  saveStoreSoon();
  updateTraySoon();
}

function buildContextMenu(win, params) {
  const wc = win.webContents;
  const items = [];

  // Spelling: macOS's own spell checker underlines misspellings; this adds
  // the right-click suggestions and "Add to Dictionary".
  if (params.misspelledWord) {
    const guesses = (params.dictionarySuggestions || []).slice(0, 5);
    if (guesses.length) {
      for (const guess of guesses) {
        items.push({ label: guess, click: () => wc.replaceMisspelling(guess) });
      }
    } else {
      items.push({ label: 'No guesses found', enabled: false });
    }
    items.push(
      { type: 'separator' },
      {
        label: 'Add to Dictionary',
        click: () => wc.session.addWordToSpellCheckerDictionary(params.misspelledWord),
      },
      { type: 'separator' }
    );
  }

  if (params.isEditable) {
    items.push(
      { role: 'cut' },
      { role: 'copy' },
      { role: 'paste' },
      { role: 'pasteAndMatchStyle' },
      { type: 'separator' },
      { role: 'selectAll' }
    );
  } else if (params.selectionText) {
    items.push({ role: 'copy' });
  }
  return items;
}

function openWindow(note, { focus = false } = {}) {
  const existing = windows.get(note.id);
  if (existing && !existing.isDestroyed()) {
    existing.show();
    existing.focus();
    return existing;
  }

  note.open = true;
  saveStoreSoon();
  const b = fitToDisplay(note.bounds);
  const collapsed = !!note.collapsed;

  const win = new BrowserWindow({
    x: Math.round(b.x),
    y: Math.round(b.y),
    width: Math.round(b.width),
    height: collapsed ? COLLAPSED_H : Math.round(b.height),
    minWidth: MIN_W,
    minHeight: collapsed ? COLLAPSED_H : MIN_H,
    ...(collapsed ? { maxHeight: COLLAPSED_H } : {}),
    show: false,
    fullscreenable: false,
    // Stops a title-bar double-click from zooming/minimizing the note away
    // (with no Dock icon it would be hard to get back).
    maximizable: false,
    minimizable: false,
    hasShadow: true,
    acceptFirstMouse: true,
    backgroundColor: paper(note.color),
    ...(IS_MAC ? { titleBarStyle: 'hidden' } : { frame: false }),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: true,
    },
  });

  windows.set(note.id, win);
  idByWin.set(win, note.id);

  if (IS_MAC) win.setWindowButtonVisibility(false); // we draw our own buttons
  applyPin(win, note.pinned !== false);
  if (typeof note.opacity === 'number' && note.opacity < 1) win.setOpacity(note.opacity);

  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  win.once('ready-to-show', () => {
    if (focus) {
      win.show();
      win.focus();
    } else if (!allHidden) {
      win.showInactive();
    }
  });

  // Remember position and size. note.bounds is always the *expanded* size, so a
  // collapsed note only updates its position and width.
  let boundsTimer = null;
  const rememberBounds = () => {
    clearTimeout(boundsTimer);
    boundsTimer = setTimeout(() => {
      if (win.isDestroyed() || zoomed.has(win)) return; // an enlarged image view isn't the note's size
      const nb = win.getBounds();
      note.bounds = note.collapsed
        ? { ...note.bounds, x: nb.x, y: nb.y, width: nb.width }
        : nb;
      saveStoreSoon();
    }, 300);
  };
  win.on('move', rememberBounds);
  win.on('resize', rememberBounds);

  win.on('closed', () => {
    clearTimeout(boundsTimer);
    windows.delete(note.id);
    updateTraySoon();
  });

  // Keyboard shortcuts that must work even without a visible menu bar.
  win.webContents.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown') return;
    const mod = IS_MAC ? input.meta : input.control;
    if (!mod || input.alt || input.shift) return;
    const key = input.key.toLowerCase();
    if (key === 'n') {
      event.preventDefault();
      createNote();
    } else if (key === 'w') {
      event.preventDefault();
      closeNote(note.id);
    } else if (key === 'm') {
      event.preventDefault();
      setCollapsed(note, win, !note.collapsed);
    }
  });

  // Right-click: spelling suggestions + cut/copy/paste.
  win.webContents.on('context-menu', (_event, params) => {
    const items = buildContextMenu(win, params);
    if (items.length) Menu.buildFromTemplate(items).popup({ window: win });
  });

  // Notes never navigate; links open in the default browser.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (event, url) => {
    event.preventDefault();
    if (/^https?:\/\//i.test(url)) shell.openExternal(url);
  });

  updateTraySoon();
  return win;
}

function createNote(partial = {}) {
  if (allHidden) showAll();
  const wa = screen.getDisplayNearestPoint(screen.getCursorScreenPoint()).workArea;
  const n = store.notes.length;
  const step = (n % 8) * 26;
  const note = {
    id: crypto.randomUUID(),
    html: '',
    color: NEW_NOTE_COLORS[n % NEW_NOTE_COLORS.length],
    pinned: true,
    open: true,
    collapsed: false,
    opacity: 1,
    bounds: { x: wa.x + wa.width - 340 - step, y: wa.y + 50 + step, width: 320, height: 320 },
    updatedAt: Date.now(),
    ...partial,
  };
  store.notes.push(note);
  saveStoreSoon();
  openWindow(note, { focus: true });
  return note;
}

function closeNote(id) {
  const note = findNote(id);
  if (!note) return;
  if (isEmpty(note.html)) {
    deleteNote(id); // don't keep empty notes around
    return;
  }
  note.open = false;
  saveStoreSoon();
  const win = windows.get(id);
  if (win && !win.isDestroyed()) win.close();
  updateTraySoon();
}

function deleteNote(id) {
  store.notes = store.notes.filter((n) => n.id !== id);
  saveStoreSoon();
  const win = windows.get(id);
  windows.delete(id);
  if (win && !win.isDestroyed()) win.destroy();
  updateTraySoon();
}

// Notes sent "behind": hidden for now so the app underneath (your browser) comes
// forward, and brought back on top later. Not saved; a restart shows everything.
const behind = new Set();

function sendBehind(id) {
  const win = windows.get(id);
  if (!win || win.isDestroyed()) return;
  endZoom(win);
  behind.add(id);
  win.hide();
  updateTraySoon();
}

function bringBack() {
  for (const id of [...behind]) {
    behind.delete(id);
    const win = windows.get(id);
    const note = store.notes.find((n) => n.id === id);
    if (!win || win.isDestroyed() || !note) continue;
    applyPin(win, note.pinned !== false);
    win.showInactive();
    win.moveTop();
  }
  updateTraySoon();
}

function toggleBehind() {
  if (behind.size) return bringBack();
  for (const [id, w] of windows) if (!w.isDestroyed() && w.isVisible()) sendBehind(id);
}

function showAll() {
  allHidden = false;
  behind.clear();
  for (const w of windows.values()) if (!w.isDestroyed()) w.showInactive();
  updateTraySoon();
}

function toggleAll() {
  if (allHidden) {
    showAll();
    return;
  }
  allHidden = true;
  for (const w of windows.values()) if (!w.isDestroyed()) w.hide();
  updateTraySoon();
}

// ---------------------------------------------------------------------------
// IPC (renderer -> main)
// ---------------------------------------------------------------------------
function noteFor(event) {
  const win = BrowserWindow.fromWebContents(event.sender);
  const id = win && idByWin.get(win);
  return { win, note: id ? findNote(id) : null };
}

ipcMain.handle('note:get', (event) => {
  const { note } = noteFor(event);
  if (!note) return { html: '', color: 'yellow', pinned: true, collapsed: false, opacity: 1 };
  return {
    id: note.id,
    html: note.html,
    color: note.color,
    pinned: note.pinned !== false,
    collapsed: !!note.collapsed,
    opacity: typeof note.opacity === 'number' ? note.opacity : 1,
  };
});

ipcMain.on('note:save', (event, html) => {
  const { note } = noteFor(event);
  if (!note || typeof html !== 'string' || html.length > 60_000_000) return;
  if (note.html === html) return;
  note.html = html;
  note.updatedAt = Date.now();
  saveStoreSoon();
  updateTraySoon();
});

ipcMain.on('note:new', () => createNote());

ipcMain.on('note:close', (event) => {
  const { note } = noteFor(event);
  if (note) closeNote(note.id);
});

ipcMain.handle('note:delete', async (event) => {
  const { win, note } = noteFor(event);
  if (!note) return false;
  if (!isEmpty(note.html)) {
    const { response } = await dialog.showMessageBox(win, {
      type: 'warning',
      buttons: ['Delete', 'Cancel'],
      defaultId: 1,
      cancelId: 1,
      message: 'Delete this note?',
      detail: 'This can’t be undone.',
    });
    if (response !== 0) return false;
  }
  deleteNote(note.id);
  return true;
});

ipcMain.on('note:color', (event, color) => {
  const { win, note } = noteFor(event);
  if (!note || !isValidColor(color)) return;
  note.color = color;
  if (win && !win.isDestroyed()) win.setBackgroundColor(paper(color));
  saveStoreSoon();
});

ipcMain.handle('note:pin', (event) => {
  const { win, note } = noteFor(event);
  if (!note) return true;
  note.pinned = note.pinned === false; // toggle (undefined counts as pinned)
  applyPin(win, note.pinned);
  saveStoreSoon();
  return note.pinned;
});

ipcMain.on('note:send-behind', (event) => {
  const { note } = noteFor(event);
  if (note) sendBehind(note.id);
});

ipcMain.on('note:zoom-start', (event) => {
  const { win, note } = noteFor(event);
  if (win && note && !note.collapsed) startZoom(win);
});

ipcMain.on('note:zoom-end', (event) => {
  const { win } = noteFor(event);
  if (win) endZoom(win);
});

ipcMain.on('note:toggle-collapse', (event) => {
  const { win, note } = noteFor(event);
  if (note) setCollapsed(note, win, !note.collapsed);
});

ipcMain.on('note:opacity', (event, value) => {
  const { win, note } = noteFor(event);
  const v = Number(value);
  if (!note || !Number.isFinite(v)) return;
  note.opacity = Math.min(1, Math.max(MIN_OPACITY, v));
  if (win && !win.isDestroyed()) win.setOpacity(note.opacity);
  saveStoreSoon();
});

// ---------------------------------------------------------------------------
// Menu bar tray
// ---------------------------------------------------------------------------
function createTray() {
  const icon = nativeImage.createFromPath(path.join(__dirname, 'assets', 'trayTemplate.png'));
  tray = new Tray(icon.isEmpty() ? nativeImage.createEmpty() : icon);
  if (icon.isEmpty()) tray.setTitle('📝');
  tray.setToolTip('Stickies Plus');
  updateTray();
}

function updateTraySoon() {
  clearTimeout(trayTimer);
  trayTimer = setTimeout(updateTray, 400);
}

function updateTray() {
  if (!tray) return;
  const recent = store.notes
    .slice()
    .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
    .slice(0, 15);

  const noteItems = recent.length
    ? recent.map((n) => {
        const win = windows.get(n.id);
        return {
          label: preview(n.html),
          type: 'checkbox',
          checked: !!win && !win.isDestroyed(),
          click: () => {
            if (allHidden) showAll();
            behind.delete(n.id);
            openWindow(n, { focus: true });
            updateTraySoon();
          },
        };
      })
    : [{ label: 'No notes yet', enabled: false }];

  const template = [
    {
      label: 'New Note',
      accelerator: 'Control+Alt+N',
      registerAccelerator: false,
      click: () => createNote(),
    },
    {
      label: allHidden ? 'Show All Notes' : 'Hide All Notes',
      accelerator: 'Control+Alt+S',
      registerAccelerator: false,
      click: toggleAll,
    },
    {
      label: behind.size ? 'Bring Notes Back to Front' : 'Send Notes Behind',
      accelerator: 'Control+Alt+B',
      registerAccelerator: false,
      click: toggleBehind,
    },
    { type: 'separator' },
    { label: 'Notes', enabled: false },
    ...noteItems,
    { type: 'separator' },
  ];

  if (app.isPackaged) {
    template.push({
      label: 'Open at Login',
      type: 'checkbox',
      checked: app.getLoginItemSettings().openAtLogin,
      click: (item) => app.setLoginItemSettings({ openAtLogin: item.checked }),
    });
  }
  template.push({ role: 'quit', label: 'Quit Stickies Plus' });

  tray.setContextMenu(Menu.buildFromTemplate(template));
}

// ---------------------------------------------------------------------------
// App menu (needed so Copy/Paste/Undo work even though the bar is hidden)
// ---------------------------------------------------------------------------
function buildAppMenu() {
  const noteFromWindow = (win) => {
    const id = win && idByWin.get(win);
    return id ? findNote(id) : null;
  };
  const template = [
    {
      label: app.name,
      submenu: [{ role: 'about' }, { type: 'separator' }, { role: 'quit' }],
    },
    {
      label: 'Note',
      submenu: [
        { label: 'New Note', accelerator: 'CmdOrCtrl+N', registerAccelerator: false, click: () => createNote() },
        {
          label: 'Close Note',
          accelerator: 'CmdOrCtrl+W',
          registerAccelerator: false,
          click: (_item, win) => {
            const note = noteFromWindow(win);
            if (note) closeNote(note.id);
          },
        },
        {
          label: 'Collapse / Expand Note',
          accelerator: 'CmdOrCtrl+M',
          registerAccelerator: false,
          click: (_item, win) => {
            const note = noteFromWindow(win);
            if (note) setCollapsed(note, win, !note.collapsed);
          },
        },
      ],
    },
    { role: 'editMenu' },
    { label: 'View', submenu: [{ role: 'toggleDevTools' }] },
    // Custom Window menu: the stock one has Minimize/Zoom, which would hide a
    // note away with no Dock icon to bring it back from.
    { label: 'Window', role: 'window', submenu: [{ role: 'front' }] },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// ---------------------------------------------------------------------------
// Startup
// ---------------------------------------------------------------------------
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => createNote());

  // Closing the last note must not quit the app; it lives in the menu bar.
  app.on('window-all-closed', () => {});

  app.on('before-quit', saveStoreNow);
  app.on('will-quit', () => globalShortcut.unregisterAll());

  app.whenReady().then(() => {
    if (IS_MAC) app.dock.hide();
    loadStore();
    buildAppMenu();
    createTray();

    globalShortcut.register('Control+Alt+N', () => createNote());
    globalShortcut.register('Control+Alt+S', toggleAll);
    globalShortcut.register('Control+Alt+B', toggleBehind);

    if (store.notes.length === 0) {
      createNote({ html: WELCOME_HTML });
      return;
    }
    const toOpen = store.notes.filter((n) => n.open !== false);
    if (toOpen.length === 0) {
      createNote();
    } else {
      toOpen.forEach((n) => openWindow(n));
    }
  });
}
