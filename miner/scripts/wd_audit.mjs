import { readFileSync, readdirSync } from "node:fs";
import yaml from "js-yaml";
const DIR=process.env.HOME+"/Developer/korean-art-lexicon/data/persons/";
const SUR=/^(Choi|Kim|Lee|Yi|Rhee|Park|Pak|Ku|Koo|Gu|Kwon|Kwŏn|Pyŏn|Byeon|Jung|Chung|Hwang|Hong|Han|Shin|Sin|Oh|Ahn|An|Bae|Paik|Baek|Suh|Seo|Cho|Jo|Jeong|Chong|Moon|Mun|Nam|Noh|No|Yoo|Yu|Lim|Im|Ryu|Son|Sohn|Kang|Ko|Go|Jang|Chang|Song)$/i;
const MCR=/(\bCh'|\bP'|\bK'|\bT'|ŏ|ŭ|ʼ)/;
let mcr=[], reversed=[], wdOnly=[], clean=0, tot=0;
for(const f of readdirSync(DIR).filter(x=>x.endsWith(".yaml"))){
  tot++;
  const r=yaml.load(readFileSync(DIR+f,"utf8"));
  const pref=r?.name?.latn?.preferred||""; const ko=r?.name?.ko?.full||"";
  const srcs=r?.sources||[];
  const hasWd = srcs.some(s=>/wikidata\.org/.test(s.url||"")|| /wikidata/i.test(s.note||""));
  const instSrc = srcs.some(s=>{const u=s.url||"";return u && !/wikidata\.org/.test(u) && !/(artnet|mutualart|invaluable|wikipedia)/i.test(u);});
  const isMcr = MCR.test(pref);
  const toks = pref.trim().split(/\s+/);
  const isRev = toks.length>=2 && SUR.test(toks[toks.length-1]) && !SUR.test(toks[0]);
  if(isMcr) mcr.push(`${ko} → ${pref}`);
  else if(isRev) reversed.push(`${ko} → ${pref}`);
  else if(hasWd && !instSrc) wdOnly.push(`${ko} → ${pref}`);
  else if(instSrc) clean++;
}
console.log(`총 ${tot} 인물`);
console.log(`\n[A] 매큔마커 잔존 (${mcr.length}):`); mcr.forEach(x=>console.log("  "+x));
console.log(`\n[B] 성-이름 역순 의심 (${reversed.length}):`); reversed.forEach(x=>console.log("  "+x));
console.log(`\n[C] Wikidata 유일소스(기관출처0) (${wdOnly.length}):`); wdOnly.forEach(x=>console.log("  "+x));
console.log(`\n클린(기관출처+정상꼴): ${clean}`);
