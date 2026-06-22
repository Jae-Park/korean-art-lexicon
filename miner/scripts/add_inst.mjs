import { readFileSync, writeFileSync } from "node:fs";
import yaml from "js-yaml";
const REPO=new URL("../..",import.meta.url).pathname;
const gate=JSON.parse(readFileSync(`${REPO}reports/miner/publish-gate.json`,"utf8")).needRoman;
const src=Object.fromEntries(gate.map(r=>[r.ko,r.sources||[]]));
const DOM={"sema.seoul.go.kr":"서울시립미술관 전시","mmca.go.kr":"국립현대미술관 전시","gmoma.ggcf.kr":"경기도미술관 전시","altpool.org":"아트스페이스 풀 전시"};
const dom=u=>{try{return new URL(u).hostname.replace(/^www\./,"")}catch{return""}};
const recs=[
  {ko:"조덕현",fam:"조",giv:"덕현",en:"Cho Duck Hyun",slug:"cho-duck-hyun",auth:[
    {url:"https://www.pkmgallery.com/artists/cho-duck-hyun/biography",name_used:"Cho Duck Hyun",note:"PKM Gallery 작가 약력 — 본인/갤러리 영문 표기(권위)",accessed:"2026-06-22"},
    {url:"https://www.mmca.go.kr/eng/exhibitions/exhibitionsDetail.do?exhId=201511090000354",name_used:"Cho Duck Hyun",note:"MMCA 영문 — 《The Garden of NIM: Cho Duck Hyun Archive》(2015)",accessed:"2026-06-22"}]},
  {ko:"문범",fam:"문",giv:"범",en:"Moon Beom",slug:"moon-beom",vars:["Moon Bum"],auth:[
    {url:"https://www.pkmgallery.com/exhibitions/moon-beom",name_used:"Moon Beom",note:"PKM Gallery — 본인/갤러리 영문 표기(권위)",accessed:"2026-06-22"}]},
];
for(const r of recs){
  const rec={id:`person.${r.slug}`,name:{ko:{full:r.ko,family:r.fam,given:r.giv},latn:{preferred:r.en}},role:[{aat:"300025103"}]};
  if(r.vars) rec.name.variants=r.vars.map(v=>({form:v,lang:"en",script:"Latn",type:"alternate",source:"갤러리/언론 변이",accessed:"2026-06-22"}));
  const sources=[...r.auth];
  for(const u of (src[r.ko]||[]).slice(0,3)){const d=dom(u);sources.push({url:u,name_used:r.ko,note:DOM[d]||`${d} 전시`,accessed:"2026-06-22"});}
  rec.sources=sources; rec.status="pending_review";
  writeFileSync(`${REPO}data/persons/${r.slug}.yaml`, yaml.dump(rec,{lineWidth:-1,noRefs:true}));
  console.log("등재:",r.ko,"→",r.en);
}
