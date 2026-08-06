#!/usr/bin/env python3
"""Bir rehber sayfasındaki YouTube embed'ini ve VideoObject şemasını ayarlar.

Kullanım:  python3 set-video.py <sayfa-yolu> <video-id-veya-url> [yayın-tarihi YYYY-MM-DD]

oEmbed'den başlık ve küçük resmi çeker; iframe'i günceller ve
VideoObject JSON-LD bloğunu ekler/değiştirir.
"""
import json
import re
import sys
import urllib.request

page = sys.argv[1]
raw = sys.argv[2]
upload_date = sys.argv[3] if len(sys.argv) > 3 else None

m = re.search(r'(?:v=|youtu\.be/|/shorts/|/embed/)([\w-]{11})', raw)
vid = m.group(1) if m else raw.strip()
assert re.fullmatch(r'[\w-]{11}', vid), f"geçersiz video id: {vid}"

api = f"https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v={vid}&format=json"
with urllib.request.urlopen(api) as r:
    meta = json.load(r)

title = meta["title"]
thumb = f"https://i.ytimg.com/vi/{vid}/maxresdefault.jpg"
page_url = "https://ademaslan.com/" + re.sub(r'^\./|index\.html$', '', page)

h = open(page).read()

# --- iframe'i güncelle ---
h, n = re.subn(
    r'(<iframe src="https://www\.youtube\.com/embed/)[\w-]{11}(" title=")[^"]*(")',
    lambda mm: mm.group(1) + vid + mm.group(2) + title.replace('"', '&quot;') + mm.group(3),
    h, count=1)
assert n == 1, "iframe bulunamadı"

# --- VideoObject şeması ---
video = {
    "@context": "https://schema.org",
    "@type": "VideoObject",
    "name": title,
    "description": re.search(r'<meta name="description" content="([^"]*)"', h).group(1),
    "thumbnailUrl": [thumb],
    "embedUrl": f"https://www.youtube.com/embed/{vid}",
    "contentUrl": f"https://www.youtube.com/watch?v={vid}",
    "inLanguage": "tr",
    "publisher": {
        "@type": "Organization",
        "name": "Adem Aslan Gayrimenkul",
        "url": "https://ademaslan.com/",
        "logo": {"@type": "ImageObject", "url": "https://ademaslan.com/assets/logo-adem-aslan.png"},
    },
    "creator": {"@type": "Person", "name": "Adem Aslan", "url": "https://ademaslan.com/hakkimda"},
    "isPartOf": {"@type": "WebPage", "@id": page_url},
}
if upload_date:
    video["uploadDate"] = upload_date

block = '<script id="ldjson-video" type="application/ld+json">' + \
        json.dumps(video, ensure_ascii=False) + '</script>'

if 'id="ldjson-video"' in h:
    h = re.sub(r'<script id="ldjson-video" type="application/ld\+json">.*?</script>',
               lambda _: block, h, count=1, flags=re.S)
else:
    h = h.replace('</head>', block + '\n</head>', 1)

open(page, 'w').write(h)
print(f"{page}: video={vid}\n  başlık: {title}")
