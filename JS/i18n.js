// Simple runtime i18n loader
(function(){
  const defaults = { lang: 'fr' };
  let dict = {};
  let currentLang = defaults.lang;

  // setText now only updates the text node, leaving images intact
  function setText(el, value) {
    // try to find a child <span class="i18n-text"> to replace
    const textSpan = el.querySelector('.i18n-text');
    if (textSpan) {
      textSpan.textContent = value;
    } else {
      // fallback: if no span, only replace text nodes
      Array.from(el.childNodes).forEach(node => {
        if (node.nodeType === Node.TEXT_NODE) node.textContent = value;
      });
    }
  }

  async function loadDict(lang) {
    try {
      const res = await fetch(`JS/i18n_${lang}.json`);
      if (!res.ok) throw new Error('Missing i18n file');
      dict = await res.json();
      applyTranslations();
      document.documentElement.lang = lang === 'en' ? 'en' : 'fr';
      localStorage.setItem('siteLang', lang);
      currentLang = lang === 'en' ? 'en' : 'fr';
      updateLangFlagImages();
    } catch (e) {
      console.warn('i18n load failed', e);
    }
  }

  function applyTranslations() {
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.getAttribute('data-i18n');
      if (!key) return;
      if (dict[key] !== undefined) setText(el, dict[key]);
    });

    // hrefs
    document.querySelectorAll('[data-i18n-href]').forEach(el => {
      const key = el.getAttribute('data-i18n-href');
      if (!key) return;
      if (dict[key] !== undefined) el.setAttribute('href', dict[key]);
    });

    // src
    document.querySelectorAll('[data-i18n-src]').forEach(el => {
      const key = el.getAttribute('data-i18n-src');
      if (!key) return;
      if (dict[key] !== undefined) el.setAttribute('src', dict[key]);
    });

    // optional download attr
    document.querySelectorAll('[data-i18n-download]').forEach(el => {
      const key = el.getAttribute('data-i18n-download');
      if (!key) return;
      if (dict[key] !== undefined) el.setAttribute('download', dict[key]);
    });
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

  document.addEventListener('DOMContentLoaded', () => {
    const saved = localStorage.getItem('siteLang');
    const navLang = (navigator.language || navigator.userLanguage || 'fr').startsWith('en') ? 'en' : 'fr';
    const lang = saved || navLang || defaults.lang;
    loadDict(lang);
    attachLangSelectors();
  });

  window._i18n = { load: loadDict };
})();
