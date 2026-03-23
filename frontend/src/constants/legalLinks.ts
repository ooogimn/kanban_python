export type LegalLink = {
  label: string;
  href: string;
};

export const LEGAL_LINKS: LegalLink[] = [
  { label: 'Пользовательское соглашение', href: '/terms' },
  { label: 'Политика конфиденциальности', href: '/privacy' },
  { label: 'Политика обработки ПДн', href: '/personal-data' },
  { label: 'Публичная оферта', href: '/offer' },
  { label: 'Контакты', href: '/legal/contacts' },
];
