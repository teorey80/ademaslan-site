/* =====================================================================
   ADEM ASLAN — Portföy veri katmanı (Supabase fetch — v3)
   ---------------------------------------------------------------------
   - user_id whitelist (sadece Adem'in ilanları)
   - Loading placeholder (yükleme sırasında "Yükleniyor" göster)
   - Esnek mapping (camelCase + snake_case)
   ===================================================================== */
(function () {
  var SUPABASE_URL  = 'https://ofttxfmbhulnpbegliwp.supabase.co';
  var ADEM_USER_ID  = '47bf31f3-ee65-4bfe-8152-7804a926849a';
  var SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9mdHR4Zm1iaHVsbnBiZWdsaXdwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUwOTk5MjAsImV4cCI6MjA4MDY3NTkyMH0._ntPFIsWPmWIiOFh0h6-BymsS4Izwftom9NbfmgQe88';

  window.AA_DATA = { properties: [], loading: true, error: null };

  // ----- Yardımcılar -----
  function pick(row, camelKey, snakeKey, fallback) {
    if (row[camelKey] !== undefined && row[camelKey] !== null) return row[camelKey];
    if (snakeKey && row[snakeKey] !== undefined && row[snakeKey] !== null) return row[snakeKey];
    return fallback;
  }
  function slugify(s) {
    if (!s) return 'ilan';
    return String(s).toLowerCase()
      .replace(/ğ/g,'g').replace(/ü/g,'u').replace(/ş/g,'s')
      .replace(/ı/g,'i').replace(/ö/g,'o').replace(/ç/g,'c')
      .replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,60);
  }
  function badge(status, createdAt) {
    if (status === 'Kapora Alındı') return 'KAPORA ALINDI';
    if (status === 'Satıldı') return 'SATILDI';
    if (status === 'Kiralandı') return 'KİRALANDI';
    if (createdAt) {
      var age = (Date.now() - new Date(createdAt).getTime()) / (1000*60*60*24);
      if (age < 14) return 'YENİ';
    }
    return null;
  }

  // ----- Loading placeholder (DOM hazır olduğunda göster) -----
  function showLoadingPlaceholder() {
    var grid = document.getElementById('grid');
    var count = document.getElementById('countOut');
    if (count) count.textContent = '…';
    if (grid) {
      grid.innerHTML =
        '<div class="empty" style="grid-column:1/-1; padding:60px 20px; text-align:center;">' +
          '<div class="loading-pulse" style="display:inline-block; padding:14px 24px; border-radius:999px; background:var(--accent-tint, #eee); color:var(--accent, #333); font-weight:500;">' +
          'Portföy yükleniyor…' +
          '</div>' +
          '<p style="color:var(--ink-muted); margin-top:14px;">Güncel ilanları Supabase\'den çekiyoruz.</p>' +
        '</div>';
    }
  }

  // ----- Transform: CRM row → site Property -----
  function transform(row, idx) {
    var listingStatus = pick(row, 'listingStatus', 'listing_status', 'Aktif');
    var typeStr = pick(row, 'subCategory', null, null) || pick(row, 'status', null, null) || 'Satılık';
    if (typeStr === 'Devren Satılık' || typeStr === 'Devren Kiralık') typeStr = 'Devren';
    if (typeStr === 'Satılık Daire') typeStr = 'Satılık';
    if (typeStr === 'Kiralık Daire') typeStr = 'Kiralık';

    var cat = (pick(row, 'category', null, 'KONUT') + '').toUpperCase();
    var imagesArr = pick(row, 'images', null, []);
    var photos = Array.isArray(imagesArr) && imagesArr.length
      ? imagesArr
      : ['https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=1200&h=800&q=80&auto=format&fit=crop'];

    var coordsObj = pick(row, 'coordinates', null, null);
    var coords = coordsObj && typeof coordsObj === 'object' && coordsObj.lat
      ? coordsObj : { lat: 41.04, lng: 29.18 };

    var floorVal = pick(row, 'currentFloor', 'floor', null);
    var floor = floorVal != null
      ? (floorVal === 0 || floorVal === '0' ? 'Zemin' : floorVal + (String(floorVal).match(/\d/) ? '. kat' : ''))
      : '—';

    var grossA = pick(row, 'grossArea', 'gross_area', null)
              || pick(row, 'squareMeters', 'square_meters', null)
              || pick(row, 'area', null, 0);
    var netA = pick(row, 'netArea', 'net_area', null) || grossA;

    return {
      id: idx + 1,
      uuid: row.id,
      slug: slugify(row.title) + '-' + String(row.id || idx).slice(0,6),
      title: row.title || 'İsimsiz ilan',
      district: pick(row, 'district', null, null) || pick(row, 'city', null, null) || 'İstanbul',
      neighborhood: pick(row, 'neighborhood', null, ''),
      listingStatus: listingStatus,
      type: typeStr,
      category: cat,
      price: Number(row.price) || 0,
      currency: row.currency || 'TRY',
      badge: badge(listingStatus, row.created_at),
      bedrooms: pick(row, 'rooms', null, cat === 'KONUT' ? '—' : ''),
      bathrooms: row.bathrooms || 0,
      grossArea: grossA || 0,
      netArea: netA || 0,
      floor: floor,
      buildingAge: pick(row, 'buildingAge', 'building_age', 0),
      heating: pick(row, 'heating', 'heating_type', '—') || '—',
      furnished: pick(row, 'furnished', null, false) ? 'Evet' : 'Hayır',
      parking: pick(row, 'parking', null, '—') || '—',
      inSite: pick(row, 'isInSite', 'is_in_site', false) ? 'Evet' : 'Hayır',
      monthlyDues: pick(row, 'dues', null, 0) || 0,
      description: row.description || '',
      photos: photos,
      coords: coords
    };
  }

  // ----- Fetch -----
  function fetchProperties() {
    var url = SUPABASE_URL + '/rest/v1/properties'
      + '?select=*'
      + '&publishedOnPersonalSite=eq.true'
      + '&user_id=eq.' + ADEM_USER_ID
      + '&order=created_at.desc'
      + '&limit=100';

    fetch(url, {
      headers: {
        'apikey': SUPABASE_ANON,
        'Authorization': 'Bearer ' + SUPABASE_ANON,
        'Accept': 'application/json'
      }
    })
    .then(function (r) {
      if (!r.ok) return r.text().then(function (t) { throw new Error('Supabase ' + r.status + ': ' + t); });
      return r.json();
    })
    .then(function (rows) {
      console.log('[Adem Aslan] Supabase ' + (rows ? rows.length : 0) + ' ilan döndürdü');
      window.AA_DATA.properties = (rows || []).map(transform);
      window.AA_DATA.loading = false;
      document.dispatchEvent(new CustomEvent('aa-data-ready', { detail: window.AA_DATA }));
      if (typeof window.AA_RENDER === 'function') {
        try { window.AA_RENDER(); } catch (e) { console.error('AA_RENDER:', e); }
      }
    })
    .catch(function (err) {
      console.error('[Adem Aslan] Portföy yüklenemedi:', err.message);
      window.AA_DATA.loading = false;
      window.AA_DATA.error = err.message;
      document.dispatchEvent(new CustomEvent('aa-data-ready', { detail: window.AA_DATA }));
      if (typeof window.AA_RENDER === 'function') {
        try { window.AA_RENDER(); } catch (e) {}
      }
    });
  }

  // ----- Başlat -----
  function start() {
    showLoadingPlaceholder();
    fetchProperties();
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
