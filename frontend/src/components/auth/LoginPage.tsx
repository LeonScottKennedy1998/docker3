import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { API_URLS, getAuthHeaders } from '../../config/api';
import './Auth.css';

interface LoginPageProps {
    onLogin: (userData: any) => void;
}

const LoginPage: React.FC<LoginPageProps> = ({ onLogin }) => {
    const navigate = useNavigate();
    const [step, setStep] = useState<'credentials' | 'twoFactor'>('credentials');
    const [credentials, setCredentials] = useState({
        email: '',
        password: ''
    });
    const [twoFactorData, setTwoFactorData] = useState({
        code: '',
        email: '',
        userId: null as number | null
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [timer, setTimer] = useState(600);
    const [showPassword, setShowPassword] = useState(false);
    const [showTwoFactorCode, setShowTwoFactorCode] = useState(false);

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
    };

    const handleCredentialsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setCredentials({
            ...credentials,
            [e.target.name]: e.target.value
        });
    };

    const handleTwoFactorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setTwoFactorData({
            ...twoFactorData,
            [e.target.name]: e.target.value
        });
    };

    const handleSubmitCredentials = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        
        try {
            const response = await fetch(API_URLS.AUTH.LOGIN, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify(credentials)
            });
            
            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.error || 'Ошибка входа');
            }
            
            if (data.requiresTwoFactor) {
                setTwoFactorData({
                    code: '',
                    email: data.email,
                    userId: data.userId
                });
                setStep('twoFactor');
                setTimer(600);
                setError('');
            } else {
                completeLogin(data);
            }
            
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleSubmitTwoFactor = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        
        try {
            const response = await fetch(API_URLS.AUTH.LOGIN, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({
                    email: credentials.email,
                    password: credentials.password,
                    twoFactorCode: twoFactorData.code
                })
            });
            
            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.error || 'Ошибка проверки кода');
            }
            
            completeLogin(data);
            
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const completeLogin = (data: any) => {
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        
        onLogin(data.user);
        alert(`Вход выполнен! Добро пожаловать, ${data.user.first_name}!`);
        navigate('/');
    };

    const handleResendCode = async () => {
        setLoading(true);
        try {
            const response = await fetch(API_URLS.AUTH.TWO_FACTOR_RESEND_CODE, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({
                    email: twoFactorData.email,
                    userId: twoFactorData.userId
                })
            });
            
            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.error || 'Ошибка отправки кода');
            }
            
            setTimer(600);
            alert('Новый код отправлен на вашу почту!');
            
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleBackToCredentials = () => {
        setStep('credentials');
        setError('');
        setTwoFactorData({ code: '', email: '', userId: null });
    };

    // Email администратора для отображения
    const adminEmail = 'admin@mpt.ru';

    const toggleShowPassword = () => {
        setShowPassword(!showPassword);
    };

    const toggleShowTwoFactorCode = () => {
        setShowTwoFactorCode(!showTwoFactorCode);
    };

    return (
        <div className="page auth-page">
            <div className="auth-container">
                <div className="auth-header">
                    <h1>Вход в систему</h1>
                    <p>Введите ваши учетные данные для доступа</p>
                </div>
                
                <div className="auth-form">
                    {error && <div className="alert alert-error">{error}</div>}
                    
                    {step === 'credentials' ? (
                        <>
                            <form onSubmit={handleSubmitCredentials}>
                                <div className="form-group">
                                    <label>Email</label>
                                    <input
                                        type="email"
                                        name="email"
                                        value={credentials.email}
                                        onChange={handleCredentialsChange}
                                        placeholder="student@mpt.ru"
                                        required
                                        disabled={loading}
                                    />
                                </div>
                                
                                <div className="form-group password-group">
                                    <label>Пароль</label>
                                    <div className="password-input-wrapper">
                                        <input
                                            type={showPassword ? "text" : "password"}
                                            name="password"
                                            value={credentials.password}
                                            onChange={handleCredentialsChange}
                                            placeholder="••••••••"
                                            required
                                            disabled={loading}
                                        />
                                        <button
                                            type="button"
                                            className="password-toggle"
                                            onClick={toggleShowPassword}
                                            tabIndex={-1}
                                        >
                                            {showPassword ? "👁️" : "👁️‍🗨️"}
                                        </button>
                                    </div>
                                </div>
                                
                                <button 
                                    type="submit" 
                                    className="btn btn-primary"
                                    disabled={loading || !credentials.email || !credentials.password}
                                >
                                    {loading ? 'Вход...' : 'Войти'}
                                </button>
                            </form>
                            
                            {/* Блок с контактами администратора */}
                            <div className="admin-contact">
                                <div className="admin-contact-header">
                                    <span className="admin-icon">👨‍💼</span>
                                    <span>Проблемы со входом?</span>
                                </div>
                                <p className="admin-contact-text">
                                    Если у вас возникли проблемы с авторизацией, обратитесь к администратору:
                                </p>
                                <div className="admin-contact-info">
                                    <div className="contact-item">
                                        <span className="contact-icon">📧</span>
                                        <span className="contact-email">{adminEmail}</span>
                                    </div>
                                </div>
                                <p className="admin-contact-note">
                                    <small>Администратор поможет восстановить доступ или решить проблемы с учетной записью</small>
                                </p>
                            </div>
                            
                            <div className="auth-footer">
                                <Link to="/forgot-password" className="auth-link">Забыли пароль?</Link>
                                <Link to="/register" className="auth-link">Нет аккаунта? Зарегистрироваться</Link>
                            </div>
                        </>
                    ) : (
                        <div className="two-factor-container">
                            <div className="two-factor-header">
                                <h2>Двухфакторная аутентификация</h2>
                                <p className="two-factor-subtitle">
                                    Код отправлен на <strong>{twoFactorData.email}</strong>
                                </p>
                                <p className="timer">
                                    ⏳ Срок действия: <span className={timer < 60 ? 'timer-warning' : ''}>
                                        {formatTime(timer)}
                                    </span>
                                </p>
                            </div>
                            
                            <form onSubmit={handleSubmitTwoFactor}>
                                <div className="form-group password-group">
                                    <label>6-значный код</label>
                                    <div className="password-input-wrapper">
                                        <input
                                            type={showTwoFactorCode ? "text" : "password"}
                                            name="code"
                                            value={twoFactorData.code}
                                            onChange={handleTwoFactorChange}
                                            placeholder="123456"
                                            maxLength={6}
                                            pattern="[0-9]{6}"
                                            required
                                            disabled={loading || timer <= 0}
                                            className="code-input"
                                        />
                                        <button
                                            type="button"
                                            className="password-toggle"
                                            onClick={toggleShowTwoFactorCode}
                                            tabIndex={-1}
                                        >
                                            {showTwoFactorCode ? "👁️" : "👁️‍🗨️"}
                                        </button>
                                    </div>
                                    <small>Введите код из письма</small>
                                </div>
                                
                                <div className="two-factor-actions">
                                    <button 
                                        type="submit" 
                                        className="btn btn-primary"
                                        disabled={loading || twoFactorData.code.length !== 6 || timer <= 0}
                                    >
                                        {loading ? 'Проверка...' : 'Подтвердить'}
                                    </button>
                                    
                                    <button 
                                        type="button" 
                                        className="secondary-button"
                                        onClick={handleResendCode}
                                        disabled={loading}
                                    >
                                        Отправить новый код
                                    </button>
                                </div>
                            </form>
                            
                            {timer <= 0 && (
                                <div className="timer-expired">
                                    <p>⏰ Срок действия кода истёк. Запросите новый код.</p>
                                </div>
                            )}
                            
                            <button 
                                type="button" 
                                className="back-link"
                                onClick={handleBackToCredentials}
                                disabled={loading}
                            >
                                ← Вернуться к вводу логина и пароля
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default LoginPage;