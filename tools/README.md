# SEO koruma katmanı

## Sorun

Sayfalar site dışında üretilip repoya kopyalanıyor. Kopyalanan HTML'in `<head>`
bloğu sıfırdan yazıldığı için elle eklenen SEO etiketleri her içerik
güncellemesinde siliniyor. `fe3b1fb` commit'inde tam olarak bu oldu: tüm kök
sayfa canonical'ları, sosyal etiketler ve şema zenginleştirmeleri kayboldu,
silinmiş kopya sayfalar geri geldi. Canlıda kopya içerik oluştu ve kimse fark
etmedi.

## Çözüm

`seo-guard.py` tüm SEO değişmezlerini idempotent şekilde yeniden dayatır.
Kaynağın ne ürettiği önemli değil — commit'e giden hâli her zaman doğru olur.

```bash
python3 tools/seo-guard.py          # onar
python3 tools/seo-guard.py --check  # onarma, sadece raporla
```

`.githooks/pre-commit` bunu her commit'te otomatik çalıştırır ve onardığı
dosyaları commit'e ekler. Kurulum (klon başına bir kez):

```bash
git config core.hooksPath .githooks
```

Elle müdahale gerektiren bir şey bulursa commit durur. Bilerek atlamak için
`git commit --no-verify`.

## Dayatılan değişmezler

| Değişmez | Neden |
|---|---|
| Kök sayfalarda `rel=canonical` | Kopya URL'lerin tek hedefte toplanması |
| `og:url`, `og:site_name`, `og:locale`, `twitter:card`, `twitter:image` | Sosyal ve yapay zeka önizlemeleri |
| `og:image` mutlak URL | Göreli yolu hiçbir önizleme botu çözemez |
| Alt dizin canonical/og:url sondaki eğik çizgi | Netlify `/x` → `/x/` yönlendirir; canonical yayınlanan URL ile eşleşmeli |
| İç bağlantılar temiz URL | Gereksiz 301 atlaması olmasın |
| `Article` içindeki Question'lar ayrı `FAQPage` bloğuna | Gömülü Question geçersizdir; yapay zeka yanıt motorları okuyamaz |
| Ana sayfa `RealEstateAgent` şeması (telefon/adres/sameAs) | Varlık eşleştirme sinyalleri |
| `tasarim-sistemi` noindex + sitemap dışı | İç sayfa, arama sonucunda işi yok |
| Sitemap: tüm rehber/proje dizinleri, eğik çizgili | Yeni rehberler otomatik girsin |
| JSON-LD geçerlilik denetimi | Bozuk şema sessizce yok sayılır |

## Kapsam dışı — elle bakılmalı

- **Kök dizine geri gelen kopya sayfalar** (`birbahce-evleri.html`,
  `nef-camlitepe.html`): script silmez, sadece uyarır. `_redirects` içindeki
  `301!` kuralları kalıcı savunmadır — dosya geri gelse bile zorunlu
  yönlendirme onu gölgeler.
- **Yeni içeriğin gövdesi**: başlık, açıklama, hızlı cevap kutusu, kaynak
  alıntıları. Bunlar içerik kararı, otomatikleştirilmiyor.

## Rehber sayfasına video gömme

```bash
python3 tools/set-video.py <sayfa-yolu> <video-id-veya-url> [YYYY-MM-DD]
```

oEmbed'den başlığı ve küçük resmi çeker, iframe'i günceller, `VideoObject`
şemasını ekler/değiştirir. Google "video içeren rehber" işaretlemesi için
iframe'i değil bu şemayı okur — embed tek başına sinyal üretmez.
