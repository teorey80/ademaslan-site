/* Adem Aslan — site etkileşimleri (tema kontrolcüsü, reveal, mobil menü) */
(function () {
  var r = document.documentElement;

  // ---- Tema / aksan kontrolcüsü (localStorage = tek kaynak) ----
  function stateNow() { return { theme: r.dataset.theme || 'light', accent: r.dataset.accent || 'blue' }; }
  function dispatch() { window.dispatchEvent(new CustomEvent('aa-statechange', { detail: stateNow() })); }

  window.AATheme = {
    state: stateNow,
    setTheme: function (t) { r.dataset.theme = t; try { localStorage.setItem('aa-theme', t); } catch (e) {} dispatch(); },
    toggleTheme: function () { this.setTheme((r.dataset.theme === 'dark') ? 'light' : 'dark'); },
    setAccent: function (a) { r.dataset.accent = a; try { localStorage.setItem('aa-accent', a); } catch (e) {} dispatch(); }
  };

  function ready(fn) {
    if (document.readyState !== 'loading') fn();
    else document.addEventListener('DOMContentLoaded', fn);
  }

  ready(function () {
    // Tema toggle butonu
    document.querySelectorAll('[data-theme-toggle]').forEach(function (b) {
      b.addEventListener('click', function () { window.AATheme.toggleTheme(); });
    });

    // Mobil menü
    var toggle = document.querySelector('[data-nav-toggle]');
    var links = document.querySelector('.nav-links');
    if (toggle && links) {
      toggle.addEventListener('click', function () {
        links.classList.toggle('open');
      });
    }

    // Reveal on scroll — görünürdekini hemen aç, gerisini gözlemle, + güvenlik ağı
    var items = document.querySelectorAll('.reveal');
    function showEl(el) { el.classList.add('in'); }
    function inView(el) {
      var r = el.getBoundingClientRect();
      return r.top < (window.innerHeight || 800) && r.bottom > 0;
    }
    if ('IntersectionObserver' in window && items.length) {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (en.isIntersecting) { showEl(en.target); io.unobserve(en.target); }
        });
      }, { threshold: 0, rootMargin: '0px 0px -6% 0px' });
      items.forEach(function (el) {
        if (inView(el)) showEl(el); else io.observe(el);
      });
      // Güvenlik ağı: gözlem tetiklenmezse 1.2 sn sonra hepsini aç
      setTimeout(function () { items.forEach(showEl); }, 1200);
    } else {
      items.forEach(showEl);
    }

    // Arama butonu (prototip — gerçek yönlendirme yok)
    document.querySelectorAll('[data-search]').forEach(function (f) {
      f.addEventListener('submit', function (e) { e.preventDefault(); });
    });

    // FAQ akordeon — aynı anda tek açık (details/summary)
    var faqRoot = document.querySelector('.faq');
    if (faqRoot) {
      var dets = faqRoot.querySelectorAll('details.faq-item');
      dets.forEach(function (d) {
        d.addEventListener('toggle', function () {
          if (d.open) dets.forEach(function (o) { if (o !== d) o.open = false; });
        });
      });
    }

    // TOC scroll-spy — okunan bölümü vurgula (anchor linkler her koşulda çalışır)
    var toc = document.querySelector('.toc');
    var sections = document.querySelectorAll('[data-section]');
    if (toc && sections.length && 'IntersectionObserver' in window) {
      var links = {};
      toc.querySelectorAll('a[href^="#"]').forEach(function (a) {
        links[a.getAttribute('href').slice(1)] = a;
      });
      var visible = new Set();
      var spy = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (en.isIntersecting) visible.add(en.target.id); else visible.delete(en.target.id);
        });
        // En üstteki görünür bölümü aktif yap
        var active = null;
        sections.forEach(function (s) { if (!active && visible.has(s.id)) active = s.id; });
        Object.keys(links).forEach(function (id) { links[id].classList.toggle('active', id === active); });
      }, { rootMargin: '-88px 0px -65% 0px', threshold: 0 });
      sections.forEach(function (s) { spy.observe(s); });
    }

    // ---- Lightbox galerisi ----
    var galleryItems = Array.prototype.slice.call(document.querySelectorAll('[data-lightbox]'));
    if (galleryItems.length) {
      var lb = document.createElement('div');
      lb.className = 'lightbox';
      lb.innerHTML =
        '<button class="lb-close" aria-label="Kapat">&times;</button>' +
        '<button class="lb-nav lb-prev" aria-label="Önceki">&#8249;</button>' +
        '<figure class="lb-stage"><img alt="" /><figcaption></figcaption></figure>' +
        '<button class="lb-nav lb-next" aria-label="Sonraki">&#8250;</button>' +
        '<div class="lb-count"></div>';
      document.body.appendChild(lb);
      var lbImg = lb.querySelector('img');
      var lbCap = lb.querySelector('figcaption');
      var lbCount = lb.querySelector('.lb-count');
      var idx = 0;

      function srcOf(el) { var i = el.querySelector('img'); return el.getAttribute('data-full') || (i ? i.src : ''); }
      function capOf(el) { return el.getAttribute('data-cap') || ''; }
      function render() {
        var el = galleryItems[idx];
        lbImg.src = srcOf(el);
        lbCap.textContent = capOf(el);
        lbCount.textContent = (idx + 1) + ' / ' + galleryItems.length;
      }
      function open(i) { idx = i; render(); lb.classList.add('open'); document.body.style.overflow = 'hidden'; }
      function close() { lb.classList.remove('open'); document.body.style.overflow = ''; }
      function go(d) { idx = (idx + d + galleryItems.length) % galleryItems.length; render(); }

      galleryItems.forEach(function (el, i) {
        el.style.cursor = 'zoom-in';
        el.addEventListener('click', function (e) { e.preventDefault(); open(i); });
      });
      lb.querySelector('.lb-close').addEventListener('click', close);
      lb.querySelector('.lb-prev').addEventListener('click', function () { go(-1); });
      lb.querySelector('.lb-next').addEventListener('click', function () { go(1); });
      lb.addEventListener('click', function (e) { if (e.target === lb) close(); });
      document.addEventListener('keydown', function (e) {
        if (!lb.classList.contains('open')) return;
        if (e.key === 'Escape') close();
        else if (e.key === 'ArrowRight') go(1);
        else if (e.key === 'ArrowLeft') go(-1);
      });
    }
  });
})();
