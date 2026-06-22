import { readFileSync, writeFileSync } from "node:fs";
import yaml from "js-yaml";
const REPO = new URL("../..", import.meta.url).pathname;
const RIGHT=["이인성","김인승","이응노","오지호","요셉 보이스","김원숙"];
const wd=JSON.parse(readFileSync(`${REPO}reports/miner/wikidata-romanization.json`,"utf8"));
const gate=JSON.parse(readFileSync(`${REPO}reports/miner/publish-gate.json`,"utf8")).needRoman;
const srcByKo=Object.fromEntries(gate.map(r=>[r.ko,r.sources||[]]));
const TWO=["남궁","황보","제갈","사공","선우","독고","동방","서문"];
const slug=(en)=>en.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g,"").replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"");
const DOM={"sema.seoul.go.kr":"서울시립미술관 전시","mmca.go.kr":"국립현대미술관 전시","gmoma.ggcf.kr":"경기도미술관 전시","njp.ggcf.kr":"백남준아트센터 전시","altpool.org":"아트스페이스 풀 전시","neolook.com":"네오룩 전시 아카이브"};
const dom=(u)=>{try{return new URL(u).hostname.replace(/^www\./,"")}catch{return""}};
const CAVEAT={"이응노":"통상 'Lee Ungno'(고암) — preferred 에디터 검토","이인성":"통상 'Lee In-sung' — preferred 에디터 검토"};
let n=0;
for(const ko of RIGHT){
  const m=wd.matched.find(x=>x.ko===ko); if(!m) continue;
  const fam=TWO.find(f=>ko.startsWith(f))||ko[0];
  const id=slug(m.en);
  const rec={ id:`person.${id}`, name:{ ko:{full:ko,family:fam,given:ko.slice(fam.length)}, latn:{preferred:m.en} }, role:[{aat:"300025103"}], external_ids:{wikidata:m.qid} };
  if(m.aliases?.length) rec.name.variants=m.aliases.slice(0,4).map(a=>({form:a,lang:"en",script:"Latn",type:"alternate",source:"Wikidata",accessed:"2026-06-22"}));
  const sources=[{url:`https://www.wikidata.org/wiki/${m.qid}`,name_used:m.en,note:`Wikidata ${m.qid} — 로마자/동일성${CAVEAT[ko]?'. '+CAVEAT[ko]:''}`,accessed:"2026-06-22"}];
  for(const u of (srcByKo[ko]||[]).slice(0,4)){const d=dom(u);sources.push({url:u,name_used:ko,note:DOM[d]||`${d} 전시 출처`,accessed:"2026-06-22"});}
  rec.sources=sources; rec.status="pending_review";
  writeFileSync(`${REPO}data/persons/${id}.yaml`, yaml.dump(rec,{lineWidth:-1,noRefs:true})); n++;
}
// 3 WRONG 기록
const r=JSON.parse(readFileSync(`${REPO}reports/miner/wikidata-romanization.json`,"utf8"));
r.homonym_removed=[...(r.homonym_removed||[]).filter(x=>!["박광수","조덕현","문범"].includes(x.ko)),
  {ko:"박광수",reason:"민중미술 화가인데 WD=comics 동명이인 — 영문소스 재로마자"},
  {ko:"조덕현",reason:"설치작가인데 WD=Frank Cho 만화가 — 영문소스 재로마자"},
  {ko:"문범",reason:"추상화가 Moon Beom인데 WD=BG Muhn(문범강) — 영문소스 재로마자"}];
writeFileSync(`${REPO}reports/miner/wikidata-romanization.json`, JSON.stringify(r,null,1));
console.log(`재등재: ${n}건 (pending) | 제외기록: 박광수·조덕현·문범`);
