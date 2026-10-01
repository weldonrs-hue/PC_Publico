'use client';

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Underline from '@tiptap/extension-underline';
import Color from '@tiptap/extension-color';
import TextStyle from '@tiptap/extension-text-style';
import Highlight from '@tiptap/extension-highlight';
import TextAlign from '@tiptap/extension-text-align';
import { 
  Bold, 
  Italic, 
  Underline as UnderlineIcon, 
  List, 
  ListOrdered, 
  AlignLeft, 
  AlignCenter, 
  AlignRight, 
  Link as LinkIcon, 
  Type, 
  Palette, 
  Highlighter, 
  RotateCcw, 
  RotateCw,
  Eraser,
  Heading1,
  Heading2,
  Quote
} from 'lucide-react';
import React, { useEffect } from 'react';

interface TiptapEditorProps {
  content: string;
  onChange: (content: string) => void;
}

const MenuBar = ({ editor }: { editor: any }) => {
  if (!editor) {
    return null;
  }

  const addLink = () => {
    const url = window.prompt('URL do Link:');
    if (url) {
      editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-1 p-2 bg-[#f3f2f1] border-t border-gray-200">
      <div className="flex items-center gap-1 pr-2 border-r border-gray-300">
        <button
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={`p-1.5 rounded hover:bg-gray-200 transition-colors ${editor.isActive('bold') ? 'bg-gray-300 text-[#0078d4]' : 'text-gray-600'}`}
          title="Negrito"
        >
          <Bold size={16} />
        </button>
        <button
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={`p-1.5 rounded hover:bg-gray-200 transition-colors ${editor.isActive('italic') ? 'bg-gray-300 text-[#0078d4]' : 'text-gray-600'}`}
          title="Itálico"
        >
          <Italic size={16} />
        </button>
        <button
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          className={`p-1.5 rounded hover:bg-gray-200 transition-colors ${editor.isActive('underline') ? 'bg-gray-300 text-[#0078d4]' : 'text-gray-600'}`}
          title="Sublinhado"
        >
          <UnderlineIcon size={16} />
        </button>
      </div>

      <div className="flex items-center gap-1 px-2 border-r border-gray-300">
        <button
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={`p-1.5 rounded hover:bg-gray-200 transition-colors ${editor.isActive('bulletList') ? 'bg-gray-300 text-[#0078d4]' : 'text-gray-600'}`}
          title="Lista com marcadores"
        >
          <List size={16} />
        </button>
        <button
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          className={`p-1.5 rounded hover:bg-gray-200 transition-colors ${editor.isActive('orderedList') ? 'bg-gray-300 text-[#0078d4]' : 'text-gray-600'}`}
          title="Lista numerada"
        >
          <ListOrdered size={16} />
        </button>
      </div>

      <div className="flex items-center gap-1 px-2 border-r border-gray-300">
        <button
          onClick={() => editor.chain().focus().setTextAlign('left').run()}
          className={`p-1.5 rounded hover:bg-gray-200 transition-colors ${editor.isActive({ textAlign: 'left' }) ? 'bg-gray-300 text-[#0078d4]' : 'text-gray-600'}`}
          title="Alinhar à esquerda"
        >
          <AlignLeft size={16} />
        </button>
        <button
          onClick={() => editor.chain().focus().setTextAlign('center').run()}
          className={`p-1.5 rounded hover:bg-gray-200 transition-colors ${editor.isActive({ textAlign: 'center' }) ? 'bg-gray-300 text-[#0078d4]' : 'text-gray-600'}`}
          title="Centralizar"
        >
          <AlignCenter size={16} />
        </button>
        <button
          onClick={() => editor.chain().focus().setTextAlign('right').run()}
          className={`p-1.5 rounded hover:bg-gray-200 transition-colors ${editor.isActive({ textAlign: 'right' }) ? 'bg-gray-300 text-[#0078d4]' : 'text-gray-600'}`}
          title="Alinhar à direita"
        >
          <AlignRight size={16} />
        </button>
      </div>

      <div className="flex items-center gap-1 px-2 border-r border-gray-300">
        <button
          onClick={addLink}
          className={`p-1.5 rounded hover:bg-gray-200 transition-colors ${editor.isActive('link') ? 'bg-gray-300 text-[#0078d4]' : 'text-gray-600'}`}
          title="Inserir Link"
        >
          <LinkIcon size={16} />
        </button>
        <button
          onClick={() => editor.chain().focus().toggleHighlight().run()}
          className={`p-1.5 rounded hover:bg-gray-200 transition-colors ${editor.isActive('highlight') ? 'bg-gray-300 text-[#0078d4]' : 'text-gray-600'}`}
          title="Realce"
        >
          <Highlighter size={16} />
        </button>
        <input
          type="color"
          onInput={(event) => editor.chain().focus().setColor((event.target as HTMLInputElement).value).run()}
          className="w-6 h-6 p-0 border-none bg-transparent cursor-pointer"
          title="Cor do Texto"
        />
      </div>

      <div className="flex items-center gap-1 pl-2">
        <button
          onClick={() => editor.chain().focus().undo().run()}
          disabled={!editor.can().undo()}
          className="p-1.5 rounded hover:bg-gray-200 text-gray-600 disabled:opacity-30"
          title="Desfazer"
        >
          <RotateCcw size={16} />
        </button>
        <button
          onClick={() => editor.chain().focus().redo().run()}
          disabled={!editor.can().redo()}
          className="p-1.5 rounded hover:bg-gray-200 text-gray-600 disabled:opacity-30"
          title="Refazer"
        >
          <RotateCw size={16} />
        </button>
        <button
          onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()}
          className="p-1.5 rounded hover:bg-gray-200 text-gray-600"
          title="Limpar Formatação"
        >
          <Eraser size={16} />
        </button>
      </div>
    </div>
  );
};

export default function TiptapEditor({ content, onChange }: TiptapEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      Link.configure({
        openOnClick: false,
      }),
      TextStyle,
      Color,
      Highlight.configure({ multicolor: true }),
      TextAlign.configure({
        types: ['heading', 'paragraph'],
      }),
    ],
    content: content,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class: 'prose prose-sm sm:prose-base lg:prose-lg xl:prose-2xl focus:outline-none min-h-[300px] max-w-none p-4 bg-white whitespace-pre-wrap',
      },
    },
  });

  // Keep editor content in sync with external changes (e.g., when selecting a new draft)
  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      editor.commands.setContent(content);
    }
  }, [content, editor]);

  return (
    <div className="flex flex-col border border-gray-200 rounded-lg overflow-hidden bg-white shadow-sm flex-1 min-h-0">
      <div className="flex-1 overflow-y-auto custom-scrollbar prose-container">
        <EditorContent editor={editor} />
      </div>
      <MenuBar editor={editor} />
      <style jsx global>{`
        .prose-container .tiptap {
          outline: none !important;
          min-height: 400px;
          padding: 1.5rem;
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          font-size: 14px;
          line-height: 1.6;
        }
        .prose-container .tiptap p.is-editor-empty:first-child::before {
          color: #adb5bd;
          content: attr(data-placeholder);
          float: left;
          height: 0;
          pointer-events: none;
        }
        .prose-container .tiptap ul {
          list-style-type: disc;
          padding-left: 1.5rem;
        }
        .prose-container .tiptap ol {
          list-style-type: decimal;
          padding-left: 1.5rem;
        }
        .prose-container .tiptap a {
          color: #0078d4;
          text-decoration: underline;
          cursor: pointer;
        }
      `}</style>
    </div>
  );
}
