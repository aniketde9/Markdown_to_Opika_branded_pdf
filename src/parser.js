'use strict';

const { marked } = require('marked');

function parseMarkdown(mdText) {
  return marked.lexer(mdText);
}

module.exports = { parseMarkdown };
