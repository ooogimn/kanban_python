import { Link } from 'react-router-dom';

export default function OfferPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      <h1 className="text-2xl font-bold text-white mb-6">Публичная оферта</h1>
      <div className="prose prose-invert max-w-none text-imperial-muted space-y-4">
        <p>
          Настоящий документ является публичной офертой на заключение договора оказания услуг в соответствии с положениями Гражданского кодекса РФ.
        </p>
        <p>
          Акцептом оферты считается регистрация в сервисе и начало использования платформы. Условия тарифов (Free, Pro, Enterprise) и порядок оплаты определяются на сайте и в личном кабинете.
        </p>
        <p>
          Оператор вправе изменять условия оферты с уведомлением пользователей. Продолжение использования сервиса после изменений означает согласие с новыми условиями.
        </p>
        <p>
          <strong>TODO:</strong> Заменить на полный юридический текст публичной оферты.
        </p>
      </div>
      <p className="mt-8">
        <Link to="/landing" className="text-imperial-gold hover:underline">← На главную</Link>
      </p>
    </div>
  );
}
