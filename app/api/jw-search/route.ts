import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q');
  const id = searchParams.get('id');
  
  if (!query && !id) {
    return NextResponse.json({ error: 'Query or ID is required' }, { status: 400 });
  }

  try {
    let jwApiUrl = '';
    if (id) {
      // Tenta buscar pelo número da organização
      jwApiUrl = `https://apps.jw.org/P/meetings/search?orgNumber=${id}&output=json`;
    } else {
      // Busca por texto (cidade, nome, etc)
      jwApiUrl = `https://apps.jw.org/P/meetings/search?search=${encodeURIComponent(query!)}&output=json`;
    }
    
    console.log('Fetching JW.org API:', jwApiUrl);
    
    let response = await fetch(jwApiUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json',
      },
      next: { revalidate: 3600 }
    });

    let data = await response.json();
    
    // Se buscou por ID e não veio nada, tenta buscar o ID como texto (fallback)
    if (id && (!data.meetings || data.meetings.length === 0)) {
      console.log('ID não encontrado como orgNumber, tentando como texto...');
      const fallbackUrl = `https://apps.jw.org/P/meetings/search?search=${id}&output=json`;
      const fallbackRes = await fetch(fallbackUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0' }
      });
      if (fallbackRes.ok) {
        data = await fallbackRes.json();
      }
    }
    
    // Ensure we return a consistent structure
    return NextResponse.json({
      results: data.meetings || [],
      count: data.count || (data.meetings ? data.meetings.length : 0)
    });
  } catch (error: any) {
    console.error('Error searching JW.org:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
