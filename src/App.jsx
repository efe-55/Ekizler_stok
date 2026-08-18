import { useState, useEffect } from "react";
import { Plus, AlertTriangle, CheckCircle2, Trash2, ChevronRight, ChevronLeft, Package, History, FilePlus2, Upload, Wand2, Folder, ClipboardList, Pencil, Search } from "lucide-react";
import * as XLSX from "xlsx";

const uid = () => Math.random().toString(36).slice(2, 9);

// Ürün isimleri artık SİZİN kendi Excel şablonunuzdaki adlarla birebir aynı (Aybelsoft'un kısa
// adıyla değil). Aybelsoft eşleştirmesi ayrı bir "kod" alanıyla arka planda hâlâ çalışıyor.
const MASTER_URUNLER = {
  Patates: ["I. PATATES (40)", "I. PATATES (25)", "II. PATATES (40)", "II. PATATES (25)", "III. PATATES (40)", "KUMPİR PATATES"],
  Soğan: ["SOĞAN", "II. SOĞAN", "TAKOZ SOĞAN", "KIRMIZI SOĞAN"],
};

// Aybelsoft'un kendi kısa kodları (PAT, 2PAT gibi) ile sizin görünen isminiz arasındaki eşleşme.
// "2PAT" ve "KUM" gerçek dosyanızda doğrulandı, geri kalanı aynı mantıktan tahmin edildi.
const URUN_KOD_TAHMIN = {
  "I. PATATES (40)": "PAT", "I. PATATES (25)": "25PAT", "II. PATATES (40)": "2PAT", "II. PATATES (25)": "25-2PAT", "III. PATATES (40)": "3PAT", "KUMPİR PATATES": "KUM",
  "SOĞAN": "SO", "II. SOĞAN": "2SO", "TAKOZ SOĞAN": "TSO", "KIRMIZI SOĞAN": "KSO",
};

function Stepper({ value, onChange }) {
  const v = Number(value) || 0;
  const [editing, setEditing] = useState(false);
  const [taslak, setTaslak] = useState("");
  return (
    <div className="flex items-center gap-1">
      <button type="button" onClick={() => onChange(String(Math.max(0, v - 10)))} className="w-7 h-8 shrink-0 rounded bg-stone-100 hover:bg-stone-200 text-[11px] font-medium text-stone-600">−10</button>
      <button type="button" onClick={() => onChange(String(Math.max(0, v - 1)))} className="w-8 h-8 shrink-0 rounded bg-stone-100 hover:bg-stone-200 text-base leading-none font-medium">−</button>
      {editing ? (
        <input
          autoFocus
          type="number"
          value={taslak}
          placeholder={String(v)}
          onFocus={(e) => e.target.select()}
          onChange={(e) => setTaslak(e.target.value)}
          onBlur={() => { onChange(taslak === "" ? "0" : taslak); setEditing(false); }}
          className="w-14 text-center border border-amber-300 bg-white rounded py-1.5 text-sm font-mono"
        />
      ) : (
        <button type="button" onClick={() => { setTaslak(""); setEditing(true); }} className="w-14 text-center border border-amber-200 bg-amber-50 rounded py-1.5 text-sm font-mono font-medium">
          {v}
        </button>
      )}
      <button type="button" onClick={() => onChange(String(v + 1))} className="w-8 h-8 shrink-0 rounded bg-stone-100 hover:bg-stone-200 text-base leading-none font-medium">+</button>
      <button type="button" onClick={() => onChange(String(v + 10))} className="w-7 h-8 shrink-0 rounded bg-stone-100 hover:bg-stone-200 text-[11px] font-medium text-stone-600">+10</button>
    </div>
  );
}

function satirHesap(satir) {
  const satisAdet = Number(satir.satisAdet) || 0;
  const satisKg = Number(satir.satisKg) || 0;
  const kalanAdet = Number(satir.kalanAdet) || 0;
  const sayimAdet = Number(satir.sayimAdet) || 0;
  const sayimKg = Number(satir.sayimKg) || 0;
  const muhasebeOrtKg = sayimAdet > 0 ? sayimKg / sayimAdet : 0;
  const ortKgHesap = satisAdet > 0 ? satisKg / satisAdet : 0;
  const manuelVar = satir.ortKgManuel !== undefined && satir.ortKgManuel !== "";
  const ortKg = manuelVar ? Number(satir.ortKgManuel) : ortKgHesap;
  const kalanKg = kalanAdet * ortKg;
  const toplamKg = satisKg + kalanKg;
  return { ortKg, ortKgHesap, manuelVar, muhasebeOrtKg, sayimAdet, sayimKg, kalanKg, toplamKg, satisKg, satisAdet, kalanAdet };
}

function sayimOzet(sayim, marka) {
  let toplamSatisKg = 0;
  let toplamKalanKg = 0;
  sayim.satirlar.forEach((s) => {
    const h = satirHesap(s);
    toplamSatisKg += h.satisKg;
    toplamKalanKg += h.kalanKg;
  });
  const genelToplam = toplamSatisKg + toplamKalanKg;
  const yukleme = Number(marka?.toplamYuklemeKg) || 0;
  const fark = genelToplam - yukleme;
  return { toplamSatisKg, toplamKalanKg, genelToplam, fark, yukleme };
}

function esikDegeri(marka) {
  return Math.max(150, Math.abs(Number(marka.toplamYuklemeKg) || 0) * 0.03);
}

function anomaliler(marka, sayimListesi) {
  const list = [...sayimListesi].sort((a, b) => a.sayimNo - b.sayimNo);
  const notlar = [];
  let onceki = null;
  list.forEach((s) => {
    const { fark } = sayimOzet(s, marka);
    if (onceki !== null) {
      const delta = fark - onceki;
      if (Math.abs(delta) > esikDegeri(marka)) {
        notlar.push({ sayimNo: s.sayimNo, mesaj: `${s.sayimNo}. sayımda FARK ${delta > 0 ? "+" : ""}${delta.toFixed(0)} kg değişti — ani sıçrama, kaynağı araştırılmalı. Bir gün büyük eksik, ertesi gün fazla çıkması genelde satışın başka markaya yanlış işlendiğine işarettir.` });
      }
    }
    onceki = fark;
  });
  list.forEach((s) => {
    s.satirlar.forEach((satir) => {
      const adet = Number(satir.satisAdet) || 0;
      if (adet > 0 && adet < 50) {
        const urun = marka.urunler.find((u) => u.id === satir.urunId);
        notlar.push({ sayimNo: s.sayimNo, mesaj: `${s.sayimNo}. sayımda "${urun?.ad || "ürün"}" için satış adedi ${adet} — az örneklemden ortalama kg güvenilir olmayabilir, gerekirse elle düzeltin.` });
      }
    });
  });
  const urunBazli = {};
  list.forEach((s) => {
    s.satirlar.forEach((satir) => {
      if (!urunBazli[satir.urunId]) urunBazli[satir.urunId] = [];
      urunBazli[satir.urunId].push({ sayimNo: s.sayimNo, sayimKg: Number(satir.sayimKg) || 0, satisKg: Number(satir.satisKg) || 0 });
    });
  });
  Object.entries(urunBazli).forEach(([urunId, kayitlar]) => {
    const urun = marka.urunler.find((u) => u.id === urunId);
    for (let i = 1; i < kayitlar.length; i++) {
      const onceki2 = kayitlar[i - 1];
      const simdi = kayitlar[i];
      if (onceki2.sayimKg > 0 && simdi.sayimKg > 0 && Math.abs(simdi.sayimKg - onceki2.sayimKg) > Math.max(20, onceki2.sayimKg * 0.02)) {
        notlar.push({ sayimNo: simdi.sayimNo, mesaj: `"${urun?.ad || "ürün"}" için muhasebe kaydı ${onceki2.sayimNo}. sayımda ${fmt(onceki2.sayimKg)} kg, ${simdi.sayimNo}. sayımda ${fmt(simdi.sayimKg)} kg yazılmış — tutarsızlık var.` });
      }
      if (simdi.satisKg < onceki2.satisKg) {
        notlar.push({ sayimNo: simdi.sayimNo, mesaj: `"${urun?.ad || "ürün"}" için Aybelsoft satış kg'ı ${onceki2.sayimNo}. sayımdan (${fmt(onceki2.satisKg)} kg) ${simdi.sayimNo}. sayıma (${fmt(simdi.satisKg)} kg) düşmüş — muhtemelen başka markaya yazılmış.` });
      }
    }
  });
  return notlar;
}

function fmt(n) {
  return (Number(n) || 0).toLocaleString("tr-TR", { maximumFractionDigits: 1 });
}
function fmtKg(n) {
  return (Number(n) || 0).toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtTarih(t) {
  if (!t) return "-";
  const [y, m, d] = t.split("-");
  return d && m && y ? `${d}.${m}.${y}` : t;
}
function fmtSaat(ts) {
  const d = new Date(ts);
  return d.toLocaleString("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

const ETKINLIK_ETIKET = {
  yeni_islem: { label: "Yeni marka", renk: "text-teal-700 bg-teal-50" },
  sayim_eklendi: { label: "Sayım eklendi", renk: "text-blue-700 bg-blue-50" },
  sayim_kaydedildi: { label: "Sayım kaydedildi", renk: "text-stone-600 bg-stone-100" },
  sayim_duzenlendi: { label: "Sonradan düzenlendi", renk: "text-red-700 bg-red-50" },
  tamamlandi: { label: "Tamamlandı", renk: "text-emerald-700 bg-emerald-50" },
  yeniden_acildi: { label: "Yeniden açıldı", renk: "text-stone-600 bg-stone-100" },
  aybelsoft_aktarildi: { label: "Aybelsoft verisi aktarıldı", renk: "text-purple-700 bg-purple-50" },
  kalan_girildi: { label: "Dükkanda kalan girildi", renk: "text-blue-700 bg-blue-50" },
  baslik_duzenlendi: { label: "Marka bilgisi düzenlendi", renk: "text-red-700 bg-red-50" },
};
const SEED_REAL = JSON.parse(`{"markalar": [{"id": "5g3kuvr", "tarih": "2026-08-10", "marka": "A10", "urun": "PATATES (AYDINCIK)", "plaka": "55 UF 222", "toplamYuklemeKg": 26940, "urunler": [{"id": "gua8vpp", "ad": "I. PATATES (40)", "yuklemeAdet": null}, {"id": "68wg8fs", "ad": "I. PATATES (25)", "yuklemeAdet": 300}, {"id": "rd2mo1e", "ad": "II. PATATES (40)", "yuklemeAdet": 185}, {"id": "dz47mhi", "ad": "III. PATATES (40)", "yuklemeAdet": 34}], "durum": "aktif"}, {"id": "vuxks97", "tarih": "2026-08-10", "marka": "A10", "urun": "SOĞAN (AMASYA)", "plaka": "55 BJ 777", "toplamYuklemeKg": 27150, "urunler": [{"id": "h8aqw73", "ad": "SOĞAN", "yuklemeAdet": 410}, {"id": "tnb8qtk", "ad": "II. SOĞAN", "yuklemeAdet": 200}, {"id": "buzl375", "ad": "TAKOZ SOĞAN", "yuklemeAdet": 200}], "durum": "aktif"}, {"id": "03yb35m", "tarih": "2026-08-12", "marka": "A12", "urun": "PATATES", "plaka": "55 BJ 777", "toplamYuklemeKg": 27200, "urunler": [{"id": "ykg4l9m", "ad": "I. PATATES (40)", "yuklemeAdet": "YOK"}, {"id": "ybotasl", "ad": "I. PATATES (25)", "yuklemeAdet": "YOK"}, {"id": "7jncafi", "ad": "II. PATATES (40)", "yuklemeAdet": 91}, {"id": "zvfg4fc", "ad": "II. PATATES (25)", "yuklemeAdet": 189}, {"id": "rslc4m5", "ad": "III. PATATES (40)", "yuklemeAdet": "YOK"}], "durum": "aktif"}, {"id": "lced7py", "tarih": "2026-08-12", "marka": "A12", "urun": "SOĞAN (AMASYA)", "plaka": "55 UF 222", "toplamYuklemeKg": 25640, "urunler": [{"id": "rwmgz0x", "ad": "SOĞAN", "yuklemeAdet": 474}, {"id": "hl3i8xc", "ad": "II. SOĞAN", "yuklemeAdet": 200}, {"id": "opr7a12", "ad": "TAKOZ SOĞAN", "yuklemeAdet": 100}], "durum": "aktif"}, {"id": "ev3e29r", "tarih": "2026-08-13", "marka": "A13", "urun": "SOĞAN", "plaka": "55 AN 555", "toplamYuklemeKg": 25380, "urunler": [{"id": "55eadmz", "ad": "SOĞAN", "yuklemeAdet": "YOK"}, {"id": "wz6cvsf", "ad": "II. SOĞAN", "yuklemeAdet": 214}, {"id": "0gyxwpe", "ad": "TAKOZ SOĞAN", "yuklemeAdet": 250}], "durum": "aktif"}, {"id": "ed84jhj", "tarih": "2026-08-13", "marka": "A14", "urun": "PATATES (ÇORUM)", "plaka": "55 BJ 777", "toplamYuklemeKg": 28380, "urunler": [{"id": "zjb0z8l", "ad": "I. PATATES (40)", "yuklemeAdet": "YOK"}, {"id": "xmvkdxw", "ad": "I. PATATES (25)", "yuklemeAdet": "YOK"}, {"id": "lo0b8jc", "ad": "II. PATATES (40)", "yuklemeAdet": 166}], "durum": "aktif"}, {"id": "c2isnuh", "tarih": "2026-08-01", "marka": "A1", "urun": "PATATES", "plaka": "55 BJ 777", "toplamYuklemeKg": 27060, "urunler": [{"id": "p15mbdr", "ad": "I. PATATES (40)", "yuklemeAdet": 252}, {"id": "1fszfpj", "ad": "II. PATATES (40)", "yuklemeAdet": 291}, {"id": "ektxdq4", "ad": "III. PATATES (40)", "yuklemeAdet": 121}], "durum": "aktif"}, {"id": "nmx7ju2", "tarih": "2026-08-01", "marka": "A1", "urun": "SOĞAN", "plaka": "55 AN 555", "toplamYuklemeKg": 24360, "urunler": [{"id": "r7aaake", "ad": "SOĞAN", "yuklemeAdet": 450}, {"id": "09z3hkj", "ad": "II. SOĞ", "yuklemeAdet": 300}], "durum": "aktif"}, {"id": "lqadxda", "tarih": "2026-08-03", "marka": "A3", "urun": "PATATES (AMASYA)", "plaka": "55 AN 555", "toplamYuklemeKg": 26980, "urunler": [{"id": "np8jg1h", "ad": "I. PATATES (40)", "yuklemeAdet": 238}, {"id": "i8w2sw6", "ad": "I. PATATES (25)", "yuklemeAdet": 295}, {"id": "7rt7wdi", "ad": "II. PATATES (40)", "yuklemeAdet": 162}, {"id": "fw6sgug", "ad": "II. PATATES (25)", "yuklemeAdet": 104}, {"id": "xrlo7ec", "ad": "III. PATATES (40)", "yuklemeAdet": 18}], "durum": "aktif"}, {"id": "ajlmorz", "tarih": "2026-08-03", "marka": "A3", "urun": "SOĞAN", "plaka": "55 UF 222", "toplamYuklemeKg": 26600, "urunler": [{"id": "8xuiqci", "ad": "SOĞAN", "yuklemeAdet": 562}, {"id": "we3sql3", "ad": "II.SOĞAN", "yuklemeAdet": 187}, {"id": "q8o0ckl", "ad": "TAKOZ SOĞAN", "yuklemeAdet": 65}], "durum": "aktif"}, {"id": "mas9wkz", "tarih": "2026-08-04", "marka": "A5", "urun": "PATATES (AMASYA)", "plaka": "55 BJ 777", "toplamYuklemeKg": 26350, "urunler": [{"id": "ht4rqmt", "ad": "I. PATATES (40)", "yuklemeAdet": 255}, {"id": "vday7zo", "ad": "I. PATATES (25)", "yuklemeAdet": 204}, {"id": "g4p9ss4", "ad": "II. PATATES (40)", "yuklemeAdet": 221}, {"id": "j09zo0i", "ad": "III. PATATES (40)", "yuklemeAdet": 50}], "durum": "aktif"}, {"id": "a77n8fz", "tarih": "2026-08-06", "marka": "A6", "urun": "PATATES (AYDINCIK)", "plaka": "55 UF 222", "toplamYuklemeKg": 26280, "urunler": [{"id": "ktbb18c", "ad": "I. PATATES (40)", "yuklemeAdet": 485}, {"id": "0rjehjn", "ad": "II. PATATES (40)", "yuklemeAdet": 155}], "durum": "aktif"}, {"id": "v0xgd6b", "tarih": "2026-08-06", "marka": "A6", "urun": "SOĞAN (AYDINCIK)", "plaka": "55 AN 555", "toplamYuklemeKg": 26160, "urunler": [{"id": "trhohdu", "ad": "SOĞAN", "yuklemeAdet": 529}, {"id": "q2s4vei", "ad": "II. SOĞAN", "yuklemeAdet": 180}, {"id": "yacehxl", "ad": "TAKOZ SOĞAN", "yuklemeAdet": 86}], "durum": "aktif"}, {"id": "wrr4nc4", "tarih": "2026-08-07", "marka": "A7", "urun": "PATATES (AYDINCIK)", "plaka": "55 BJ 777", "toplamYuklemeKg": 27520, "urunler": [{"id": "txgw4gw", "ad": "I. PATATES (40)", "yuklemeAdet": "YOK"}, {"id": "9rf117b", "ad": "I. PATATES (25)", "yuklemeAdet": "YOK"}, {"id": "8fc74ra", "ad": "II. PATATES (40)", "yuklemeAdet": 173}, {"id": "30fbrb8", "ad": "III. PATATES (40)", "yuklemeAdet": 21}, {"id": "34jaxqx", "ad": "KUMPİR PATATES (40)", "yuklemeAdet": "YOK"}], "durum": "aktif"}, {"id": "tsr1avg", "tarih": "2026-08-08", "marka": "A8", "urun": "PATATES", "plaka": "55 AN 555", "toplamYuklemeKg": 26890, "urunler": [{"id": "d4bx5xl", "ad": "I. PATATES (40)", "yuklemeAdet": 432}, {"id": "a7uk16a", "ad": "I. PATATES (25)", "yuklemeAdet": 250}, {"id": "chbv89b", "ad": "II. PATATES (40)", "yuklemeAdet": "YOK"}, {"id": "xmwuhp5", "ad": "II. PATATES (25)", "yuklemeAdet": 143}], "durum": "aktif"}, {"id": "p52612g", "tarih": "2026-07-15", "marka": "T15", "urun": "PATATES (AMASYA)", "plaka": "55 UF 222", "toplamYuklemeKg": 26120, "urunler": [{"id": "g0zfmn5", "ad": "I. PATATES (40)", "yuklemeAdet": 188}, {"id": "eata2g4", "ad": "I. PATATES (25)", "yuklemeAdet": 293}, {"id": "e51xa1h", "ad": "II. PATATES (40)", "yuklemeAdet": 288}], "durum": "aktif"}, {"id": "243y8at", "tarih": "2026-07-16", "marka": "T16", "urun": "PATATES (ÇORUM)", "plaka": "55 BJ 777", "toplamYuklemeKg": 24920, "urunler": [{"id": "s1c6w1a", "ad": "I. PATATES (40)", "yuklemeAdet": 363}, {"id": "awzugzd", "ad": "II. PATATES (40)", "yuklemeAdet": 156}, {"id": "1cv47lp", "ad": "III. PATATES (40)", "yuklemeAdet": 17}, {"id": "oc9ez24", "ad": "KUMPİR PATATES (40)", "yuklemeAdet": 40}], "durum": "aktif"}, {"id": "6huxk3t", "tarih": "2026-07-17", "marka": "T17", "urun": "PATATES (ÇORUM)", "plaka": "55 AN 555", "toplamYuklemeKg": 26980, "urunler": [{"id": "ynvoqhc", "ad": "I. PATATES (40)", "yuklemeAdet": 330}, {"id": "ighu36u", "ad": "II. PATATES (40)", "yuklemeAdet": 183}, {"id": "k9vx4xe", "ad": "III. PATATES (40)", "yuklemeAdet": 86}, {"id": "h9jjhi9", "ad": "KUMPİR PATATES (40)", "yuklemeAdet": 36}], "durum": "aktif"}, {"id": "jh80f4c", "tarih": "2026-07-20", "marka": "T20", "urun": "PATATES (NURDAĞI)", "plaka": "55 UF 222", "toplamYuklemeKg": 26560, "urunler": [{"id": "otto3x1", "ad": "I. PATATES (40)", "yuklemeAdet": 585}, {"id": "lkncccj", "ad": "II. PATATES (40)", "yuklemeAdet": 50}], "durum": "aktif"}, {"id": "wql1rp5", "tarih": "2026-07-20", "marka": "T20", "urun": "SOĞAN", "plaka": "55 AN 555", "toplamYuklemeKg": 26060, "urunler": [{"id": "64e6sf9", "ad": "SOĞAN", "yuklemeAdet": 507}, {"id": "mtqhgrz", "ad": "II. SOĞAN", "yuklemeAdet": 168}, {"id": "71xzcsd", "ad": "TAKOZ SOĞAN", "yuklemeAdet": 100}], "durum": "aktif"}, {"id": "gzz5h90", "tarih": "2026-07-22", "marka": "T22", "urun": "PATATES (AMASYA)", "plaka": "55 BJ 777", "toplamYuklemeKg": 27470, "urunler": [{"id": "thvmusm", "ad": "I. PATATES (40)", "yuklemeAdet": 330}, {"id": "jj3x442", "ad": "I. PATATES (25)", "yuklemeAdet": 400}, {"id": "tu2aene", "ad": "II. PATATES (40)", "yuklemeAdet": 100}], "durum": "aktif"}, {"id": "xaqpwdl", "tarih": "2026-07-23", "marka": "T23", "urun": "PATATES ", "plaka": "55 BJ 777", "toplamYuklemeKg": 26440, "urunler": [{"id": "ggrr2ln", "ad": "I. PATATES (40)", "yuklemeAdet": "YOK"}, {"id": "sply1tc", "ad": "I. PATATES (25)", "yuklemeAdet": "YOK"}, {"id": "idwke4g", "ad": "II. PATATES (40)", "yuklemeAdet": "YOK"}, {"id": "4r4zxgh", "ad": "II. PATATES (25)", "yuklemeAdet": "YOK"}], "durum": "aktif"}, {"id": "oir1ldc", "tarih": "2026-07-23", "marka": "T23", "urun": "SOĞAN", "plaka": "55 AN 555", "toplamYuklemeKg": 26400, "urunler": [{"id": "b9qeoj2", "ad": "SOĞAN", "yuklemeAdet": 401}, {"id": "kvwqesb", "ad": "II. SOĞAN", "yuklemeAdet": 163}, {"id": "dj9fscz", "ad": "TAKOZ SOĞAN", "yuklemeAdet": 210}], "durum": "aktif"}, {"id": "jk8s8ge", "tarih": "2026-07-24", "marka": "T24", "urun": "PATATES", "plaka": "55 BJ 777", "toplamYuklemeKg": 26900, "urunler": [{"id": "5my30mf", "ad": "I. PATATES (40)", "yuklemeAdet": 112}, {"id": "i8evi1c", "ad": "I. PATATES (25)", "yuklemeAdet": 302}, {"id": "5l8lv2g", "ad": "II. PATATES (40)", "yuklemeAdet": 136}, {"id": "rrjoqek", "ad": "II. PATATES (25)", "yuklemeAdet": 110}, {"id": "zj47025", "ad": "III. PATATES (40)", "yuklemeAdet": 58}], "durum": "aktif"}, {"id": "vz8s534", "tarih": "2026-07-24", "marka": "T24", "urun": "SOĞAN (AMASYA)", "plaka": "55 AN 555", "toplamYuklemeKg": 25870, "urunler": [{"id": "uqy1ba4", "ad": "SOĞAN", "yuklemeAdet": 351}, {"id": "ghnoouo", "ad": "II. SOĞAN", "yuklemeAdet": 201}, {"id": "bsxsir4", "ad": "TAKOZ SOĞAN", "yuklemeAdet": 252}], "durum": "aktif"}, {"id": "o40s81o", "tarih": "2026-07-25", "marka": "T25", "urun": "SOĞAN (YOZGAT-AYDINCIK)", "plaka": "55 BJ 777", "toplamYuklemeKg": 27040, "urunler": [{"id": "ak3wwxf", "ad": "SOĞAN", "yuklemeAdet": 350}, {"id": "5f9ln21", "ad": "II. SOĞAN", "yuklemeAdet": 150}, {"id": "ntr5fun", "ad": "TAKOZ SOĞAN", "yuklemeAdet": 300}], "durum": "aktif"}, {"id": "915ph4k", "tarih": "2026-07-25", "marka": "T27", "urun": "PATATES (NURDAĞI)", "plaka": "55 UF 222", "toplamYuklemeKg": 27100, "urunler": [{"id": "q29255i", "ad": "I. PATATES (40)", "yuklemeAdet": 494}, {"id": "ik2qimn", "ad": "II. PATATES (40)", "yuklemeAdet": 126}, {"id": "abd32vj", "ad": "III. PATATES (40)", "yuklemeAdet": 20}], "durum": "aktif"}, {"id": "vgqmlcm", "tarih": "2026-07-29", "marka": "T29", "urun": "PATATES (KONYA)", "plaka": "55 BJ 777", "toplamYuklemeKg": 26680, "urunler": [{"id": "lwma3c1", "ad": "I. PATATES (40)", "yuklemeAdet": "YOK"}, {"id": "37ptve3", "ad": "II. PATATES (40)", "yuklemeAdet": 247}, {"id": "o41vze3", "ad": "III. PATATES (40)", "yuklemeAdet": 52}], "durum": "aktif"}, {"id": "496k3hi", "tarih": "2026-07-30", "marka": "T30", "urun": "PATATES (AFYON)", "plaka": "55 UF 222", "toplamYuklemeKg": 26860, "urunler": [{"id": "1zi3r9g", "ad": "PATATES (40)", "yuklemeAdet": 340}, {"id": "utebz2l", "ad": "II. PATATES (40)", "yuklemeAdet": 260}, {"id": "risj016", "ad": "KUMPİR PATATES", "yuklemeAdet": 25}], "durum": "aktif"}, {"id": "o526c3q", "tarih": "2026-07-30", "marka": "T30", "urun": "SOĞAN (AYDINCIK)", "plaka": "55 AN 555", "toplamYuklemeKg": 26240, "urunler": [{"id": "8paph9z", "ad": "SOĞAN", "yuklemeAdet": 432}, {"id": "m914b45", "ad": "II. SOĞAN", "yuklemeAdet": 150}, {"id": "kjgmu3k", "ad": "TAKOZ SOĞAN", "yuklemeAdet": 200}], "durum": "aktif"}, {"id": "pgcnb1m", "tarih": "2026-07-31", "marka": "T31", "urun": "PATATES (NİĞDE)", "plaka": "17 AAP 161", "toplamYuklemeKg": 26320, "urunler": [{"id": "9x3nip0", "ad": "I. PATATES (40)", "yuklemeAdet": 467}, {"id": "fu2mdb5", "ad": "I. PATATES (25)", "yuklemeAdet": 195}, {"id": "odfitbd", "ad": "II. PATATES (40)", "yuklemeAdet": 140}, {"id": "fdw74kq", "ad": "KUMPİR PATATES (40)", "yuklemeAdet": 17}], "durum": "aktif"}, {"id": "b0h2j53", "tarih": "2026-07-31", "marka": "T31", "urun": "SOĞAN", "plaka": "55 UD 222", "toplamYuklemeKg": 9210, "urunler": [{"id": "5tuotif", "ad": "SOĞAN", "yuklemeAdet": 60}, {"id": "747lawz", "ad": "II. SOĞAN", "yuklemeAdet": 220}], "durum": "aktif"}, {"id": "t53lcbz", "tarih": "2026-07-30", "marka": "TA30", "urun": "SOĞAN (AMASYA)", "plaka": "55 UD 222", "toplamYuklemeKg": 9840, "urunler": [{"id": "ufuq5ep", "ad": "SOĞAN", "yuklemeAdet": 65}, {"id": "zgle03i", "ad": "II. SOĞAN", "yuklemeAdet": 230}], "durum": "aktif"}, {"id": "paqsd1d", "tarih": "2026-07-16", "marka": "TN16", "urun": "PATATES (NİKSAR)", "plaka": "55 UD 222", "toplamYuklemeKg": 9560, "urunler": [{"id": "4vk0kl0", "ad": "I. PATATES (40)", "yuklemeAdet": 0}, {"id": "5kof3wl", "ad": "II. PATATES (40)", "yuklemeAdet": 0}], "durum": "aktif"}], "sayimlar": [{"id": "y0hbzgt", "markaId": "5g3kuvr", "sayimNo": 1, "tarih": "2026-08-10", "kilitli": true, "kilitliMiydi": true, "degisiklikGecmisi": [], "satirlar": [{"urunId": "gua8vpp", "sayimAdet": 249, "sayimKg": 10359, "satisAdet": 44, "satisKg": 1822, "kalanAdet": 205, "ortKgManuel": 41.71}, {"urunId": "68wg8fs", "sayimAdet": 305, "sayimKg": 7688, "satisAdet": 43, "satisKg": 1078, "kalanAdet": 262, "ortKgManuel": 25.23}, {"urunId": "rd2mo1e", "sayimAdet": 186, "sayimKg": 7628, "satisAdet": 30, "satisKg": 1217, "kalanAdet": 156, "ortKgManuel": 41.09}, {"urunId": "dz47mhi", "sayimAdet": 33, "sayimKg": 1322, "satisAdet": 13, "satisKg": 521, "kalanAdet": 20, "ortKgManuel": ""}]}, {"id": "qrmv703", "markaId": "5g3kuvr", "sayimNo": 2, "tarih": "2026-08-10", "kilitli": true, "kilitliMiydi": true, "degisiklikGecmisi": [], "satirlar": [{"urunId": "gua8vpp", "sayimAdet": 249, "sayimKg": 10359, "satisAdet": 74, "satisKg": 3076, "kalanAdet": 175, "ortKgManuel": ""}, {"urunId": "68wg8fs", "sayimAdet": 305, "sayimKg": 7688, "satisAdet": 212, "satisKg": 5330, "kalanAdet": 93, "ortKgManuel": ""}, {"urunId": "rd2mo1e", "sayimAdet": 186, "sayimKg": 7628, "satisAdet": 89, "satisKg": 3584, "kalanAdet": 97, "ortKgManuel": ""}, {"urunId": "dz47mhi", "sayimAdet": 33, "sayimKg": 1322, "satisAdet": 33, "satisKg": 1326, "kalanAdet": 0, "ortKgManuel": ""}]}, {"id": "4iktxq8", "markaId": "5g3kuvr", "sayimNo": 3, "tarih": "2026-08-10", "kilitli": true, "kilitliMiydi": true, "degisiklikGecmisi": [], "satirlar": [{"urunId": "gua8vpp", "sayimAdet": 249, "sayimKg": 10359, "satisAdet": 158, "satisKg": 6565, "kalanAdet": 91, "ortKgManuel": ""}, {"urunId": "68wg8fs", "sayimAdet": 305, "sayimKg": 7688, "satisAdet": 294, "satisKg": 7378, "kalanAdet": 11, "ortKgManuel": ""}, {"urunId": "rd2mo1e", "sayimAdet": 186, "sayimKg": 7628, "satisAdet": 144, "satisKg": 5832, "kalanAdet": 41, "ortKgManuel": ""}, {"urunId": "dz47mhi", "sayimAdet": 33, "sayimKg": 1322, "satisAdet": 33, "satisKg": 1326, "kalanAdet": 0, "ortKgManuel": ""}]}, {"id": "9ddrfv5", "markaId": "5g3kuvr", "sayimNo": 4, "tarih": "2026-08-10", "kilitli": true, "kilitliMiydi": true, "degisiklikGecmisi": [], "satirlar": [{"urunId": "gua8vpp", "sayimAdet": 249, "sayimKg": 10359, "satisAdet": 206, "satisKg": 8560, "kalanAdet": 41, "ortKgManuel": ""}, {"urunId": "68wg8fs", "sayimAdet": 305, "sayimKg": 7688, "satisAdet": 295, "satisKg": 7403, "kalanAdet": 10, "ortKgManuel": ""}, {"urunId": "rd2mo1e", "sayimAdet": 186, "sayimKg": 7628, "satisAdet": 151, "satisKg": 6121, "kalanAdet": 34, "ortKgManuel": ""}, {"urunId": "dz47mhi", "sayimAdet": 33, "sayimKg": 1322, "satisAdet": 33, "satisKg": 1326, "kalanAdet": 0, "ortKgManuel": ""}]}, {"id": "om8yheg", "markaId": "vuxks97", "sayimNo": 1, "tarih": "2026-08-10", "kilitli": true, "kilitliMiydi": true, "degisiklikGecmisi": [], "satirlar": [{"urunId": "h8aqw73", "sayimAdet": 416, "sayimKg": 13927, "satisAdet": 189, "satisKg": 6323, "kalanAdet": 227, "ortKgManuel": ""}, {"urunId": "tnb8qtk", "sayimAdet": 187, "sayimKg": 6169, "satisAdet": 53, "satisKg": 1747, "kalanAdet": 134, "ortKgManuel": ""}, {"urunId": "buzl375", "sayimAdet": 212, "sayimKg": 7066, "satisAdet": 145, "satisKg": 4835, "kalanAdet": 67, "ortKgManuel": ""}]}, {"id": "rvhy176", "markaId": "vuxks97", "sayimNo": 2, "tarih": "2026-08-10", "kilitli": true, "kilitliMiydi": true, "degisiklikGecmisi": [], "satirlar": [{"urunId": "h8aqw73", "sayimAdet": 416, "sayimKg": 13927, "satisAdet": 319, "satisKg": 10745, "kalanAdet": 91, "ortKgManuel": ""}, {"urunId": "tnb8qtk", "sayimAdet": 187, "sayimKg": 6169, "satisAdet": 93, "satisKg": 3092, "kalanAdet": 94, "ortKgManuel": ""}, {"urunId": "buzl375", "sayimAdet": 212, "sayimKg": 7066, "satisAdet": 195, "satisKg": 6536, "kalanAdet": 17, "ortKgManuel": ""}]}, {"id": "zwrgm6e", "markaId": "vuxks97", "sayimNo": 3, "tarih": "2026-08-10", "kilitli": true, "kilitliMiydi": true, "degisiklikGecmisi": [], "satirlar": [{"urunId": "h8aqw73", "sayimAdet": 416, "sayimKg": 13927, "satisAdet": 410, "satisKg": 13817, "kalanAdet": 0, "ortKgManuel": ""}, {"urunId": "tnb8qtk", "sayimAdet": 187, "sayimKg": 6169, "satisAdet": 184, "satisKg": 6078, "kalanAdet": 3, "ortKgManuel": ""}, {"urunId": "buzl375", "sayimAdet": 212, "sayimKg": 7066, "satisAdet": 212, "satisKg": 7034, "kalanAdet": 0, "ortKgManuel": ""}]}, {"id": "2ue09m2", "markaId": "vuxks97", "sayimNo": 4, "tarih": "2026-08-10", "kilitli": true, "kilitliMiydi": true, "degisiklikGecmisi": [], "satirlar": [{"urunId": "h8aqw73", "sayimAdet": 416, "sayimKg": 13927, "satisAdet": 410, "satisKg": 13795, "kalanAdet": 0, "ortKgManuel": ""}, {"urunId": "tnb8qtk", "sayimAdet": 187, "sayimKg": 6169, "satisAdet": 187, "satisKg": 6175, "kalanAdet": 0, "ortKgManuel": ""}, {"urunId": "buzl375", "sayimAdet": 212, "sayimKg": 7066, "satisAdet": 212, "satisKg": 7034, "kalanAdet": 0, "ortKgManuel": ""}]}, {"id": "d2r05n6", "markaId": "03yb35m", "sayimNo": 1, "tarih": "2026-08-12", "kilitli": true, "kilitliMiydi": true, "degisiklikGecmisi": [], "satirlar": [{"urunId": "ykg4l9m", "sayimAdet": 323, "sayimKg": 13611, "satisAdet": 7, "satisKg": 294, "kalanAdet": 318, "ortKgManuel": ""}, {"urunId": "ybotasl", "sayimAdet": 251, "sayimKg": 6210, "satisAdet": 251, "satisKg": 6210, "kalanAdet": 0, "ortKgManuel": ""}, {"urunId": "7jncafi", "sayimAdet": 90, "sayimKg": 3616, "satisAdet": 39, "satisKg": 1567, "kalanAdet": 51, "ortKgManuel": ""}, {"urunId": "zvfg4fc", "sayimAdet": 154, "sayimKg": 3685, "satisAdet": 154, "satisKg": 3685, "kalanAdet": 0, "ortKgManuel": ""}, {"urunId": "rslc4m5", "sayimAdet": 1, "sayimKg": 43, "satisAdet": 1, "satisKg": 43, "kalanAdet": 0, "ortKgManuel": ""}]}, {"id": "b9349k5", "markaId": "03yb35m", "sayimNo": 2, "tarih": "2026-08-12", "kilitli": true, "kilitliMiydi": true, "degisiklikGecmisi": [], "satirlar": [{"urunId": "ykg4l9m", "sayimAdet": 323, "sayimKg": 13611, "satisAdet": 135, "satisKg": 5605, "kalanAdet": 190, "ortKgManuel": ""}, {"urunId": "ybotasl", "sayimAdet": 251, "sayimKg": 6210, "satisAdet": 251, "satisKg": 6210, "kalanAdet": 0, "ortKgManuel": ""}, {"urunId": "7jncafi", "sayimAdet": 90, "sayimKg": 3616, "satisAdet": 90, "satisKg": 3637, "kalanAdet": 0, "ortKgManuel": ""}, {"urunId": "zvfg4fc", "sayimAdet": 154, "sayimKg": 3685, "satisAdet": 154, "satisKg": 3685, "kalanAdet": 0, "ortKgManuel": ""}, {"urunId": "rslc4m5", "sayimAdet": 1, "sayimKg": 43, "satisAdet": 1, "satisKg": 43, "kalanAdet": 0, "ortKgManuel": ""}]}, {"id": "e9bon7y", "markaId": "lced7py", "sayimNo": 1, "tarih": "2026-08-12", "kilitli": true, "kilitliMiydi": true, "degisiklikGecmisi": [], "satirlar": [{"urunId": "rwmgz0x", "sayimAdet": 507, "sayimKg": 16800, "satisAdet": 357, "satisKg": 11816, "kalanAdet": 150, "ortKgManuel": ""}, {"urunId": "hl3i8xc", "sayimAdet": 183, "sayimKg": 5981, "satisAdet": 51, "satisKg": 1667, "kalanAdet": 132, "ortKgManuel": ""}, {"urunId": "opr7a12", "sayimAdet": 85, "sayimKg": 2821, "satisAdet": 75, "satisKg": 2489, "kalanAdet": 10, "ortKgManuel": ""}]}, {"id": "ex8c2nh", "markaId": "lced7py", "sayimNo": 2, "tarih": "2026-08-12", "kilitli": true, "kilitliMiydi": true, "degisiklikGecmisi": [], "satirlar": [{"urunId": "rwmgz0x", "sayimAdet": 507, "sayimKg": 16800, "satisAdet": 387, "satisKg": 12804, "kalanAdet": 120, "ortKgManuel": ""}, {"urunId": "hl3i8xc", "sayimAdet": 183, "sayimKg": 5981, "satisAdet": 76, "satisKg": 2488, "kalanAdet": 107, "ortKgManuel": ""}, {"urunId": "opr7a12", "sayimAdet": 85, "sayimKg": 2821, "satisAdet": 85, "satisKg": 2818, "kalanAdet": 0, "ortKgManuel": ""}]}, {"id": "agkbci3", "markaId": "ev3e29r", "sayimNo": 1, "tarih": "2026-08-13", "kilitli": true, "kilitliMiydi": true, "degisiklikGecmisi": [], "satirlar": [{"urunId": "55eadmz", "sayimAdet": 318, "sayimKg": 10850, "satisAdet": 126, "satisKg": 4321, "kalanAdet": 202, "ortKgManuel": ""}, {"urunId": "wz6cvsf", "sayimAdet": 214, "sayimKg": 7152, "satisAdet": 38, "satisKg": 1275, "kalanAdet": 176, "ortKgManuel": ""}, {"urunId": "0gyxwpe", "sayimAdet": 215, "sayimKg": 7182, "satisAdet": 90, "satisKg": 3005, "kalanAdet": 125, "ortKgManuel": ""}]}, {"id": "ihbxph2", "markaId": "ed84jhj", "sayimNo": 1, "tarih": "2026-08-13", "kilitli": true, "kilitliMiydi": true, "degisiklikGecmisi": [], "satirlar": [{"urunId": "zjb0z8l", "sayimAdet": 361, "sayimKg": 15545, "satisAdet": 12, "satisKg": 537, "kalanAdet": 349, "ortKgManuel": 43.06}, {"urunId": "xmvkdxw", "sayimAdet": 203, "sayimKg": 5488, "satisAdet": 35, "satisKg": 935, "kalanAdet": 168, "ortKgManuel": 27.03}, {"urunId": "lo0b8jc", "sayimAdet": 173, "sayimKg": 7132, "satisAdet": 0, "satisKg": 0, "kalanAdet": 173, "ortKgManuel": 41.23}]}, {"id": "mfo5ls5", "markaId": "c2isnuh", "sayimNo": 1, "tarih": "2026-08-03", "kilitli": true, "kilitliMiydi": true, "degisiklikGecmisi": [], "satirlar": [{"urunId": "p15mbdr", "sayimAdet": 241, "sayimKg": 10047, "satisAdet": 240, "satisKg": 9991, "kalanAdet": 0, "ortKgManuel": ""}, {"urunId": "1fszfpj", "sayimAdet": 302, "sayimKg": 12427, "satisAdet": 92, "satisKg": 3789, "kalanAdet": 210, "ortKgManuel": ""}, {"urunId": "ektxdq4", "sayimAdet": 108, "sayimKg": 4346, "satisAdet": 39, "satisKg": 1564, "kalanAdet": 69, "ortKgManuel": ""}]}, {"id": "a40cr6i", "markaId": "c2isnuh", "sayimNo": 2, "tarih": "2026-08-04", "kilitli": true, "kilitliMiydi": true, "degisiklikGecmisi": [], "satirlar": [{"urunId": "p15mbdr", "sayimAdet": 241, "sayimKg": 10047, "satisAdet": 240, "satisKg": 9991, "kalanAdet": 0, "ortKgManuel": ""}, {"urunId": "1fszfpj", "sayimAdet": 302, "sayimKg": 12427, "satisAdet": 121, "satisKg": 4992, "kalanAdet": 161, "ortKgManuel": ""}, {"urunId": "ektxdq4", "sayimAdet": 108, "sayimKg": 4346, "satisAdet": 41, "satisKg": 1645, "kalanAdet": 67, "ortKgManuel": ""}]}, {"id": "o25zudz", "markaId": "c2isnuh", "sayimNo": 3, "tarih": "2026-08-10", "kilitli": true, "kilitliMiydi": true, "degisiklikGecmisi": [], "satirlar": [{"urunId": "p15mbdr", "sayimAdet": 241, "sayimKg": 10047, "satisAdet": 242, "satisKg": 10074, "kalanAdet": 0, "ortKgManuel": ""}, {"urunId": "1fszfpj", "sayimAdet": 302, "sayimKg": 12427, "satisAdet": 300, "satisKg": 12279, "kalanAdet": 0, "ortKgManuel": ""}, {"urunId": "ektxdq4", "sayimAdet": 108, "sayimKg": 4346, "satisAdet": 108, "satisKg": 4328, "kalanAdet": 0, "ortKgManuel": ""}]}, {"id": "ww8zinj", "markaId": "nmx7ju2", "sayimNo": 1, "tarih": "2026-08-03", "kilitli": true, "kilitliMiydi": true, "degisiklikGecmisi": [], "satirlar": [{"urunId": "r7aaake", "sayimAdet": 450, "sayimKg": 14766, "satisAdet": 429, "satisKg": 14051, "kalanAdet": 20, "ortKgManuel": ""}, {"urunId": "09z3hkj", "sayimAdet": 299, "sayimKg": 9760, "satisAdet": 147, "satisKg": 4768, "kalanAdet": 152, "ortKgManuel": ""}]}, {"id": "8ajfmxi", "markaId": "nmx7ju2", "sayimNo": 2, "tarih": "2026-08-04", "kilitli": true, "kilitliMiydi": true, "degisiklikGecmisi": [], "satirlar": [{"urunId": "r7aaake", "sayimAdet": 450, "sayimKg": 14766, "satisAdet": 448, "satisKg": 14663, "kalanAdet": 0, "ortKgManuel": ""}, {"urunId": "09z3hkj", "sayimAdet": 299, "sayimKg": 9760, "satisAdet": 154, "satisKg": 4994, "kalanAdet": 145, "ortKgManuel": ""}]}, {"id": "hxqjfez", "markaId": "nmx7ju2", "sayimNo": 3, "tarih": "2026-08-10", "kilitli": true, "kilitliMiydi": true, "degisiklikGecmisi": [], "satirlar": [{"urunId": "r7aaake", "sayimAdet": 450, "sayimKg": 14766, "satisAdet": 448, "satisKg": 14663, "kalanAdet": 0, "ortKgManuel": ""}, {"urunId": "09z3hkj", "sayimAdet": 299, "sayimKg": 9760, "satisAdet": 302, "satisKg": 9750, "kalanAdet": 0, "ortKgManuel": ""}]}, {"id": "uhvfqs9", "markaId": "lqadxda", "sayimNo": 1, "tarih": "2026-08-03", "kilitli": true, "kilitliMiydi": true, "degisiklikGecmisi": [], "satirlar": [{"urunId": "np8jg1h", "sayimAdet": 229, "sayimKg": 9116, "satisAdet": 226, "satisKg": 9016, "kalanAdet": 2, "ortKgManuel": ""}, {"urunId": "i8w2sw6", "sayimAdet": 294, "sayimKg": 8188, "satisAdet": 43, "satisKg": 1197, "kalanAdet": 251, "ortKgManuel": ""}, {"urunId": "7rt7wdi", "sayimAdet": 161, "sayimKg": 6311, "satisAdet": 96, "satisKg": 3763, "kalanAdet": 66, "ortKgManuel": ""}, {"urunId": "fw6sgug", "sayimAdet": 103, "sayimKg": 2701, "satisAdet": 22, "satisKg": 577, "kalanAdet": 81, "ortKgManuel": ""}, {"urunId": "xrlo7ec", "sayimAdet": 18, "sayimKg": 704, "satisAdet": 18, "satisKg": 704, "kalanAdet": 0, "ortKgManuel": ""}]}, {"id": "2q653t4", "markaId": "lqadxda", "sayimNo": 2, "tarih": "2026-08-04", "kilitli": true, "kilitliMiydi": true, "degisiklikGecmisi": [], "satirlar": [{"urunId": "np8jg1h", "sayimAdet": 229, "sayimKg": 9116, "satisAdet": 228, "satisKg": 9096, "kalanAdet": 0, "ortKgManuel": ""}, {"urunId": "i8w2sw6", "sayimAdet": 294, "sayimKg": 8188, "satisAdet": 279, "satisKg": 7536, "kalanAdet": 15, "ortKgManuel": ""}, {"urunId": "7rt7wdi", "sayimAdet": 161, "sayimKg": 6311, "satisAdet": 147, "satisKg": 5748, "kalanAdet": 15, "ortKgManuel": ""}, {"urunId": "fw6sgug", "sayimAdet": 103, "sayimKg": 2701, "satisAdet": 22, "satisKg": 577, "kalanAdet": 81, "ortKgManuel": ""}, {"urunId": "xrlo7ec", "sayimAdet": 18, "sayimKg": 704, "satisAdet": 18, "satisKg": 704, "kalanAdet": 0, "ortKgManuel": ""}]}, {"id": "yz0u2f9", "markaId": "lqadxda", "sayimNo": 3, "tarih": "2026-08-10", "kilitli": true, "kilitliMiydi": true, "degisiklikGecmisi": [], "satirlar": [{"urunId": "np8jg1h", "sayimAdet": 229, "sayimKg": 9116, "satisAdet": 228, "satisKg": 9095, "kalanAdet": 0, "ortKgManuel": ""}, {"urunId": "i8w2sw6", "sayimAdet": 294, "sayimKg": 8188, "satisAdet": 294, "satisKg": 7943, "kalanAdet": 0, "ortKgManuel": ""}, {"urunId": "7rt7wdi", "sayimAdet": 161, "sayimKg": 6311, "satisAdet": 162, "satisKg": 6344, "kalanAdet": 0, "ortKgManuel": ""}, {"urunId": "fw6sgug", "sayimAdet": 103, "sayimKg": 2701, "satisAdet": 102, "satisKg": 2690, "kalanAdet": 0, "ortKgManuel": ""}, {"urunId": "xrlo7ec", "sayimAdet": 18, "sayimKg": 704, "satisAdet": 18, "satisKg": 704, "kalanAdet": 0, "ortKgManuel": ""}]}, {"id": "x3zz782", "markaId": "ajlmorz", "sayimNo": 1, "tarih": "2026-08-03", "kilitli": true, "kilitliMiydi": true, "degisiklikGecmisi": [], "satirlar": [{"urunId": "8xuiqci", "sayimAdet": 559, "sayimKg": 18273, "satisAdet": 86, "satisKg": 2809, "kalanAdet": 473, "ortKgManuel": ""}, {"urunId": "we3sql3", "sayimAdet": 188, "sayimKg": 6448, "satisAdet": 3, "satisKg": 104, "kalanAdet": 185, "ortKgManuel": 33.49}, {"urunId": "q8o0ckl", "sayimAdet": 63, "sayimKg": 2041, "satisAdet": 64, "satisKg": 2073, "kalanAdet": 0, "ortKgManuel": ""}]}, {"id": "dlstxhv", "markaId": "ajlmorz", "sayimNo": 2, "tarih": "2026-08-04", "kilitli": true, "kilitliMiydi": true, "degisiklikGecmisi": [], "satirlar": [{"urunId": "8xuiqci", "sayimAdet": 559, "sayimKg": 18273, "satisAdet": 220, "satisKg": 7152, "kalanAdet": 339, "ortKgManuel": ""}, {"urunId": "we3sql3", "sayimAdet": 188, "sayimKg": 6448, "satisAdet": 29, "satisKg": 936, "kalanAdet": 159, "ortKgManuel": ""}, {"urunId": "q8o0ckl", "sayimAdet": 63, "sayimKg": 2041, "satisAdet": 65, "satisKg": 2107, "kalanAdet": 0, "ortKgManuel": ""}]}, {"id": "11jyb9d", "markaId": "ajlmorz", "sayimNo": 3, "tarih": "2026-08-10", "kilitli": true, "kilitliMiydi": true, "degisiklikGecmisi": [], "satirlar": [{"urunId": "8xuiqci", "sayimAdet": 559, "sayimKg": 18273, "satisAdet": 560, "satisKg": 18211, "kalanAdet": 0, "ortKgManuel": ""}, {"urunId": "we3sql3", "sayimAdet": 188, "sayimKg": 6448, "satisAdet": 175, "satisKg": 5668, "kalanAdet": 10, "ortKgManuel": ""}, {"urunId": "q8o0ckl", "sayimAdet": 63, "sayimKg": 2041, "satisAdet": 65, "satisKg": 2107, "kalanAdet": 0, "ortKgManuel": ""}]}, {"id": "vld8ep8", "markaId": "ajlmorz", "sayimNo": 4, "tarih": "2026-08-13", "kilitli": true, "kilitliMiydi": true, "degisiklikGecmisi": [], "satirlar": [{"urunId": "8xuiqci", "sayimAdet": 559, "sayimKg": 18273, "satisAdet": 560, "satisKg": 18211, "kalanAdet": 0, "ortKgManuel": ""}, {"urunId": "we3sql3", "sayimAdet": 188, "sayimKg": 6448, "satisAdet": 185, "satisKg": 5984, "kalanAdet": 0, "ortKgManuel": ""}, {"urunId": "q8o0ckl", "sayimAdet": 63, "sayimKg": 2041, "satisAdet": 65, "satisKg": 2107, "kalanAdet": 0, "ortKgManuel": ""}]}, {"id": "ev63yy3", "markaId": "mas9wkz", "sayimNo": 1, "tarih": "2026-08-04", "kilitli": true, "kilitliMiydi": true, "degisiklikGecmisi": [], "satirlar": [{"urunId": "ht4rqmt", "sayimAdet": 258, "sayimKg": 10125, "satisAdet": 57, "satisKg": 2237, "kalanAdet": 201, "ortKgManuel": ""}, {"urunId": "vday7zo", "sayimAdet": 205, "sayimKg": 5617, "satisAdet": 10, "satisKg": 274, "kalanAdet": 195, "ortKgManuel": 27.64}, {"urunId": "g4p9ss4", "sayimAdet": 222, "sayimKg": 8541, "satisAdet": 0, "satisKg": 0, "kalanAdet": 222, "ortKgManuel": 38.37}, {"urunId": "j09zo0i", "sayimAdet": 50, "sayimKg": 1917, "satisAdet": 4, "satisKg": 153, "kalanAdet": 46, "ortKgManuel": ""}]}, {"id": "yucb5p2", "markaId": "mas9wkz", "sayimNo": 2, "tarih": "2026-08-10", "kilitli": true, "kilitliMiydi": true, "degisiklikGecmisi": [], "satirlar": [{"urunId": "ht4rqmt", "sayimAdet": 258, "sayimKg": 10125, "satisAdet": 258, "satisKg": 10124, "kalanAdet": 0, "ortKgManuel": ""}, {"urunId": "vday7zo", "sayimAdet": 205, "sayimKg": 5617, "satisAdet": 205, "satisKg": 5661, "kalanAdet": 0, "ortKgManuel": ""}, {"urunId": "g4p9ss4", "sayimAdet": 222, "sayimKg": 8541, "satisAdet": 222, "satisKg": 8489, "kalanAdet": 0, "ortKgManuel": ""}, {"urunId": "j09zo0i", "sayimAdet": 50, "sayimKg": 1917, "satisAdet": 37, "satisKg": 1412, "kalanAdet": 13, "ortKgManuel": ""}]}, {"id": "uog5wr9", "markaId": "mas9wkz", "sayimNo": 3, "tarih": "2026-08-13", "kilitli": true, "kilitliMiydi": true, "degisiklikGecmisi": [], "satirlar": [{"urunId": "ht4rqmt", "sayimAdet": 258, "sayimKg": 10125, "satisAdet": 258, "satisKg": 10124, "kalanAdet": 0, "ortKgManuel": ""}, {"urunId": "vday7zo", "sayimAdet": 205, "sayimKg": 5617, "satisAdet": 205, "satisKg": 5661, "kalanAdet": 0, "ortKgManuel": ""}, {"urunId": "g4p9ss4", "sayimAdet": 222, "sayimKg": 8541, "satisAdet": 222, "satisKg": 8489, "kalanAdet": 0, "ortKgManuel": ""}, {"urunId": "j09zo0i", "sayimAdet": 50, "sayimKg": 1917, "satisAdet": 50, "satisKg": 1895, "kalanAdet": 0, "ortKgManuel": ""}]}, {"id": "jd8bnm0", "markaId": "a77n8fz", "sayimNo": 1, "tarih": "2026-08-06", "kilitli": true, "kilitliMiydi": true, "degisiklikGecmisi": [], "satirlar": [{"urunId": "ktbb18c", "sayimAdet": 473, "sayimKg": 19848, "satisAdet": 480, "satisKg": 20033, "kalanAdet": 0, "ortKgManuel": ""}, {"urunId": "0rjehjn", "sayimAdet": 160, "sayimKg": 6480, "satisAdet": 160, "satisKg": 6524, "kalanAdet": 0, "ortKgManuel": ""}]}, {"id": "fhkyyd2", "markaId": "v0xgd6b", "sayimNo": 1, "tarih": "2026-08-06", "kilitli": true, "kilitliMiydi": true, "degisiklikGecmisi": [], "satirlar": [{"urunId": "trhohdu", "sayimAdet": 534, "sayimKg": 17318, "satisAdet": 532, "satisKg": 17201, "kalanAdet": 0, "ortKgManuel": ""}, {"urunId": "q2s4vei", "sayimAdet": 183, "sayimKg": 5886, "satisAdet": 127, "satisKg": 4097, "kalanAdet": 56, "ortKgManuel": ""}, {"urunId": "yacehxl", "sayimAdet": 88, "sayimKg": 2794, "satisAdet": 88, "satisKg": 2838, "kalanAdet": 0, "ortKgManuel": ""}]}, {"id": "zymjdyy", "markaId": "v0xgd6b", "sayimNo": 2, "tarih": "2026-08-06", "kilitli": true, "kilitliMiydi": true, "degisiklikGecmisi": [], "satirlar": [{"urunId": "trhohdu", "sayimAdet": 534, "sayimKg": 17318, "satisAdet": 538, "satisKg": 17400, "kalanAdet": 0, "ortKgManuel": ""}, {"urunId": "q2s4vei", "sayimAdet": 183, "sayimKg": 5886, "satisAdet": 138, "satisKg": 4445, "kalanAdet": 45, "ortKgManuel": ""}, {"urunId": "yacehxl", "sayimAdet": 88, "sayimKg": 2794, "satisAdet": 88, "satisKg": 2838, "kalanAdet": 0, "ortKgManuel": ""}]}, {"id": "k0cik5k", "markaId": "v0xgd6b", "sayimNo": 3, "tarih": "2026-08-06", "kilitli": true, "kilitliMiydi": true, "degisiklikGecmisi": [], "satirlar": [{"urunId": "trhohdu", "sayimAdet": 534, "sayimKg": 17318, "satisAdet": 538, "satisKg": 17400, "kalanAdet": 0, "ortKgManuel": ""}, {"urunId": "q2s4vei", "sayimAdet": 183, "sayimKg": 5886, "satisAdet": 158, "satisKg": 5080, "kalanAdet": 25, "ortKgManuel": ""}, {"urunId": "yacehxl", "sayimAdet": 88, "sayimKg": 2794, "satisAdet": 88, "satisKg": 2838, "kalanAdet": 0, "ortKgManuel": ""}]}, {"id": "ohsxix6", "markaId": "v0xgd6b", "sayimNo": 4, "tarih": "2026-08-06", "kilitli": true, "kilitliMiydi": true, "degisiklikGecmisi": [], "satirlar": [{"urunId": "trhohdu", "sayimAdet": 534, "sayimKg": 17318, "satisAdet": 538, "satisKg": 17400, "kalanAdet": 0, "ortKgManuel": ""}, {"urunId": "q2s4vei", "sayimAdet": 183, "sayimKg": 5886, "satisAdet": 175, "satisKg": 5623, "kalanAdet": 8, "ortKgManuel": ""}, {"urunId": "yacehxl", "sayimAdet": 88, "sayimKg": 2794, "satisAdet": 88, "satisKg": 2838, "kalanAdet": 0, "ortKgManuel": ""}]}, {"id": "pblpw8o", "markaId": "wrr4nc4", "sayimNo": 1, "tarih": "2026-08-07", "kilitli": true, "kilitliMiydi": true, "degisiklikGecmisi": [], "satirlar": [{"urunId": "txgw4gw", "sayimAdet": 336, "sayimKg": 14040, "satisAdet": 235, "satisKg": 9729, "kalanAdet": 99, "ortKgManuel": ""}, {"urunId": "9rf117b", "sayimAdet": 200, "sayimKg": 5004, "satisAdet": 200, "satisKg": 5039, "kalanAdet": 0, "ortKgManuel": ""}, {"urunId": "8fc74ra", "sayimAdet": 172, "sayimKg": 6973, "satisAdet": 62, "satisKg": 2543, "kalanAdet": 110, "ortKgManuel": ""}, {"urunId": "30fbrb8", "sayimAdet": 21, "sayimKg": 845, "satisAdet": 21, "satisKg": 844, "kalanAdet": 0, "ortKgManuel": ""}, {"urunId": "34jaxqx", "sayimAdet": 14, "sayimKg": 565, "satisAdet": 11, "satisKg": 447, "kalanAdet": 2, "ortKgManuel": ""}]}, {"id": "zigmf7v", "markaId": "wrr4nc4", "sayimNo": 2, "tarih": "2026-08-07", "kilitli": true, "kilitliMiydi": true, "degisiklikGecmisi": [], "satirlar": [{"urunId": "txgw4gw", "sayimAdet": 336, "sayimKg": 14040, "satisAdet": 312, "satisKg": 14016, "kalanAdet": 18, "ortKgManuel": ""}, {"urunId": "9rf117b", "sayimAdet": 200, "sayimKg": 5004, "satisAdet": 200, "satisKg": 5039, "kalanAdet": 0, "ortKgManuel": ""}, {"urunId": "8fc74ra", "sayimAdet": 172, "sayimKg": 6973, "satisAdet": 115, "satisKg": 4708, "kalanAdet": 52, "ortKgManuel": ""}, {"urunId": "30fbrb8", "sayimAdet": 21, "sayimKg": 845, "satisAdet": 21, "satisKg": 844, "kalanAdet": 0, "ortKgManuel": ""}, {"urunId": "34jaxqx", "sayimAdet": 14, "sayimKg": 565, "satisAdet": 11, "satisKg": 447, "kalanAdet": 2, "ortKgManuel": ""}]}, {"id": "yzsry29", "markaId": "wrr4nc4", "sayimNo": 3, "tarih": "2026-08-07", "kilitli": true, "kilitliMiydi": true, "degisiklikGecmisi": [], "satirlar": [{"urunId": "txgw4gw", "sayimAdet": 336, "sayimKg": 14040, "satisAdet": 322, "satisKg": 14429, "kalanAdet": 8, "ortKgManuel": ""}, {"urunId": "9rf117b", "sayimAdet": 200, "sayimKg": 5004, "satisAdet": 200, "satisKg": 5039, "kalanAdet": 0, "ortKgManuel": ""}, {"urunId": "8fc74ra", "sayimAdet": 172, "sayimKg": 6973, "satisAdet": 148, "satisKg": 6066, "kalanAdet": 19, "ortKgManuel": ""}, {"urunId": "30fbrb8", "sayimAdet": 21, "sayimKg": 845, "satisAdet": 23, "satisKg": 924, "kalanAdet": 0, "ortKgManuel": ""}, {"urunId": "34jaxqx", "sayimAdet": 14, "sayimKg": 565, "satisAdet": 12, "satisKg": 488, "kalanAdet": 1, "ortKgManuel": ""}]}, {"id": "c3dt12i", "markaId": "wrr4nc4", "sayimNo": 4, "tarih": "2026-08-07", "kilitli": true, "kilitliMiydi": true, "degisiklikGecmisi": [], "satirlar": [{"urunId": "txgw4gw", "sayimAdet": 336, "sayimKg": 14040, "satisAdet": 330, "satisKg": 13663, "kalanAdet": 5, "ortKgManuel": ""}, {"urunId": "9rf117b", "sayimAdet": 200, "sayimKg": 5004, "satisAdet": 200, "satisKg": 5039, "kalanAdet": 0, "ortKgManuel": ""}, {"urunId": "8fc74ra", "sayimAdet": 172, "sayimKg": 6973, "satisAdet": 154, "satisKg": 6318, "kalanAdet": 10, "ortKgManuel": ""}, {"urunId": "30fbrb8", "sayimAdet": 21, "sayimKg": 845, "satisAdet": 23, "satisKg": 924, "kalanAdet": 0, "ortKgManuel": ""}, {"urunId": "34jaxqx", "sayimAdet": 14, "sayimKg": 565, "satisAdet": 13, "satisKg": 529, "kalanAdet": 0, "ortKgManuel": ""}]}, {"id": "v65ao4g", "markaId": "tsr1avg", "sayimNo": 1, "tarih": "2026-08-08", "kilitli": true, "kilitliMiydi": true, "degisiklikGecmisi": [], "satirlar": [{"urunId": "d4bx5xl", "sayimAdet": 396, "sayimKg": 16363, "satisAdet": 257, "satisKg": 10383, "kalanAdet": 141, "ortKgManuel": ""}, {"urunId": "a7uk16a", "sayimAdet": 248, "sayimKg": 6682, "satisAdet": 248, "satisKg": 6682, "kalanAdet": 0, "ortKgManuel": ""}, {"urunId": "chbv89b", "sayimAdet": "", "sayimKg": "", "satisAdet": "", "satisKg": "", "kalanAdet": "", "ortKgManuel": ""}, {"urunId": "xmwuhp5", "sayimAdet": 144, "sayimKg": 3880, "satisAdet": 126, "satisKg": 3365, "kalanAdet": 18, "ortKgManuel": ""}]}, {"id": "ffkty7n", "markaId": "tsr1avg", "sayimNo": 2, "tarih": "2026-08-08", "kilitli": true, "kilitliMiydi": true, "degisiklikGecmisi": [], "satirlar": [{"urunId": "d4bx5xl", "sayimAdet": 396, "sayimKg": 16363, "satisAdet": 345, "satisKg": 13950, "kalanAdet": 53, "ortKgManuel": ""}, {"urunId": "a7uk16a", "sayimAdet": 248, "sayimKg": 6682, "satisAdet": 248, "satisKg": 6682, "kalanAdet": 0, "ortKgManuel": ""}, {"urunId": "chbv89b", "sayimAdet": "", "sayimKg": "", "satisAdet": "", "satisKg": "", "kalanAdet": "", "ortKgManuel": ""}, {"urunId": "xmwuhp5", "sayimAdet": 144, "sayimKg": 3880, "satisAdet": 144, "satisKg": 3841, "kalanAdet": 0, "ortKgManuel": ""}]}, {"id": "hxtjztj", "markaId": "tsr1avg", "sayimNo": 3, "tarih": "2026-08-08", "kilitli": true, "kilitliMiydi": true, "degisiklikGecmisi": [], "satirlar": [{"urunId": "d4bx5xl", "sayimAdet": 396, "sayimKg": 16363, "satisAdet": 381, "satisKg": 15405, "kalanAdet": 16, "ortKgManuel": ""}, {"urunId": "a7uk16a", "sayimAdet": 248, "sayimKg": 6682, "satisAdet": 248, "satisKg": 6682, "kalanAdet": 0, "ortKgManuel": ""}, {"urunId": "chbv89b", "sayimAdet": "", "sayimKg": "", "satisAdet": "", "satisKg": "", "kalanAdet": "", "ortKgManuel": ""}, {"urunId": "xmwuhp5", "sayimAdet": 144, "sayimKg": 3880, "satisAdet": 144, "satisKg": 3841, "kalanAdet": 0, "ortKgManuel": ""}]}, {"id": "zk3qc1n", "markaId": "tsr1avg", "sayimNo": 4, "tarih": "2026-08-08", "kilitli": true, "kilitliMiydi": true, "degisiklikGecmisi": [], "satirlar": [{"urunId": "d4bx5xl", "sayimAdet": 396, "sayimKg": 16363, "satisAdet": 395, "satisKg": 15967, "kalanAdet": 0, "ortKgManuel": ""}, {"urunId": "a7uk16a", "sayimAdet": 248, "sayimKg": 6682, "satisAdet": 248, "satisKg": 6682, "kalanAdet": 0, "ortKgManuel": ""}, {"urunId": "chbv89b", "sayimAdet": "", "sayimKg": "", "satisAdet": "", "satisKg": "", "kalanAdet": "", "ortKgManuel": ""}, {"urunId": "xmwuhp5", "sayimAdet": 144, "sayimKg": 3880, "satisAdet": 144, "satisKg": 3841, "kalanAdet": 0, "ortKgManuel": ""}]}, {"id": "ncf6m96", "markaId": "p52612g", "sayimNo": 1, "tarih": "2026-07-15", "kilitli": true, "kilitliMiydi": true, "degisiklikGecmisi": [], "satirlar": [{"urunId": "g0zfmn5", "sayimAdet": 190, "sayimKg": 7282, "satisAdet": 86, "satisKg": 3304, "kalanAdet": 103, "ortKgManuel": ""}, {"urunId": "eata2g4", "sayimAdet": 297, "sayimKg": 8040, "satisAdet": 245, "satisKg": 6651, "kalanAdet": 52, "ortKgManuel": ""}, {"urunId": "e51xa1h", "sayimAdet": 287, "sayimKg": 10855, "satisAdet": 131, "satisKg": 4981, "kalanAdet": 156, "ortKgManuel": ""}]}, {"id": "yvrpl5s", "markaId": "p52612g", "sayimNo": 2, "tarih": "2026-07-16", "kilitli": true, "kilitliMiydi": true, "degisiklikGecmisi": [], "satirlar": [{"urunId": "g0zfmn5", "sayimAdet": 190, "sayimKg": 7282, "satisAdet": 103, "satisKg": 3946, "kalanAdet": 86, "ortKgManuel": ""}, {"urunId": "eata2g4", "sayimAdet": 297, "sayimKg": 8040, "satisAdet": 245, "satisKg": 6651, "kalanAdet": 52, "ortKgManuel": ""}, {"urunId": "e51xa1h", "sayimAdet": 287, "sayimKg": 10855, "satisAdet": 131, "satisKg": 4981, "kalanAdet": 156, "ortKgManuel": ""}]}, {"id": "pq4rqef", "markaId": "p52612g", "sayimNo": 3, "tarih": "2026-07-17", "kilitli": true, "kilitliMiydi": true, "degisiklikGecmisi": [], "satirlar": [{"urunId": "g0zfmn5", "sayimAdet": 190, "sayimKg": 7282, "satisAdet": 168, "satisKg": 6443, "kalanAdet": 20, "ortKgManuel": ""}, {"urunId": "eata2g4", "sayimAdet": 297, "sayimKg": 8040, "satisAdet": 260, "satisKg": 7048, "kalanAdet": 37, "ortKgManuel": ""}, {"urunId": "e51xa1h", "sayimAdet": 287, "sayimKg": 10855, "satisAdet": 179, "satisKg": 6780, "kalanAdet": 108, "ortKgManuel": ""}]}, {"id": "6s23g87", "markaId": "p52612g", "sayimNo": 4, "tarih": "2026-07-18", "kilitli": true, "kilitliMiydi": true, "degisiklikGecmisi": [], "satirlar": [{"urunId": "g0zfmn5", "sayimAdet": 190, "sayimKg": 7282, "satisAdet": 188, "satisKg": 7198, "kalanAdet": 0, "ortKgManuel": ""}, {"urunId": "eata2g4", "sayimAdet": 297, "sayimKg": 8040, "satisAdet": 277, "satisKg": 7520, "kalanAdet": 19, "ortKgManuel": ""}, {"urunId": "e51xa1h", "sayimAdet": 287, "sayimKg": 10855, "satisAdet": 245, "satisKg": 9224, "kalanAdet": 42, "ortKgManuel": ""}]}, {"id": "bcefovh", "markaId": "p52612g", "sayimNo": 5, "tarih": "2026-07-20", "kilitli": true, "kilitliMiydi": true, "degisiklikGecmisi": [], "satirlar": [{"urunId": "g0zfmn5", "sayimAdet": 190, "sayimKg": 7282, "satisAdet": 188, "satisKg": 7198, "kalanAdet": 0, "ortKgManuel": ""}, {"urunId": "eata2g4", "sayimAdet": 297, "sayimKg": 8040, "satisAdet": 296, "satisKg": 8032, "kalanAdet": 0, "ortKgManuel": ""}, {"urunId": "e51xa1h", "sayimAdet": 287, "sayimKg": 10855, "satisAdet": 286, "satisKg": 10769, "kalanAdet": 0, "ortKgManuel": ""}]}, {"id": "wlxg0gq", "markaId": "243y8at", "sayimNo": 1, "tarih": "2026-07-16", "kilitli": true, "kilitliMiydi": true, "degisiklikGecmisi": [], "satirlar": [{"urunId": "s1c6w1a", "sayimAdet": 383, "sayimKg": 16065, "satisAdet": 254, "satisKg": 10666, "kalanAdet": 130, "ortKgManuel": ""}, {"urunId": "awzugzd", "sayimAdet": 151, "sayimKg": 6281, "satisAdet": 0, "satisKg": 0, "kalanAdet": 151, "ortKgManuel": 41.6}, {"urunId": "1cv47lp", "sayimAdet": 17, "sayimKg": 686, "satisAdet": 1, "satisKg": 40, "kalanAdet": 16, "ortKgManuel": 40.35}, {"urunId": "oc9ez24", "sayimAdet": 45, "sayimKg": 1805, "satisAdet": 0, "satisKg": 0, "kalanAdet": 45, "ortKgManuel": 40.11}]}, {"id": "hxkbek2", "markaId": "243y8at", "sayimNo": 2, "tarih": "2026-07-17", "kilitli": true, "kilitliMiydi": true, "degisiklikGecmisi": [], "satirlar": [{"urunId": "s1c6w1a", "sayimAdet": 383, "sayimKg": 16065, "satisAdet": 307, "satisKg": 12884, "kalanAdet": 80, "ortKgManuel": ""}, {"urunId": "awzugzd", "sayimAdet": 151, "sayimKg": 6281, "satisAdet": 20, "satisKg": 808, "kalanAdet": 129, "ortKgManuel": 40.31}, {"urunId": "1cv47lp", "sayimAdet": 17, "sayimKg": 686, "satisAdet": 1, "satisKg": 40, "kalanAdet": 16, "ortKgManuel": 40.35}, {"urunId": "oc9ez24", "sayimAdet": 45, "sayimKg": 1805, "satisAdet": 6, "satisKg": 243, "kalanAdet": 39, "ortKgManuel": 40.11}]}, {"id": "8vi63f7", "markaId": "243y8at", "sayimNo": 3, "tarih": "2026-07-18", "kilitli": true, "kilitliMiydi": true, "degisiklikGecmisi": [], "satirlar": [{"urunId": "s1c6w1a", "sayimAdet": 383, "sayimKg": 16065, "satisAdet": 373, "satisKg": 15627, "kalanAdet": 13, "ortKgManuel": ""}, {"urunId": "awzugzd", "sayimAdet": 151, "sayimKg": 6281, "satisAdet": 39, "satisKg": 1583, "kalanAdet": 110, "ortKgManuel": ""}, {"urunId": "1cv47lp", "sayimAdet": 17, "sayimKg": 686, "satisAdet": 4, "satisKg": 163, "kalanAdet": 13, "ortKgManuel": ""}, {"urunId": "oc9ez24", "sayimAdet": 45, "sayimKg": 1805, "satisAdet": 6, "satisKg": 243, "kalanAdet": 39, "ortKgManuel": ""}]}, {"id": "ws9c71p", "markaId": "243y8at", "sayimNo": 4, "tarih": "2026-07-20", "kilitli": true, "kilitliMiydi": true, "degisiklikGecmisi": [], "satirlar": [{"urunId": "s1c6w1a", "sayimAdet": 383, "sayimKg": 16065, "satisAdet": 385, "satisKg": 16127, "kalanAdet": 0, "ortKgManuel": ""}, {"urunId": "awzugzd", "sayimAdet": 151, "sayimKg": 6281, "satisAdet": 66, "satisKg": 2694, "kalanAdet": 83, "ortKgManuel": ""}, {"urunId": "1cv47lp", "sayimAdet": 17, "sayimKg": 686, "satisAdet": 4, "satisKg": 163, "kalanAdet": 13, "ortKgManuel": 40.35}, {"urunId": "oc9ez24", "sayimAdet": 45, "sayimKg": 1805, "satisAdet": 45, "satisKg": 1845, "kalanAdet": 0, "ortKgManuel": ""}]}, {"id": "vzeg7fx", "markaId": "243y8at", "sayimNo": 5, "tarih": "2026-07-21", "kilitli": true, "kilitliMiydi": true, "degisiklikGecmisi": [], "satirlar": [{"urunId": "s1c6w1a", "sayimAdet": 383, "sayimKg": 16065, "satisAdet": 385, "satisKg": 16127, "kalanAdet": 0, "ortKgManuel": ""}, {"urunId": "awzugzd", "sayimAdet": 151, "sayimKg": 6281, "satisAdet": 109, "satisKg": 4455, "kalanAdet": 40, "ortKgManuel": ""}, {"urunId": "1cv47lp", "sayimAdet": 17, "sayimKg": 686, "satisAdet": 4, "satisKg": 163, "kalanAdet": 13, "ortKgManuel": 40.35}, {"urunId": "oc9ez24", "sayimAdet": 45, "sayimKg": 1805, "satisAdet": 45, "satisKg": 1845, "kalanAdet": 0, "ortKgManuel": ""}]}, {"id": "t0unlcm", "markaId": "243y8at", "sayimNo": 6, "tarih": "2026-07-22", "kilitli": true, "kilitliMiydi": true, "degisiklikGecmisi": [], "satirlar": [{"urunId": "s1c6w1a", "sayimAdet": 383, "sayimKg": 16065, "satisAdet": 385, "satisKg": 16127, "kalanAdet": 0, "ortKgManuel": ""}, {"urunId": "awzugzd", "sayimAdet": 151, "sayimKg": 6281, "satisAdet": 114, "satisKg": 4654, "kalanAdet": 35, "ortKgManuel": ""}, {"urunId": "1cv47lp", "sayimAdet": 17, "sayimKg": 686, "satisAdet": 17, "satisKg": 682, "kalanAdet": 0, "ortKgManuel": ""}, {"urunId": "oc9ez24", "sayimAdet": 45, "sayimKg": 1805, "satisAdet": 45, "satisKg": 1845, "kalanAdet": 0, "ortKgManuel": ""}]}, {"id": "h0xek7f", "markaId": "243y8at", "sayimNo": 7, "tarih": "2026-07-22", "kilitli": true, "kilitliMiydi": true, "degisiklikGecmisi": [], "satirlar": [{"urunId": "s1c6w1a", "sayimAdet": 383, "sayimKg": 16065, "satisAdet": 385, "satisKg": 16127, "kalanAdet": 0, "ortKgManuel": ""}, {"urunId": "awzugzd", "sayimAdet": 151, "sayimKg": 6281, "satisAdet": 149, "satisKg": 6058, "kalanAdet": 0, "ortKgManuel": ""}, {"urunId": "1cv47lp", "sayimAdet": 17, "sayimKg": 686, "satisAdet": 17, "satisKg": 682, "kalanAdet": 0, "ortKgManuel": ""}, {"urunId": "oc9ez24", "sayimAdet": 45, "sayimKg": 1805, "satisAdet": 45, "satisKg": 1845, "kalanAdet": 0, "ortKgManuel": ""}]}, {"id": "p0bu9lu", "markaId": "6huxk3t", "sayimNo": 1, "tarih": "2026-07-17", "kilitli": true, "kilitliMiydi": true, "degisiklikGecmisi": [], "satirlar": [{"urunId": "ynvoqhc", "sayimAdet": 330, "sayimKg": 14125, "satisAdet": 221, "satisKg": 9437, "kalanAdet": 109, "ortKgManuel": ""}, {"urunId": "ighu36u", "sayimAdet": 173, "sayimKg": 7203, "satisAdet": 0, "satisKg": 0, "kalanAdet": 173, "ortKgManuel": 41.64}, {"urunId": "k9vx4xe", "sayimAdet": 85, "sayimKg": 3500, "satisAdet": 7, "satisKg": 288, "kalanAdet": 78, "ortKgManuel": ""}, {"urunId": "h9jjhi9", "sayimAdet": 47, "sayimKg": 2000, "satisAdet": 0, "satisKg": 0, "kalanAdet": 47, "ortKgManuel": 42.55}]}, {"id": "ygz6gyo", "markaId": "6huxk3t", "sayimNo": 2, "tarih": "2026-07-20", "kilitli": true, "kilitliMiydi": true, "degisiklikGecmisi": [], "satirlar": [{"urunId": "ynvoqhc", "sayimAdet": 330, "sayimKg": 14125, "satisAdet": 330, "satisKg": 14155, "kalanAdet": 0, "ortKgManuel": ""}, {"urunId": "ighu36u", "sayimAdet": 173, "sayimKg": 7203, "satisAdet": 127, "satisKg": 5298, "kalanAdet": 46, "ortKgManuel": 41.64}, {"urunId": "k9vx4xe", "sayimAdet": 85, "sayimKg": 3500, "satisAdet": 27, "satisKg": 1082, "kalanAdet": 58, "ortKgManuel": ""}, {"urunId": "h9jjhi9", "sayimAdet": 47, "sayimKg": 2000, "satisAdet": 22, "satisKg": 899, "kalanAdet": 26, "ortKgManuel": 41.5}]}, {"id": "o3nauf4", "markaId": "6huxk3t", "sayimNo": 3, "tarih": "2026-07-21", "kilitli": true, "kilitliMiydi": true, "degisiklikGecmisi": [], "satirlar": [{"urunId": "ynvoqhc", "sayimAdet": 330, "sayimKg": 14125, "satisAdet": 330, "satisKg": 14155, "kalanAdet": 0, "ortKgManuel": ""}, {"urunId": "ighu36u", "sayimAdet": 173, "sayimKg": 7203, "satisAdet": 173, "satisKg": 7254, "kalanAdet": 0, "ortKgManuel": ""}, {"urunId": "k9vx4xe", "sayimAdet": 85, "sayimKg": 3500, "satisAdet": 32, "satisKg": 1283, "kalanAdet": 53, "ortKgManuel": ""}, {"urunId": "h9jjhi9", "sayimAdet": 47, "sayimKg": 2000, "satisAdet": 45, "satisKg": 1868, "kalanAdet": 3, "ortKgManuel": ""}]}, {"id": "ulcyv2a", "markaId": "6huxk3t", "sayimNo": 4, "tarih": "2026-07-22", "kilitli": true, "kilitliMiydi": true, "degisiklikGecmisi": [], "satirlar": [{"urunId": "ynvoqhc", "sayimAdet": 330, "sayimKg": 14125, "satisAdet": 330, "satisKg": 14155, "kalanAdet": 0, "ortKgManuel": ""}, {"urunId": "ighu36u", "sayimAdet": 173, "sayimKg": 7203, "satisAdet": 173, "satisKg": 7254, "kalanAdet": 0, "ortKgManuel": ""}, {"urunId": "k9vx4xe", "sayimAdet": 85, "sayimKg": 3500, "satisAdet": 40, "satisKg": 1607, "kalanAdet": 45, "ortKgManuel": ""}, {"urunId": "h9jjhi9", "sayimAdet": 47, "sayimKg": 2000, "satisAdet": 48, "satisKg": 1997, "kalanAdet": 0, "ortKgManuel": ""}]}, {"id": "6no57bc", "markaId": "6huxk3t", "sayimNo": 5, "tarih": "2026-07-23", "kilitli": true, "kilitliMiydi": true, "degisiklikGecmisi": [], "satirlar": [{"urunId": "ynvoqhc", "sayimAdet": 330, "sayimKg": 14125, "satisAdet": 330, "satisKg": 14155, "kalanAdet": 0, "ortKgManuel": ""}, {"urunId": "ighu36u", "sayimAdet": 173, "sayimKg": 7203, "satisAdet": 173, "satisKg": 7254, "kalanAdet": 0, "ortKgManuel": ""}, {"urunId": "k9vx4xe", "sayimAdet": 85, "sayimKg": 3500, "satisAdet": 64, "satisKg": 2599, "kalanAdet": 21, "ortKgManuel": ""}, {"urunId": "h9jjhi9", "sayimAdet": 47, "sayimKg": 2000, "satisAdet": 48, "satisKg": 1997, "kalanAdet": 0, "ortKgManuel": ""}]}, {"id": "fr31uwy", "markaId": "6huxk3t", "sayimNo": 6, "tarih": "2026-07-24", "kilitli": true, "kilitliMiydi": true, "degisiklikGecmisi": [], "satirlar": [{"urunId": "ynvoqhc", "sayimAdet": 330, "sayimKg": 14125, "satisAdet": 330, "satisKg": 14155, "kalanAdet": 0, "ortKgManuel": ""}, {"urunId": "ighu36u", "sayimAdet": 173, "sayimKg": 7203, "satisAdet": 173, "satisKg": 7254, "kalanAdet": 0, "ortKgManuel": ""}, {"urunId": "k9vx4xe", "sayimAdet": 85, "sayimKg": 3500, "satisAdet": 74, "satisKg": 2991, "kalanAdet": 11, "ortKgManuel": ""}, {"urunId": "h9jjhi9", "sayimAdet": 47, "sayimKg": 2000, "satisAdet": 48, "satisKg": 1997, "kalanAdet": 0, "ortKgManuel": ""}]}, {"id": "x4somcy", "markaId": "6huxk3t", "sayimNo": 7, "tarih": "2026-07-25", "kilitli": true, "kilitliMiydi": true, "degisiklikGecmisi": [], "satirlar": [{"urunId": "ynvoqhc", "sayimAdet": 330, "sayimKg": 14125, "satisAdet": 330, "satisKg": 14155, "kalanAdet": 0, "ortKgManuel": ""}, {"urunId": "ighu36u", "sayimAdet": 173, "sayimKg": 7203, "satisAdet": 173, "satisKg": 7254, "kalanAdet": 0, "ortKgManuel": ""}, {"urunId": "k9vx4xe", "sayimAdet": 85, "sayimKg": 3500, "satisAdet": 82, "satisKg": 3316, "kalanAdet": 3, "ortKgManuel": ""}, {"urunId": "h9jjhi9", "sayimAdet": 47, "sayimKg": 2000, "satisAdet": 48, "satisKg": 1997, "kalanAdet": 0, "ortKgManuel": ""}]}, {"id": "j9g8wm2", "markaId": "6huxk3t", "sayimNo": 8, "tarih": "2026-07-27", "kilitli": true, "kilitliMiydi": true, "degisiklikGecmisi": [], "satirlar": [{"urunId": "ynvoqhc", "sayimAdet": 330, "sayimKg": 14125, "satisAdet": 330, "satisKg": 14155, "kalanAdet": 0, "ortKgManuel": ""}, {"urunId": "ighu36u", "sayimAdet": 173, "sayimKg": 7203, "satisAdet": 173, "satisKg": 7254, "kalanAdet": 0, "ortKgManuel": ""}, {"urunId": "k9vx4xe", "sayimAdet": 85, "sayimKg": 3500, "satisAdet": 85, "satisKg": 3438, "kalanAdet": 0, "ortKgManuel": ""}, {"urunId": "h9jjhi9", "sayimAdet": 47, "sayimKg": 2000, "satisAdet": 48, "satisKg": 1997, "kalanAdet": 0, "ortKgManuel": ""}]}, {"id": "l6py2ea", "markaId": "jh80f4c", "sayimNo": 1, "tarih": "2026-07-20", "kilitli": true, "kilitliMiydi": true, "degisiklikGecmisi": [], "satirlar": [{"urunId": "otto3x1", "sayimAdet": 581, "sayimKg": 24175, "satisAdet": 380, "satisKg": 15811, "kalanAdet": 201, "ortKgManuel": ""}, {"urunId": "lkncccj", "sayimAdet": 50, "sayimKg": 2063, "satisAdet": 37, "satisKg": 1523, "kalanAdet": 13, "ortKgManuel": ""}]}, {"id": "rl0sspc", "markaId": "jh80f4c", "sayimNo": 2, "tarih": "2026-07-21", "kilitli": true, "kilitliMiydi": true, "degisiklikGecmisi": [], "satirlar": [{"urunId": "otto3x1", "sayimAdet": 581, "sayimKg": 24175, "satisAdet": 491, "satisKg": 20451, "kalanAdet": 89, "ortKgManuel": ""}, {"urunId": "lkncccj", "sayimAdet": 50, "sayimKg": 2063, "satisAdet": 50, "satisKg": 2056, "kalanAdet": 0, "ortKgManuel": ""}]}, {"id": "kiyduu1", "markaId": "jh80f4c", "sayimNo": 3, "tarih": "2026-07-22", "kilitli": true, "kilitliMiydi": true, "degisiklikGecmisi": [], "satirlar": [{"urunId": "otto3x1", "sayimAdet": 581, "sayimKg": 24175, "satisAdet": 492, "satisKg": 20493, "kalanAdet": 89, "ortKgManuel": ""}, {"urunId": "lkncccj", "sayimAdet": 50, "sayimKg": 2063, "satisAdet": 50, "satisKg": 2056, "kalanAdet": 0, "ortKgManuel": ""}]}, {"id": "5t2mdz8", "markaId": "jh80f4c", "sayimNo": 4, "tarih": "2026-07-23", "kilitli": true, "kilitliMiydi": true, "degisiklikGecmisi": [], "satirlar": [{"urunId": "otto3x1", "sayimAdet": 581, "sayimKg": 24175, "satisAdet": 507, "satisKg": 21124, "kalanAdet": 74, "ortKgManuel": ""}, {"urunId": "lkncccj", "sayimAdet": 50, "sayimKg": 2063, "satisAdet": 50, "satisKg": 2056, "kalanAdet": 0, "ortKgManuel": ""}]}, {"id": "yelybsc", "markaId": "jh80f4c", "sayimNo": 5, "tarih": "2026-07-24", "kilitli": true, "kilitliMiydi": true, "degisiklikGecmisi": [], "satirlar": [{"urunId": "otto3x1", "sayimAdet": 581, "sayimKg": 24175, "satisAdet": 558, "satisKg": 23254, "kalanAdet": 23, "ortKgManuel": ""}, {"urunId": "lkncccj", "sayimAdet": 50, "sayimKg": 2063, "satisAdet": 50, "satisKg": 2056, "kalanAdet": 0, "ortKgManuel": ""}]}, {"id": "rw843b4", "markaId": "jh80f4c", "sayimNo": 6, "tarih": "2026-07-27", "kilitli": true, "kilitliMiydi": true, "degisiklikGecmisi": [], "satirlar": [{"urunId": "otto3x1", "sayimAdet": 581, "sayimKg": 24175, "satisAdet": 581, "satisKg": 24209, "kalanAdet": 0, "ortKgManuel": ""}, {"urunId": "lkncccj", "sayimAdet": 50, "sayimKg": 2063, "satisAdet": 50, "satisKg": 2056, "kalanAdet": 0, "ortKgManuel": ""}]}, {"id": "0yjkg60", "markaId": "wql1rp5", "sayimNo": 1, "tarih": "2026-07-20", "kilitli": true, "kilitliMiydi": true, "degisiklikGecmisi": [], "satirlar": [{"urunId": "64e6sf9", "sayimAdet": 507, "sayimKg": 16881, "satisAdet": 41, "satisKg": 1365, "kalanAdet": 466, "ortKgManuel": ""}, {"urunId": "mtqhgrz", "sayimAdet": 169, "sayimKg": 5585, "satisAdet": 0, "satisKg": 0, "kalanAdet": 169, "ortKgManuel": 33.05}, {"urunId": "71xzcsd", "sayimAdet": 101, "sayimKg": 3364, "satisAdet": 32, "satisKg": 1065, "kalanAdet": 69, "ortKgManuel": ""}]}, {"id": "cbag3pw", "markaId": "wql1rp5", "sayimNo": 2, "tarih": "2026-07-21", "kilitli": true, "kilitliMiydi": true, "degisiklikGecmisi": [], "satirlar": [{"urunId": "64e6sf9", "sayimAdet": 507, "sayimKg": 16881, "satisAdet": 104, "satisKg": 3494, "kalanAdet": 403, "ortKgManuel": ""}, {"urunId": "mtqhgrz", "sayimAdet": 169, "sayimKg": 5585, "satisAdet": 0, "satisKg": 0, "kalanAdet": 169, "ortKgManuel": 33.05}, {"urunId": "71xzcsd", "sayimAdet": 101, "sayimKg": 3364, "satisAdet": 75, "satisKg": 2494, "kalanAdet": 26, "ortKgManuel": ""}]}, {"id": "kult550", "markaId": "wql1rp5", "sayimNo": 3, "tarih": "2026-07-22", "kilitli": true, "kilitliMiydi": true, "degisiklikGecmisi": [], "satirlar": [{"urunId": "64e6sf9", "sayimAdet": 507, "sayimKg": 16881, "satisAdet": 373, "satisKg": 12476, "kalanAdet": 135, "ortKgManuel": ""}, {"urunId": "mtqhgrz", "sayimAdet": 169, "sayimKg": 5585, "satisAdet": 73, "satisKg": 2387, "kalanAdet": 98, "ortKgManuel": ""}, {"urunId": "71xzcsd", "sayimAdet": 101, "sayimKg": 3364, "satisAdet": 98, "satisKg": 3258, "kalanAdet": 2, "ortKgManuel": ""}]}, {"id": "6c2ttcc", "markaId": "wql1rp5", "sayimNo": 4, "tarih": "2026-07-23", "kilitli": true, "kilitliMiydi": true, "degisiklikGecmisi": [], "satirlar": [{"urunId": "64e6sf9", "sayimAdet": 507, "sayimKg": 16881, "satisAdet": 425, "satisKg": 14204, "kalanAdet": 81, "ortKgManuel": ""}, {"urunId": "mtqhgrz", "sayimAdet": 169, "sayimKg": 5585, "satisAdet": 132, "satisKg": 4351, "kalanAdet": 40, "ortKgManuel": ""}, {"urunId": "71xzcsd", "sayimAdet": 101, "sayimKg": 3364, "satisAdet": 100, "satisKg": 3324, "kalanAdet": 0, "ortKgManuel": ""}]}, {"id": "azalgut", "markaId": "wql1rp5", "sayimNo": 5, "tarih": "2026-07-24", "kilitli": true, "kilitliMiydi": true, "degisiklikGecmisi": [], "satirlar": [{"urunId": "64e6sf9", "sayimAdet": 507, "sayimKg": 16881, "satisAdet": 500, "satisKg": 16708, "kalanAdet": 0, "ortKgManuel": ""}, {"urunId": "mtqhgrz", "sayimAdet": 169, "sayimKg": 5585, "satisAdet": 172, "satisKg": 5688, "kalanAdet": 0, "ortKgManuel": ""}, {"urunId": "71xzcsd", "sayimAdet": 101, "sayimKg": 3364, "satisAdet": 102, "satisKg": 3394, "kalanAdet": 0, "ortKgManuel": ""}]}, {"id": "aj16m4e", "markaId": "wql1rp5", "sayimNo": 6, "tarih": "2026-07-27", "kilitli": true, "kilitliMiydi": true, "degisiklikGecmisi": [], "satirlar": [{"urunId": "64e6sf9", "sayimAdet": 507, "sayimKg": 16881, "satisAdet": 506, "satisKg": 16905, "kalanAdet": 0, "ortKgManuel": ""}, {"urunId": "mtqhgrz", "sayimAdet": 169, "sayimKg": 5585, "satisAdet": 172, "satisKg": 5688, "kalanAdet": 0, "ortKgManuel": ""}, {"urunId": "71xzcsd", "sayimAdet": 101, "sayimKg": 3364, "satisAdet": 102, "satisKg": 3394, "kalanAdet": 0, "ortKgManuel": ""}]}, {"id": "hwb1s6z", "markaId": "gzz5h90", "sayimNo": 1, "tarih": "2026-07-22", "kilitli": true, "kilitliMiydi": true, "degisiklikGecmisi": [], "satirlar": [{"urunId": "thvmusm", "sayimAdet": 322, "sayimKg": 12504, "satisAdet": 176, "satisKg": 6832, "kalanAdet": 146, "ortKgManuel": ""}, {"urunId": "jj3x442", "sayimAdet": 401, "sayimKg": 11070, "satisAdet": 401, "satisKg": 11069, "kalanAdet": 0, "ortKgManuel": ""}, {"urunId": "tu2aene", "sayimAdet": 101, "sayimKg": 3787, "satisAdet": 101, "satisKg": 3787, "kalanAdet": 0, "ortKgManuel": ""}]}, {"id": "9zbiqbx", "markaId": "gzz5h90", "sayimNo": 2, "tarih": "2026-07-23", "kilitli": true, "kilitliMiydi": true, "degisiklikGecmisi": [], "satirlar": [{"urunId": "thvmusm", "sayimAdet": 322, "sayimKg": 12504, "satisAdet": 284, "satisKg": 11052, "kalanAdet": 38, "ortKgManuel": ""}, {"urunId": "jj3x442", "sayimAdet": 401, "sayimKg": 11070, "satisAdet": 401, "satisKg": 11069, "kalanAdet": 0, "ortKgManuel": ""}, {"urunId": "tu2aene", "sayimAdet": 101, "sayimKg": 3787, "satisAdet": 101, "satisKg": 3787, "kalanAdet": 0, "ortKgManuel": ""}]}, {"id": "gddzrw0", "markaId": "gzz5h90", "sayimNo": 3, "tarih": "2026-07-24", "kilitli": true, "kilitliMiydi": true, "degisiklikGecmisi": [], "satirlar": [{"urunId": "thvmusm", "sayimAdet": 322, "sayimKg": 12504, "satisAdet": 314, "satisKg": 12267, "kalanAdet": 0, "ortKgManuel": ""}, {"urunId": "jj3x442", "sayimAdet": 401, "sayimKg": 11070, "satisAdet": 401, "satisKg": 11069, "kalanAdet": 0, "ortKgManuel": ""}, {"urunId": "tu2aene", "sayimAdet": 101, "sayimKg": 3787, "satisAdet": 101, "satisKg": 3787, "kalanAdet": 0, "ortKgManuel": ""}]}, {"id": "5avtpz0", "markaId": "gzz5h90", "sayimNo": 4, "tarih": "2026-07-27", "kilitli": true, "kilitliMiydi": true, "degisiklikGecmisi": [], "satirlar": [{"urunId": "thvmusm", "sayimAdet": 322, "sayimKg": 12504, "satisAdet": 322, "satisKg": 12594, "kalanAdet": 0, "ortKgManuel": ""}, {"urunId": "jj3x442", "sayimAdet": 401, "sayimKg": 11070, "satisAdet": 401, "satisKg": 11069, "kalanAdet": 0, "ortKgManuel": ""}, {"urunId": "tu2aene", "sayimAdet": 101, "sayimKg": 3787, "satisAdet": 101, "satisKg": 3787, "kalanAdet": 0, "ortKgManuel": ""}]}, {"id": "g2zxe6n", "markaId": "xaqpwdl", "sayimNo": 1, "tarih": "2026-07-22", "kilitli": true, "kilitliMiydi": true, "degisiklikGecmisi": [], "satirlar": [{"urunId": "ggrr2ln", "sayimAdet": 258, "sayimKg": 10385, "satisAdet": 0, "satisKg": 0, "kalanAdet": 258, "ortKgManuel": ""}, {"urunId": "sply1tc", "sayimAdet": 295, "sayimKg": 8031, "satisAdet": 0, "satisKg": 0, "kalanAdet": 295, "ortKgManuel": ""}, {"urunId": "idwke4g", "sayimAdet": 135, "sayimKg": 5250, "satisAdet": 0, "satisKg": 0, "kalanAdet": 135, "ortKgManuel": ""}, {"urunId": "4r4zxgh", "sayimAdet": 106, "sayimKg": 2769, "satisAdet": 0, "satisKg": 0, "kalanAdet": 106, "ortKgManuel": ""}]}, {"id": "34wiaft", "markaId": "xaqpwdl", "sayimNo": 2, "tarih": "2026-07-23", "kilitli": true, "kilitliMiydi": true, "degisiklikGecmisi": [], "satirlar": [{"urunId": "ggrr2ln", "sayimAdet": 258, "sayimKg": 10385, "satisAdet": 21, "satisKg": 843, "kalanAdet": 234, "ortKgManuel": 39.85}, {"urunId": "sply1tc", "sayimAdet": 295, "sayimKg": 8031, "satisAdet": 8, "satisKg": 209, "kalanAdet": 287, "ortKgManuel": 27.02}, {"urunId": "idwke4g", "sayimAdet": 135, "sayimKg": 5250, "satisAdet": 116, "satisKg": 4551, "kalanAdet": 14, "ortKgManuel": ""}, {"urunId": "4r4zxgh", "sayimAdet": 106, "sayimKg": 2769, "satisAdet": 68, "satisKg": 1786, "kalanAdet": 43, "ortKgManuel": ""}]}, {"id": "xn6duez", "markaId": "xaqpwdl", "sayimNo": 3, "tarih": "2026-07-24", "kilitli": true, "kilitliMiydi": true, "degisiklikGecmisi": [], "satirlar": [{"urunId": "ggrr2ln", "sayimAdet": 258, "sayimKg": 10385, "satisAdet": 210, "satisKg": 8397, "kalanAdet": 53, "ortKgManuel": ""}, {"urunId": "sply1tc", "sayimAdet": 295, "sayimKg": 8031, "satisAdet": 122, "satisKg": 3264, "kalanAdet": 173, "ortKgManuel": ""}, {"urunId": "idwke4g", "sayimAdet": 135, "sayimKg": 5250, "satisAdet": 130, "satisKg": 5093, "kalanAdet": 0, "ortKgManuel": ""}, {"urunId": "4r4zxgh", "sayimAdet": 106, "sayimKg": 2769, "satisAdet": 111, "satisKg": 2892, "kalanAdet": 0, "ortKgManuel": ""}]}, {"id": "mfm3yn4", "markaId": "xaqpwdl", "sayimNo": 4, "tarih": "2026-07-25", "kilitli": true, "kilitliMiydi": true, "degisiklikGecmisi": [], "satirlar": [{"urunId": "ggrr2ln", "sayimAdet": 258, "sayimKg": 10385, "satisAdet": 239, "satisKg": 9541, "kalanAdet": 15, "ortKgManuel": ""}, {"urunId": "sply1tc", "sayimAdet": 295, "sayimKg": 8031, "satisAdet": 179, "satisKg": 4872, "kalanAdet": 114, "ortKgManuel": ""}, {"urunId": "idwke4g", "sayimAdet": 135, "sayimKg": 5250, "satisAdet": 130, "satisKg": 5093, "kalanAdet": 0, "ortKgManuel": ""}, {"urunId": "4r4zxgh", "sayimAdet": 106, "sayimKg": 2769, "satisAdet": 111, "satisKg": 2892, "kalanAdet": 0, "ortKgManuel": ""}]}, {"id": "sqh0q75", "markaId": "xaqpwdl", "sayimNo": 5, "tarih": "2026-07-27", "kilitli": true, "kilitliMiydi": true, "degisiklikGecmisi": [], "satirlar": [{"urunId": "ggrr2ln", "sayimAdet": 258, "sayimKg": 10385, "satisAdet": 321, "satisKg": 12678, "kalanAdet": 0, "ortKgManuel": ""}, {"urunId": "sply1tc", "sayimAdet": 295, "sayimKg": 8031, "satisAdet": 232, "satisKg": 6294, "kalanAdet": 0, "ortKgManuel": ""}, {"urunId": "idwke4g", "sayimAdet": 135, "sayimKg": 5250, "satisAdet": 130, "satisKg": 5093, "kalanAdet": 0, "ortKgManuel": ""}, {"urunId": "4r4zxgh", "sayimAdet": 106, "sayimKg": 2769, "satisAdet": 111, "satisKg": 2892, "kalanAdet": 0, "ortKgManuel": ""}]}, {"id": "6hwmh6z", "markaId": "oir1ldc", "sayimNo": 1, "tarih": "2026-07-23", "kilitli": true, "kilitliMiydi": true, "degisiklikGecmisi": [], "satirlar": [{"urunId": "b9qeoj2", "sayimAdet": 402, "sayimKg": 13427, "satisAdet": 8, "satisKg": 268, "kalanAdet": 392, "ortKgManuel": 32.93}, {"urunId": "kvwqesb", "sayimAdet": 167, "sayimKg": 5771, "satisAdet": 91, "satisKg": 3144, "kalanAdet": 76, "ortKgManuel": ""}, {"urunId": "dj9fscz", "sayimAdet": 211, "sayimKg": 7061, "satisAdet": 106, "satisKg": 3549, "kalanAdet": 102, "ortKgManuel": ""}]}, {"id": "g9tbyff", "markaId": "oir1ldc", "sayimNo": 2, "tarih": "2026-07-24", "kilitli": true, "kilitliMiydi": true, "degisiklikGecmisi": [], "satirlar": [{"urunId": "b9qeoj2", "sayimAdet": 402, "sayimKg": 13427, "satisAdet": 408, "satisKg": 13667, "kalanAdet": 0, "ortKgManuel": ""}, {"urunId": "kvwqesb", "sayimAdet": 167, "sayimKg": 5771, "satisAdet": 167, "satisKg": 5738, "kalanAdet": 0, "ortKgManuel": ""}, {"urunId": "dj9fscz", "sayimAdet": 211, "sayimKg": 7061, "satisAdet": 161, "satisKg": 5419, "kalanAdet": 48, "ortKgManuel": ""}]}, {"id": "ne705yy", "markaId": "oir1ldc", "sayimNo": 3, "tarih": "2026-07-25", "kilitli": true, "kilitliMiydi": true, "degisiklikGecmisi": [], "satirlar": [{"urunId": "b9qeoj2", "sayimAdet": 402, "sayimKg": 13427, "satisAdet": 402, "satisKg": 13470, "kalanAdet": 0, "ortKgManuel": ""}, {"urunId": "kvwqesb", "sayimAdet": 167, "sayimKg": 5771, "satisAdet": 167, "satisKg": 5738, "kalanAdet": 0, "ortKgManuel": ""}, {"urunId": "dj9fscz", "sayimAdet": 211, "sayimKg": 7061, "satisAdet": 189, "satisKg": 6366, "kalanAdet": 20, "ortKgManuel": ""}]}, {"id": "vgczj5v", "markaId": "oir1ldc", "sayimNo": 4, "tarih": "2026-07-27", "kilitli": true, "kilitliMiydi": true, "degisiklikGecmisi": [], "satirlar": [{"urunId": "b9qeoj2", "sayimAdet": 402, "sayimKg": 13427, "satisAdet": 402, "satisKg": 13470, "kalanAdet": 0, "ortKgManuel": ""}, {"urunId": "kvwqesb", "sayimAdet": 167, "sayimKg": 5771, "satisAdet": 167, "satisKg": 5737, "kalanAdet": 0, "ortKgManuel": ""}, {"urunId": "dj9fscz", "sayimAdet": 211, "sayimKg": 7061, "satisAdet": 189, "satisKg": 6366, "kalanAdet": 20, "ortKgManuel": ""}]}, {"id": "pngc8c5", "markaId": "oir1ldc", "sayimNo": 5, "tarih": "2026-07-28", "kilitli": true, "kilitliMiydi": true, "degisiklikGecmisi": [], "satirlar": [{"urunId": "b9qeoj2", "sayimAdet": 402, "sayimKg": 13427, "satisAdet": 402, "satisKg": 13470, "kalanAdet": 0, "ortKgManuel": ""}, {"urunId": "kvwqesb", "sayimAdet": 167, "sayimKg": 5771, "satisAdet": 167, "satisKg": 5737, "kalanAdet": 0, "ortKgManuel": ""}, {"urunId": "dj9fscz", "sayimAdet": 211, "sayimKg": 7061, "satisAdet": 210, "satisKg": 7065, "kalanAdet": 0, "ortKgManuel": ""}]}, {"id": "mae0agg", "markaId": "oir1ldc", "sayimNo": 6, "tarih": "2026-08-04", "kilitli": true, "kilitliMiydi": true, "degisiklikGecmisi": [], "satirlar": [{"urunId": "b9qeoj2", "sayimAdet": 402, "sayimKg": 13427, "satisAdet": 402, "satisKg": 13470, "kalanAdet": 0, "ortKgManuel": ""}, {"urunId": "kvwqesb", "sayimAdet": 167, "sayimKg": 5771, "satisAdet": 167, "satisKg": 5737, "kalanAdet": 0, "ortKgManuel": ""}, {"urunId": "dj9fscz", "sayimAdet": 211, "sayimKg": 7061, "satisAdet": 211, "satisKg": 7098, "kalanAdet": 0, "ortKgManuel": ""}]}, {"id": "6c1ulem", "markaId": "jk8s8ge", "sayimNo": 1, "tarih": "2026-07-24", "kilitli": true, "kilitliMiydi": true, "degisiklikGecmisi": [], "satirlar": [{"urunId": "5my30mf", "sayimAdet": 210, "sayimKg": 8358, "satisAdet": 1, "satisKg": 41, "kalanAdet": 209, "ortKgManuel": 39.8}, {"urunId": "i8evi1c", "sayimAdet": 295, "sayimKg": 8043, "satisAdet": 0, "satisKg": 0, "kalanAdet": 295, "ortKgManuel": 27.26}, {"urunId": "5l8lv2g", "sayimAdet": 137, "sayimKg": 5313, "satisAdet": 137, "satisKg": 5313, "kalanAdet": 0, "ortKgManuel": ""}, {"urunId": "rrjoqek", "sayimAdet": 109, "sayimKg": 2916, "satisAdet": 37, "satisKg": 990, "kalanAdet": 72, "ortKgManuel": ""}, {"urunId": "zj47025", "sayimAdet": 58, "sayimKg": 2228, "satisAdet": 58, "satisKg": 2228, "kalanAdet": 0, "ortKgManuel": ""}]}, {"id": "b7351bq", "markaId": "jk8s8ge", "sayimNo": 2, "tarih": "2026-07-25", "kilitli": true, "kilitliMiydi": true, "degisiklikGecmisi": [], "satirlar": [{"urunId": "5my30mf", "sayimAdet": 210, "sayimKg": 8358, "satisAdet": 1, "satisKg": 41, "kalanAdet": 209, "ortKgManuel": 39.6}, {"urunId": "i8evi1c", "sayimAdet": 295, "sayimKg": 8043, "satisAdet": 295, "satisKg": 8057, "kalanAdet": 0, "ortKgManuel": ""}, {"urunId": "5l8lv2g", "sayimAdet": 137, "sayimKg": 5313, "satisAdet": 137, "satisKg": 5313, "kalanAdet": 0, "ortKgManuel": ""}, {"urunId": "rrjoqek", "sayimAdet": 109, "sayimKg": 2916, "satisAdet": 68, "satisKg": 1806, "kalanAdet": 42, "ortKgManuel": ""}, {"urunId": "zj47025", "sayimAdet": 58, "sayimKg": 2228, "satisAdet": 58, "satisKg": 2228, "kalanAdet": 0, "ortKgManuel": ""}]}, {"id": "o37t2x5", "markaId": "jk8s8ge", "sayimNo": 3, "tarih": "2026-07-27", "kilitli": true, "kilitliMiydi": true, "degisiklikGecmisi": [], "satirlar": [{"urunId": "5my30mf", "sayimAdet": 210, "sayimKg": 8358, "satisAdet": 213, "satisKg": 8440, "kalanAdet": 0, "ortKgManuel": ""}, {"urunId": "i8evi1c", "sayimAdet": 295, "sayimKg": 8043, "satisAdet": 261, "satisKg": 7117, "kalanAdet": 0, "ortKgManuel": ""}, {"urunId": "5l8lv2g", "sayimAdet": 137, "sayimKg": 5313, "satisAdet": 137, "satisKg": 5313, "kalanAdet": 0, "ortKgManuel": ""}, {"urunId": "rrjoqek", "sayimAdet": 109, "sayimKg": 2916, "satisAdet": 110, "satisKg": 2906, "kalanAdet": 0, "ortKgManuel": ""}, {"urunId": "zj47025", "sayimAdet": 58, "sayimKg": 2228, "satisAdet": 58, "satisKg": 2228, "kalanAdet": 0, "ortKgManuel": ""}]}, {"id": "2frx0op", "markaId": "jk8s8ge", "sayimNo": 4, "tarih": "2026-07-28", "kilitli": true, "kilitliMiydi": true, "degisiklikGecmisi": [], "satirlar": [{"urunId": "5my30mf", "sayimAdet": 210, "sayimKg": 8358, "satisAdet": 200, "satisKg": 7931, "kalanAdet": 13, "ortKgManuel": ""}, {"urunId": "i8evi1c", "sayimAdet": 295, "sayimKg": 8043, "satisAdet": 261, "satisKg": 7117, "kalanAdet": 0, "ortKgManuel": ""}, {"urunId": "5l8lv2g", "sayimAdet": 137, "sayimKg": 5313, "satisAdet": 137, "satisKg": 5313, "kalanAdet": 0, "ortKgManuel": ""}, {"urunId": "rrjoqek", "sayimAdet": 109, "sayimKg": 2916, "satisAdet": 110, "satisKg": 2906, "kalanAdet": 0, "ortKgManuel": ""}, {"urunId": "zj47025", "sayimAdet": 58, "sayimKg": 2228, "satisAdet": 58, "satisKg": 2228, "kalanAdet": 0, "ortKgManuel": ""}]}, {"id": "1cqfr24", "markaId": "jk8s8ge", "sayimNo": 5, "tarih": "2026-07-30", "kilitli": true, "kilitliMiydi": true, "degisiklikGecmisi": [], "satirlar": [{"urunId": "5my30mf", "sayimAdet": 210, "sayimKg": 8358, "satisAdet": 213, "satisKg": 8437, "kalanAdet": 0, "ortKgManuel": ""}, {"urunId": "i8evi1c", "sayimAdet": 295, "sayimKg": 8043, "satisAdet": 261, "satisKg": 7117, "kalanAdet": 0, "ortKgManuel": ""}, {"urunId": "5l8lv2g", "sayimAdet": 137, "sayimKg": 5313, "satisAdet": 137, "satisKg": 5313, "kalanAdet": 0, "ortKgManuel": ""}, {"urunId": "rrjoqek", "sayimAdet": 109, "sayimKg": 2916, "satisAdet": 110, "satisKg": 2906, "kalanAdet": 0, "ortKgManuel": ""}, {"urunId": "zj47025", "sayimAdet": 58, "sayimKg": 2228, "satisAdet": 58, "satisKg": 2228, "kalanAdet": 0, "ortKgManuel": ""}]}, {"id": "81t2wi2", "markaId": "vz8s534", "sayimNo": 1, "tarih": "2026-07-24", "kilitli": true, "kilitliMiydi": true, "degisiklikGecmisi": [], "satirlar": [{"urunId": "uqy1ba4", "sayimAdet": 353, "sayimKg": 12266, "satisAdet": 18, "satisKg": 625, "kalanAdet": 335, "ortKgManuel": ""}, {"urunId": "ghnoouo", "sayimAdet": 159, "sayimKg": 5304, "satisAdet": 136, "satisKg": 4537, "kalanAdet": 23, "ortKgManuel": ""}, {"urunId": "bsxsir4", "sayimAdet": 240, "sayimKg": 8082, "satisAdet": 60, "satisKg": 2022, "kalanAdet": 180, "ortKgManuel": ""}]}, {"id": "p2dp0qk", "markaId": "vz8s534", "sayimNo": 2, "tarih": "2026-07-25", "kilitli": true, "kilitliMiydi": true, "degisiklikGecmisi": [], "satirlar": [{"urunId": "uqy1ba4", "sayimAdet": 353, "sayimKg": 12266, "satisAdet": 147, "satisKg": 5076, "kalanAdet": 205, "ortKgManuel": ""}, {"urunId": "ghnoouo", "sayimAdet": 159, "sayimKg": 5304, "satisAdet": 159, "satisKg": 5291, "kalanAdet": 0, "ortKgManuel": ""}, {"urunId": "bsxsir4", "sayimAdet": 240, "sayimKg": 8082, "satisAdet": 63, "satisKg": 2123, "kalanAdet": 177, "ortKgManuel": ""}]}, {"id": "efgupxa", "markaId": "vz8s534", "sayimNo": 3, "tarih": "2026-07-27", "kilitli": true, "kilitliMiydi": true, "degisiklikGecmisi": [], "satirlar": [{"urunId": "uqy1ba4", "sayimAdet": 353, "sayimKg": 12266, "satisAdet": 352, "satisKg": 11988, "kalanAdet": 0, "ortKgManuel": ""}, {"urunId": "ghnoouo", "sayimAdet": 159, "sayimKg": 5304, "satisAdet": 159, "satisKg": 5291, "kalanAdet": 0, "ortKgManuel": ""}, {"urunId": "bsxsir4", "sayimAdet": 240, "sayimKg": 8082, "satisAdet": 129, "satisKg": 4324, "kalanAdet": 111, "ortKgManuel": ""}]}, {"id": "f7r2vi4", "markaId": "vz8s534", "sayimNo": 4, "tarih": "2026-07-28", "kilitli": true, "kilitliMiydi": true, "degisiklikGecmisi": [], "satirlar": [{"urunId": "uqy1ba4", "sayimAdet": 353, "sayimKg": 12266, "satisAdet": 352, "satisKg": 11988, "kalanAdet": 0, "ortKgManuel": ""}, {"urunId": "ghnoouo", "sayimAdet": 159, "sayimKg": 5304, "satisAdet": 159, "satisKg": 5291, "kalanAdet": 0, "ortKgManuel": ""}, {"urunId": "bsxsir4", "sayimAdet": 240, "sayimKg": 8082, "satisAdet": 138, "satisKg": 4640, "kalanAdet": 101, "ortKgManuel": ""}]}, {"id": "aq44z7a", "markaId": "vz8s534", "sayimNo": 5, "tarih": "2026-07-29", "kilitli": true, "kilitliMiydi": true, "degisiklikGecmisi": [], "satirlar": [{"urunId": "uqy1ba4", "sayimAdet": 353, "sayimKg": 12266, "satisAdet": 353, "satisKg": 12022, "kalanAdet": 0, "ortKgManuel": ""}, {"urunId": "ghnoouo", "sayimAdet": 159, "sayimKg": 5304, "satisAdet": 159, "satisKg": 5291, "kalanAdet": 0, "ortKgManuel": ""}, {"urunId": "bsxsir4", "sayimAdet": 240, "sayimKg": 8082, "satisAdet": 206, "satisKg": 6954, "kalanAdet": 31, "ortKgManuel": ""}]}, {"id": "6f0k0i0", "markaId": "vz8s534", "sayimNo": 6, "tarih": "2026-07-30", "kilitli": true, "kilitliMiydi": true, "degisiklikGecmisi": [], "satirlar": [{"urunId": "uqy1ba4", "sayimAdet": 353, "sayimKg": 12266, "satisAdet": 353, "satisKg": 12022, "kalanAdet": 0, "ortKgManuel": ""}, {"urunId": "ghnoouo", "sayimAdet": 159, "sayimKg": 5304, "satisAdet": 159, "satisKg": 5291, "kalanAdet": 0, "ortKgManuel": ""}, {"urunId": "bsxsir4", "sayimAdet": 240, "sayimKg": 8082, "satisAdet": 237, "satisKg": 7988, "kalanAdet": 0, "ortKgManuel": ""}]}, {"id": "0t9e69b", "markaId": "o40s81o", "sayimNo": 1, "tarih": "2026-07-25", "kilitli": true, "kilitliMiydi": true, "degisiklikGecmisi": [], "satirlar": [{"urunId": "ak3wwxf", "sayimAdet": 349, "sayimKg": 12005, "satisAdet": 5, "satisKg": 172, "kalanAdet": 344, "ortKgManuel": 33.81}, {"urunId": "5f9ln21", "sayimAdet": 151, "sayimKg": 5063, "satisAdet": 34, "satisKg": 1142, "kalanAdet": 117, "ortKgManuel": 33.31}, {"urunId": "ntr5fun", "sayimAdet": 302, "sayimKg": 10046, "satisAdet": 31, "satisKg": 1029, "kalanAdet": 271, "ortKgManuel": ""}]}, {"id": "76yj4v6", "markaId": "o40s81o", "sayimNo": 2, "tarih": "2026-07-27", "kilitli": true, "kilitliMiydi": true, "degisiklikGecmisi": [], "satirlar": [{"urunId": "ak3wwxf", "sayimAdet": 349, "sayimKg": 12005, "satisAdet": 198, "satisKg": 6708, "kalanAdet": 151, "ortKgManuel": ""}, {"urunId": "5f9ln21", "sayimAdet": 151, "sayimKg": 5063, "satisAdet": 122, "satisKg": 4064, "kalanAdet": 29, "ortKgManuel": ""}, {"urunId": "ntr5fun", "sayimAdet": 302, "sayimKg": 10046, "satisAdet": 31, "satisKg": 1029, "kalanAdet": 271, "ortKgManuel": ""}]}, {"id": "omlkggj", "markaId": "o40s81o", "sayimNo": 3, "tarih": "2026-07-28", "kilitli": true, "kilitliMiydi": true, "degisiklikGecmisi": [], "satirlar": [{"urunId": "ak3wwxf", "sayimAdet": 349, "sayimKg": 12005, "satisAdet": 276, "satisKg": 9328, "kalanAdet": 72, "ortKgManuel": ""}, {"urunId": "5f9ln21", "sayimAdet": 151, "sayimKg": 5063, "satisAdet": 151, "satisKg": 5039, "kalanAdet": 0, "ortKgManuel": ""}, {"urunId": "ntr5fun", "sayimAdet": 302, "sayimKg": 10046, "satisAdet": 31, "satisKg": 1029, "kalanAdet": 251, "ortKgManuel": ""}]}, {"id": "i50m5cn", "markaId": "o40s81o", "sayimNo": 4, "tarih": "2026-07-29", "kilitli": true, "kilitliMiydi": true, "degisiklikGecmisi": [], "satirlar": [{"urunId": "ak3wwxf", "sayimAdet": 349, "sayimKg": 12005, "satisAdet": 339, "satisKg": 11505, "kalanAdet": 8, "ortKgManuel": ""}, {"urunId": "5f9ln21", "sayimAdet": 151, "sayimKg": 5063, "satisAdet": 151, "satisKg": 5039, "kalanAdet": 0, "ortKgManuel": ""}, {"urunId": "ntr5fun", "sayimAdet": 302, "sayimKg": 10046, "satisAdet": 82, "satisKg": 2699, "kalanAdet": 220, "ortKgManuel": ""}]}, {"id": "0zi5lsd", "markaId": "o40s81o", "sayimNo": 5, "tarih": "2026-07-30", "kilitli": true, "kilitliMiydi": true, "degisiklikGecmisi": [], "satirlar": [{"urunId": "ak3wwxf", "sayimAdet": 349, "sayimKg": 12005, "satisAdet": 347, "satisKg": 11779, "kalanAdet": 0, "ortKgManuel": ""}, {"urunId": "5f9ln21", "sayimAdet": 151, "sayimKg": 5063, "satisAdet": 151, "satisKg": 5039, "kalanAdet": 0, "ortKgManuel": ""}, {"urunId": "ntr5fun", "sayimAdet": 302, "sayimKg": 10046, "satisAdet": 123, "satisKg": 4059, "kalanAdet": 179, "ortKgManuel": ""}]}, {"id": "s5ao1da", "markaId": "o40s81o", "sayimNo": 6, "tarih": "2026-08-04", "kilitli": true, "kilitliMiydi": true, "degisiklikGecmisi": [], "satirlar": [{"urunId": "ak3wwxf", "sayimAdet": 349, "sayimKg": 12005, "satisAdet": 347, "satisKg": 11779, "kalanAdet": 0, "ortKgManuel": ""}, {"urunId": "5f9ln21", "sayimAdet": 151, "sayimKg": 5063, "satisAdet": 151, "satisKg": 5039, "kalanAdet": 0, "ortKgManuel": ""}, {"urunId": "ntr5fun", "sayimAdet": 302, "sayimKg": 10046, "satisAdet": 302, "satisKg": 10034, "kalanAdet": 0, "ortKgManuel": ""}]}, {"id": "z7nv8o7", "markaId": "915ph4k", "sayimNo": 1, "tarih": "2026-07-25", "kilitli": true, "kilitliMiydi": true, "degisiklikGecmisi": [], "satirlar": [{"urunId": "q29255i", "sayimAdet": 489, "sayimKg": 20700, "satisAdet": 0, "satisKg": 0, "kalanAdet": 489, "ortKgManuel": 42.26}, {"urunId": "ik2qimn", "sayimAdet": 133, "sayimKg": 5448, "satisAdet": 9, "satisKg": 364, "kalanAdet": 124, "ortKgManuel": 40.33}, {"urunId": "abd32vj", "sayimAdet": 19, "sayimKg": 769, "satisAdet": 0, "satisKg": 0, "kalanAdet": 19, "ortKgManuel": 40.15}]}, {"id": "bmgqm8w", "markaId": "915ph4k", "sayimNo": 2, "tarih": "2026-07-27", "kilitli": true, "kilitliMiydi": true, "degisiklikGecmisi": [], "satirlar": [{"urunId": "q29255i", "sayimAdet": 489, "sayimKg": 20700, "satisAdet": 299, "satisKg": 12645, "kalanAdet": 186, "ortKgManuel": ""}, {"urunId": "ik2qimn", "sayimAdet": 133, "sayimKg": 5448, "satisAdet": 108, "satisKg": 4360, "kalanAdet": 24, "ortKgManuel": ""}, {"urunId": "abd32vj", "sayimAdet": 19, "sayimKg": 769, "satisAdet": 20, "satisKg": 803, "kalanAdet": 0, "ortKgManuel": ""}]}, {"id": "4iv8v6s", "markaId": "915ph4k", "sayimNo": 3, "tarih": "2026-07-28", "kilitli": true, "kilitliMiydi": true, "degisiklikGecmisi": [], "satirlar": [{"urunId": "q29255i", "sayimAdet": 489, "sayimKg": 20700, "satisAdet": 405, "satisKg": 17215, "kalanAdet": 80, "ortKgManuel": ""}, {"urunId": "ik2qimn", "sayimAdet": 133, "sayimKg": 5448, "satisAdet": 133, "satisKg": 5383, "kalanAdet": 0, "ortKgManuel": ""}, {"urunId": "abd32vj", "sayimAdet": 19, "sayimKg": 769, "satisAdet": 20, "satisKg": 803, "kalanAdet": 0, "ortKgManuel": ""}]}, {"id": "gnljxna", "markaId": "915ph4k", "sayimNo": 4, "tarih": "2026-07-30", "kilitli": true, "kilitliMiydi": true, "degisiklikGecmisi": [], "satirlar": [{"urunId": "q29255i", "sayimAdet": 489, "sayimKg": 20700, "satisAdet": 486, "satisKg": 20628, "kalanAdet": 0, "ortKgManuel": ""}, {"urunId": "ik2qimn", "sayimAdet": 133, "sayimKg": 5448, "satisAdet": 133, "satisKg": 5383, "kalanAdet": 0, "ortKgManuel": ""}, {"urunId": "abd32vj", "sayimAdet": 19, "sayimKg": 769, "satisAdet": 20, "satisKg": 803, "kalanAdet": 0, "ortKgManuel": ""}]}, {"id": "4k68dej", "markaId": "vgqmlcm", "sayimNo": 1, "tarih": "2026-07-29", "kilitli": true, "kilitliMiydi": true, "degisiklikGecmisi": [], "satirlar": [{"urunId": "lwma3c1", "sayimAdet": 326, "sayimKg": 14555, "satisAdet": 198, "satisKg": 8845, "kalanAdet": 128, "ortKgManuel": ""}, {"urunId": "37ptve3", "sayimAdet": 232, "sayimKg": 9915, "satisAdet": 129, "satisKg": 5517, "kalanAdet": 103, "ortKgManuel": ""}, {"urunId": "o41vze3", "sayimAdet": 47, "sayimKg": 1996, "satisAdet": 15, "satisKg": 647, "kalanAdet": 32, "ortKgManuel": ""}]}, {"id": "yrufhkh", "markaId": "vgqmlcm", "sayimNo": 2, "tarih": "2026-07-30", "kilitli": true, "kilitliMiydi": true, "degisiklikGecmisi": [], "satirlar": [{"urunId": "lwma3c1", "sayimAdet": 326, "sayimKg": 14555, "satisAdet": 326, "satisKg": 14419, "kalanAdet": 0, "ortKgManuel": ""}, {"urunId": "37ptve3", "sayimAdet": 232, "sayimKg": 9915, "satisAdet": 232, "satisKg": 9896, "kalanAdet": 0, "ortKgManuel": ""}, {"urunId": "o41vze3", "sayimAdet": 47, "sayimKg": 1996, "satisAdet": 47, "satisKg": 1996, "kalanAdet": 0, "ortKgManuel": ""}]}, {"id": "i1gozy8", "markaId": "496k3hi", "sayimNo": 1, "tarih": "2026-07-30", "kilitli": true, "kilitliMiydi": true, "degisiklikGecmisi": [], "satirlar": [{"urunId": "1zi3r9g", "sayimAdet": 344, "sayimKg": 14657, "satisAdet": 51, "satisKg": 2172, "kalanAdet": 294, "ortKgManuel": ""}, {"urunId": "utebz2l", "sayimAdet": 255, "sayimKg": 10705, "satisAdet": 75, "satisKg": 3196, "kalanAdet": 180, "ortKgManuel": ""}, {"urunId": "risj016", "sayimAdet": 25, "sayimKg": 1316, "satisAdet": 11, "satisKg": 570, "kalanAdet": 14, "ortKgManuel": ""}]}, {"id": "p53s25o", "markaId": "496k3hi", "sayimNo": 2, "tarih": "2026-08-03", "kilitli": true, "kilitliMiydi": true, "degisiklikGecmisi": [], "satirlar": [{"urunId": "1zi3r9g", "sayimAdet": 344, "sayimKg": 14657, "satisAdet": 346, "satisKg": 14610, "kalanAdet": 0, "ortKgManuel": ""}, {"urunId": "utebz2l", "sayimAdet": 255, "sayimKg": 10705, "satisAdet": 250, "satisKg": 10524, "kalanAdet": 5, "ortKgManuel": ""}, {"urunId": "risj016", "sayimAdet": 25, "sayimKg": 1316, "satisAdet": 25, "satisKg": 1335, "kalanAdet": 0, "ortKgManuel": ""}]}, {"id": "5qedxql", "markaId": "496k3hi", "sayimNo": 3, "tarih": "2026-08-04", "kilitli": true, "kilitliMiydi": true, "degisiklikGecmisi": [], "satirlar": [{"urunId": "1zi3r9g", "sayimAdet": 344, "sayimKg": 14657, "satisAdet": 346, "satisKg": 14610, "kalanAdet": 0, "ortKgManuel": ""}, {"urunId": "utebz2l", "sayimAdet": 255, "sayimKg": 10705, "satisAdet": 255, "satisKg": 10733, "kalanAdet": 0, "ortKgManuel": ""}, {"urunId": "risj016", "sayimAdet": 25, "sayimKg": 1316, "satisAdet": 25, "satisKg": 1335, "kalanAdet": 0, "ortKgManuel": ""}]}, {"id": "kfnt1ft", "markaId": "496k3hi", "sayimNo": 4, "tarih": "2026-08-04", "kilitli": true, "kilitliMiydi": true, "degisiklikGecmisi": [], "satirlar": [{"urunId": "1zi3r9g", "sayimAdet": 344, "sayimKg": 14657, "satisAdet": 346, "satisKg": 14610, "kalanAdet": 0, "ortKgManuel": ""}, {"urunId": "utebz2l", "sayimAdet": 255, "sayimKg": 10705, "satisAdet": 245, "satisKg": 10312, "kalanAdet": 0, "ortKgManuel": ""}, {"urunId": "risj016", "sayimAdet": 25, "sayimKg": 1316, "satisAdet": 25, "satisKg": 1335, "kalanAdet": 0, "ortKgManuel": ""}]}, {"id": "g3qr6sc", "markaId": "o526c3q", "sayimNo": 1, "tarih": "2026-07-30", "kilitli": true, "kilitliMiydi": true, "degisiklikGecmisi": [], "satirlar": [{"urunId": "8paph9z", "sayimAdet": 427, "sayimKg": 14485, "satisAdet": 117, "satisKg": 3968, "kalanAdet": 310, "ortKgManuel": ""}, {"urunId": "m914b45", "sayimAdet": 147, "sayimKg": 4835, "satisAdet": 39, "satisKg": 1283, "kalanAdet": 108, "ortKgManuel": ""}, {"urunId": "kjgmu3k", "sayimAdet": 200, "sayimKg": 6860, "satisAdet": 10, "satisKg": 343, "kalanAdet": 190, "ortKgManuel": ""}]}, {"id": "qrwp7xj", "markaId": "o526c3q", "sayimNo": 2, "tarih": "2026-08-03", "kilitli": true, "kilitliMiydi": true, "degisiklikGecmisi": [], "satirlar": [{"urunId": "8paph9z", "sayimAdet": 427, "sayimKg": 14485, "satisAdet": 424, "satisKg": 14406, "kalanAdet": 0, "ortKgManuel": ""}, {"urunId": "m914b45", "sayimAdet": 147, "sayimKg": 4835, "satisAdet": 115, "satisKg": 3815, "kalanAdet": 32, "ortKgManuel": ""}, {"urunId": "kjgmu3k", "sayimAdet": 200, "sayimKg": 6860, "satisAdet": 42, "satisKg": 1431, "kalanAdet": 158, "ortKgManuel": ""}]}, {"id": "5gptqnu", "markaId": "o526c3q", "sayimNo": 3, "tarih": "2026-08-04", "kilitli": true, "kilitliMiydi": true, "degisiklikGecmisi": [], "satirlar": [{"urunId": "8paph9z", "sayimAdet": 427, "sayimKg": 14485, "satisAdet": 431, "satisKg": 14632, "kalanAdet": 0, "ortKgManuel": ""}, {"urunId": "m914b45", "sayimAdet": 147, "sayimKg": 4835, "satisAdet": 135, "satisKg": 4480, "kalanAdet": 12, "ortKgManuel": ""}, {"urunId": "kjgmu3k", "sayimAdet": 200, "sayimKg": 6860, "satisAdet": 104, "satisKg": 3513, "kalanAdet": 95, "ortKgManuel": ""}]}, {"id": "j2xlml6", "markaId": "o526c3q", "sayimNo": 4, "tarih": "2026-08-10", "kilitli": true, "kilitliMiydi": true, "degisiklikGecmisi": [], "satirlar": [{"urunId": "8paph9z", "sayimAdet": 427, "sayimKg": 14485, "satisAdet": 431, "satisKg": 14632, "kalanAdet": 0, "ortKgManuel": ""}, {"urunId": "m914b45", "sayimAdet": 147, "sayimKg": 4835, "satisAdet": 148, "satisKg": 4910, "kalanAdet": 0, "ortKgManuel": ""}, {"urunId": "kjgmu3k", "sayimAdet": 200, "sayimKg": 6860, "satisAdet": 199, "satisKg": 6720, "kalanAdet": 0, "ortKgManuel": ""}]}, {"id": "cpmxer1", "markaId": "pgcnb1m", "sayimNo": 1, "tarih": "2026-07-31", "kilitli": true, "kilitliMiydi": true, "degisiklikGecmisi": [], "satirlar": [{"urunId": "9x3nip0", "sayimAdet": "", "sayimKg": "", "satisAdet": 91, "satisKg": 3960, "kalanAdet": 226, "ortKgManuel": ""}, {"urunId": "fu2mdb5", "sayimAdet": "", "sayimKg": "", "satisAdet": 0, "satisKg": 0, "kalanAdet": 192, "ortKgManuel": 28.17}, {"urunId": "odfitbd", "sayimAdet": "", "sayimKg": "", "satisAdet": 29, "satisKg": 1250, "kalanAdet": 111, "ortKgManuel": ""}, {"urunId": "fdw74kq", "sayimAdet": "", "sayimKg": "", "satisAdet": 1, "satisKg": 43, "kalanAdet": 15, "ortKgManuel": ""}]}, {"id": "nhj60fv", "markaId": "pgcnb1m", "sayimNo": 2, "tarih": "2026-08-03", "kilitli": true, "kilitliMiydi": true, "degisiklikGecmisi": [], "satirlar": [{"urunId": "9x3nip0", "sayimAdet": 317, "sayimKg": 13798, "satisAdet": 317, "satisKg": 13888, "kalanAdet": 0, "ortKgManuel": ""}, {"urunId": "fu2mdb5", "sayimAdet": 192, "sayimKg": 5410, "satisAdet": 189, "satisKg": 5304, "kalanAdet": 4, "ortKgManuel": ""}, {"urunId": "odfitbd", "sayimAdet": 140, "sayimKg": 6036, "satisAdet": 117, "satisKg": 5070, "kalanAdet": 23, "ortKgManuel": ""}, {"urunId": "fdw74kq", "sayimAdet": 16, "sayimKg": 697, "satisAdet": 4, "satisKg": 174, "kalanAdet": 12, "ortKgManuel": ""}]}, {"id": "xh94vdl", "markaId": "pgcnb1m", "sayimNo": 3, "tarih": "2026-08-04", "kilitli": true, "kilitliMiydi": true, "degisiklikGecmisi": [], "satirlar": [{"urunId": "9x3nip0", "sayimAdet": 317, "sayimKg": 13798, "satisAdet": 318, "satisKg": 13916, "kalanAdet": 0, "ortKgManuel": ""}, {"urunId": "fu2mdb5", "sayimAdet": 192, "sayimKg": 5410, "satisAdet": 192, "satisKg": 5388, "kalanAdet": 0, "ortKgManuel": ""}, {"urunId": "odfitbd", "sayimAdet": 140, "sayimKg": 6036, "satisAdet": 121, "satisKg": 5241, "kalanAdet": 39, "ortKgManuel": ""}, {"urunId": "fdw74kq", "sayimAdet": 16, "sayimKg": 697, "satisAdet": 16, "satisKg": 693, "kalanAdet": 0, "ortKgManuel": ""}]}, {"id": "kjio87n", "markaId": "pgcnb1m", "sayimNo": 4, "tarih": "2026-08-10", "kilitli": true, "kilitliMiydi": true, "degisiklikGecmisi": [], "satirlar": [{"urunId": "9x3nip0", "sayimAdet": 317, "sayimKg": 13798, "satisAdet": 318, "satisKg": 13916, "kalanAdet": 0, "ortKgManuel": ""}, {"urunId": "fu2mdb5", "sayimAdet": 192, "sayimKg": 5410, "satisAdet": 192, "satisKg": 5388, "kalanAdet": 0, "ortKgManuel": ""}, {"urunId": "odfitbd", "sayimAdet": 140, "sayimKg": 6036, "satisAdet": 140, "satisKg": 6056, "kalanAdet": 0, "ortKgManuel": ""}, {"urunId": "fdw74kq", "sayimAdet": 16, "sayimKg": 697, "satisAdet": 16, "satisKg": 693, "kalanAdet": 0, "ortKgManuel": ""}]}, {"id": "xmjnkvq", "markaId": "b0h2j53", "sayimNo": 1, "tarih": "2026-08-03", "kilitli": true, "kilitliMiydi": true, "degisiklikGecmisi": [], "satirlar": [{"urunId": "5tuotif", "sayimAdet": 57, "sayimKg": 1881, "satisAdet": 57, "satisKg": 1880, "kalanAdet": 0, "ortKgManuel": ""}, {"urunId": "747lawz", "sayimAdet": 223, "sayimKg": 7275, "satisAdet": 156, "satisKg": 5091, "kalanAdet": 67, "ortKgManuel": ""}]}, {"id": "rxew6sw", "markaId": "b0h2j53", "sayimNo": 2, "tarih": "2026-08-04", "kilitli": true, "kilitliMiydi": true, "degisiklikGecmisi": [], "satirlar": [{"urunId": "5tuotif", "sayimAdet": 57, "sayimKg": 1881, "satisAdet": 57, "satisKg": 1880, "kalanAdet": 0, "ortKgManuel": ""}, {"urunId": "747lawz", "sayimAdet": 223, "sayimKg": 7275, "satisAdet": 178, "satisKg": 5785, "kalanAdet": 52, "ortKgManuel": ""}]}, {"id": "fupq6xp", "markaId": "b0h2j53", "sayimNo": 3, "tarih": "2026-08-10", "kilitli": true, "kilitliMiydi": true, "degisiklikGecmisi": [], "satirlar": [{"urunId": "5tuotif", "sayimAdet": 57, "sayimKg": 1881, "satisAdet": 57, "satisKg": 1880, "kalanAdet": 0, "ortKgManuel": ""}, {"urunId": "747lawz", "sayimAdet": 223, "sayimKg": 7275, "satisAdet": 220, "satisKg": 7125, "kalanAdet": 0, "ortKgManuel": ""}]}, {"id": "a0x7hxu", "markaId": "t53lcbz", "sayimNo": 1, "tarih": "2026-07-30", "kilitli": true, "kilitliMiydi": true, "degisiklikGecmisi": [], "satirlar": [{"urunId": "ufuq5ep", "sayimAdet": 65, "sayimKg": 2102, "satisAdet": 17, "satisKg": 550, "kalanAdet": 48, "ortKgManuel": ""}, {"urunId": "zgle03i", "sayimAdet": 230, "sayimKg": 7735, "satisAdet": 196, "satisKg": 6501, "kalanAdet": 34, "ortKgManuel": ""}]}, {"id": "wqr8qut", "markaId": "t53lcbz", "sayimNo": 2, "tarih": "2026-07-30", "kilitli": true, "kilitliMiydi": true, "degisiklikGecmisi": [], "satirlar": [{"urunId": "ufuq5ep", "sayimAdet": 65, "sayimKg": 2102, "satisAdet": 65, "satisKg": 2115, "kalanAdet": 0, "ortKgManuel": ""}, {"urunId": "zgle03i", "sayimAdet": 230, "sayimKg": 7735, "satisAdet": 230, "satisKg": 7615, "kalanAdet": 0, "ortKgManuel": ""}]}, {"id": "c40a6fz", "markaId": "paqsd1d", "sayimNo": 1, "tarih": "2026-07-15", "kilitli": true, "kilitliMiydi": true, "degisiklikGecmisi": [], "satirlar": [{"urunId": "4vk0kl0", "sayimAdet": 112, "sayimKg": 4552, "satisAdet": 0, "satisKg": 0, "kalanAdet": 112, "ortKgManuel": 40.31}, {"urunId": "5kof3wl", "sayimAdet": 125, "sayimKg": 5008, "satisAdet": 15, "satisKg": 601, "kalanAdet": 110, "ortKgManuel": ""}]}, {"id": "o9xho24", "markaId": "paqsd1d", "sayimNo": 2, "tarih": "2026-07-16", "kilitli": true, "kilitliMiydi": true, "degisiklikGecmisi": [], "satirlar": [{"urunId": "4vk0kl0", "sayimAdet": 112, "sayimKg": 4552, "satisAdet": 28, "satisKg": 1131, "kalanAdet": 84, "ortKgManuel": 40.31}, {"urunId": "5kof3wl", "sayimAdet": 125, "sayimKg": 5008, "satisAdet": 35, "satisKg": 1405, "kalanAdet": 90, "ortKgManuel": ""}]}, {"id": "6e409uj", "markaId": "paqsd1d", "sayimNo": 3, "tarih": "2026-06-17", "kilitli": true, "kilitliMiydi": true, "degisiklikGecmisi": [], "satirlar": [{"urunId": "4vk0kl0", "sayimAdet": 112, "sayimKg": 4552, "satisAdet": 66, "satisKg": 2673, "kalanAdet": 46, "ortKgManuel": 40.31}, {"urunId": "5kof3wl", "sayimAdet": 125, "sayimKg": 5008, "satisAdet": 108, "satisKg": 4337, "kalanAdet": 17, "ortKgManuel": ""}]}, {"id": "iyewbw8", "markaId": "paqsd1d", "sayimNo": 4, "tarih": "2026-06-18", "kilitli": true, "kilitliMiydi": true, "degisiklikGecmisi": [], "satirlar": [{"urunId": "4vk0kl0", "sayimAdet": 112, "sayimKg": 4552, "satisAdet": 112, "satisKg": 4548, "kalanAdet": 0, "ortKgManuel": ""}, {"urunId": "5kof3wl", "sayimAdet": 125, "sayimKg": 5008, "satisAdet": 108, "satisKg": 4337, "kalanAdet": 17, "ortKgManuel": ""}]}, {"id": "heohfmi", "markaId": "paqsd1d", "sayimNo": 5, "tarih": "2026-06-20", "kilitli": true, "kilitliMiydi": true, "degisiklikGecmisi": [], "satirlar": [{"urunId": "4vk0kl0", "sayimAdet": 112, "sayimKg": 4552, "satisAdet": 112, "satisKg": 4548, "kalanAdet": 0, "ortKgManuel": ""}, {"urunId": "5kof3wl", "sayimAdet": 125, "sayimKg": 5008, "satisAdet": 125, "satisKg": 5010, "kalanAdet": 0, "ortKgManuel": ""}]}]}`);
const SEED_SENARYO = JSON.parse(`{"markalar": [{"id": "a8pat", "tarih": "2026-08-08", "marka": "A8", "urun": "PATATES", "plaka": "", "toplamYuklemeKg": 20000, "urunler": [{"id": "u_a8p", "ad": "Patates", "yuklemeAdet": 500}], "durum": "aktif"}, {"id": "a8so", "tarih": "2026-08-08", "marka": "A8", "urun": "SOĞAN", "plaka": "", "toplamYuklemeKg": 15000, "urunler": [{"id": "u_a8s", "ad": "Soğan", "yuklemeAdet": 450}], "durum": "aktif"}, {"id": "a10pat", "tarih": "2026-08-10", "marka": "A10", "urun": "PATATES", "plaka": "", "toplamYuklemeKg": 19200, "urunler": [{"id": "u_a10p", "ad": "Patates", "yuklemeAdet": 480}], "durum": "aktif"}, {"id": "a10so", "tarih": "2026-08-10", "marka": "A10", "urun": "SOĞAN", "plaka": "", "toplamYuklemeKg": 13760, "urunler": [{"id": "u_a10s", "ad": "Soğan", "yuklemeAdet": 430}], "durum": "aktif"}], "sayimlar": [{"id": "s_a8pat_1", "markaId": "a8pat", "sayimNo": 1, "tarih": "2026-08-08", "kilitli": true, "kilitliMiydi": true, "degisiklikGecmisi": [], "satirlar": [{"urunId": "u_a8p", "sayimAdet": "", "sayimKg": "", "satisAdet": 50, "satisKg": 2000, "kalanAdet": 430, "ortKgManuel": ""}]}, {"id": "s_a8pat_2", "markaId": "a8pat", "sayimNo": 2, "tarih": "2026-08-10", "kilitli": true, "kilitliMiydi": true, "degisiklikGecmisi": [], "satirlar": [{"urunId": "u_a8p", "sayimAdet": "", "sayimKg": "", "satisAdet": 470, "satisKg": 18800, "kalanAdet": 60, "ortKgManuel": ""}]}, {"id": "s_a8so_1", "markaId": "a8so", "sayimNo": 1, "tarih": "2026-08-08", "kilitli": true, "kilitliMiydi": true, "degisiklikGecmisi": [], "satirlar": [{"urunId": "u_a8s", "sayimAdet": "", "sayimKg": "", "satisAdet": 40, "satisKg": 1200, "kalanAdet": 400, "ortKgManuel": ""}]}, {"id": "s_a8so_2", "markaId": "a8so", "sayimNo": 2, "tarih": "2026-08-10", "kilitli": true, "kilitliMiydi": true, "degisiklikGecmisi": [], "satirlar": [{"urunId": "u_a8s", "sayimAdet": "", "sayimKg": "", "satisAdet": 440, "satisKg": 13600, "kalanAdet": 15, "ortKgManuel": ""}]}, {"id": "s_a10pat_1", "markaId": "a10pat", "sayimNo": 1, "tarih": "2026-08-10", "kilitli": true, "kilitliMiydi": true, "degisiklikGecmisi": [], "satirlar": [{"urunId": "u_a10p", "sayimAdet": "", "sayimKg": "", "satisAdet": 60, "satisKg": 2400, "kalanAdet": 420, "ortKgManuel": ""}]}, {"id": "s_a10so_1", "markaId": "a10so", "sayimNo": 1, "tarih": "2026-08-10", "kilitli": true, "kilitliMiydi": true, "degisiklikGecmisi": [], "satirlar": [{"urunId": "u_a10s", "sayimAdet": "", "sayimKg": "", "satisAdet": 55, "satisKg": 1650, "kalanAdet": 375, "ortKgManuel": ""}]}], "etkinlikler": [{"id": "e1", "ts": "2026-08-08T18:00:00", "markaId": "a8pat", "markaAd": "A8 · PATATES", "tip": "yeni_islem", "detay": "Yeni işlem oluşturuldu"}, {"id": "e2", "ts": "2026-08-08T18:02:00", "markaId": "a8so", "markaAd": "A8 · SOĞAN", "tip": "yeni_islem", "detay": "Yeni işlem oluşturuldu"}, {"id": "e3", "ts": "2026-08-08T21:30:00", "markaId": "a8pat", "markaAd": "A8 · PATATES", "tip": "sayim_eklendi", "detay": "1. sayım eklendi (gün sonu)"}, {"id": "e4", "ts": "2026-08-08T21:32:00", "markaId": "a8so", "markaAd": "A8 · SOĞAN", "tip": "sayim_eklendi", "detay": "1. sayım eklendi (gün sonu)"}, {"id": "e5", "ts": "2026-08-08T21:40:00", "markaId": "a8pat", "markaAd": "A8 · PATATES", "tip": "sayim_kaydedildi", "detay": "1. sayım kaydedildi"}, {"id": "e6", "ts": "2026-08-08T21:41:00", "markaId": "a8so", "markaAd": "A8 · SOĞAN", "tip": "sayim_kaydedildi", "detay": "1. sayım kaydedildi"}, {"id": "e7", "ts": "2026-08-10T09:15:00", "markaId": "a10pat", "markaAd": "A10 · PATATES", "tip": "yeni_islem", "detay": "Yeni işlem oluşturuldu"}, {"id": "e8", "ts": "2026-08-10T09:17:00", "markaId": "a10so", "markaAd": "A10 · SOĞAN", "tip": "yeni_islem", "detay": "Yeni işlem oluşturuldu"}, {"id": "e9", "ts": "2026-08-10T21:40:00", "markaId": "a8pat", "markaAd": "A8 · PATATES", "tip": "sayim_eklendi", "detay": "2. sayım eklendi (gün sonu)"}, {"id": "e10", "ts": "2026-08-10T21:41:00", "markaId": "a8so", "markaAd": "A8 · SOĞAN", "tip": "sayim_eklendi", "detay": "2. sayım eklendi (gün sonu)"}, {"id": "e11", "ts": "2026-08-10T21:42:00", "markaId": "a10pat", "markaAd": "A10 · PATATES", "tip": "sayim_eklendi", "detay": "1. sayım eklendi (gün sonu)"}, {"id": "e12", "ts": "2026-08-10T21:43:00", "markaId": "a10so", "markaAd": "A10 · SOĞAN", "tip": "sayim_eklendi", "detay": "1. sayım eklendi (gün sonu)"}, {"id": "e13", "ts": "2026-08-10T21:50:00", "markaId": "a8pat", "markaAd": "A8 · PATATES", "tip": "sayim_kaydedildi", "detay": "2. sayım kaydedildi"}]}`);
// ---- Aybelsoft içe aktarım: bulanık eşleştirme yardımcıları ----
function normalizeKod(s) {
  return (s || "").toString().trim().toUpperCase().replace(/\s+/g, "").replace(/[._-]/g, "");
}
function levenshtein(a, b) {
  a = a || ""; b = b || "";
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }
  return dp[m][n];
}
function enIyiMarkaEslesme(raw, markalar) {
  const rawN = normalizeKod(raw);
  let best = null, bestDist = Infinity;
  markalar.forEach((m) => {
    const d = levenshtein(rawN, normalizeKod(m.marka));
    if (d < bestDist) { bestDist = d; best = m; }
  });
  return { best, mesafe: bestDist, tamEslesme: rawN.length > 0 && bestDist === 0 };
}
function gunFarki(t1, t2) {
  if (!t1 || !t2) return Infinity;
  return Math.abs((new Date(t1) - new Date(t2)) / 86400000);
}
// Bir marka kodu (ör. "A8") birden fazla markaya ait olabilir — hem "A8 Patates" hem "A8 Soğan" gibi
// aynı sevkiyatın parçaları, HEM DE farklı aylarda tekrar kullanılmış, birbiriyle alakasız kodlar
// (Ağustos'un A8'i ile aylar sonraki başka bir A8 gibi). Satırın tarihine en yakın (60 gün içi)
// markaları öne çıkararak bu iki durumu ayırt ediyoruz.
function ayniKodAdaylari(kodRaw, tarih, tumMarkalar) {
  const rawN = normalizeKod(kodRaw);
  const ayniKod = tumMarkalar.filter((m) => normalizeKod(m.marka) === rawN);
  if (ayniKod.length <= 1) return ayniKod;
  const yakinlar = ayniKod.filter((m) => gunFarki(m.tarih, tarih) <= 60);
  return yakinlar.length > 0 ? yakinlar : ayniKod;
}
function enIyiUrunEslesme(raw, urunler, kodRaw) {
  // Önce ürün kodu (PAT, 2SO gibi) tam eşleşiyor mu bak — kod, isimden çok daha güvenilir bir sinyal
  if (kodRaw) {
    const kodN = normalizeKod(kodRaw);
    const kodEslesen = urunler.find((u) => u.kod && normalizeKod(u.kod) === kodN);
    if (kodEslesen) return { best: kodEslesen, mesafe: 0, tamEslesme: true, kodIleEslesti: true };
  }
  const rawN = normalizeKod(raw);
  let best = null, bestDist = Infinity;
  urunler.forEach((u) => {
    const d = levenshtein(rawN, normalizeKod(u.ad));
    if (d < bestDist) { bestDist = d; best = u; }
  });
  return { best, mesafe: bestDist, tamEslesme: rawN.length > 0 && bestDist === 0 };
}
// Aynı kodu paylaşan birden fazla marka adayı varsa (Patates+Soğan çifti gibi), ürün adı/koduna
// bakarak DOĞRU markayı otomatik seçer — kullanıcıya sormaya gerek kalmadan.
function enIyiUrunEslesmeCoklu(raw, kodRaw, markaAdaylari) {
  if (kodRaw) {
    const kodN = normalizeKod(kodRaw);
    for (const m of markaAdaylari) {
      const u = m.urunler.find((x) => x.kod && normalizeKod(x.kod) === kodN);
      if (u) return { marka: m, urun: u, mesafe: 0 };
    }
  }
  const rawN = normalizeKod(raw);
  let best = null, bestMarka = null, bestDist = Infinity;
  markaAdaylari.forEach((m) => {
    m.urunler.forEach((u) => {
      const d = levenshtein(rawN, normalizeKod(u.ad));
      if (d < bestDist) { bestDist = d; best = u; bestMarka = m; }
    });
  });
  if (!best) return null;
  return { marka: bestMarka, urun: best, mesafe: bestDist };
}
function bulSutun(row, anahtarlar) {
  const keys = Object.keys(row);
  for (const k of keys) {
    const kl = k.toLocaleLowerCase("tr");
    for (const ax of anahtarlar) {
      if (kl.includes(ax)) return row[k];
    }
  }
  return "";
}
// Ürün adı için: Aybelsoft dosyasında "Mal" başlığı hem kısa kod (2PAT) hem uzun ad (2 PATATES)
// için tekrarlanabiliyor — eşleşen sütunlar arasından en UZUN (en açıklayıcı) metni seçiyoruz.
function bulSutunEnUzun(row, anahtarlar) {
  const keys = Object.keys(row);
  let enIyi = "";
  keys.forEach((k) => {
    const kl = k.toLocaleLowerCase("tr");
    if (anahtarlar.some((ax) => kl.includes(ax))) {
      const v = String(row[k] ?? "");
      if (v.length > enIyi.length) enIyi = v;
    }
  });
  return enIyi;
}
function tarihStr(v) {
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "number") {
    const d = new Date(Math.round((v - 25569) * 86400 * 1000));
    return d.toISOString().slice(0, 10);
  }
  if (typeof v === "string") {
    const m = v.match(/(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{2,4})/);
    if (m) {
      let [, d, mo, y] = m;
      if (y.length === 2) y = "20" + y;
      return `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
    }
  }
  return "";
}
function hucreStr(v) {
  return v === undefined || v === null ? "" : String(v);
}
function satirHesaplaVeDuzelt(kap, kiloHam) {
  let satisKg = kiloHam;
  let birimDuzeltildi = false;
  // Bilinen Aybelsoft export hatası: büyük kilo değerleri (binlik ayıracı yüzünden)
  // gerçek değerin 1000'de biri olarak kayda geçebiliyor (ör. 1749 yerine 1.749).
  // Kap başına düşen kilo 5'in altındaysa (patates/soğan için gerçekçi olmayan bir oran) düzeltiyoruz.
  if (kap > 0 && satisKg > 0 && satisKg / kap < 5) {
    satisKg = satisKg * 1000;
    birimDuzeltildi = true;
  }
  return { satisKg, birimDuzeltildi };
}
async function aybelsoftDosyasiniOku(file) {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array", cellDates: true });
  const ws = wb.Sheets[wb.SheetNames[0]];

  // 1. YÖNTEM (asıl): gerçek Aybelsoft export'unda başlık satırı birleştirilmiş hücreler yüzünden
  // veriyle aynı hizada değil — bu yüzden isimden değil, doğrulanmış sabit sütun konumlarından okuyoruz:
  // 0=Marka, 4=Mal(kısa), 6=Mal(uzun), 12=Kap(adet), 15=Kilo, 39=Ad Soyad, ~45=Fatura Tarihi
  const grid = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "", raw: true });
  const sabitKonumlu = [];
  for (const row of grid) {
    const marka = hucreStr(row[0]).trim();
    if (!marka || marka.toLocaleUpperCase("tr") === "MARKA") continue;
    const kap = Number(row[12]) || 0;
    if (kap <= 0) continue; // başlık/toplam/boş satır — gerçek satış satırı değil
    const { satisKg, birimDuzeltildi } = satirHesaplaVeDuzelt(kap, Number(row[15]) || 0);
    const malKisa = hucreStr(row[4]).trim();
    const malUzun = hucreStr(row[6]).trim();
    let tarih = "";
    for (const idx of [45, 44, 46, 43, 42]) {
      const t = tarihStr(row[idx]);
      if (t) { tarih = t; break; }
    }
    sabitKonumlu.push({
      tarih, markaRaw: marka, urunRaw: malUzun.length >= malKisa.length ? malUzun : malKisa, urunKoduRaw: malKisa,
      satisAdet: kap, satisKg, birimDuzeltildi, alanKisi: hucreStr(row[39]).trim(),
    });
  }
  if (sabitKonumlu.length > 0) return sabitKonumlu;

  // 2. YÖNTEM (yedek): başlıklar veriyle hizalıysa, isimden arayarak oku
  const rows = XLSX.utils.sheet_to_json(ws, { defval: "" });
  return rows
    .map((row) => {
      const satisAdet = Number(bulSutun(row, ["kap", "adet"])) || 0;
      const { satisKg, birimDuzeltildi } = satirHesaplaVeDuzelt(satisAdet, Number(bulSutun(row, ["kilo", "kg", "ağırlık", "agirlik"])) || 0);
      return {
        tarih: tarihStr(bulSutun(row, ["fatura tarihi", "tarih"])),
        markaRaw: String(bulSutun(row, ["marka"])).trim(),
        urunRaw: bulSutunEnUzun(row, ["mal", "ürün", "urun"]).trim(),
        urunKoduRaw: String(bulSutun(row, ["ürün kodu", "urun kodu", "kod"])).trim(),
        satisAdet, satisKg, birimDuzeltildi,
        alanKisi: String(bulSutun(row, ["ad soyad", "alan", "kişi", "kisi", "personel"])).trim(),
      };
    })
    .filter((r) => r.markaRaw && r.markaRaw.toLocaleUpperCase("tr") !== "MARKA");
}
const AY_ADI = { "01": "Ocak", "02": "Şubat", "03": "Mart", "04": "Nisan", "05": "Mayıs", "06": "Haziran", "07": "Temmuz", "08": "Ağustos", "09": "Eylül", "10": "Ekim", "11": "Kasım", "12": "Aralık" };
function ayEtiket(ay) {
  const [y, m] = ay.split("-");
  return `${AY_ADI[m] || m} ${y}`;
}
function urunTipiSinifla(marka) {
  const u = (marka.urun || "").toLocaleUpperCase("tr");
  if (u.includes("PATATES")) return "Patates";
  if (u.includes("SOĞAN") || u.includes("SOGAN")) return "Soğan";
  return "Diğer";
}

function ayFarkToplami(markalar, sayimlar, ay) {
  let toplam = 0;
  markalar.filter((m) => m.tarih?.slice(0, 7) === ay).forEach((m) => {
    const son = sayimlar.filter((s) => s.markaId === m.id).sort((a, b) => b.sayimNo - a.sayimNo)[0];
    if (son) toplam += sayimOzet(son, m).fark;
  });
  return toplam;
}

function AmbarPage({ markalar, sayimlar, onSelect }) {
  const [seciliAy, setSeciliAy] = useState(null);
  const aylar = [...new Set(markalar.map((m) => m.tarih?.slice(0, 7)).filter(Boolean))].sort(); // artan (Temmuz -> Ağustos)

  if (!seciliAy) {
    return (
      <div className="space-y-4">
        <div>
          <h2 className="text-base font-medium">Ambar</h2>
          <p className="text-sm text-stone-500 mt-0.5">Aylara göre gruplanmış geçmiş. Bir ayı açıp o ay içindeki tüm markaları görün.</p>
        </div>
        {aylar.length === 0 ? (
          <div className="rounded-lg border border-dashed border-stone-300 p-12 text-center text-stone-400 text-sm">Henüz veri yok</div>
        ) : (
          <div className="rounded-lg border border-stone-200 bg-white divide-y divide-stone-100">
            {aylar.map((ay) => {
              const sayisi = markalar.filter((m) => m.tarih?.slice(0, 7) === ay).length;
              const fark = ayFarkToplami(markalar, sayimlar, ay);
              const flagged = Math.abs(fark) > 150;
              return (
                <button key={ay} onClick={() => setSeciliAy(ay)} className="w-full text-left px-4 py-3.5 hover:bg-stone-50 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <Folder className="w-4 h-4 text-amber-700 shrink-0" />
                    <span className="text-sm font-medium">{ayEtiket(ay)}</span>
                    <span className="text-xs text-stone-400">{sayisi} marka</span>
                  </div>
                  <span className={`text-base font-mono font-semibold ${flagged ? "text-red-600" : "text-emerald-700"}`}>{fark > 0 ? "+" : ""}{fmt(fark)} kg</span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  const ayMarkalari = markalar.filter((m) => m.tarih?.slice(0, 7) === seciliAy);
  const gruplar = { Patates: [], Soğan: [], Diğer: [] };
  ayMarkalari.forEach((m) => gruplar[urunTipiSinifla(m)].push(m));
  ["Patates", "Soğan", "Diğer"].forEach((k) => gruplar[k].sort((a, b) => (a.tarih < b.tarih ? -1 : a.tarih > b.tarih ? 1 : 0)));

  // Her grubun (Patates/Soğan/Diğer) satırlarını ve alt toplamını RENDER'dan ÖNCE, düz bir
  // hesapla belirliyoruz — bileşen render olurken dışarıdaki değişkeni "biriktirmeye" çalışmak
  // (önceki hata) JSX'in değerlendirilme sırasına bağlı kalıp yanlış (0) sonuç veriyordu.
  function grupOzetiHesapla(liste) {
    let toplam = 0;
    const satirlar = liste.map((m) => {
      const son = sayimlar.filter((s) => s.markaId === m.id).sort((a, b) => b.sayimNo - a.sayimNo)[0];
      const oz = son ? sayimOzet(son, m) : null;
      if (oz) toplam += oz.fark;
      return { m, oz };
    });
    return { satirlar, toplam };
  }

  const patatesOzet = grupOzetiHesapla(gruplar.Patates);
  const soganOzet = grupOzetiHesapla(gruplar.Soğan);
  const digerOzet = grupOzetiHesapla(gruplar.Diğer);
  const genelFark = patatesOzet.toplam + soganOzet.toplam + digerOzet.toplam;

  function GrupBlok({ baslik, ozet }) {
    if (ozet.satirlar.length === 0) return null;
    return (
      <div>
        <p className="text-xs font-medium text-stone-500 mb-2">{baslik} ({ozet.satirlar.length})</p>
        <div className="rounded-lg border border-stone-200 bg-white divide-y divide-stone-100">
          {ozet.satirlar.map(({ m, oz }) => {
            const flagged = oz && Math.abs(oz.fark) > esikDegeri(m);
            return (
              <button key={m.id} onClick={() => onSelect(m.id)} className="w-full text-left px-4 py-3 hover:bg-stone-50 flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-3 flex-wrap min-w-0">
                  <span className="text-sm font-medium shrink-0">{m.marka} · {fmtTarih(m.tarih)}</span>
                  <span className="text-xs text-stone-700 font-mono font-medium truncate">{m.urunler.map((u) => `${u.ad} ${fmt(u.yuklemeAdet)}`).join("   ")}</span>
                </div>
                {oz ? (
                  <span className={`text-base font-mono font-semibold shrink-0 ${flagged ? "text-red-600" : "text-emerald-700"}`}>{oz.fark > 0 ? "+" : ""}{fmt(oz.fark)} kg</span>
                ) : (
                  <span className="text-xs text-stone-400 shrink-0">Sayım yok</span>
                )}
              </button>
            );
          })}
        </div>
        <div className="text-right text-xs text-stone-500 mt-1.5 pr-1">
          {ayEtiket(seciliAy)} {baslik} Genel Toplam: <span className={`font-mono font-medium ${Math.abs(ozet.toplam) > 150 ? "text-red-600" : "text-emerald-700"}`}>{ozet.toplam > 0 ? "+" : ""}{fmt(ozet.toplam)} kg</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <button onClick={() => setSeciliAy(null)} className="text-xs text-stone-500 hover:text-stone-700 flex items-center gap-1">
        <ChevronLeft className="w-3.5 h-3.5" /> Ambar
      </button>
      <h2 className="text-base font-medium">{ayEtiket(seciliAy)}</h2>

      <GrupBlok baslik="Patates" ozet={patatesOzet} />
      <GrupBlok baslik="Soğan" ozet={soganOzet} />
      <GrupBlok baslik="Diğer" ozet={digerOzet} />

      <div className="rounded-lg border border-stone-300 bg-stone-50 px-4 py-3 flex items-center justify-between">
        <span className="text-sm font-medium">{ayEtiket(seciliAy)} Genel Toplam ({ayMarkalari.length} marka)</span>
        <span className={`text-lg font-mono font-bold ${Math.abs(genelFark) > 150 ? "text-red-600" : "text-emerald-700"}`}>{genelFark > 0 ? "+" : ""}{fmt(genelFark)} kg</span>
      </div>
    </div>
  );
}
function YeniIslemPage({ markaForm, setMarkaForm, urunToggle, urunAdetGuncelle, ozelUrunEkle, eklemarka, markalar }) {
  const cakisan = markaForm.marka.trim()
    ? markalar.filter((m) => normalizeKod(m.marka) === normalizeKod(markaForm.marka) && gunFarki(m.tarih, markaForm.tarih || m.tarih) <= 60)
    : [];
  return (
    <div className="max-w-md">
      <h2 className="text-base font-medium mb-4">Yeni işlem oluştur</h2>
      <div className="rounded-lg border border-stone-200 bg-white p-4 space-y-2.5">
        <div>
          <label className="text-xs text-stone-500 block mb-1">Tarih</label>
          <input type="date" value={markaForm.tarih} onChange={(e) => setMarkaForm({ ...markaForm, tarih: e.target.value })} className="w-full text-sm border border-stone-200 rounded px-2 py-1.5" />
        </div>
        <div>
          <label className="text-xs text-stone-500 block mb-1">Marka kodu</label>
          <input placeholder="ör. A8, T30" value={markaForm.marka} onChange={(e) => setMarkaForm({ ...markaForm, marka: e.target.value })} className="w-full text-sm border border-stone-200 rounded px-2 py-1.5" />
          {cakisan.length > 0 && (
            <p className="text-xs text-amber-700 mt-1.5 flex items-start gap-1">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              "{markaForm.marka}" kodu son 60 gün içinde zaten kullanılmış ({cakisan.map((m) => `${m.marka} · ${m.urun} · ${fmtTarih(m.tarih)}`).join(", ")}). Aybelsoft içe aktarımında karışabilir, farklı bir kod kullanmayı düşünün.
            </p>
          )}
        </div>
        <div>
          <label className="text-xs text-stone-500 block mb-1">Ürün tipi</label>
          <div className="flex gap-1.5">
            {Object.keys(MASTER_URUNLER).map((tip) => (
              <button key={tip} type="button" onClick={() => setMarkaForm({ ...markaForm, urun: tip, secilenUrunler: {} })} className={`flex-1 text-sm rounded px-2 py-1.5 border ${markaForm.urun === tip ? "bg-amber-700 text-white border-amber-700" : "border-stone-200 hover:border-stone-300"}`}>{tip}</button>
            ))}
          </div>
        </div>
        <div>
          <label className="text-xs text-stone-500 block mb-1">Plaka</label>
          <input value={markaForm.plaka} onChange={(e) => setMarkaForm({ ...markaForm, plaka: e.target.value })} className="w-full text-sm border border-stone-200 rounded px-2 py-1.5" />
        </div>
        <div>
          <label className="text-xs text-stone-500 block mb-1">Toplam yükleme kg</label>
          <input type="number" value={markaForm.toplamYuklemeKg} onChange={(e) => setMarkaForm({ ...markaForm, toplamYuklemeKg: e.target.value })} className="w-full text-sm border border-stone-200 rounded px-2 py-1.5" />
        </div>

        {markaForm.urun && (
          <div className="pt-1 space-y-1.5">
            <p className="text-xs text-stone-500">Ürün çeşitlerini seçin, yükleme adedini yazın</p>
            {(MASTER_URUNLER[markaForm.urun] || []).map((ad) => {
              const secili = ad in markaForm.secilenUrunler;
              return (
                <div key={ad} className="flex items-center gap-1.5">
                  <button type="button" onClick={() => urunToggle(ad)} className={`flex-1 text-left text-sm rounded px-2 py-1.5 border ${secili ? "bg-amber-50 border-amber-300 font-medium" : "border-stone-200 text-stone-500 hover:border-stone-300"}`}>{secili ? "✓ " : ""}{ad}</button>
                  {secili && <input placeholder="Adet" type="number" value={markaForm.secilenUrunler[ad]} onChange={(e) => urunAdetGuncelle(ad, e.target.value)} className="w-16 text-sm border border-stone-200 rounded px-2 py-1.5" />}
                </div>
              );
            })}
            {Object.keys(markaForm.secilenUrunler).filter((ad) => !(MASTER_URUNLER[markaForm.urun] || []).includes(ad)).map((ad) => (
              <div key={ad} className="flex items-center gap-1.5">
                <span className="flex-1 text-left text-sm rounded px-2 py-1.5 border border-amber-300 bg-amber-50 font-medium">✓ {ad}</span>
                <input placeholder="Adet" type="number" value={markaForm.secilenUrunler[ad]} onChange={(e) => urunAdetGuncelle(ad, e.target.value)} className="w-16 text-sm border border-stone-200 rounded px-2 py-1.5" />
              </div>
            ))}
            <div className="flex gap-1.5 pt-0.5">
              <input placeholder="Listede yok mu? özel ürün adı yaz" value={markaForm.ozelUrunAdi} onChange={(e) => setMarkaForm({ ...markaForm, ozelUrunAdi: e.target.value })} className="flex-1 text-xs border border-stone-200 rounded px-2 py-1.5" />
              <button type="button" onClick={ozelUrunEkle} className="text-xs text-amber-700 hover:underline shrink-0 px-1">+ ekle</button>
            </div>
          </div>
        )}

        <button onClick={eklemarka} className="w-full text-sm bg-stone-900 text-white rounded-lg py-2 mt-2 hover:bg-stone-800 font-medium">İşlemi oluştur</button>
      </div>
    </div>
  );
}

function GecmisPage({ etkinlikler, onMarkaTikla }) {
  const [gunFiltre, setGunFiltre] = useState("");
  const [markaFiltre, setMarkaFiltre] = useState("");
  const [tipFiltre, setTipFiltre] = useState("");

  const markaSecenekleri = [...new Set(etkinlikler.map((e) => e.markaAd))].sort();

  const filtreli = etkinlikler.filter((e) => {
    if (gunFiltre && e.ts.slice(0, 10) !== gunFiltre) return false;
    if (markaFiltre && e.markaAd !== markaFiltre) return false;
    if (tipFiltre && e.tip !== tipFiltre) return false;
    return true;
  });

  const gruplar = (() => {
    const g = {};
    [...filtreli].sort((a, b) => new Date(b.ts) - new Date(a.ts)).forEach((e) => {
      const gun = e.ts.slice(0, 10);
      if (!g[gun]) g[gun] = [];
      g[gun].push(e);
    });
    return Object.entries(g).sort((a, b) => (a[0] < b[0] ? 1 : -1));
  })();

  const filtreVar = gunFiltre || markaFiltre || tipFiltre;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-base font-medium">İşlem geçmişi</h2>
        <div className="flex items-center gap-1.5 flex-wrap">
          <input type="date" value={gunFiltre} onChange={(e) => setGunFiltre(e.target.value)} className="text-xs border border-stone-200 rounded-lg px-2 py-1.5" />
          <select value={markaFiltre} onChange={(e) => setMarkaFiltre(e.target.value)} className="text-xs border border-stone-200 rounded-lg px-2 py-1.5 bg-white">
            <option value="">Tüm markalar</option>
            {markaSecenekleri.map((m) => (<option key={m} value={m}>{m}</option>))}
          </select>
          <select value={tipFiltre} onChange={(e) => setTipFiltre(e.target.value)} className="text-xs border border-stone-200 rounded-lg px-2 py-1.5 bg-white">
            <option value="">Tüm işlemler</option>
            {Object.entries(ETKINLIK_ETIKET).map(([tip, e]) => (<option key={tip} value={tip}>{e.label}</option>))}
          </select>
          {filtreVar && (
            <button onClick={() => { setGunFiltre(""); setMarkaFiltre(""); setTipFiltre(""); }} className="text-xs text-stone-400 hover:text-stone-600 px-1">Temizle</button>
          )}
        </div>
      </div>

      {gruplar.length === 0 && (
        <div className="rounded-lg border border-dashed border-stone-300 p-12 text-center text-stone-400 text-sm">
          {filtreVar ? "Bu filtreye uyan kayıt yok" : "Henüz bir işlem geçmişi yok"}
        </div>
      )}

      {gruplar.map(([gun, olaylar]) => (
        <div key={gun}>
          <p className="text-xs font-medium text-stone-500 mb-2">{fmtTarih(gun)}</p>
          <div className="rounded-lg border border-stone-200 bg-white divide-y divide-stone-50">
            {olaylar.map((e) => {
              const etiket = ETKINLIK_ETIKET[e.tip] || { label: e.tip, renk: "text-stone-600 bg-stone-100" };
              return (
                <button key={e.id} onClick={() => onMarkaTikla(e.markaId)} className="w-full text-left px-4 py-2.5 hover:bg-stone-50 flex items-start gap-3">
                  <span className="text-xs text-stone-400 font-mono shrink-0 w-12 pt-0.5">{new Date(e.ts).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium">{e.markaAd}</span>
                      <span className={`text-[11px] px-1.5 py-0.5 rounded ${etiket.renk}`}>{etiket.label}</span>
                    </div>
                    <p className="text-xs text-stone-500 mt-0.5">{e.detay}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function ImportPage({ markalar, aktarimUygula }) {
  const [satirlar, setSatirlar] = useState([]); // ham okunan satırlar
  const [markaEslesme, setMarkaEslesme] = useState({}); // markaRaw -> markaId | 'yoksay'  (SADECE tam eşleşmesi olmayan kodlar için)
  const [dosyaAdi, setDosyaAdi] = useState("");
  const [hata, setHata] = useState("");
  const [uygulandi, setUygulandi] = useState(null);

  async function dosyaSecildi(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setHata(""); setUygulandi(null);
    try {
      const okunan = await aybelsoftDosyasiniOku(file);
      if (okunan.length === 0) { setHata("Dosyada okunabilir satır bulunamadı. Ne sabit sütun konumlarıyla (Aybelsoft'un standart raporu) ne de başlık isimleriyle bir eşleşme bulamadık. Dosyanın ilk sayfasında satış satırları olduğundan emin olun."); return; }
      setSatirlar(okunan);
      setDosyaAdi(file.name);
      // Sadece TAM eşleşmesi olmayan (typo şüpheli) kodlar için öneri hazırla — tam eşleşenler
      // her satırda kendi tarihine göre otomatik çözülecek, kullanıcıya sorulmayacak.
      const oneriler = {};
      const benzersizler = [...new Set(okunan.map((r) => r.markaRaw))];
      benzersizler.forEach((raw) => {
        const tamEslesen = markalar.some((m) => normalizeKod(m.marka) === normalizeKod(raw));
        if (tamEslesen) return;
        const { best, mesafe } = enIyiMarkaEslesme(raw, markalar);
        oneriler[raw] = best && mesafe <= 2 ? best.id : "";
      });
      setMarkaEslesme(oneriler);
    } catch (err) {
      setHata("Dosya okunamadı. .xlsx formatında olduğundan emin olun.");
    }
  }

  // Sadece belirsiz (tam eşleşmeyen) kodlar İncelenecek listede görünür — tam eşleşenler otomatik geçer.
  const belirsizMarkalar = [...new Set(satirlar.map((r) => r.markaRaw))]
    .filter((raw) => !markalar.some((m) => normalizeKod(m.marka) === normalizeKod(raw)))
    .map((raw) => {
      const { best, mesafe } = enIyiMarkaEslesme(raw, markalar);
      const satirSayisi = satirlar.filter((r) => r.markaRaw === raw).length;
      return { raw, best, mesafe, satirSayisi };
    });
  const tamEslesenKodlar = [...new Set(satirlar.map((r) => r.markaRaw))].filter((raw) => markalar.some((m) => normalizeKod(m.marka) === normalizeKod(raw)));

  const hepsiCozuldu = belirsizMarkalar.every((b) => markaEslesme[b.raw] !== undefined && markaEslesme[b.raw] !== "");

  function ozetOlustur() {
    const grup = {};
    const urunEslesmedi = [];
    let birimDuzeltmeSayisi = 0;
    let coklaAdaydanAyristirilan = 0;
    satirlar.forEach((r) => {
      if (r.birimDuzeltildi) birimDuzeltmeSayisi += 1;

      // 1) Tam eşleşen kod var mı? Varsa, satırın TARİHİNE göre doğru aday(lar)ı bul ve
      //    ürün adı/koduyla otomatik ayrıştır — kullanıcıya hiç sorulmadan.
      const adaylar = ayniKodAdaylari(r.markaRaw, r.tarih, markalar);
      let hedefMarka, hedefUrun;
      if (adaylar.length > 0) {
        if (adaylar.length > 1) coklaAdaydanAyristirilan += 1;
        const sonuc = enIyiUrunEslesmeCoklu(r.urunRaw, r.urunKoduRaw, adaylar);
        if (!sonuc || sonuc.mesafe > 3) { urunEslesmedi.push(r); return; }
        hedefMarka = sonuc.marka; hedefUrun = sonuc.urun;
      } else {
        // 2) Tam eşleşme yoksa kullanıcının elle çözdüğü (typo) eşleştirmeyi kullan
        const hedefMarkaId = markaEslesme[r.markaRaw];
        if (!hedefMarkaId || hedefMarkaId === "yoksay") return;
        const marka = markalar.find((m) => m.id === hedefMarkaId);
        if (!marka) return;
        const { best: urun, mesafe } = enIyiUrunEslesme(r.urunRaw, marka.urunler, r.urunKoduRaw);
        if (!urun || mesafe > 3) { urunEslesmedi.push(r); return; }
        hedefMarka = marka; hedefUrun = urun;
      }

      const key = `${hedefMarka.id}|${hedefUrun.id}|${r.tarih}`;
      if (!grup[key]) grup[key] = { markaId: hedefMarka.id, urunId: hedefUrun.id, tarih: r.tarih, satisAdet: 0, satisKg: 0, kayitSayisi: 0 };
      grup[key].satisAdet += r.satisAdet;
      grup[key].satisKg += r.satisKg;
      grup[key].kayitSayisi += 1;
    });
    return { havuzKayitlari: Object.values(grup), urunEslesmedi, birimDuzeltmeSayisi, coklaAdaydanAyristirilan };
  }

  const { havuzKayitlari, urunEslesmedi, birimDuzeltmeSayisi, coklaAdaydanAyristirilan } = hepsiCozuldu ? ozetOlustur() : { havuzKayitlari: [], urunEslesmedi: [], birimDuzeltmeSayisi: 0, coklaAdaydanAyristirilan: 0 };
  const toplamBirimDuzeltme = satirlar.filter((r) => r.birimDuzeltildi).length;

  function uygula() {
    const markaSayisi = new Set(havuzKayitlari.map((h) => h.markaId)).size;
    const sonuc = aktarimUygula(havuzKayitlari, satirlar.length, markaSayisi);
    setUygulandi({ ...sonuc, birimDuzeltmeSayisi });
    setSatirlar([]); setMarkaEslesme({}); setDosyaAdi("");
  }

  return (
    <div className="space-y-5 max-w-3xl">
      <div>
        <h2 className="text-base font-medium">Aybelsoft verisi içe aktar</h2>
        <p className="text-sm text-stone-500 mt-0.5">Aybelsoft'tan alınan satış Excel'ini yükleyin. Marka kodu elle yazıldığı için yazım hataları olabiliyor — sistem bunları tek tek size gösterip onayınızı istiyor, hiçbirini sessizce varsaymıyor.</p>
      </div>

      {satirlar.length === 0 && (
        <label className="flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-stone-300 bg-white p-10 text-center cursor-pointer hover:border-amber-400">
          <Upload className="w-6 h-6 text-stone-400" />
          <span className="text-sm text-stone-600 font-medium">Excel dosyası seçin (.xlsx)</span>
          <span className="text-xs text-stone-400">Sütunlarda "Tarih", "Marka", "Ürün", "Adet", "Kg" geçen başlıklar aranıyor</span>
          <input type="file" accept=".xlsx,.xls" onChange={dosyaSecildi} className="hidden" />
        </label>
      )}

      {hata && <div className="rounded-lg border border-red-200 bg-red-50 text-red-700 text-sm p-3">{hata}</div>}

      {uygulandi && (
        <div className={`rounded-lg border text-sm p-3 flex items-center gap-2 ${uygulandi.uyari > 0 ? "border-red-200 bg-red-50 text-red-700" : "border-emerald-200 bg-emerald-50 text-emerald-800"}`}>
          {uygulandi.uyari > 0 ? <AlertTriangle className="w-4 h-4 shrink-0" /> : <CheckCircle2 className="w-4 h-4 shrink-0" />}
          Aktarıldı: {uygulandi.kayit} satır işlendi, {uygulandi.marka} marka eşleştirildi{uygulandi.birimDuzeltmeSayisi > 0 ? `, ${uygulandi.birimDuzeltmeSayisi} satırda kilo birimi düzeltildi` : ""}.
          {uygulandi.uyari > 0 ? ` Ancak ${uygulandi.uyari} tutarsızlık tespit edildi — ilgili markaların detay sayfasında "Anomali notları" bölümünde görünüyor.` : ` Artık ilgili markanın detay sayfasında satış hücrelerinin yanında "Aybelsoft'tan doldur" önerisini göreceksiniz.`}
        </div>
      )}

      {satirlar.length > 0 && (
        <>
          <div className="text-xs text-stone-500">
            {dosyaAdi} — {satirlar.length} satır okundu.
            {tamEslesenKodlar.length > 0 && <span className="text-emerald-700"> {tamEslesenKodlar.length} marka kodu tam eşleşti, otomatik işlenecek.</span>}
            {belirsizMarkalar.length > 0 && <span className="text-amber-700"> {belirsizMarkalar.length} kod eşleşmedi, aşağıda kontrolünüzü bekliyor.</span>}
            {coklaAdaydanAyristirilan > 0 && <span className="text-purple-700"> {coklaAdaydanAyristirilan} satırda aynı kodu paylaşan birden fazla marka (ör. Patates+Soğan çifti) ürün adına bakılarak otomatik ayrıştırıldı.</span>}
            {toplamBirimDuzeltme > 0 && <span className="text-purple-700"> {toplamBirimDuzeltme} satırda kilo değeri bin kat düşük görünüyordu, otomatik düzeltildi.</span>}
          </div>

          {belirsizMarkalar.length === 0 ? (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-800 text-sm p-3 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" /> Tüm marka kodları otomatik eşleşti, elle kontrol gerekmiyor.
            </div>
          ) : (
            <div className="rounded-lg border border-stone-200 bg-white divide-y divide-stone-100">
              {belirsizMarkalar.map((b) => {
                const secim = markaEslesme[b.raw] ?? "";
                const oneriliVarMi = b.best && b.mesafe > 0 && b.mesafe <= 2;
                return (
                  <div key={b.raw} className="p-3.5 flex items-center gap-3 flex-wrap">
                    <div className="min-w-[120px]">
                      <div className="text-sm font-mono font-medium">{b.raw}</div>
                      <div className="text-xs text-stone-400">{b.satirSayisi} satır</div>
                    </div>
                    {oneriliVarMi ? (
                      <span className="text-xs px-2 py-1 rounded bg-amber-50 text-amber-700 flex items-center gap-1"><Wand2 className="w-3.5 h-3.5" /> Olası typo — öneri: {b.best.marka} · {b.best.urun}</span>
                    ) : (
                      <span className="text-xs px-2 py-1 rounded bg-red-50 text-red-700 flex items-center gap-1"><AlertTriangle className="w-3.5 h-3.5" /> Eşleşme yok</span>
                    )}
                    <select value={secim} onChange={(e) => setMarkaEslesme({ ...markaEslesme, [b.raw]: e.target.value })} className="text-sm border border-stone-200 rounded px-2 py-1.5 ml-auto bg-white">
                      <option value="">Seçiniz…</option>
                      {markalar.map((m) => (<option key={m.id} value={m.id}>{m.marka} · {m.urun}</option>))}
                      <option value="yoksay">— Yok say —</option>
                    </select>
                  </div>
                );
              })}
            </div>
          )}

          {!hepsiCozuldu && <p className="text-xs text-amber-700">Devam etmeden önce yukarıdaki her kod için bir seçim yapın (eşleştir ya da "yok say").</p>}

          {hepsiCozuldu && (
            <div className="rounded-lg border border-stone-200 bg-white p-4">
              <p className="text-sm font-medium mb-2.5">Aktarılacak özet</p>
              {havuzKayitlari.length === 0 ? (
                <p className="text-sm text-stone-400">Eşleştirilen satır kalmadı.</p>
              ) : (
                <table className="w-full text-sm font-mono text-[13px]">
                  <thead><tr className="text-xs text-stone-500 font-sans"><th className="text-left font-normal py-1.5">Marka</th><th className="text-left font-normal py-1.5">Ürün</th><th className="text-left font-normal py-1.5">Tarih</th><th className="text-right font-normal py-1.5">Adet</th><th className="text-right font-normal py-1.5">Kg</th></tr></thead>
                  <tbody>
                    {havuzKayitlari.map((k, i) => {
                      const m = markalar.find((x) => x.id === k.markaId);
                      const u = m?.urunler.find((x) => x.id === k.urunId);
                      return (
                        <tr key={i} className="border-t border-stone-50">
                          <td className="py-1.5 font-sans">{m?.marka}</td>
                          <td className="py-1.5 font-sans">{u?.ad}</td>
                          <td className="py-1.5">{fmtTarih(k.tarih)}</td>
                          <td className="py-1.5 text-right">{fmt(k.satisAdet)}</td>
                          <td className="py-1.5 text-right">{fmt(k.satisKg)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
              {urunEslesmedi.length > 0 && (
                <p className="text-xs text-amber-700 mt-3">{urunEslesmedi.length} satırda ürün adı hiçbir ürünle eşleşmedi, bunlar aktarılmayacak (ürün adları çok farklıysa marka içindeki ürün listesini kontrol edin).</p>
              )}
              <button onClick={uygula} disabled={havuzKayitlari.length === 0} className="w-full text-sm bg-stone-900 text-white rounded-lg py-2 mt-3 hover:bg-stone-800 font-medium disabled:opacity-40">İçe aktarımı uygula</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function DegisiklikGecmisi({ kayitlar }) {
  const [acik, setAcik] = useState(false);
  return (
    <div className="border-t border-stone-100 px-4 py-2">
      <button onClick={() => setAcik((v) => !v)} className="text-xs text-amber-700 flex items-center gap-1">
        <ChevronRight className={`w-3.5 h-3.5 transition-transform ${acik ? "rotate-90" : ""}`} />
        Değişiklik geçmişi ({kayitlar.length})
      </button>
      {acik && (
        <ul className="mt-2 space-y-1.5">
          {[...kayitlar].reverse().map((k, i) => (
            <li key={i} className="text-xs text-red-700 font-mono bg-red-50 rounded px-2 py-1">{k.ts} — <span className="font-sans text-red-800 font-medium">{k.urunAd} / {k.alan}</span>: {k.eski} → {k.yeni}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

function DetayPage({ marka, sayimlarListesi, notlar, satirGuncelle, sayimAlanGuncelle, sayimKilitleAc, havuz, disUyarilar, onGeri, onSil, onDurumDegistir, onYeniSayim, muhasebeAcik, setMuhasebeAcik, markaBasligiGuncelle }) {
  const [baslikDuzenle, setBaslikDuzenle] = useState(false);
  const [baslikTaslak, setBaslikTaslak] = useState(null);
  const [seciliSayimId, setSeciliSayimId] = useState(null);

  useEffect(() => { setSeciliSayimId(null); setBaslikDuzenle(false); }, [marka.id]);

  const siraliSayimlar = [...sayimlarListesi].sort((a, b) => (a.tarih < b.tarih ? 1 : a.tarih > b.tarih ? -1 : b.sayimNo - a.sayimNo));
  const seciliSayim = sayimlarListesi.find((s) => s.id === seciliSayimId) || siraliSayimlar[0] || null;
  const enYeniMi = seciliSayim && siraliSayimlar[0] && seciliSayim.id === siraliSayimlar[0].id;
  const ozet = seciliSayim ? sayimOzet(seciliSayim, marka) : null;

  const satirToplamlari = seciliSayim
    ? marka.urunler.reduce(
        (acc, u) => {
          const satir = seciliSayim.satirlar.find((s) => s.urunId === u.id);
          if (!satir) return acc;
          const h = satirHesap(satir);
          acc.sayimAdet += h.sayimAdet; acc.sayimKg += h.sayimKg; acc.satisAdet += h.satisAdet; acc.satisKg += h.satisKg;
          acc.kalanAdet += h.kalanAdet; acc.kalanKg += h.kalanKg; acc.toplamKg += h.toplamKg;
          return acc;
        },
        { sayimAdet: 0, sayimKg: 0, satisAdet: 0, satisKg: 0, kalanAdet: 0, kalanKg: 0, toplamKg: 0 }
      )
    : null;

  function baslikDuzenlemeyeBasla() {
    setBaslikTaslak({ tarih: marka.tarih, marka: marka.marka, plaka: marka.plaka || "", toplamYuklemeKg: marka.toplamYuklemeKg });
    setBaslikDuzenle(true);
  }
  function baslikKaydet() {
    markaBasligiGuncelle(marka.id, baslikTaslak);
    setBaslikDuzenle(false);
  }

  return (
    <div className="space-y-5">
      <button onClick={onGeri} className="text-xs text-stone-500 hover:text-stone-700 flex items-center gap-1">
        <ChevronLeft className="w-3.5 h-3.5" /> Geri
      </button>

      {baslikDuzenle ? (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 space-y-2.5">
          <p className="text-xs text-amber-700 font-medium">Marka bilgilerini düzenliyorsunuz — kaydettiğinizde işlem geçmişine düşecek.</p>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-stone-500 block mb-1">Tarih</label>
              <input type="date" value={baslikTaslak.tarih} onChange={(e) => setBaslikTaslak({ ...baslikTaslak, tarih: e.target.value })} className="w-full text-sm border border-stone-200 rounded px-2 py-1.5" />
            </div>
            <div>
              <label className="text-xs text-stone-500 block mb-1">Marka kodu</label>
              <input value={baslikTaslak.marka} onChange={(e) => setBaslikTaslak({ ...baslikTaslak, marka: e.target.value })} className="w-full text-sm border border-stone-200 rounded px-2 py-1.5" />
            </div>
            <div>
              <label className="text-xs text-stone-500 block mb-1">Plaka</label>
              <input value={baslikTaslak.plaka} onChange={(e) => setBaslikTaslak({ ...baslikTaslak, plaka: e.target.value })} className="w-full text-sm border border-stone-200 rounded px-2 py-1.5" />
            </div>
            <div>
              <label className="text-xs text-stone-500 block mb-1">Toplam yükleme kg</label>
              <input type="number" value={baslikTaslak.toplamYuklemeKg} onChange={(e) => setBaslikTaslak({ ...baslikTaslak, toplamYuklemeKg: e.target.value })} className="w-full text-sm border border-stone-200 rounded px-2 py-1.5" />
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={baslikKaydet} className="text-sm bg-stone-900 text-white rounded-lg px-3 py-1.5 hover:bg-stone-800 font-medium">Kaydet</button>
            <button onClick={() => setBaslikDuzenle(false)} className="text-sm text-stone-500 px-3 py-1.5">Vazgeç</button>
          </div>
        </div>
      ) : (
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-medium">{marka.marka} · {marka.urun}</h2>
              <button onClick={baslikDuzenlemeyeBasla} className="text-stone-400 hover:text-amber-700 p-1" title="Marka bilgilerini düzenle"><Pencil className="w-3.5 h-3.5" /></button>
            </div>
            <p className="text-sm text-stone-500">{fmtTarih(marka.tarih)}{marka.plaka ? ` · ${marka.plaka}` : ""} · Yükleme: {fmt(marka.toplamYuklemeKg)} kg</p>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={onDurumDegistir} className={`text-xs font-medium rounded-lg px-2.5 py-1.5 border ${marka.durum === "tamamlandı" ? "border-stone-300 text-stone-500 hover:bg-stone-50" : "border-emerald-300 text-emerald-700 hover:bg-emerald-50"}`}>
              {marka.durum === "tamamlandı" ? "Yeniden aç" : "İşlemi tamamla"}
            </button>
            <button onClick={onSil} className="text-stone-400 hover:text-red-600 p-1.5"><Trash2 className="w-4 h-4" /></button>
          </div>
        </div>
      )}

      <div className="flex items-center gap-2 flex-wrap">
        <button onClick={onYeniSayim} className="flex items-center gap-1.5 text-sm font-medium bg-stone-900 text-white rounded-lg px-3 py-2 hover:bg-stone-800">
          <Plus className="w-4 h-4" /> Yeni sayım gir
        </button>
        {siraliSayimlar.length > 1 && (
          <select value={seciliSayim?.id || ""} onChange={(e) => setSeciliSayimId(e.target.value)} className="text-sm border border-stone-200 rounded-lg px-2 py-2 bg-white">
            {siraliSayimlar.map((s) => (
              <option key={s.id} value={s.id}>{s.sayimNo}. sayım — {fmtTarih(s.tarih)}{s.id === siraliSayimlar[0].id ? " (en son)" : ""}</option>
            ))}
          </select>
        )}
        {!enYeniMi && <span className="text-xs text-stone-400 flex items-center gap-1"><History className="w-3.5 h-3.5" /> Geçmiş bir sayımı görüntülüyorsunuz</span>}
      </div>

      {seciliSayim && ozet && (
        <div className="rounded-lg border border-stone-200 bg-white overflow-hidden">
          <div className="px-4 py-2.5 border-b border-stone-100 flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2.5">
              <span className="text-sm font-medium">{seciliSayim.sayimNo}. sayım</span>
              <input type="date" disabled={seciliSayim.kilitli} value={seciliSayim.tarih} onChange={(e) => sayimAlanGuncelle(seciliSayim.id, "tarih", e.target.value)} className="text-xs border border-stone-200 rounded px-1.5 py-1 disabled:bg-stone-50 disabled:text-stone-400" />
              {seciliSayim.kilitli ? (
                <button onClick={() => sayimKilitleAc(seciliSayim.id, false)} className="text-xs text-stone-500 border border-stone-200 rounded px-2 py-0.5 hover:bg-stone-50">Düzenle</button>
              ) : (
                <button onClick={() => sayimKilitleAc(seciliSayim.id, true)} className="text-xs text-white bg-stone-900 rounded px-2 py-0.5 hover:bg-stone-800">Kaydet</button>
              )}
              <button onClick={() => setMuhasebeAcik((v) => !v)} className="text-xs text-stone-400 hover:text-stone-600">{muhasebeAcik ? "Muhasebe sütunlarını gizle" : "Muhasebe sütunlarını göster"}</button>
            </div>
            <span className={`text-xl font-mono font-bold ${Math.abs(ozet.fark) > esikDegeri(marka) ? "text-red-600" : "text-emerald-700"}`}>FARK: {ozet.fark > 0 ? "+" : ""}{fmt(ozet.fark)} kg</span>
          </div>
          {seciliSayim.kilitli && <div className="px-4 py-1.5 bg-stone-50 text-xs text-stone-500 border-b border-stone-100">Bu sayım kaydedildi, satış/muhasebe alanları kilitli. Değiştirmek için "Düzenle"ye basın.</div>}
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-stone-500 border-b border-stone-100">
                <th className="text-left font-normal py-2 px-3">Ürün</th>
                <th className="text-right font-normal py-2 px-3 text-emerald-700 bg-emerald-50/60">Yükleme adet</th>
                {muhasebeAcik && (<><th className="text-right font-normal py-2 px-3 text-stone-500 bg-stone-50">Muhasebe Sayım Adet</th><th className="text-right font-normal py-2 px-3 text-stone-500 bg-stone-50">Muhasebe Sayım Kg</th><th className="text-right font-normal py-2 px-3 text-stone-500 bg-stone-50">Muhasebe Ort kg/adet</th></>)}
                <th className="text-right font-normal py-2 px-3 text-blue-700 bg-blue-50/60">Satış adet</th>
                <th className="text-right font-normal py-2 px-3 text-blue-700 bg-blue-50/60">Satış kg</th>
                <th className="text-right font-normal py-2 px-3 text-amber-700 bg-amber-50/60">Kalan adet</th>
                <th className="text-right font-normal py-2 px-3">Ort kg/adet</th>
                <th className="text-right font-normal py-2 px-3 bg-stone-50">Toplam adet</th>
                <th className="text-right font-normal py-2 px-3 bg-stone-50">Toplam kg</th>
              </tr>
            </thead>
            <tbody className="font-mono text-[13px]">
              {marka.urunler.map((u) => {
                const satir = seciliSayim.satirlar.find((s) => s.urunId === u.id);
                if (!satir) return null;
                const h = satirHesap(satir);
                const dusukOrneklem = h.satisAdet > 0 && h.satisAdet < 50;
                const kilit = seciliSayim.kilitli;
                const havuzKaydi = (havuz || []).filter((hv) => hv.urunId === u.id).sort((a, b) => (a.tarih === seciliSayim.tarih ? -1 : b.tarih === seciliSayim.tarih ? 1 : (a.tarih < b.tarih ? 1 : -1)))[0];
                return (
                  <tr key={u.id} className="border-b border-stone-50 last:border-0">
                    <td className="py-1.5 px-3 font-sans font-medium">{u.ad}</td>
                    <td className="py-1.5 px-3 text-right bg-emerald-50/40 text-emerald-800 font-semibold">{fmt(u.yuklemeAdet)}</td>
                    {muhasebeAcik && (
                      <>
                        <td className="py-1.5 px-3 text-right bg-stone-50/60"><input disabled={kilit} type="number" value={satir.sayimAdet} onChange={(e) => satirGuncelle(seciliSayim.id, u.id, "sayimAdet", e.target.value)} className="w-16 text-right border border-stone-200 rounded px-1.5 py-0.5 bg-white font-medium disabled:bg-stone-50 disabled:text-stone-700" /></td>
                        <td className="py-1.5 px-3 text-right bg-stone-50/60"><input disabled={kilit} type="number" value={satir.sayimKg} onChange={(e) => satirGuncelle(seciliSayim.id, u.id, "sayimKg", e.target.value)} className="w-20 text-right border border-stone-200 rounded px-1.5 py-0.5 bg-white font-medium disabled:bg-stone-50 disabled:text-stone-700" /></td>
                        <td className="py-1.5 px-3 text-right text-stone-600 bg-stone-50/60 font-medium">{fmtKg(h.muhasebeOrtKg)}</td>
                      </>
                    )}
                    <td className="py-1.5 px-3 text-right bg-blue-50/30">
                      <input disabled={kilit} type="number" value={satir.satisAdet} onChange={(e) => satirGuncelle(seciliSayim.id, u.id, "satisAdet", e.target.value)} className="w-16 text-right border border-stone-200 rounded px-1.5 py-0.5 font-semibold disabled:bg-stone-50 disabled:text-stone-800" />
                    </td>
                    <td className="py-1.5 px-3 text-right bg-blue-50/30">
                      <input disabled={kilit} type="number" value={satir.satisKg} onChange={(e) => satirGuncelle(seciliSayim.id, u.id, "satisKg", e.target.value)} className="w-20 text-right border border-stone-200 rounded px-1.5 py-0.5 font-semibold disabled:bg-stone-50 disabled:text-stone-800" />
                      {havuzKaydi && !kilit && (
                        <button
                          onClick={() => { satirGuncelle(seciliSayim.id, u.id, "satisAdet", String(havuzKaydi.satisAdet)); satirGuncelle(seciliSayim.id, u.id, "satisKg", String(havuzKaydi.satisKg)); }}
                          className="block ml-auto mt-1 text-[10px] text-purple-700 bg-purple-50 rounded px-1.5 py-0.5 hover:bg-purple-100 font-sans"
                        >
                          Aybelsoft: {fmt(havuzKaydi.satisAdet)}/{fmt(havuzKaydi.satisKg)} — doldur
                        </button>
                      )}
                    </td>
                    <td className="py-1.5 px-3 text-right bg-amber-50/30 text-amber-900 font-semibold">{h.kalanAdet}</td>
                    <td className="py-1.5 px-3 text-right">
                      {dusukOrneklem ? (
                        <input type="number" step="0.01" placeholder={fmtKg(h.ortKgHesap)} value={satir.ortKgManuel} onChange={(e) => satirGuncelle(seciliSayim.id, u.id, "ortKgManuel", e.target.value)} className="w-16 text-right border border-red-300 bg-red-50 rounded px-1.5 py-0.5 font-medium" title="Satış adedi az, isterseniz ortalama kiloyu elle düzeltin" />
                      ) : (
                        <span className={h.manuelVar ? "text-red-700 font-semibold" : "text-stone-700 font-medium"}>{fmtKg(h.ortKg)}</span>
                      )}
                    </td>
                    <td className="py-1.5 px-3 text-right bg-stone-50 font-semibold text-stone-800">{fmt(h.satisAdet + h.kalanAdet)}</td>
                    <td className="py-1.5 px-3 text-right bg-stone-50 font-semibold text-stone-800">{fmt(h.toplamKg)}</td>
                  </tr>
                );
              })}
            </tbody>
            {satirToplamlari && (
              <tfoot>
                <tr className="border-t-2 border-stone-300 font-semibold text-[13px]">
                  <td className="py-2 px-3 font-sans">TOPLAM</td>
                  <td className="py-2 px-3 text-right bg-emerald-50/60 text-emerald-800">{fmt(marka.urunler.reduce((a, u) => a + (Number(u.yuklemeAdet) || 0), 0))}</td>
                  {muhasebeAcik && (<><td className="py-2 px-3 text-right">{fmt(satirToplamlari.sayimAdet)}</td><td className="py-2 px-3 text-right">{fmt(satirToplamlari.sayimKg)}</td><td className="py-2 px-3 text-right text-stone-500">{satirToplamlari.sayimAdet > 0 ? fmtKg(satirToplamlari.sayimKg / satirToplamlari.sayimAdet) : "-"}</td></>)}
                  <td className="py-2 px-3 text-right">{fmt(satirToplamlari.satisAdet)}</td>
                  <td className="py-2 px-3 text-right">{fmt(satirToplamlari.satisKg)}</td>
                  <td className="py-2 px-3 text-right">{fmt(satirToplamlari.kalanAdet)}</td>
                  <td className="py-2 px-3 text-right text-stone-500">{satirToplamlari.kalanAdet > 0 ? fmtKg(satirToplamlari.kalanKg / satirToplamlari.kalanAdet) : "-"}</td>
                  <td className="py-2 px-3 text-right bg-stone-100">{fmt(satirToplamlari.satisAdet + satirToplamlari.kalanAdet)}</td>
                  <td className="py-2 px-3 text-right bg-stone-100">{fmt(satirToplamlari.toplamKg)}</td>
                </tr>
              </tfoot>
            )}
          </table>
          <div className="px-4 py-2.5 border-t border-stone-200 bg-emerald-50/50 flex items-center justify-between">
            <span className="text-sm font-medium text-emerald-800">Toplam Yükleme Kg</span>
            <span className="text-base font-mono font-bold text-emerald-800">{fmt(marka.toplamYuklemeKg)} kg</span>
          </div>
          <div className="px-4 py-2 text-xs text-stone-500 border-t border-stone-100">Kalan adet (turuncu sütun) sadece "Dükkanda Kalan" sayfasından girilir, burada salt görüntülenir. Satış adedi 50'nin altındaysa ortalama kg elle düzeltilebilir (kırmızı kutu).</div>
          {seciliSayim.degisiklikGecmisi?.length > 0 && <DegisiklikGecmisi kayitlar={seciliSayim.degisiklikGecmisi} />}
        </div>
      )}

      <div className="rounded-lg border border-stone-200 bg-white p-4">
        <p className="text-sm font-medium mb-2.5">Anomali notları</p>
        {notlar.length === 0 && (!disUyarilar || disUyarilar.length === 0) ? (
          <div className="flex items-center gap-2 text-sm text-emerald-700"><CheckCircle2 className="w-4 h-4" /> Şu ana kadar dikkat çekici bir sapma yok</div>
        ) : (
          <ul className="space-y-2">
            {(disUyarilar || []).map((u) => (
              <li key={u.id} className={`flex items-start gap-2 text-sm p-2 rounded ${u.tip === "kapali_hareket" ? "bg-red-50 text-red-800" : "bg-amber-50 text-amber-800"}`}>
                <AlertTriangle className={`w-4 h-4 shrink-0 mt-0.5 ${u.tip === "kapali_hareket" ? "text-red-600" : "text-amber-600"}`} />
                <span>{u.tip === "kapali_hareket" && <span className="font-medium">Kapanmış markada hareket — </span>}{u.mesaj}</span>
              </li>
            ))}
            {notlar.map((n, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-stone-700"><AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />{n.mesaj}</li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
function DukkandaKalanPage({ markalar, sayimlar, etkinlikler, kalanTopluKaydet }) {
  const [tarih, setTarih] = useState(new Date().toISOString().slice(0, 10));
  const [secilenler, setSecilenler] = useState([]); // marka id listesi
  const [degerler, setDegerler] = useState({}); // { markaId: { urunId: kalanAdet } }
  const [arama, setArama] = useState("");
  const [gecmisAcik, setGecmisAcik] = useState(false);
  const [kaydedildi, setKaydedildi] = useState(false);

  const aktifMarkalar = markalar.filter((m) => m.durum !== "tamamlandı");

  // "Son gelenler": etkinlik geçmişine değil, doğrudan markanın GELİŞ TARİHİNE göre en yeni 10 tanesi —
  // hep güncel kalsın diye (aktif liste geliş tarihi değiştikçe kendiliğinden değişir).
  const sonGelenler = [...aktifMarkalar].sort((a, b) => (b.tarih || "").localeCompare(a.tarih || "")).slice(0, 10);

  const aramaSonuclari = arama.trim()
    ? aktifMarkalar.filter((m) => `${m.marka} ${m.urun}`.toLocaleUpperCase("tr").includes(arama.toLocaleUpperCase("tr"))).slice(0, 15)
    : [];

  function degerleriDoldur(m, secilenTarih) {
    const buGuninSayimi = sayimlar.filter((s) => s.markaId === m.id && s.tarih === secilenTarih).sort((a, b) => b.sayimNo - a.sayimNo)[0];
    const baslangic = {};
    (m?.urunler || []).forEach((u) => {
      const satir = buGuninSayimi?.satirlar.find((s) => s.urunId === u.id);
      baslangic[u.id] = buGuninSayimi ? (satir?.kalanAdet || "0") : "0";
    });
    setDegerler((prev) => ({ ...prev, [m.id]: baslangic }));
  }

  function markaEkle(m) {
    if (!secilenler.includes(m.id)) {
      setSecilenler((prev) => [...prev, m.id]);
      degerleriDoldur(m, tarih);
    }
    setArama("");
    setKaydedildi(false);
  }
  function markaCikar(id) {
    setSecilenler((prev) => prev.filter((x) => x !== id));
    setKaydedildi(false);
  }
  function tarihDegisti(yeniTarih) {
    setTarih(yeniTarih);
    setKaydedildi(false);
    secilenler.forEach((id) => {
      const m = markalar.find((x) => x.id === id);
      if (m) degerleriDoldur(m, yeniTarih);
    });
  }

  function kaydet() {
    kalanTopluKaydet(secilenler, degerler, tarih);
    setSecilenler([]);
    setDegerler({});
    setKaydedildi(true);
    setTimeout(() => setKaydedildi(false), 3500);
  }

  function gecmisKaydiAc(e) {
    const m = markalar.find((x) => x.id === e.markaId);
    if (!m) return;
    setTarih(e.hedefTarih || e.ts.slice(0, 10));
    setSecilenler([m.id]);
    degerleriDoldur(m, e.hedefTarih || e.ts.slice(0, 10));
    setGecmisAcik(false);
    setKaydedildi(false);
  }

  const sonKalanKayitlari = [...etkinlikler].filter((e) => e.tip === "kalan_girildi").sort((a, b) => new Date(b.ts) - new Date(a.ts)).slice(0, 10);

  return (
    <div className="max-w-2xl space-y-4">
      <div>
        <h2 className="text-base font-medium">Dükkanda Kalan</h2>
        <p className="text-sm text-stone-500 mt-0.5">Gün sonunda, istediğiniz kadar markayı seçip hepsinin kalan adedini tek seferde girin — Kaydet dediğinizde her biri kendi markasına otomatik ayrı ayrı işlenir.</p>
      </div>

      <div className="flex items-center gap-2">
        <label className="text-xs text-stone-500 shrink-0">Tarih</label>
        <input type="date" value={tarih} onChange={(e) => tarihDegisti(e.target.value)} className="text-sm border border-stone-200 rounded-lg px-3 py-2 bg-white" />
      </div>

      <div className="relative">
        <div className="flex items-center border border-stone-200 rounded-lg px-3 py-2 bg-white gap-2">
          <Search className="w-4 h-4 text-stone-400 shrink-0" />
          <input value={arama} onChange={(e) => setArama(e.target.value)} placeholder="Marka ara (ör. A18, T24)…" className="w-full text-sm outline-none" />
        </div>
        {aramaSonuclari.length > 0 && (
          <div className="absolute z-10 w-full mt-1 rounded-lg border border-stone-200 bg-white shadow-sm divide-y divide-stone-50 max-h-64 overflow-auto">
            {aramaSonuclari.map((m) => (
              <button key={m.id} onClick={() => markaEkle(m)} className="w-full text-left px-3 py-2 text-sm hover:bg-stone-50">{m.marka} · {m.urun}</button>
            ))}
          </div>
        )}
      </div>

      {!arama && sonGelenler.length > 0 && (
        <div>
          <p className="text-xs text-stone-400 mb-1.5">Son gelen 10 marka (geliş tarihine göre)</p>
          <div className="flex flex-wrap gap-1.5">
            {sonGelenler.map((m) => (
              <button key={m.id} onClick={() => markaEkle(m)} disabled={secilenler.includes(m.id)} className={`text-xs rounded-full px-3 py-1.5 border ${secilenler.includes(m.id) ? "border-stone-200 bg-stone-100 text-stone-400" : "border-stone-200 hover:border-amber-400 text-stone-700"}`}>
                {m.marka} · {m.urun}
              </button>
            ))}
          </div>
        </div>
      )}

      {secilenler.length > 0 && (
        <div className="space-y-3">
          {secilenler.map((id) => {
            const m = markalar.find((x) => x.id === id);
            if (!m) return null;
            return (
              <div key={id} className="rounded-lg border border-stone-200 bg-white p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{m.marka} · {m.urun}</span>
                  <button onClick={() => markaCikar(id)} className="text-stone-400 hover:text-red-600"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
                {m.urunler.map((u) => (
                  <div key={u.id} className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-sm">{u.ad}</div>
                      <div className="text-xs text-stone-400">Yüklenen: {fmt(u.yuklemeAdet)} adet</div>
                    </div>
                    <Stepper value={degerler[id]?.[u.id] ?? "0"} onChange={(v) => setDegerler((prev) => ({ ...prev, [id]: { ...prev[id], [u.id]: v } }))} />
                  </div>
                ))}
              </div>
            );
          })}
          <button onClick={kaydet} className="w-full text-sm bg-stone-900 text-white rounded-lg py-2.5 hover:bg-stone-800 font-medium">
            {secilenler.length > 1 ? `${secilenler.length} markayı kaydet` : "Kaydet"}
          </button>
          {kaydedildi && <div className="flex items-center gap-1.5 text-sm text-emerald-700"><CheckCircle2 className="w-4 h-4" /> Kaydedildi, her marka kendi işlemine işlendi.</div>}
        </div>
      )}

      <div className="pt-2">
        <button onClick={() => setGecmisAcik((v) => !v)} className="text-xs text-stone-500 hover:text-stone-700 flex items-center gap-1">
          <ChevronRight className={`w-3.5 h-3.5 transition-transform ${gecmisAcik ? "rotate-90" : ""}`} /> Geçmiş kayıtlar (son 10)
        </button>
        {gecmisAcik && (
          <div className="rounded-lg border border-stone-200 bg-white divide-y divide-stone-50 mt-2">
            {sonKalanKayitlari.length === 0 ? (
              <p className="text-sm text-stone-400 p-3">Henüz kayıt yok</p>
            ) : (
              sonKalanKayitlari.map((e) => (
                <button key={e.id} onClick={() => gecmisKaydiAc(e)} className="w-full text-left px-3 py-2.5 hover:bg-stone-50 flex items-center justify-between gap-2">
                  <div>
                    <div className="text-sm font-medium">{e.markaAd}</div>
                    <div className="text-xs text-stone-400">{fmtTarih(e.hedefTarih)} için girildi · {fmtSaat(e.ts)}</div>
                  </div>
                  <span className="text-xs text-amber-700">Aç ve düzenle</span>
                </button>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
export default function StokTakip() {
  const [markalar, setMarkalar] = useState([]);
  const [sayimlar, setSayimlar] = useState([]);
  const [etkinlikler, setEtkinlikler] = useState([]);
  const [havuz, setHavuz] = useState([]); // Aybelsoft'tan içe aktarılan, henüz sayıma uygulanmamış satış verisi
  const [disUyarilar, setDisUyarilar] = useState([]); // Aybelsoft yeniden içe aktarımında yakalanan tutarsızlıklar
  const [sayfa, setSayfa] = useState("ambar"); // ambar | yeni | detay | gecmis | ice-aktar | kalan
  const [selectedId, setSelectedId] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [muhasebeAcik, setMuhasebeAcik] = useState(false);
  const [ornekOnay, setOrnekOnay] = useState(null); // null | 'real' | 'senaryo'
  const [markaForm, setMarkaForm] = useState({
    tarih: "", marka: "", urun: "", plaka: "", toplamYuklemeKg: "",
    secilenUrunler: {}, ozelUrunAdi: "",
  });

  useEffect(() => {
    (async () => {
      let markaVerisiVarMi = false;
      try {
        const m = await window.storage.get("markalar", false);
        if (m) { setMarkalar(JSON.parse(m.value)); markaVerisiVarMi = true; }
      } catch {}
      try {
        const s = await window.storage.get("sayimlar", false);
        if (s) setSayimlar(JSON.parse(s.value));
      } catch {}
      // Hiç kayıtlı veri yoksa (ilk açılış), boş bırakmak yerine gerçek 34 markalık veriyi otomatik yükle.
      if (!markaVerisiVarMi) {
        setMarkalar(SEED_REAL.markalar);
        setSayimlar(SEED_REAL.sayimlar);
      }
      try { const e = await window.storage.get("etkinlikler", false); if (e) setEtkinlikler(JSON.parse(e.value)); } catch {}
      try { const h = await window.storage.get("havuz", false); if (h) setHavuz(JSON.parse(h.value)); } catch {}
      try { const d = await window.storage.get("disUyarilar", false); if (d) setDisUyarilar(JSON.parse(d.value)); } catch {}
      setLoaded(true);
    })();
  }, []);

  useEffect(() => { if (loaded) window.storage.set("markalar", JSON.stringify(markalar), false).catch(() => {}); }, [markalar, loaded]);
  useEffect(() => { if (loaded) window.storage.set("sayimlar", JSON.stringify(sayimlar), false).catch(() => {}); }, [sayimlar, loaded]);
  useEffect(() => { if (loaded) window.storage.set("etkinlikler", JSON.stringify(etkinlikler), false).catch(() => {}); }, [etkinlikler, loaded]);
  useEffect(() => { if (loaded) window.storage.set("havuz", JSON.stringify(havuz), false).catch(() => {}); }, [havuz, loaded]);
  useEffect(() => { if (loaded) window.storage.set("disUyarilar", JSON.stringify(disUyarilar), false).catch(() => {}); }, [disUyarilar, loaded]);

  function logEtkinlik(markaId, markaAd, tip, detay, ekstra) {
    setEtkinlikler((prev) => [...prev, { id: uid(), ts: new Date().toISOString(), markaId, markaAd, tip, detay, ...(ekstra || {}) }]);
  }

  const selectedMarka = markalar.find((m) => m.id === selectedId) || null;
  const selectedSayimlar = sayimlar.filter((s) => s.markaId === selectedId);

  function urunToggle(ad) {
    setMarkaForm((prev) => {
      const yeni = { ...prev.secilenUrunler };
      if (ad in yeni) delete yeni[ad]; else yeni[ad] = "";
      return { ...prev, secilenUrunler: yeni };
    });
  }
  function urunAdetGuncelle(ad, deger) {
    setMarkaForm((prev) => ({ ...prev, secilenUrunler: { ...prev.secilenUrunler, [ad]: deger } }));
  }
  function ozelUrunEkle() {
    const ad = markaForm.ozelUrunAdi.trim();
    if (!ad || ad in markaForm.secilenUrunler) return;
    setMarkaForm((prev) => ({ ...prev, secilenUrunler: { ...prev.secilenUrunler, [ad]: "" }, ozelUrunAdi: "" }));
  }

  function eklemarka() {
    const temizUrunler = Object.entries(markaForm.secilenUrunler).filter(([ad]) => ad.trim()).map(([ad, yuklemeAdet]) => ({ id: uid(), ad, kod: URUN_KOD_TAHMIN[ad] || "", yuklemeAdet }));
    if (!markaForm.tarih || !markaForm.marka || temizUrunler.length === 0) return;
    const yeni = { id: uid(), tarih: markaForm.tarih, marka: markaForm.marka, urun: markaForm.urun, plaka: markaForm.plaka, toplamYuklemeKg: markaForm.toplamYuklemeKg, urunler: temizUrunler, durum: "aktif" };
    setMarkalar((prev) => [...prev, yeni]);
    logEtkinlik(yeni.id, `${yeni.marka} · ${yeni.urun}`, "yeni_islem", "Yeni marka eklendi");
    setMarkaForm({ tarih: "", marka: "", urun: "", plaka: "", toplamYuklemeKg: "", secilenUrunler: {}, ozelUrunAdi: "" });
    setSelectedId(yeni.id);
    setSayfa("detay");
  }

  function yeniSayimEkle(marka, tarihOverride) {
    const oncekiSayimlar = sayimlar.filter((s) => s.markaId === marka.id);
    const sonSayim = [...oncekiSayimlar].sort((a, b) => b.sayimNo - a.sayimNo)[0];
    const satirlar = marka.urunler.map((u) => {
      const oncekiSatir = sonSayim?.satirlar.find((s) => s.urunId === u.id);
      return { urunId: u.id, sayimAdet: "", sayimKg: "", satisAdet: oncekiSatir?.satisAdet ?? "", satisKg: oncekiSatir?.satisKg ?? "", kalanAdet: "", ortKgManuel: "" };
    });
    const yeniNo = (sonSayim?.sayimNo || 0) + 1;
    const yeni = { id: uid(), markaId: marka.id, sayimNo: yeniNo, tarih: tarihOverride || new Date().toISOString().slice(0, 10), kilitli: false, kilitliMiydi: false, degisiklikGecmisi: [], satirlar };
    setSayimlar((prev) => [...prev, yeni]);
    logEtkinlik(marka.id, `${marka.marka} · ${marka.urun}`, "sayim_eklendi", `${yeniNo}. sayım eklendi (${tarihOverride || "bugün"})`);
    return yeni;
  }

  const ALAN_ADLARI = { sayimAdet: "Muhasebe Sayım Adet", sayimKg: "Muhasebe Sayım Kg", satisAdet: "Satış adet", satisKg: "Satış kg", kalanAdet: "Kalan adet", ortKgManuel: "Ort. kg/adet (elle)" };

  function satirGuncelle(sayimId, urunId, alan, deger) {
    setSayimlar((prev) =>
      prev.map((s) => {
        if (s.id !== sayimId) return s;
        const satir = s.satirlar.find((x) => x.urunId === urunId);
        const eski = satir ? satir[alan] : "";
        const urunAd = markalar.find((m) => m.id === s.markaId)?.urunler.find((u) => u.id === urunId)?.ad || "ürün";
        const degisti = s.kilitliMiydi && String(eski) !== String(deger);
        const yeniGecmis = degisti ? [...s.degisiklikGecmisi, { ts: new Date().toLocaleString("tr-TR"), urunAd, alan: ALAN_ADLARI[alan] || alan, eski: eski || "-", yeni: deger || "-" }] : s.degisiklikGecmisi;
        if (degisti) {
          const m = markalar.find((mm) => mm.id === s.markaId);
          logEtkinlik(s.markaId, m ? `${m.marka} · ${m.urun}` : "", "sayim_duzenlendi", `${s.sayimNo}. sayımda "${urunAd}" / ${ALAN_ADLARI[alan] || alan}: ${eski || "-"} → ${deger || "-"}`);
        }
        return { ...s, degisiklikGecmisi: yeniGecmis, satirlar: s.satirlar.map((satir) => (satir.urunId !== urunId ? satir : { ...satir, [alan]: deger })) };
      })
    );
  }

  function sayimAlanGuncelle(sayimId, alan, deger) {
    setSayimlar((prev) =>
      prev.map((s) => {
        if (s.id !== sayimId) return s;
        const eski = s[alan];
        const yeniGecmis = s.kilitliMiydi && String(eski) !== String(deger) ? [...s.degisiklikGecmisi, { ts: new Date().toLocaleString("tr-TR"), urunAd: "(sayım bilgisi)", alan: alan === "tarih" ? "Tarih" : alan, eski: eski || "-", yeni: deger || "-" }] : s.degisiklikGecmisi;
        return { ...s, [alan]: deger, degisiklikGecmisi: yeniGecmis };
      })
    );
  }

  function sayimKilitleAc(sayimId, kilit) {
    setSayimlar((prev) => prev.map((s) => (s.id !== sayimId ? s : { ...s, kilitli: kilit, kilitliMiydi: s.kilitliMiydi || kilit })));
    if (kilit) {
      const s = sayimlar.find((x) => x.id === sayimId);
      const m = s && markalar.find((mm) => mm.id === s.markaId);
      if (s && m) logEtkinlik(m.id, `${m.marka} · ${m.urun}`, "sayim_kaydedildi", `${s.sayimNo}. sayım kaydedildi`);
    }
  }

  function markaDurumDegistir(id) {
    const m = markalar.find((x) => x.id === id);
    const yeniDurum = m.durum === "tamamlandı" ? "aktif" : "tamamlandı";
    setMarkalar((prev) => prev.map((mm) => (mm.id !== id ? mm : { ...mm, durum: yeniDurum })));
    if (m) logEtkinlik(m.id, `${m.marka} · ${m.urun}`, yeniDurum === "tamamlandı" ? "tamamlandi" : "yeniden_acildi", yeniDurum === "tamamlandı" ? "İşlem tamamlandı" : "Yeniden açıldı");
  }

  function markaSil(id) {
    setMarkalar((prev) => prev.filter((m) => m.id !== id));
    setSayimlar((prev) => prev.filter((s) => s.markaId !== id));
    setSayfa("ambar");
    setSelectedId(null);
  }

  // Marka başlık bilgilerini (tarih/marka kodu/plaka/yükleme kg) sonradan düzenleme — yazım hataları için.
  function markaBasligiGuncelle(id, guncel) {
    const m = markalar.find((x) => x.id === id);
    if (!m) return;
    const degisenler = [];
    ["tarih", "marka", "plaka", "toplamYuklemeKg"].forEach((alan) => {
      if (String(m[alan] ?? "") !== String(guncel[alan] ?? "")) degisenler.push(`${alan}: ${m[alan] || "-"} → ${guncel[alan] || "-"}`);
    });
    setMarkalar((prev) => prev.map((mm) => (mm.id !== id ? mm : { ...mm, ...guncel })));
    if (degisenler.length > 0) {
      logEtkinlik(id, `${guncel.marka} · ${m.urun}`, "baslik_duzenlendi", `Marka bilgisi düzenlendi: ${degisenler.join(", ")}`);
    }
  }

  // DÜKKANDA KALAN — toplu kayıt. Her marka için TEK bir "hedef sayımı bul/oluştur" kararı verilir,
  // sonra o markanın tüm ürün satırları AYNI sayıma yazılır. Birden fazla marka aynı anda kaydedilirse
  // her biri kendi hedef sayımını bağımsız şekilde bulur/oluşturur — birbirine karışmaz.
  function kalanTopluIsle(markaId, urunDegerleri, tarih) {
    const marka = markalar.find((m) => m.id === markaId);
    if (!marka || !urunDegerleri || Object.keys(urunDegerleri).length === 0) return;
    let hedef = sayimlar.filter((s) => s.markaId === markaId && s.tarih === tarih).sort((a, b) => b.sayimNo - a.sayimNo)[0];
    if (!hedef) hedef = yeniSayimEkle(marka, tarih);
    Object.entries(urunDegerleri).forEach(([urunId, deger]) => {
      satirGuncelle(hedef.id, urunId, "kalanAdet", String(deger));
    });
    // Gün sonu kaydı kesinleşsin diye otomatik kilitle (Ambar'da yanlışlıkla değişmesin).
    setSayimlar((prev) => prev.map((s) => (s.id !== hedef.id ? s : { ...s, kilitli: true, kilitliMiydi: true })));
    logEtkinlik(marka.id, `${marka.marka} · ${marka.urun}`, "kalan_girildi", `${Object.keys(urunDegerleri).length} ürün için kalan adet girildi`, { hedefTarih: tarih });
  }
  function kalanTopluKaydet(markaIdListesi, degerlerMap, tarih) {
    markaIdListesi.forEach((id) => kalanTopluIsle(id, degerlerMap[id], tarih));
  }

  function ornekYukle(tip) {
    if (ornekOnay !== tip) { setOrnekOnay(tip); setTimeout(() => setOrnekOnay(null), 4000); return; }
    const veri = tip === "real" ? SEED_REAL : SEED_SENARYO;
    setMarkalar(veri.markalar);
    setSayimlar(veri.sayimlar);
    setEtkinlikler(veri.etkinlikler || []);
    setSelectedId(null);
    setOrnekOnay(null);
    setSayfa("ambar");
  }

  function aktarimUygula(havuzKayitlari, satirSayisi, markaSayisi) {
    const yeniUyarilar = [];
    havuzKayitlari.forEach((kayit) => {
      const marka = markalar.find((m) => m.id === kayit.markaId);
      if (!marka) return;
      const urunAd = marka.urunler.find((u) => u.id === kayit.urunId)?.ad || "ürün";

      if (marka.durum === "tamamlandı") {
        yeniUyarilar.push({
          id: uid(), tip: "kapali_hareket", markaId: marka.id, markaAd: `${marka.marka} · ${marka.urun}`, urunAd, tarih: kayit.tarih, ts: new Date().toISOString(),
          mesaj: `Bu marka "tamamlandı" olarak işaretli ama Aybelsoft'ta ${fmtTarih(kayit.tarih)} tarihli "${urunAd}" satışı görünüyor — muhtemelen başka bir markaya ait satış buraya karışmış.`,
        });
      }

      const ilgiliSayim = sayimlar.find((s) => s.markaId === kayit.markaId && s.tarih === kayit.tarih && s.kilitli);
      if (ilgiliSayim) {
        const satir = ilgiliSayim.satirlar.find((s) => s.urunId === kayit.urunId);
        const eskiAdet = Number(satir?.satisAdet) || 0;
        const eskiKg = Number(satir?.satisKg) || 0;
        if (satir && eskiAdet > 0 && (eskiAdet !== kayit.satisAdet || Math.abs(eskiKg - kayit.satisKg) > 0.5)) {
          yeniUyarilar.push({
            id: uid(), tip: "veri_degisti", markaId: marka.id, markaAd: `${marka.marka} · ${marka.urun}`, urunAd, tarih: kayit.tarih, ts: new Date().toISOString(),
            mesaj: `${fmtTarih(kayit.tarih)} için "${urunAd}" daha önce ${fmt(eskiAdet)} adet / ${fmt(eskiKg)} kg olarak kaydedilmişti, Aybelsoft'tan şimdi ${fmt(kayit.satisAdet)} adet / ${fmt(kayit.satisKg)} kg geldi — o gün zaten kilitlenmişti, kontrol edin.`,
          });
        }
      }
    });
    if (yeniUyarilar.length > 0) setDisUyarilar((prev) => [...prev, ...yeniUyarilar]);

    setHavuz((prev) => {
      const kalan = prev.filter((h) => !havuzKayitlari.some((y) => y.markaId === h.markaId && y.urunId === h.urunId && y.tarih === h.tarih));
      return [...kalan, ...havuzKayitlari.map((h) => ({ ...h, id: uid() }))];
    });
    const markaAdlari = [...new Set(havuzKayitlari.map((h) => markalar.find((m) => m.id === h.markaId)))].filter(Boolean);
    markaAdlari.forEach((m) => logEtkinlik(m.id, `${m.marka} · ${m.urun}`, "aybelsoft_aktarildi", "Aybelsoft'tan satış verisi aktarıldı"));
    return { kayit: satirSayisi, marka: markaSayisi, uyari: yeniUyarilar.length };
  }

  const notlar = selectedMarka ? anomaliler(selectedMarka, selectedSayimlar) : [];

  const NavBtn = ({ id, icon: Icon, label }) => (
    <button
      onClick={() => { setSayfa(id); if (id !== "detay") setSelectedId(null); }}
      className={`flex items-center gap-1.5 text-sm px-3 py-2 rounded-lg font-medium transition-colors ${
        sayfa === id ? "bg-stone-900 text-white" : "text-stone-600 hover:bg-stone-100"
      }`}
    >
      <Icon className="w-4 h-4" /> {label}
    </button>
  );

  return (
    <div style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }} className="min-h-screen bg-stone-50 text-stone-900">
      <div className="max-w-5xl mx-auto p-4 md:p-6">
        <header className="flex items-center justify-between mb-5 flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <Package className="w-5 h-5 text-amber-700" />
            <div className="leading-tight">
              <h1 className="text-base font-medium">Ekizler Ticaret</h1>
              <p className="text-xs text-stone-400">Yükleme – satış – stok takip</p>
            </div>
          </div>
          <nav className="flex items-center gap-1 bg-white border border-stone-200 rounded-xl p-1 flex-wrap">
            <NavBtn id="ambar" icon={Folder} label="Ambar" />
            <NavBtn id="yeni" icon={FilePlus2} label="Yeni Marka Ekle" />
            <NavBtn id="kalan" icon={ClipboardList} label="Dükkanda Kalan" />
            <NavBtn id="ice-aktar" icon={Upload} label="İçe Aktar" />
            <NavBtn id="gecmis" icon={History} label="İşlem geçmişi" />
          </nav>
        </header>

        {sayfa === "ambar" && (
          <>
            {markalar.length === 0 && (
              <div className="rounded-lg border border-dashed border-stone-300 p-8 text-center space-y-3 mb-4">
                <p className="text-sm text-stone-500">Henüz veri yok.</p>
                <div className="flex flex-col sm:flex-row gap-2 justify-center">
                  <button onClick={() => ornekYukle("senaryo")} className={`text-xs rounded-lg px-3 py-2 border ${ornekOnay === "senaryo" ? "border-red-300 bg-red-50 text-red-700 font-medium" : "border-stone-200 text-stone-500 hover:border-stone-300"}`}>
                    {ornekOnay === "senaryo" ? "Emin misiniz? Tekrar tıklayın" : "A8 / A10 örnek senaryosunu yükle"}
                  </button>
                  <button onClick={() => ornekYukle("real")} className={`text-xs rounded-lg px-3 py-2 border ${ornekOnay === "real" ? "border-red-300 bg-red-50 text-red-700 font-medium" : "border-stone-200 text-stone-500 hover:border-stone-300"}`}>
                    {ornekOnay === "real" ? "Emin misiniz? Tekrar tıklayın" : "Temmuz–Ağustos gerçek verisini yükle (34 marka)"}
                  </button>
                </div>
              </div>
            )}
            {markalar.length > 0 && (
              <div className="flex justify-end mb-3">
                <button onClick={() => ornekYukle("real")} className={`text-xs rounded px-2 py-1 ${ornekOnay === "real" ? "text-red-700 font-medium" : "text-stone-400 hover:text-stone-600"}`}>
                  {ornekOnay === "real" ? "Emin misiniz? Tüm veriler değişir — tekrar tıklayın" : "Gerçek veriye sıfırla (34 marka)"}
                </button>
              </div>
            )}
            <AmbarPage markalar={markalar} sayimlar={sayimlar} onSelect={(id) => { setSelectedId(id); setSayfa("detay"); }} />
          </>
        )}

        {sayfa === "yeni" && (
          <YeniIslemPage markaForm={markaForm} setMarkaForm={setMarkaForm} urunToggle={urunToggle} urunAdetGuncelle={urunAdetGuncelle} ozelUrunEkle={ozelUrunEkle} eklemarka={eklemarka} markalar={markalar} />
        )}

        {sayfa === "kalan" && <DukkandaKalanPage markalar={markalar} sayimlar={sayimlar} etkinlikler={etkinlikler} kalanTopluKaydet={kalanTopluKaydet} />}

        {sayfa === "ice-aktar" && <ImportPage markalar={markalar} aktarimUygula={aktarimUygula} />}

        {sayfa === "gecmis" && <GecmisPage etkinlikler={etkinlikler} onMarkaTikla={(id) => { setSelectedId(id); setSayfa("detay"); }} />}

        {sayfa === "detay" && !selectedMarka && (
          <div className="rounded-lg border border-dashed border-stone-300 p-12 text-center text-stone-400 text-sm">
            Bir marka seçili değil. <button onClick={() => setSayfa("ambar")} className="text-amber-700 hover:underline">Ambar'a dön</button>
          </div>
        )}

        {sayfa === "detay" && selectedMarka && (
          <DetayPage
            marka={selectedMarka} sayimlarListesi={selectedSayimlar} notlar={notlar}
            muhasebeAcik={muhasebeAcik} setMuhasebeAcik={setMuhasebeAcik}
            onGeri={() => setSayfa("ambar")} onSil={() => markaSil(selectedMarka.id)}
            onDurumDegistir={() => markaDurumDegistir(selectedMarka.id)} onYeniSayim={() => yeniSayimEkle(selectedMarka)}
            satirGuncelle={satirGuncelle} sayimAlanGuncelle={sayimAlanGuncelle} sayimKilitleAc={sayimKilitleAc}
            havuz={havuz.filter((h) => h.markaId === selectedMarka.id)}
            disUyarilar={disUyarilar.filter((u) => u.markaId === selectedMarka.id)}
            markaBasligiGuncelle={markaBasligiGuncelle}
          />
        )}
      </div>
    </div>
  );
}
