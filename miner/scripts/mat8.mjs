import { writeFileSync, readFileSync, readdirSync } from "node:fs";
import yaml from "js-yaml";
const DIR=process.env.HOME+"/Developer/korean-art-lexicon/data/persons/";
const M={
"다나카 고키":["Koki Tanaka","https://sema.seoul.go.kr/en/whatson/exhibition/detail?exNo=1073846","SeMA 'Scoring the Words'(일본 b.1975) + 아트선재. high"],
"이끼바위쿠르르":["ikkibawiKrrr","https://sema.seoul.go.kr/en/whatson/exhibition/detail?exNo=1199291","SeMA 12회 미디어시티 + 아트선재 — 비주얼리서치밴드(현 고결·조지은). high"],
"최태윤":["Taeyoon Choi","https://sema.seoul.go.kr/en/whatson/exhibition/detail?exNo=1314927","SeMA Omnibus(재미, SFPC 공동창립). high"],
"신승백김용훈":["Shinseungback Kimyonghun","https://sema.seoul.go.kr/en/whatson/exhibition/detail?exNo=1319672","SeMA(듀오 신승백+김용훈, Nonfacial Portrait 소장). high"],
"람한":["Ram Han","https://sema.seoul.go.kr/en/whatson/exhibition/detail?exNo=1318668","SeMA Omnibus + MMCA 게임사회2023(b.1989 디지털페인팅). high"],
"파이어룰 달마":["Fyerool Darma","https://sema.seoul.go.kr/en/whatson/exhibition/detail?exNo=1199291","SeMA 12회 미디어시티(싱가포르). high"],
"리암 길릭":["Liam Gillick","https://gallerybaton.com/artists/35-liam-gillick/","갤러리바통(전속) — MMCA 'Catastrophe and Recovery'+SeMA(영국). high"],
"노먼 포스터":["Norman Foster","https://sema.seoul.go.kr/kr/whatson/exhibition/detail?exNo=1275156","SeMA 《미래긍정》 2024 개인전(건축가, Pritzker 1999). high"],
};
const existKo=new Set(), existSlug=new Set();
for(const f of readdirSync(DIR).filter(x=>x.endsWith(".yaml"))){ existSlug.add(f.replace(".yaml",""));
  const m=readFileSync(DIR+f,"utf8").match(/full:\s*(.+?)\s*$/m); if(m)existKo.add(m[1].trim()); }
const slugify=s=>s.normalize("NFKD").replace(/[̀-ͯ]/g,"").toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"");
const splitKo=ko=>({full:ko, family:ko.slice(0,1), given:ko.slice(1)});
let n=0;
for(const [ko,[en,url,note]] of Object.entries(M)){
  if(existKo.has(ko)){console.log("중복",ko);continue;}
  let slug=slugify(en); if(existSlug.has(slug)) slug=slug+"-"+slugify(ko);
  writeFileSync(DIR+`${slug}.yaml`, yaml.dump({ id:`person.${slug}`, name:{ko:splitKo(ko), latn:{preferred:en}},
    role:[{aat:"300025103"}], sources:[{url,name_used:en,note:"롱테일 패스3(2기관, 저명 보강) — "+note,accessed:"2026-06-22"}], status:"reviewed" },{lineWidth:-1,noRefs:true}));
  console.log("✓",ko,"→",en); n++;
}
console.log("등재",n);
