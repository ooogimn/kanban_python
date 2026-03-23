import { Link } from 'react-router-dom';
import { COMPANY } from '../../lib/companyInfo';

/**
 * Политика использования Cookie-файлов (ФЗ-152, GDPR-совместимая для РФ).
 * Отдельная страница /cookies — ссылается из баннера и футера.
 */
export default function CookiePolicyPage() {
    return (
        <div className="max-w-3xl mx-auto px-4 py-6 flex flex-col max-h-[calc(100vh-6rem)]">
            <h1 className="text-2xl font-bold text-white mb-4 shrink-0">Политика использования cookie</h1>
            <div className="prose prose-invert max-w-none text-imperial-muted space-y-4 text-sm leading-relaxed overflow-y-auto min-h-0 flex-1 pr-2">

                <p>
                    Настоящая Политика использования cookie-файлов (далее — Политика) распространяется на
                    сервис <strong className="text-white">AntExpress</strong>, принадлежащий{' '}
                    <strong className="text-white">{COMPANY.shortName}</strong>{' '}
                    (ИНН {COMPANY.inn}), и устанавливает порядок использования cookie-файлов и аналогичных технологий
                    при посещении платформы.
                </p>

                <section>
                    <h2 className="text-lg font-semibold text-white mt-6 mb-2">1. Что такое cookie</h2>
                    <p>
                        Cookie — это небольшие текстовые файлы, которые веб-сайт сохраняет на устройстве пользователя
                        (компьютере, планшете, телефоне) через браузер при посещении. Cookie позволяют платформе
                        «запомнить» ваши действия и настройки, чтобы не вводить их заново при каждом визите.
                    </p>
                    <p>
                        Аналогичные технологии: localStorage, sessionStorage, Web Beacons (пиксели) —
                        используются для тех же целей и регулируются настоящей Политикой.
                    </p>
                </section>

                <section>
                    <h2 className="text-lg font-semibold text-white mt-6 mb-2">2. Какие cookie мы используем</h2>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm border-collapse">
                            <thead>
                                <tr className="border-b border-white/10">
                                    <th className="text-left py-2 pr-4 text-white font-semibold">Тип</th>
                                    <th className="text-left py-2 pr-4 text-white font-semibold">Назначение</th>
                                    <th className="text-left py-2 text-white font-semibold">Обязательны?</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                <tr>
                                    <td className="py-2 pr-4 font-medium text-cyan-300">Необходимые</td>
                                    <td className="py-2 pr-4">Авторизация, сессия, защита от CSRF. Без них платформа не работает.</td>
                                    <td className="py-2 text-green-400">Да</td>
                                </tr>
                                <tr>
                                    <td className="py-2 pr-4 font-medium text-cyan-300">Функциональные</td>
                                    <td className="py-2 pr-4">Запоминание языка, темы, настроек интерфейса.</td>
                                    <td className="py-2 text-yellow-400">По вашему выбору</td>
                                </tr>
                                <tr>
                                    <td className="py-2 pr-4 font-medium text-cyan-300">Аналитические</td>
                                    <td className="py-2 pr-4">Статистика посещаемости и поведения для улучшения сервиса. Данные обезличены.</td>
                                    <td className="py-2 text-yellow-400">По вашему выбору</td>
                                </tr>
                                <tr>
                                    <td className="py-2 pr-4 font-medium text-cyan-300">Маркетинговые</td>
                                    <td className="py-2 pr-4">Показ релевантной рекламы. Передача данных рекламным системам (Яндекс, VK).</td>
                                    <td className="py-2 text-red-400">Только с вашего согласия</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </section>

                <section>
                    <h2 className="text-lg font-semibold text-white mt-6 mb-2">3. Периоды хранения</h2>
                    <p>
                        <strong className="text-white">Сессионные cookie</strong> — удаляются сразу при закрытии браузера.<br />
                        <strong className="text-white">Постоянные cookie</strong> — хранятся от 30 дней до 2 лет в зависимости от типа.
                        Конкретные сроки каждого cookie указаны в таблице технических параметров (по запросу через {COMPANY.email}).
                    </p>
                </section>

                <section>
                    <h2 className="text-lg font-semibold text-white mt-6 mb-2">4. Сторонние cookie</h2>
                    <p>
                        Мы можем использовать следующие сторонние сервисы, которые устанавливают свои cookie:
                    </p>
                    <ul className="list-disc pl-6 space-y-1">
                        <li>
                            <strong className="text-white">ЮКасса / Яндекс Пэй</strong> — при обработке платежей. Регулируется
                            политиками конфиденциальности соответствующих сервисов.
                        </li>
                        <li>
                            <strong className="text-white">Яндекс.Метрика</strong> — аналитика (при включённом согласии).
                        </li>
                        <li>
                            <strong className="text-white">VK Pixel</strong> — ретаргетинг (при включённом согласии на маркетинговые cookie).
                        </li>
                        <li>
                            <strong className="text-white">Telegram Widget</strong> — виджет авторизации через Telegram (необходимый).
                        </li>
                    </ul>
                    <p>
                        Мы не контролируем cookie третьих лиц. За их политиками обращайтесь к соответствующим поставщикам.
                    </p>
                </section>

                <section>
                    <h2 className="text-lg font-semibold text-white mt-6 mb-2">5. Ваш выбор и управление согласием</h2>
                    <p>
                        При первом посещении платформы вы видите баннер, позволяющий выбрать уровень согласия:
                    </p>
                    <ul className="list-disc pl-6 space-y-1">
                        <li><strong className="text-white">«Принять все»</strong> — разрешить все категории cookie.</li>
                        <li><strong className="text-white">«Только необходимые»</strong> — только технически обязательные cookie.</li>
                        <li><strong className="text-white">«Не включать»</strong> — отказаться от необязательных cookie.</li>
                    </ul>
                    <p>
                        Вы можете изменить свой выбор в любое время, нажав ссылку «Настройки cookie» в футере сайта.
                        Параметры cookie также можно настроить в настройках вашего браузера (удалить, заблокировать cookie).
                        Обратите внимание: отключение необходимых cookie может сделать платформу недоступной.
                    </p>
                </section>

                <section>
                    <h2 className="text-lg font-semibold text-white mt-6 mb-2">6. Правовая основа</h2>
                    <p>
                        Обработка данных через cookie осуществляется на основании:
                    </p>
                    <ul className="list-disc pl-6 space-y-1">
                        <li>Вашего согласия — для функциональных, аналитических и маркетинговых cookie (ст. 6 ФЗ-152);</li>
                        <li>Договора / оферты — для необходимых cookie (исполнение договора с пользователем);</li>
                        <li>Законных интересов Оператора — для обеспечения безопасности платформы.</li>
                    </ul>
                </section>

                <section>
                    <h2 className="text-lg font-semibold text-white mt-6 mb-2">7. Изменения Политики</h2>
                    <p>
                        Мы вправе обновлять настоящую Политику. Актуальная версия всегда доступна по адресу <code>/cookies</code>.
                        При существенных изменениях мы уведомим вас через баннер или email.
                    </p>
                </section>

                <section>
                    <h2 className="text-lg font-semibold text-white mt-6 mb-2">8. Контакты</h2>
                    <p>
                        По вопросам использования cookie и персональных данных:{' '}
                        <a href={`mailto:${COMPANY.email}`} className="text-cyan-400 hover:underline">
                            {COMPANY.email}
                        </a>
                        , тел.{' '}
                        <a href={`tel:${COMPANY.phoneTel}`} className="text-cyan-400 hover:underline">
                            {COMPANY.phone}
                        </a>
                        .<br />
                        Полные реквизиты:{' '}
                        <Link to="/legal/contacts" className="text-cyan-400 hover:underline">
                            Реквизиты и контакты
                        </Link>
                        .
                    </p>
                </section>

                <p className="mt-6 text-imperial-muted text-xs">
                    {COMPANY.shortName}. Политика cookie актуальна с 04.03.2026.
                </p>
            </div>
            <p className="mt-4 shrink-0">
                <Link to="/landing" className="text-imperial-gold hover:underline">← На главную</Link>
            </p>
        </div>
    );
}
