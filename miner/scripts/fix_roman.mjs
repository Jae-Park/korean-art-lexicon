import { readFileSync, writeFileSync, rmSync, readdirSync } from "node:fs";
import yaml from "js-yaml";
const REPO=new URL("../..",import.meta.url).pathname, DIR=`${REPO}data/persons/`;
const FIX={
 "구본창":{slug:"koo-bohnchang",pref:"Koo Bohnchang",alts:["Bohnchang Koo"],src:{url:"http://www.bckoo.com/biography",note:"작가 본인 사이트 — 영문 표기 권위"}},
 "권진규":{slug:"kwon-jin-kyu",pref:"Kwon Jin Kyu",alts:["Kwon Jin-kyu","Kwon Jinkyu"],src:{url:"https://sema.seoul.go.kr/en/whatson/exhibition/detail?exNo=1033195",note:"SeMA 권진규 탄생100주년 회고전 'Kwon Jin Kyu Centennial'"}},
 "최만린":{slug:"choi-man-lin",pref:"Choi Man-lin",alts:[],src:{url:"https://sma.sbculture.or.kr/cml/about/introduce.do",note:"성북구립 최만린미술관"}},
 "변관식":{slug:"byeon-gwan-sik",pref:"Byeon Gwan-sik",alts:["Byeon Gwansik"],src:{url:"https://searchcollection.asianart.org/people/1195/byeon-gwansik",note:"Asian Art Museum (SF) 소장품 — Byeon Gwansik"}},
 "박노수":{slug:"park-no-soo",pref:"Park No-soo",alts:[],src:{url:"https://www.jfac.or.kr/site/main/content/parkns01",note:"종로구립 박노수미술관"}},
 "이대원":{slug:"lee-dae-won",pref:"Lee Dae-won",alts:["Lee Dai-won"],src:{url:"https://www.artsy.net/artist/idaeweon-dae-won-lee",note:"Artsy(갤러리 소스) — 표기 다양, 검토 여지"}},
 "구본웅":{slug:"gu-bon-ung",pref:"Gu Bon-ung",alts:[],src:{url:"https://www.e-flux.com/announcements/371537",note:"e-flux MMCA 전시 — Gu Bon-ung"}},
};
const fileByKo={};
for(const f of readdirSync(DIR)){const t=readFileSync(DIR+f,"utf8");const m=t.match(/full:\s*([가-힣]+)/);if(m)fileByKo[m[1]]=f;}
for(const [ko,fx] of Object.entries(FIX)){
  const f=fileByKo[ko]; if(!f){console.log("못찾음:",ko);continue;}
  const rec=yaml.load(readFileSync(DIR+f,"utf8"));
  const oldPref=rec.name.latn.preferred;
  rec.id=`person.${fx.slug}`;
  rec.name.latn={preferred:fx.pref};
  const vars=(rec.name.variants||[]).filter(v=>v.form!==fx.pref);
  vars.push({form:oldPref,lang:"en",script:"Latn",type:"transliteration",source:"Wikidata (McCune-Reischauer)",accessed:"2026-06-22"});
  for(const a of fx.alts) if(a!==fx.pref) vars.push({form:a,lang:"en",script:"Latn",type:"alternate",source:"갤러리/미술관",accessed:"2026-06-22"});
  const seen=new Set(); rec.name.variants=vars.filter(v=>!seen.has(v.form)&&seen.add(v.form));
  rec.sources=[{url:fx.src.url,name_used:fx.pref,note:fx.src.note,accessed:"2026-06-22"},...rec.sources];
  writeFileSync(DIR+`${fx.slug}.yaml`, yaml.dump(rec,{lineWidth:-1,noRefs:true}));
  if(f!==`${fx.slug}.yaml`) rmSync(DIR+f);
  console.log(`수정: ${ko}  ${oldPref} → ${fx.pref}  (${f}→${fx.slug}.yaml)`);
}
