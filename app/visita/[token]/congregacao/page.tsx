import type { Metadata } from 'next';
import { headers } from 'next/headers';
import CongregacaoMuralClient from './CongregacaoClient';

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
    ? `Mural da Visita — Congregação ${cong}${periodo ? ` (${periodo})` : ''}`
    : 'Mural Público da Semana da Visita';

  const description = cong
    ? `Confira os horários e locais das Saídas de Serviço de Campo e das Reuniões da Congregação ${cong}${periodo ? ` (${periodo})` : ''}.`
    : 'Confira os horários e locais das Saídas de Serviço de Campo e das Reuniões da Semana da Visita.';

  const ogParams = new URLSearchParams({ tipo: 'congregacao' });
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

export default function CongregacaoMuralPage() {
  return <CongregacaoMuralClient />;
}

