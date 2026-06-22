import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import yaml from "js-yaml";
const DIR=process.env.HOME+"/Developer/korean-art-lexicon/data/persons/";
const AC="2026-06-22";
const SQ={"전수천":3067,"강익중":7475,"김인겸":3518,"곽훈":492,"이형우":3045,"윤형근":441};
const fileByKo={};
for(const f of readdirSync(DIR).filter(x=>x.endsWith(".yaml"))){const t=readFileSync(DIR+f,"utf8");const m=t.match(/full:\s*(.+?)\s*$/m);if(m&&!fileByKo[m[1].trim()])fileByKo[m[1].trim()]=f;}
let n=0;
for(const [ko,sq] of Object.entries(SQ)){
  const f=fileByKo[ko]; if(!f){console.log("못찾음",ko);continue;}
  const rec=yaml.load(readFileSync(DIR+f,"utf8"));
  const before=(rec.sources||[]).length;
  let srcs=(rec.sources||[]).filter(s=>!/wikipedia\.org/.test(s.url||""));
  const removed=before-srcs.length;
  const url=`https://www.mmca.go.kr/collections/collectionsDetailPage.do?wrkinfoSeqno=${sq}`;
  if(!srcs.some(s=>s.url===url)) srcs=[{url,name_used:rec.name.latn.preferred,note:"MMCA 소장품 상세 페이지(작가별)",accessed:AC},...srcs];
  rec.sources=srcs;
  writeFileSync(DIR+f,yaml.dump(rec,{lineWidth:-1,noRefs:true}));
  console.log(`✓ ${ko} → 소장품 ${sq} (Wikipedia ${removed}건 제거)`); n++;
}
console.log("처리",n);
