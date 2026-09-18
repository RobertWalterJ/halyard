// Halyard — does the palette still carry its information without colour?
//
//   node build/audit-colour.mjs            report, and fail on any loss
//   node build/audit-colour.mjs --full     every check, including the passes
//
// The rule, the three channels and the engine all live in
// build/lib/audit-template.mjs, shared with the sibling apps. This file is only
// the part that is specific to Halyard: which tokens mean what, and where.

import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runAudit } from './lib/audit-template.mjs';

const SPEC = {
  files: ['app/styles.css'],
  pairs: [
    // The accent is an outline, a border and a fill, never a word, so it is
    // judged as a UI boundary at 3:1 rather than as text at 4.5:1.
    { a: '--orange', b: '--paper', channel: 'lightness',
      where: 'the focus ring and the accent borders against paper' },
    // Right and wrong sit in the same place on the same card, so a tick or a
    // cross has to be doing the work before colour is allowed to be subtle.
    { a: '--good', b: '--bad', channel: 'shape',
      where: 'the answer you picked: right against wrong' },
    { a: '--good-bg', b: '--bad-bg', channel: 'tint',
      where: 'the wash behind a graded answer' },
    { a: '--good-line', b: '--bad-line', channel: 'tint',
      where: 'the border of a graded answer' },
    // ...and the glyph that carries the meaning has to be legible on the wash
    // it is drawn over, or the claim above is empty.
  ],
  text: [
    { fg: '--bad', bg: '--bad-bg', where: 'the cross and its text on the wrong-answer wash' },
    { fg: '--good', bg: '--good-bg', where: 'the tick and its text on the right-answer wash' },
    { fg: '--ink', bg: '--paper', where: 'the flag name, the question' },
    { fg: '--ink-2', bg: '--paper', where: 'supporting lines' },
    { fg: '--ink-3', bg: '--paper', where: 'the quietest labels' },
    { fg: '--ink', bg: '--paper-2', where: 'raised cards' },

  ],
};

runAudit(SPEC, join(dirname(fileURLToPath(import.meta.url)), '..'));
