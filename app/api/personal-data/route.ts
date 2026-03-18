import { NextResponse } from 'next/server';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';

export async function GET(request: Request) {
  if (!isSupabaseConfigured) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
  }
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId');

  if (!userId) {
    return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
  }

  try {
    const { data, error } = await supabase
      .from('dados_pessoais')
      .select('*')
      .eq('id_usuario', userId)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 is "no rows returned"
      throw error;
    }

    return NextResponse.json(data || null);
  } catch (error) {
    console.error('Error fetching personal data:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!isSupabaseConfigured) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
  }
  try {
    const body = await request.json();
    const { id_usuario } = body;

    if (!id_usuario) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    const { error } = await supabase
      .from('dados_pessoais')
      .upsert(body);

    if (error) {
      throw error;
    }

    return NextResponse.json({ message: 'Personal data saved successfully' });
  } catch (error) {
    console.error('Error saving personal data:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
