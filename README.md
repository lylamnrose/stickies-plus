# Stickies Plus

Floating sticky notes for macOS with rich text and real, editable tables.

## Run it

You need a Mac and Node.js (https://nodejs.org, the LTS version is fine).

```bash
git clone https://github.com/lylamnrose/stickies-plus.git
cd stickies-plus
npm install
npm start
```

A welcome note appears and a note icon shows up in your menu bar. There is no Dock icon on purpose; the menu bar icon is the app's home.

## Make a double-clickable app

```bash
npm run pack
```

The app lands in `dist/mac-arm64/Stickies Plus.app` (or `dist/mac/` on Intel). Drag it to Applications. The app isn't code-signed, so the first time macOS may say it can't verify the developer: right-click the app, choose **Open**, then **Open** again (or allow it under System Settings > Privacy & Security). Once installed, the menu bar icon gets an **Open at Login** option.

## Using it

| Do this | How |
| --- | --- |
| New note | `⌘N`, the **+** button, or `⌃⌥N` from any app |
| Collapse to a title bar | Arrow button on the right of the title bar, or `⌘M`. Same again to expand |
| Close a note (keeps it) | `⌘W` or the **×** button. Reopen from the menu bar icon |
| Contents list (jump around a long note) | the **list** button in the title bar, or `⌘⇧L` |
| Hide / show every note | `⌃⌥S` or the menu bar icon |
| Send a note behind your browser, then bring it back | the **behind** button in the title bar (next to the pin); bring back with `⌃⌥B` or **Bring Notes Back to Front** in the menu bar icon |
| Keep on top | Pin icon (on by default). Pinned notes float over your browser, other windows, full-screen apps, and appear on every desktop |
| Change color / translucency | The dot in the title bar: 18 preset colors (including two dark ones), a custom color (hex code or sliders), and an opacity slider |
| Spelling | Misspelled words are underlined. Right-click for suggestions or **Add to Dictionary** |
| Delete | Trash icon (asks first if the note has text) |

Formatting bar (appears when the note is active): font picker, font size, bold, italic, underline, strikethrough, text color (**A**), highlight (marker), two heading sizes, bullet list, numbered list, checklist, table, image.

Colors: select text, click **A** for 12 text colors or the marker for 8 highlight colors. A small bar under each button shows the color at your cursor. "Default color" and "No highlight" undo them.

Custom colors: every color popup (text, highlight, table cells, and the note background) has a **Custom color** section under the swatches. Type a hex code like `#ff8800` and press Return, or drag the hue, saturation and lightness sliders and let go to apply. The note background previews live as you drag. Light and dark custom backgrounds automatically get dark or light text. Highlighted text stays dark so it reads on dark notes too.

Sizes: select text and pick a size (10 to 48) from the **Size** dropdown. "Size" at the top returns to normal.

Table cell colors: click in a cell (or drag across several), then **Cell color** in the table strip. "No fill" removes it.

Images: click the picture button, or paste a screenshot or copied picture (`⌘V`), or drag image files onto the note. PNG, JPEG, GIF (animated GIFs keep moving), WebP, SVG, BMP and AVIF work. Photos bigger than about 600 KB are scaled down to 1400 pixels on the long side and re-saved as WebP so your notes stay small; a single image can't be over 3 MB. HEIC photos (the iPhone/Photos default) aren't supported, so export them as JPEG or PNG first. Click an image to get size buttons (25%, 50%, 75%, 100%, Original) and **✕ Image** to delete it; it can also be dragged to a new spot.

To see an image large, **double-click it** (or select it and press **Zoom**). The picture fills just the note, on a dark background, so it works well for images inside table cells and never takes over your screen. Want more room? Press **⤢ Larger window** (top left of the overlay) and the note temporarily grows to most of your screen; press **⤡ Note size** to shrink it back. Click the picture to switch between fitted and actual size (scroll to look around), and press `Esc`, click the dark area, or press the × to close. The note always returns to exactly its old size and spot, and the enlarged size is never saved. Images are stored inside the note, so they travel with `notes.json`.

Fonts: pick text first (or just pick a font and keep typing), then choose from the dropdown at the left of the formatting bar. About two dozen macOS fonts in four groups: Clean, Serif, Typewriter & code, and Handwriting & fun. "Default font" goes back to the standard look. Different fonts can be mixed in one note.

Tables: click the table button, then use the row/column strip that appears while your cursor is inside the table. `Tab` jumps to the next cell and adds a row at the end. Drag a column border to resize. Drag across cells and press **Merge** to merge them.

Markdown shortcuts also work while typing: `# ` heading, `- ` bullet, `1. ` numbered, `[ ] ` checklist, `**bold**`, `_italic_`.

## Notes on behavior

- Opacity fades the whole note, text included (like Apple's "Translucent Window"). The lowest setting is about 40%.
- Spell checking uses the macOS spell checker, so it follows your system language. It underlines and suggests; it does not auto-correct.
- Collapsed notes remember their full size and position, and come back collapsed after a restart.

## Where notes are stored

`~/Library/Application Support/Stickies Plus/notes.json`, saved automatically. Back that file up if you care about your notes.

## Updating the app after a change

1. Quit Stickies Plus (menu bar icon, then Quit).
2. In Terminal, `cd` into the project folder, then `unzip -o <the update zip>`.
3. `npm install` (only needed when the update says it added something new).
4. `npm run pack`, then drag the new `Stickies Plus.app` from `dist/mac-arm64` into Applications, choosing Replace.

## Files

- `main.js`: windows, always-on-top behavior, collapse, menu bar icon, saving
- `preload.js`: the small bridge between a note and the app
- `renderer/`: the note itself (`editor.js` is bundled into `bundle.js` by `npm run build`)

## Scrolling tables

By default a table shrinks to fit the note. If a table gets too cramped to read, click inside it and press **Scroll** in the table toolbar: its columns keep a readable width and the table scrolls sideways inside the note, and a long table gets a window about 60% of the note's height that scrolls up and down, with the header row staying pinned at the top while you scroll. Press **Scroll** again to go back to fitting the note. It's a per-table setting, off by default, only affects that table, and is saved with the note.

## Contents list

Turn any line into a heading (**H1** / **H2** in the toolbar, or `⌘⌥3` for a small H3) and open the **Contents** button at the top left of the note. The headings appear in a list on the left; click one and the note scrolls to it and puts your cursor there. The entry for the part you're reading is highlighted, the list updates as you edit, and it remembers whether you left it open. In narrow notes it floats over the text instead of squeezing it.
