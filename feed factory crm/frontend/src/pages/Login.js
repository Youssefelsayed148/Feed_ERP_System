import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { Eye, EyeOff, Building2 } from 'lucide-react';
import { authService } from '../services/api';
import { setUser } from '../store/slices/authSlice';
import { t, getLang } from '../utils/i18n';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const dispatch = useDispatch();

  // Set language direction on login page
  useEffect(() => {
    const lang = getLang();
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = lang;
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const result = await authService.login(email, password);
      if (result.token) {
        dispatch(setUser(result.user));
        navigate('/dashboard');
      } else {
        setError(result.error || t('loginFailed'));
      }
    } catch (err) {
      setError(t('loginError'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-logo">
          <img
            src="https://sandybrown-ant-159541.hostingersite.com/wp-content/uploads/2025/08/OSIRIS-LABS-27.png"
            alt={t('appName')}
          />
        </div>
        
        <h1 className="auth-title">{t('welcomeBack')}</h1>
        <p className="auth-subtitle">{t('signIn')}</p>

        {error && (
          <div className="error-message" style={{
            background: '#fee2e2',
            color: '#dc2626',
            padding: '12px',
            borderRadius: '8px',
            marginBottom: '20px',
            fontSize: '0.9rem'
          }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">{t('emailAddress')}</label>
            <input
              type="email"
              className="form-input"
              placeholder={t('emailAddress')}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">{t('password')}</label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPassword ? 'text' : 'password'}
                className="form-input"
                placeholder={t('password')}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                style={{ paddingRight: '40px' }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: 'absolute',
                  right: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: '#64748b'
                }}
              >
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%', justifyContent: 'center', marginTop: '10px' }}
            disabled={loading}
          >
            {loading ? t('common.loading') : t('signInBtn')}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: '24px', color: '#64748b', fontSize: '0.85rem' }}>
          <p>{t('demoCredentials')}</p>
          <p>{t('emailLabel')}: owner@al-kheir.com</p>
          <p>{t('passwordLabel')}: password123</p>
        </div>
      </div>
    </div>
  );
};

export default Login;