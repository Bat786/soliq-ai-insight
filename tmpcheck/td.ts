import { twelveDataBars } from "../src/lib/twelvedata.server";
for (const s of ["XAU/USD","XAG/USD","XPT/USD","WTI/USD","NG/USD","COPPER/USD","NVDA","EUR/USD"]) {
  const b = await twelveDataBars(s, "1h", 100).catch((e)=>{console.log(s,"err",(e as Error).message); return null;});
  console.log(s, b ? `${b.length} bars last ${b.at(-1)!.close}` : "null");
  await new Promise(r=>setTimeout(r,9000));
}
