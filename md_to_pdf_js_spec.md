# Markdown to Branded PDF — Pure JavaScript Spec

> Zero API calls. Zero paid services. Zero WeasyPrint. Pure Node.js.
> Feed this to Cursor and it builds the entire pipeline locally.

---

## Tool Decision

| Option | Verdict | Reason |
|---|---|---|
| **PDFKit** | YES | Pure Node.js, programmatic PDF generation, full font/color/layout control, battle-tested, 8M weekly downloads |
| **Puppeteer/Playwright print** | No | Requires Chromium install (~300MB), overkill |
| **WeasyPrint** | No | Python, system lib dependencies |
| **jsPDF** | No | Browser-first, weak Node.js support, limited layout |
| **pdfmake** | Maybe | Good but table layout is more constrained than PDFKit |

**PDFKit** is the call. It is the same mental model as the docx pipeline — you imperatively draw content onto a document object, call `.pipe()` to a file stream, and it writes a valid PDF. No browser, no system dependencies beyond `npm install`.

---

## How the Pipeline Works

```
input.md
    │
    ▼
marked (npm) — parse markdown into a token AST
    │
    ▼
Token Walker — walks the AST, calls PDFKit drawing commands per token type
    │  heading → doc.font('JetBrainsMono-Bold').fontSize(22).text(...)
    │  paragraph → doc.font('Roboto-Regular').fontSize(11).text(...)
    │  table → custom table renderer using doc.rect() + doc.text()
    │  code_block → shaded rect + monospace text
    │  blockquote → left border rect + indented text
    ▼
PDFKit Document object
    │
    ▼
output.pdf (written via fs.createWriteStream)
```

No HTML involved at any stage. Markdown AST goes directly to PDF drawing commands.

---

## Project Structure

```
md-to-pdf/
├── src/
│   ├── index.js          # CLI entry point
│   ├── parser.js         # markdown → token AST via marked
│   ├── renderer.js       # token AST → PDFKit draw calls
│   ├── cover.js          # cover page drawing
│   ├── tables.js         # table layout engine
│   └── brand.js          # all brand constants (colors, fonts, sizes)
├── fonts/
│   ├── Roboto-Regular.ttf
│   ├── Roboto-Bold.ttf
│   ├── Roboto-Italic.ttf
│   ├── RobotoBoldItalic.ttf
│   └── JetBrainsMono-Bold.ttf
├── assets/
│   └── opika_logo.png    # transparent PNG, ~120px wide
├── package.json
└── README.md
```

---

## Dependencies

### package.json

```json
{
  "name": "md-to-pdf",
  "version": "1.0.0",
  "description": "Opika branded markdown to PDF converter — pure Node.js",
  "main": "src/index.js",
  "type": "commonjs",
  "engines": { "node": ">=18.0.0" },
  "scripts": {
    "convert": "node src/index.js",
    "test": "node src/index.js sample.md test_output.pdf"
  },
  "dependencies": {
    "pdfkit": "^0.15.0",
    "marked": "^12.0.0",
    "commander": "^12.1.0"
  }
}
```

```bash
npm install
```

That is the entire install. Three packages. No system dependencies.

### Font Setup (one-time)

```bash
mkdir -p fonts

# Roboto — download from Google Fonts CDN directly
curl -L "https://github.com/googlefonts/roboto/releases/download/v2.138/roboto-unhinted.zip" \
  -o /tmp/roboto.zip && unzip /tmp/roboto.zip -d /tmp/roboto/
cp /tmp/roboto/Roboto-Regular.ttf   fonts/
cp /tmp/roboto/Roboto-Bold.ttf      fonts/
cp /tmp/roboto/Roboto-Italic.ttf    fonts/
cp /tmp/roboto/Roboto-BoldItalic.ttf fonts/

# JetBrains Mono — from GitHub releases
curl -L "https://github.com/JetBrains/JetBrainsMono/releases/download/v2.304/JetBrainsMono-2.304.zip" \
  -o /tmp/jbmono.zip && unzip /tmp/jbmono.zip -d /tmp/jbmono/
cp "/tmp/jbmono/fonts/ttf/JetBrainsMono-Bold.ttf" fonts/
```

---

## src/brand.js — All Brand Constants

```javascript
'use strict';

// Opika brand tokens — single source of truth for all drawing
const BRAND = {
  // Colors (PDFKit accepts hex strings)
  color: {
    navy:      '#305A81',
    pink:      '#FF4D71',
    orange:    '#FF6545',
    lightblue: '#6BCEFF',
    yellow:    '#FFCA3A',
    grey:      '#C6CCD7',
    dark:      '#212C35',
    white:     '#FFFFFF',
    light:     '#F4F6F9',
    green:     '#2D9E6B',
    red:       '#E03E3E',
    amber:     '#E8890C',
  },

  // Font family names — must match registerFont() calls in index.js
  font: {
    regular:     'Roboto-Regular',
    bold:        'Roboto-Bold',
    italic:      'Roboto-Italic',
    boldItalic:  'Roboto-BoldItalic',
    mono:        'JetBrainsMono-Bold',
  },

  // Font sizes in points
  size: {
    coverTitle:   38,
    coverSub:     14,
    h1:           22,
    h2:           16,
    h3:           13,
    body:         11,
    small:         9,
    footer:        7,
    tableHeader:  10,
    tableBody:    10,
    code:          9,
  },

  // Page geometry (US Letter = 612 x 792 points, 72pt = 1 inch)
  page: {
    width:        612,
    height:       792,
    marginTop:    72,    // 1 inch
    marginBottom: 72,
    marginLeft:   72,
    marginRight:  72,
  },

  // Derived content width (used everywhere)
  get contentWidth() {
    return this.page.width - this.page.marginLeft - this.page.marginRight;
  },

  // Spacing
  space: {
    afterH1:     12,
    afterH2:      8,
    afterH3:      6,
    afterPara:    8,
    afterTable:  12,
    afterCode:   10,
    listIndent:  16,
    listItemGap:  4,
  },
};

module.exports = BRAND;
```

---

## src/index.js — CLI Entry Point

```javascript
'use strict';

const PDFDocument = require('pdfkit');
const fs          = require('fs');
const path        = require('path');
const { program } = require('commander');
const BRAND       = require('./brand');
const { parseMarkdown }  = require('./parser');
const { renderTokens }   = require('./renderer');
const { drawCoverPage }  = require('./cover');

program
  .name('md-to-pdf')
  .description('Opika branded markdown to PDF — pure Node.js, zero API calls')
  .argument('<input>',           'Input markdown file path')
  .argument('[output]',          'Output PDF path (default: same name as input)')
  .option('-t, --title <title>', 'Document title (overrides first H1 in file)')
  .option('-s, --subtitle <s>',  'Subtitle shown on cover page')
  .option('--no-cover',          'Skip cover page')
  .option('--no-header',         'Skip running page header')
  .option('--no-footer',         'Skip page numbers')
  .parse();

const [inputArg, outputArg] = program.args;
const opts = program.opts();

// Resolve paths
const inputPath  = path.resolve(inputArg);
const outputPath = outputArg
  ? path.resolve(outputArg)
  : inputPath.replace(/\.md$/i, '.pdf');

if (!fs.existsSync(inputPath)) {
  console.error(`File not found: ${inputPath}`);
  process.exit(1);
}

// Read and parse markdown
const mdText = fs.readFileSync(inputPath, 'utf-8');

// Auto-detect title from first H1 if not provided
let docTitle = opts.title;
if (!docTitle) {
  const h1match = mdText.match(/^#\s+(.+)$/m);
  docTitle = h1match
    ? h1match[1].trim()
    : path.basename(inputPath, '.md').replace(/[-_]/g, ' ');
}

// Parse markdown to token array
const tokens = parseMarkdown(mdText);

// Create PDFKit document
const doc = new PDFDocument({
  size:           'LETTER',
  margins: {
    top:    BRAND.page.marginTop,
    bottom: BRAND.page.marginBottom,
    left:   BRAND.page.marginLeft,
    right:  BRAND.page.marginRight,
  },
  bufferPages:    true,    // Required for adding page numbers in a second pass
  autoFirstPage:  false,   // We manually add pages so cover has no margins
  info: {
    Title:    docTitle,
    Author:   'Opika',
    Creator:  'md-to-pdf',
  },
});

// Register fonts — do this BEFORE any text drawing
doc.registerFont('Roboto-Regular',    path.join(__dirname, '../fonts/Roboto-Regular.ttf'));
doc.registerFont('Roboto-Bold',       path.join(__dirname, '../fonts/Roboto-Bold.ttf'));
doc.registerFont('Roboto-Italic',     path.join(__dirname, '../fonts/Roboto-Italic.ttf'));
doc.registerFont('Roboto-BoldItalic', path.join(__dirname, '../fonts/Roboto-BoldItalic.ttf'));
doc.registerFont('JetBrainsMono-Bold',path.join(__dirname, '../fonts/JetBrainsMono-Bold.ttf'));

// Pipe to output file
const stream = fs.createWriteStream(outputPath);
doc.pipe(stream);

// ── COVER PAGE ──────────────────────────────────────────────────────────────
if (opts.cover !== false) {
  drawCoverPage(doc, docTitle, opts.subtitle || null);
  doc.addPage();  // Content starts on a new page after cover
}

// ── CONTENT PAGES ───────────────────────────────────────────────────────────
renderTokens(doc, tokens, {
  showHeader: opts.header !== false,
  title:      docTitle,
});

// ── PAGE NUMBERS (second pass via bufferPages) ──────────────────────────────
if (opts.footer !== false) {
  const totalPages = doc.bufferedPageRange().count;
  const startPage  = opts.cover !== false ? 1 : 0; // skip cover page (page 0) in numbering

  for (let i = startPage; i < totalPages; i++) {
    doc.switchToPage(i);

    // Left: confidential label
    doc
      .font(BRAND.font.regular)
      .fontSize(BRAND.size.footer)
      .fillColor(BRAND.color.grey)
      .text(
        'opika.co — Confidential',
        BRAND.page.marginLeft,
        BRAND.page.height - BRAND.page.marginBottom + 14,
        { align: 'left', lineBreak: false }
      );

    // Right: page number
    const displayPage = i - startPage + 1;
    const displayTotal = totalPages - startPage;
    doc
      .font(BRAND.font.mono)
      .fontSize(BRAND.size.footer)
      .fillColor(BRAND.color.grey)
      .text(
        `Page ${displayPage} of ${displayTotal}`,
        BRAND.page.marginLeft,
        BRAND.page.height - BRAND.page.marginBottom + 14,
        { align: 'right', lineBreak: false, width: BRAND.contentWidth }
      );
  }
}

doc.end();

stream.on('finish', () => {
  console.log(`✓  ${path.basename(inputPath)}  →  ${path.basename(outputPath)}`);
});

stream.on('error', (err) => {
  console.error('Write error:', err.message);
  process.exit(1);
});
```

---

## src/parser.js — Markdown Parser

```javascript
'use strict';

const { marked } = require('marked');

// Use marked's lexer to get a flat token array
// We use lexer directly (not marked()) so we get full control of rendering
function parseMarkdown(mdText) {
  // marked.lexer returns a token array — each token has a .type
  const tokens = marked.lexer(mdText);
  return tokens;
}

module.exports = { parseMarkdown };
```

---

## src/cover.js — Cover Page

```javascript
'use strict';

const path  = require('path');
const fs    = require('fs');
const BRAND = require('./brand');

function drawCoverPage(doc, title, subtitle) {
  // Cover page: full bleed, no margins, white background
  doc.addPage({ size: 'LETTER', margins: { top: 0, bottom: 0, left: 0, right: 0 } });

  const W = BRAND.page.width;
  const H = BRAND.page.height;

  // Navy top bar
  doc
    .rect(0, 0, W, 8)
    .fill(BRAND.color.navy);

  // Pink accent bar below navy
  doc
    .rect(0, 8, W, 3)
    .fill(BRAND.color.pink);

  // Logo — top right corner
  const logoPath = path.join(__dirname, '../assets/opika_logo.png');
  if (fs.existsSync(logoPath)) {
    doc.image(logoPath, W - 72 - 90, 36, { width: 90 });
  } else {
    // Fallback wordmark if logo file missing
    doc
      .font(BRAND.font.mono)
      .fontSize(14)
      .fillColor(BRAND.color.pink)
      .text('OPIKA', W - 72 - 80, 40, { width: 80, align: 'right' });
  }

  // Main title block — vertically centered
  const titleY = H * 0.38;

  // Title
  doc
    .font(BRAND.font.mono)
    .fontSize(BRAND.size.coverTitle)
    .fillColor(BRAND.color.navy)
    .text(title, 72, titleY, {
      width:     W - 144,
      align:     'left',
      lineBreak: true,
    });

  // Subtitle
  if (subtitle) {
    const titleHeight = doc.heightOfString(title, {
      font:  BRAND.font.mono,
      size:  BRAND.size.coverTitle,
      width: W - 144,
    });
    doc
      .font(BRAND.font.bold)
      .fontSize(BRAND.size.coverSub)
      .fillColor(BRAND.color.pink)
      .text(subtitle, 72, titleY + titleHeight + 14, {
        width:     W - 144,
        align:     'left',
        lineBreak: true,
      });
  }

  // Pink rule under title block
  doc
    .moveTo(72, H * 0.62)
    .lineTo(W - 72, H * 0.62)
    .lineWidth(1.5)
    .strokeColor(BRAND.color.pink)
    .stroke();

  // Bottom footer
  doc
    .font(BRAND.font.regular)
    .fontSize(9)
    .fillColor(BRAND.color.grey)
    .text('opika.co', 72, H - 48, { align: 'left', lineBreak: false });

  // Bottom navy bar
  doc
    .rect(0, H - 8, W, 8)
    .fill(BRAND.color.navy);
}

module.exports = { drawCoverPage };
```

---

## src/renderer.js — Token to PDF Renderer

This is the core of the pipeline. It walks the marked token array and issues PDFKit draw calls per token type.

```javascript
'use strict';

const BRAND      = require('./brand');
const { drawTable } = require('./tables');

// Track current Y position and page state
let state = {};

function initState(doc, showHeader, title) {
  state = {
    doc,
    showHeader,
    title,
    x:           BRAND.page.marginLeft,
    contentW:    BRAND.contentWidth,
    listDepth:   0,
    listCounters: [],
  };

  // Draw header on the first content page
  if (showHeader) drawHeader(doc, title);

  // Listen for new pages to re-draw header
  doc.on('pageAdded', () => {
    if (showHeader) drawHeader(doc, title);
  });
}

function drawHeader(doc, title) {
  const y = BRAND.page.marginTop - 28;

  // Thin rule
  doc
    .moveTo(BRAND.page.marginLeft, y + 14)
    .lineTo(BRAND.page.width - BRAND.page.marginRight, y + 14)
    .lineWidth(0.5)
    .strokeColor(BRAND.color.grey)
    .stroke();

  // Title left
  doc
    .font(BRAND.font.regular)
    .fontSize(BRAND.size.footer)
    .fillColor(BRAND.color.grey)
    .text(title, BRAND.page.marginLeft, y, {
      width:     BRAND.contentWidth * 0.7,
      align:     'left',
      lineBreak: false,
    });

  // OPIKA right
  doc
    .font(BRAND.font.mono)
    .fontSize(BRAND.size.footer)
    .fillColor(BRAND.color.pink)
    .text('OPIKA', BRAND.page.marginLeft, y, {
      width:     BRAND.contentWidth,
      align:     'right',
      lineBreak: false,
    });
}

function renderTokens(doc, tokens, opts = {}) {
  initState(doc, opts.showHeader || false, opts.title || '');

  for (const token of tokens) {
    renderToken(token);
  }
}

function renderToken(token) {
  const { doc } = state;

  switch (token.type) {

    case 'heading':
      renderHeading(token);
      break;

    case 'paragraph':
      renderParagraph(token);
      break;

    case 'list':
      renderList(token);
      break;

    case 'code':
      renderCode(token);
      break;

    case 'blockquote':
      renderBlockquote(token);
      break;

    case 'table':
      renderTable(token);
      break;

    case 'hr':
      renderRule();
      break;

    case 'space':
      doc.moveDown(0.4);
      break;

    // Skip html tokens, def tokens, etc.
    default:
      break;
  }
}

// ── HEADING ──────────────────────────────────────────────────────────────────

function renderHeading(token) {
  const { doc } = state;
  const level = token.depth;
  const text  = stripInlineTokens(token.tokens);

  // Map level to brand settings
  const cfg = {
    1: { font: BRAND.font.mono, size: BRAND.size.h1,   color: BRAND.color.navy, spaceBefore: 18, spaceAfter: BRAND.space.afterH1, rule: true  },
    2: { font: BRAND.font.mono, size: BRAND.size.h2,   color: BRAND.color.navy, spaceBefore: 14, spaceAfter: BRAND.space.afterH2, rule: false },
    3: { font: BRAND.font.bold, size: BRAND.size.h3,   color: BRAND.color.dark, spaceBefore: 10, spaceAfter: BRAND.space.afterH3, rule: false },
    4: { font: BRAND.font.bold, size: BRAND.size.body, color: BRAND.color.dark, spaceBefore:  8, spaceAfter: 4,                   rule: false },
  }[level] || { font: BRAND.font.bold, size: BRAND.size.body, color: BRAND.color.dark, spaceBefore: 6, spaceAfter: 4, rule: false };

  doc.moveDown(cfg.spaceBefore / 12);

  doc
    .font(cfg.font)
    .fontSize(cfg.size)
    .fillColor(cfg.color)
    .text(text, state.x, doc.y, { width: state.contentW, lineBreak: true });

  // H1 gets a pink underline rule
  if (cfg.rule) {
    const ruleY = doc.y + 3;
    doc
      .moveTo(state.x, ruleY)
      .lineTo(state.x + state.contentW, ruleY)
      .lineWidth(2.5)
      .strokeColor(BRAND.color.pink)
      .stroke();
    doc.moveDown(0.4);
  }

  doc.moveDown(cfg.spaceAfter / 12);
}

// ── PARAGRAPH ────────────────────────────────────────────────────────────────

function renderParagraph(token) {
  const { doc } = state;

  // Paragraphs may contain mixed inline tokens (strong, em, code, text, link)
  // We render as a series of text spans using doc.text() with { continued: true }
  renderInlineTokens(doc, token.tokens, state.x, state.contentW);

  doc.moveDown(BRAND.space.afterPara / 12);
}

// ── INLINE TOKEN RENDERER ────────────────────────────────────────────────────
// Handles bold, italic, code, links within paragraphs

function renderInlineTokens(doc, tokens, x, width) {
  if (!tokens || tokens.length === 0) return;

  doc.font(BRAND.font.regular).fontSize(BRAND.size.body).fillColor(BRAND.color.dark);

  const lastIdx = tokens.length - 1;
  tokens.forEach((t, i) => {
    const continued = i < lastIdx;

    switch (t.type) {
      case 'text':
        doc.text(t.raw || t.text || '', { continued, width });
        break;

      case 'strong':
        doc
          .font(BRAND.font.bold)
          .fillColor(BRAND.color.navy)
          .text(stripInlineTokens(t.tokens), { continued, width });
        doc.font(BRAND.font.regular).fillColor(BRAND.color.dark);
        break;

      case 'em':
        doc
          .font(BRAND.font.italic)
          .text(stripInlineTokens(t.tokens), { continued, width });
        doc.font(BRAND.font.regular);
        break;

      case 'codespan':
        // Inline code: draw a shaded rect behind the text
        // PDFKit doesn't support inline background spans natively,
        // so we use a light color text treatment instead
        doc
          .font(BRAND.font.mono)
          .fontSize(BRAND.size.code)
          .fillColor(BRAND.color.navy)
          .text(t.text, { continued, width });
        doc
          .font(BRAND.font.regular)
          .fontSize(BRAND.size.body)
          .fillColor(BRAND.color.dark);
        break;

      case 'link':
        doc
          .fillColor(BRAND.color.navy)
          .text(t.text, { continued, width, underline: true, link: t.href });
        doc.fillColor(BRAND.color.dark);
        break;

      case 'softbreak':
      case 'hardbreak':
        doc.text(' ', { continued, width });
        break;

      default:
        if (t.text || t.raw) {
          doc.text(t.text || t.raw, { continued, width });
        }
        break;
    }
  });
}

// ── LIST ──────────────────────────────────────────────────────────────────────

function renderList(token) {
  const { doc } = state;
  const ordered = token.ordered;
  let counter   = token.start || 1;

  for (const item of token.items) {
    const indent   = state.x + (state.listDepth * BRAND.space.listIndent);
    const textX    = indent + 16;
    const textW    = state.contentW - (state.listDepth * BRAND.space.listIndent) - 16;

    // Draw bullet or number
    if (ordered) {
      doc
        .font(BRAND.font.bold)
        .fontSize(BRAND.size.body)
        .fillColor(BRAND.color.navy)
        .text(`${counter}.`, indent, doc.y, { width: 14, lineBreak: false });
      counter++;
    } else {
      doc
        .circle(indent + 4, doc.y + 5.5, 2.5)
        .fill(BRAND.color.pink);
    }

    // Item text
    const startY = doc.y;
    doc
      .font(BRAND.font.regular)
      .fontSize(BRAND.size.body)
      .fillColor(BRAND.color.dark);

    // Check if item has nested content
    if (item.tokens && item.tokens.length > 0) {
      // Render inline content for the list item text
      const textTokens = item.tokens.filter(t => t.type !== 'list');
      if (textTokens.length > 0) {
        renderInlineTokens(doc, textTokens[0]?.tokens || [{ type: 'text', text: item.text }], textX, textW);
      }

      // Render nested lists
      state.listDepth++;
      for (const nested of item.tokens.filter(t => t.type === 'list')) {
        renderList(nested);
      }
      state.listDepth--;
    } else {
      doc.text(item.text, textX, startY, { width: textW });
    }

    doc.moveDown(BRAND.space.listItemGap / 12);
  }

  doc.moveDown(BRAND.space.afterPara / 12);
}

// ── CODE BLOCK ────────────────────────────────────────────────────────────────

function renderCode(token) {
  const { doc } = state;
  const text    = token.text;

  // Measure height needed
  const textHeight = doc.heightOfString(text, {
    font:  BRAND.font.mono,
    size:  BRAND.size.code,
    width: state.contentW - 28,
  });

  const boxH   = textHeight + 24;
  const boxX   = state.x;
  const boxY   = doc.y;
  const boxW   = state.contentW;

  // Check if block fits on current page — if not, add page
  if (boxY + boxH > BRAND.page.height - BRAND.page.marginBottom - 20) {
    doc.addPage();
  }

  const drawY = doc.y;

  // Background rect
  doc
    .rect(boxX, drawY, boxW, boxH)
    .fill(BRAND.color.light);

  // Left accent bar
  doc
    .rect(boxX, drawY, 3, boxH)
    .fill(BRAND.color.navy);

  // Code text
  doc
    .font(BRAND.font.mono)
    .fontSize(BRAND.size.code)
    .fillColor(BRAND.color.dark)
    .text(text, boxX + 14, drawY + 12, {
      width:       boxW - 28,
      lineBreak:   true,
      lineGap:     2,
    });

  doc.moveDown(BRAND.space.afterCode / 12);
}

// ── BLOCKQUOTE / CALLOUT ──────────────────────────────────────────────────────

function renderBlockquote(token) {
  const { doc } = state;

  // Extract plain text from nested tokens
  const innerText = token.tokens
    .map(t => {
      if (t.type === 'paragraph') return stripInlineTokens(t.tokens);
      return t.text || '';
    })
    .join(' ');

  const boxW    = state.contentW;
  const textH   = doc.heightOfString(innerText, {
    font:  BRAND.font.regular,
    size:  BRAND.size.body,
    width: boxW - 32,
  });
  const boxH    = textH + 24;
  const boxX    = state.x;
  const drawY   = doc.y;

  // Background
  doc.rect(boxX, drawY, boxW, boxH).fill(BRAND.color.light);

  // Pink left border
  doc.rect(boxX, drawY, 4, boxH).fill(BRAND.color.pink);

  // Text
  doc
    .font(BRAND.font.regular)
    .fontSize(BRAND.size.body)
    .fillColor(BRAND.color.navy)
    .text(innerText, boxX + 16, drawY + 12, {
      width:     boxW - 32,
      lineBreak: true,
    });

  doc.moveDown(BRAND.space.afterPara / 12);
}

// ── HORIZONTAL RULE ───────────────────────────────────────────────────────────

function renderRule() {
  const { doc } = state;
  doc
    .moveTo(state.x, doc.y + 4)
    .lineTo(state.x + state.contentW, doc.y + 4)
    .lineWidth(0.75)
    .strokeColor(BRAND.color.grey)
    .stroke();
  doc.moveDown(0.6);
}

// ── TABLE ──────────────────────────────────────────────────────────────────────

function renderTable(token) {
  drawTable(state.doc, token, state.x, state.contentW);
  state.doc.moveDown(BRAND.space.afterTable / 12);
}

// ── UTILITY ───────────────────────────────────────────────────────────────────

function stripInlineTokens(tokens) {
  if (!tokens) return '';
  return tokens.map(t => t.text || t.raw || '').join('');
}

module.exports = { renderTokens };
```

---

## src/tables.js — Table Layout Engine

Tables are the hardest part of PDFKit. This module handles column width calculation, cell wrapping, header shading, and alternating row colors.

```javascript
'use strict';

const BRAND = require('./brand');

function drawTable(doc, token, startX, totalWidth) {
  const headers  = token.header;   // array of cell objects
  const rows     = token.rows;     // array of row arrays
  const colCount = headers.length;

  // ── Column Width Distribution ──────────────────────────────────────────────
  // Strategy: equal width by default. For tables with a "description" column
  // (typically the longest), give it 40% and split the rest equally.
  // You can refine this heuristic per your data patterns.
  let colWidths;
  if (colCount === 1) {
    colWidths = [totalWidth];
  } else if (colCount === 2) {
    colWidths = [totalWidth * 0.35, totalWidth * 0.65];
  } else if (colCount === 3) {
    colWidths = [totalWidth * 0.25, totalWidth * 0.50, totalWidth * 0.25];
  } else if (colCount === 4) {
    colWidths = [totalWidth * 0.20, totalWidth * 0.35, totalWidth * 0.30, totalWidth * 0.15];
  } else {
    // Equal split for 5+ columns
    const w = totalWidth / colCount;
    colWidths = Array(colCount).fill(w);
  }

  const cellPadX = 8;
  const cellPadY = 7;

  // ── Header Row ─────────────────────────────────────────────────────────────
  let currentY = doc.y;

  // Measure header row height
  const headerHeight = measureRowHeight(doc, headers.map(h => getText(h)), colWidths, cellPadX, cellPadY, BRAND.font.bold, BRAND.size.tableHeader);

  // Check page fit — header + at least 2 data rows
  const minNeeded = headerHeight + (measureRowHeight(doc, rows[0]?.map(c => getText(c)) || [''], colWidths, cellPadX, cellPadY, BRAND.font.regular, BRAND.size.tableBody) * 2);
  if (currentY + minNeeded > BRAND.page.height - BRAND.page.marginBottom) {
    doc.addPage();
    currentY = doc.y;
  }

  // Draw header background
  doc.rect(startX, currentY, totalWidth, headerHeight).fill(BRAND.color.navy);

  // Draw header text
  let cellX = startX;
  headers.forEach((cell, i) => {
    doc
      .font(BRAND.font.bold)
      .fontSize(BRAND.size.tableHeader)
      .fillColor(BRAND.color.white)
      .text(getText(cell), cellX + cellPadX, currentY + cellPadY, {
        width:     colWidths[i] - (cellPadX * 2),
        lineBreak: true,
      });
    cellX += colWidths[i];
  });

  currentY += headerHeight;

  // ── Data Rows ──────────────────────────────────────────────────────────────
  rows.forEach((row, rowIdx) => {
    const texts    = row.map(c => getText(c));
    const rowBg    = rowIdx % 2 === 0 ? BRAND.color.white : BRAND.color.light;
    const rowHeight = measureRowHeight(doc, texts, colWidths, cellPadX, cellPadY, BRAND.font.regular, BRAND.size.tableBody);

    // Page break check
    if (currentY + rowHeight > BRAND.page.height - BRAND.page.marginBottom) {
      doc.addPage();
      currentY = doc.y;

      // Re-draw header on new page
      doc.rect(startX, currentY, totalWidth, headerHeight).fill(BRAND.color.navy);
      let hx = startX;
      headers.forEach((cell, i) => {
        doc
          .font(BRAND.font.bold)
          .fontSize(BRAND.size.tableHeader)
          .fillColor(BRAND.color.white)
          .text(getText(cell), hx + cellPadX, currentY + cellPadY, {
            width: colWidths[i] - (cellPadX * 2),
            lineBreak: true,
          });
        hx += colWidths[i];
      });
      currentY += headerHeight;
    }

    // Row background
    doc.rect(startX, currentY, totalWidth, rowHeight).fill(rowBg);

    // Row border
    doc
      .rect(startX, currentY, totalWidth, rowHeight)
      .lineWidth(0.5)
      .strokeColor(BRAND.color.grey)
      .stroke();

    // Cell text
    cellX = startX;
    texts.forEach((text, i) => {
      // Detect score values for color coding
      const color = getCellColor(text);
      doc
        .font(BRAND.font.regular)
        .fontSize(BRAND.size.tableBody)
        .fillColor(color)
        .text(text, cellX + cellPadX, currentY + cellPadY, {
          width:     colWidths[i] - (cellPadX * 2),
          lineBreak: true,
        });
      cellX += colWidths[i];
    });

    currentY += rowHeight;
  });

  // Move doc cursor to after table
  doc.y = currentY;
}

// Measure the height a row needs given its content and column widths
function measureRowHeight(doc, texts, colWidths, padX, padY, font, size) {
  let maxH = 0;
  texts.forEach((text, i) => {
    const h = doc.heightOfString(text, {
      font,
      size,
      width: colWidths[i] - (padX * 2),
    });
    if (h > maxH) maxH = h;
  });
  return maxH + (padY * 2);
}

// Extract text from a marked table cell token
function getText(cell) {
  if (typeof cell === 'string') return cell;
  if (cell.text) return cell.text;
  if (cell.tokens) return cell.tokens.map(t => t.text || t.raw || '').join('');
  return '';
}

// Optional: color-code cells that contain score-like values
function getCellColor(text) {
  if (/^(A|B)\s*$/.test(text.trim())) return BRAND.color.green;
  if (/^(F)\s*$/.test(text.trim())) return BRAND.color.red;
  if (/^(D)\s*$/.test(text.trim())) return BRAND.color.amber;
  if (/PASS/i.test(text)) return BRAND.color.green;
  if (/FAIL|blocked|timeout/i.test(text)) return BRAND.color.red;
  return BRAND.color.dark;
}

module.exports = { drawTable };
```

---

## Usage

```bash
# Install
npm install

# Basic — title auto-detected from first H1
node src/index.js website_grader_spec.md

# Custom title and subtitle
node src/index.js results_report.md output.pdf \
  --title "Website Grader Results" \
  --subtitle "Private Therapy Psychologists — Austin TX"

# No cover page
node src/index.js report.md --no-cover

# No header
node src/index.js report.md --no-header

# No footer / page numbers
node src/index.js report.md --no-footer
```

---

## Critical Rules

```
FONTS
- registerFont() must be called before ANY text draw call
- Font name strings in registerFont() must exactly match what you pass to doc.font()
- All four weights needed: Regular, Bold, Italic, BoldItalic

LAYOUT
- doc.y is the current vertical cursor — read it, move it, never assume it
- doc.text() advances doc.y automatically after each call
- doc.heightOfString() does NOT advance doc.y — use it to pre-measure before drawing
- PDFKit has no concept of "flex" or "grid" — everything is absolute X/Y positioning
- Use { continued: true } on doc.text() for inline spans — last span has continued: false

PAGES
- bufferPages: true in constructor = required for second-pass page numbering
- doc.switchToPage(n) + doc.bufferedPageRange() = how you add page numbers after all content is written
- autoFirstPage: false = required when you want manual control of the first page (cover)
- doc.addPage() triggers the 'pageAdded' event — use it to re-draw running headers

TABLES
- There is no native table in PDFKit — you draw rects and text manually
- Always pre-measure row heights with heightOfString() before drawing
- Always check if a row fits before drawing — add a new page if not
- Re-draw the header row at the top of each new page for continued tables

IMAGES
- doc.image(path, x, y, { width: N }) — width scales proportionally
- PNG with transparency works natively
- JPEG also works natively
- No SVG support — convert to PNG first if needed

STREAMS
- doc.pipe(fs.createWriteStream(...)) before any content
- doc.end() after all content
- Listen to stream 'finish' event to confirm write completed
```

---

## Integrating Into the Website Grader Pipeline

After scoring runs, call the converter directly from Node to auto-generate a PDF:

```javascript
// In src/index.js of the website-grader project, after CSV is written:

const { execSync } = require('child_process');

execSync(
  `node /path/to/md-to-pdf/src/index.js ${markdownReportPath} ${pdfOutputPath} ` +
  `--title "Website Grader — ${profession} — ${location}" ` +
  `--subtitle "Opika Competitive Analysis"`,
  { stdio: 'inherit' }
);
```

Or import directly (no subprocess):

```javascript
// If md-to-pdf is in the same monorepo
const { buildPDF } = require('../md-to-pdf/src/builder');
await buildPDF({ input: mdPath, output: pdfPath, title, subtitle });
```

For the direct import pattern, refactor `index.js` to export a `buildPDF(opts)` async function that wraps the PDFKit pipeline and resolves when the stream finishes.

---

*End of spec. Three npm packages. Zero system dependencies. Feed to Cursor and build.*
