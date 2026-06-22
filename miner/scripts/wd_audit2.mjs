import { readFileSync, readdirSync } from "node:fs";
import yaml from "js-yaml";
const DIR=process.env.HOME+"/Developer/korean-art-lexicon/data/persons/";
const norm=s=>String(s||"").toLowerCase().replace(/[\s.'’ʼ-]/g,"");
let wdBased=[], wdCorrob=[], noWd=0, tot=0;
for(const f of readdirSync(DIR).filter(x=>x.endsWith(".yaml"))){
  tot++;
  const r=yaml.load(readFileSync(DIR+f,"utf8"));
  const pref=r?.name?.latn?.preferred||""; const ko=r?.name?.ko?.full||"";
  const srcs=r?.sources||[];
  const wdSrc = srcs.find(s=>/wikidata\.org/.test(s.url||"")|| /wikidata/i.test(s.note||""));
  const hasQ = r?.external_ids?.wikidata;
  if(!wdSrc && !hasQ){ noWd++; continue; }
  // 기관(비-wikidata) 출처 중 name_used가 preferred와 일치하는 게 있나?
  const corrob = srcs.some(s=>{
    const u=s.url||""; if(/wikidata\.org/.test(u)||/wikidata/i.test(s.note||"")) return false;
    if(/(artnet|mutualart|invaluable|wikipedia)/i.test(u)) return false;
    return norm(s.name_used)===norm(pref) && norm(pref)!=="";
  });
  if(corrob) wdCorrob.push(`${ko} → ${pref}`);
  else wdBased.push(`${ko} → ${pref}  [${f}]`);
}
console.log(`총 ${tot} | Wikidata 무관 ${noWd} | Q-id보유 ${wdBased.length+wdCorrob.length}`);
console.log(`\n✅ 기관출처가 preferred 표기를 뒷받침 (${wdCorrob.length}):`); wdCorrob.forEach(x=>console.log("  "+x));
console.log(`\n🔴 Wikidata 기준 가능성·기관 미뒷받침 (${wdBased.length}):`); wdBased.forEach(x=>console.log("  "+x));
