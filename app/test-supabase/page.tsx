import { createClient } from '@/utils/supabase/server'
import { cookies } from 'next/headers'
import Link from 'next/link'

export default async function Page() {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)

  const { data: todos } = await supabase.from('todos').select()

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">Teste de Integração Supabase</h1>
      <p className="mb-4 text-gray-600">Esta página demonstra a conexão com o Supabase usando Server Components.</p>
      
      {todos && todos.length > 0 ? (
        <ul className="list-disc pl-5">
          {todos.map((todo) => (
            <li key={todo.id} className="mb-1">
              {todo.name} {todo.is_completed ? '✅' : '⏳'}
            </li>
          ))}
        </ul>
      ) : (
        <div className="p-4 bg-yellow-50 border border-yellow-200 rounded text-yellow-700">
          Nenhum &quot;todo&quot; encontrado. Certifique-se de que a tabela `todos` existe e contém dados.
        </div>
      )}
      
      <div className="mt-8">
        <Link href="/" className="text-blue-600 hover:underline">Voltar para o Dashboard</Link>
      </div>
    </div>
  )
}
