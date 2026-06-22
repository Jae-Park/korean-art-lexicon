// 89 Wikidata 매칭 작가 → data/persons/{slug}.yaml (status=pending_review, 에디터 검토 대기).
// Source-First: 로마자=Wikidata 출처, 출현=기관 전시 출처(gate). 변이=Wikidata 별칭.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import yaml from "js-yaml";
const REPO = new URL("../..", import.meta.url).pathname;
const wd = JSON.parse(readFileSync(`${REPO}reports/miner/wikidata-romanization.json`,"utf8")).matched;
const gate = JSON.parse(readFileSync(`${REPO}reports/miner/publish-gate.json`,"utf8")).needRoman;
const srcByKo = Object.fromEntries(gate.map(r=>[r.ko, r.sources||[]]));
const TWO=["남궁","황보","제갈","사공","선우","독고","동방","서문"];
const slug=(en)=>en.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g,"").replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"");
const DOM={"sema.seoul.go.kr":"서울시립미술관 전시","mmca.go.kr":"국립현대미술관 전시","gmoma.ggcf.kr":"경기도미술관 전시","njp.ggcf.kr":"백남준아트센터 전시","altpool.org":"아트스페이스 풀 전시","neolook.com":"네오룩 전시 아카이브"};
const dom=(u)=>{try{return new URL(u).hostname.replace(/^www\./,"")}catch{return""}};
const seen=new Set(); let n=0; const flagged=[];
for(const m of wd){
  const fam=TWO.find(f=>m.ko.startsWith(f))||m.ko[0];
  let id=slug(m.en); if(seen.has(id))id=id+"-2"; seen.add(id);
  const rec={ id:`person.${id}`, name:{ ko:{full:m.ko,family:fam,given:m.ko.slice(fam.length)}, latn:{preferred:m.en} }, role:[{aat:"300025103"}], external_ids:{wikidata:m.qid} };
  if(m.aliases?.length) rec.name.variants=m.aliases.slice(0,4).map(a=>({form:a,lang:"en",script:"Latn",type:"alternate",source:"Wikidata",accessed:"2026-06-22"}));
  const sources=[{url:`https://www.wikidata.org/wiki/${m.qid}`,name_used:m.en,note:`Wikidata ${m.qid} — 로마자 표기 및 동일성 출처`,accessed:"2026-06-22"}];
  for(const u of (srcByKo[m.ko]||[]).slice(0,4)){ const d=dom(u); sources.push({url:u,name_used:m.ko,note:DOM[d]||`${d} 전시 출처(교차검증)`,accessed:"2026-06-22"}); }
  rec.sources=sources; rec.status="pending_review";
  const path=`${REPO}data/persons/person.${id}.yaml`;
  // 기존 슬러그 충돌 방지(파일명)
  const fpath=`${REPO}data/persons/${id}.yaml`;
  if(existsSync(fpath)){ flagged.push(`${m.ko}(${id}) 파일존재→skip`); continue; }
  writeFileSync(fpath, yaml.dump(rec,{lineWidth:-1,noRefs:true})); n++;
  if(!m.nameMatch) flagged.push(`${m.ko}→${m.en} (한글라벨 불일치 — 확인요)`);
}
console.log(`생성: ${n}개 → data/persons/`);
console.log("플래그(확인 필요):", flagged.length);
flagged.forEach(f=>console.log("  "+f));
