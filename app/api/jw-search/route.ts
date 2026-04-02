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
      jwApiUrl = `https://apps.jw.org/P/meetings/search?orgNumber=${id}&output=json`;
    } else {
      jwApiUrl = `https://apps.jw.org/P/meetings/search?search=${encodeURIComponent(query!)}&output=json`;
    }
    
    const response = await fetch(jwApiUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json',
        'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
      },
      next: { revalidate: 3600 }
    });

    if (response.status === 404) {
      return NextResponse.json({ results: [], count: 0 });
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`JW.org API Error (${response.status}):`, errorText);
      return NextResponse.json({ results: [], count: 0 });
    }

    const data = await response.json();
    
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
