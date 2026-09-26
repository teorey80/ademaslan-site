/* Editorial discovery and on-demand video; all primary content links work without JS. */
(function () {
  var topic = 'all';
  var query = document.getElementById('content-query');
  var buttons = document.querySelectorAll('[data-topic]');
  var cards = document.querySelectorAll('.editorial-card');
  function normalize(s) { return s.toLocaleLowerCase('tr-TR').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/ı/g, 'i'); }
  function filter() {
    var count = 0;
    cards.forEach(function (card) {
      card.hidden = !((topic === 'all' || card.dataset.category === topic) && normalize(card.textContent).includes(normalize(query.value.trim())));
      if (!card.hidden) count++;
    });
    document.querySelector('.no-results').hidden = count > 0;
    document.getElementById('result-count').textContent = count + ' içerik gösteriliyor';
    buttons.forEach(function (b) { var selected = b.dataset.topic === topic; b.classList.toggle('selected', selected); b.setAttribute('aria-pressed', selected); });
  }
  buttons.forEach(function (b) { b.addEventListener('click', function () { topic = b.dataset.topic; filter(); }); });
  query.addEventListener('input', filter);
  document.getElementById('reset-content').addEventListener('click', function () { topic = 'all'; query.value = ''; filter(); query.focus(); });
  var dialog = document.getElementById('video-dialog'), player = document.getElementById('video-player');
  document.querySelectorAll('[data-video]').forEach(function (a) {
    a.addEventListener('click', function (event) {
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || !dialog.showModal) return;
      event.preventDefault();
      var frame = document.createElement('iframe');
      frame.src = 'https://www.youtube-nocookie.com/embed/' + a.dataset.video + '?autoplay=1';
      frame.title = a.dataset.videoTitle;
      frame.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen';
      frame.referrerPolicy = 'strict-origin-when-cross-origin';
      frame.allowFullscreen = true;
      document.getElementById('video-dialog-title').textContent = frame.title;
      document.getElementById('youtube-fallback').href = a.href;
      player.replaceChildren(frame); dialog.showModal(); document.body.style.overflow = 'hidden';
    });
  });
  document.getElementById('close-video').addEventListener('click', function () { dialog.close(); });
  dialog.addEventListener('click', function (e) { if (e.target === dialog) { var b = dialog.getBoundingClientRect(); if (e.clientX < b.left || e.clientX > b.right || e.clientY < b.top || e.clientY > b.bottom) dialog.close(); } });
  dialog.addEventListener('close', function () { player.replaceChildren(); document.body.style.overflow = ''; });
  function element(tag, cls, text) { var el = document.createElement(tag); if (cls) el.className = cls; if (text) el.textContent = text; return el; }
  function renderPortfolio() {
    var target = document.getElementById('home-properties'), data = window.AA_DATA;
    if (!data || data.loading) return;
    target.replaceChildren(); target.setAttribute('aria-busy', 'false');
    var listings = data.properties.filter(function (p) { return !['Satıldı', 'Kiralandı', 'Kapora Alındı', 'Pasif'].includes(p.listingStatus); }).slice(0, 3);
    if (data.error || !listings.length) {
      var empty = element('div', 'portfolio-message');
      empty.append(element('p', '', data.error ? 'İlanlar şu anda yüklenemiyor. Portföy sayfasından tekrar deneyebilir veya benimle iletişime geçebilirsiniz.' : 'Şu anda gösterilecek aktif ilan bulunmuyor. Aradığınız gayrimenkulü birlikte değerlendirebiliriz.'));
      var link = element('a', 'text-link', data.error ? 'Portföy sayfasını aç ↗' : 'İletişime geç ↗'); link.href = data.error ? '/portfoy' : 'https://wa.me/905322074087'; empty.append(link); target.append(empty); return;
    }
    listings.forEach(function (p) {
      var card = element('a', 'home-property'); card.href = '/portfoy-detay?id=' + encodeURIComponent(p.uuid || p.id);
      var media = element('div', 'property-photo'), src = (p.photos || [])[0];
      if (src && /^https?:\/\//.test(src) && !src.includes('images.unsplash.com')) {
        var img = element('img'); img.src = src; img.alt = p.title; img.loading = 'lazy'; img.width = 640; img.height = 400;
        img.addEventListener('error', function () { img.remove(); media.append(element('span', '', 'Fotoğraf için iletişime geçin')); }, {once:true}); media.append(img);
      } else media.append(element('span', '', 'Fotoğraf için iletişime geçin'));
      media.append(element('span', 'property-type', p.type));
      var body = element('div', 'property-body'); body.append(element('p', '', [p.district, p.neighborhood].filter(Boolean).join(' · ')), element('h3', '', p.title));
      var price = p.price ? new Intl.NumberFormat('tr-TR', {style:'currency', currency: /^[A-Z]{3}$/.test(p.currency) ? p.currency : 'TRY', maximumFractionDigits:0}).format(p.price) : 'Fiyat için iletişime geçin';
      body.append(element('span', 'property-price', price + (p.type === 'Kiralık' && p.price ? ' / ay' : '')));
      body.append(element('div', 'property-specs', [p.bedrooms && p.bedrooms !== '—' ? p.bedrooms : '', p.grossArea ? p.grossArea + ' m² brüt' : '', 'İlanı incele ↗'].filter(Boolean).join(' · ')));
      card.append(media, body); target.append(card);
    });
  }
  document.addEventListener('aa-data-ready', renderPortfolio); renderPortfolio();
  // A thumbnail failure should keep navigation and the card's title available.
  document.querySelectorAll('img[src*="i.ytimg.com"]').forEach(function (img) { img.addEventListener('error', function () { if (img.src.includes('maxresdefault')) img.src = img.src.replace('maxresdefault', 'hqdefault'); }, {once:true}); });
})();
