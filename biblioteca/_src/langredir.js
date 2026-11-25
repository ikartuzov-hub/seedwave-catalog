(()=>{try{
/* 25.11.2026 — язык по браузеру. Вставляется inline в <head> только португальских (корневых) страниц Библиотеки.
   Гость пришёл снаружи (ссылка в мессенджере, поиск) на /biblioteca/… без языка → открываем его язык.
   Не трогаем: ботов и пререндер, переходы внутри Библиотеки (это явный выбор, напр. переключатель языка),
   ?lang=pt, и того, кто уже выбрал язык (biblioteca.lang пишет tabs.js при переходах внутри сайта). */
var L=["en","ru","es","de"],n=navigator,q=new URLSearchParams(location.search);
if(n.webdriver||/bot|crawl|spider|slurp|preview|facebookexternalhit|whatsapp|telegram|lighthouse/i.test(n.userAgent||""))return;
var ql=q.get("lang");if(ql==="pt"||location.protocol!=="https:")return;
var r=document.referrer||"";if(L.indexOf(ql)<0&&r.indexOf(location.host+"/biblioteca")>=0)return;
var s=null;try{s=localStorage.getItem("biblioteca.lang")}catch(_){}
var w=L.indexOf(ql)>=0?ql:s||((n.languages&&n.languages.length?n.languages:[n.language||"pt"]).map(function(x){return String(x).slice(0,2).toLowerCase()}).filter(function(x){return x==="pt"||L.indexOf(x)>=0})[0]);
if(w&&w!=="pt"&&L.indexOf(w)>=0){q.delete("lang");var qs=q.toString();location.replace(location.pathname.replace(/\/?$/,"/")+w+"/"+(qs?"?"+qs:"")+location.hash)}
}catch(e){}})();
