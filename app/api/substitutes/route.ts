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
    const { data: substitutes, error } = await supabase
      .from('substitutos')
      .select('*')
      .eq('id_usuario', userId);

    if (error) {
      throw error;
    }

    // Map database fields to frontend camelCase
    const mapped = (substitutes || []).map((s: any) => ({
      id: s.id,
      nome: s.nome,
      congregacaoId: s.congregacao_id,
      congregacaoNome: s.congregacao_nome,
      cidade: s.cidade,
      estado: s.estado
    }));
    return NextResponse.json(mapped);
  } catch (error) {
    console.error('Error fetching substitutes:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!isSupabaseConfigured) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
  }
  try {
    const { id, id_usuario, nome, congregacaoId, congregacaoNome, cidade, estado } = await request.json();

    if (!id || !id_usuario || !nome) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const { error } = await supabase
      .from('substitutos')
      .upsert({
        id,
        id_usuario,
        nome,
        congregacao_id: congregacaoId,
        congregacao_nome: congregacaoNome,
        cidade,
        estado
      });

    if (error) {
      throw error;
    }

    return NextResponse.json({ message: 'Substitute saved successfully' });
  } catch (error) {
    console.error('Error saving substitute:', error);
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
      .from('substitutos')
      .delete()
      .eq('id', id)
      .eq('id_usuario', userId);

    if (error) {
      throw error;
    }

    return NextResponse.json({ message: 'Substitute deleted successfully' });
  } catch (error) {
    console.error('Error deleting substitute:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
