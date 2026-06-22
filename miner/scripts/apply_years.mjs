import { readFileSync, writeFileSync, existsSync } from "node:fs";
import yaml from "js-yaml";
const DIR=process.env.HOME+"/Developer/korean-art-lexicon/data/persons/";
const AC="2026-06-23";
const fin=JSON.parse(readFileSync(process.env.HOME+"/Developer/korean-art-lexicon/reports/miner/birthyear-final.json","utf8"));
let b=0,d=0,src=0,miss=0,skip=0;
for(const x of fin){
  if(!x.birth_year) continue;
  const f=DIR+x.slug+".yaml"; if(!existsSync(f)){miss++;continue;}
  const rec=yaml.load(readFileSync(f,"utf8"));
  if(rec.birth_year){skip++;continue;} // 이미 있으면 건드리지 않음
  // 키 순서 재구성
  const {id,name,role,external_ids,sources,status,...rest}=rec;
  let newSources=(sources||[]).slice();
  if(x.source_url && !newSources.some(s=>s.url===x.source_url)){
    newSources=[...newSources,{url:x.source_url,name_used:(name.latn&&name.latn.preferred)||x.slug,note:"생몰연도 출처",accessed:AC}]; src++;
  }
  const out={id,name};
  out.birth_year=x.birth_year; b++;
  if(x.death_year){out.death_year=x.death_year; d++;}
  if(role)out.role=role; if(external_ids)out.external_ids=external_ids;
  Object.assign(out,rest);
  out.sources=newSources; out.status=status;
  writeFileSync(f,yaml.dump(out,{lineWidth:-1,noRefs:true}));
}
console.log(`적용: birth ${b} | death ${d} | 새 출처 ${src} | 파일없음 ${miss} | 기존有스킵 ${skip}`);
