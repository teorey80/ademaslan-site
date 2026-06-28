/* =====================================================================
   ADEM ASLAN — Proje İncelemeleri Loader (v2: DOM patching)
   ---------------------------------------------------------------------
   - /projeler           → Supabase'den çekilen projeleri kart olarak grid'e dök
   - /projeler/[slug]    → proje-detay.html (Birbahçe şablonu) içindeki
                           DOM elementlerini hedeflenmiş projeyle değiştir
   ===================================================================== */
(function () {
  var SUPABASE_URL = 'https://ofttxfmbhulnpbegliwp.supabase.co';
  var ADEM_USER_ID = '47bf31f3-ee65-4bfe-8152-7804a926849a';
  var ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9mdHR4Zm1iaHVsbnBiZWdsaXdwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUwOTk5MjAsImV4cCI6MjA4MDY3NTkyMH0._ntPFIsWPmWIiOFh0h6-BymsS4Izwftom9NbfmgQe88';

  function esc(s) { return String(s == null ? '' : s).replace(/[<>&"']/g, function(c){ return ({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&#39;'})[c]; }); }
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function setText(sel, val) { var el = $(sel); if (el && val != null) el.textContent = val; }
  function setHTML(sel, html) { var el = $(sel); if (el && html != null) el.innerHTML = html; }
  function ytEmbed(url) {
    if (!url) return null;
    var m = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/))([\w-]+)/);
    return m ? 'https://www.youtube.com/embed/' + m[1] : null;
  }

  function fetchProjects(filter) {
    var url = SUPABASE_URL + '/rest/v1/project_reviews?select=*&user_id=eq.' + ADEM_USER_ID + '&published=eq.true';
    if (filter && filter.slug) url += '&slug=eq.' + encodeURIComponent(filter.slug);
    return fetch(url, {
      headers: { 'apikey': ANON, 'Authorization': 'Bearer ' + ANON, 'Accept': 'application/json' }
    }).then(function (r) {
      if (!r.ok) return r.text().then(function (t) { throw new Error('Supabase ' + r.status + ': ' + t); });
      return r.json();
    });
  }

  // ========== LİSTE SAYFASI ==========
  function renderListPage(projects) {
    var grid = $('#grid');
    if (!grid) return;
    grid.innerHTML = '';

    if (!projects.length) {
      grid.innerHTML = '<div class="empty" style="grid-column:1/-1; padding:60px 20px; text-align:center;"><h3 style="font-family:Newsreader,serif;">Henüz yayında proje incelemesi yok.</h3></div>';
      return;
    }

    var statusMap = {
      hazir:  { label: 'Hazır',    color: '#1F8A5B' },
      insaat: { label: 'İnşaatta', color: '#C9912E' },
      yeni:   { label: 'Yeni',     color: 'var(--accent)' }
    };

    projects.forEach(function (p) {
      var st = statusMap[p.status_tag] || statusMap.hazir;
      var hero = p.hero_image_url || 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=800&h=560&q=80&auto=format&fit=crop';
      var verdict = (p.quick_answer || '').replace(/<[^>]+>/g, '').slice(0, 180);

      var card = document.createElement('a');
      card.className = 'proj-card';
      card.href = '/projeler/' + p.slug;
      card.setAttribute('data-name', (p.title || '').toLowerCase());
      card.setAttribute('data-dev', (p.developer || '').toLowerCase());
      card.setAttribute('data-status', p.status_tag || 'hazir');
      card.setAttribute('data-district', p.district || '');
      card.innerHTML =
        '<div class="pc-media">' +
          '<img src="' + esc(hero) + '" alt="' + esc(p.title) + '" loading="lazy" />' +
          '<span class="pc-status"><span class="sdot" style="background:' + st.color + '"></span> ' + st.label + '</span>' +
          '<span class="pc-reviewed">İnceleme hazır</span>' +
        '</div>' +
        '<div class="pc-body">' +
          '<span class="pc-dev">' + esc(p.developer || '') + '</span>' +
          '<h3 class="pc-name">' + esc(p.title) + '</h3>' +
          '<div class="pc-loc"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg> ' + esc(p.district || '') + (p.neighborhood ? ' · ' + esc(p.neighborhood) : '') + '</div>' +
          '<p class="pc-verdict">' + esc(verdict) + '</p>' +
          '<dl class="pc-stats">' +
            '<div><dt>Teslim</dt><dd>' + esc(p.delivery_date || '—') + '</dd></div>' +
            '<div><dt>Fiyat</dt><dd>' + esc(p.price_range || 'İletişim') + '</dd></div>' +
            '<div><dt>Tipler</dt><dd>' + esc(p.unit_types || '—') + '</dd></div>' +
            '<div><dt>Aidat</dt><dd>' + esc(p.dues_info || '—') + '</dd></div>' +
          '</dl>' +
          '<div class="pc-foot"><span class="pc-read">İncelemeyi oku <span class="arrow">→</span></span><span class="pc-readtime">' + (p.read_minutes || 10) + ' dk</span></div>' +
        '</div>';
      grid.appendChild(card);
    });

    var visCount = $('#visCount');
    if (visCount) visCount.textContent = projects.length;
  }

  // ========== DETAY SAYFASI (DOM patching — Birbahçe şablonunu kullanır) ==========
  function patchDetailPage(p) {
    if (!p) {
      document.body.innerHTML = '<section class="section"><div class="wrap" style="max-width:600px;padding:60px 20px;text-align:center;"><h1>Proje bulunamadı</h1><p><a class="link-u" href="/projeler">← Tüm projelere dön</a></p></div></section>';
      return;
    }

    var status = { hazir: 'Hazır', insaat: 'İnşaatta', yeni: 'Yeni / Lansman' }[p.status_tag] || 'Hazır';

    // META
    document.title = p.title + ' — Adem Aslan';
    var mDesc = $('meta[name="description"]');
    if (mDesc) mDesc.setAttribute('content', p.meta_description || (p.quick_answer || '').replace(/<[^>]+>/g, '').slice(0, 160));
    var ogTitle = $('meta[property="og:title"]');
    if (ogTitle) ogTitle.setAttribute('content', p.title);
    var ogImg = $('meta[property="og:image"]');
    if (ogImg && p.hero_image_url) ogImg.setAttribute('content', p.hero_image_url);

    // SCHEMA
    var schemaScript = $('#ldjson');
    if (schemaScript) {
      var faqsForSchema = (p.faqs || []).map(function(f){ return { '@type':'Question', 'name': f.q, 'acceptedAnswer': { '@type':'Answer', 'text': f.a } }; });
      schemaScript.textContent = JSON.stringify({
        '@context': 'https://schema.org', '@type': 'Article',
        'headline': p.title,
        'description': p.meta_description || (p.quick_answer || '').replace(/<[^>]+>/g, '').slice(0, 160),
        'image': p.hero_image_url || '',
        'author': { '@type': 'Person', 'name': 'Adem Aslan' },
        'about': [p.title, p.developer, p.district, 'konut projesi'].filter(Boolean),
        'mainEntity': faqsForSchema.length ? { '@type': 'FAQPage', 'mainEntity': faqsForSchema } : undefined
      });
    }

    // BREADCRUMB
    var crumbB = $('.crumb b');
    if (crumbB) crumbB.textContent = p.title;
    var crumbProj = $$('.crumb a').filter(function(a){ return /projeler/i.test(a.textContent); })[0];
    if (crumbProj) crumbProj.setAttribute('href', '/projeler');

    // BAŞLIK
    var h1 = $('main h1');
    if (h1) h1.textContent = p.title;

    // EYEBROW
    var eyebrow = $('main .eyebrow');
    if (eyebrow) eyebrow.textContent = 'Proje İncelemesi · ' + (p.developer || '');

    // META ALT (okuma süresi)
    var readEl = $$('.art-meta span').filter(function(s){ return /dk okuma/.test(s.textContent); })[0];
    if (readEl) readEl.textContent = (p.read_minutes || 10) + ' dk okuma';

    // HERO GÖRSELİ
    var heroImg = $('.proj-hero .pmedia img');
    if (heroImg && p.hero_image_url) {
      heroImg.src = p.hero_image_url;
      heroImg.alt = p.title;
    }
    var ribbon = $('.proj-hero .ribbon');
    if (ribbon) ribbon.innerHTML = '<span>' + esc(p.district || '') + '</span><span>' + esc(p.delivery_date || '') + '</span>';

    // FACT BOX
    var fbName = $('.factbox .fb-name');
    if (fbName) fbName.textContent = p.title;
    var fbDev = $('.factbox .fb-dev');
    if (fbDev) fbDev.textContent = 'Geliştirici · ' + (p.developer || '—');

    var fbDl = $('.factbox dl');
    if (fbDl) {
      fbDl.innerHTML =
        '<div><dt>Teslim</dt><dd>' + esc(p.delivery_date || '—') + '</dd></div>' +
        '<div><dt>Fiyat aralığı</dt><dd>' + esc(p.price_range || 'İletişim') + '</dd></div>' +
        '<div><dt>Daire tipleri</dt><dd>' + esc(p.unit_types || '—') + '</dd></div>' +
        '<div><dt>Konum</dt><dd>' + esc(p.district || '') + (p.neighborhood ? ' · ' + esc(p.neighborhood) : '') + '</dd></div>' +
        '<div><dt>Aidat</dt><dd>' + esc(p.dues_info || '—') + '</dd></div>' +
        '<div><dt>Durum</dt><dd>' + status + '</dd></div>';
    }

    // HIZLI CEVAP
    var quickP = $('#ozet .quick-answer p');
    if (quickP && p.quick_answer) quickP.innerHTML = p.quick_answer;

    // KONUM GİRİŞ + MESAFE ÇUBUKLARI
    var konumSec = $('#konum');
    if (konumSec) {
      var konumPs = $$('#konum > p');
      if (konumPs[0] && p.location_intro) konumPs[0].innerHTML = p.location_intro;
      // Mesafe çubukları
      var bars = $('#konum .bars');
      if (bars && p.distances && p.distances.length) {
        bars.innerHTML = p.distances.map(function (d) {
          return '<div class="bar-row"><span class="lbl">' + esc(d.label) + '</span><div class="bar-track"><div class="bar-fill" style="width:' + (d.percent || 30) + '%"></div></div><span class="val">' + esc(d.value) + '</span></div>';
        }).join('');
      }
    }

    // DAİRE TİPLERİ TABLOSU
    var unitsTbody = $('#daireler tbody');
    if (unitsTbody && p.units_table && p.units_table.length) {
      unitsTbody.innerHTML = p.units_table.map(function (u) {
        return '<tr><td>' + esc(u.tip) + '</td><td>' + esc(u.ozellik || '') + '</td><td>' + esc(u.profil || '') + '</td><td>' + esc(u.stok || '') + '</td></tr>';
      }).join('');
      var thead = $('#daireler thead tr');
      if (thead) thead.innerHTML = '<th>Tip</th><th>Özellik</th><th>Hedef</th><th>Stok</th>';
    }

    // ARTILAR
    var prosUl = $('#artilar .pros ul');
    if (prosUl && p.pros && p.pros.length) {
      prosUl.innerHTML = p.pros.map(function (x) {
        return '<li><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M20 6 9 17l-5-5"/></svg> ' + esc(x) + '</li>';
      }).join('');
    }
    // EKSİLER
    var consUl = $('#artilar .cons ul');
    if (consUl && p.cons && p.cons.length) {
      consUl.innerHTML = p.cons.map(function (x) {
        return '<li><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M18 6 6 18M6 6l12 12"/></svg> ' + esc(x) + '</li>';
      }).join('');
    }

    // KİMLER İÇİN UYGUN
    var fitGrid = $('#kimler .fit-grid');
    if (fitGrid && p.target_profile && p.target_profile.length) {
      fitGrid.innerHTML = p.target_profile.map(function (t) {
        var cls = t.fit === false ? 'fit no' : 'fit';
        return '<div class="' + cls + '"><div class="ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="10"/></svg></div><b>' + esc(t.title) + '</b><p>' + esc(t.text) + '</p></div>';
      }).join('');
    }

    // YATIRIM
    var yatirimSec = $('#yatirim');
    if (yatirimSec && p.investment_notes) {
      var yatirimP = $('#yatirim > p');
      if (yatirimP) yatirimP.innerHTML = p.investment_notes;
    }
    var facts = $('#yatirim .facts');
    if (facts && p.investment_stats && p.investment_stats.length) {
      facts.innerHTML = p.investment_stats.map(function (s) {
        return '<div class="f"><div class="n">' + esc(s.n) + '</div><div class="l">' + esc(s.l) + '</div></div>';
      }).join('');
    }

    // ÖDEME PLANI
    var payplan = $('#odeme .payplan');
    if (payplan && p.payment_plan && p.payment_plan.length) {
      var head = '<div class="pp-head"><b>Örnek plan</b><span>Bedel üzerinden temsilî dağılım</span></div>';
      payplan.innerHTML = head + p.payment_plan.map(function (pp) {
        return '<div class="pp-row"><span class="pp-step">' + esc(pp.step) + '</span><div class="pp-label"><b>' + esc(pp.label) + '</b><span>' + esc(pp.sublabel || '') + '</span></div><span class="pp-pct">' + esc(pp.pct) + '</span></div>';
      }).join('');
    }

    // TESLİM SONRASI
    var teslimP = $('#teslim > p');
    if (teslimP && p.post_delivery) teslimP.innerHTML = p.post_delivery;

    // ADEM'İN GÖRÜŞÜ
    var opinionText = $('#gorus .o-text');
    if (opinionText && p.adem_opinion) opinionText.textContent = '"' + p.adem_opinion + '"';
    var opinionRole = $('#gorus .o-role');
    if (opinionRole) opinionRole.textContent = (p.district || '') + ' · saha';

    // SSS
    var faqContainer = $('#sss .faq');
    if (faqContainer && p.faqs && p.faqs.length) {
      faqContainer.innerHTML = p.faqs.map(function (f, i) {
        return '<details class="faq-item"' + (i === 0 ? ' open' : '') + '>' +
          '<summary class="faq-q">' + esc(f.q) + ' <span class="ic"></span></summary>' +
          '<div class="faq-a"><div>' + esc(f.a) + '</div></div>' +
        '</details>';
      }).join('');
    }

    // VIDEO (Birbahçe'de video Adem'in görüşü öncesinde bir bölüm — yoksa ekle)
    var videoEmbed = ytEmbed(p.video_url);
    if (videoEmbed) {
      var existingVideo = $('#video');
      var videoHTML = '<section data-section id="video" style="margin-top:2.2em;">' +
        '<p class="sec-eyebrow">08 — Sahadan</p>' +
        '<h2>' + esc(p.title) + ' ev turu</h2>' +
        '<p>Projeyi sahada gezdim ve detaylı bir tur çektim.</p>' +
        '<div style="position:relative; width:100%; padding-bottom:56.25%; height:0; margin-top:18px; border-radius:var(--radius); overflow:hidden;">' +
          '<iframe src="' + videoEmbed + '" title="' + esc(p.title) + ' ev turu" loading="lazy" ' +
            'allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen ' +
            'style="position:absolute; top:0; left:0; width:100%; height:100%; border:0;"></iframe>' +
        '</div></section>';

      if (existingVideo) {
        existingVideo.outerHTML = videoHTML;
      } else {
        // Adem'in görüşü bölümünün öncesine yerleştir
        var gorusSec = $('#gorus');
        if (gorusSec && gorusSec.parentNode) {
          gorusSec.insertAdjacentHTML('beforebegin', videoHTML);
        }
      }
    }
  }

  // ========== ROUTER ==========
  function init() {
    var path = location.pathname;

    if (/^\/projeler\/[^\/]+\/?$/.test(path)) {
      // Detay sayfası
      var slug = path.split('/').filter(Boolean)[1];
      console.log('[AA] Detay yükleniyor:', slug);
      fetchProjects({ slug: slug }).then(function (rows) {
        console.log('[AA] Detay verisi geldi:', rows.length, 'satır');
        patchDetailPage(rows[0]);
      }).catch(function (e) {
        console.error('[AA] Proje yüklenemedi:', e.message);
        patchDetailPage(null);
      });
    } else if ($('#grid')) {
      // Liste sayfası
      console.log('[AA] Liste yükleniyor');
      fetchProjects().then(function (rows) {
        console.log('[AA] Liste verisi geldi:', rows.length, 'satır');
        renderListPage(rows);
      }).catch(function (e) {
        console.error('[AA] Projeler yüklenemedi:', e.message);
        var grid = $('#grid');
        if (grid) grid.innerHTML = '<div class="empty" style="grid-column:1/-1; padding:60px 20px; text-align:center;"><h3>Yüklenemedi</h3><p style="color:var(--ink-muted);">' + esc(e.message) + '</p></div>';
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
