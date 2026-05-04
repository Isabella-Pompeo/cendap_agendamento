import Link from 'next/link';
import styles from '../legal-page.module.css';

export const metadata = {
  title: 'Termos de Uso | CENDAP',
  description: 'Termos de uso do sistema de agendamento online da CENDAP.',
};

const UPDATED_AT = '02/05/2026';

const sectionStyle = {
  display: 'flex',
  flexDirection: 'column' as const,
  gap: '0.75rem',
};

export default function TermsPage() {
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
          Termos de Uso
        </h1>
        <p style={{ margin: '0 0 28px', color: '#64748b', fontWeight: 600 }}>
          Ultima atualizacao: {UPDATED_AT}
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '28px', lineHeight: 1.7 }}>
          <section style={sectionStyle}>
            <h2>1. Aceite dos Termos</h2>
            <p>
              Ao acessar ou usar o site de agendamento online da CENDAP, o usuario declara que leu, compreendeu e
              concorda com estes Termos de Uso e com a Politica de Privacidade.
            </p>
          </section>

          <section style={sectionStyle}>
            <h2>2. Finalidade do site</h2>
            <p>
              O site tem a finalidade de facilitar agendamentos de consultas, exames, telemedicina, lista de espera,
              acesso a informacoes basicas de atendimento, pagamento de telemedicina e envio de documentos ou exames
              quando aplicavel.
            </p>
            <p>
              O site nao substitui atendimento medico presencial ou emergencial. Em caso de urgencia, emergencia,
              agravamento de sintomas ou risco imediato, procure atendimento de emergencia ou servico de saude adequado.
            </p>
          </section>

          <section style={sectionStyle}>
            <h2>3. Cadastro e responsabilidade do usuario</h2>
            <p>O usuario se compromete a fornecer informacoes verdadeiras, completas e atualizadas, incluindo nome, CPF e telefone.</p>
            <p>
              O usuario e responsavel por manter seus dados de acesso em seguranca e por informar a clinica caso
              perceba uso indevido de sua conta ou informacoes incorretas em seus agendamentos.
            </p>
            <p>
              Antes de confirmar um agendamento, pagamento ou envio de documento, o usuario deve revisar os dados
              exibidos na tela e corrigir eventuais erros pelos campos disponiveis ou pelos canais oficiais da clinica.
            </p>
          </section>

          <section style={sectionStyle}>
            <h2>4. Agendamentos, horarios e disponibilidade</h2>
            <p>
              Datas, horarios, profissionais, especialidades e valores exibidos podem variar conforme disponibilidade
              da agenda, regras internas da clinica, feriados, lotacao, modalidade de atendimento e necessidade de
              confirmacao.
            </p>
            <p>
              A CENDAP pode entrar em contato para confirmar, remarcar ou cancelar um agendamento quando houver
              necessidade operacional, informacao incompleta, indisponibilidade do profissional ou outro motivo
              justificado.
            </p>
          </section>

          <section style={sectionStyle}>
            <h2>5. Telemedicina</h2>
            <p>
              A telemedicina sera realizada por sala online, quando disponivel e adequada ao tipo de atendimento.
              O paciente deve garantir conexao de internet, dispositivo compativel, ambiente adequado e dados corretos
              para acesso.
            </p>
            <p>
              Ao escolher telemedicina, o paciente declara estar ciente das caracteristicas do atendimento remoto,
              da transmissao de dados, audio e imagem, e da possibilidade de o profissional indicar atendimento
              presencial quando necessario. O paciente pode recusar o atendimento remoto e buscar atendimento presencial.
            </p>
            <p>
              O profissional de saude podera orientar continuidade, retorno, atendimento presencial, exames ou
              encaminhamento, conforme criterio tecnico e condicoes clinicas apresentadas.
            </p>
          </section>

          <section style={sectionStyle}>
            <h2>6. Pagamentos</h2>
            <p>
              Pagamentos de telemedicina podem ser processados por plataformas terceiras de pagamento. A confirmacao
              do atendimento pode depender da aprovacao do pagamento e da comunicacao do status ao sistema.
            </p>
            <p>
              Valores, descontos, cupons, reembolsos e remarcacoes podem seguir regras informadas no momento do
              agendamento ou pelos canais oficiais da clinica.
            </p>
            <p>
              Pedidos de cancelamento, remarcacao, estorno ou exercicio de direito de arrependimento, quando aplicavel
              pela legislacao de consumo, devem ser solicitados pelos canais oficiais da CENDAP e serao analisados
              conforme o status do pagamento, a proximidade do horario agendado e as regras legais aplicaveis.
            </p>
          </section>

          <section style={sectionStyle}>
            <h2>7. Envio de exames e documentos</h2>
            <p>
              O usuario pode enviar arquivos relacionados ao atendimento quando essa funcionalidade estiver disponivel.
              O usuario declara que possui direito de enviar tais arquivos e que eles correspondem ao paciente correto.
            </p>
            <p>
              Arquivos inadequados, ilegais, de terceiros sem autorizacao ou fora do contexto de saude podem ser
              removidos ou desconsiderados.
            </p>
          </section>

          <section style={sectionStyle}>
            <h2>8. Uso permitido e condutas proibidas</h2>
            <p>O usuario nao deve:</p>
            <ul>
              <li>usar o site para inserir dados falsos ou de terceiros sem autorizacao;</li>
              <li>tentar acessar contas, consultas, salas ou documentos de outras pessoas;</li>
              <li>interferir no funcionamento do sistema, automatizar acessos indevidos ou explorar falhas;</li>
              <li>enviar conteudo malicioso, ofensivo, ilegal ou sem relacao com o atendimento.</li>
            </ul>
          </section>

          <section style={sectionStyle}>
            <h2>9. Disponibilidade do sistema</h2>
            <p>
              Buscamos manter o site em funcionamento, mas podem ocorrer indisponibilidades por manutencao, internet,
              integracoes de terceiros, meios de pagamento, provedores de hospedagem ou eventos fora do controle da
              CENDAP.
            </p>
          </section>

          <section style={sectionStyle}>
            <h2>10. Propriedade intelectual</h2>
            <p>
              Marcas, textos, imagens, layout, componentes e demais conteudos do site pertencem a CENDAP ou a seus
              respectivos titulares. O uso do site nao concede licenca para copiar, explorar ou modificar esses
              conteudos fora das funcionalidades oferecidas.
            </p>
          </section>

          <section style={sectionStyle}>
            <h2>11. Privacidade e protecao de dados</h2>
            <p>
              O tratamento de dados pessoais e explicado na Politica de Privacidade. Ao usar o site, o usuario
              reconhece que seus dados poderao ser tratados para viabilizar cadastro, agendamento, pagamentos,
              telemedicina, suporte e cumprimento de obrigacoes legais.
            </p>
          </section>

          <section style={sectionStyle}>
            <h2>12. Alteracoes dos Termos</h2>
            <p>
              A CENDAP pode atualizar estes Termos para refletir mudancas no site, na operacao ou em exigencias
              legais. A versao vigente sera publicada nesta pagina.
            </p>
          </section>

          <section style={sectionStyle}>
            <h2>13. Contato</h2>
            <p>
              Para duvidas sobre estes Termos, agendamentos ou uso do sistema, entre em contato pelo WhatsApp:
              (91) 98109-7045.
            </p>
          </section>
        </div>
      </article>
    </main>
  );
}
