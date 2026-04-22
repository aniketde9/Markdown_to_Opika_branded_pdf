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
    pinkTint: '#FFF0F3',
    orangeTint: '#FFF4F0',
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
    coverTitle: 32,
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
    // Match template proportions: 0.75in top/bottom, 0.875in left/right.
    marginTop: 54,
    marginBottom: 54,
    marginLeft: 63,
    marginRight: 63,
    /**
     * Space reserved above bottom margin for body flow.
     * Disclaimer / page # render only on the last page; a smaller reserve reduces empty band on earlier pages.
     */
    footerReserve: 52,
  },

  memorandum: {
    coverNameSize: 24,
    coverBookSize: 12,
    /** Space between “PREPARED FOR” and recipient name. */
    coverGapPreparedToName: 12,
    /** Space between recipient name and book / subtitle line. */
    coverGapNameToBook: 16,
    coverLineGap: 2,
  },

  /** EMM layout rhythm — keep body typography consistent with PDFKit cursor rules. */
  emm: {
    lineGap: 2,
    /** Space after navy cover band before [A]/[B] links (keep tight to body). */
    afterPreparedBand: 8,
    afterAssetLine: 6,
    afterAssetBlock: 14,
    /** Section titles (Executive Summary, …): smaller than legacy h1 to match reference PDF. */
    sectionTitleSize: 15,
    sectionInsetTop: 0,
    ruleGapBelowHeading: 2,
    /** Space from pink rule to first body line (EMM only). */
    afterSectionRule: 2,
    afterIntro: 4,
    tableCellPadX: 12,
    /** Signal / default table body vertical padding. */
    tableCellPadY: 10,
    /** Journey map body rows — roomier than header (reference PDF proportions). */
    journeyTableCellPadY: 12,
    /** Header row vertical padding (signal + journey). */
    tableHeaderPadY: 5,
    /** No artificial minimum; row height comes from text + header padding only. */
    tableHeaderMinHeight: 0,
    /** Signal / Current State table header. */
    tableHeaderFontSize: 9,
    /** Journey headers: same size as signal table; keep single-line with lineBreak: false in render. */
    journeyHeaderFontSize: 9,
    /** Tighter line gap in table heads → fewer wrapped lines in narrow journey cells. */
    tableHeaderLineGap: 0,
    calloutPadX: 18,
    calloutPadY: 14,
    calloutBarWidth: 4,
    calloutInteriorGap: 8,
    proposalSpacing: 12,
  },

  get contentWidth() {
    return this.page.width - this.page.marginLeft - this.page.marginRight;
  },

  /** Max Y for body flow (running footer sits below this). */
  get bodyContentMaxY() {
    return this.page.height - this.page.marginBottom - this.page.footerReserve;
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
