import type { Metadata } from 'next';
import { headers } from 'next/headers';
import EsposasVisitaClient from './EsposaClient';

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
    ? `Programação da Esposa — Congregação ${cong}${periodo ? ` (${periodo})` : ''}`
    : 'Programação Semanal da Visita — Link Único da Esposa';

  const description = cong
    ? `Confira a programação de campo, refeições, estudos bíblicos e reuniões da visita à Congregação ${cong}${periodo ? ` (${periodo})` : ''}.`
    : 'Link fixo atualizado automaticamente a cada semana com saídas de campo, estudos bíblicos, reuniões e almoços da visita.';

  const ogParams = new URLSearchParams({ tipo: 'esposa' });
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

export default function EsposasVisitaPage() {
  return <EsposasVisitaClient />;
}

