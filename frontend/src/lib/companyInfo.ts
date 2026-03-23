/**
 * Реквизиты ООО "ЛукИнтерЛаб" — единый источник правды.
 * Обновлять здесь, чтобы не менять по всему коду.
 */
export const COMPANY = {
  shortName: 'ООО «ЛукИнтерЛаб»',
  fullName: 'ОБЩЕСТВО С ОГРАНИЧЕННОЙ ОТВЕТСТВЕННОСТЬЮ "ЛукИнтерЛаб"',
  ogrn: '1257700465219',
  inn: '9717184870',
  kpp: '771701001',
  director: 'Лукьянов Сергей Юрьевич',
  taxSystem: 'УСН (6%). НДС не облагается.',
  registrar: 'Межрайонная инспекция Федеральной налоговой службы № 46 по г. Москве',

  legalAddress: '129164, г. Москва, вн.тер.г. муниципальный округ Алексеевский, ул. Ярославская, д. 9, оф. 85',
  postalAddress: '129164, г. Москва, ул. Ярославская, д. 9, оф. 85',

  phone: '+7 993 919 75 75',
  phoneTel: '+79939197575',
  email: 'LukInterLab@gmail.com',
  siteUrl: 'https://antexpress.ru/',
  siteDomain: 'www.antexpress.ru',
  telegramUrl: 'https://t.me/LukInterLab',
  telegramHandle: '@LukInterLab',

  bank: {
    name: 'ООО «Банк Точка»',
    bik: '044525104',
    ogrn: '1237700005157',
    inn: '9721194461',
    kpp: '772301001',
    checkingAccount: '40702810520000251817',
    corrAccount: '30101810745374525104',
  },

  // Год основания (для футера)
  foundedYear: 2025,
  currentYear: new Date().getFullYear(),
} as const;
