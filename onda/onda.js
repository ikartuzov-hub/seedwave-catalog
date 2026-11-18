// SeedWave · Onda — язык (меню ссылок), тема, «Переслать», год
(function(){var d=document,r=d.documentElement,$=function(i){return d.getElementById(i)};
var lb=$('langBtn'),lm=$('langMenu'),tb=$('themeBtn'),sb=$('shareBtn'),y=$('year');
if(y)y.textContent=new Date().getFullYear();
if(lb&&lm){lb.onclick=function(e){e.stopPropagation();lm.classList.toggle('open')};d.addEventListener('click',function(){lm.classList.remove('open')})}
function ic(){if(tb)tb.textContent=r.dataset.theme==='dark'?'☀':'☾'}ic();
if(tb)tb.onclick=function(){r.dataset.theme=r.dataset.theme==='dark'?'light':'dark';try{localStorage.setItem('onda.theme',r.dataset.theme)}catch(e){}ic()};
if(sb)sb.onclick=function(){var u=location.href.split('?')[0],t=d.title,x=(d.querySelector('.l0')||{}).textContent||'';
 if(navigator.share){navigator.share({title:t,text:x,url:u}).catch(function(){})}
 else if(navigator.clipboard){navigator.clipboard.writeText(u).then(function(){sb.textContent=sb.dataset.copied})}};
})();
