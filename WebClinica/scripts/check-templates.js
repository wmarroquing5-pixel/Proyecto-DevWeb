/*
 * check-templates.js — Validador estatico de plantillas Angular.
 * Usa el mismo parser del AOT (ng build) para detectar errores tipo
 * NG5002 (parser), bloques @if/@for sin cerrar, @ dentro de {{ }},
 * if/else inline y parentesis desbalanceados en expresiones.
 * Uso: npm run check:templates   (exit 1 si hay errores)
 */
const fs = require('fs');
const path = require('path');
const { parseTemplate } = require('@angular/compiler');
const ts = require('typescript');

function walk(dir, out) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (p.endsWith('.component.html') || p.endsWith('.component.ts')) out.push(p);
  }
  return out;
}

const files = walk(path.join(__dirname, '..', 'src', 'app'), []);
const templates = [];
for (const f of files) {
  const source = fs.readFileSync(f, 'utf8');
  if (f.endsWith('.html')) {
    templates.push({ file: f, html: source });
    continue;
  }
  const ast = ts.createSourceFile(f, source, ts.ScriptTarget.Latest, true);
  function visit(node) {
    if (ts.isDecorator(node) && ts.isCallExpression(node.expression) &&
        node.expression.expression.getText(ast) === 'Component') {
      const metadata = node.expression.arguments[0];
      if (metadata && ts.isObjectLiteralExpression(metadata)) {
        for (const prop of metadata.properties) {
          if (ts.isPropertyAssignment(prop) && prop.name.getText(ast) === 'template' &&
              ts.isStringLiteralLike(prop.initializer)) {
            templates.push({ file: f + ' (inline)', html: prop.initializer.text });
          }
        }
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(ast);
}
let failed = 0;

for (const { file: f, html } of templates) {
  const problems = [];

  // Chequeos rapidos de antipatrones que rompieron builds anteriores
  const lines = html.split('\n');
  lines.forEach((line, i) => {
    if (/@\{\{|\}\}@/.test(line)) problems.push(`L${i + 1}: "@" pegado a una interpolacion {{ }}`);
    if (/@if\s*\([^)]*\)\s*\{\{/.test(line)) problems.push(`L${i + 1}: "@if" inline (debe ser bloque @if (...) { ... })`);
    if (/=>/.test(line)) problems.push(`L${i + 1}: arrow function "=>" en la plantilla (moverla al .ts)`);
    if (/\bnew Date\b|\bDate\.now/.test(line)) problems.push(`L${i + 1}: logica de fecha en plantilla (moverla al .ts)`);
  });

  // Parseo real con el parser de Angular (misma version que el build).
  // Se deduplican mensajes repetidos para que la salida sea legible.
  try {
    const res = parseTemplate(html, f, { preserveWhitespaces: false });
    const vistos = new Set();
    for (const err of res.errors || []) {
      const loc = err.sourceSpan && err.sourceSpan.start ? `L${err.sourceSpan.start.line + 1}` : '';
      const msg = `${loc}: ${String(err.msg).replace(/\s+/g, ' ').slice(0, 200)}`;
      if (!vistos.has(msg)) {
        vistos.add(msg);
        problems.push(msg);
      }
    }
  } catch (err) {
    problems.push('Parser lanzo excepcion: ' + String(err.message).split('\n')[0]);
  }

  if (problems.length) {
    failed++;
    console.error('FALLO ' + f);
    problems.slice(0, 10).forEach((p) => console.error('       ' + p.slice(0, 250)));
    if (problems.length > 10) console.error(`       ... y ${problems.length - 10} mas`);
  } else {
    console.log('OK    ' + f);
  }
}

console.log(`\n${templates.length} plantillas analizadas, ${failed} con problemas.`);
process.exit(failed ? 1 : 0);
