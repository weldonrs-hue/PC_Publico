import type { Metadata } from 'next';
import { headers } from 'next/headers';
import PublicVisitScheduleClient from './VisitaClient';

type PageProps = {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ cong?: string; periodo?: string }>;
};

export async function generateMetadata({ searchParams }: PageProps): Promise<Metadata> {
  const sp = await searchParams;
  const hdrs = await headers();
  const host = hdrs.get('x-forwarded-host') || hdrs.get('host') || 'localhost:3000';
  const proto = hdrs.get('x-forwarded-proto') || (host.includes('localhost') ? 'http' : 'https');
  const origin = `${proto}://${host}`;

  const cong = sp?.cong || '';
  const periodo = sp?.periodo || '';

  const title = cong
    ? `Semana da Visita — Congregação ${cong}${periodo ? ` (${periodo})` : ''}`
    : 'Semana da Visita — Comissão de Serviço (Anciãos)';

  const description = cong
    ? `Programação de atividades da Congregação ${cong}${periodo ? ` • Período: ${periodo}` : ''}. Preenchimento de saídas de campo, refeições e pastoreio.`
    : 'Link para preenchimento das saídas de campo, refeições e visitas de pastoreio da semana da visita.';

  const ogParams = new URLSearchParams({ tipo: 'anciaos' });
  if (cong) ogParams.set('cong', cong);
  if (periodo) ogParams.set('periodo', periodo);
  const ogImageUrl = `${origin}/api/og/visita?${ogParams.toString()}`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'website',
      images: [
        {
          url: ogImageUrl,
          width: 1200,
          height: 630,
          alt: title,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [ogImageUrl],
    },
  };
}

export default function PublicVisitSchedulePage() {
  return <PublicVisitScheduleClient />;
}

