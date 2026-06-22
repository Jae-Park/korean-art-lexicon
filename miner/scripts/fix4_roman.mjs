import { readFileSync, writeFileSync, rmSync, readdirSync } from "node:fs";
import yaml from "js-yaml";
const DIR=process.env.HOME+"/Developer/korean-art-lexicon/data/persons/";
const AC="2026-06-22";
const CHANGE={ // preferred 교체+rename, 구형은 변이
 "이유태":{slug:"lee-yootae",pref:"Lee Yootae",src:{url:"https://www.mmca.go.kr/collections/collectionsDetailPage.do?wrkinfoSeqno=3891",note:"MMCA 소장품 'LEE Yootae' — 출처충실"}},
};
const CAPS={ // 케이싱 교정 + src (+변이)
 "민병헌":{pref:"Min Byung-hun",src:{url:"https://www.koreaherald.com/article/2485218",note:"코리아헤럴드 — 케이싱(Byung-Hun→Byung-hun)"},addvar:{form:"Byung-hun Min",note:"국제 갤러리(Peter Fetterman/Miyako Yoshinaga) 표기"}},
 "오치균":{pref:"Oh Chi-gyun",src:{url:"https://www.koreaherald.com/article/3390947",note:"코리아헤럴드 — 케이싱(Chi-Gyun→Chi-gyun)"}},
};
const ADDSRC={
 "남관":{url:"https://www.galleryhyundai.com/artist/view/20000000065",nu:"Nam Kwan",note:"갤러리현대 — 재불 추상화가"},
 "박현기":{url:"https://www.galleryhyundai.com/artist/view/20000000083",nu:"Park Hyunki",note:"갤러리현대 박현기 에스테이트"},
 "박래현":{url:"https://www.mmca.go.kr/collections/collectionsDetailPage.do?wrkinfoSeqno=283",nu:"Park Rehyun",note:"MMCA 소장품 'PARK Rehyun' — 표기 일치"},
};
const ADDSRC_VAR={
 "송상희":{url:"https://m.doosanartcenter.com/en/exhibit/artist/252",nu:"Sanghee Song",note:"두산아트센터 — 본인 국제 표기",addvar:{form:"Song Sanghee",note:"코리아 아티스트 프라이즈(MMCA) Family-Given"}},
};
const fileByKo={};
for(const f of readdirSync(DIR).filter(x=>x.endsWith(".yaml"))){const t=readFileSync(DIR+f,"utf8");const m=t.match(/full:\s*([가-힣]+)/);if(m&&!fileByKo[m[1]])fileByKo[m[1]]=f;}
const addVar=(rec,form,note)=>{const vs=(rec.name.variants||[]).filter(v=>v.form!==form);vs.push({form,lang:"en",script:"Latn",type:"alternate",source:note,accessed:AC});rec.name.variants=vs;};
let c=0;
for(const [ko,fx] of Object.entries(CHANGE)){
  const f=fileByKo[ko]; const rec=yaml.load(readFileSync(DIR+f,"utf8"));
  const old=rec.name.latn.preferred; rec.id=`person.${fx.slug}`; rec.name.latn={preferred:fx.pref};
  if(old&&old!==fx.pref) addVar(rec,old,"Wikidata/RR (영문 라벨)");
  rec.sources=[{url:fx.src.url,name_used:fx.pref,note:fx.src.note,accessed:AC},...(rec.sources||[])];
  writeFileSync(DIR+`${fx.slug}.yaml`,yaml.dump(rec,{lineWidth:-1,noRefs:true})); if(f!==`${fx.slug}.yaml`)rmSync(DIR+f);
  console.log(`✓C ${ko} ${old}→${fx.pref}`); c++;
}
for(const [ko,fx] of Object.entries(CAPS)){
  const f=fileByKo[ko]; const rec=yaml.load(readFileSync(DIR+f,"utf8"));
  rec.name.latn.preferred=fx.pref;
  if(fx.addvar) addVar(rec,fx.addvar.form,fx.addvar.note);
  if(!(rec.sources||[]).some(x=>x.url===fx.src.url)) rec.sources=[{url:fx.src.url,name_used:fx.pref,note:fx.src.note,accessed:AC},...(rec.sources||[])];
  writeFileSync(DIR+f,yaml.dump(rec,{lineWidth:-1,noRefs:true}));
  console.log(`✓K ${ko} →${fx.pref}`); c++;
}
for(const [ko,s] of Object.entries(ADDSRC)){
  const f=fileByKo[ko]; const rec=yaml.load(readFileSync(DIR+f,"utf8"));
  if((rec.sources||[]).some(x=>x.url===s.url)){console.log(`= ${ko}`);continue;}
  rec.sources=[{url:s.url,name_used:s.nu,note:s.note,accessed:AC},...(rec.sources||[])];
  writeFileSync(DIR+f,yaml.dump(rec,{lineWidth:-1,noRefs:true})); console.log(`✓A ${ko}`); c++;
}
for(const [ko,s] of Object.entries(ADDSRC_VAR)){
  const f=fileByKo[ko]; const rec=yaml.load(readFileSync(DIR+f,"utf8"));
  addVar(rec,s.addvar.form,s.addvar.note);
  if(!(rec.sources||[]).some(x=>x.url===s.url)) rec.sources=[{url:s.url,name_used:s.nu,note:s.note,accessed:AC},...(rec.sources||[])];
  writeFileSync(DIR+f,yaml.dump(rec,{lineWidth:-1,noRefs:true})); console.log(`✓AV ${ko}`); c++;
}
console.log(`\n총 ${c}건`);
