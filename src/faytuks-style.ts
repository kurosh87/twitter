export const FAYTUKS_IRAN_STYLE = {
  prefixes: {
    breaking: { en: 'BREAKING:', fa: 'فوری:' },
    new: { en: 'NEW:', fa: 'تازه:' },
    watch: { en: 'WATCH:', fa: 'ویدیو:' },
    update: { en: 'UPDATE:', fa: 'به‌روزرسانی:' }
  },

  locationFormat: {
    pattern: /^([A-Za-z\s]+),\s*Iran:/,
    farsiCities: {
      'Tehran': 'تهران',
      'Mashhad': 'مشهد',
      'Isfahan': 'اصفهان',
      'Shiraz': 'شیراز',
      'Tabriz': 'تبریز',
      'Karaj': 'کرج',
      'Ahvaz': 'اهواز',
      'Kermanshah': 'کرمانشاه',
      'Rasht': 'رشت',
      'Kerman': 'کرمان',
      'Zahedan': 'زاهدان',
      'Gorgan': 'گرگان',
      'Ilam': 'ایلام'
    }
  },

  sources: [
    'Reuters', 'AP', 'AFP', 'BBC', 'CNN', 'Axios', 'WSJ', 'NYT',
    'Iran International', 'Manoto', 'HRANA', 'Tasnim', 'Mehr News',
    'IRNA', 'Fars', 'TIME', 'Politico', 'Al Jazeera', 'Bloomberg'
  ],

  entities: {
    'IRGC': 'سپاه پاسداران',
    'Quds Force': 'نیروی قدس',
    'Supreme Leader': 'رهبر',
    'Khamenei': 'خامنه‌ای',
    'Basij': 'بسیج',
    'protesters': 'معترضان',
    'security forces': 'نیروهای امنیتی',
    'Trump': 'ترامپ',
    'Netanyahu': 'نتانیاهو'
  },

  guidelines: `
Persian (Farsi) Translation Rules for Faytuks Network:

1. PREFIXES: Translate directly
   - BREAKING: → فوری:
   - NEW: → تازه:

2. CITIES: Use Persian names
   - Tehran, Iran: → تهران:

3. TONE: Keep neutral, factual - no editorializing

4. SOURCES: Keep English source names, add "به گزارش" before
   - "- Reuters" → "- به گزارش رویترز"

5. NUMBERS: Use Western numerals (123) not Persian (۱۲۳)

6. QUOTES: Keep in quotation marks «»

7. ENTITIES: Use common Persian terms
   - IRGC → سپاه
   - protesters → معترضان
   - security forces → نیروهای امنیتی

8. NO EMOJIS in Iran tweets (unlike general content)

9. CHARACTER LIMIT: 280 max
`
};
