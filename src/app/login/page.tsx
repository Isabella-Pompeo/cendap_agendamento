'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import styles from './login.module.css';
import { ChevronLeft, Eye, EyeOff, CheckCircle2, LogIn, UserPlus } from 'lucide-react';

export default function LoginPage() {
  const { user, profile, signOut, refreshProfile, isLoading } = useAuth();
  
  const [isLogin, setIsLogin] = useState(true);
  const [cpf, setCpf] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [logoutSuccess, setLogoutSuccess] = useState(false);
  const [acceptedPolicies, setAcceptedPolicies] = useState(false);

  // Verifica se veio de um logout
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('logout') === 'success') {
      setLogoutSuccess(true);
      // Limpa a URL para não mostrar a mensagem de novo ao atualizar
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  // Redireciona se o usuário já estiver logado
  useEffect(() => {
    if (!isLoading && user && !loading && !successMsg) {
      // Aguarda 2 segundos para o usuário ver a mensagem de "Já está logado"
      const timer = setTimeout(() => {
        window.location.assign('/');
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [user, isLoading, loading, successMsg]);

  const formatCPF = (value: string) => {
    return value
      .replace(/\D/g, '')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d{1,2})/, '$1-$2')
      .replace(/(-\d{2})\d+?$/, '$1');
  };

  const formatPhone = (value: string) => {
    return value
      .replace(/\D/g, '')
      .replace(/(\d{2})(\d)/, '($1) $2')
      .replace(/(\d{5})(\d)/, '$1-$2')
      .replace(/(-\d{4})\d+?$/, '$1');
  };

  const handleCpfChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCpf(formatCPF(e.target.value));
    setError(null);
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPhone(formatPhone(e.target.value));
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!isLogin && !acceptedPolicies) {
      setError('Para continuar, aceite a Politica de Privacidade e os Termos de Uso.');
      return;
    }

    if (!isLogin) {
      if (fullName.trim().length < 3) {
        setError('Por favor, informe seu nome completo corretamente.');
        return;
      }

      const cleanPhone = phone.replace(/\D/g, '');
      if (cleanPhone.length < 10) {
        setError('Telefone incompleto. Verifique os números com DDD.');
        return;
      }
    }

    const cleanCpf = cpf.replace(/\D/g, '');
    if (cleanCpf.length !== 11) {
      setError('Por favor, informe um CPF numérico válido (11 dígitos).');
      return;
    }

    if (password.length < 8) {
      setError('A senha deve ter no mínimo 8 caracteres para sua segurança.');
      return;
    }

    setLoading(true);
    const email = `${cleanCpf}@paciente.cendap.com.br`;

    try {
      if (isLogin) {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (signInError) {
          throw new Error('CPF ou senha incorretos.');
        }

        setSuccessMsg('Bem-vindo(a) de volta! Carregando seu perfil...');
        setTimeout(() => {
          window.location.assign('/');
        }, 2000);
      } else {
        const cleanPhone = phone.replace(/\D/g, '');
        const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
        });

        if (signUpError) {
          if (signUpError.message.includes('User already registered')) {
            throw new Error('Este CPF já está cadastrado.');
          }
          throw signUpError;
        }

        if (signUpData.user) {
          const { error: profileError } = await supabase
            .from('profiles')
            .insert({
              id: signUpData.user.id,
              cpf: cleanCpf,
              full_name: fullName,
              phone: cleanPhone,
            });

          if (profileError) {
            console.error('Erro ao salvar perfil:', profileError);
            throw new Error('Erro ao criar perfil. Tente novamente.');
          }
          await refreshProfile(signUpData.user.id);
        }

        setSuccessMsg('Conta criada com sucesso! Bem-vindo(a)!');
        setTimeout(() => {
          window.location.assign('/');
        }, 2000);
      }
    } catch (err: any) {
      setError(err.message || 'Ocorreu um erro.');
    } finally {
      setLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className={styles.pageContainer}>
        <div className={styles.loading}>Carregando...</div>
      </div>
    );
  }

  return (
    <div className={styles.pageContainer}>
      <div className={styles.card}>
        <button className={styles.backButton} onClick={() => window.location.href = '/'}>
          <ChevronLeft size={20} /> Voltar
        </button>

        <img src="/logo-cendap-login.png" alt="CENDAP" className={styles.heroImage} />
        
        <div className={styles.contentWrapper}>
          {successMsg ? (
            <div className={styles.successContainer}>
              <div className={styles.successIconWrapper}>
                <CheckCircle2 size={48} strokeWidth={2.5} />
              </div>
              <h2 className={styles.successTitle}>Sucesso!</h2>
              <p className={styles.successMessage}>{successMsg}</p>
            </div>
          ) : user && !loading ? (
            <div style={{ textAlign: 'center', padding: '20px 10px' }}>
              <div style={{ 
                width: '64px',
                height: '64px',
                backgroundColor: '#f0fdf4',
                color: '#16a34a',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 20px'
              }}>
                <CheckCircle2 size={32} />
              </div>
              <h2 className={styles.title} style={{ marginBottom: '12px' }}>Você já está conectado!</h2>
              <p style={{ color: '#64748b', marginBottom: '32px', fontSize: '0.95rem', lineHeight: 1.5 }}>
                Identificamos uma sessão ativa. Redirecionando para sua área do paciente...
              </p>
              <button 
                onClick={async () => {
                  await signOut();
                  window.location.assign('/login?logout=success');
                }} 
                className={styles.toggleLink}
                style={{ fontSize: '0.9rem', cursor: 'pointer', border: 'none', background: 'none', color: '#64748b', textDecoration: 'underline' }}
              >
                Não é você? Clique aqui para Sair
              </button>
            </div>
          ) : (
            <>
              {logoutSuccess && (
                <div style={{
                  backgroundColor: '#f0fdf4',
                  color: '#16a34a',
                  padding: '12px',
                  borderRadius: '12px',
                  marginBottom: '20px',
                  fontSize: '0.9rem',
                  fontWeight: 600,
                  textAlign: 'center',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  border: '1px solid #bbf7d0'
                }}>
                  <CheckCircle2 size={18} />
                  Você saiu da conta com sucesso.
                </div>
              )}
              <h2 className={styles.title}>
                {isLogin ? 'Login' : 'Criar Conta'}
              </h2>
              <p style={{ textAlign: 'center', color: '#64748b', marginTop: '-1rem', marginBottom: '1rem', fontSize: '0.9rem' }}>
                {isLogin ? 'Faça login para gerenciar seus agendamentos' : 'Cadastre-se para começar a agendar online'}
              </p>

              <form className={styles.form} onSubmit={handleSubmit}>
                {!isLogin && (
                  <>
                    <div className={styles.inputGroup}>
                      <label className={styles.label}>Nome Completo</label>
                      <input
                        type="text"
                        className={styles.input}
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder="Ex: João da Silva"
                        required={!isLogin}
                      />
                    </div>

                    <div className={styles.inputGroup}>
                      <label className={styles.label}>Telefone / WhatsApp</label>
                      <input
                        type="tel"
                        className={styles.input}
                        value={phone}
                        onChange={handlePhoneChange}
                        placeholder="(00) 00000-0000"
                        maxLength={15}
                        required={!isLogin}
                      />
                    </div>
                  </>
                )}

                <div className={styles.inputGroup}>
                  <label className={styles.label}>CPF</label>
                  <input
                    type="text"
                    className={styles.input}
                    value={cpf}
                    onChange={handleCpfChange}
                    placeholder="000.000.000-00"
                    maxLength={14}
                    required
                  />
                </div>

                <div className={styles.inputGroup}>
                  <label className={styles.label}>Senha</label>
                  <div className={styles.inputWrapper}>
                    <input
                      type={showPassword ? "text" : "password"}
                      className={`${styles.input} ${styles.withIcon}`}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Sua senha"
                      required
                      minLength={8}
                    />
                    <button
                      type="button"
                      className={styles.eyeButton}
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <EyeOff size={22} /> : <Eye size={22} />}
                    </button>
                  </div>
                  {isLogin && (
                    <div style={{ textAlign: 'right', marginTop: '4px' }}>
                      <a 
                        href={`https://api.whatsapp.com/send/?phone=5591981097045&text=Ol%C3%A1%2C+esqueci+a+senha+do+meu+painel+de+paciente+%28CPF%3A+${cpf || '___.___.___-__'}.%29+Pode+me+ajudar+a+recuperar%3F`} 
                        target="_blank"
                        rel="noopener noreferrer"
                        className={styles.forgotPassword}
                      >
                        Esqueceu a senha?
                      </a>
                    </div>
                  )}
                </div>

                {!isLogin && (
                  <label className={styles.termsBox}>
                    <input
                      type="checkbox"
                      checked={acceptedPolicies}
                      onChange={(e) => {
                        setAcceptedPolicies(e.target.checked);
                        setError(null);
                      }}
                      className={styles.termsCheckbox}
                    />
                    <span>
                      Li e aceito a{' '}
                      <a href="/privacidade" target="_blank" rel="noopener noreferrer">
                        Politica de Privacidade
                      </a>
                      {' '}e os{' '}
                      <a href="/termos" target="_blank" rel="noopener noreferrer">
                        Termos de Uso
                      </a>
                      .
                    </span>
                  </label>
                )}

                {error && <div className={styles.error}>{error}</div>}

                <button type="submit" className={styles.submitButton} disabled={loading || (!isLogin && !acceptedPolicies)}>
                  {loading ? (
                    'Processando...'
                  ) : (
                    <>
                      {isLogin ? <LogIn size={20} /> : <UserPlus size={20} />}
                      {isLogin ? 'Entrar' : 'Criar conta'}
                    </>
                  )}
                </button>
              </form>

              <div className={styles.toggleText}>
                {isLogin ? 'Ainda não é cadastrado? ' : 'Já possui cadastro? '}
                <span 
                  className={styles.toggleLink}
                  onClick={() => {
                    setIsLogin(!isLogin);
                    setError(null);
                    setAcceptedPolicies(false);
                  }}
                >
                  {isLogin ? 'Cadastre-se aqui' : 'Faça login'}
                </span>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
