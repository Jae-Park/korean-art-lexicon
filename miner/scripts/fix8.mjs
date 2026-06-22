import { readFileSync, writeFileSync, rmSync, readdirSync } from "node:fs";
import yaml from "js-yaml";
const DIR=process.env.HOME+"/Developer/korean-art-lexicon/data/persons/";
const AC="2026-06-22";
const fileByKo={};
for(const f of readdirSync(DIR).filter(x=>x.endsWith(".yaml"))){const t=readFileSync(DIR+f,"utf8");const m=t.match(/full:\s*(.+?)\s*$/m);if(m&&!fileByKo[m[1].trim()])fileByKo[m[1].trim()]=f;}
const f=fileByKo["신제현"]; const rec=yaml.load(readFileSync(DIR+f,"utf8"));
const old=rec.name.latn.preferred; // Shin Jehyun
const vs=(rec.name.variants||[]).filter(v=>v.form!=="Je Hyun Shin");
if(old!=="Je Hyun Shin") vs.push({form:old,lang:"en",script:"Latn",type:"alternate",source:"대안공간 루프 표기",accessed:AC});
vs.push({form:"Shin Je-hyun",lang:"en",script:"Latn",type:"alternate",source:"호반문화재단",accessed:AC});
const seen=new Set(); rec.name.variants=vs.filter(v=>!seen.has(v.form)&&seen.add(v.form));
rec.name.latn.preferred="Je Hyun Shin";
rec.sources=[{url:"https://hobancf.or.kr/exhibition/artist_view?seq=252",name_used:"Je Hyun Shin",note:"작가 본인 선호 표기(에디터 확인). 호반문화재단 작가페이지는 'Shin Je-hyun' 표기(참고)",accessed:AC},...(rec.sources||[])];
rec.status="reviewed"; rec.id="person.je-hyun-shin";
writeFileSync(DIR+"je-hyun-shin.yaml",yaml.dump(rec,{lineWidth:-1,noRefs:true})); if(f!=="je-hyun-shin.yaml")rmSync(DIR+f);
console.log("✓ 신제현 →", rec.name.latn.preferred, "(rename je-hyun-shin, 변이:", rec.name.variants.map(v=>v.form).join("/"),")");
