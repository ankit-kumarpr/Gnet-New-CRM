import { useEffect } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Placeholder from "@tiptap/extension-placeholder";
import { Bold, Code, Heading1, Heading2, Heading3, Italic, List, ListOrdered, Quote, Redo2, Strikethrough, Underline as UnderlineIcon, Undo2 } from "lucide-react";
import { cn } from "../../utils/cn";

export const plainRichText = (value) => String(value || "")
  .replace(/<[^>]+>/g, " ")
  .replace(/&nbsp;/g, " ")
  .replace(/\s+/g, " ")
  .trim();

export const richHtmlClass = "[&_h1]:text-xl [&_h1]:font-semibold [&_h2]:text-lg [&_h2]:font-semibold [&_h3]:text-base [&_h3]:font-semibold [&_ul]:my-1 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:my-1 [&_ol]:list-decimal [&_ol]:pl-5 [&_blockquote]:my-2 [&_blockquote]:border-l-2 [&_blockquote]:border-slate-300 [&_blockquote]:pl-3 [&_blockquote]:text-slate-600 [&_code]:rounded [&_code]:bg-slate-100 [&_code]:px-1";

function ToolButton({ active, disabled, label, onClick, children }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "rounded px-2 py-1 text-slate-600 hover:bg-white hover:text-slate-900 disabled:opacity-40",
        active && "bg-white text-emerald-700 shadow-sm"
      )}
    >
      {children}
    </button>
  );
}

export function RichText({ value, onChange, placeholder, disabled }) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      Underline,
      Placeholder.configure({ placeholder: placeholder || "Write here" }),
    ],
    content: value || "",
    editable: !disabled,
    immediatelyRender: false,
    onUpdate: ({ editor: current }) => onChange(current.getHTML()),
  });

  useEffect(() => {
    if (!editor) return;
    editor.setEditable(!disabled);
  }, [disabled, editor]);

  useEffect(() => {
    if (!editor || editor.isFocused) return;
    const next = value || "";
    if (editor.getHTML() !== next) {
      editor.commands.setContent(next, { emitUpdate: false });
    }
  }, [editor, value]);

  const run = (command) => editor?.chain().focus()[command]().run();

  return (
    <div className={cn("overflow-hidden rounded-md border border-slate-300 bg-white", disabled && "opacity-60")}>
      <div className="flex flex-wrap items-center gap-1 border-b border-slate-200 bg-slate-50 p-1">
        <ToolButton label="Heading 1" disabled={!editor || disabled} active={editor?.isActive("heading", { level: 1 })} onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}>
          <Heading1 className="h-4 w-4" />
        </ToolButton>
        <ToolButton label="Heading 2" disabled={!editor || disabled} active={editor?.isActive("heading", { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>
          <Heading2 className="h-4 w-4" />
        </ToolButton>
        <ToolButton label="Heading 3" disabled={!editor || disabled} active={editor?.isActive("heading", { level: 3 })} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}>
          <Heading3 className="h-4 w-4" />
        </ToolButton>
        <span className="mx-1 h-5 w-px bg-slate-200" />
        <ToolButton label="Bold" disabled={!editor || disabled} active={editor?.isActive("bold")} onClick={() => run("toggleBold")}>
          <Bold className="h-4 w-4" />
        </ToolButton>
        <ToolButton label="Italic" disabled={!editor || disabled} active={editor?.isActive("italic")} onClick={() => run("toggleItalic")}>
          <Italic className="h-4 w-4" />
        </ToolButton>
        <ToolButton label="Underline" disabled={!editor || disabled} active={editor?.isActive("underline")} onClick={() => editor.chain().focus().toggleUnderline().run()}>
          <UnderlineIcon className="h-4 w-4" />
        </ToolButton>
        <ToolButton label="Strikethrough" disabled={!editor || disabled} active={editor?.isActive("strike")} onClick={() => run("toggleStrike")}>
          <Strikethrough className="h-4 w-4" />
        </ToolButton>
        <ToolButton label="Code" disabled={!editor || disabled} active={editor?.isActive("code")} onClick={() => run("toggleCode")}>
          <Code className="h-4 w-4" />
        </ToolButton>
        <span className="mx-1 h-5 w-px bg-slate-200" />
        <ToolButton label="Bullet list" disabled={!editor || disabled} active={editor?.isActive("bulletList")} onClick={() => run("toggleBulletList")}>
          <List className="h-4 w-4" />
        </ToolButton>
        <ToolButton label="Numbered list" disabled={!editor || disabled} active={editor?.isActive("orderedList")} onClick={() => run("toggleOrderedList")}>
          <ListOrdered className="h-4 w-4" />
        </ToolButton>
        <ToolButton label="Quote" disabled={!editor || disabled} active={editor?.isActive("blockquote")} onClick={() => run("toggleBlockquote")}>
          <Quote className="h-4 w-4" />
        </ToolButton>
        <span className="mx-1 h-5 w-px bg-slate-200" />
        <ToolButton label="Undo" disabled={!editor || disabled || !editor.can().undo()} onClick={() => run("undo")}>
          <Undo2 className="h-4 w-4" />
        </ToolButton>
        <ToolButton label="Redo" disabled={!editor || disabled || !editor.can().redo()} onClick={() => run("redo")}>
          <Redo2 className="h-4 w-4" />
        </ToolButton>
      </div>
      <EditorContent
        editor={editor}
        className={cn(
          "px-3 py-2 text-sm text-slate-900 [&_.ProseMirror]:min-h-28 [&_.ProseMirror]:outline-none [&_.ProseMirror_p.is-editor-empty:first-child]:before:pointer-events-none [&_.ProseMirror_p.is-editor-empty:first-child]:before:float-left [&_.ProseMirror_p.is-editor-empty:first-child]:before:h-0 [&_.ProseMirror_p.is-editor-empty:first-child]:before:text-slate-400 [&_.ProseMirror_p.is-editor-empty:first-child]:before:content-[attr(data-placeholder)]",
          richHtmlClass
        )}
      />
    </div>
  );
}
