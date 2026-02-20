import { Link } from 'react-router-dom';

export default function LegalContactsPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      <h1 className="text-2xl font-bold text-white mb-6">Контакты</h1>
      <div className="prose prose-invert max-w-none text-imperial-muted space-y-4">
        <p className="font-semibold text-white">ООО «ЛукИнтерЛаб»</p>
        <p>
          ИНН: <em>(указать)</em><br />
          ОГРН: <em>(указать)</em>
        </p>
        <p>
          Юридический адрес: <em>(указать)</em>
        </p>
        <p>
          Телефон: <em>(указать)</em><br />
          E-mail: <em>(указать)</em>
        </p>
        <p>
          По вопросам подключения тарифов Pro и Enterprise — свяжитесь с нами по указанным контактам или через форму регистрации с пометкой «Связаться с менеджером».
        </p>
      </div>
      <p className="mt-8">
        <Link to="/landing" className="text-imperial-gold hover:underline">← На главную</Link>
      </p>
    </div>
  );
}
