import { detectCategory, extractAmount } from './smartAnalyzer';

export function createInitialSampleData() {
  const now = new Date();
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);

  return [
    {
      id: 'sample-1',
      sender: 'TURKCELL',
      body: 'Sayın Abonemiz, 532***8890 nolu hattınıza ait Kasım 2026 dönemi faturanız 540,00 TL\'dir. Son ödeme tarihi 24.11.2026\'dır. Kesintisiz iletişim için zamanında ödeme yapmanızı rica ederiz.',
      receivedAt: now.toISOString(),
      isFavorite: true,
      favoritedAt: now.toISOString(),
      category: 'bill',
      extractedAmount: '540,00 TL',
      userNote: 'Unutulmaması gereken telefon faturası',
      sourceApp: 'SMS Otomasyonu',
    },
    {
      id: 'sample-2',
      sender: 'CK BOĞAZİÇİ ELEKTRİK',
      body: '98124012 tesisat numaralı aboneliğinize ait 785,40 TL tutarındaki elektrik faturanızın son ödeme tarihi 20.11.2026\'dır.',
      receivedAt: yesterday.toISOString(),
      isFavorite: true,
      favoritedAt: yesterday.toISOString(),
      category: 'bill',
      extractedAmount: '785,40 TL',
      userNote: 'Otomatik ödemede değil, mobil bankacılıktan ödenecek',
      sourceApp: 'SMS Otomasyonu',
    },
    {
      id: 'sample-3',
      sender: 'Yurtiçi Kargo',
      body: 'Gönderiniz bugün adresinize teslim edilmek üzere kuryeye zimmetlenmiştir. Teslimat Şifresi: 8412.',
      receivedAt: yesterday.toISOString(),
      isFavorite: false,
      favoritedAt: null,
      category: 'cargo',
      extractedAmount: null,
      userNote: '',
      sourceApp: 'SMS Otomasyonu',
    },
    {
      id: 'sample-4',
      sender: 'Enpara.com',
      body: 'Vadesiz TL hesabınıza FAST ile 3.500,00 TL para transferi gerçekleşmiştir.',
      receivedAt: threeDaysAgo.toISOString(),
      isFavorite: false,
      favoritedAt: null,
      category: 'bank',
      extractedAmount: '3.500,00 TL',
      userNote: '',
      sourceApp: 'SMS Otomasyonu',
    },
  ];
}

export const SIMULATION_POOL = [
  {
    sender: 'TÜRK TELEKOM',
    body: 'Değerli Müşterimiz, 8821904412 hizmet numaralı evde internet aboneliğinize ait Kasım ayı faturanız 620,00 TL\'dir. Son ödeme tarihi 26.11.2026.',
    note: 'Ev internet faturası',
  },
  {
    sender: 'İGDAŞ',
    body: 'Sayın Abonemiz, 10049281 sözleşme numaralı doğalgaz faturanız 1.245,80 TL olarak kesilmiştir. Son ödeme tarihi: 25.11.2026.',
    note: '',
  },
  {
    sender: 'İSKİ',
    body: '49182731 mukavele nolu su aboneliğinize ait 390,50 TL tutarındaki faturanızın son ödeme tarihi 28.11.2026\'dır.',
    note: '',
  },
  {
    sender: 'Garanti BBVA',
    body: 'Sonu 4821 ile biten kredi kartınızın Kasım dönemi hesap özeti borcu 8.450,00 TL\'dir. Son ödeme tarihi 27.11.2026.',
    note: 'Ekstre ödemesi',
  },
  {
    sender: 'HepsiJet',
    body: 'HJ94812041 takip numaralı siparişiniz dağıtıma çıkarılmıştır. Bugün 18:00\'e kadar teslim edilecektir. Kod: 3910.',
    note: '',
  },
];

export function buildNotificationItem({
  sender,
  body,
  receivedAt = new Date().toISOString(),
  isFavorite = false,
  autoFavoriteBills = false,
  category = null,
  userNote = '',
  sourceApp = 'Manuel',
}) {
  const cleanSender = (sender || '').trim() || 'SMS Bildirimi';
  const cleanBody = (body || '').trim();
  const detectedCat = category || detectCategory(cleanSender, cleanBody);
  const amount = extractAmount(cleanBody);
  const finalFav = Boolean(isFavorite || (autoFavoriteBills && detectedCat === 'bill'));

  return {
    id: `notif-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    sender: cleanSender,
    body: cleanBody,
    receivedAt,
    isFavorite: finalFav,
    favoritedAt: finalFav ? new Date().toISOString() : null,
    category: detectedCat,
    extractedAmount: amount,
    userNote: (userNote || '').trim(),
    sourceApp,
  };
}

