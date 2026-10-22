# Agent Run Audit

A client-side heuristic audit of recorded agent traces, built with Catalyst·Wayfare's problem in mind: multi-agent orchestrations for enterprise clients need deterministic checks, evals and monitoring, because agent runs fail quietly.

Paste an agent trace, one step per line as `type | detail`, and the audit flags potential issues:

- **LOOP_SUSPECT** - the same tool called 3+ times consecutively with identical input
- **ERROR_POSSIBLY_SWALLOWED** - a tool error with no visible retry, fallback or eval step after it
- **NO_EVAL_STEP** - retrieval steps but no eval/check/validation step anywhere in the trace
- **FINAL_POSSIBLY_UNGROUNDED** - final answer with low keyword overlap to any tool output (heuristic)
- **UNPARSED** - trace lines that do not match the expected format

Plain HTML, CSS and JavaScript. No build step, no external services.

## Run

Open `index.html` in a browser, paste a trace, click "Run audit".

## Test

```
npm test
```

## Limitations

This is a single-trace heuristic review, not a production monitoring or eval system:

- Rules inspect one pasted trace; context outside the trace (retries in another span, evals in a separate pipeline stage) is invisible, so false positives are expected.
- The grounding check is keyword overlap, not semantic verification - a correct paraphrase can score low.
- Step types are matched by name patterns; unconventional naming hides steps from the rules.
- Tests verify the rules match their intended sample patterns; they do not prove the audit catches real production failures.
