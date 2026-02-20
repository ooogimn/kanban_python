import { Link } from 'react-router-dom';

export default function LegalContactsPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-6 flex flex-col max-h-[calc(100vh-6rem)]">
      <h1 className="text-2xl font-bold text-white mb-4 shrink-0">Контакты</h1>
      <div className="prose prose-invert max-w-none text-imperial-muted space-y-6 overflow-y-auto min-h-0 flex-1 pr-2">
        <section>
          <h2 className="text-lg font-semibold text-white mb-2">Реквизиты организации</h2>
          <p className="font-semibold text-white">ООО «ЛукИнтерЛаб»</p>
          <p>Полное наименование: Общество с ограниченной ответственностью «ЛукИнтерЛаб»</p>
          <p>
            ОГРН: 1257700465219<br />
            ИНН: 9717184870<br />
            КПП: 771701001
          </p>
          <p>Система налогообложения: УСН (6%). НДС не облагается.</p>
          <p>Регистрирующий орган: Межрайонная инспекция Федеральной налоговой службы № 46 по г. Москве.</p>
          <p>Генеральный директор: Лукьянов Сергей Юрьевич.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-white mb-2">Юридический адрес</h2>
          <p>129164, г. Москва, вн.тер.г. муниципальный округ Алексеевский, ул. Ярославская, д. 9, оф. 85</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-white mb-2">Контакты</h2>
          <p>
            Телефон: <a href="tel:+79939197575" className="text-cyan-400 hover:underline">+7 993 919 75 75</a><br />
            E-mail: <a href="mailto:LukInterLab@gmail.com" className="text-cyan-400 hover:underline">LukInterLab@gmail.com</a>
          </p>
          <p>
            Официальный сайт: <a href="https://lukinterlab.ru/" target="_blank" rel="noopener noreferrer" className="text-cyan-400 hover:underline">https://lukinterlab.ru/</a><br />
            Telegram: <a href="https://t.me/LukInterLab" target="_blank" rel="noopener noreferrer" className="text-cyan-400 hover:underline">https://t.me/LukInterLab</a>
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-white mb-2">Банковские реквизиты</h2>
          <p>
            Банк: ООО «Банк Точка»<br />
            БИК: 044525104<br />
            ОГРН: 1237700005157, ИНН: 9721194461, КПП: 772301001<br />
            Расчётный счёт: 40702810520000251817<br />
            Корр. счёт: 30101810745374525104
          </p>
        </section>

        <p className="pt-2">
          По вопросам подключения тарифов Pro и Enterprise свяжитесь с нами по указанным контактам или через форму регистрации с пометкой «Связаться с менеджером».
        </p>
      </div>
      <p className="mt-4 shrink-0">
        <Link to="/landing" className="text-imperial-gold hover:underline">← На главную</Link>
      </p>
    </div>
  );
}
