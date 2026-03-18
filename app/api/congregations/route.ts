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
    const { data: congregations, error } = await supabase
      .from('congregacoes')
      .select('*')
      .eq('id_usuario', userId);

    if (error) {
      throw error;
    }

    return NextResponse.json(congregations || []);
  } catch (error) {
    console.error('Error fetching congregations:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!isSupabaseConfigured) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
  }
  try {
    const body = await request.json();
    const { id, id_usuario, nome } = body;

    if (!id || !id_usuario || !nome) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const { error } = await supabase
      .from('congregacoes')
      .upsert(body);

    if (error) {
      throw error;
    }

    return NextResponse.json({ message: 'Congregation saved successfully' });
  } catch (error) {
    console.error('Error saving congregation:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  if (!isSupabaseConfigured) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
  }
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  const userId = searchParams.get('userId');

  if (!id || !userId) {
    return NextResponse.json({ error: 'ID and User ID are required' }, { status: 400 });
  }

  try {
    const { error } = await supabase
      .from('congregacoes')
      .delete()
      .eq('id', id)
      .eq('id_usuario', userId);

    if (error) {
      throw error;
    }

    return NextResponse.json({ message: 'Congregation deleted successfully' });
  } catch (error) {
    console.error('Error deleting congregation:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
