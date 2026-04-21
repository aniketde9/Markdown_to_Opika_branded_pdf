'use strict';

// Opika brand tokens — single source of truth for all drawing
const BRAND = {
  color: {
    navy: '#305A81',
    pink: '#FF4D71',
    orange: '#FF6545',
    lightblue: '#6BCEFF',
    yellow: '#FFCA3A',
    grey: '#C6CCD7',
    dark: '#212C35',
    white: '#FFFFFF',
    light: '#F4F6F9',
    green: '#2D9E6B',
    red: '#E03E3E',
    amber: '#E8890C',
  },

  font: {
    regular: 'Roboto-Regular',
    bold: 'Roboto-Bold',
    italic: 'Roboto-Italic',
    boldItalic: 'Roboto-BoldItalic',
    mono: 'JetBrainsMono-Bold',
  },

  size: {
    coverTitle: 38,
    coverSub: 14,
    h1: 22,
    h2: 16,
    h3: 13,
    body: 11,
    small: 9,
    footer: 7,
    tableHeader: 10,
    tableBody: 10,
    code: 9,
  },

  page: {
    width: 612,
    height: 792,
    marginTop: 72,
    marginBottom: 72,
    marginLeft: 72,
    marginRight: 72,
  },

  get contentWidth() {
    return this.page.width - this.page.marginLeft - this.page.marginRight;
  },

  space: {
    afterH1: 12,
    afterH2: 8,
    afterH3: 6,
    afterPara: 8,
    afterTable: 12,
    afterCode: 10,
    listIndent: 16,
    listItemGap: 4,
  },
};

module.exports = BRAND;
