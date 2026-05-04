import Link from 'next/link';
import styles from '../legal-page.module.css';

export const metadata = {
  title: 'Politica de Telemedicina | CENDAP',
  description: 'Politica de telemedicina do sistema de agendamento online da CENDAP.',
};

const UPDATED_AT = '02/05/2026';

const sectionStyle = {
  display: 'flex',
  flexDirection: 'column' as const,
  gap: '0.75rem',
};

export default function TelemedicinePolicyPage() {
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
          Politica de Telemedicina
        </h1>
        <p style={{ margin: '0 0 28px', color: '#64748b', fontWeight: 600 }}>
          Ultima atualizacao: {UPDATED_AT}
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '28px', lineHeight: 1.7 }}>
          <section style={sectionStyle}>
            <h2>1. Objetivo</h2>
            <p>
              Esta Politica explica as regras aplicaveis aos atendimentos por telemedicina realizados por meio do
              sistema de agendamento online da CENDAP. Ela complementa os Termos de Uso e a Politica de Privacidade.
            </p>
          </section>

          <section style={sectionStyle}>
            <h2>2. O que e telemedicina</h2>
            <p>
              A telemedicina permite atendimento medico a distancia por videochamada, quando tecnicamente adequado
              e conforme criterio do profissional de saude. O atendimento pode envolver orientacao, avaliacao clinica,
              solicitacao de exames, emissao de documentos medicos e recomendacao de retorno ou atendimento presencial.
            </p>
          </section>

          <section style={sectionStyle}>
            <h2>3. Consentimento e direito de recusa</h2>
            <p>
              Ao agendar e acessar a telemedicina, o paciente declara estar ciente das caracteristicas do atendimento
              remoto, incluindo transmissao de dados, audio e imagem, limites da avaliacao a distancia, uso de sistemas
              tecnologicos e tratamento de dados de saude para viabilizar a consulta.
            </p>
            <p>
              O paciente pode recusar o atendimento por telemedicina e buscar atendimento presencial. O profissional
              tambem pode indicar atendimento presencial quando entender que a modalidade remota nao e adequada,
              suficiente ou segura para o caso.
            </p>
          </section>

          <section style={sectionStyle}>
            <h2>4. Quando a telemedicina nao deve ser usada</h2>
            <p>
              A telemedicina nao substitui atendimento de urgencia ou emergencia. Em caso de dor intensa, falta de ar,
              desmaio, sangramento importante, sinais neurologicos, piora rapida do estado geral, risco imediato ou
              qualquer situacao grave, procure atendimento presencial de emergencia ou servico de saude adequado.
            </p>
          </section>

          <section style={sectionStyle}>
            <h2>5. Agendamento e pagamento</h2>
            <p>
              O atendimento por telemedicina pode depender de pagamento aprovado. A sala online e a consulta sao
              liberadas conforme confirmacao do pagamento e disponibilidade do profissional.
            </p>
            <p>
              Remarcacoes, cancelamentos, atrasos e reembolsos seguem as regras informadas pela CENDAP nos canais
              oficiais e podem depender de analise operacional.
            </p>
            <p>
              Caso o paciente cancele a telemedicina e queira solicitar reembolso, deve entrar em contato com a clinica
              pelo e-mail cdlacp@gmail.com, pelo WhatsApp (91) 98109-7045 ou pelo Instagram oficial @cendapcap. A equipe interna
              ira analisar a solicitacao e realizar o reembolso quando os dados e as condicoes do caso estiverem corretos.
            </p>
          </section>

          <section style={sectionStyle}>
            <h2>6. Acesso a sala online</h2>
            <p>
              O paciente deve acessar a sala pelo link disponibilizado no sistema, com antecedencia, usando dispositivo
              com camera, microfone, internet estavel e navegador compativel. O acesso pode ser liberado proximo ao
              horario agendado.
            </p>
            <p>
              Links, tokens e salas de telemedicina sao individuais e nao devem ser compartilhados com terceiros sem
              autorizacao.
            </p>
          </section>

          <section style={sectionStyle}>
            <h2>7. Responsabilidades do paciente</h2>
            <p>O paciente deve:</p>
            <ul>
              <li>informar dados corretos e atualizados;</li>
              <li>estar em local reservado, iluminado e adequado para o atendimento;</li>
              <li>garantir conexao de internet, bateria e funcionamento de camera e microfone;</li>
              <li>relatar sintomas, historico, medicamentos e informacoes relevantes com veracidade;</li>
              <li>enviar exames e documentos apenas quando relacionados ao proprio atendimento;</li>
              <li>seguir as orientacoes do profissional ou procurar atendimento presencial quando recomendado.</li>
            </ul>
          </section>

          <section style={sectionStyle}>
            <h2>8. Limites do atendimento remoto</h2>
            <p>
              Algumas situacoes exigem exame fisico, procedimentos, avaliacao presencial ou recursos indisponiveis
              em videochamada. O medico podera encerrar, remarcar ou converter o atendimento para presencial quando
              entender que a telemedicina nao e suficiente ou segura para o caso.
            </p>
          </section>

          <section style={sectionStyle}>
            <h2>9. Registro, privacidade e confidencialidade</h2>
            <p>
              A CENDAP trata dados pessoais e dados de saude conforme a Politica de Privacidade e a LGPD. O paciente
              deve evitar realizar a consulta em ambientes publicos ou com pessoas nao autorizadas ouvindo a conversa.
            </p>
            <p>
              As informacoes clinicas relevantes do atendimento podem ser registradas em prontuario, sistemas internos
              ou documentos medicos, conforme deveres profissionais, finalidade assistencial e obrigacoes legais.
            </p>
            <p>
              A gravacao da consulta por qualquer parte deve respeitar a legislacao aplicavel, deveres profissionais,
              privacidade e consentimentos necessarios.
            </p>
          </section>

          <section style={sectionStyle}>
            <h2>10. Exames, receitas e documentos</h2>
            <p>
              Quando aplicavel, o paciente pode enviar exames pelo sistema, e o medico pode emitir documentos digitais,
              como solicitacoes, orientacoes, receitas ou atestados, conforme avaliacao clinica e regras profissionais.
            </p>
            <p>
              A validade, uso e aceite de documentos medicos podem depender das regras legais, tecnicas e das entidades
              que receberao tais documentos.
            </p>
          </section>

          <section style={sectionStyle}>
            <h2>11. Falhas tecnicas</h2>
            <p>
              Instabilidades de internet, energia, dispositivo, navegador, plataforma de video ou sistemas de terceiros
              podem afetar a consulta. Quando possivel, a CENDAP ou o profissional orientarao remarcacao, novo acesso
              ou continuidade por canal apropriado.
            </p>
          </section>

          <section style={sectionStyle}>
            <h2>12. Contato</h2>
            <p>
              Para duvidas sobre telemedicina, acesso a sala, pagamento ou remarcacao, entre em contato pelo WhatsApp:
              (91) 98109-7045.
            </p>
          </section>
        </div>
      </article>
    </main>
  );
}
