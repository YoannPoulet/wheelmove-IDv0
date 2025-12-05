// Simple runtime i18n loader
(function(){
  const defaults = { lang: 'fr' };
  let dict = {};
  let currentLang = defaults.lang;
  const cache = {}; // cache loaded dictionaries by lang
  const listeners = new Set();

  async function loadDict(lang) {
    const supported = ['fr', 'en', 'es'];
    const normalized = supported.includes(lang) ? lang : 'fr';

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
      document.documentElement.lang = normalized;
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
  
  // public listeners API
  function onChange(cb){ listeners.add(cb); }
  function offChange(cb){ listeners.delete(cb); }

  function setLang(lang){ return loadDict(lang); }

  document.addEventListener('DOMContentLoaded', () => {
    const saved = localStorage.getItem('siteLang');
    const navLang = (navigator.language || navigator.userLanguage || 'fr').substring(0,2);
    const supported = ['fr','en','es'];

    const initialLang = saved && supported.includes(saved)
          ? saved
          : (supported.includes(navLang) ? navLang : 'fr');

    // Charge la langue au démarrage
    window.i18n.load(initialLang).catch(()=>{});


    const langToggle = document.getElementById('langToggle');
    if (langToggle) {
      const labels = { fr: 'Français', en: 'English', es: 'Español' };

      // Mise à jour quand la langue change
      window.i18n.onChange((lang) => {
        langToggle.textContent = labels[lang] + ' ▾';
      });
    }

    const toggle = document.getElementById('langToggle');
    const list = document.getElementById('langList');

    if (toggle && list) {

      // Ouvrir / fermer le menu
      toggle.addEventListener('click', (e) => {
        e.stopPropagation();
        const isOpen = !list.hasAttribute('hidden');
        if (isOpen) {
          list.setAttribute('hidden', '');
          toggle.setAttribute('aria-expanded', 'false');
        } else {
          list.removeAttribute('hidden');
          toggle.setAttribute('aria-expanded', 'true');
          list.focus();
        }
      });

      // Fermer en cliquant ailleurs
      document.addEventListener('click', () => {
        if (!list.hasAttribute('hidden')) {
          list.setAttribute('hidden', '');
          toggle.setAttribute('aria-expanded', 'false');
        }
      });

      // Navigation clavier
      list.addEventListener('keydown', (e) => {
        const items = Array.from(list.querySelectorAll('li a'));
        const index = items.indexOf(document.activeElement);

        switch (e.key) {
          case 'ArrowDown':
            e.preventDefault();
            items[(index + 1) % items.length].focus();
            break;
          case 'ArrowUp':
            e.preventDefault();
            items[(index - 1 + items.length) % items.length].focus();
            break;
          case 'Escape':
            list.setAttribute('hidden', '');
            toggle.setAttribute('aria-expanded', 'false');
            toggle.focus();
            break;
        }
      });

      // Click sur une langue → i18n.setLang(lang)
      list.querySelectorAll('a').forEach(a => {
        a.addEventListener('click', (e) => {
          e.preventDefault();
          let lang = a.getAttribute('href').replace('/', '').trim();
          if (!supported.includes(lang)) return;
          window.i18n.setLang(lang);
          list.setAttribute('hidden', '');
          toggle.setAttribute('aria-expanded', 'false');
        });
      });
    }
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
