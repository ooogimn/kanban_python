import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authApi } from '../api/auth';
import toast from 'react-hot-toast';

export default function ChangePasswordPage() {
  const [step, setStep] = useState<'request' | 'confirm'>('request');
  const [formData, setFormData] = useState({
    new_password: '',
    confirm_password: '',
  });
  const [verificationData, setVerificationData] = useState({
    session_id: 0,
    code: '',
  });
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const handleRequestSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    if (formData.new_password !== formData.confirm_password) {
      toast.error('Пароли не совпадают');
      setIsLoading(false);
      return;
    }

    if (formData.new_password.length < 8) {
      toast.error('Пароль должен содержать минимум 8 символов');
      setIsLoading(false);
      return;
    }

    try {
      const response = await authApi.requestPasswordChange({
        new_password: formData.new_password,
      });
      setVerificationData({
        session_id: response.session_id,
        code: '',
      });
      setStep('confirm');
      toast.success('Код подтверждения отправлен на email или в Telegram');
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Ошибка при запросе смены пароля');
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirmSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      await authApi.changePassword({
        session_id: verificationData.session_id,
        code: verificationData.code,
      });

      toast.success('Пароль успешно изменен!');
      navigate('/dashboard');
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Неверный код подтверждения');
    } finally {
      setIsLoading(false);
    }
  };

  if (step === 'confirm') {
    return (
      <div className="max-w-md mx-auto bg-white dark:bg-slate-800 rounded-lg shadow p-6 border border-slate-200 dark:border-slate-700">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-slate-100 mb-2">Подтверждение смены пароля</h2>
          <p className="text-gray-600 dark:text-slate-400">Введите код подтверждения, отправленный на email или в Telegram</p>
        </div>

        <form onSubmit={handleConfirmSubmit} className="space-y-6">
          <div>
            <label htmlFor="code" className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
              Код подтверждения
            </label>
            <input
              id="code"
              type="text"
              value={verificationData.code}
              onChange={(e) =>
                setVerificationData({ ...verificationData, code: e.target.value })
              }
              required
              maxLength={6}
              className="w-full px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-center text-2xl tracking-widest bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100"
              placeholder="000000"
            />
          </div>

          <button
            type="submit"
            disabled={isLoading || verificationData.code.length !== 6}
            className="w-full bg-primary-600 text-white py-2 px-4 rounded-lg font-medium hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isLoading ? 'Изменение...' : 'Изменить пароль'}
          </button>

          <button
            type="button"
            onClick={() => setStep('request')}
            className="w-full text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 text-sm font-medium"
          >
            ← Назад
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto bg-white dark:bg-slate-800 rounded-lg shadow p-6 border border-slate-200 dark:border-slate-700">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-slate-100 mb-2">Смена пароля</h2>
        <p className="text-gray-600 dark:text-slate-400">Введите новый пароль. Код подтверждения будет отправлен на ваш email или в Telegram</p>
      </div>

      <form onSubmit={handleRequestSubmit} className="space-y-6">
        <div>
          <label htmlFor="new_password" className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
            Новый пароль
          </label>
          <input
            id="new_password"
            type="password"
            value={formData.new_password}
            onChange={(e) => setFormData({ ...formData, new_password: e.target.value })}
            required
            minLength={8}
            className="w-full px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100"
            placeholder="Минимум 8 символов"
          />
        </div>

        <div>
          <label htmlFor="confirm_password" className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
            Подтверждение пароля
          </label>
          <input
            id="confirm_password"
            type="password"
            value={formData.confirm_password}
            onChange={(e) => setFormData({ ...formData, confirm_password: e.target.value })}
            required
            minLength={8}
            className="w-full px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100"
            placeholder="Повторите пароль"
          />
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="w-full bg-primary-600 text-white py-2 px-4 rounded-lg font-medium hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isLoading ? 'Отправка...' : 'Отправить код подтверждения'}
        </button>
      </form>
    </div>
  );
}
