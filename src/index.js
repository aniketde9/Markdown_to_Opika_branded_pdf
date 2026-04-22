'use strict';

const fs = require('fs');
const path = require('path');
const { program } = require('commander');
const { buildPDF, inferTitle } = require('./builder');
const { splitFrontmatter, isEmmTemplate } = require('./emmParse');

program
  .name('md-to-pdf')
  .description('Opika branded markdown to PDF — pure Node.js, zero API calls')
  .argument('[input]', 'Input markdown file path (omit with --stdin)')
  .argument('[output]', 'Output PDF path (default: input basename .pdf)')
  .option('--stdin', 'Read markdown from stdin')
  .option('-o, --output <path>', 'Output PDF path (required with --stdin)')
  .option('-t, --title <title>', 'Document title (overrides first H1)')
  .option('-s, --subtitle <s>', 'Subtitle on cover page')
  .option('--no-cover', 'Skip cover page')
  .option('--no-header', 'Skip running page header')
  .parse();

const opts = program.opts();
const [inputArg, outputArg] = program.args;

function readStdin() {
  return new Promise((resolve, reject) => {
    const chunks = [];
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (c) => chunks.push(c));
    process.stdin.on('end', () => resolve(chunks.join('')));
    process.stdin.on('error', reject);
  });
}

async function main() {
  let mdText;
  let fallbackTitle = 'Document';
  let outPath;

  if (opts.stdin) {
    if (!opts.output) {
      console.error('With --stdin, -o/--output <path> is required.');
      process.exit(1);
    }
    mdText = await readStdin();
    outPath = path.resolve(opts.output);
  } else {
    if (!inputArg) {
      console.error('Provide an input file or use --stdin with -o.');
      process.exit(1);
    }
    const inputPath = path.resolve(inputArg);
    if (!fs.existsSync(inputPath)) {
      console.error(`File not found: ${inputPath}`);
      process.exit(1);
    }
    mdText = fs.readFileSync(inputPath, 'utf-8');
    fallbackTitle = path.basename(inputPath, path.extname(inputPath)).replace(/[-_]/g, ' ');
    outPath = outputArg
      ? path.resolve(outputArg)
      : inputPath.replace(/\.md$/i, '.pdf');
  }

  const sp = splitFrontmatter(mdText);
  const docTitle =
    opts.title ||
    (isEmmTemplate(sp.data) && sp.data.author && sp.data.author.name) ||
    inferTitle(sp.body, fallbackTitle);

  try {
    await buildPDF({
      markdown: mdText,
      outputPath: outPath,
      title: docTitle,
      subtitle: opts.subtitle || null,
      cover: opts.cover !== false,
      header: opts.header !== false,
      fallbackTitle,
    });
    console.log(`✓  →  ${path.basename(outPath)}`);
  } catch (err) {
    console.error(err.message || err);
    process.exit(1);
  }
}

main();
