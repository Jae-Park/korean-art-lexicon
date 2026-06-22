import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import yaml from "js-yaml";
const DIR=process.env.HOME+"/Developer/korean-art-lexicon/data/persons/";
const AC="2026-06-22";
const UP={"A.R. 펭크":3025,"크리스토":2255,"앤디워홀":2252,"짐다인":3108,"양 푸동":7940,"안중식":3931,"고희동":126,"박수근":85};
const fileByKo={};
for(const f of readdirSync(DIR).filter(x=>x.endsWith(".yaml"))){const t=readFileSync(DIR+f,"utf8");const m=t.match(/full:\s*(.+?)\s*$/m);if(m&&!fileByKo[m[1].trim()])fileByKo[m[1].trim()]=f;}
let n=0;
for(const [ko,sq] of Object.entries(UP)){
  const f=fileByKo[ko]; if(!f){console.log("못찾음",ko);continue;}
  const rec=yaml.load(readFileSync(DIR+f,"utf8"));
  const url=`https://www.mmca.go.kr/collections/collectionsDetailPage.do?wrkinfoSeqno=${sq}`;
  if((rec.sources||[]).some(s=>s.url===url)){console.log("=이미",ko);continue;}
  rec.sources=[{url,name_used:rec.name.latn.preferred,note:"MMCA 소장품 상세 페이지(작가별)",accessed:AC},...(rec.sources||[])];
  writeFileSync(DIR+f,yaml.dump(rec,{lineWidth:-1,noRefs:true}));
  console.log(`✓ ${ko} → 소장품 ${sq} (${rec.name.latn.preferred})`); n++;
}
console.log("교체",n);
