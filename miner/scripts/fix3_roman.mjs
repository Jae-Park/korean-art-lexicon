import { readFileSync, writeFileSync, rmSync, readdirSync } from "node:fs";
import yaml from "js-yaml";
const DIR=process.env.HOME+"/Developer/korean-art-lexicon/data/persons/";
const AC="2026-06-22";
// ② 하이픈 클러스터: 출처충실 — 각 작가 권위 출처 정확형으로 preferred 교체
const RENAME={
 "신학철":{slug:"shin-hakchul",pref:"Shin Hakchul",src:{url:"https://www.mmca.go.kr/collections/collectionsDetailPage.do?wrkinfoSeqno=10295",note:"MMCA 소장품 — 무하이픈(출처충실)"}},
 "서세옥":{slug:"suh-se-ok",pref:"Suh Se Ok",src:{url:"https://www.mmca.go.kr/eng/exhibitions/exhibitionsDetail.do?exhId=201511110000357",note:"MMCA 기증작품전 + 갤러리현대 — 무하이픈"}},
 "신상호":{slug:"shin-sang-ho",pref:"Shin Sang Ho",src:{url:"https://www.mmca.go.kr/eng/exhibitions/exhibitionsDetail.do?exhId=202512010002013",note:"MMCA 영문 — 무하이픈"}},
 "최병소":{slug:"choi-byungso",pref:"Choi Byungso",src:{url:"https://www.arariogallery.com/artists/160-choi-byungso/",note:"아라리오갤러리(전속) — 무하이픈"}},
 "김은호":{slug:"kim-eunho",pref:"Kim Eunho",src:{url:"https://www.mmca.go.kr/collections/collectionsDetailPage.do?wrkinfoSeqno=110",note:"MMCA 소장품 — 무하이픈"}},
 "조숙진":{slug:"sook-jin-jo",pref:"Sook Jin Jo",src:{url:"https://www.franconia.org/sook-jin-jo/",note:"Franconia Sculpture Park 등 미국 — 무하이픈(재미)"}},
 "김창열":{slug:"kim-tschang-yeul",pref:"Kim Tschang-Yeul",src:{url:"https://tinakimgallery.com/artists/33-kim-tschang-yeul/",note:"MMCA + Tina Kim Gallery — 하이픈(본인 표기)"}},
 "김익영":{slug:"kim-yik-yung",pref:"Kim Yik-Yung",src:{url:"https://www.solunafineart.com/kim-yik-yung",note:"Soluna Fine Art — 하이픈"}},
};
// 매치: 표기 정답, 기관 출처만 부착(Wikidata 권위 강등). name_used=기관 표기형
const ADDSRC={
 "김아타":{url:"https://www.icp.org/exhibitions/atta-kim-on-air",nu:"Atta Kim",note:"ICP — 본인 표기(재미)"},
 "김아영":{url:"https://www.tate.org.uk/art/artists/ayoung-kim-32937",nu:"Ayoung Kim",note:"Tate 소장"},
 "방혜자":{url:"https://www.e-flux.com/announcements/6787132/bang-hai-jasowing-light-across-heaven-and-earth",nu:"Bang Hai Ja",note:"MMCA 회고전 공지(e-flux)"},
 "장지아":{url:"https://www.mmca.go.kr/eng/exhibitions/exhibitionsDetail.do?exhId=202403220001771",nu:"Chang Jia",note:"MMCA 《연결된 신체》"},
 "이창진":{url:"https://www.changjinlee.net/",nu:"Chang-Jin Lee",note:"작가 공식 사이트(재미)"},
 "장욱진":{url:"https://www.yangju.go.kr/changucchin/contents.do?key=1999",nu:"Chang Ucchin",note:"양주시립장욱진미술관(공식)"},
 "정창섭":{url:"https://www.kukjegallery.com/artists/view?seq=342",nu:"Chung Chang-Sup",note:"국제갤러리(전속)"},
 "한석현":{url:"https://www.kanazawa21.jp/altering-home/en/artists/han-seok-hyun/index.html",nu:"Han Seok Hyun",note:"가나자와21 비엔날레"},
 "김기창":{url:"https://www.mmca.go.kr/eng/exhibitions/exhibitionsDetail.do?exhId=201012280000009",nu:"Kim Ki-chang",note:"MMCA 근대미술 명품전"},
 "김인승":{url:"https://spencerart.ku.edu/art/collections-online/artist/28171",nu:"Kim In-seung",note:"Spencer Museum of Art"},
 "김신일":{url:"https://www.gallerysimon.com/artists/shin-il-kim",nu:"Shin il Kim",note:"갤러리시몬(전속) — 본인 표기"},
 "김순기":{url:"https://www.centrepompidou.fr/en/ressources/personne/ck4aM8",nu:"Soun-Gui Kim",note:"Centre Pompidou 소장(재불)"},
 "김성환":{url:"https://www.moma.org/magazine/articles/582",nu:"Sung Hwan Kim",note:"MoMA — 본인 표기(재미)"},
 "김차섭":{url:"https://www.moma.org/artists/3096",nu:"Tchah-Sup Kim",note:"MoMA 소장 — 본인 표기"},
 "차학경":{url:"https://whitney.org/artists/19864",nu:"Theresa Hak Kyung Cha",note:"Whitney Museum — 본인 표기(재미)"},
 "빠키":{url:"https://www.mmca.go.kr/artStudio/artistDetail.do?cinArtId=202001200000281",nu:"Vakki",note:"MMCA 레지던시 — 모노님"},
 "최욱경":{url:"https://www.kukjegallery.com/artists/view?seq=272",nu:"Wook-kyung Choi",note:"국제갤러리"},
 "함양아":{url:"https://mediacityseoul.kr/en/yesterday/participants/yang-ah-ham",nu:"Yang Ah Ham",note:"서울미디어시티비엔날레(SeMA)"},
 "윤석남":{url:"https://www.tate.org.uk/art/artists/yun-suknam-22826",nu:"Yun Suknam",note:"Tate"},
};
const fileByKo={};
for(const f of readdirSync(DIR).filter(x=>x.endsWith(".yaml"))){const t=readFileSync(DIR+f,"utf8");const m=t.match(/full:\s*([가-힣]+)/);if(m&&!fileByKo[m[1]])fileByKo[m[1]]=f;}
let r=0,a=0;
for(const [ko,fx] of Object.entries(RENAME)){
  const f=fileByKo[ko]; if(!f){console.log("못찾음:",ko);continue;}
  const rec=yaml.load(readFileSync(DIR+f,"utf8"));
  const oldPref=rec.name.latn.preferred;
  rec.id=`person.${fx.slug}`; rec.name.latn={preferred:fx.pref};
  const vars=(rec.name.variants||[]).filter(v=>v.form!==fx.pref);
  if(oldPref&&oldPref!==fx.pref) vars.push({form:oldPref,lang:"en",script:"Latn",type:"alternate",source:"Wikidata (영문 라벨)",accessed:AC});
  const seen=new Set(); rec.name.variants=vars.filter(v=>!seen.has(v.form)&&seen.add(v.form));
  rec.sources=[{url:fx.src.url,name_used:fx.pref,note:fx.src.note,accessed:AC},...(rec.sources||[])];
  writeFileSync(DIR+`${fx.slug}.yaml`, yaml.dump(rec,{lineWidth:-1,noRefs:true}));
  if(f!==`${fx.slug}.yaml`) rmSync(DIR+f);
  console.log(`✓R ${ko}  ${oldPref} → ${fx.pref}`); r++;
}
for(const [ko,s] of Object.entries(ADDSRC)){
  const f=fileByKo[ko]; if(!f){console.log("못찾음:",ko);continue;}
  const rec=yaml.load(readFileSync(DIR+f,"utf8"));
  if((rec.sources||[]).some(x=>x.url===s.url)){console.log(`= ${ko} 이미 출처`);continue;}
  rec.sources=[{url:s.url,name_used:s.nu,note:s.note,accessed:AC},...(rec.sources||[])];
  writeFileSync(DIR+f, yaml.dump(rec,{lineWidth:-1,noRefs:true}));
  console.log(`✓A ${ko}  +${s.note}`); a++;
}
// 이성자: 본인형 유지 + MMCA 변이 + 미술관 출처
{
  const f=fileByKo["이성자"]; const rec=yaml.load(readFileSync(DIR+f,"utf8"));
  const vars=(rec.name.variants||[]).filter(v=>v.form!=="RHEE Seundja");
  vars.push({form:"RHEE Seundja",lang:"en",script:"Latn",type:"alternate",source:"MMCA (Family-Given)",accessed:AC});
  rec.name.variants=vars;
  if(!(rec.sources||[]).some(x=>/jinju\.go\.kr\/rheesjmuseum/.test(x.url)))
    rec.sources=[{url:"https://www.jinju.go.kr/rheesjmuseum/",name_used:"Seund Ja Rhee",note:"진주시립이성자미술관(공식) — 본인 서명형(재불)",accessed:AC},...(rec.sources||[])];
  writeFileSync(DIR+f, yaml.dump(rec,{lineWidth:-1,noRefs:true}));
  console.log("✓ 이성자 변이+미술관 출처");
}
console.log(`\nRENAME ${r} / ADDSRC ${a}`);
