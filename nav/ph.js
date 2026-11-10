/* SeedWave · общий счётчик PostHog (слой 1 — движок).
   Подключение: автоматически через nav/sw.js, либо одной строкой
   <script defer src="https://seedwave.pt/nav/ph.js"></script>
   Режим без куки (cookieless_mode: always) — баннер согласия не нужен; IP обезличены в проекте.
   Отключение на странице: <meta name="sw-ph" content="off">.
   Свои события продукта: window.swTrack('nlm_booked', {...}).
   Проект PostHog: SeedWave (EU, 338391). Ключ ниже — публичный ключ сайта, не секрет. */
(function () {
  'use strict';
  if (window.__swPh) return;
  window.__swPh = true;
  var h = location.hostname;
  if (!/(^|\.)seedwave\.pt$/.test(h)) return;               // только боевые домены
  var off = document.querySelector('meta[name="sw-ph"]');
  if (off && off.content === 'off') return;

  !function(t,e){var o,n,p,r;e.__SV||(window.posthog=e,e._i=[],e.init=function(i,s,a){function g(t,e){var o=e.split(".");2==o.length&&(t=t[o[0]],e=o[1]),t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}}(p=t.createElement("script")).type="text/javascript",p.crossOrigin="anonymous",p.async=!0,p.src=s.api_host.replace(".i.posthog.com","-assets.i.posthog.com")+"/static/array.js",(r=t.getElementsByTagName("script")[0]).parentNode.insertBefore(p,r);var u=e;for(void 0!==a?u=e[a]=[]:a="posthog",u.people=u.people||[],u.toString=function(t){var e="posthog";return"posthog"!==a&&(e+="."+a),t||(e+=" (stub)"),e},u.people.toString=function(){return u.toString(1)+".people (stub)"},o="init capture register register_once register_for_session unregister unregister_for_session getFeatureFlag getFeatureFlagPayload isFeatureEnabled reloadFeatureFlags on onFeatureFlags onSessionId identify setPersonProperties group resetGroups reset get_distinct_id get_session_id get_session_replay_url alias set_config startSessionRecording stopSessionRecording sessionRecordingStarted captureException get_property getSessionProperty opt_in_capturing opt_out_capturing has_opted_in_capturing has_opted_out_capturing debug".split(" "),n=0;n<o.length;n++)g(u,o[n]);e._i.push([i,s,a])},e.__SV=1)}(document,window.posthog||[]);

  // Продукт и раздел — чтобы в отчётах всё делилось по продуктам
  var SUB = { ajuda: 'ajuda', prazos: 'prazos', painel: 'painel', apoios: 'apoios', nam: 'nam',
    contratar: 'nrm', ntm: 'ntm', i: 'card', g: 'guide', lavagem: 'nlm-pitch', asm1: 'nlm',
    ls: 'le-souffle', t: 'treino', b: 'birdie', r: 'relic', l: 'lis', nem: 'nem' };
  var seg = location.pathname.split('/').filter(Boolean);
  var first = (seg[0] || '').replace(/\.html$/, '');
  var langs = { pt: 1, en: 1, ru: 1, es: 1, de: 1 };
  var product, section;
  if (h === 'seedwave.pt' || h === 'www.seedwave.pt') {
    product = first && !langs[first] ? first : 'hub';
    section = seg[1] && !langs[seg[1]] ? seg[1] : '';
  } else {
    product = SUB[h.split('.')[0]] || h.split('.')[0];
    section = first && !langs[first] ? first : '';
  }
  var lang = (document.documentElement.lang || '').slice(0, 2) || (langs[first] ? first : '');

  window.posthog.init('phc_mzunKWvFvRLpenRDobwv2tBCsrgGNKYWibLLsgnSJap9', {
    api_host: 'https://eu.i.posthog.com',
    ui_host: 'https://eu.posthog.com',
    defaults: '2025-05-24',
    cookieless_mode: 'always',
    person_profiles: 'identified_only',
    capture_pageleave: true,
    session_recording: { maskAllInputs: true }
  });
  window.posthog.register({ sw_product: product, sw_section: section, sw_lang: lang });

  // Личная ссылка (?g=код): метка гостя живёт только в адресе — на устройство ничего не пишется.
  // Событиям даёт свойство sw_guest и переходит по ссылкам внутри seedwave.pt, чтобы путь гостя не рвался между продуктами.
  var guest = (location.search.match(/[?&]g=([a-z0-9]{3,12})(?:&|$)/) || [])[1];
  if (guest) {
    window.posthog.register({ sw_guest: guest });
    document.addEventListener('click', function (e) {
      var a = e.target && e.target.closest && e.target.closest('a[href]');
      if (!a) return;
      try {
        var u = new URL(a.href);
        if (/(^|\.)seedwave\.pt$/.test(u.hostname) && !u.searchParams.get('g')) { u.searchParams.set('g', guest); a.href = u.toString(); }
      } catch (err) {}
    }, true);
  }

  window.swTrack = function (name, props) {
    try { window.posthog.capture(name, props || {}); } catch (e) {}
  };
})();
