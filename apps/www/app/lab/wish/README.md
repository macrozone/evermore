# Wish scope experiment

Open `/lab/wish`. This experiment estimates a wish before world generation;
its inspiration formula is provisional and does not establish game balance.

The controls stay above/alongside the result. The example list and result
details scroll independently. All 25 examples have hand-authored offline scope
fixtures. Unrecognised free text gets a clearly labelled generic placeholder;
offline mode does not interpret the wish or place. Every input/result can be
copied as JSON. Changing wish, place, model or mode clears recorded runs.
Influence and inspiration recalculate the decision locally without another
provider call. A smaller suggestion must be estimated again, and may still
exceed the budget.

## Formula and assumptions

`ceil((2 + area/8 + cells/64 + 3*structures) * complexity * (1 + 2*(1-influence)))`

Area is affected ground footprint in m², cells count the changed 3D volume,
and a cell is assumed to be one metre. Complexity ranges from 1 to 5. Models
estimate the full wish from wish/place only, without seeing the budget.
Influence zero always rejects and avoids a live call. An exact budget match is
accepted as a preview. No world generation or inspiration mutation occurs.

## Optional live mode

Start `apps/www` with `WISH_VERTEX_ENABLED=true`, using server-side Google ADC
and `GOOGLE_CLOUD_PROJECT` (default `maw-evermore`). Choose live mode explicitly
in the page, then estimate or repeat three times. The endpoint always uses
EU Vertex, the existing Flash-Lite / Flash / Pro allowlist, structured JSON,
a 12-second provider/credential budget and at most 1024 output tokens.

Live attempts are capped per server instance: 30 for the process lifetime,
6 per minute, one in flight. Provider failures consume an attempt. These are
instance safeguards, not an authenticated global quota; keep live mode disabled
on unrestricted deployments. Multiple instances/restarts reset or multiply
these limits. No secrets or raw provider error messages reach the client.

## Tokens and USD

Input, output and thinking token counts are displayed separately. Missing
thinking is inferred only from a complete reported total minus input/output
(the request uses no tools); otherwise missing usage stays unknown. A billed
invalid model response retains its usage/cost while displaying an offline
fallback. Unknown usage or an unpublished EU Pro rate gives an unknown cost.

Rates checked 2026-10-04: Flash-Lite EU $0.33 input / $2.75 output+thinking per
million tokens; Flash EU $1.65 / $8.25 before account-dependent promotional
credits. These estimates are not invoices. See the
[Vertex pricing reference](https://cloud.google.com/gemini-enterprise-agent-platform/generative-ai/pricing)
and [usage metadata definition](https://docs.cloud.google.com/gemini-enterprise-agent-platform/reference/rest/v1/GenerateContentResponse).

## Validation and observations

API/model tests cover input/output validation, credentials, timeouts, call
limits, influence/budget boundaries, output truncation, unknown usage and
consistency exclusion. Run `pnpm --filter @evermore/www test`.

With a local server running, `node scripts/check-wish.mjs` checks three viewport
sizes, scrolling, example/free text changes, model selection, influence and
inspiration extremes, offline repetitions, mocked live repeat variability,
stale-context clearing, JSON and smaller suggestions. Set `WISH_TEST_ORIGIN`
for another port. Screenshots and check output are in `docs/lab/screenshots/`.
Real paid model samples are stored separately in
`docs/lab/screenshots/wish-live-measurements.json`; mocked browser responses are
not model measurements. Live calls are never triggered by that browser check.

Three independent batches of three Flash-Lite estimates used exactly the
same wish/place context per wish. Flower-pot costs were [6,6,6] in all batches.
Castle costs were [10272,5958,36270], [36270,9083,9083], then [9083,9083,9083];
relative spreads (range/mean) were 173.2%, 149.8%, and 0%. All castle estimates
rejected a 100-inspiration budget. The final stable batch does not establish
reliable scope assessment. The earlier cohorts were recorded before the
complete-total token handling was added; their missing thinking/cost values
remain unknown in the raw record.

Final batch: pot 401 input / 80–95 output / 0 thinking tokens, 738–4308 ms,
$0.000352–$0.000394 per call. Castle 400 / 88–95 / 0, 677–758 ms,
$0.000374–$0.000393. A Flash herb-garden call took 1858 ms, 397 / 112 / 0,
estimated $0.001579; Pro returned the provider fallback after 123 ms with no
usage reported. These are small samples, not latency or quality benchmarks.
