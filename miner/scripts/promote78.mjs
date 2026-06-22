import { readFileSync, writeFileSync, rmSync, readdirSync } from "node:fs";
import yaml from "js-yaml";
const DIR=process.env.HOME+"/Developer/korean-art-lexicon/data/persons/";
const AC="2026-06-22";
const fileByKo={};
for(const f of readdirSync(DIR).filter(x=>x.endsWith(".yaml"))){const t=readFileSync(DIR+f,"utf8");const m=t.match(/full:\s*(.+?)\s*$/m);if(m&&!fileByKo[m[1].trim()])fileByKo[m[1].trim()]=f;}
const slugify=s=>s.normalize("NFKD").replace(/[̀-ͯ]/g,"").toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"");
// 7 제너럴쿤스트 → generalkunst (본인 표기), General Kunst 변이 강등
{ const f=fileByKo["제너럴쿤스트"]; const rec=yaml.load(readFileSync(DIR+f,"utf8"));
  const old=rec.name.latn.preferred;
  const vs=(rec.name.variants||[]).filter(v=>v.form!=="generalkunst"); vs.push({form:old,lang:"en",script:"Latn",type:"alternate",source:"표기 변형",accessed:AC}); rec.name.variants=vs;
  rec.name.latn.preferred="generalkunst";
  rec.sources=[{url:"https://www.generalkunst.com/",name_used:"generalkunst",note:"콜렉티브 공식 사이트(일반예술, 이혜령 주도 2015~) + MMCA 청주 다원예술2023",accessed:AC},...(rec.sources||[])];
  rec.status="reviewed"; rec.id="person.generalkunst";
  writeFileSync(DIR+"generalkunst.yaml",yaml.dump(rec,{lineWidth:-1,noRefs:true})); if(f!=="generalkunst.yaml")rmSync(DIR+f);
  console.log("✓ 제너럴쿤스트 → generalkunst (rename, reviewed)"); }
// 8 신제현 → Shin Jehyun 유지 + LOOP 출처
{ const f=fileByKo["신제현"]; const rec=yaml.load(readFileSync(DIR+f,"utf8"));
  rec.sources=[{url:"http://altspaceloop.com/exhibitions/artistic-survival-tactics",name_used:"Shin Jehyun",note:"대안공간 루프 《예술적 생존법 연구》 — 'Shin Jehyun' 확인(MMCA 고양2022·SeMA2014)",accessed:AC},...(rec.sources||[])];
  rec.status="reviewed";
  writeFileSync(DIR+f,yaml.dump(rec,{lineWidth:-1,noRefs:true}));
  console.log("✓ 신제현 → Shin Jehyun (reviewed)"); }
