// Simple runtime i18n loader
(function(){
  const defaults = { lang: 'fr' };
  let dict = {};
  let currentLang = defaults.lang;

  function setText(el, value) {
    if (el.hasAttribute('data-i18n-html')) {
      el.innerHTML = value;
    } else {
      el.textContent = value;
    }
  }

  async function loadDict(lang) {
    try {
      // fetch language file placed alongside other JS files (named i18n_fr.json / i18n_en.json)
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

  // attach flags or lang selectors
  function attachLangSelectors() {
    // Toggle language on click: switch to the other language and update flags
    document.querySelectorAll('.lang-flag').forEach(el => {
      el.addEventListener('click', (ev) => {
        ev.preventDefault();
        const newLang = currentLang === 'en' ? 'fr' : 'en';
        loadDict(newLang);
      });
    });
  }

  // When the site language changes, show the opposite flag as the toggle icon
  function updateLangFlagImages() {
    // show FR flag when site is EN, and EN flag when site is FR
    const flagFor = currentLang === 'en' ? 'fr' : 'en';
    const imgSrc = flagFor === 'fr' ? 'assets/flag-fr.png' : 'assets/flag-en.png';
    const imgAlt = flagFor === 'fr' ? 'FR' : 'EN';
    document.querySelectorAll('.lang-flag').forEach(el => {
      const img = el.querySelector('img');
      if (img) {
        img.src = imgSrc;
        img.alt = imgAlt;
      }
      // store the language we're switching TO on the element for clarity
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

  // expose for debugging
  window._i18n = { load: loadDict };
})();
