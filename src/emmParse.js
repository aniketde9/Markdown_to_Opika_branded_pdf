'use strict';

const YAML = require('yaml');

/**
 * Split `---` YAML frontmatter from markdown body.
 * @returns {{ data: object | null, body: string }}
 */
function splitFrontmatter(markdown) {
  const s = String(markdown).replace(/^\uFEFF/, '');
  if (!s.startsWith('---')) {
    return { data: null, body: markdown };
  }
  const lines = s.split(/\n/);
  if (lines[0].trim() !== '---') {
    return { data: null, body: markdown };
  }
  let end = -1;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trim() === '---') {
      end = i;
      break;
    }
  }
  if (end === -1) {
    return { data: null, body: markdown };
  }
  const yamlText = lines.slice(1, end).join('\n');
  const body = lines.slice(end + 1).join('\n').replace(/^\n+/, '');
  let data;
  try {
    data = YAML.parse(yamlText);
  } catch (e) {
    const err = new Error(`Invalid YAML frontmatter: ${e.message}`);
    err.cause = e;
    throw err;
  }
  if (!data || typeof data !== 'object') {
    return { data: null, body: markdown };
  }
  return { data, body };
}

function isEmmTemplate(data) {
  if (!data || typeof data !== 'object') return false;
  if (data.template === 'emm') return true;
  if (data.emm === true) return true;
  if (data.engagementMemorandum === true) return true;
  return false;
}

module.exports = { splitFrontmatter, isEmmTemplate };
