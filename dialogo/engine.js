/* nDg · Diálogo — слой 1 (движок). Язык и контент — из ui.{lang}.json через сборку (_src/build.py). */
(function(){
  'use strict';
  var root=document.documentElement,$=function(s){return document.querySelector(s)},
      $$=function(s){return Array.prototype.slice.call(document.querySelectorAll(s))};
  var D={};try{D=JSON.parse($('#dg').textContent)}catch(e){}
  function track(n,p){try{window.swTrack&&window.swTrack(n,p||{})}catch(e){}}

  /* тема */
  var tb=$('#themeBtn');
  function dark(){var t=root.dataset.theme;return t?t==='dark':matchMedia('(prefers-color-scheme:dark)').matches}
  function paint(){tb.textContent=dark()?'☀':'☾'}
  paint();
  tb.addEventListener('click',function(){var n=dark()?'light':'dark';root.dataset.theme=n;try{localStorage.setItem('dialogo.theme',n)}catch(e){}paint()});
  $('#year').textContent=new Date().getFullYear();

  /* язык: меню из пяти ссылок, выбор запоминается */
  var lb=$('#langBtn'),menu=$('#langMenu');
  lb.addEventListener('click',function(e){e.stopPropagation();var o=menu.classList.toggle('open');lb.setAttribute('aria-expanded',o?'true':'false')});
  document.addEventListener('click',function(){menu.classList.remove('open');lb.setAttribute('aria-expanded','false')});
  $$('#langMenu a').forEach(function(a){a.addEventListener('click',function(){try{localStorage.setItem('dialogo.lang',a.getAttribute('hreflang'))}catch(e){}})});

  /* тост */
  var toast=$('#toast'),tt;
  function say(m){toast.textContent=m;toast.classList.add('on');clearTimeout(tt);tt=setTimeout(function(){toast.classList.remove('on')},2400)}

  /* Лайт / Полная */
  function show(id){['lite','full'].forEach(function(k){$('#'+k).hidden=(k!==id);$('#t-'+k).setAttribute('aria-selected',k===id?'true':'false')})}
  function route(scroll){var id=location.hash==='#full'?'full':'lite';show(id);if(scroll)$('.tabs').scrollIntoView({behavior:'smooth',block:'start'})}
  $('#t-lite').addEventListener('click',function(){location.hash='lite'});
  $('#t-full').addEventListener('click',function(){location.hash='full';track('dialogo_full')});
  addEventListener('hashchange',function(){route(true)});route(false);

  /* интерес: язык семинаров уходит в аналитику, запись — в бот SeedWave */
  var sem='pt';
  $$('#langs .chip').forEach(function(c){c.addEventListener('click',function(){$$('#langs .chip').forEach(function(x){x.classList.remove('me')});c.classList.add('me');sem=c.getAttribute('data-l')})});
  $('#go').addEventListener('click',function(){track('dialogo_interest',{seminar:sem,lang:D.lang})});
  $$('[data-ev]').forEach(function(a){a.addEventListener('click',function(){track(a.getAttribute('data-ev'),{lang:D.lang})})});

  /* переслать другу */
  $$('.share').forEach(function(b){b.addEventListener('click',function(){
    track('dialogo_share',{lang:D.lang});
    var data={title:document.title,text:D.shareText,url:D.url};
    if(navigator.share){navigator.share(data).catch(function(){});return}
    try{navigator.clipboard.writeText(D.shareText+' '+D.url).then(function(){say(D.copied)},function(){say(D.fail)})}catch(e){say(D.fail)}
  })});

  /* вау-механика: живая строка эфира */
  var sec=0,timer=$('#timer');
  if(matchMedia('(prefers-reduced-motion:reduce)').matches||!D.frames||!D.frames.length)return;
  setInterval(function(){sec++;var m=Math.floor(sec/60),s=sec%60;timer.textContent=(m<10?'0':'')+m+':'+(s<10?'0':'')+s},1000);
  var src=$('#lsrc'),tr=$('#ltr'),chat=$('#lchat'),i=0;
  function type(el,str,cb){var n=0;el.textContent='';var t=setInterval(function(){n+=2;el.textContent=str.slice(0,n);if(n>=str.length){clearInterval(t);cb&&cb()}},28)}
  function next(){i=(i+1)%D.frames.length;var c=D.frames[i];tr.textContent='…';type(src,c.src,function(){setTimeout(function(){tr.textContent=c.tr;chat.textContent=c.chat;setTimeout(next,3600)},700)})}
  setTimeout(next,3200);
})();
