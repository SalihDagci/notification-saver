// Kategori Tanımları
export const CATEGORIES = {
  bill: {
    id: 'bill',
    label: 'Fatura & Ödeme',
    icon: '🧾',
    color: '#EF4444',
    bg: 'rgba(239, 68, 68, 0.16)',
  },
  bank: {
    id: 'bank',
    label: 'Banka & Finans',
    icon: '🏦',
    color: '#3B82F6',
    bg: 'rgba(59, 130, 246, 0.16)',
  },
  cargo: {
    id: 'cargo',
    label: 'Kargo & Teslimat',
    icon: '📦',
    color: '#F59E0B',
    bg: 'rgba(245, 158, 11, 0.16)',
  },
  code: {
    id: 'code',
    label: 'Doğrulama Kodu',
    icon: '🔑',
    color: '#A855F7',
    bg: 'rgba(168, 85, 247, 0.16)',
  },
  message: {
    id: 'message',
    label: 'Mesaj / SMS',
    icon: '💬',
    color: '#10B981',
    bg: 'rgba(16, 185, 129, 0.16)',
  },
};

export const CATEGORY_LIST = Object.values(CATEGORIES);

/**
 * Gönderen ve mesaj metninden otomatik kategori algılar
 */
export function detectCategory(sender = '', body = '') {
  const combined = `${sender} ${body}`.toLocaleLowerCase('tr-TR');

  const billKeywords = [
    'fatura', 'son ödeme', 'son odeme', 'ödenmesi', 'odenmesi',
    'borç', 'borcunuz', 'abone', 'turkcell', 'vodafone', 'türk telekom',
    'turk telekom', 'ttnet', 'superonline', 'iski', 'igdaş', 'igdas',
    'bedaş', 'bedas', 'enerjisa', 'ck boğaziçi', 'su faturası',
    'elektrik', 'doğalgaz', 'dogalgaz', 'ödeme tarihi', 'gecikme'
  ];
  if (billKeywords.some((k) => combined.includes(k))) {
    return 'bill';
  }

  const codeKeywords = [
    'doğrulama kodu', 'dogrulama kodu', 'onay kodu', 'şifreniz',
    'sifreniz', 'otp', 'tek kullanımlık', 'giriş kodu', 'güvenlik kodu'
  ];
  if (codeKeywords.some((k) => combined.includes(k))) {
    return 'code';
  }

  const cargoKeywords = [
    'kargo', 'teslimat', 'dağıtıma', 'dagitima', 'kurye', 'aras',
    'yurtiçi', 'yurtici', 'mng', 'sürat', 'surat', 'ptt kargo',
    'hepsijet', 'trendyol express', 'kolay gelsin', 'gönderiniz'
  ];
  if (cargoKeywords.some((k) => combined.includes(k))) {
    return 'cargo';
  }

  const bankKeywords = [
    'banka', 'ekstre', 'kredi kartı', 'kredi karti', 'hesabınızdan',
    'fast', 'eft', 'havale', 'garanti', 'iş bankası', 'is bankasi',
    'yapı kredi', 'yapi kredi', 'akbank', 'ziraat', 'vakıfbank',
    'qnb', 'enpara', 'papara', 'harcama', 'bakiye'
  ];
  if (bankKeywords.some((k) => combined.includes(k))) {
    return 'bank';
  }

  return 'message';
}

/**
 * Metin içindeki TL / ₺ / USD / EUR tutarlarını otomatik yakalar (Örn: "540,00 TL")
 */
export function extractAmount(text = '') {
  const regex = /(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{1,2})?)\s*(?:TL|₺|TRY|USD|\$|EUR|€)/i;
  const match = text.match(regex);
  return match ? match[0].trim() : null;
}

const MONTHS_TR = [
  'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
  'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'
];

const DAYS_TR = [
  'Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'
];

/**
 * YYYY-MM-DD anahtarı üretir (yerel saat dilimine göre)
 */
export function toDateKey(dateInput) {
  const d = new Date(dateInput);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Bölüm başlığı için Türkçe tarih formatı ("Bugün • 15 Kasım 2026", "Dün • 14 Kasım 2026" vb.)
 */
export function formatDateHeader(dateKey) {
  const [y, m, d] = dateKey.split('-').map(Number);
  const dateObj = new Date(y, m - 1, d);
  const todayKey = toDateKey(new Date());

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayKey = toDateKey(yesterday);

  const shortStr = `${d} ${MONTHS_TR[m - 1]} ${y}`;
  const dayName = DAYS_TR[dateObj.getDay()];

  if (dateKey === todayKey) {
    return `Bugün • ${shortStr}`;
  }
  if (dateKey === yesterdayKey) {
    return `Dün • ${shortStr}`;
  }
  return `${shortStr}, ${dayName}`;
}

/**
 * Kart içi saat ve kısa tarih gösterimi
 */
export function formatTimeAndShortDate(isoString) {
  const d = new Date(isoString);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const key = toDateKey(d);
  const todayKey = toDateKey(new Date());

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayKey = toDateKey(yesterday);

  if (key === todayKey) return `Bugün ${hh}:${mm}`;
  if (key === yesterdayKey) return `Dün ${hh}:${mm}`;
  return `${d.getDate()} ${MONTHS_TR[d.getMonth()].slice(0, 3)} ${d.getFullYear()} • ${hh}:${mm}`;
}

export function getMonthNameTR(monthIndex) {
  return MONTHS_TR[monthIndex];
}

