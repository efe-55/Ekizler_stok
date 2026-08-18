# Ekizler Ticaret — Stok Takip

Bu klasör, Claude içinde geliştirdiğimiz prototipin **gerçek, herkesin tarayıcıdan açabileceği bir web
sitesi** haline getirilmiş hali. Kod (ekranlar, hesaplamalar, kurallar) **birebir aynı** — sadece veri artık
Claude'a özel geçici depolama yerine gerçek, paylaşılan bir veritabanında tutuluyor.

Toplam maliyet: **0 TL** (bu ölçek için üç servisin de ücretsiz katmanı fazlasıyla yeterli).

Aşağıdaki adımları sırayla takip edin. Kod bilmenize gerek yok, hepsi kopyala-yapıştır ve tıklama.

---

## 1. Supabase hesabı açın (veritabanı)

1. [supabase.com](https://supabase.com) adresine gidin, **Start your project** ile ücretsiz hesap açın (GitHub veya e-posta ile).
2. **New project** deyin. İsim olarak `ekizler-stok` yazabilirsiniz, bir şifre belirleyin (unutmayın), bölge olarak Avrupa'ya yakın bir yer seçin.
3. Proje oluşunca sol menüden **SQL Editor**'ü açın, **New query** deyin.
4. Bu klasördeki `supabase-schema.sql` dosyasının içeriğini kopyalayıp yapıştırın, **Run**'a basın. (Bu, verilerin tutulacağı tabloyu oluşturur.)
5. Sol menüden **Project Settings > API**'ye gidin. Burada iki bilgiyi not edin:
   - **Project URL** (bir linke benziyor)
   - **anon public** anahtarı (uzun bir kod)

Bu ikisine birazdan ihtiyacımız olacak.

## 2. Kodu GitHub'a yükleyin

1. [github.com](https://github.com) üzerinde ücretsiz hesap açın (yoksa).
2. Sağ üstten **New repository** deyin, isim verin (`ekizler-stok-takip`), **Create repository**.
3. Bu klasördeki tüm dosyaları o repository'ye yükleyin — GitHub'ın "uploading an existing file" sürükle-bırak ekranını kullanabilirsiniz (kod bilmeden, dosyaları sürükleyip "Commit changes" demeniz yeterli).

## 3. Vercel'e bağlayıp yayınlayın (site burada canlanıyor)

1. [vercel.com](https://vercel.com) adresine gidin, **GitHub ile devam et** deyip aynı GitHub hesabınızla giriş yapın.
2. **Add New > Project** deyin, az önce yüklediğiniz `ekizler-stok-takip` repository'sini seçip **Import** deyin.
3. Karşınıza ayarlar ekranı gelecek. **Environment Variables** kısmına şu ikisini ekleyin (1. adımda not ettiğiniz bilgiler):
   - `VITE_SUPABASE_URL` → Supabase'teki Project URL
   - `VITE_SUPABASE_ANON_KEY` → Supabase'teki anon public anahtarı
4. **Deploy**'a basın. 1-2 dakika içinde size gerçek bir adres verecek: `https://ekizler-stok-takip.vercel.app` gibi.

Bu adresi artık siz ve çalışanlarınız telefon, tablet, bilgisayar fark etmeksizin açabilir — hepsi
**aynı veriyi** görür ve günceller.

## 4. Veritabanının hiç "uyumaması" için son bir adım (önemli)

Supabase'in ücretsiz katmanı, **7 gün boyunca hiç kullanılmazsa** projeyi otomatik durduruyor — biri
elle "devam ettir" demeden site hata vermeye başlar. Bu klasörde bunu önleyen, haftada iki kez
otomatik "merhaba" mesajı gönderen ücretsiz bir görev (`keep-alive.yml`) zaten hazır — sadece
GitHub'a iki gizli bilgiyi tanıtmanız gerekiyor:

1. GitHub'daki repository'nizde **Settings** sekmesine girin.
2. Sol menüden **Secrets and variables > Actions**'ı açın.
3. **New repository secret** deyip sırayla şu ikisini ekleyin:
   - İsim: `SUPABASE_URL` → Değer: Supabase'teki Project URL (1. adımda not ettiğiniz)
   - İsim: `SUPABASE_ANON_KEY` → Değer: Supabase'teki anon public anahtarı
4. Bu kadar. Görev otomatik olarak her Pazartesi ve Perşembe çalışıp veritabanınızı uyanık tutacak — siz hiçbir şey yapmayacaksınız.

İsterseniz hemen test etmek için: repository'de **Actions** sekmesine girip **Supabase Uyandırma
(Keep Alive)** görevini seçin, **Run workflow** deyip elle bir kere çalıştırabilirsiniz.

---

## Sonradan bir güncelleme geldiğinde ne yapacağız?

Ben size güncellenmiş `App.jsx` dosyasını her verdiğimde, tek yapmanız gereken:
1. GitHub'daki repository'de eski `src/App.jsx` dosyasını açıp, içeriğini yenisiyle değiştirmek (yine kopyala-yapıştır)
2. Kaydetmek ("Commit changes")

Vercel bunu otomatik algılar ve siteyi birkaç saniyede kendiliğinden günceller — sizin başka
hiçbir şey yapmanıza gerek yok.

## Şu an bilerek basit bıraktığımız kısım

Şu anki veritabanı yapısı çok basit (tek bir "kutuya" tüm veriyi JSON olarak koyuyoruz) — bu, hızlı ve
sorunsuz canlıya geçmek için bilinçli bir tercih, sisteme zaten alıştığımız Claude prototipiyle birebir
aynı şekilde çalışır. İleride (isterseniz) bunu daha "düzgün" bir veritabanı yapısına (her marka,
her sayım kendi tablosunda) taşıyabiliriz — ama bu, kullanıcı deneyiminde hiçbir şeyi değiştirmez,
sadece arka plandaki teknik bir iyileştirme olur. Adım adım ilerleme felsefemize uygun: önce çalışsın,
sonra gerekirse olgunlaştırırız.

## Kullanıcı girişi (login) hakkında not

Şu anki haliyle site adresini bilen herkes veriyi görüp değiştirebilir (şifre yok). Bu, ilk aşama için
kasıtlı olarak basit tutuldu. İsterseniz bir sonraki adımda Supabase'in ücretsiz kullanıcı girişi
özelliğini ekleyip siteyi şifre korumalı hale getirebiliriz.
