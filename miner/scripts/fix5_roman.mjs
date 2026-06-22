import { readFileSync, writeFileSync, rmSync, readdirSync } from "node:fs";
import yaml from "js-yaml";
const DIR=process.env.HOME+"/Developer/korean-art-lexicon/data/persons/";
const AC="2026-06-22";
const CHANGE={ // MMCA 직접 URL 기반 융합형 채택(출처충실), 구 하이픈형은 변이
 "박현기":{slug:"park-hyunki",pref:"Park Hyunki",src:{url:"https://www.mmca.go.kr/eng/exhibitions/exhibitionsDetail.do?exhId=201501210000197",note:"MMCA 영문 《만다라》 + MoMA — 무하이픈(출처충실)"}},
 "박생광":{slug:"park-saengkwang",pref:"Park Saengkwang",src:{url:"https://www.mmca.go.kr/collections/collectionsDetailPage.do?wrkinfoSeqno=10171",note:"MMCA 소장품 'PARK Saengkwang' + 샌디에이고미술관 — 무하이픈"}},
 "민철홍":{slug:"min-chulhong",pref:"Min Chulhong",src:{url:"https://www.mmcaresearch.kr/terms/view.do?fid=2182",note:"MMCA Research Lab 'Min Chulhong' — 융합형(출처충실)"}},
};
const fileByKo={};
for(const f of readdirSync(DIR).filter(x=>x.endsWith(".yaml"))){const t=readFileSync(DIR+f,"utf8");const m=t.match(/full:\s*([가-힣]+)/);if(m&&!fileByKo[m[1]])fileByKo[m[1]]=f;}
for(const [ko,fx] of Object.entries(CHANGE)){
  const f=fileByKo[ko]; const rec=yaml.load(readFileSync(DIR+f,"utf8"));
  const old=rec.name.latn.preferred; rec.id=`person.${fx.slug}`; rec.name.latn={preferred:fx.pref};
  const vs=(rec.name.variants||[]).filter(v=>v.form!==fx.pref);
  if(old&&old!==fx.pref) vs.push({form:old,lang:"en",script:"Latn",type:"alternate",source:"RR 하이픈형(현행)",accessed:AC});
  rec.name.variants=vs;
  if(!(rec.sources||[]).some(x=>x.url===fx.src.url)) rec.sources=[{url:fx.src.url,name_used:fx.pref,note:fx.src.note,accessed:AC},...(rec.sources||[])];
  writeFileSync(DIR+`${fx.slug}.yaml`,yaml.dump(rec,{lineWidth:-1,noRefs:true})); if(f!==`${fx.slug}.yaml`)rmSync(DIR+f);
  console.log(`✓ ${ko} ${old}→${fx.pref}`);
}
