// Agent-run audit for multi-agent pipelines: reviews a recorded agent trace for the
// operational failure modes eval and monitoring stacks exist to catch - tool-call
// loops, swallowed errors, retrieval used without any check, final answers that do
// not appear grounded in tool output, and runs with no eval step at all.
// Heuristic review of one pasted trace, not a production monitor. Pure functions, no DOM.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.AgentRunAudit = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  const STOP = new Set(['the','a','an','and','or','of','to','in','for','on','is','are','was','were','with','that','this','by','as','at','from','it','its','be','been','has','have','had']);
  function keywords(s) {
    return new Set((String(s).toLowerCase().match(/[a-z0-9]+/g) || []).filter((t) => t.length > 2 && !STOP.has(t)));
  }
  function overlap(a, b) {
    const ka = keywords(a), kb = keywords(b);
    if (!ka.size || !kb.size) return 0;
    let hit = 0;
    for (const t of ka) if (kb.has(t)) hit++;
    return hit / ka.size;
  }
  function parseTrace(input) {
    const steps = [];
    const skipped = [];
    input.split('\n').forEach((raw, i) => {
      const line = raw.trim();
      if (!line) return;
      const p = raw.split('|').map((s) => s.trim());
      if (p.length >= 2 && p[0]) steps.push({ type: p[0].toLowerCase(), text: p.slice(1).join(' | '), line: i + 1 });
      else skipped.push(i + 1);
    });
    return { steps, skipped };
  }
  function audit(input) {
    const { steps, skipped } = typeof input === 'string' ? parseTrace(input) : input;
    const findings = [];
    const push = (level, code, text) => findings.push({ level, code, text });
    const isType = (s, re) => re.test(s.type);

    for (let i = 2; i < steps.length; i++) {
      const a = steps[i - 2], b = steps[i - 1], c = steps[i];
      if (isType(a, /^tool/) && a.type === b.type && b.type === c.type && a.text === b.text && b.text === c.text)
        push('error', 'LOOP_SUSPECT', `Lines ${a.line}-${c.line}: tool "${a.type}" called 3x in a row with identical input "${a.text.slice(0, 60)}" - possible retry loop; check the loop guard.`);
    }
    steps.forEach((s, i) => {
      if (/error|fail|timeout|exception/i.test(s.text) && isType(s, /^tool/)) {
        const next = steps.slice(i + 1, i + 3);
        const handled = next.some((n) => /retry|abort|fallback|escalat|check|eval/i.test(n.type + ' ' + n.text));
        if (!handled)
          push('warn', 'ERROR_POSSIBLY_SWALLOWED', `Line ${s.line}: tool step reports an error ("${s.text.slice(0, 60)}") with no visible retry/fallback/eval step after it in this trace.`);
      }
    });
    const retrievals = steps.filter((s) => /retriev|search|fetch|lookup|rag/i.test(s.type));
    const evals = steps.filter((s) => /eval|check|verif|validat|grade|score/i.test(s.type));
    const final = steps.filter((s) => /final|answer|respond|output/i.test(s.type));
    if (retrievals.length && !evals.length)
      push('error', 'NO_EVAL_STEP', `${retrievals.length} retrieval step(s) but no eval/check/validation step anywhere in this trace - nothing verified the retrieved content before use.`);
    if (final.length) {
      const toolText = steps.filter((s) => isType(s, /^tool/) || /retriev|search|fetch/i.test(s.type)).map((s) => s.text).join(' ');
      final.forEach((f) => {
        if (toolText && overlap(f.text, toolText) < 0.5)
          push('warn', 'FINAL_POSSIBLY_UNGROUNDED', `Line ${f.line}: final answer shares <50% keyword overlap with any tool output in this trace (heuristic) - may not be grounded in retrieved data; review manually.`);
      });
    }
    if (skipped.length) push('warn', 'UNPARSED', `Line(s) ${skipped.join(', ')} skipped - expected type | detail.`);
    if (!findings.length && steps.length)
      push('ok', 'CLEAN_RUN', `No issues detected in ${steps.length} step(s) by these heuristics - a single-trace review, not a production monitor; see Limitations.`);
    return { findings, stats: { steps: steps.length, retrievals: retrievals.length, evals: evals.length } };
  }
  return { parseTrace, audit, overlap, keywords };
});
