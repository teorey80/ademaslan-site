#!/usr/bin/env python3
"""ademaslan.com SEO koruma katmanı — idempotent onarıcı.

Sayfalar site dışında üretilip repoya kopyalandığı için <head> bloğundaki SEO
etiketleri her içerik güncellemesinde siliniyor. Bu script tüm SEO
değişmezlerini yeniden dayatır; istediğiniz kadar çalıştırabilirsiniz.

  python3 tools/seo-guard.py            # onar
  python3 tools/seo-guard.py --check    # onarma, sadece raporla (çıkış kodu 1)

.githooks/pre-commit her commit'te bunu çalıştırır.
"""
from __future__ import annotations

import glob
import html as html_mod
import json
import os
import re
import sys

SITE = "https://ademaslan.com"
BRAND = "Adem Aslan — Çekmeköy Gayrimenkul"
LOGO = f"{SITE}/assets/logo-adem-aslan.png"

# Kök sayfa → (canonical URL, og:image dosya adı)
ROOT_PAGES = {
    "index.html": ("/", "logo-adem-aslan.png"),
    "projeler.html": ("/projeler", "logo-adem-aslan.png"),
    "rehberler.html": ("/rehberler", "logo-adem-aslan.png"),
    "portfoy.html": ("/portfoy", "logo-adem-aslan.png"),
    "hakkimda.html": ("/hakkimda", "adem-aslan-portre.png"),
    "cekmekoy-rehberi.html": ("/cekmekoy-rehberi", "logo-adem-aslan.png"),
    "tasarim-sistemi.html": ("/tasarim-sistemi", "logo-adem-aslan.png"),
}

# Dizine girmemesi gereken sayfalar
NOINDEX = {"tasarim-sistemi.html"}

# Alt dizin sayfalarının canonical'ı yayınlanan URL ile eşleşmeli.
# Netlify /projeler/<slug> → /projeler/<slug>/ yönlendirdiği için eğik çizgi şart.
SUBDIR_GLOBS = ("projeler/*/index.html", "rehberler/*/index.html")

# Kökte tekrar belirirse kopya içerik üreten eski sayfalar
DUPLICATES = ["birbahce-evleri.html", "nef-camlitepe.html"]

# İç bağlantı normalizasyonu: .html → temiz URL
LINK_MAP = {
    'href="index.html#': 'href="/#',
    'href="index.html"': 'href="/"',
    'href="projeler.html"': 'href="/projeler"',
    'href="rehberler.html"': 'href="/rehberler"',
    'href="portfoy.html"': 'href="/portfoy"',
    'href="hakkimda.html"': 'href="/hakkimda"',
    'href="cekmekoy-rehberi.html"': 'href="/cekmekoy-rehberi"',
    'href="tasarim-sistemi.html"': 'href="/tasarim-sistemi"',
    'href="portfoy-detay.html?id=': 'href="/portfoy-detay?id=',
}

fixes: list[str] = []
problems: list[str] = []


def all_pages() -> list[str]:
    pages = sorted(glob.glob("*.html"))
    for g in SUBDIR_GLOBS:
        pages += sorted(glob.glob(g))
    skip = {"404.html", "google507066af8d293946.html"}
    return [p for p in pages if os.path.basename(p) not in skip]


def self_closing(h: str) -> str:
    """Sayfa <meta ... /> mi <meta ...> mi kullanıyor — biçimi koru."""
    return " />" if re.search(r'<meta name="description"[^>]*/>', h) else ">"


def ensure_head_tags(path: str, h: str) -> str:
    """Kök sayfalarda canonical, og:*, twitter:* etiketlerini garantiye al."""
    url_path, img = ROOT_PAGES[path]
    url = SITE + url_path
    img_url = f"{SITE}/assets/{img}"
    c = self_closing(h)

    if "rel=\"canonical\"" not in h:
        m = re.search(r'<meta name="description"[^>]*?/?>', h)
        if m:
            h = h[:m.end()] + f'\n<link rel="canonical" href="{url}"{c}' + h[m.end():]
            fixes.append(f"{path}: canonical eklendi")
        else:
            problems.append(f"{path}: description meta yok, canonical eklenemedi")

    # og:image mutlak olmalı — göreli yol önizleme botlarınca çözülemez
    h2 = re.sub(r'(<meta property="og:image" content=")(?!https?:)/?(assets/)',
                r'\1' + SITE + r'/\2', h)
    if h2 != h:
        fixes.append(f"{path}: og:image mutlak URL yapıldı")
        h = h2

    # noindex sayfalar paylaşılmadığı için sosyal etiket aranmaz
    missing = missing_tw = []
    if path not in NOINDEX:
        missing = [(k, v) for k, v in (
            ("og:url", url), ("og:site_name", BRAND), ("og:locale", "tr_TR"),
        ) if f'property="{k}"' not in h]
        missing_tw = [(k, v) for k, v in (
            ("twitter:card", "summary_large_image"), ("twitter:image", img_url),
        ) if f'name="{k}"' not in h]

    if missing or missing_tw:
        anchor = re.search(r'<meta property="og:type" content="[a-z]+"[^>]*?/?>', h)
        if anchor:
            add = "".join(f'\n<meta property="{k}" content="{v}"{c}' for k, v in missing)
            add += "".join(f'\n<meta name="{k}" content="{v}"{c}' for k, v in missing_tw)
            h = h[:anchor.end()] + add + h[anchor.end():]
            fixes.append(f"{path}: {len(missing) + len(missing_tw)} sosyal etiket eklendi")
        else:
            problems.append(f"{path}: og:type yok, sosyal etiketler eklenemedi")

    if path in NOINDEX and 'name="robots"' not in h:
        m = re.search(r'<link rel="canonical"[^>]*?/?>', h)
        if m:
            h = h[:m.end()] + f'\n<meta name="robots" content="noindex, follow"{c}' + h[m.end():]
            fixes.append(f"{path}: noindex eklendi")

    return h


def enrich_entity(path: str, h: str) -> str:
    """Ana sayfadaki RealEstateAgent şemasına varlık sinyallerini geri koy.

    telephone/address/sameAs, yapay zeka yanıt motorlarının ve Google'ın
    işletmeyi gerçek bir varlıkla eşleştirmesini sağlar.
    """
    m = re.search(r'(<script type="application/ld\+json">)(\s*\{.*?\})(\s*</script>)', h, re.S)
    if not m:
        return h
    try:
        d = json.loads(m.group(2))
    except json.JSONDecodeError:
        return h
    if d.get("@type") != "RealEstateAgent" or "telephone" in d:
        return h

    d["url"] = SITE + "/"
    d["image"] = LOGO
    d["telephone"] = "+90-532-207-40-87"
    d["address"] = {"@type": "PostalAddress", "addressLocality": "Çekmeköy",
                    "addressRegion": "İstanbul", "addressCountry": "TR"}
    d["sameAs"] = ["https://instagram.com/ademaslan.official",
                   "https://www.youtube.com/@ademaslan.official",
                   "https://www.tiktok.com/@ademaslan.official",
                   "https://www.threads.com/@ademaslan.official"]
    fixes.append(f"{path}: RealEstateAgent şeması zenginleştirildi")
    return (h[:m.start()] + m.group(1) + "\n"
            + json.dumps(d, ensure_ascii=False, indent=2)
            + m.group(3) + h[m.end():])


def ensure_trailing_slash(path: str, h: str) -> str:
    """Alt dizin canonical/og:url değerleri yayınlanan URL ile eşleşsin."""
    slug = path.rsplit("/index.html", 1)[0]
    bare = f"{SITE}/{slug}"
    out = h.replace(f'content="{bare}"', f'content="{bare}/"')
    out = out.replace(f'href="{bare}"', f'href="{bare}/"')
    if out != h:
        fixes.append(f"{path}: canonical/og:url sondaki eğik çizgi")
    return out


def normalize_links(path: str, h: str) -> str:
    """İç bağlantıları temiz URL'ye çevir — gereksiz 301 atlaması olmasın."""
    out = h
    for old, new in LINK_MAP.items():
        out = out.replace(old, new)
    # /rehberler/<slug> ve /projeler/<slug> → sondaki eğik çizgi
    out = re.sub(r'href="/(projeler|rehberler)/([a-z0-9-]+)"',
                 r'href="/\1/\2/"', out)
    if out != h:
        fixes.append(f"{path}: iç bağlantılar temiz URL'ye normalize edildi")
    return out


def split_faq(path: str, h: str) -> str:
    """Question'ları Article.mainEntity içinden ayrı FAQPage bloğuna taşı.

    Article içine gömülü Question'lar geçersizdir; ne arama motorları ne de
    yapay zeka yanıt motorları soru-cevap olarak okuyabilir.
    """
    if "FAQPage" in h:
        return h
    m = re.search(r'(<script(?: id="ldjson")? type="application/ld\+json">)(.*?)(</script>)',
                  h, re.S)
    if not m or not m.group(2).strip():
        return h
    try:
        data = json.loads(m.group(2))
    except json.JSONDecodeError:
        problems.append(f"{path}: JSON-LD ayrıştırılamadı")
        return h
    qs = data.get("mainEntity")
    if not (isinstance(qs, list) and qs and isinstance(qs[0], dict)
            and qs[0].get("@type") == "Question"):
        return h

    url = (data.get("mainEntityOfPage") or {}).get("@id", "")
    if url and not url.endswith("/"):
        url += "/"
    del data["mainEntity"]
    if url:
        data["mainEntityOfPage"] = {"@type": "WebPage", "@id": url}
        data["url"] = url
    data.setdefault("inLanguage", "tr")

    faq = {"@context": "https://schema.org", "@type": "FAQPage",
           "inLanguage": "tr", "mainEntity": qs}
    if url:
        faq["@id"] = url + "#faq"
        faq["url"] = url

    new = (m.group(1) + json.dumps(data, ensure_ascii=False) + m.group(3)
           + '\n<script type="application/ld+json">'
           + json.dumps(faq, ensure_ascii=False) + "</script>")
    fixes.append(f"{path}: {len(qs)} soru ayrı FAQPage bloğuna taşındı")
    return h[:m.start()] + new + h[m.end():]


def check_json_ld(path: str, h: str) -> None:
    for block in re.findall(r'<script[^>]*application/ld\+json[^>]*>(.*?)</script>',
                            h, re.S):
        if not block.strip() or "+ JSON.stringify" in block:
            continue  # JS ile doldurulan şablon
        try:
            json.loads(block)
        except json.JSONDecodeError as e:
            problems.append(f"{path}: geçersiz JSON-LD ({e})")


def sync_sitemap() -> None:
    """Tüm alt dizin sayfaları sitemap'te ve sondaki eğik çizgiyle olsun."""
    if not os.path.exists("sitemap.xml"):
        problems.append("sitemap.xml yok")
        return
    s = open("sitemap.xml").read()
    orig = s

    s = re.sub(r'<loc>(' + re.escape(SITE) + r'/(?:projeler|rehberler)/[a-z0-9-]+)</loc>',
               r'<loc>\1/</loc>', s)

    for g in SUBDIR_GLOBS:
        for f in sorted(glob.glob(g)):
            slug = f.rsplit("/index.html", 1)[0]
            loc = f"{SITE}/{slug}/"
            if loc not in s:
                entry = (f'  <url><loc>{loc}</loc><changefreq>monthly</changefreq>'
                         f'<priority>0.7</priority></url>\n')
                s = s.replace("</urlset>", entry + "</urlset>")
                fixes.append(f"sitemap: {slug} eklendi")

    for page in NOINDEX:
        stem = ROOT_PAGES[page][0]
        s = re.sub(r'\s*<url>(?:(?!</url>).)*?' + re.escape(SITE + stem)
                   + r'</loc>(?:(?!</url>).)*?</url>', "", s, flags=re.S)

    if s != orig:
        if s.count("<loc>") != len(re.findall(r"<url>", s)):
            problems.append("sitemap: <url>/<loc> sayısı tutmuyor, yazılmadı")
            return
        open("sitemap.xml", "w").write(s)
        if not any(f.startswith("sitemap:") for f in fixes):
            fixes.append("sitemap: URL'ler normalize edildi")


def main() -> int:
    check_only = "--check" in sys.argv
    os.chdir(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))

    for d in DUPLICATES:
        if os.path.exists(d):
            problems.append(
                f"{d}: kopya sayfa köke geri gelmiş — /projeler/ altındaki sürümü "
                f"kopyalıyor. Silin (_redirects'teki 301! yönlendirmesi devralır).")

    for path in all_pages():
        h = orig = open(path).read()
        if path in ROOT_PAGES:
            h = ensure_head_tags(path, h)
        if path == "index.html":
            h = enrich_entity(path, h)
        if "/" in path:
            h = ensure_trailing_slash(path, h)
            h = split_faq(path, h)
        h = normalize_links(path, h)
        check_json_ld(path, h)
        if h != orig and not check_only:
            open(path, "w").write(h)

    if not check_only:
        sync_sitemap()

    if fixes:
        print("SEO koruma — onarıldı:" if not check_only else "SEO koruma — eksik:")
        for f in fixes:
            print("  ✔", f)
    if problems:
        print("SEO koruma — elle bakılmalı:")
        for p in problems:
            print("  ✖", p)
    if not fixes and not problems:
        print("SEO koruma: tüm değişmezler yerinde.")

    if problems:
        return 1
    return 1 if (check_only and fixes) else 0


if __name__ == "__main__":
    sys.exit(main())
