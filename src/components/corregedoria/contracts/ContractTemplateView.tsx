import React from 'react';
import { ContractFormState, FDS_FOOTER_INFO } from './contractData';
import { cn } from '@/lib/utils';
import { ShieldCheck, CheckCircle2 } from 'lucide-react';

interface ContractTemplateViewProps {
  data: ContractFormState;
  highlightFields?: boolean;
  onFieldClick?: (fieldName: keyof ContractFormState) => void;
}

export const ContractTemplateView: React.FC<ContractTemplateViewProps> = ({
  data,
  highlightFields = false,
  onFieldClick,
}) => {
  const renderVar = (value: string | number, fieldKey: keyof ContractFormState, placeholder = '[Não informado]') => {
    const text = value !== undefined && value !== null && String(value).trim() !== '' ? String(value) : placeholder;
    if (!highlightFields) {
      return <span>{text}</span>;
    }
    return (
      <span
        onClick={() => onFieldClick?.(fieldKey)}
        className="bg-amber-500/20 text-amber-900 dark:text-amber-200 px-1.5 py-0.5 rounded font-semibold border border-amber-500/30 cursor-pointer hover:bg-amber-500/30 transition-colors inline-block"
        title="Clique para editar este dado"
      >
        {text}
      </span>
    );
  };

  return (
    <div id="contract-printable-document" className="bg-white text-slate-900 font-sans shadow-2xl rounded-2xl md:rounded-3xl border border-slate-200 max-w-4xl mx-auto p-6 sm:p-12 md:p-16 space-y-12 print:p-0 print:shadow-none print:border-none print:rounded-none print:bg-transparent print:text-black">
      {/* Header FdS */}
      <div className="flex items-center justify-between border-b border-slate-200 pb-6 print:border-b-2 print:border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-[#fde047] flex items-center justify-center font-black text-black text-xl sm:text-2xl shadow-sm">
            FdS:
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-widest font-black text-slate-400">FdS Advogados</div>
            <div className="text-xs font-bold text-slate-600">Assessoria & Contratos Especializados</div>
          </div>
        </div>
        <div className="text-right hidden sm:block text-[10px] uppercase tracking-wider text-slate-500 font-medium">
          <div>Documento Registrado</div>
          <div className="text-emerald-600 font-bold flex items-center justify-end gap-1">
            <ShieldCheck className="w-3.5 h-3.5" /> Proteção Jurídica Ativa
          </div>
        </div>
      </div>

      {/* Contract Title */}
      <div className="text-center space-y-2 py-2">
        <h1 className="text-lg sm:text-2xl md:text-3xl font-black uppercase tracking-tight text-slate-900 print:text-xl">
          CONTRATO DE PRESTAÇÃO DE SERVIÇOS DE AGÊNCIA DE MARKETING
        </h1>
        <div className="w-24 h-1 bg-amber-400 mx-auto rounded-full print:bg-black" />
      </div>

      {/* Parties Qualification */}
      <div className="space-y-6 text-sm sm:text-base leading-relaxed text-slate-800">
        <div className="space-y-2">
          <div className="font-black text-slate-900 uppercase text-xs tracking-wider">CONTRATANTE:</div>
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 space-y-2 print:bg-transparent print:border-none print:p-0">
            <div className="text-xs font-black uppercase text-slate-500 tracking-wider">[QUALIFICAÇÃO COMPLETA CONTRATANTE]</div>
            {data.contractorType === 'pf' ? (
              <p>
                <strong>*SE PESSOA FÍSICA:</strong> {renderVar(data.contractorName, 'contractorName', '[Nome do Contratante]')}, CPF sob o nº {renderVar(data.contractorCpf, 'contractorCpf', '[000.000.000-00]')}, e-mail: {renderVar(data.contractorEmail, 'contractorEmail', '[email@cliente.com]')}
                {data.contractorCity ? <>, residente e domiciliado em {renderVar(data.contractorCity, 'contractorCity')}</> : null};
              </p>
            ) : (
              <p>
                <strong>*SE PESSOA JURÍDICA:</strong> {renderVar(data.contractorName, 'contractorName', '[Razão Social]')}, inscrita no CNPJ sob o nº {renderVar(data.contractorCnpj, 'contractorCnpj', '[00.000.000/0000-00]')}, com sede em {renderVar(data.contractorAddress || data.contractorCity, 'contractorAddress', '[Endereço Completo]')}, neste ato representada por seu representante legal {renderVar(data.contractorRepresentative || data.contractorName, 'contractorRepresentative', '[Representante Legal]')}, e-mail: {renderVar(data.contractorEmail, 'contractorEmail', '[email@empresa.com]')};
              </p>
            )}
          </div>
        </div>

        <div className="space-y-2">
          <div className="font-black text-slate-900 uppercase text-xs tracking-wider">CONTRATADA:</div>
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 space-y-2 print:bg-transparent print:border-none print:p-0">
            <div className="text-xs font-black uppercase text-slate-500 tracking-wider">[QUALIFICAÇÃO COMPLETA CONTRATADA]</div>
            <p>
              <strong>*PESSOA FÍSICA:</strong> {renderVar(data.agencyName, 'agencyName')}, [{renderVar(data.agencyRole, 'agencyRole')}], [CPF: {renderVar(data.agencyCpfCnpj, 'agencyCpfCnpj')}], [{renderVar(data.agencyState, 'agencyState')}] e-mail: {renderVar(data.agencyEmail, 'agencyEmail')};
            </p>
          </div>
        </div>

        <p className="text-justify leading-relaxed">
          Todos denominados conjuntamente <strong>“PARTES”</strong>, ajustam o presente <strong>CONTRATO DE PRESTAÇÃO DE SERVIÇOS DE AGÊNCIA DE MARKETING (“Contrato”)</strong>, nos termos das cláusulas e condições estipuladas a seguir.
        </p>

        {/* Considerandos */}
        <div className="space-y-3 pt-2">
          <div className="font-bold text-slate-900">CONSIDERANDO QUE:</div>
          <ol className="list-decimal pl-6 space-y-2 text-justify">
            <li>A CONTRATADA é empresa/profissional com atuação no nicho [{renderVar(data.agencyNiche, 'agencyNiche')}];</li>
            <li>A CONTRATADA presta serviços para outras empresas com atuação no nicho [{renderVar(data.agencySubNiche, 'agencySubNiche')}];</li>
            <li>A CONTRATADA não possui regime de exclusividade com nenhuma das empresas em que presta serviços;</li>
            <li>As PARTES reconhecem que dispõem de liberdade negocial para assumir direitos e obrigações, nos termos do art. 421-A, I a III, do Código Civil e do art. 3º, VIII, da Lei nº 13.874 de 2019.</li>
          </ol>
        </div>

        {/* Cláusula 1 - Objeto */}
        <div className="space-y-3 pt-4">
          <h2 className="text-base sm:text-lg font-black uppercase tracking-wide text-slate-900 border-b border-slate-200 pb-1">
            1. OBJETO
          </h2>
          <p>
            <strong>1.1.</strong> Prestação de serviços de marketing e design, conforme descrito abaixo:
          </p>
          <div className="pl-4 space-y-2">
            <p>
              <strong>1.1.1.</strong> {renderVar(data.methodName, 'methodName')}:
            </p>
            <div className="pl-4 space-y-2 font-medium">
              <p className="font-bold text-slate-900">● {renderVar(data.eventName, 'eventName')}</p>
              <ul className="list-disc pl-6 space-y-1">
                <li>
                  <strong>Artes Estáticas:</strong> {renderVar(data.artCount, 'artCount')} itens, {renderVar(data.artDescription, 'artDescription')}
                </li>
                <li>
                  <strong>Vídeos Animados:</strong> {renderVar(data.motionCount, 'motionCount')} vídeos, {renderVar(data.motionDescription, 'motionDescription')}
                </li>
                {data.djCount > 0 && (
                  <li>
                    <strong>Material de DJs e Atrações:</strong> Cobertura e adaptação visual para {renderVar(data.djCount, 'djCount')} atrações/artistas.
                  </li>
                )}
              </ul>
            </div>
          </div>
        </div>

        {/* Cláusula 2 - Vigência e Rescisão */}
        <div className="space-y-3 pt-4">
          <h2 className="text-base sm:text-lg font-black uppercase tracking-wide text-slate-900 border-b border-slate-200 pb-1">
            2. VIGÊNCIA E RESCISÃO
          </h2>
          <p className="text-justify">
            <strong>2.1.</strong> Este Contrato terá vigência de [{renderVar(data.durationMonths, 'durationMonths')}] meses, contados a partir de [{renderVar(data.startDate, 'startDate')}].
          </p>
          <p className="text-justify">
            <strong>2.2.</strong> Em caso de silêncio das PARTES após o transcurso do prazo de vigência, presume-se a intenção de prorrogação.
          </p>
          <p className="text-justify">
            <strong>2.3.</strong> Este Contrato poderá ser rescindido a qualquer momento, por qualquer uma das PARTES, mediante comunicação prévia de {renderVar(data.noticePeriodDays, 'noticePeriodDays')} ({data.noticePeriodDays === 30 ? 'trinta' : data.noticePeriodDays}) dias por escrito e pagamento, pela CONTRATANTE à CONTRATADA, de todos os valores referentes aos serviços efetivamente prestados.
          </p>
        </div>

        {/* Cláusula 3 - Remuneração */}
        <div className="space-y-3 pt-4">
          <h2 className="text-base sm:text-lg font-black uppercase tracking-wide text-slate-900 border-b border-slate-200 pb-1">
            3. REMUNERAÇÃO
          </h2>
          <p className="text-justify">
            <strong>3.1.</strong> A CONTRATANTE pagará à CONTRATADA, a título de contraprestação pelos serviços prestados, o valor total de [{renderVar(data.totalValue, 'totalValue')}], mediante depósito ou transferência PIX na conta da CONTRATADA [{renderVar(data.agencyPix, 'agencyPix')}].
          </p>
          <p className="text-justify">
            <strong>3.2.</strong> O pagamento descrito na Cláusula anterior será realizado da seguinte forma:
          </p>
          <ol className="list-[lower-alpha] pl-6 space-y-2 text-justify">
            <li>
              <strong>{renderVar(data.installment1Percent, 'installment1Percent')}% (cinquenta por cento)</strong> do valor total, a título de adiantamento/sinal para início dos trabalhos, a ser pago antes do início da execução dos serviços;
            </li>
            <li>
              <strong>{renderVar(data.installment2Percent, 'installment2Percent')}% (vinte e cinco por cento)</strong> do valor total, a serem pagos quando os serviços estiverem substancialmente concluídos, caracterizados pela entrega das artes em estágio avançado ou pré-final;
            </li>
            <li>
              <strong>{renderVar(data.installment3Percent, 'installment3Percent')}% (vinte e cinco por cento)</strong> restantes, a serem pagos na conclusão integral dos serviços, no ato da entrega final dos materiais contratados.
            </li>
          </ol>
          <ul className="list-disc pl-6 space-y-1.5 text-justify pt-1">
            <li>Os serviços somente serão iniciados após a confirmação do pagamento da primeira parcela ({data.installment1Percent}%).</li>
            <li>A entrega final dos arquivos em alta resolução ficará condicionada à quitação integral do valor contratado.</li>
            <li>Em caso de cancelamento do Contrato por iniciativa da CONTRATANTE após o início dos trabalhos, o valor pago a título de sinal não será devolvido, por se tratar de remuneração pelos serviços já iniciados.</li>
          </ul>
          <p className="text-justify">
            <strong>3.3.</strong> Em caso de eventual atraso no pagamento dos honorários pactuados, deverá a CONTRATADA notificar a CONTRATANTE para regularização no prazo de 2 dias úteis. Ultrapassado tal prazo e persistindo o inadimplemento, implicará na cobrança de multa moratória de {renderVar(data.finePercent, 'finePercent')}% (dez por cento), juros de mora à razão de {renderVar(data.interestPercent, 'interestPercent')}% (um por cento) ao mês <em>pro rata</em>, além da correção monetária pelo IPCA.
          </p>
          <p className="text-justify">
            <strong>3.4.</strong> A CONTRATADA reserva-se o direito de suspender imediatamente a prestação dos serviços contratados caso a CONTRATANTE deixe de efetuar o pagamento de qualquer parcela na forma e prazos estabelecidos neste Contrato.
          </p>
          <div className="pl-4 space-y-1 text-sm text-slate-700">
            <p><strong>3.4.1.</strong> A suspensão perdurará até a regularização integral dos valores em atraso.</p>
            <p><strong>3.4.2.</strong> Durante o período de suspensão, não serão acumuladas quaisquer obrigações ou responsabilidades adicionais quanto à execução dos serviços.</p>
            <p><strong>3.4.3.</strong> A suspensão poderá ocorrer independentemente de comunicação prévia, não sendo a CONTRATADA responsabilizada por quaisquer resultados decorrentes da suspensão.</p>
            <p><strong>3.4.4.</strong> A suspensão não exime a CONTRATANTE da obrigação de pagamento das parcelas vencidas com os encargos devidos.</p>
          </div>
        </div>

        {/* Cláusula 4 - Propriedade Intelectual */}
        <div className="space-y-3 pt-4">
          <h2 className="text-base sm:text-lg font-black uppercase tracking-wide text-slate-900 border-b border-slate-200 pb-1">
            4. PROPRIEDADE INTELECTUAL
          </h2>
          <p className="text-justify">
            <strong>4.1.</strong> Toda propriedade intelectual referente aos conteúdos publicitários ou de marca de qualquer gênero utilizados ou produzidos no âmbito deste Contrato serão de titularidade exclusiva da CONTRATANTE após a devida quitação.
          </p>
          <p className="text-justify">
            <strong>4.1.1.</strong> A estratégia de marca e a metodologia de design desenvolvidas e utilizadas pela CONTRATADA são de sua exclusiva titularidade e não são cedidas à CONTRATANTE.
          </p>
          <p className="text-justify">
            <strong>4.2.</strong> As estratégias de gerenciamento e impulsionamentos em redes sociais serão executadas no painel da CONTRATADA com apresentação de relatórios de desempenho quando aplicável.
          </p>
          <p className="text-justify">
            <strong>4.3.</strong> É vedado a uma PARTE promover o registro de qualquer propriedade intelectual de titularidade da PARTE oposta.
          </p>
          <p className="text-justify">
            <strong>4.4.</strong> É vedado à CONTRATANTE reproduzir a metodologia de trabalho desenvolvida pela CONTRATADA em contratos com terceiros.
          </p>
        </div>

        {/* Cláusula 5 & 6 - Obrigações */}
        <div className="grid md:grid-cols-2 gap-6 pt-4">
          <div className="space-y-3 p-4 rounded-2xl bg-slate-50 border border-slate-100 print:bg-transparent print:border-none print:p-0">
            <h2 className="text-base font-black uppercase tracking-wide text-slate-900 border-b border-slate-200 pb-1">
              5. OBRIGAÇÕES DA CONTRATADA
            </h2>
            <ul className="list-disc pl-5 space-y-1.5 text-xs sm:text-sm text-justify">
              <li>Executar as funções objeto do presente Contrato conforme item 1;</li>
              <li>Realizar a gestão e segurança dos arquivos e dados recebidos;</li>
              <li>Responder a questionamentos da CONTRATANTE em até 2 dias úteis;</li>
              <li>Solucionar demandas solicitadas em até 30 dias úteis após confirmação;</li>
              <li>Guardar e conservar com sigilo materiais e informações da CONTRATANTE.</li>
            </ul>
          </div>
          <div className="space-y-3 p-4 rounded-2xl bg-slate-50 border border-slate-100 print:bg-transparent print:border-none print:p-0">
            <h2 className="text-base font-black uppercase tracking-wide text-slate-900 border-b border-slate-200 pb-1">
              6. OBRIGAÇÕES DO CONTRATANTE
            </h2>
            <ul className="list-disc pl-5 space-y-1.5 text-xs sm:text-sm text-justify">
              <li>Realizar os pagamentos previstos na Cláusula 3 rigorosamente em dia;</li>
              <li>Manifestar aceite ou recusa dos materiais apresentados com presteza;</li>
              <li>Fornecer condições, acessos e plataformas necessárias para execução;</li>
              <li>Providenciar materiais solicitados em até 3 dias úteis após requerimento.</li>
            </ul>
          </div>
        </div>

        {/* Cláusula 7 a 11 - Cláusula Penal, Disposições, Sigilo, LGPD e Ausência de Vínculo */}
        <div className="space-y-3 pt-4">
          <h2 className="text-base sm:text-lg font-black uppercase tracking-wide text-slate-900 border-b border-slate-200 pb-1">
            7. CLÁUSULA PENAL E RESCISÃO
          </h2>
          <p className="text-justify">
            <strong>7.1.</strong> Eventual descumprimento de quaisquer das obrigações dispostas no presente instrumento implicará em rescisão de pleno direito e aplicação de multa de 10% (dez por cento) sobre o valor global do Contrato ao responsável, ressalvada a rescisão amigável com aviso prévio de 30 dias.
          </p>
        </div>

        <div className="space-y-3 pt-2">
          <h2 className="text-base sm:text-lg font-black uppercase tracking-wide text-slate-900 border-b border-slate-200 pb-1">
            8. SIGILO, CONFIDENCIALIDADE E LGPD
          </h2>
          <p className="text-justify">
            <strong>8.1.</strong> As PARTES comprometem-se ao mais absoluto sigilo profissional sobre informações e estratégias internas compartilhadas.
          </p>
          <p className="text-justify">
            <strong>8.2.</strong> Em estrita observância à Lei Geral de Proteção de Dados (Lei nº 13.709/2018 - LGPD), todos os dados tratados serão utilizados exclusivamente para a execução do contrato.
          </p>
          <p className="text-justify">
            <strong>8.3.</strong> A CONTRATANTE autoriza expressamente a CONTRATADA a utilizar as artes e materiais visuais desenvolvidos no âmbito deste Contrato para fins de portfólio, divulgação institucional e publicação em redes sociais (incluindo Instagram @marksbeys / Backstage).
          </p>
        </div>

        <div className="space-y-3 pt-2">
          <h2 className="text-base sm:text-lg font-black uppercase tracking-wide text-slate-900 border-b border-slate-200 pb-1">
            9. ASSINATURA DIGITAL E FORO
          </h2>
          <p className="text-justify">
            <strong>9.1.</strong> As PARTES e testemunhas estabelecem que as assinaturas deste Contrato serão realizadas por escrito ou de forma eletrônica por meio de plataformas que garantam a validade e higidez jurídica das assinaturas eletrônicas.
          </p>
          <p className="text-justify">
            <strong>9.2.</strong> As PARTES elegem, em comum acordo, o foro da Comarca de [{renderVar(data.forumCity, 'forumCity')}] para dirimir quaisquer dúvidas e/ou omissões em relação ao presente Contrato.
          </p>
        </div>

        {/* Closing & Signatures */}
        <div className="pt-6 space-y-8 border-t border-slate-200">
          <p className="text-center font-medium">
            Por estarem assim contratados, nos termos de seus respectivos interesses, as PARTES assinam o presente Contrato em 2 (duas) vias de idêntico teor, na presença de 2 (duas) testemunhas.
          </p>

          <div className="text-center font-bold text-slate-900 py-2">
            [{renderVar(data.signatureDate, 'signatureDate')}]
          </div>

          <div className="grid md:grid-cols-2 gap-8 pt-4">
            {/* Contratante Signature Block */}
            <div className="border border-slate-200 rounded-2xl p-5 space-y-4 bg-slate-50/50 print:border-black print:p-2">
              <div className="text-xs font-black uppercase text-slate-500 tracking-wider">CONTRATANTE:</div>
              <div className="h-16 flex items-end justify-center border-b border-slate-400 pb-1">
                {data.isSigned ? (
                  <div className="text-center">
                    <div className="font-serif italic text-lg text-indigo-900">{data.contractorName}</div>
                    <div className="text-[9px] text-emerald-600 font-bold flex items-center justify-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> Assinado Digitalmente
                    </div>
                  </div>
                ) : (
                  <span className="text-xs text-slate-400 italic">Espaço para Assinatura</span>
                )}
              </div>
              <div className="text-xs space-y-1 text-slate-700">
                <div className="font-bold text-slate-900">[{renderVar(data.contractorName, 'contractorName')}]</div>
                <div>CPF/CNPJ: {renderVar(data.contractorCpf || data.contractorCnpj, 'contractorCpf')}</div>
                <div>e-mail: {renderVar(data.contractorEmail, 'contractorEmail')}</div>
              </div>
              {/* Digital Badge Box */}
              <div className="bg-white rounded-xl p-3 border border-slate-200 text-[10px] space-y-1 text-slate-600 shadow-sm print:shadow-none">
                <div className="font-black text-indigo-600 uppercase flex items-center justify-between">
                  <span>Signatário Certificado</span>
                  <span className="bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded text-[8px]">ICP-Brasil</span>
                </div>
                <div>Assinado eletronicamente por {data.contractorName || 'Contratante'}</div>
                <div className="text-[8px] text-slate-400">Data: {data.signerSignedAt} | Hash: #{data.signerHash}</div>
              </div>
            </div>

            {/* Contratada Signature Block */}
            <div className="border border-slate-200 rounded-2xl p-5 space-y-4 bg-slate-50/50 print:border-black print:p-2">
              <div className="text-xs font-black uppercase text-slate-500 tracking-wider">CONTRATADA:</div>
              <div className="h-16 flex items-end justify-center border-b border-slate-400 pb-1">
                <div className="text-center">
                  <div className="font-serif italic text-xl text-slate-900 font-bold">Marcos A. Santos</div>
                  <div className="text-[9px] text-emerald-600 font-bold flex items-center justify-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> Assinatura Válida
                  </div>
                </div>
              </div>
              <div className="text-xs space-y-1 text-slate-700">
                <div className="font-bold text-slate-900">[{renderVar(data.agencyName, 'agencyName')}]</div>
                <div>CPF: {renderVar(data.agencyCpfCnpj, 'agencyCpfCnpj')}</div>
                <div>e-mail: {renderVar(data.agencyEmail, 'agencyEmail')}</div>
              </div>
              <div className="bg-white rounded-xl p-3 border border-slate-200 text-[10px] space-y-1 text-slate-600 shadow-sm print:shadow-none">
                <div className="font-black text-emerald-600 uppercase flex items-center justify-between">
                  <span>Agência Backstage</span>
                  <span className="bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded text-[8px]">Verificado</span>
                </div>
                <div>Marcos Antonio dos Santos - Publicitário</div>
                <div className="text-[8px] text-slate-400">PIX: {data.agencyPix}</div>
              </div>
            </div>
          </div>

          {/* Testemunhas */}
          <div className="space-y-4 pt-4 border-t border-slate-200">
            <div className="text-xs font-black uppercase text-slate-500 tracking-wider">TESTEMUNHAS:</div>
            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <div className="border-b border-slate-400 h-10 flex items-end pb-1 text-xs text-slate-600">
                  {data.witness1Name ? data.witness1Name : '1. ____________________________'}
                </div>
                <div className="text-xs text-slate-700">
                  <div>Nome: [{renderVar(data.witness1Name, 'witness1Name', 'Testemunha 1')}]</div>
                  <div>CPF: [{renderVar(data.witness1Cpf, 'witness1Cpf', '000.000.000-00')}]</div>
                </div>
              </div>

              <div className="space-y-2">
                <div className="border-b border-slate-400 h-10 flex items-end pb-1 text-xs text-slate-600">
                  {data.witness2Name ? data.witness2Name : '2. ____________________________'}
                </div>
                <div className="text-xs text-slate-700">
                  <div>Nome: [{renderVar(data.witness2Name, 'witness2Name')}]</div>
                  <div>CPF: [{renderVar(data.witness2Cpf, 'witness2Cpf')}]</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="pt-8 border-t border-slate-200 text-center text-[10px] text-slate-500 space-y-1 print:border-t-2 print:border-slate-800">
        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 font-semibold text-slate-700">
          <span>{FDS_FOOTER_INFO.website}</span>
          <span>•</span>
          <span>{FDS_FOOTER_INFO.address}</span>
          <span>•</span>
          <span>{FDS_FOOTER_INFO.instagram}</span>
          <span>•</span>
          <span>{FDS_FOOTER_INFO.phone}</span>
        </div>
        <div className="text-slate-400">{FDS_FOOTER_INFO.email}</div>
      </div>
    </div>
  );
};
