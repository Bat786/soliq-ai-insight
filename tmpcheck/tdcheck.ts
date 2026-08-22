import { loadTapeBoard, loadTapeDetail } from "../src/lib/tape.server";
for (const d of ["futures","fx","stocks"] as const) {
  const b = await loadTapeBoard(d);
  console.log(d, "pending", b.pending, "/", b.rows.length,
    b.rows.map(r=>`${r.key}:${r.source}:${r.status}:rsi${r.indicators.rsi14.toFixed(0)}:sig${r.signals.length}`).join(" "));
}
for (const k of ["GC","CL","EURUSD","NVDA"]) {
  const d = await loadTapeDetail(k, "1h");
  console.log(k, d.source, d.bars.length, d.last, d.indicators.verdict);
}
