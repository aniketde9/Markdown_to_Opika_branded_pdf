'use strict';

/**
 * Marked's lexer stores HTML-escaped `text` on inline tokens (e.g. &quot; inside **strong**).
 * PDF output should show real characters, not entities.
 */
function decodeHtmlEntities(s) {
  if (s == null || s === '') return s;
  return String(s)
    .replace(/&#x([\da-fA-F]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

module.exports = { decodeHtmlEntities };
