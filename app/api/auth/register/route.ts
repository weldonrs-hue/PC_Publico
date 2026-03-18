import { NextResponse } from 'next/server';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import bcrypt from 'bcryptjs';

export async function POST(request: Request) {
  if (!isSupabaseConfigured) {
    return NextResponse.json({ error: 'Banco de dados não configurado. Por favor, configure as variáveis de ambiente do Supabase.' }, { status: 503 });
  }
  try {
    const { usuario, senha, confirmarSenha } = await request.json();

    // Validations
    if (!usuario || !senha || !confirmarSenha) {
      return NextResponse.json({ error: 'Todos os campos são obrigatórios' }, { status: 400 });
    }

    if (senha.length < 6) {
      return NextResponse.json({ error: 'A senha deve ter no mínimo 6 caracteres' }, { status: 400 });
    }

    if (senha !== confirmarSenha) {
      return NextResponse.json({ error: 'As senhas não coincidem' }, { status: 400 });
    }

    // Check if user exists
    const { data: existingUser } = await supabase
      .from('usuarios')
      .select('id_usuario')
      .eq('usuario', usuario)
      .single();

    if (existingUser) {
      return NextResponse.json({ error: 'Nome de usuário já existe' }, { status: 400 });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(senha, 10);

    // Insert user
    const { error } = await supabase
      .from('usuarios')
      .insert([{ usuario, senha: hashedPassword }]);

    if (error) {
      throw error;
    }

    return NextResponse.json({ message: 'Usuário criado com sucesso' }, { status: 201 });
  } catch (error) {
    console.error('Registration error:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}
