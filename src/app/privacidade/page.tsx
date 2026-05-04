import Link from 'next/link';
import styles from '../legal-page.module.css';

export const metadata = {
  title: 'Politica de Privacidade | CENDAP',
  description: 'Politica de privacidade do sistema de agendamento online da CENDAP.',
};

const UPDATED_AT = '02/05/2026';

const sectionStyle = {
  display: 'flex',
  flexDirection: 'column' as const,
  gap: '0.75rem',
};

export default function PrivacyPolicyPage() {
  return (
    <main className={styles.legalMain} style={{
      minHeight: '100vh',
      background: '#f8fafc',
      color: '#0f172a',
      padding: '32px 18px 48px',
    }}>
      <article className={styles.legalArticle} style={{
        width: '100%',
        maxWidth: '860px',
        margin: '0 auto',
        background: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: '20px',
        padding: 'clamp(24px, 5vw, 48px)',
        boxShadow: '0 20px 50px rgba(15, 23, 42, 0.08)',
      }}>
        <Link href="/" className={styles.backLink}>
          Voltar
        </Link>

        <p style={{ margin: 0, color: '#cb1e28', fontWeight: 800, textTransform: 'uppercase', fontSize: '0.78rem' }}>
          CENDAP
        </p>
        <h1 style={{ margin: '8px 0 12px', fontSize: 'clamp(2rem, 6vw, 3rem)', lineHeight: 1.05 }}>
          Politica de Privacidade
        </h1>
        <p style={{ margin: '0 0 28px', color: '#64748b', fontWeight: 600 }}>
          Ultima atualizacao: {UPDATED_AT}
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '28px', lineHeight: 1.7 }}>
          <section style={sectionStyle}>
            <h2>1. Quem somos</h2>
            <p>
              Esta Politica explica como a CENDAP, clinica localizada na Travessa Jose Barros da Silva, 806,
              Centro, Capitao Poco - PA, CNPJ 10.695.431/0001-73, trata dados pessoais no site de agendamento
              online, area do paciente, envio de exames, telemedicina e canais digitais relacionados.
            </p>
            <p>
              Para assuntos de privacidade e protecao de dados, a clinica atua como controladora dos dados pessoais
              tratados no contexto do atendimento. O canal de contato do encarregado/privacidade e o e-mail
              cdlacp@gmail.com, o WhatsApp (91) 98109-7045 ou o Instagram oficial @cendapcap.
            </p>
          </section>

          <section style={sectionStyle}>
            <h2>2. Dados que podemos coletar</h2>
            <p>Podemos tratar dados informados pelo proprio usuario ou gerados durante o uso do sistema, incluindo:</p>
            <ul>
              <li>nome, CPF, telefone, dados de cadastro e autenticacao;</li>
              <li>informacoes de agendamento, medico, especialidade, data, horario, status e comprovantes;</li>
              <li>dados de pagamento processados por parceiros de pagamento, como identificadores de transacao e status;</li>
              <li>arquivos enviados pelo paciente, como exames, imagens e documentos de saude;</li>
              <li>dados de telemedicina, como link de sala, registros operacionais e documentos emitidos pelo medico;</li>
              <li>dados tecnicos, como IP, navegador, dispositivo, eventos de uso, cookies e identificadores de analytics.</li>
            </ul>
            <p>
              Dados relacionados a saude podem ser dados pessoais sensiveis e recebem cuidado adicional, conforme a LGPD.
            </p>
            <p>
              Quando o atendimento envolver criancas, adolescentes ou pessoas incapazes, os dados devem ser fornecidos
              pelo responsavel legal ou com sua autorizacao, conforme aplicavel.
            </p>
          </section>

          <section style={sectionStyle}>
            <h2>3. Para que usamos os dados</h2>
            <p>Usamos os dados para:</p>
            <ul>
              <li>realizar cadastro, login e identificacao do paciente;</li>
              <li>agendar, confirmar, alterar ou cancelar consultas e exames;</li>
              <li>processar pagamentos de telemedicina e registrar status do pagamento;</li>
              <li>viabilizar atendimento por telemedicina, sala online e envio de documentos medicos;</li>
              <li>permitir que o medico visualize consultas, historico, exames anexados e documentos emitidos;</li>
              <li>prestar suporte pelo WhatsApp ou outros canais de atendimento;</li>
              <li>cumprir obrigacoes legais, regulatorias, fiscais e de defesa de direitos;</li>
              <li>melhorar a experiencia do site, medir desempenho e campanhas, e prevenir fraudes.</li>
            </ul>
          </section>

          <section style={sectionStyle}>
            <h2>4. Bases legais</h2>
            <p>
              O tratamento pode ocorrer, conforme o caso, para execucao de contrato ou procedimentos preliminares,
              cumprimento de obrigacao legal ou regulatoria, tutela da saude, exercicio regular de direitos,
              legitimo interesse e consentimento quando necessario.
            </p>
          </section>

          <section style={sectionStyle}>
            <h2>5. Compartilhamento de dados</h2>
            <p>
              Podemos compartilhar dados somente quando necessario para operar o servico, cumprir obrigacoes ou proteger
              direitos. Isso pode envolver provedores de hospedagem e banco de dados, meios de pagamento, ferramentas de
              telemedicina, ferramentas de analytics e anuncios, automacoes operacionais e profissionais autorizados da
              clinica.
            </p>
            <p>
              Esses terceiros devem tratar os dados de acordo com suas finalidades, medidas de seguranca e regras
              aplicaveis. Nao vendemos dados pessoais de pacientes.
            </p>
            <p>
              Alguns fornecedores de tecnologia podem armazenar ou processar dados fora do Brasil. Nesses casos, a
              CENDAP busca utilizar parceiros que adotem medidas de seguranca e mecanismos compativeis com a LGPD.
            </p>
          </section>

          <section style={sectionStyle}>
            <h2>6. Cookies e tecnologias semelhantes</h2>
            <p>
              O site pode usar cookies e tecnologias semelhantes para funcionamento, seguranca, medicao de audiencia,
              melhoria da experiencia e campanhas. O usuario pode gerenciar cookies pelo navegador, sabendo que alguns
              recursos podem ser afetados.
            </p>
          </section>

          <section style={sectionStyle}>
            <h2>7. Seguranca e retencao</h2>
            <p>
              Adotamos medidas tecnicas e administrativas para proteger os dados contra acessos nao autorizados,
              perda, alteracao, comunicacao indevida ou tratamento inadequado. Nenhum sistema e absolutamente imune
              a riscos, mas buscamos reduzir exposicoes e restringir acessos ao necessario.
            </p>
            <p>
              Os dados sao mantidos pelo tempo necessario para cumprir as finalidades informadas, obrigacoes legais,
              responsabilidades profissionais de saude, auditoria, prevencao a fraudes e defesa de direitos.
            </p>
          </section>

          <section style={sectionStyle}>
            <h2>8. Direitos do titular</h2>
            <p>
              Nos termos da LGPD, o titular pode solicitar confirmacao de tratamento, acesso, correcao, portabilidade,
              anonimizacao, bloqueio, eliminacao, informacoes sobre compartilhamento e revisao de consentimentos,
              quando aplicavel.
            </p>
            <p>
              O usuario tambem pode solicitar a exclusao de sua conta ou o apagamento de seus dados pessoais, quando
              aplicavel e respeitados os prazos legais, regulatorios, fiscais, profissionais de saude e de defesa de
              direitos que possam exigir a manutencao de determinados registros.
            </p>
            <p>
              Para exercer direitos, pedir exclusao de conta/dados ou tirar duvidas sobre privacidade, entre em contato
              com a clinica pelo e-mail cdlacp@gmail.com, pelo WhatsApp (91) 98109-7045 ou pelo Instagram oficial
              @cendapcap.
            </p>
          </section>

          <section style={sectionStyle}>
            <h2>9. Alteracoes desta Politica</h2>
            <p>
              Podemos atualizar esta Politica para refletir mudancas no site, nos servicos, em parceiros ou em
              exigencias legais. A versao vigente sera publicada nesta pagina.
            </p>
          </section>
        </div>
      </article>
    </main>
  );
}
