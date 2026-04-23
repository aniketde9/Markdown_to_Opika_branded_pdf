'use strict';

const path = require('path');
const express = require('express');
const { inferTitle } = require('./builder');
const { buildDocument } = require('./buildDocument');
const { splitFrontmatter, isEmmTemplate } = require('./emmParse');

const app = express();
const PORT = Number(process.env.PORT) || 3847;
// Render and other hosts require listening on all interfaces; keep localhost for local dev.
const HOST =
  process.env.HOST ||
  (process.env.NODE_ENV === 'production' ? '0.0.0.0' : '127.0.0.1');
const BODY_LIMIT = process.env.BODY_LIMIT || '10mb';

app.get('/health', (_req, res) => {
  res.status(200).type('text/plain').send('ok');
});

app.use(express.static(path.join(__dirname, '../public')));
app.use(express.text({ type: ['text/plain', 'text/markdown'], limit: BODY_LIMIT }));
app.use(express.json({ limit: BODY_LIMIT }));

app.post('/convert', async (req, res) => {
  let markdown = '';
  if (typeof req.body === 'string') {
    markdown = req.body;
  } else if (req.body && typeof req.body.markdown === 'string') {
    markdown = req.body.markdown;
  }

  if (!markdown.trim()) {
    res.status(400).type('text/plain').send('Empty body: send text/plain markdown or JSON { "markdown": "..." }');
    return;
  }

  const title =
    (req.query.title && String(req.query.title)) ||
    (typeof req.body === 'object' && req.body && req.body.title) ||
    null;
  const subtitle =
    (req.query.subtitle && String(req.query.subtitle)) ||
    (typeof req.body === 'object' && req.body && req.body.subtitle) ||
    null;
  const cover = req.query.cover !== '0' && req.query.cover !== 'false';
  const header = req.query.header !== '0' && req.query.header !== 'false';
  const format = String(req.query.format || 'docx').toLowerCase() === 'pdf' ? 'pdf' : 'docx';

  const sp = splitFrontmatter(markdown);
  const docTitle =
    title ||
    (isEmmTemplate(sp.data) && sp.data.author && sp.data.author.name) ||
    inferTitle(sp.body, 'document');
  const safeName = docTitle.replace(/[^\w\- .]+/g, '').trim().slice(0, 80) || 'document';

  if (format === 'pdf') {
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${safeName}.pdf"`);
  } else {
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    );
    res.setHeader('Content-Disposition', `attachment; filename="${safeName}.docx"`);
  }

  try {
    await buildDocument({
      format,
      markdown,
      outputStream: res,
      title: title || undefined,
      subtitle,
      cover,
      header,
      fallbackTitle: 'Document',
    });
  } catch (err) {
    if (!res.headersSent) {
      res.status(500).type('text/plain').send(err.message || String(err));
    } else {
      res.end();
    }
  }
});

app.listen(PORT, HOST, () => {
  const where =
    HOST === '0.0.0.0'
      ? `port ${PORT} (0.0.0.0 — use your Render URL or http://localhost:${PORT})`
      : `http://${HOST}:${PORT}`;
  console.log(`md-to-pdf server ${where}`);
});
