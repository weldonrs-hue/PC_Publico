import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q');
  
  if (!query) {
    return NextResponse.json({ error: 'Query is required' }, { status: 400 });
  }

  try {
    // 1. First, we need to geocode the location string if it's not coordinates
    // JW.org uses an internal geocoding or a public one.
    // However, we can try to use their search API directly if it supports text.
    // Actually, the hub.jw.org search seems to use a different endpoint.
    
    // The correct endpoint for JW.org meeting search
    // Using the apps.jw.org API with correct parameters
    // We'll use the endpoint that the public website's "Find a Meeting" tool uses.
    // It often uses a language code. 'P' is for Portuguese, 'E' for English.
    // However, the search usually works with 'E' or 'P'.
    const jwApiUrl = `https://apps.jw.org/P/meetings/search?search=${encodeURIComponent(query)}&output=json`;
    
    const response = await fetch(jwApiUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'application/json',
      }
    });

    if (!response.ok) {
      throw new Error(`JW.org API responded with ${response.status}`);
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Error searching JW.org:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
