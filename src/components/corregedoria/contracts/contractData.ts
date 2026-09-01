import { EventProject, UserProfile } from '../../../types';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export interface ContractFormState {
  // Contratante (Cliente)
  contractorName: string;
  contractorType: 'pf' | 'pj';
  contractorCpf: string;
  contractorCnpj: string;
  contractorEmail: string;
  contractorPhone: string;
  contractorAddress: string;
  contractorCity: string;
  contractorState: string;
  contractorRepresentative: string;

  // Contratada (Agência / Designer)
  agencyName: string;
  agencyRole: string;
  agencyCpfCnpj: string;
  agencyState: string;
  agencyEmail: string;
  agencyPix: string;

  // Nichos e Objeto
  agencyNiche: string;
  agencySubNiche: string;
  methodName: string;
  eventName: string;
  artCount: number;
  artDescription: string;
  motionCount: number;
  motionDescription: string;
  djCount: number;

  // Vigência e Prazos
  durationMonths: number;
  startDate: string;
  noticePeriodDays: number;

  // Valores e Pagamento
  totalValue: string;
  installment1Percent: number;
  installment2Percent: number;
  installment3Percent: number;
  finePercent: number;
  interestPercent: number;

  // Foro e Assinatura
  forumCity: string;
  signatureCity: string;
  signatureState: string;
  signatureDate: string;

  // Testemunhas
  witness1Name: string;
  witness1Cpf: string;
  witness2Name: string;
  witness2Cpf: string;

  // Status e Assinatura Digital
  isSigned: boolean;
  signerHash: string;
  signerSignedAt: string;
}

export function getDefaultContractForm(event: EventProject, profile: UserProfile): ContractFormState {
  const now = new Date();
  const formattedToday = format(now, "dd/MM/yyyy", { locale: ptBR });
  const formattedCityDate = `${event.city ? event.city.split('-')[0].trim() : 'Belo Horizonte'} - ${event.city && event.city.includes('-') ? event.city.split('-')[1].trim() : 'MG'}, ${formattedToday}`;

  let rawCity = event.city || 'Belo Horizonte - MG';
  let cityName = rawCity;
  let stateName = 'Minas Gerais';
  if (rawCity.includes('-')) {
    const parts = rawCity.split('-');
    cityName = parts[0].trim();
    stateName = parts[1].trim();
  }

  return {
    contractorName: event.contractorName || (profile.role === 'contractor' ? profile.name : 'Iago Pavarote da Silva Moura'),
    contractorType: 'pf',
    contractorCpf: '021.255.892-73',
    contractorCnpj: '',
    contractorEmail: event.contractorEmail || (profile.role === 'contractor' ? profile.email : 'pavarote75@gmail.com'),
    contractorPhone: '',
    contractorAddress: '',
    contractorCity: cityName,
    contractorState: stateName,
    contractorRepresentative: '',

    agencyName: 'Marcos Antonio dos Santos',
    agencyRole: 'Publicitário',
    agencyCpfCnpj: '606.909.853-63',
    agencyState: 'Minas Gerais',
    agencyEmail: 'marksbeys@proton.me',
    agencyPix: 'marksbeys@proton.me',

    agencyNiche: 'Marketing',
    agencySubNiche: 'Design',
    methodName: 'Implementação do Método Shubham Pacote Completo',
    eventName: event.name || 'Desenvolvimento Material Festa Eventos',
    artCount: event.artCount || 30,
    artDescription: 'incluindo flyers principais, artes para redes sociais, line-up e mais.',
    motionCount: event.motionCount || 15,
    motionDescription: 'com motions de DJs e motion principal, usando mix de imagens e efeitos dinâmicos.',
    djCount: event.djCount || 0,

    durationMonths: 4,
    startDate: event.eventDate || formattedToday,
    noticePeriodDays: 30,

    totalValue: event.paymentValue ? (event.paymentValue.startsWith('R$') ? event.paymentValue : `R$ ${event.paymentValue}`) : 'R$ 700,00',
    installment1Percent: 50,
    installment2Percent: 25,
    installment3Percent: 25,
    finePercent: 10,
    interestPercent: 1,

    forumCity: cityName || 'Belo Horizonte',
    signatureCity: cityName || 'Belo Horizonte',
    signatureState: stateName || 'MG',
    signatureDate: formattedCityDate,

    witness1Name: '',
    witness1Cpf: '',
    witness2Name: 'Stéfani Gasparoti',
    witness2Cpf: '501.680.088-07',

    isSigned: false,
    signerHash: '8e1df5f7437b11f1bb8342010a2b6020',
    signerSignedAt: `${formattedToday} 10:36`,
  };
}

export const FDS_FOOTER_INFO = {
  website: 'www.fdsadvogados.com',
  address: 'Scs, Edifício Morro Vermelho Brasília - DF',
  instagram: '@fds.adv',
  phone: '+55 61 3964-0838',
  email: 'contato@fdsadvogados.com',
};
