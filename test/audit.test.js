const test = require('node:test');
const assert = require('node:assert/strict');
const { audit } = require('../audit.js');
const codes = (r) => r.findings.map((f) => f.code);

test('flags 3 identical consecutive tool calls as a suspected loop', () => {
  const r = audit('tool:search | grid capacity texas\ntool:search | grid capacity texas\ntool:search | grid capacity texas');
  assert.ok(codes(r).includes('LOOP_SUSPECT'));
});

test('does not flag two identical calls', () => {
  const r = audit('tool:search | grid capacity\ntool:search | grid capacity\neval:check | verified capacity figures');
  assert.ok(!codes(r).includes('LOOP_SUSPECT'));
});

test('flags tool error with no handling step after it', () => {
  const r = audit('tool:fetch | error: timeout after 30s\nfinal:answer | the grid capacity figures show steady growth in capacity');
  assert.ok(codes(r).includes('ERROR_POSSIBLY_SWALLOWED'));
});

test('does not flag error followed by retry', () => {
  const r = audit('tool:fetch | error: timeout\naction:retry | retrying fetch with backoff\neval:check | verified');
  assert.ok(!codes(r).includes('ERROR_POSSIBLY_SWALLOWED'));
});

test('flags retrieval with no eval step', () => {
  const r = audit('tool:retrieve | grid capacity documents\ntool:retrieve | more capacity data');
  assert.ok(codes(r).includes('NO_EVAL_STEP'));
});

test('flags final answer with low overlap to tool outputs', () => {
  const r = audit('tool:retrieve | transformer capacity ratings\neval:check | verified retrieval\nfinal:answer | quantum computing advances rapidly');
  assert.ok(codes(r).includes('FINAL_POSSIBLY_UNGROUNDED'));
});

test('clean run passes', () => {
  const r = audit('tool:retrieve | transformer capacity ratings\neval:check | verified capacity figures against sources\nfinal:answer | transformer capacity ratings summary');
  assert.deepEqual(codes(r), ['CLEAN_RUN']);
  assert.equal(r.stats.steps, 3);
});
