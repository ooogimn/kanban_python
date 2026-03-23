import { Link } from 'react-router-dom';
import { COMPANY } from '../../lib/companyInfo';

export default function LegalContactsPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-6 flex flex-col max-h-[calc(100vh-6rem)]">
      <h1 className="text-2xl font-bold text-white mb-4 shrink-0">Реквизиты и контакты</h1>
      <div className="prose prose-invert max-w-none text-imperial-muted space-y-6 overflow-y-auto min-h-0 flex-1 pr-2">

        <section>
          <h2 className="text-lg font-semibold text-white mb-2">Юридические реквизиты</h2>
          <p className="font-semibold text-white">{COMPANY.shortName}</p>
          <p>Полное наименование: {COMPANY.fullName}</p>
          <p>
            ОГРН: {COMPANY.ogrn}<br />
            ИНН: {COMPANY.inn}<br />
            КПП: {COMPANY.kpp}
          </p>
          <p>Система налогообложения: {COMPANY.taxSystem}</p>
          <p>Регистрирующий орган: {COMPANY.registrar}</p>
          <p>Генеральный директор: {COMPANY.director}</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-white mb-2">Юридический адрес</h2>
          <p>{COMPANY.legalAddress}</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-white mb-2">Контактная информация</h2>
          <p>
            Телефон:{' '}
            <a href={`tel:${COMPANY.phoneTel}`} className="text-cyan-400 hover:underline">
              {COMPANY.phone}
            </a>
            <br />
            E-mail:{' '}
            <a href={`mailto:${COMPANY.email}`} className="text-cyan-400 hover:underline">
              {COMPANY.email}
            </a>
          </p>
          <p>
            Официальный сайт:{' '}
            <a href={COMPANY.siteUrl} target="_blank" rel="noopener noreferrer" className="text-cyan-400 hover:underline">
              {COMPANY.siteUrl}
            </a>
            <br />
            Telegram:{' '}
            <a href={COMPANY.telegramUrl} target="_blank" rel="noopener noreferrer" className="text-cyan-400 hover:underline">
              {COMPANY.telegramUrl}
            </a>
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-white mb-2">Банковские реквизиты</h2>
          <p>
            Банк: {COMPANY.bank.name}<br />
            БИК: {COMPANY.bank.bik}<br />
            ОГРН банка: {COMPANY.bank.ogrn}<br />
            ИНН банка: {COMPANY.bank.inn}<br />
            КПП банка: {COMPANY.bank.kpp}<br />
            Расчётный счёт: {COMPANY.bank.checkingAccount}<br />
            Корреспондентский счёт: {COMPANY.bank.corrAccount}
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-white mb-2">Оплата услуг</h2>
          <p>
            Мы принимаем оплату через{' '}
            <strong className="text-white">ЮКасса</strong> и{' '}
            <strong className="text-white">Яндекс Пэй</strong>.
            Оплата по безналичному расчёту возможна по выставлению счёта — свяжитесь с нами.
          </p>
          <p>
            По вопросам тарифов Pro и Enterprise:{' '}
            <a href={`mailto:${COMPANY.email}`} className="text-cyan-400 hover:underline">
              {COMPANY.email}
            </a>
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-white mb-2">Правовые документы</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li><Link to="/terms" className="text-cyan-400 hover:underline">Пользовательское соглашение</Link></li>
            <li><Link to="/offer" className="text-cyan-400 hover:underline">Публичная оферта</Link></li>
            <li><Link to="/privacy" className="text-cyan-400 hover:underline">Политика конфиденциальности</Link></li>
            <li><Link to="/personal-data" className="text-cyan-400 hover:underline">Политика обработки персональных данных</Link></li>
            <li><Link to="/cookies" className="text-cyan-400 hover:underline">Политика использования cookie</Link></li>
          </ul>
        </section>

      </div>
      <p className="mt-4 shrink-0">
        <Link to="/landing" className="text-imperial-gold hover:underline">← На главную</Link>
      </p>
    </div>
  );
}
