'use strict';

const path = require('path');
const express = require('express');
const { buildPDF, inferTitle } = require('./builder');

const app = express();
const PORT = Number(process.env.PORT) || 3847;
const HOST = process.env.HOST || '127.0.0.1';
const BODY_LIMIT = process.env.BODY_LIMIT || '10mb';

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

  const docTitle = title || inferTitle(markdown, 'document');
  const safeName = docTitle.replace(/[^\w\- .]+/g, '').trim().slice(0, 80) || 'document';

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${safeName}.pdf"`);

  try {
    await buildPDF({
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
  console.log(`md-to-pdf server http://${HOST}:${PORT}`);
});
