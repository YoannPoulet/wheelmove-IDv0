// Simple runtime i18n loader
(function(){
  const defaults = { lang: 'fr' };
  let dict = {};
  let currentLang = defaults.lang;
  const cache = {}; // cache loaded dictionaries by lang
  const listeners = new Set();

  async function loadDict(lang) {
    const normalized = (lang === 'en') ? 'en' : 'fr';
    try {
      if (cache[normalized]) {
        dict = cache[normalized];
      } else {
        const res = await fetch(`JS/i18n_${normalized}.json`);
        if (!res.ok) throw new Error('Missing i18n file');
        dict = await res.json();
        cache[normalized] = dict;
      }
      applyTranslations();
      document.documentElement.lang = normalized === 'en' ? 'en' : 'fr';
      localStorage.setItem('siteLang', normalized);
      currentLang = normalized;
      updateLangFlagImages();
      notifyChange();
      return dict;
    } catch (e) {
      console.warn('i18n load failed', e);
      throw e;
    }
  }

  // setText only updates the text node, leaving images intact
  function setText(el, value) {
    if (el.hasAttribute('data-i18n-html')) {
      el.innerHTML = value;
    } else {
      // seulement le texte à l’intérieur (ex: <span class="i18n-text">)
      const textSpan = el.querySelector('.i18n-text');
      if (textSpan) {
        textSpan.textContent = value;
      } else {
        Array.from(el.childNodes).forEach(node => {
          if (node.nodeType === Node.TEXT_NODE) node.textContent = value;
        });
      }
    }
  }

  function notifyChange(){
    listeners.forEach(cb => {
      try { cb(currentLang); } catch(e){ console.error('i18n listener error', e); }
    });
  }

  function applyTranslations(root = document) {
    root.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.getAttribute('data-i18n');
      if (!key) return;
      const val = lookup(key);
      if (val !== undefined) setText(el, val);
    });

    // textes HTML formatés
    root.querySelectorAll('[data-i18n-html]').forEach(el => {
      const key = el.getAttribute('data-i18n-html');
      if (!key) return;
      const val = lookup(key);
      if (val !== undefined) setText(el, val);
    });

    // hrefs
    root.querySelectorAll('[data-i18n-href]').forEach(el => {
      const key = el.getAttribute('data-i18n-href');
      if (!key) return;
      const val = lookup(key);
      if (val !== undefined) el.setAttribute('href', val);
    });

    // src
    root.querySelectorAll('[data-i18n-src]').forEach(el => {
      const key = el.getAttribute('data-i18n-src');
      if (!key) return;
      const val = lookup(key);
      if (val !== undefined) el.setAttribute('src', val);
    });

    // optional download attr
    root.querySelectorAll('[data-i18n-download]').forEach(el => {
      const key = el.getAttribute('data-i18n-download');
      if (!key) return;
      const val = lookup(key);
      if (val !== undefined) el.setAttribute('download', val);
    });
  }

  // lookup supports nested keys with dot-notation
  function lookup(key){
    if (!key) return undefined;
    const parts = key.split('.');
    let cur = dict;
    for (let p of parts){
      if (cur && Object.prototype.hasOwnProperty.call(cur, p)) cur = cur[p];
      else return undefined;
    }
    return cur;
  }

  // fonction de traduction avec paramètres optionnels
  function t(key, params){
    let raw = lookup(key);
    if (raw === undefined) return key;
    if (typeof raw !== 'string') raw = String(raw);
    if (params && typeof params === 'object'){
      Object.keys(params).forEach(k => {
        raw = raw.replace(new RegExp(`\\{${k}\\}`, 'g'), params[k]);
      });
    }
    return raw;
  }

  function attachLangSelectors() {
    document.querySelectorAll('.lang-flag').forEach(el => {
      el.addEventListener('click', (ev) => {
        ev.preventDefault();
        const newLang = currentLang === 'en' ? 'fr' : 'en';
        loadDict(newLang);
      });
    });
  }

  function updateLangFlagImages() {
    const flagFor = currentLang === 'en' ? 'fr' : 'en';
    const imgSrc = flagFor === 'fr' ? 'assets/flag-fr.png' : 'assets/flag-en.png';
    const imgAlt = flagFor === 'fr' ? 'FR' : 'EN';
    document.querySelectorAll('.lang-flag').forEach(el => {
      const img = el.querySelector('img');
      if (img) {
        img.src = imgSrc;
        img.alt = imgAlt;
      }
      el.setAttribute('data-lang', flagFor);
    });
  }

  // public listeners API
  function onChange(cb){ listeners.add(cb); }
  function offChange(cb){ listeners.delete(cb); }

  function setLang(lang){ return loadDict(lang); }

  document.addEventListener('DOMContentLoaded', () => {
    const saved = localStorage.getItem('siteLang');
    const navLang = (navigator.language || navigator.userLanguage || 'fr').startsWith('en') ? 'en' : 'fr';
    const lang = saved || navLang || defaults.lang;
    loadDict(lang).catch(()=>{});
    attachLangSelectors();
  });

  // expose a stable API for other scripts
  window.i18n = window.i18n || {};
  window.i18n.t = t;
  window.i18n.load = loadDict;
  window.i18n.setLang = setLang;
  window.i18n.onChange = onChange;
  window.i18n.offChange = offChange;
  window.i18n.applyToDOM = applyTranslations;
  Object.defineProperty(window.i18n, 'currentLang', { get: () => currentLang });

})();
