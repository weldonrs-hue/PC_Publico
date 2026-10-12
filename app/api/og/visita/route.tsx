import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';

export const runtime = 'edge';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const tipo = searchParams.get('tipo') || 'anciaos'; // 'anciaos' | 'congregacao' | 'esposa'
  const cong = searchParams.get('cong') || '';
  const periodo = searchParams.get('periodo') || '';

  const configMap: Record<
    string,
    {
      badge: string;
      title: string;
      subtitle: string;
      bgGradient: string;
      accentColor: string;
      badgeBg: string;
      iconPath: string;
    }
  > = {
    anciaos: {
      badge: 'COMISSÃO DE SERVIÇO • ANCIÃOS',
      title: cong ? `Congregação ${cong}` : 'Programação da Visita',
      subtitle: periodo ? `Período: ${periodo}` : 'Preenchimento de Campo, Refeições e Pastoreio',
      bgGradient: 'linear-gradient(135deg, #2e1a47 0%, #4c2882 55%, #6d42be 100%)',
      accentColor: '#e9d5ff',
      badgeBg: 'rgba(255, 255, 255, 0.16)',
      iconPath: 'M19 3h-1V1h-2v2H8V1H6v2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V8h14v11z',
    },
    congregacao: {
      badge: 'MURAL PÚBLICO DA CONGREGAÇÃO',
      title: cong ? `Congregação ${cong}` : 'Mural da Semana da Visita',
      subtitle: periodo ? `Período: ${periodo}` : 'Saídas de Serviço de Campo e Reuniões',
      bgGradient: 'linear-gradient(135deg, #0f3d3b 0%, #176966 55%, #1d8a86 100%)',
      accentColor: '#99f6e4',
      badgeBg: 'rgba(255, 255, 255, 0.16)',
      iconPath: 'M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z',
    },
    esposa: {
      badge: cong ? 'PROGRAMAÇÃO DA VISITA • ESPOSA' : 'LINK ÚNICO PERMANENTE • ESPOSA',
      title: cong ? `Congregação ${cong}` : 'Programação Semanal da Visita',
      subtitle: periodo
        ? `Período: ${periodo}`
        : 'Atualizado automaticamente a cada semana • Campo, Estudos, Reuniões e Almoços',
      bgGradient: 'linear-gradient(135deg, #1e293b 0%, #312e81 55%, #4f46e5 100%)',
      accentColor: '#c7d2fe',
      badgeBg: 'rgba(255, 255, 255, 0.14)',
      iconPath: 'M21 5c-1.11-.35-2.33-.5-3.5-.5-1.95 0-4.05.4-5.5 1.5-1.45-1.1-3.55-1.5-5.5-1.5S2.45 4.9 1 6v14.65c0 .25.25.5.5.5.1 0 .15-.05.25-.05C3.1 20.45 5.05 20 6.5 20c1.95 0 4.05.4 5.5 1.5 1.35-.85 3.8-1.5 5.5-1.5 1.65 0 3.35.3 4.75 1.05.1.05.15.05.25.05.25 0 .5-.25.5-.5V6c-.6-.45-1.25-.75-2-1z',
    },
  };

  const cfg = configMap[tipo] || configMap.anciaos;

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          background: cfg.bgGradient,
          padding: '60px 70px',
          color: 'white',
          fontFamily: 'sans-serif',
          position: 'relative',
        }}
      >
        {/* Círculo decorativo sutil de fundo */}
        <div
          style={{
            position: 'absolute',
            right: '-80px',
            top: '-80px',
            width: '420px',
            height: '420px',
            borderRadius: '210px',
            background: 'rgba(255, 255, 255, 0.06)',
            display: 'flex',
          }}
        />

        {/* Topo: Badge e Ícone */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            width: '100%',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              background: cfg.badgeBg,
              border: '1px solid rgba(255, 255, 255, 0.25)',
              borderRadius: '999px',
              padding: '12px 26px',
              fontSize: '22px',
              fontWeight: 800,
              letterSpacing: '2px',
              color: cfg.accentColor,
            }}
          >
            {cfg.badge}
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '84px',
              height: '84px',
              borderRadius: '24px',
              background: 'rgba(255, 255, 255, 0.15)',
              border: '1px solid rgba(255, 255, 255, 0.25)',
            }}
          >
            <svg width="46" height="46" viewBox="0 0 24 24" fill="white">
              <path d={cfg.iconPath} />
            </svg>
          </div>
        </div>

        {/* Centro: Título principal e período */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
            marginTop: '20px',
            marginBottom: '20px',
          }}
        >
          <div
            style={{
              fontSize: '28px',
              fontWeight: 700,
              color: cfg.accentColor,
              letterSpacing: '1px',
              textTransform: 'uppercase',
              display: 'flex',
            }}
          >
            Semana da Visita do Superintendente de Circuito
          </div>

          <div
            style={{
              fontSize: cong && cong.length > 22 ? '56px' : '68px',
              fontWeight: 900,
              lineHeight: 1.1,
              color: '#ffffff',
              display: 'flex',
            }}
          >
            {cfg.title}
          </div>

          <div
            style={{
              fontSize: '34px',
              fontWeight: 600,
              color: 'rgba(255, 255, 255, 0.9)',
              marginTop: '6px',
              display: 'flex',
            }}
          >
            {cfg.subtitle}
          </div>
        </div>

        {/* Rodapé */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderTop: '1px solid rgba(255, 255, 255, 0.2)',
            paddingTop: '28px',
            width: '100%',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '14px',
              fontSize: '24px',
              fontWeight: 700,
              color: '#ffffff',
            }}
          >
            <div
              style={{
                width: '16px',
                height: '16px',
                borderRadius: '8px',
                background: cfg.accentColor,
                display: 'flex',
              }}
            />
            ProgCir • Programador de Atividades do Circuito
          </div>

          <div
            style={{
              fontSize: '22px',
              fontWeight: 600,
              color: cfg.accentColor,
              display: 'flex',
            }}
          >
            Toque para abrir a programação
          </div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    }
  );
}

