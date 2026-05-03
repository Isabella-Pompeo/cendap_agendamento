export const metadata = {
  title: 'Consulta encerrada | CENDAP',
};

export default function ConsultaEncerradaPage() {
  return (
    <main style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#f8fafc',
      color: '#0f172a',
      padding: '24px',
      textAlign: 'center',
    }}>
      <section style={{
        width: '100%',
        maxWidth: '460px',
        background: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: '12px',
        padding: '28px',
        boxShadow: '0 18px 45px rgba(15, 23, 42, 0.08)',
      }}>
        <p style={{ margin: '0 0 8px', color: '#cb1e28', fontWeight: 800, fontSize: '0.8rem' }}>
          CENDAP
        </p>
        <h1 style={{ margin: '0 0 10px', fontSize: '1.45rem', lineHeight: 1.2 }}>
          Voce saiu da consulta
        </h1>
        <p style={{ margin: 0, color: '#64748b', fontSize: '0.95rem', lineHeight: 1.55 }}>
          A sala de telemedicina foi encerrada neste dispositivo. Voce pode fechar esta janela ou continuar usando o painel.
        </p>
      </section>
    </main>
  );
}
