import { readFileSync, writeFileSync, rmSync, readdirSync } from "node:fs";
import yaml from "js-yaml";
const DIR=process.env.HOME+"/Developer/korean-art-lexicon/data/persons/";
// ① 명백교정: 본인 공식표기(디아스포라) + 어순/오타 기관교정. 구 Wikidata형은 alternate 변이로 강등.
const FIX={
 "천경자":{slug:"chun-kyung-ja",pref:"Chun Kyung-ja",src:{url:"https://sema.seoul.go.kr/en/whatson/exhibition/detail?exNo=488",note:"SeMA 천경자 추모전(소장 기관) — 어순 교정(Family-Given)"}},
 "이응노":{slug:"lee-ungno",pref:"Lee Ungno",src:{url:"https://www.mmca.go.kr/collections/collectionsDetailPage.do?wrkinfoSeqno=7070",note:"MMCA 소장품 + 이응노미술관 + Met — 보편 기관표기('Yi Eungro'는 Wikidata형)"}},
 "이왈종":{slug:"lee-walchong",pref:"Lee Walchong",src:{url:"https://www.ganaart.com/exhibition/lee-walchong/",note:"가나아트(전속 갤러리) — 기관표기(Walchong, 무하이픈)"}},
 "이인성":{slug:"lee-in-sung",pref:"Lee In-sung",src:{url:"https://artsandculture.google.com/asset/kyesan-dong-cathedral-lee-in-sung/VwFKDQWV5D7xJw",note:"Google Arts&Culture(MMCA 데이터) — 현행 'Inseoung'은 오타 교정"}},
 "장우성":{slug:"chang-woosoung",pref:"Chang Woosoung",src:{url:"https://www.mmca.go.kr/collections/collectionsDetailPage.do?wrkinfoSeqno=189",note:"MMCA 소장품 — 어순 교정(Family-Given)"}},
 "강요배":{slug:"kang-yo-bae",pref:"Kang Yo-bae",src:{url:"https://www.hakgojae.com/page/2-1-view.php?artist_num=2",note:"학고재(전속)+Asia Art Archive — 어순 교정"}},
 "박영숙":{slug:"park-youngsook",pref:"Park Youngsook",src:{url:"https://www.mmca.go.kr/eng/exhibitions/exhibitionsDetail.do?exhId=202403220001771",note:"MMCA 《연결된 신체》+SeMA+아라리오 — 어순 교정"}},
 "한영수":{slug:"han-youngsoo",pref:"Han Youngsoo",src:{url:"https://www.mmca.go.kr/eng/collections/collectionsDetailPage.do?wrkinfoSeqno=8800",note:"MMCA 소장품 — 비표준 쉼표('Han, Youngsoo') 제거"}},
 "정복수":{slug:"jung-bocsu",pref:"Jung Bocsu",src:{url:"https://www.mmcaresearch.kr/timeline/view.do?searchYearmm=198811",note:"MMCA Research Lab — 어순 교정(Family-Given)"}},
 "김원숙":{slug:"wonsook-kim",pref:"Wonsook Kim",src:{url:"https://wonsook.com/about/",note:"작가 공식 사이트 — 본인 표기(재미)"}},
 "구동희":{slug:"donghee-koo",pref:"Donghee Koo",src:{url:"https://www.pkmgallery.com/exhibitions/donghee-koo",note:"PKM갤러리(전속) — 본인 표기"}},
 "강명희":{slug:"myonghi-kang",pref:"Myonghi Kang",src:{url:"https://www.villepinart.com/myonghi-kang",note:"Galerie Villepin + 본인 사이트 — 본인 표기(재불)"}},
 "김명희":{slug:"myong-hi-kim",pref:"Myong Hi Kim",src:{url:"https://artprojects.com/news/myong-hi-kim-in-portrait-figure-and-people-december-18-2019-march-1-2020/",note:"Art Projects Intl + 본인 사이트(myong-hikim.com) — 본인 표기(재미)"}},
 "정금형":{slug:"geumhyung-jeong",pref:"Geumhyung Jeong",src:{url:"https://www.labiennale.org/en/art/2022/milk-dreams/geumhyung-jeong",note:"베니스 비엔날레 2022(공식) — 본인 국제 표기"}},
 "윤정미":{slug:"jeongmee-yoon",pref:"JeongMee Yoon",src:{url:"https://www.jeongmeeyoon.com",note:"작가 공식 사이트 — 본인 표기(중간 대문자 M)"}},
 "신미경":{slug:"meekyoung-shin",pref:"Meekyoung Shin",src:{url:"https://www.meekyoungshin.com/",note:"작가 공식 사이트 + 국제갤러리(전속) — 본인 표기(재영)"}},
};
const fileByKo={};
for(const f of readdirSync(DIR).filter(x=>x.endsWith(".yaml"))){const t=readFileSync(DIR+f,"utf8");const m=t.match(/full:\s*([가-힣]+)/);if(m&&!fileByKo[m[1]])fileByKo[m[1]]=f;}
let n=0;
for(const [ko,fx] of Object.entries(FIX)){
  const f=fileByKo[ko]; if(!f){console.log("못찾음:",ko);continue;}
  const rec=yaml.load(readFileSync(DIR+f,"utf8"));
  const oldPref=rec.name.latn.preferred;
  rec.id=`person.${fx.slug}`;
  const fam=rec.name.latn.family, giv=rec.name.latn.given;
  rec.name.latn={preferred:fx.pref};
  const vars=(rec.name.variants||[]).filter(v=>v.form!==fx.pref);
  if(oldPref&&oldPref!==fx.pref) vars.push({form:oldPref,lang:"en",script:"Latn",type:"alternate",source:"Wikidata (영문 라벨)",accessed:"2026-06-22"});
  const seen=new Set(); rec.name.variants=vars.filter(v=>!seen.has(v.form)&&seen.add(v.form));
  rec.sources=[{url:fx.src.url,name_used:fx.pref,note:fx.src.note,accessed:"2026-06-22"},...(rec.sources||[])];
  writeFileSync(DIR+`${fx.slug}.yaml`, yaml.dump(rec,{lineWidth:-1,noRefs:true}));
  if(f!==`${fx.slug}.yaml`) rmSync(DIR+f);
  console.log(`✓ ${ko}  ${oldPref} → ${fx.pref}  (${f}→${fx.slug}.yaml)`);
  n++;
}
console.log(`\n적용 ${n}건`);
