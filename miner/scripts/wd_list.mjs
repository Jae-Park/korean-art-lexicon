import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import yaml from "js-yaml";
const DIR=process.env.HOME+"/Developer/korean-art-lexicon/data/persons/";
const norm=s=>String(s||"").toLowerCase().replace(/[\s.'’ʼ-]/g,"");
const FOREIGN=new Set(["cindy-sherman","claude-monet","jenny-holzer","joseph-beuys","louise-bourgeois","marc-chagall","michael-mandiberg","olafur-eliasson","paul-gauguin","ron-mueck","taeko-tomiyama","walid-raad","william-kentridge"]);
let out=[];
for(const f of readdirSync(DIR).filter(x=>x.endsWith(".yaml"))){
  const slug=f.replace(".yaml","");
  if(FOREIGN.has(slug)) continue;
  const r=yaml.load(readFileSync(DIR+f,"utf8"));
  const pref=r?.name?.latn?.preferred||""; const ko=r?.name?.ko?.full||"";
  const srcs=r?.sources||[];
  const wdSrc = srcs.some(s=>/wikidata\.org/.test(s.url||"")|| /wikidata/i.test(s.note||""));
  const hasQ = r?.external_ids?.wikidata;
  if(!wdSrc && !hasQ) continue;
  const corrob = srcs.some(s=>{const u=s.url||""; if(/wikidata\.org/.test(u)||/wikidata/i.test(s.note||"")) return false; if(/(artnet|mutualart|invaluable|wikipedia)/i.test(u)) return false; return norm(s.name_used)===norm(pref)&&norm(pref)!=="";});
  if(corrob) continue;
  // 기존 기관 출처 URL(검증 시 우선 확인 대상)
  const instUrls=srcs.filter(s=>{const u=s.url||"";return u&&!/wikidata\.org/.test(u)&&!/(artnet|mutualart|invaluable|wikipedia)/i.test(u);}).map(s=>s.url);
  out.push({ko, slug, currentPreferred:pref, qid:hasQ||null, existingSources:instUrls});
}
writeFileSync(process.env.HOME+"/Developer/korean-art-lexicon/reports/miner/roman-fixlist.json", JSON.stringify(out,null,2));
console.log(`검증 대상 한국 작가: ${out.length}건 → reports/miner/roman-fixlist.json`);
// chunk preview
out.forEach((o,i)=>{ if(i<5) console.log("  ", o.ko, "→", o.currentPreferred, o.qid||"", o.existingSources[0]||"(기관출처 없음)"); });
