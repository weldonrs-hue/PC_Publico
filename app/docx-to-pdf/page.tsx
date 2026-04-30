import DocxToPdfDemo from '@/components/DocxToPdfDemo';

export default function DocxConverterPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-100 px-6 py-4">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-lg">W</span>
            </div>
            <span className="font-bold text-gray-800 tracking-tight">DocxConverter</span>
          </div>
          <a href="/" className="text-sm font-medium text-gray-500 hover:text-blue-600 transition-colors">
            Voltar para o Início
          </a>
        </div>
      </nav>
      <main className="py-12">
        <DocxToPdfDemo />
      </main>
    </div>
  );
}
