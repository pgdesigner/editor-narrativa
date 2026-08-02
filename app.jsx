import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import ReactDOM from "react-dom/client";
import { EditorState, RangeSetBuilder } from "@codemirror/state";
import { EditorView, keymap, ViewPlugin, Decoration } from "@codemirror/view";
import { history, defaultKeymap, historyKeymap } from "@codemirror/commands";
import {
  Plus, Trash2, ChevronDown, ChevronRight, Users, StickyNote, Activity, Feather,
  X, Focus, Settings, Search, BookOpen, LayoutGrid, List, Network, Download,
  Upload, Sun, Moon, FolderPlus, ChevronsUpDown, Save, RotateCcw, Sparkles, BookMarked,
  Flame, Layers, Eye, EyeOff, Link2, Calendar, Bold, Italic, Type, Copy, Scissors,
  Pin, ListChecks, Smile, ChevronsRight, Quote, Minus,
  Strikethrough, Highlighter, MessageSquarePlus, Pilcrow, Pencil, ChevronUp, SlidersHorizontal, FolderInput,
  Palette, HelpCircle
} from "lucide-react";
import { LineChart, Line, XAxis, YAxis, ReferenceLine, Tooltip, ResponsiveContainer, CartesianGrid, BarChart, Bar } from "recharts";

const PALETTES = {
  night: {
    desk: "#24211D", deskLight: "#2E2A24", paper: "#F3ECDC", paperEdge: "#E2D6B8",
    ink: "#2A2622", wine: "#7A2E2E", teal: "#3F5D54", gold: "#B08B3D",
    muted: "#8A8272", mutedLight: "#B7AF9C", panel: "#2E2A24",
  },
  day: {
    desk: "#EDE6D3", deskLight: "#E2D8BE", paper: "#FBF8F0", paperEdge: "#DCD2B4",
    ink: "#2A2622", wine: "#7A2E2E", teal: "#3F5D54", gold: "#8C6A26",
    muted: "#8A8272", mutedLight: "#4F493D", panel: "#E2D8BE",
  },
};

const STATUS = {
  rascunho: { label: "Rascunho", abbr: "RA" },
  revisao: { label: "Revisão", abbr: "RE" },
  final: { label: "Final", abbr: "FI" },
};

const NOTE_CATEGORIES = ["worldbuilding", "pesquisa", "ideia", "plot"];
const MOOD_OPTIONS = ["😊", "😐", "😢", "😡", "😴", "🤩", "😰"];

const MANUSCRITO_TABS = [
  { key: "cena", icon: SlidersHorizontal, label: "Cena" },
  { key: "personagens", icon: Users, label: "Personagens" },
  { key: "fios", icon: Layers, label: "Fios" },
  { key: "notas", icon: StickyNote, label: "Notas" },
  { key: "glossario", icon: BookMarked, label: "Glossário" },
  { key: "visao", icon: Activity, label: "Visão Geral" },
];
const DIARIO_TABS = [
  { key: "entrada", icon: SlidersHorizontal, label: "Entrada" },
  { key: "notas", icon: StickyNote, label: "Notas" },
  { key: "glossario", icon: BookMarked, label: "Glossário" },
];

const TEXT_COLORS = [
  { key: "vermelho", label: "Vermelho", value: "#B23B3B" },
  { key: "verde", label: "Verde", value: "#3F5D54" },
  { key: "azul", label: "Azul", value: "#4A6FA5" },
  { key: "roxo", label: "Roxo", value: "#7A5C9E" },
  { key: "dourado", label: "Dourado", value: "#B08B3D" },
];

const FONT_OPTIONS = [
  { key: "lora", label: "Lora (serifada)", value: "'Lora', Georgia, serif" },
  { key: "fraunces", label: "Fraunces (literária)", value: "'Fraunces', Georgia, serif" },
  { key: "mono", label: "Mono (datilografia)", value: "'JetBrains Mono', monospace" },
  { key: "sans", label: "Sem serifa", value: "-apple-system, 'Segoe UI', system-ui, sans-serif" },
];

const UI_SCALE_OPTIONS = [
  { key: "compacta", label: "Compacta", value: 0.85 },
  { key: "padrao", label: "Padrão", value: 1 },
  { key: "grande", label: "Grande", value: 1.15 },
  { key: "extra", label: "Extra grande", value: 1.3 },
];

const uid = () => Math.random().toString(36).slice(2, 9);
const todayStr = () => new Date().toISOString().slice(0, 10);

const STORAGE_KEY = "story-editor:v2";

const THREAD_COLORS = ["#B08B3D", "#7A2E2E", "#3F5D54", "#5B6FA8", "#8A5A9E", "#A85B3E"];

const emptyProject = (title = "Nova História") => ({
  id: uid(),
  title,
  dailyWordGoal: 500,
  wordHistory: [],
  acts: [],
  characters: [],
  notes: [],
  glossary: [],
  diaries: [],
  threads: [],
});

const emptyStore = () => {
  const p = emptyProject("Minha História");
  return {
    appSettings: { theme: "night", fontSize: 17, fontFamily: "lora", uiScale: 1, layoutMode: "auto" },
    currentProjectId: p.id,
    projects: { [p.id]: p },
  };
};

function wordCount(text) {
  if (!text) return 0;
  const stripped = text.replace(/%%[^%]*%%/g, "");
  return stripped.trim().split(/\s+/).filter(Boolean).length;
}

function projectWordCount(project) {
  return project.acts.reduce(
    (sum, a) => sum + a.chapters.reduce((s2, c) => s2 + c.scenes.reduce((s3, sc) => s3 + wordCount(sc.content), 0), 0),
    0
  );
}

function flattenScenesForArc(acts) {
  const flat = [];
  acts.forEach((act, ai) => {
    act.chapters.forEach((ch, ci) => {
      ch.scenes.forEach((sc, si) => {
        flat.push({
          key: sc.id, label: sc.title || `Cena ${si + 1}`, tension: sc.tension ?? 0,
          actId: act.id, isActStart: ci === 0 && si === 0,
        });
      });
    });
  });
  return flat;
}

function flattenChapters(acts) {
  const flat = [];
  acts.forEach((act) => act.chapters.forEach((ch) => flat.push({ ...ch, actTitle: act.title, actId: act.id })));
  return flat;
}

function findSceneAndChapterTitles(project, sceneId, chapterId) {
  let sceneTitle = null, chapterTitle = null;
  for (const a of project.acts) {
    for (const c of a.chapters) {
      if (c.id === chapterId) chapterTitle = c.title;
      for (const s of c.scenes) {
        if (s.id === sceneId) {
          sceneTitle = s.title || "cena sem título";
          chapterTitle = chapterTitle || c.title;
        }
      }
    }
  }
  return { sceneTitle, chapterTitle };
}

function reorder(list, from, to) {
  const copy = [...list];
  const [item] = copy.splice(from, 1);
  copy.splice(to, 0, item);
  return copy;
}

function computeStreak(project) {
  const activeDates = new Set();
  const hist = project.wordHistory || [];
  hist.forEach((h, i) => {
    const prev = i > 0 ? hist[i - 1].words : 0;
    if (h.words > prev) activeDates.add(h.date);
  });
  (project.diaries || []).forEach((d) => (d.entries || []).forEach((e) => { if ((e.content || "").trim()) activeDates.add(e.date); }));
  if (activeDates.size === 0) return { current: 0, longest: 0 };
  const sorted = Array.from(activeDates).sort();
  let longest = 1, run = 1;
  for (let i = 1; i < sorted.length; i++) {
    const diffDays = Math.round((new Date(sorted[i]) - new Date(sorted[i - 1])) / 86400000);
    run = diffDays === 1 ? run + 1 : 1;
    longest = Math.max(longest, run);
  }
  const activeSet = new Set(sorted);
  let cursor = new Date();
  let cursorStr = cursor.toISOString().slice(0, 10);
  if (!activeSet.has(cursorStr)) {
    cursor.setDate(cursor.getDate() - 1);
    cursorStr = cursor.toISOString().slice(0, 10);
  }
  let current = 0;
  while (activeSet.has(cursorStr)) {
    current += 1;
    cursor.setDate(cursor.getDate() - 1);
    cursorStr = cursor.toISOString().slice(0, 10);
  }
  return { current, longest };
}

function wrapSelectionInTextarea(ta, before, after, onChange) {
  if (!ta) return;
  const start = ta.selectionStart, end = ta.selectionEnd;
  const value = ta.value;
  const selected = value.slice(start, end);
  onChange(value.slice(0, start) + before + selected + after + value.slice(end));
  requestAnimationFrame(() => {
    ta.focus();
    ta.setSelectionRange(start + before.length, end + before.length);
  });
}

// Encontra a posição em pixels do cursor dentro de um <textarea> — os
// navegadores não expõem isso diretamente, então a técnica padrão é criar um
// "espelho" invisível com o mesmo texto e as mesmas fontes, e medir onde o
// texto até o cursor termina nele.
function getCaretCoordinates(ta) {
  const div = document.createElement("div");
  const style = getComputedStyle(ta);
  const props = [
    "boxSizing", "width", "paddingTop", "paddingRight", "paddingBottom", "paddingLeft",
    "borderTopWidth", "borderRightWidth", "borderBottomWidth", "borderLeftWidth",
    "fontFamily", "fontSize", "fontWeight", "lineHeight", "letterSpacing", "textIndent",
  ];
  props.forEach((p) => { div.style[p] = style[p]; });
  div.style.position = "absolute";
  div.style.visibility = "hidden";
  div.style.whiteSpace = "pre-wrap";
  div.style.wordWrap = "break-word";
  div.style.top = "0";
  div.style.left = "-9999px";
  document.body.appendChild(div);
  div.textContent = ta.value.substring(0, ta.selectionStart);
  const span = document.createElement("span");
  span.textContent = ta.value.substring(ta.selectionStart) || ".";
  div.appendChild(span);
  const rect = ta.getBoundingClientRect();
  const lineHeight = parseInt(style.lineHeight, 10) || 20;
  const coords = {
    x: rect.left + span.offsetLeft - ta.scrollLeft,
    y: rect.top + span.offsetTop - ta.scrollTop + lineHeight,
  };
  document.body.removeChild(div);
  return coords;
}

function toggleWrapSelectionInTextarea(ta, before, after, onChange) {
  if (!ta) return;
  const start = ta.selectionStart, end = ta.selectionEnd;
  const value = ta.value;
  const selected = value.slice(start, end);

  // Caso 1: a seleção já inclui as marcações (ex: usuário selecionou "**palavra**")
  if (selected.length >= before.length + after.length && selected.startsWith(before) && selected.endsWith(after)) {
    const inner = selected.slice(before.length, selected.length - after.length);
    onChange(value.slice(0, start) + inner + value.slice(end));
    requestAnimationFrame(() => {
      ta.focus();
      ta.setSelectionRange(start, start + inner.length);
    });
    return;
  }

  // Caso 2: as marcações estão logo fora da seleção (ex: cursor dentro de **palavra**)
  const precedingChunk = value.slice(Math.max(0, start - before.length), start);
  const followingChunk = value.slice(end, end + after.length);
  if (precedingChunk === before && followingChunk === after) {
    onChange(value.slice(0, start - before.length) + selected + value.slice(end + after.length));
    requestAnimationFrame(() => {
      ta.focus();
      ta.setSelectionRange(start - before.length, end - before.length);
    });
    return;
  }

  // Caso 3: ainda não está marcado — aplica normalmente
  wrapSelectionInTextarea(ta, before, after, onChange);
}

function prefixLineInTextarea(ta, prefix, onChange) {
  if (!ta) return;
  const start = ta.selectionStart;
  const value = ta.value;
  const lineStart = value.lastIndexOf("\n", start - 1) + 1;
  onChange(value.slice(0, lineStart) + prefix + value.slice(lineStart));
  requestAnimationFrame(() => {
    ta.focus();
    ta.setSelectionRange(start + prefix.length, start + prefix.length);
  });
}

function insertDialogueLine(ta, onChange) {
  if (!ta) return;
  const start = ta.selectionStart;
  const value = ta.value;
  const atLineStart = start === 0 || value[start - 1] === "\n";
  const insert = atLineStart ? "— " : "\n— ";
  onChange(value.slice(0, start) + insert + value.slice(start));
  requestAnimationFrame(() => {
    ta.focus();
    const pos = start + insert.length;
    ta.setSelectionRange(pos, pos);
  });
}

function insertSceneBreak(ta, onChange) {
  if (!ta) return;
  const start = ta.selectionStart;
  const value = ta.value;
  const needsLeadingBreak = !(start === 0 || value[start - 1] === "\n");
  const insert = `${needsLeadingBreak ? "\n" : ""}\n* * *\n\n`;
  onChange(value.slice(0, start) + insert + value.slice(start));
  requestAnimationFrame(() => {
    ta.focus();
    const pos = start + insert.length;
    ta.setSelectionRange(pos, pos);
  });
}

function ContextMenu({ x, y, items, onClose, colors }) {
  useEffect(() => {
    const handler = () => onClose();
    window.addEventListener("click", handler);
    window.addEventListener("scroll", handler, true);
    return () => {
      window.removeEventListener("click", handler);
      window.removeEventListener("scroll", handler, true);
    };
  }, [onClose]);
  const left = typeof window !== "undefined" ? Math.min(x, window.innerWidth - 210) : x;
  const top = typeof window !== "undefined" ? Math.min(y, window.innerHeight - items.length * 30 - 20) : y;
  return (
    <div onClick={(e) => e.stopPropagation()} onContextMenu={(e) => e.preventDefault()} className="fixed z-50 rounded shadow-2xl py-1 w-52" style={{ top, left, backgroundColor: colors.panel, border: `1px solid ${colors.deskLight}` }}>
      {items.map((it, i) =>
        it.divider ? (
          <div key={i} className="my-1 border-t" style={{ borderColor: colors.deskLight }} />
        ) : (
          <button key={i} disabled={it.disabled} onClick={() => { it.action(); onClose(); }}
            className="w-full flex items-center gap-2 px-3 py-1.5 font-mono text-xs text-left disabled:opacity-30"
            style={{ color: colors.mutedLight }}>
            {it.icon && <it.icon size={12} />} {it.label}
          </button>
        )
      )}
    </div>
  );
}

function renderWithGlossaryLinks(text, glossary, onTermClick) {
  if (!text) return null;
  const terms = (glossary || []).filter((g) => g.term && g.term.trim()).sort((a, b) => b.term.length - a.term.length);
  if (terms.length === 0) return text;
  const escaped = terms.map((g) => g.term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const pattern = new RegExp(`(${escaped.join("|")})`, "gi");
  const parts = text.split(pattern);
  return parts.map((part, i) => {
    const match = terms.find((g) => g.term.toLowerCase() === part.toLowerCase());
    if (match) {
      return (
        <span key={i} onClick={() => onTermClick(match)} style={{ textDecoration: "underline", textDecorationStyle: "dotted", textUnderlineOffset: "3px", cursor: "pointer" }}>
          {part}
        </span>
      );
    }
    return <React.Fragment key={i}>{part}</React.Fragment>;
  });
}

function tokenizeInlineMarkdown(text) {
  const tokens = [];
  const regex = /%%([^%]*)%%|\*\*\*([^*]+)\*\*\*|\*\*([^*]+)\*\*|\*([^*]+)\*|~~([^~]+)~~|==([^=]+)==|\{\{c:(vermelho|verde|azul|roxo|dourado)\}\}([^{]*)\{\{\/c\}\}/g;
  let lastIndex = 0;
  let m;
  while ((m = regex.exec(text)) !== null) {
    if (m.index > lastIndex) tokens.push({ type: "text", text: text.slice(lastIndex, m.index) });
    if (m[1] !== undefined) tokens.push({ type: "comment", text: m[1] });
    else if (m[2] !== undefined) tokens.push({ type: "boldItalic", text: m[2] });
    else if (m[3] !== undefined) tokens.push({ type: "bold", text: m[3] });
    else if (m[4] !== undefined) tokens.push({ type: "italic", text: m[4] });
    else if (m[5] !== undefined) tokens.push({ type: "strike", text: m[5] });
    else if (m[6] !== undefined) tokens.push({ type: "highlight", text: m[6] });
    else if (m[7] !== undefined) tokens.push({ type: "color", color: m[7], text: m[8] });
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < text.length) tokens.push({ type: "text", text: text.slice(lastIndex) });
  return tokens;
}

function renderInlineMarkdown(text, glossary, onTermClick) {
  if (!text) return null;
  const tokens = tokenizeInlineMarkdown(text);
  return tokens.map((tok, i) => {
    if (tok.type === "comment") return null;
    const content = renderWithGlossaryLinks(tok.text, glossary, onTermClick);
    if (tok.type === "boldItalic") return <strong key={i}><em>{content}</em></strong>;
    if (tok.type === "bold") return <strong key={i}>{content}</strong>;
    if (tok.type === "italic") return <em key={i}>{content}</em>;
    if (tok.type === "strike") return <span key={i} style={{ textDecoration: "line-through", opacity: 0.55 }}>{content}</span>;
    if (tok.type === "highlight") return <mark key={i} style={{ backgroundColor: "rgba(176,139,61,0.35)", color: "inherit", padding: "0 2px", borderRadius: "2px" }}>{content}</mark>;
    if (tok.type === "color") {
      const c = TEXT_COLORS.find((tc) => tc.key === tok.color);
      return <span key={i} style={{ color: c ? c.value : "inherit" }}>{content}</span>;
    }
    return <React.Fragment key={i}>{content}</React.Fragment>;
  });
}

function renderMarkdownLine(line, key, glossary, onTermClick) {
  const trimmed = line.trim();
  if (trimmed === "* * *" || trimmed === "***" || trimmed === "---") {
    return <div key={key} className="text-center my-5 tracking-[0.4em] opacity-50 text-xs">• • •</div>;
  }
  if (trimmed.startsWith("### ")) return <h4 key={key} className="font-display text-base mt-4 mb-2">{renderInlineMarkdown(trimmed.slice(4), glossary, onTermClick)}</h4>;
  if (trimmed.startsWith("## ")) return <h3 key={key} className="font-display text-lg mt-5 mb-2">{renderInlineMarkdown(trimmed.slice(3), glossary, onTermClick)}</h3>;
  if (trimmed.startsWith("# ")) return <h2 key={key} className="font-display text-xl mt-6 mb-3">{renderInlineMarkdown(trimmed.slice(2), glossary, onTermClick)}</h2>;
  if (trimmed.startsWith("> ")) {
    return (
      <blockquote key={key} className="italic pl-3 my-3" style={{ borderLeft: "3px solid currentColor", opacity: 0.85 }}>
        {renderInlineMarkdown(trimmed.slice(2), glossary, onTermClick)}
      </blockquote>
    );
  }
  const isDialogue = trimmed.startsWith("— ");
  return <p key={key} className="mb-3" style={{ textIndent: isDialogue ? "0" : "1.5em" }}>{renderInlineMarkdown(line, glossary, onTermClick) || "\u00A0"}</p>;
}

function renderMarkdownContent(content, glossary, onTermClick) {
  const lines = (content || "").split("\n");
  return lines.map((line, i) => renderMarkdownLine(line, i, glossary, onTermClick));
}

function stripLinePrefix(line) {
  return line.replace(/^(#{1,3}\s+|>\s+|—\s+)/, "");
}

function lineHeadingLevel(line) {
  const t = line.trim();
  if (t.startsWith("### ")) return 3;
  if (t.startsWith("## ")) return 2;
  if (t.startsWith("# ")) return 1;
  return 0;
}

// Garante hierarquia: só um Título grande por cena; Título exige um Título
// grande antes dele no texto; Subtítulo exige um Título antes dele.
function canApplyHeading(value, lineStart, level) {
  if (level === 0) return true;
  const lines = value.split("\n");
  let idx = 0, pos = 0;
  for (; idx < lines.length; idx++) {
    if (pos + lines[idx].length >= lineStart) break;
    pos += lines[idx].length + 1;
  }
  if (level === 1) return !lines.some((l, i) => i !== idx && lineHeadingLevel(l) === 1);
  if (level === 2) return lines.slice(0, idx).some((l) => lineHeadingLevel(l) === 1);
  if (level === 3) return lines.slice(0, idx).some((l) => lineHeadingLevel(l) === 2);
  return true;
}

const HEADING_LEVEL_BY_STYLE = { h1: 1, h2: 2, h3: 3 };

// Aplica um estilo de parágrafo (normal, título, subtítulo, citação, fala).
// Sempre remove a marcação de linha anterior antes de aplicar a nova — nunca
// empilha (ex: "## ## texto"). Para títulos, também valida a hierarquia.
// Retorna true se aplicou, false se bloqueou por violar a hierarquia.
function applyParagraphStyle(ta, style, onChange) {
  if (!ta) return false;
  const value = ta.value;
  const start = ta.selectionStart;
  const lineStart = value.lastIndexOf("\n", start - 1) + 1;
  let lineEnd = value.indexOf("\n", start);
  if (lineEnd === -1) lineEnd = value.length;

  const level = HEADING_LEVEL_BY_STYLE[style] || 0;
  if (level > 0 && !canApplyHeading(value, lineStart, level)) return false;

  const stripped = stripLinePrefix(value.slice(lineStart, lineEnd));
  const prefixes = { normal: "", h1: "# ", h2: "## ", h3: "### ", quote: "> ", dialogo: "— " };
  const prefix = prefixes[style] ?? "";
  const newLine = prefix + stripped;
  onChange(value.slice(0, lineStart) + newLine + value.slice(lineEnd));
  requestAnimationFrame(() => {
    ta.focus();
    const pos = lineStart + newLine.length;
    ta.setSelectionRange(pos, pos);
  });
  return true;
}

const PARAGRAPH_STYLES = [
  { key: "normal", label: "Normal" },
  { key: "h1", label: "Título grande" },
  { key: "h2", label: "Título" },
  { key: "h3", label: "Subtítulo" },
  { key: "quote", label: "Citação" },
  { key: "dialogo", label: "Fala de personagem" },
];

const TEMPLATES = {
  tres_atos: () => [
    { id: uid(), title: "Ato 1 — Apresentação", chapters: [] },
    { id: uid(), title: "Ato 2 — Confronto", chapters: [] },
    { id: uid(), title: "Ato 3 — Resolução", chapters: [] },
  ],
  jornada_heroi: () => [
    {
      id: uid(), title: "Jornada do Herói", chapters: [
        "Mundo Comum", "Chamado à Aventura", "Recusa do Chamado", "Encontro com o Mentor",
        "Travessia do Limiar", "Provas, Aliados e Inimigos", "Aproximação da Caverna Secreta",
        "Provação Suprema", "Recompensa", "Caminho de Volta", "Ressurreição", "Retorno com o Elixir",
      ].map((t) => ({ id: uid(), title: t, scenes: [] })),
    },
  ],
  save_the_cat: () => [
    {
      id: uid(), title: "Save the Cat — 15 Batidas", chapters: [
        "Imagem de Abertura", "Tema Declarado", "Setup", "Catalisador", "Debate", "Quebra em Dois",
        "História B", "Diversão e Jogos", "Ponto Médio", "Inimigos se Aproximam", "Tudo Está Perdido",
        "Noite Escura da Alma", "Quebra em Três", "Final", "Imagem Final",
      ].map((t) => ({ id: uid(), title: t, scenes: [] })),
    },
  ],
};

const inputBase = "bg-transparent outline-none";

function normalizeProject(p) {
  const next = { ...p };
  if (!next.diaries) {
    next.diaries = (next.journal && next.journal.length) ? [{ id: uid(), name: "Diário Principal", entries: next.journal.map((j) => ({ id: j.id, date: j.date, title: j.title || "", content: j.content || "", tags: j.tags || [], checklist: j.checklist || [], mood: j.mood || "" })) }] : [];
  }
  delete next.journal;
  next.notes = (next.notes || []).map((n) => ({ pinned: false, tags: [], scope: "geral", sceneId: null, chapterId: null, ...n }));
  next.threads = next.threads || [];
  return next;
}

function normalizeStore(store) {
  const projects = {};
  Object.entries(store.projects || {}).forEach(([id, p]) => { projects[id] = normalizeProject(p); });
  return { ...store, projects };
}

function StoryEditor() {
  const [store, setStore] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saveError, setSaveError] = useState(false);
  const [selectedScene, setSelectedScene] = useState(null);
  const [expanded, setExpanded] = useState({});
  const [rightTab, setRightTab] = useState("cena");
  const [charSubView, setCharSubView] = useState("lista");
  const [focusMode, setFocusMode] = useState(false);
  const [structView, setStructView] = useState("arvore");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [projectMenuOpen, setProjectMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [mobilePanel, setMobilePanel] = useState("escrita");
  const [containerWidth, setContainerWidth] = useState(typeof window !== "undefined" ? window.innerWidth : 1024);
  const [isCoarsePointer, setIsCoarsePointer] = useState(false);
  const rootRef = useRef(null);
  const longPressTimer = useRef(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [noteFilter, setNoteFilter] = useState("todas");
  const [noteScopeFilter, setNoteScopeFilter] = useState({ cena: true, capitulo: true, geral: true });
  const [paragraphMenuOpen, setParagraphMenuOpen] = useState(false);
  const [cenaSections, setCenaSections] = useState({ sinopse: true, detalhes: true, personagens: false, fios: false, ferramentas: false, versoes: false, humor: true, entradaFormatacao: false, entradaTags: true, checklist: true });
  const [workspace, setWorkspace] = useState("manuscrito");
  const [selectedEntry, setSelectedEntry] = useState(null);
  const [glossaryPopover, setGlossaryPopover] = useState(null);
  const [readMode, setReadMode] = useState(false);
  const [visualMode, setVisualMode] = useState(false);
  const [cmMode, setCmMode] = useState(false);
  const [contextMenu, setContextMenu] = useState(null);
  const [treeContextMenu, setTreeContextMenu] = useState(null);
  const [movePicker, setMovePicker] = useState(null);
  const [colorPicker, setColorPicker] = useState(null);
  const [colorAutocomplete, setColorAutocomplete] = useState(null);
  const [renamingId, setRenamingId] = useState(null);
  const [toast, setToast] = useState(null);
  const dragRef = useRef(null);
  const saveTimeout = useRef(null);
  const fileInputRef = useRef(null);
  const contentTextareaRef = useRef(null);
  const entryTextareaRef = useRef(null);
  const paragraphMenuRef = useRef(null);
  const toastTimeout = useRef(null);

  useEffect(() => {
    (async () => {
      try {
        const result = await window.storage.get(STORAGE_KEY, false);
        setStore(result ? normalizeStore(JSON.parse(result.value)) : emptyStore());
      } catch (e) {
        setStore(emptyStore());
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const persist = useCallback((next) => {
    if (saveTimeout.current) clearTimeout(saveTimeout.current);
    saveTimeout.current = setTimeout(async () => {
      try {
        const result = await window.storage.set(STORAGE_KEY, JSON.stringify(next), false);
        setSaveError(!result);
      } catch (e) {
        setSaveError(true);
      }
    }, 500);
  }, []);

  const updateStore = useCallback(
    (updater) => {
      setStore((prev) => {
        const next = typeof updater === "function" ? updater(prev) : updater;
        persist(next);
        return next;
      });
    },
    [persist]
  );

  const project = store ? store.projects[store.currentProjectId] : null;

  const updateProject = useCallback(
    (updater) => {
      updateStore((prev) => {
        const proj = prev.projects[prev.currentProjectId];
        const nextProj = typeof updater === "function" ? updater(proj) : updater;
        return { ...prev, projects: { ...prev.projects, [prev.currentProjectId]: nextProj } };
      });
    },
    [updateStore]
  );

  const showToast = useCallback((msg) => {
    setToast(msg);
    if (toastTimeout.current) clearTimeout(toastTimeout.current);
    toastTimeout.current = setTimeout(() => setToast(null), 2200);
  }, []);

  const totalWords = useMemo(() => (project ? projectWordCount(project) : 0), [project]);
  const streak = useMemo(() => (project ? computeStreak(project) : { current: 0, longest: 0 }), [project]);

  const searchResults = useMemo(() => {
    if (!project || !searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase();
    const res = [];
    if (workspace === "manuscrito") {
      project.acts.forEach((a) => a.chapters.forEach((c) => c.scenes.forEach((s) => {
        if ((s.title || "").toLowerCase().includes(q) || (s.content || "").toLowerCase().includes(q)) {
          res.push({ kind: "scene", actId: a.id, chapterId: c.id, sceneId: s.id, label: s.title || "(cena sem título)" });
        }
      })));
    } else {
      (project.diaries || []).forEach((d) => (d.entries || []).forEach((e) => {
        if ((e.title || "").toLowerCase().includes(q) || (e.content || "").toLowerCase().includes(q)) {
          res.push({ kind: "entry", diaryId: d.id, entryId: e.id, label: e.title || `(entrada de ${e.date})` });
        }
      }));
    }
    project.notes.forEach((n) => {
      if ((n.title || "").toLowerCase().includes(q) || (n.content || "").toLowerCase().includes(q)) {
        res.push({ kind: "note", noteId: n.id, label: n.title || "(nota sem título)" });
      }
    });
    return res.slice(0, 30);
  }, [searchQuery, project, workspace]);

  // track daily word history
  useEffect(() => {
    if (!project) return;
    const today = todayStr();
    const hist = project.wordHistory || [];
    const last = hist[hist.length - 1];
    if (!last || last.date !== today) {
      updateProject((p) => ({ ...p, wordHistory: [...(p.wordHistory || []), { date: today, words: totalWords }].slice(-60) }));
    } else if (last.words !== totalWords) {
      updateProject((p) => ({
        ...p,
        wordHistory: (p.wordHistory || []).map((h, i) => (i === (p.wordHistory.length - 1) ? { ...h, words: totalWords } : h)),
      }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totalWords, project?.id]);

  useEffect(() => {
    if (!paragraphMenuOpen) return;
    const handler = (e) => {
      if (paragraphMenuRef.current && !paragraphMenuRef.current.contains(e.target)) setParagraphMenuOpen(false);
    };
    window.addEventListener("mousedown", handler);
    return () => window.removeEventListener("mousedown", handler);
  }, [paragraphMenuOpen]);

  // Mede a largura real do contêiner onde o artifact está renderizado — mais
  // confiável do que media queries de CSS, já que este ambiente pode
  // renderizar num iframe mais estreito que a tela, mesmo no desktop.
  useEffect(() => {
    const el = rootRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) setContainerWidth(entry.contentRect.width);
    });
    ro.observe(el);
    setContainerWidth(el.getBoundingClientRect().width);
    return () => ro.disconnect();
  }, []);

  // "pointer: coarse" identifica se a entrada PRINCIPAL do dispositivo é o
  // dedo (touch), não o tamanho da tela — funciona em tablets e celulares,
  // independente da largura, e não depende do texto do user-agent (que
  // navegadores vêm reduzindo por privacidade, e que iPads recentes disfarçam
  // como computador).
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(pointer: coarse)");
    setIsCoarsePointer(mq.matches);
    const handler = (e) => setIsCoarsePointer(e.matches);
    if (mq.addEventListener) mq.addEventListener("change", handler);
    else mq.addListener(handler);
    return () => {
      if (mq.removeEventListener) mq.removeEventListener("change", handler);
      else mq.removeListener(handler);
    };
  }, []);

  if (loading || !store || !project) {
    return (
      <div className="w-full h-screen flex items-center justify-center" style={{ backgroundColor: "#24211D", color: "#B7AF9C" }}>
        <div className="flex items-center gap-3">
          <Feather className="animate-pulse" size={20} />
          <span style={{ fontFamily: "'JetBrains Mono', monospace" }}>abrindo o manuscrito…</span>
        </div>
      </div>
    );
  }

  const colors = PALETTES[store.appSettings.theme];
  const fontSize = store.appSettings.fontSize;
  const fontFamilyValue = (FONT_OPTIONS.find((f) => f.key === (store.appSettings.fontFamily || "lora")) || FONT_OPTIONS[0]).value;
  const uiScaleValue = typeof store.appSettings.uiScale === "number" ? store.appSettings.uiScale : 1;
  const layoutMode = store.appSettings.layoutMode || "auto";
  const autoMobileLayout = containerWidth < 768 || (isCoarsePointer && containerWidth < 1024);
  const isMobileLayout = layoutMode === "desktop" ? false : layoutMode === "mobile" ? true : autoMobileLayout;

  const toggleExpand = (id) => setExpanded((e) => ({ ...e, [id]: !e[id] }));
  const toggleCenaSection = (key) => setCenaSections((s) => ({ ...s, [key]: !s[key] }));

  // ---------- structure mutations ----------
  const addAct = () => {
    const id = uid();
    updateProject((p) => ({ ...p, acts: [...p.acts, { id, title: `Ato ${p.acts.length + 1}`, chapters: [] }] }));
    setExpanded((e) => ({ ...e, [id]: true }));
  };

  const applyTemplate = (key) => {
    const acts = TEMPLATES[key]();
    updateProject((p) => ({ ...p, acts: [...p.acts, ...acts] }));
    setExpanded((e) => {
      const ne = { ...e };
      acts.forEach((a) => (ne[a.id] = true));
      return ne;
    });
    setSettingsOpen(false);
  };

  const addChapter = (actId) => {
    const id = uid();
    updateProject((p) => ({
      ...p,
      acts: p.acts.map((a) => (a.id === actId ? { ...a, chapters: [...a.chapters, { id, title: `Capítulo ${a.chapters.length + 1}`, scenes: [] }] } : a)),
    }));
    setExpanded((e) => ({ ...e, [id]: true }));
  };

  const addScene = (actId, chapterId) => {
    const id = uid();
    const scene = { id, title: "", content: "", tension: 3, status: "rascunho", synopsis: "", pov: "", characterIds: [], threadIds: [], versions: [] };
    updateProject((p) => ({
      ...p,
      acts: p.acts.map((a) =>
        a.id !== actId ? a : { ...a, chapters: a.chapters.map((c) => (c.id === chapterId ? { ...c, scenes: [...c.scenes, scene] } : c)) }
      ),
    }));
    setSelectedScene({ actId, chapterId, sceneId: id });
  };

  const renameNode = (type, ids, title) => {
    updateProject((p) => ({
      ...p,
      acts: p.acts.map((a) => {
        if (type === "act") return a.id === ids.actId ? { ...a, title } : a;
        if (a.id !== ids.actId) return a;
        return {
          ...a,
          chapters: a.chapters.map((c) => {
            if (type === "chapter") return c.id === ids.chapterId ? { ...c, title } : c;
            if (c.id !== ids.chapterId) return c;
            return { ...c, scenes: c.scenes.map((s) => (s.id === ids.sceneId ? { ...s, title } : s)) };
          }),
        };
      }),
    }));
  };

  const updateScene = (ids, patch) => {
    updateProject((p) => ({
      ...p,
      acts: p.acts.map((a) =>
        a.id !== ids.actId ? a : {
          ...a,
          chapters: a.chapters.map((c) =>
            c.id !== ids.chapterId ? c : { ...c, scenes: c.scenes.map((s) => (s.id === ids.sceneId ? { ...s, ...patch } : s)) }
          ),
        }
      ),
    }));
  };

  const deleteNode = (type, ids) => {
    updateProject((p) => ({
      ...p,
      acts: p.acts
        .filter((a) => !(type === "act" && a.id === ids.actId))
        .map((a) => {
          if (a.id !== ids.actId) return a;
          return {
            ...a,
            chapters: a.chapters
              .filter((c) => !(type === "chapter" && c.id === ids.chapterId))
              .map((c) => (c.id !== ids.chapterId ? c : { ...c, scenes: c.scenes.filter((s) => !(type === "scene" && s.id === ids.sceneId)) })),
          };
        }),
    }));
    if (type === "scene" && selectedScene?.sceneId === ids.sceneId) setSelectedScene(null);
  };

  // ---------- reordering helpers (menu-driven, more reliable than drag) ----------
  const moveAct = (actId, dir) => {
    updateProject((p) => {
      const idx = p.acts.findIndex((a) => a.id === actId);
      const newIdx = idx + dir;
      if (idx === -1 || newIdx < 0 || newIdx >= p.acts.length) return p;
      return { ...p, acts: reorder(p.acts, idx, newIdx) };
    });
  };
  const moveChapter = (actId, chapterId, dir) => {
    updateProject((p) => ({
      ...p,
      acts: p.acts.map((a) => {
        if (a.id !== actId) return a;
        const idx = a.chapters.findIndex((c) => c.id === chapterId);
        const newIdx = idx + dir;
        if (idx === -1 || newIdx < 0 || newIdx >= a.chapters.length) return a;
        return { ...a, chapters: reorder(a.chapters, idx, newIdx) };
      }),
    }));
  };
  const moveScene = (actId, chapterId, sceneId, dir) => {
    updateProject((p) => ({
      ...p,
      acts: p.acts.map((a) => {
        if (a.id !== actId) return a;
        return {
          ...a,
          chapters: a.chapters.map((c) => {
            if (c.id !== chapterId) return c;
            const idx = c.scenes.findIndex((s) => s.id === sceneId);
            const newIdx = idx + dir;
            if (idx === -1 || newIdx < 0 || newIdx >= c.scenes.length) return c;
            return { ...c, scenes: reorder(c.scenes, idx, newIdx) };
          }),
        };
      }),
    }));
  };
  const moveSceneToChapter = (fromIds, toActId, toChapterId) => {
    updateProject((p) => {
      let movedScene = null;
      const stripped = {
        ...p,
        acts: p.acts.map((a) => (a.id !== fromIds.actId ? a : {
          ...a,
          chapters: a.chapters.map((c) => {
            if (c.id !== fromIds.chapterId) return c;
            const found = c.scenes.find((s) => s.id === fromIds.sceneId);
            if (found) movedScene = found;
            return { ...c, scenes: c.scenes.filter((s) => s.id !== fromIds.sceneId) };
          }),
        })),
      };
      if (!movedScene) return p;
      return {
        ...stripped,
        acts: stripped.acts.map((a) => (a.id !== toActId ? a : {
          ...a,
          chapters: a.chapters.map((c) => (c.id !== toChapterId ? c : { ...c, scenes: [...c.scenes, movedScene] })),
        })),
      };
    });
    setSelectedScene({ actId: toActId, chapterId: toChapterId, sceneId: fromIds.sceneId });
    showToast("Cena movida");
  };
  const moveChapterToAct = (fromActId, chapterId, toActId) => {
    updateProject((p) => {
      let movedChapter = null;
      const stripped = {
        ...p,
        acts: p.acts.map((a) => {
          if (a.id !== fromActId) return a;
          const found = a.chapters.find((c) => c.id === chapterId);
          if (found) movedChapter = found;
          return { ...a, chapters: a.chapters.filter((c) => c.id !== chapterId) };
        }),
      };
      if (!movedChapter) return p;
      return { ...stripped, acts: stripped.acts.map((a) => (a.id !== toActId ? a : { ...a, chapters: [...a.chapters, movedChapter] })) };
    });
    showToast("Capítulo movido");
  };

  // drag & drop reorder (same parent only)
  const onDragStart = (type, ids, index) => (e) => {
    dragRef.current = { type, ids, index };
    e.dataTransfer.effectAllowed = "move";
  };
  const onDropOn = (type, ids, index) => (e) => {
    e.preventDefault();
    const drag = dragRef.current;
    if (!drag || drag.type !== type) return;
    if (type === "act") {
      if (drag.index === index) return;
      updateProject((p) => ({ ...p, acts: reorder(p.acts, drag.index, index) }));
    } else if (type === "chapter" && drag.ids.actId === ids.actId) {
      if (drag.index === index) return;
      updateProject((p) => ({
        ...p,
        acts: p.acts.map((a) => (a.id === ids.actId ? { ...a, chapters: reorder(a.chapters, drag.index, index) } : a)),
      }));
    } else if (type === "scene" && drag.ids.actId === ids.actId && drag.ids.chapterId === ids.chapterId) {
      if (drag.index === index) return;
      updateProject((p) => ({
        ...p,
        acts: p.acts.map((a) =>
          a.id !== ids.actId ? a : { ...a, chapters: a.chapters.map((c) => (c.id === ids.chapterId ? { ...c, scenes: reorder(c.scenes, drag.index, index) } : c)) }
        ),
      }));
    }
    dragRef.current = null;
  };

  // ---------- characters ----------
  const addCharacter = () => {
    updateProject((p) => ({
      ...p,
      characters: [...p.characters, {
        id: uid(), name: "Novo personagem", role: "", description: "", appearance: "",
        motivation: "", conflictInternal: "", conflictExternal: "", arc: "", relationships: [],
      }],
    }));
  };
  const updateCharacter = (id, patch) => updateProject((p) => ({ ...p, characters: p.characters.map((c) => (c.id === id ? { ...c, ...patch } : c)) }));
  const deleteCharacter = (id) => updateProject((p) => ({
    ...p,
    characters: p.characters.filter((c) => c.id !== id).map((c) => ({ ...c, relationships: c.relationships.filter((r) => r.charId !== id) })),
  }));
  const addRelationship = (charId, targetId, label) => {
    if (!targetId || !label) return;
    updateProject((p) => ({
      ...p,
      characters: p.characters.map((c) => (c.id === charId ? { ...c, relationships: [...c.relationships, { charId: targetId, type: label }] } : c)),
    }));
  };
  const removeRelationship = (charId, idx) => {
    updateProject((p) => ({
      ...p,
      characters: p.characters.map((c) => (c.id === charId ? { ...c, relationships: c.relationships.filter((_, i) => i !== idx) } : c)),
    }));
  };

  // ---------- notes & glossary ----------
  const addNote = (scope = "geral") => {
    const base = { id: uid(), title: "Nova nota", content: "", category: "ideia", pinned: false, tags: [], scope, sceneId: null, chapterId: null };
    if (scope === "cena" && selectedScene) { base.sceneId = selectedScene.sceneId; base.chapterId = selectedScene.chapterId; }
    if (scope === "capitulo" && selectedScene) { base.chapterId = selectedScene.chapterId; }
    updateProject((p) => ({ ...p, notes: [base, ...p.notes] }));
  };
  const updateNote = (id, patch) => updateProject((p) => ({ ...p, notes: p.notes.map((n) => (n.id === id ? { ...n, ...patch } : n)) }));
  const deleteNote = (id) => updateProject((p) => ({ ...p, notes: p.notes.filter((n) => n.id !== id) }));
  const addNoteTag = (id, tag) => {
    if (!tag.trim()) return;
    updateProject((p) => ({ ...p, notes: p.notes.map((n) => (n.id === id && !n.tags.includes(tag) ? { ...n, tags: [...n.tags, tag.trim()] } : n)) }));
  };
  const removeNoteTag = (id, tag) => updateProject((p) => ({ ...p, notes: p.notes.map((n) => (n.id === id ? { ...n, tags: n.tags.filter((t) => t !== tag) } : n)) }));

  const createNoteFromText = (text) => {
    const base = { id: uid(), title: text.slice(0, 40) || "Nova nota", content: text, category: "ideia", pinned: false, tags: [], scope: "geral", sceneId: null, chapterId: null };
    if (selectedScene && workspace === "manuscrito") { base.scope = "cena"; base.sceneId = selectedScene.sceneId; base.chapterId = selectedScene.chapterId; }
    updateProject((p) => ({ ...p, notes: [base, ...p.notes] }));
    setRightTab("notas");
    showToast("Nota criada a partir da seleção");
  };

  const addGlossary = () => updateProject((p) => ({ ...p, glossary: [...p.glossary, { id: uid(), term: "", definition: "" }] }));
  const updateGlossary = (id, patch) => updateProject((p) => ({ ...p, glossary: p.glossary.map((g) => (g.id === id ? { ...g, ...patch } : g)) }));
  const deleteGlossary = (id) => updateProject((p) => ({ ...p, glossary: p.glossary.filter((g) => g.id !== id) }));

  const linkTextToGlossary = (text) => {
    const term = (text || "").trim();
    if (!term) return;
    const existing = project.glossary.find((g) => g.term.toLowerCase() === term.toLowerCase());
    if (!existing) updateProject((p) => ({ ...p, glossary: [...p.glossary, { id: uid(), term, definition: "" }] }));
    setRightTab("glossario");
    showToast(existing ? `"${term}" já estava no glossário` : `"${term}" vinculado ao glossário`);
  };
  const linkSelectionToGlossary = () => {
    const ta = contentTextareaRef.current;
    if (!ta) return;
    linkTextToGlossary(ta.value.substring(ta.selectionStart, ta.selectionEnd));
  };

  // Atalhos de teclado estilo VS Code / Word: Ctrl (ou Cmd no Mac) + tecla,
  // agindo sobre a seleção atual da caixa de texto.
  const handleEditorKeyDown = (e, onChange) => {
    if (e.key === "Escape" && colorAutocomplete) {
      setColorAutocomplete(null);
      return;
    }
    const isMod = e.metaKey || e.ctrlKey;
    if (!isMod) return;
    const ta = e.target;
    const key = e.key.toLowerCase();
    if (key === "b" && !e.shiftKey) {
      e.preventDefault();
      toggleWrapSelectionInTextarea(ta, "**", "**", onChange);
      showToast("Negrito (Ctrl+B)");
    } else if (key === "i" && !e.shiftKey) {
      e.preventDefault();
      toggleWrapSelectionInTextarea(ta, "*", "*", onChange);
      showToast("Itálico (Ctrl+I)");
    } else if (key === "x" && e.shiftKey) {
      e.preventDefault();
      toggleWrapSelectionInTextarea(ta, "~~", "~~", onChange);
      showToast("Riscado (Ctrl+Shift+X)");
    } else if (key === "h" && e.shiftKey) {
      e.preventDefault();
      toggleWrapSelectionInTextarea(ta, "==", "==", onChange);
      showToast("Destaque (Ctrl+Shift+H)");
    } else if (key === "k" && !e.shiftKey) {
      e.preventDefault();
      linkTextToGlossary(ta.value.substring(ta.selectionStart, ta.selectionEnd));
    } else if (key === "l" && e.shiftKey) {
      e.preventDefault();
      setColorPicker({ taEl: ta, onChange });
    }
  };

  // Detecta o gatilho "{{c:" logo antes do cursor (estilo autocompletar do
  // VS Code) e mostra as opções de cor que combinam com o que já foi digitado.
  const checkColorAutocomplete = (ta, onChange) => {
    const pos = ta.selectionStart;
    const uptoCursor = ta.value.slice(Math.max(0, pos - 24), pos);
    const m = uptoCursor.match(/\{\{c:([a-zà-ú]*)$/i);
    if (!m) { setColorAutocomplete(null); return; }
    const query = m[1].toLowerCase();
    const options = TEXT_COLORS.filter((c) => c.key.startsWith(query));
    if (options.length === 0) { setColorAutocomplete(null); return; }
    const coords = getCaretCoordinates(ta);
    setColorAutocomplete({ taEl: ta, onChange, triggerStart: pos - query.length, options, x: coords.x, y: coords.y });
  };

  const applyColorAutocomplete = (colorKey) => {
    if (!colorAutocomplete) return;
    const { taEl, onChange, triggerStart } = colorAutocomplete;
    const value = taEl.value;
    const insertion = `${colorKey}}}`;
    const newValue = value.slice(0, triggerStart) + insertion + value.slice(taEl.selectionStart);
    onChange(newValue);
    setColorAutocomplete(null);
    requestAnimationFrame(() => {
      taEl.focus();
      const pos = triggerStart + insertion.length;
      taEl.setSelectionRange(pos, pos);
    });
  };

  // ---------- context menu ----------
  const openTextContextMenu = (e, onChange, opts = {}) => {
    e.preventDefault();
    const ta = opts.taOverride || e.target;
    const hasSelection = ta.selectionStart !== ta.selectionEnd;
    const selectedText = ta.value.substring(ta.selectionStart, ta.selectionEnd);
    setContextMenu({ x: e.clientX, y: e.clientY, taEl: ta, onChange, hasSelection, selectedText, ...opts });
  };

  const openTreeContextMenu = (e, items) => {
    e.preventDefault();
    e.stopPropagation();
    setTreeContextMenu({ x: e.clientX, y: e.clientY, items });
  };

  // Toque prolongado (~480ms) equivale ao clique direito em telas sensíveis ao
  // toque, onde não existe "botão direito". Chama o mesmo handler passado.
  const onLongPress = (handler) => ({
    onTouchStart: (e) => {
      const touch = e.touches[0];
      if (!touch) return;
      longPressTimer.current = setTimeout(() => {
        handler({
          preventDefault: () => {},
          stopPropagation: () => {},
          clientX: touch.clientX,
          clientY: touch.clientY,
          target: e.target,
        });
      }, 480);
    },
    onTouchEnd: () => { if (longPressTimer.current) clearTimeout(longPressTimer.current); },
    onTouchMove: () => { if (longPressTimer.current) clearTimeout(longPressTimer.current); },
  });

  // ---------- diaries (diário) ----------
  const addDiary = () => {
    const id = uid();
    updateProject((p) => ({ ...p, diaries: [...(p.diaries || []), { id, name: `Diário ${(p.diaries || []).length + 1}`, entries: [] }] }));
    setExpanded((ex) => ({ ...ex, [id]: true }));
  };
  const renameDiary = (id, name) => updateProject((p) => ({ ...p, diaries: p.diaries.map((d) => (d.id === id ? { ...d, name } : d)) }));
  const deleteDiary = (id) => {
    updateProject((p) => ({ ...p, diaries: p.diaries.filter((d) => d.id !== id) }));
    if (selectedEntry?.diaryId === id) setSelectedEntry(null);
  };
  const addEntry = (diaryId) => {
    const id = uid();
    const entry = { id, date: todayStr(), title: "", content: "", tags: [], checklist: [], mood: "" };
    updateProject((p) => ({ ...p, diaries: p.diaries.map((d) => (d.id === diaryId ? { ...d, entries: [entry, ...d.entries] } : d)) }));
    setSelectedEntry({ diaryId, entryId: id });
  };
  const updateEntry = (ids, patch) => updateProject((p) => ({
    ...p,
    diaries: p.diaries.map((d) => (d.id !== ids.diaryId ? d : { ...d, entries: d.entries.map((e) => (e.id === ids.entryId ? { ...e, ...patch } : e)) })),
  }));
  const deleteEntry = (ids) => {
    updateProject((p) => ({ ...p, diaries: p.diaries.map((d) => (d.id !== ids.diaryId ? d : { ...d, entries: d.entries.filter((e) => e.id !== ids.entryId) })) }));
    if (selectedEntry?.entryId === ids.entryId) setSelectedEntry(null);
  };
  const addEntryTag = (ids, tag) => {
    if (!tag.trim()) return;
    updateProject((p) => ({
      ...p,
      diaries: p.diaries.map((d) => (d.id !== ids.diaryId ? d : { ...d, entries: d.entries.map((e) => (e.id === ids.entryId && !e.tags.includes(tag) ? { ...e, tags: [...e.tags, tag.trim()] } : e)) })),
    }));
  };
  const removeEntryTag = (ids, tag) => updateProject((p) => ({
    ...p,
    diaries: p.diaries.map((d) => (d.id !== ids.diaryId ? d : { ...d, entries: d.entries.map((e) => (e.id === ids.entryId ? { ...e, tags: e.tags.filter((t) => t !== tag) } : e)) })),
  }));
  const addChecklistItem = (ids) => updateProject((p) => ({
    ...p,
    diaries: p.diaries.map((d) => (d.id !== ids.diaryId ? d : { ...d, entries: d.entries.map((e) => (e.id === ids.entryId ? { ...e, checklist: [...(e.checklist || []), { id: uid(), text: "", done: false }] } : e)) })),
  }));
  const updateChecklistItem = (ids, itemId, patch) => updateProject((p) => ({
    ...p,
    diaries: p.diaries.map((d) => (d.id !== ids.diaryId ? d : {
      ...d, entries: d.entries.map((e) => (e.id !== ids.entryId ? e : { ...e, checklist: (e.checklist || []).map((ci) => (ci.id === itemId ? { ...ci, ...patch } : ci)) })),
    })),
  }));
  const deleteChecklistItem = (ids, itemId) => updateProject((p) => ({
    ...p,
    diaries: p.diaries.map((d) => (d.id !== ids.diaryId ? d : { ...d, entries: d.entries.map((e) => (e.id !== ids.entryId ? e : { ...e, checklist: (e.checklist || []).filter((ci) => ci.id !== itemId) })) })),
  }));

  // ---------- threads (fios / plot grid) ----------
  const addThread = () => {
    updateProject((p) => ({
      ...p,
      threads: [...(p.threads || []), { id: uid(), name: `Fio ${(p.threads || []).length + 1}`, color: THREAD_COLORS[(p.threads || []).length % THREAD_COLORS.length] }],
    }));
  };
  const updateThread = (id, patch) => updateProject((p) => ({ ...p, threads: (p.threads || []).map((t) => (t.id === id ? { ...t, ...patch } : t)) }));
  const deleteThread = (id) => {
    updateProject((p) => ({
      ...p,
      threads: (p.threads || []).filter((t) => t.id !== id),
      acts: p.acts.map((a) => ({
        ...a,
        chapters: a.chapters.map((c) => ({ ...c, scenes: c.scenes.map((s) => ({ ...s, threadIds: (s.threadIds || []).filter((tid) => tid !== id) })) })),
      })),
    }));
  };

  // ---------- versions ----------
  const saveVersion = () => {
    if (!selectedScene) return;
    updateScene(selectedScene, {});
    updateProject((p) => ({
      ...p,
      acts: p.acts.map((a) =>
        a.id !== selectedScene.actId ? a : {
          ...a,
          chapters: a.chapters.map((c) =>
            c.id !== selectedScene.chapterId ? c : {
              ...c,
              scenes: c.scenes.map((s) =>
                s.id !== selectedScene.sceneId ? s : { ...s, versions: [{ ts: Date.now(), content: s.content }, ...(s.versions || [])].slice(0, 20) }
              ),
            }
          ),
        }
      ),
    }));
    showToast("Versão salva");
  };
  const restoreVersion = (content) => { updateScene(selectedScene, { content }); showToast("Versão restaurada"); };

  // ---------- projects ----------
  const createProject = () => {
    const p = emptyProject("Nova História");
    updateStore((prev) => ({ ...prev, projects: { ...prev.projects, [p.id]: p }, currentProjectId: p.id }));
    setSelectedScene(null);
    setProjectMenuOpen(false);
  };
  const switchProject = (id) => {
    updateStore((prev) => ({ ...prev, currentProjectId: id }));
    setSelectedScene(null);
    setProjectMenuOpen(false);
  };
  const deleteProject = (id) => {
    updateStore((prev) => {
      const rest = { ...prev.projects };
      delete rest[id];
      const ids = Object.keys(rest);
      if (ids.length === 0) {
        const p = emptyProject("Minha História");
        return { ...prev, projects: { [p.id]: p }, currentProjectId: p.id };
      }
      return { ...prev, projects: rest, currentProjectId: prev.currentProjectId === id ? ids[0] : prev.currentProjectId };
    });
    setSelectedScene(null);
  };

  // ---------- export / backup ----------
  const download = (filename, content, mime = "text/plain") => {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  };

  const exportManuscriptMarkdown = () => {
    let md = `# ${project.title}\n\n`;
    project.acts.forEach((act) => {
      md += `## ${act.title}\n\n`;
      act.chapters.forEach((ch) => {
        md += `### ${ch.title}\n\n`;
        ch.scenes.forEach((sc) => {
          if (sc.title) md += `**${sc.title}**\n\n`;
          md += `${sc.content || ""}\n\n`;
        });
      });
    });
    download(`${project.title.replace(/\s+/g, "_")}.md`, md, "text/markdown");
    showToast("Manuscrito exportado (.md)");
  };

  const exportBackup = () => {
    download(`${project.title.replace(/\s+/g, "_")}_backup.json`, JSON.stringify(project, null, 2), "application/json");
    showToast("Backup exportado (.json)");
  };

  const importBackup = (file) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const imported = JSON.parse(reader.result);
        const newId = uid();
        const proj = normalizeProject({ ...imported, id: newId });
        updateStore((prev) => ({ ...prev, projects: { ...prev.projects, [newId]: proj }, currentProjectId: newId }));
        showToast("Backup importado");
      } catch (e) {
        alert("Não foi possível importar este arquivo.");
      }
    };
    reader.readAsText(file);
  };

  // ---------- derived ----------
  const currentScene = selectedScene
    ? project.acts.find((a) => a.id === selectedScene.actId)?.chapters.find((c) => c.id === selectedScene.chapterId)?.scenes.find((s) => s.id === selectedScene.sceneId)
    : null;

  const currentEntry = selectedEntry
    ? (project.diaries || []).find((d) => d.id === selectedEntry.diaryId)?.entries.find((e) => e.id === selectedEntry.entryId)
    : null;

  const visibleNotes = project.notes.filter((n) => {
    if (noteFilter !== "todas" && n.category !== noteFilter) return false;
    const scope = n.scope || "geral";
    if (scope === "geral") return noteScopeFilter.geral;
    if (scope === "capitulo") {
      if (!noteScopeFilter.capitulo) return false;
      return !selectedScene || !n.chapterId || n.chapterId === selectedScene.chapterId;
    }
    if (scope === "cena") {
      if (!noteScopeFilter.cena) return false;
      return !selectedScene || !n.sceneId || n.sceneId === selectedScene.sceneId;
    }
    return true;
  });

  const arcData = flattenScenesForArc(project.acts);
  const chapters = flattenChapters(project.acts);

  const hist = project.wordHistory || [];
  const lastEarlier = [...hist].reverse().find((h) => h.date !== todayStr());
  const baseline = lastEarlier ? lastEarlier.words : 0;
  const todayWords = Math.max(0, totalWords - baseline);
  const goalPct = Math.min(100, Math.round((todayWords / (project.dailyWordGoal || 1)) * 100));

  const allProjects = Object.values(store.projects);

  return (
    <div ref={rootRef} className="w-full h-screen overflow-hidden" style={{ backgroundColor: colors.desk }}>
    <div className="w-full h-full flex flex-col" style={{ zoom: uiScaleValue }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,wght@0,500;0,600;1,500&family=Lora:ital,wght@0,400;0,500;1,400&family=JetBrains+Mono:wght@400;500&display=swap');
        .font-display { font-family: 'Fraunces', serif; }
        .font-body { font-family: 'Lora', serif; }
        .font-mono { font-family: 'JetBrains Mono', monospace; }
        ::-webkit-scrollbar { width: 8px; height: 8px; }
        ::-webkit-scrollbar-thumb { background: ${colors.paperEdge}; border-radius: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        .chip { border-radius: 999px; padding: 2px 9px; font-size: 11px; }
        .title-input::placeholder { color: ${colors.mutedLight}; opacity: 1; }
      `}</style>

      {/* Top bar */}
      <div className="flex items-center justify-between px-3 md:px-5 py-3 border-b flex-wrap gap-2" style={{ borderColor: colors.deskLight }}>
        <div className="flex items-center gap-2 relative">
          <Feather size={18} style={{ color: colors.gold }} />
          <button
            onClick={() => setProjectMenuOpen((v) => !v)}
            className="flex items-center gap-1 font-display text-lg"
            style={{ color: colors.mutedLight }}
          >
            {project.title}
            <ChevronsUpDown size={13} style={{ color: colors.muted }} />
          </button>
          {projectMenuOpen && (
            <div className="absolute top-9 left-0 z-20 w-64 rounded shadow-2xl p-2" style={{ backgroundColor: colors.panel }}>
              {allProjects.map((p) => (
                <div key={p.id} className="flex items-center gap-2 px-2 py-1.5 rounded group" style={{ backgroundColor: p.id === project.id ? colors.deskLight : "transparent" }}>
                  <button onClick={() => switchProject(p.id)} className="font-body text-sm flex-1 text-left truncate" style={{ color: colors.mutedLight }}>
                    {p.title}
                  </button>
                  {allProjects.length > 1 && (
                    <button onClick={() => deleteProject(p.id)} className="opacity-0 group-hover:opacity-100" style={{ color: colors.wine }}>
                      <Trash2 size={12} />
                    </button>
                  )}
                </div>
              ))}
              <button onClick={createProject} className="w-full flex items-center gap-1.5 px-2 py-1.5 mt-1 rounded font-mono text-xs" style={{ color: colors.gold }}>
                <FolderPlus size={13} /> nova história
              </button>
            </div>
          )}
          <input
            className={`${inputBase} font-mono text-xs w-0 hidden`}
            value={project.title}
            onChange={(e) => updateProject((p) => ({ ...p, title: e.target.value }))}
          />
        </div>

        <div className="flex items-center gap-1 p-0.5 rounded" style={{ backgroundColor: colors.deskLight }}>
          <button onClick={() => { setWorkspace("manuscrito"); setRightTab("cena"); }} className="flex items-center gap-1.5 px-3 py-1 rounded font-mono text-xs" style={{ backgroundColor: workspace === "manuscrito" ? colors.gold : "transparent", color: workspace === "manuscrito" ? colors.ink : colors.mutedLight }}>
            <Feather size={12} /> manuscrito
          </button>
          <button onClick={() => { setWorkspace("diario"); setRightTab("entrada"); }} className="flex items-center gap-1.5 px-3 py-1 rounded font-mono text-xs" style={{ backgroundColor: workspace === "diario" ? colors.gold : "transparent", color: workspace === "diario" ? colors.ink : colors.mutedLight }}>
            <Calendar size={12} /> diário
          </button>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className={`${isMobileLayout ? "hidden" : "flex"} items-center gap-2 font-mono text-[11px]`} style={{ color: colors.muted }}>
            <span>{totalWords.toLocaleString("pt-BR")} palavras</span>
            <span>·</span>
            <span>hoje {todayWords}/{project.dailyWordGoal}</span>
            <div className="w-16 h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: colors.deskLight }}>
              <div className="h-full" style={{ width: `${goalPct}%`, backgroundColor: colors.gold }} />
            </div>
            <span className="flex items-center gap-1" title={`recorde: ${streak.longest} dias`}>
              <Flame size={12} style={{ color: streak.current > 0 ? colors.gold : colors.muted }} /> {streak.current}
            </span>
            {saveError && <span style={{ color: colors.wine }}>erro ao salvar</span>}
          </div>
          <IconBtn onClick={() => setSearchOpen(true)} colors={colors} title="Buscar"><Search size={14} /></IconBtn>
          <IconBtn onClick={() => setHelpOpen(true)} colors={colors} title="Sintaxe e comandos"><HelpCircle size={14} /></IconBtn>
          <IconBtn onClick={() => setFocusMode((f) => !f)} colors={colors} active={focusMode} title="Modo foco"><Focus size={14} /></IconBtn>
          <IconBtn onClick={() => setSettingsOpen(true)} colors={colors} title="Configurações"><Settings size={14} /></IconBtn>
        </div>
      </div>

      <div className={`flex flex-1 min-h-0 ${isMobileLayout ? "flex-col" : "flex-row"}`}>
        {/* Left: diaries */}
        {!focusMode && workspace === "diario" && (
          <div className={`${isMobileLayout ? (mobilePanel === "estrutura" ? "flex" : "hidden") : "flex"} flex-col ${isMobileLayout ? "w-full" : "w-80"} flex-shrink-0 border-r overflow-y-auto p-3`} style={{ borderColor: colors.deskLight }}>
            <div className="flex items-center justify-between mb-3 px-1">
              <span className="font-mono text-[11px] uppercase tracking-wider" style={{ color: colors.muted }}>Diários</span>
              <button onClick={addDiary} className="p-1 rounded hover:opacity-80" style={{ color: colors.gold }} title="Novo diário">
                <Plus size={15} />
              </button>
            </div>
            {(project.diaries || []).length === 0 && (
              <p className="font-body text-sm px-1" style={{ color: colors.muted }}>Crie um diário — pode ser um diário pessoal, um caderno de ideias, um diário de pesquisa… quantos quiser.</p>
            )}
            {(project.diaries || []).map((d) => (
              <div key={d.id} className="mb-1">
                <div
                  onClick={() => toggleExpand(d.id)}
                  onContextMenu={(e) => openTreeContextMenu(e, [
                    { label: "Renomear", icon: Pencil, action: () => setRenamingId(d.id) },
                    { label: "Excluir diário", icon: Trash2, action: () => deleteDiary(d.id) },
                  ])}
                  {...onLongPress((e) => openTreeContextMenu(e, [
                    { label: "Renomear", icon: Pencil, action: () => setRenamingId(d.id) },
                    { label: "Excluir diário", icon: Trash2, action: () => deleteDiary(d.id) },
                  ]))}
                  className="flex items-center gap-1 group px-1 py-1 rounded cursor-pointer"
                  style={{ color: colors.mutedLight }}
                >
                  <span className="flex-shrink-0">
                    {expanded[d.id] ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                  </span>
                  <TreeLabel id={d.id} value={d.name} onChange={(v) => renameDiary(d.id, v)} renamingId={renamingId} setRenamingId={setRenamingId} className="font-display text-sm flex-1 min-w-0" />
                  <button onClick={(e) => { e.stopPropagation(); addEntry(d.id); }} className="opacity-0 group-hover:opacity-100 flex-shrink-0" style={{ color: colors.gold }}><Plus size={13} /></button>
                  <button onClick={(e) => { e.stopPropagation(); deleteDiary(d.id); }} className="flex-shrink-0" style={{ color: colors.wine }}><Trash2 size={12} /></button>
                </div>
                {expanded[d.id] && d.entries.length === 0 && (
                  <p className="font-mono text-[10px] ml-5 py-1" style={{ color: colors.muted }}>sem entradas ainda</p>
                )}
                {expanded[d.id] && d.entries.map((e) => {
                  const isSel = selectedEntry?.entryId === e.id;
                  const preview = (e.content || "").slice(0, 50);
                  return (
                    <div key={e.id} onClick={() => { setSelectedEntry({ diaryId: d.id, entryId: e.id }); setMobilePanel("escrita"); }} className="ml-5 px-2 py-1.5 rounded cursor-pointer mb-0.5 group/entry" style={{ backgroundColor: isSel ? colors.deskLight : "transparent" }}>
                      <div className="flex items-center justify-between gap-1">
                        <span className="font-mono text-[10px]" style={{ color: colors.gold }}>{e.date}{e.mood ? ` ${e.mood}` : ""}</span>
                        <button onClick={(ev) => { ev.stopPropagation(); deleteEntry({ diaryId: d.id, entryId: e.id }); }} className="flex-shrink-0" style={{ color: colors.wine }}><Trash2 size={12} /></button>
                      </div>
                      <p className="font-body text-sm truncate" style={{ color: colors.mutedLight }}>{e.title || preview || "(vazio)"}</p>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        )}

        {/* Left: structure */}
        {!focusMode && workspace === "manuscrito" && (
          <div className={`${isMobileLayout ? (mobilePanel === "estrutura" ? "flex" : "hidden") : "flex"} flex-col ${isMobileLayout ? "w-full" : "w-80"} flex-shrink-0 border-r overflow-y-auto p-3`} style={{ borderColor: colors.deskLight }}>
            <div className="flex items-center justify-between mb-2 px-1">
              <div className="flex items-center gap-1">
                <TabPill active={structView === "arvore"} onClick={() => setStructView("arvore")} colors={colors} icon={List} label="árvore" />
                <TabPill active={structView === "corkboard"} onClick={() => setStructView("corkboard")} colors={colors} icon={LayoutGrid} label="cartões" />
                <TabPill active={structView === "linha_tempo"} onClick={() => setStructView("linha_tempo")} colors={colors} icon={BookOpen} label="tempo" />
              </div>
              <button onClick={addAct} className="p-1 rounded hover:opacity-80" style={{ color: colors.gold }} title="Novo ato">
                <Plus size={15} />
              </button>
            </div>

            {project.acts.length === 0 && (
              <div className="px-1">
                <p className="font-body text-sm mb-2" style={{ color: colors.muted }}>Comece criando um ato, ou use um modelo pronto:</p>
                {Object.keys(TEMPLATES).map((k) => (
                  <button key={k} onClick={() => applyTemplate(k)} className="block w-full text-left font-mono text-[11px] px-2 py-1.5 mb-1 rounded" style={{ backgroundColor: colors.deskLight, color: colors.mutedLight }}>
                    {k === "tres_atos" ? "3 Atos" : k === "jornada_heroi" ? "Jornada do Herói" : "Save the Cat"}
                  </button>
                ))}
              </div>
            )}

            {structView === "arvore" && project.acts.map((act, actIdx) => (
              <div key={act.id} className="mb-1" draggable onDragStart={onDragStart("act", { actId: act.id }, actIdx)} onDragOver={(e) => e.preventDefault()} onDrop={onDropOn("act", { actId: act.id }, actIdx)}>
                <div
                  onClick={() => toggleExpand(act.id)}
                  onContextMenu={(e) => openTreeContextMenu(e, [
                    { label: "Renomear", icon: Pencil, action: () => setRenamingId(act.id) },
                    { label: "Mover para cima", icon: ChevronUp, action: () => moveAct(act.id, -1) },
                    { label: "Mover para baixo", icon: ChevronDown, action: () => moveAct(act.id, 1) },
                    { divider: true },
                    { label: "Excluir ato", icon: Trash2, action: () => deleteNode("act", { actId: act.id }) },
                  ])}
                  {...onLongPress((e) => openTreeContextMenu(e, [
                    { label: "Renomear", icon: Pencil, action: () => setRenamingId(act.id) },
                    { label: "Mover para cima", icon: ChevronUp, action: () => moveAct(act.id, -1) },
                    { label: "Mover para baixo", icon: ChevronDown, action: () => moveAct(act.id, 1) },
                    { divider: true },
                    { label: "Excluir ato", icon: Trash2, action: () => deleteNode("act", { actId: act.id }) },
                  ]))}
                  className="flex items-center gap-1 group px-1 py-1 rounded cursor-pointer"
                  style={{ color: colors.mutedLight }}
                >
                  <span className="flex-shrink-0">
                    {expanded[act.id] ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                  </span>
                  <TreeLabel id={act.id} value={act.title} onChange={(v) => renameNode("act", { actId: act.id }, v)} renamingId={renamingId} setRenamingId={setRenamingId} className="font-display text-sm flex-1 min-w-0" />
                  <button onClick={(e) => { e.stopPropagation(); addChapter(act.id); }} className="opacity-0 group-hover:opacity-100 flex-shrink-0" style={{ color: colors.gold }}><Plus size={13} /></button>
                  <button onClick={(e) => { e.stopPropagation(); deleteNode("act", { actId: act.id }); }} className="flex-shrink-0" style={{ color: colors.wine }}><Trash2 size={12} /></button>
                </div>

                {expanded[act.id] && act.chapters.map((chapter, chIdx) => (
                  <div key={chapter.id} className="ml-4" draggable onDragStart={onDragStart("chapter", { actId: act.id, chapterId: chapter.id }, chIdx)} onDragOver={(e) => e.preventDefault()} onDrop={onDropOn("chapter", { actId: act.id, chapterId: chapter.id }, chIdx)}>
                    <div
                      onClick={() => toggleExpand(chapter.id)}
                      onContextMenu={(e) => openTreeContextMenu(e, [
                        { label: "Renomear", icon: Pencil, action: () => setRenamingId(chapter.id) },
                        { label: "Mover para cima", icon: ChevronUp, action: () => moveChapter(act.id, chapter.id, -1) },
                        { label: "Mover para baixo", icon: ChevronDown, action: () => moveChapter(act.id, chapter.id, 1) },
                        {
                          label: "Mover para outro ato…", icon: FolderInput,
                          action: () => setMovePicker({
                            title: `Mover "${chapter.title}" para…`,
                            options: project.acts.map((a2) => ({ label: a2.title, disabled: a2.id === act.id, onClick: () => moveChapterToAct(act.id, chapter.id, a2.id) })),
                          }),
                        },
                        { divider: true },
                        { label: "Excluir capítulo", icon: Trash2, action: () => deleteNode("chapter", { actId: act.id, chapterId: chapter.id }) },
                      ])}
                      {...onLongPress((e) => openTreeContextMenu(e, [
                        { label: "Renomear", icon: Pencil, action: () => setRenamingId(chapter.id) },
                        { label: "Mover para cima", icon: ChevronUp, action: () => moveChapter(act.id, chapter.id, -1) },
                        { label: "Mover para baixo", icon: ChevronDown, action: () => moveChapter(act.id, chapter.id, 1) },
                        {
                          label: "Mover para outro ato…", icon: FolderInput,
                          action: () => setMovePicker({
                            title: `Mover "${chapter.title}" para…`,
                            options: project.acts.map((a2) => ({ label: a2.title, disabled: a2.id === act.id, onClick: () => moveChapterToAct(act.id, chapter.id, a2.id) })),
                          }),
                        },
                        { divider: true },
                        { label: "Excluir capítulo", icon: Trash2, action: () => deleteNode("chapter", { actId: act.id, chapterId: chapter.id }) },
                      ]))}
                      className="flex items-center gap-1 group px-1 py-1 rounded cursor-pointer"
                    >
                      <span className="flex-shrink-0" style={{ color: colors.mutedLight }}>
                        {expanded[chapter.id] ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                      </span>
                      <TreeLabel id={chapter.id} value={chapter.title} onChange={(v) => renameNode("chapter", { actId: act.id, chapterId: chapter.id }, v)} renamingId={renamingId} setRenamingId={setRenamingId} className="font-body text-sm flex-1 min-w-0" style={{ color: colors.mutedLight }} />
                      <button onClick={(e) => { e.stopPropagation(); addScene(act.id, chapter.id); }} className="opacity-0 group-hover:opacity-100 flex-shrink-0" style={{ color: colors.gold }}><Plus size={12} /></button>
                      <button onClick={(e) => { e.stopPropagation(); deleteNode("chapter", { actId: act.id, chapterId: chapter.id }); }} className="flex-shrink-0" style={{ color: colors.wine }}><Trash2 size={11} /></button>
                    </div>

                    {expanded[chapter.id] && chapter.scenes.map((scene, si) => {
                      const isSel = selectedScene?.sceneId === scene.id;
                      return (
                        <div key={scene.id} draggable onDragStart={onDragStart("scene", { actId: act.id, chapterId: chapter.id }, si)} onDragOver={(e) => e.preventDefault()} onDrop={onDropOn("scene", { actId: act.id, chapterId: chapter.id }, si)}
                          onClick={() => { setSelectedScene({ actId: act.id, chapterId: chapter.id, sceneId: scene.id }); setMobilePanel("escrita"); }}
                          onContextMenu={(e) => openTreeContextMenu(e, [
                            { label: "Mover para cima", icon: ChevronUp, action: () => moveScene(act.id, chapter.id, scene.id, -1) },
                            { label: "Mover para baixo", icon: ChevronDown, action: () => moveScene(act.id, chapter.id, scene.id, 1) },
                            {
                              label: "Mover para outro capítulo…", icon: FolderInput,
                              action: () => setMovePicker({
                                title: `Mover "${scene.title || "cena"}" para…`,
                                options: project.acts.flatMap((a2) => a2.chapters.map((c2) => ({
                                  label: `${a2.title} → ${c2.title}`,
                                  disabled: c2.id === chapter.id,
                                  onClick: () => moveSceneToChapter({ actId: act.id, chapterId: chapter.id, sceneId: scene.id }, a2.id, c2.id),
                                }))),
                              }),
                            },
                            { divider: true },
                            { label: "Excluir cena", icon: Trash2, action: () => deleteNode("scene", { actId: act.id, chapterId: chapter.id, sceneId: scene.id }) },
                          ])}
                          {...onLongPress((e) => openTreeContextMenu(e, [
                            { label: "Mover para cima", icon: ChevronUp, action: () => moveScene(act.id, chapter.id, scene.id, -1) },
                            { label: "Mover para baixo", icon: ChevronDown, action: () => moveScene(act.id, chapter.id, scene.id, 1) },
                            {
                              label: "Mover para outro capítulo…", icon: FolderInput,
                              action: () => setMovePicker({
                                title: `Mover "${scene.title || "cena"}" para…`,
                                options: project.acts.flatMap((a2) => a2.chapters.map((c2) => ({
                                  label: `${a2.title} → ${c2.title}`,
                                  disabled: c2.id === chapter.id,
                                  onClick: () => moveSceneToChapter({ actId: act.id, chapterId: chapter.id, sceneId: scene.id }, a2.id, c2.id),
                                }))),
                              }),
                            },
                            { divider: true },
                            { label: "Excluir cena", icon: Trash2, action: () => deleteNode("scene", { actId: act.id, chapterId: chapter.id, sceneId: scene.id }) },
                          ]))}
                          className="ml-5 flex items-center gap-2 px-2 py-1 rounded cursor-pointer group/scene"
                          style={{ backgroundColor: isSel ? colors.deskLight : "transparent" }}>
                          <span className="font-mono text-[9px] chip" style={{ backgroundColor: colors.deskLight, color: colors.gold }}>{STATUS[scene.status].abbr}</span>
                          <span className="font-body text-sm truncate flex-1" style={{ color: isSel ? colors.paper : colors.mutedLight }}>{scene.title || `Cena ${si + 1}`}</span>
                          <span className="font-mono text-[10px] flex-shrink-0" style={{ color: colors.muted }}>{wordCount(scene.content)}</span>
                          <button onClick={(e) => { e.stopPropagation(); deleteNode("scene", { actId: act.id, chapterId: chapter.id, sceneId: scene.id }); }} className="flex-shrink-0" style={{ color: colors.wine }}><Trash2 size={12} /></button>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            ))}

            {structView === "corkboard" && (
              <div className="grid grid-cols-1 gap-2 mt-2">
                {project.acts.flatMap((a) => a.chapters.flatMap((c) => c.scenes.map((s) => ({ ...s, actTitle: a.title, chapterTitle: c.title, actId: a.id, chapterId: c.id }))))
                  .map((s) => (
                    <div key={s.id} onClick={() => setSelectedScene({ actId: s.actId, chapterId: s.chapterId, sceneId: s.id })}
                      className="p-2.5 rounded cursor-pointer" style={{ backgroundColor: colors.paper, border: `1px solid ${colors.paperEdge}` }}>
                      <div className="font-mono text-[9px] mb-1" style={{ color: colors.muted }}>{s.actTitle} · {s.chapterTitle}</div>
                      <div className="font-display text-sm mb-1" style={{ color: colors.ink }}>{s.title || "(sem título)"}</div>
                      <div className="font-body text-xs line-clamp-3" style={{ color: colors.muted }}>{s.synopsis || s.content?.slice(0, 120) || "sem sinopse"}</div>
                    </div>
                  ))}
              </div>
            )}

            {structView === "linha_tempo" && (
              <div className="mt-2 space-y-2">
                <p className="font-mono text-[10px] mb-2" style={{ color: colors.muted }}>ordem cronológica dos eventos (defina na cena)</p>
                {project.acts.flatMap((a) => a.chapters.flatMap((c) => c.scenes.map((s) => ({ ...s, actId: a.id, chapterId: c.id }))))
                  .slice()
                  .sort((a, b) => (a.chronOrder ?? 9999) - (b.chronOrder ?? 9999))
                  .map((s) => (
                    <div key={s.id} onClick={() => setSelectedScene({ actId: s.actId, chapterId: s.chapterId, sceneId: s.id })} className="flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer" style={{ backgroundColor: colors.deskLight }}>
                      <span className="font-mono text-[10px] w-6" style={{ color: colors.gold }}>{s.chronOrder ?? "–"}</span>
                      <span className="font-body text-sm truncate" style={{ color: colors.mutedLight }}>{s.title || "(sem título)"}</span>
                    </div>
                  ))}
              </div>
            )}
          </div>
        )}

        {/* Center: manuscript page */}
        <div className={`${isMobileLayout ? (mobilePanel === "escrita" ? "flex" : "hidden") : "flex"} flex-1 min-w-0 overflow-y-auto justify-center ${isMobileLayout ? "py-4 px-2" : "py-8 px-4"}`}>
          {workspace === "diario" ? (
            currentEntry ? (
              <div className={`w-full max-w-2xl rounded-sm shadow-2xl ${isMobileLayout ? "p-5" : "p-10"} min-h-full`} style={{ backgroundColor: colors.paper, boxShadow: "0 20px 60px rgba(0,0,0,0.4)" }}>
                <div className="flex items-center gap-3 mb-2">
                  <input className={`${inputBase} font-display text-2xl flex-1 title-input`} style={{ color: colors.mutedLight }} placeholder="Título da entrada (opcional)" value={currentEntry.title} onChange={(e) => updateEntry(selectedEntry, { title: e.target.value })} />
                  <button
                    onClick={() => { setRightTab("entrada"); setFocusMode(false); setMobilePanel("detalhes"); }}
                    className="flex-shrink-0 flex items-center gap-1 font-mono text-[10px] px-2 py-1.5 rounded"
                    style={{ backgroundColor: colors.paperEdge, color: colors.muted }}
                    title="Data, humor, tags e lista de tarefas desta entrada"
                  >
                    <SlidersHorizontal size={11} /> detalhes
                  </button>
                </div>

                <div className="flex items-center gap-1 mb-4 font-mono text-[11px]" style={{ color: colors.muted }}>
                  <Calendar size={12} style={{ color: colors.gold }} />
                  <input type="date" className={`${inputBase}`} style={{ color: colors.ink }} value={currentEntry.date} onChange={(e) => updateEntry(selectedEntry, { date: e.target.value })} />
                  {currentEntry.mood && <span className="ml-1">{currentEntry.mood}</span>}
                </div>

                <textarea
                  ref={entryTextareaRef}
                  className={`${inputBase} font-body leading-relaxed w-full resize-none`}
                  style={{ color: colors.ink, minHeight: "50vh", fontSize: `${fontSize}px` }}
                  placeholder="Escreva livremente…"
                  value={currentEntry.content}
                  onChange={(e) => updateEntry(selectedEntry, { content: e.target.value })}
                  onKeyDown={(e) => handleEditorKeyDown(e, (v) => updateEntry(selectedEntry, { content: v }))}
                  onContextMenu={(e) => openTextContextMenu(e, (v) => updateEntry(selectedEntry, { content: v }), { onCreateNote: createNoteFromText })}
                  {...onLongPress((e) => openTextContextMenu(e, (v) => updateEntry(selectedEntry, { content: v }), { onCreateNote: createNoteFromText }))}
                />

                <div className="mt-3 text-right">
                  <span className="font-mono text-[10px]" style={{ color: colors.muted }}>{wordCount(currentEntry.content)} palavras</span>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center max-w-sm">
                <Calendar size={28} style={{ color: colors.muted }} className="mb-3" />
                <p className="font-body" style={{ color: colors.mutedLight }}>Crie um diário à esquerda e depois uma entrada, para anotar o que quiser, sem estrutura.</p>
              </div>
            )
          ) : currentScene ? (
            <div className={`w-full max-w-2xl rounded-sm shadow-2xl ${isMobileLayout ? "p-5" : "p-10"} min-h-full`} style={{ backgroundColor: colors.paper, boxShadow: "0 20px 60px rgba(0,0,0,0.4)" }}>
              <div className="flex items-center gap-3 mb-6">
                <input className={`${inputBase} font-display text-2xl flex-1 title-input`} style={{ color: colors.mutedLight }} placeholder="Título da cena" value={currentScene.title} onChange={(e) => renameNode("scene", selectedScene, e.target.value)} />
                <button
                  onClick={() => { setRightTab("cena"); setFocusMode(false); setMobilePanel("detalhes"); }}
                  className="flex-shrink-0 flex items-center gap-1 font-mono text-[10px] px-2 py-1.5 rounded"
                  style={{ backgroundColor: colors.paperEdge, color: colors.muted }}
                  title="Sinopse, status, personagens, ferramentas de escrita e versões"
                >
                  <SlidersHorizontal size={11} /> detalhes
                </button>
              </div>

              {readMode ? (
                <div
                  className="w-full break-words"
                  style={{ color: colors.ink, minHeight: "50vh", fontSize: `${fontSize}px`, fontFamily: fontFamilyValue, lineHeight: 1.7, overflowWrap: "break-word" }}
                  onClick={(e) => e.stopPropagation()}
                >
                  {renderMarkdownContent(currentScene.content, project.glossary, (g) => setGlossaryPopover(g))}
                </div>
              ) : cmMode ? (
                <CodeMirrorSceneEditor
                  content={currentScene.content}
                  onChange={(v) => updateScene(selectedScene, { content: v })}
                  colors={colors}
                  fontSize={fontSize}
                  fontFamily={fontFamilyValue}
                />
              ) : visualMode ? (
                <div className="w-full break-words" style={{ minHeight: "50vh" }} onClick={(e) => e.stopPropagation()}>
                  <VisualMarkdownEditor
                    content={currentScene.content}
                    onChange={(v) => updateScene(selectedScene, { content: v })}
                    glossary={project.glossary}
                    onTermClick={(g) => setGlossaryPopover(g)}
                    colors={colors}
                    fontSize={fontSize}
                    fontFamily={fontFamilyValue}
                  />
                </div>
              ) : (
                <textarea
                  ref={contentTextareaRef}
                  className={`${inputBase} leading-relaxed w-full resize-none break-words`}
                  style={{ color: colors.ink, minHeight: "50vh", fontSize: `${fontSize}px`, fontFamily: fontFamilyValue }}
                  placeholder="Era uma vez…"
                  value={currentScene.content}
                  onChange={(e) => { updateScene(selectedScene, { content: e.target.value }); checkColorAutocomplete(e.target, (v) => updateScene(selectedScene, { content: v })); }}
                  onKeyDown={(e) => handleEditorKeyDown(e, (v) => updateScene(selectedScene, { content: v }))}
                  onContextMenu={(e) => openTextContextMenu(e, (v) => updateScene(selectedScene, { content: v }), { onCreateNote: createNoteFromText })}
                  {...onLongPress((e) => openTextContextMenu(e, (v) => updateScene(selectedScene, { content: v }), { onCreateNote: createNoteFromText }))}
                />
              )}

              <div className="mt-3 flex items-center justify-between">
                <span className="font-mono text-[9px] chip" style={{ backgroundColor: colors.paperEdge, color: colors.gold }}>{STATUS[currentScene.status].abbr}</span>
                <span className="font-mono text-[10px]" style={{ color: colors.muted }}>{wordCount(currentScene.content)} palavras</span>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center max-w-sm">
              <Feather size={28} style={{ color: colors.muted }} className="mb-3" />
              <p className="font-body" style={{ color: colors.mutedLight }}>Selecione uma cena na estrutura à esquerda, crie um ato, ou aplique um modelo pronto nas configurações.</p>
            </div>
          )}
        </div>

        {/* Right: panels */}
        {!focusMode && (
          <div className={`${isMobileLayout ? (mobilePanel === "detalhes" ? "flex" : "hidden") : "flex"} ${isMobileLayout ? "w-full" : "w-96"} flex-shrink-0 border-l flex-col`} style={{ borderColor: colors.deskLight }}>
            <div className="flex border-b" style={{ borderColor: colors.deskLight }}>
              {(workspace === "diario" ? DIARIO_TABS : MANUSCRITO_TABS).map((t) => (
                <button key={t.key} onClick={() => setRightTab(t.key)} className="flex-1 flex flex-col items-center gap-1 py-2.5 font-mono text-[10px] uppercase tracking-wide"
                  style={{ color: rightTab === t.key ? colors.gold : colors.muted, borderBottom: rightTab === t.key ? `2px solid ${colors.gold}` : "2px solid transparent" }}>
                  <t.icon size={14} />{t.label}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto p-3">
              {rightTab === "entrada" && (
                currentEntry ? (
                  <div>
                    <CollapsibleSection title="humor" open={cenaSections.humor} onToggle={() => toggleCenaSection("humor")} colors={colors}>
                      <div className="flex flex-wrap items-center gap-1">
                        {MOOD_OPTIONS.map((m) => (
                          <button key={m} onClick={() => updateEntry(selectedEntry, { mood: currentEntry.mood === m ? "" : m })} className="text-lg px-2 py-1 rounded" style={{ backgroundColor: currentEntry.mood === m ? colors.gold : colors.deskLight }}>{m}</button>
                        ))}
                      </div>
                    </CollapsibleSection>

                    <CollapsibleSection title="formatação" open={cenaSections.entradaFormatacao} onToggle={() => toggleCenaSection("entradaFormatacao")} colors={colors}>
                      <button
                        onClick={(e) => openTextContextMenu(e, (v) => updateEntry(selectedEntry, { content: v }), { onCreateNote: createNoteFromText, taOverride: entryTextareaRef.current })}
                        className="w-full flex items-center gap-2 px-2 py-1.5 rounded font-mono text-xs text-left"
                        style={{ backgroundColor: colors.deskLight, color: colors.mutedLight }}
                      >
                        <Bold size={12} /> formatar seleção…
                      </button>
                    </CollapsibleSection>

                    <CollapsibleSection title="tags" open={cenaSections.entradaTags} onToggle={() => toggleCenaSection("entradaTags")} colors={colors} count={(currentEntry.tags || []).length}>
                      <TagRow tags={currentEntry.tags || []} colors={colors} onAdd={(t) => addEntryTag(selectedEntry, t)} onRemove={(t) => removeEntryTag(selectedEntry, t)} />
                    </CollapsibleSection>

                    <CollapsibleSection title="lista de tarefas / lembretes" open={cenaSections.checklist} onToggle={() => toggleCenaSection("checklist")} colors={colors} count={(currentEntry.checklist || []).length}>
                      <button onClick={() => addChecklistItem(selectedEntry)} className="w-full flex items-center justify-center gap-1 font-mono text-[11px] px-2 py-1.5 mb-2 rounded" style={{ backgroundColor: colors.deskLight, color: colors.mutedLight }}>
                        <Plus size={11} /> novo item
                      </button>
                      {(currentEntry.checklist || []).length === 0 ? (
                        <p className="font-mono text-[10px]" style={{ color: colors.muted }}>nenhum item ainda</p>
                      ) : (
                        <div className="space-y-1">
                          {currentEntry.checklist.map((ci) => (
                            <div key={ci.id} className="flex items-center gap-2">
                              <input type="checkbox" checked={ci.done} onChange={(e) => updateChecklistItem(selectedEntry, ci.id, { done: e.target.checked })} />
                              <input className={`${inputBase} font-body text-sm flex-1`} style={{ color: colors.mutedLight, textDecoration: ci.done ? "line-through" : "none", opacity: ci.done ? 0.5 : 1 }} value={ci.text} onChange={(e) => updateChecklistItem(selectedEntry, ci.id, { text: e.target.value })} placeholder="item…" />
                              <button onClick={() => deleteChecklistItem(selectedEntry, ci.id)} style={{ color: colors.wine }}><X size={12} /></button>
                            </div>
                          ))}
                        </div>
                      )}
                    </CollapsibleSection>
                  </div>
                ) : (
                  <p className="font-body text-sm" style={{ color: colors.muted }}>Selecione uma entrada para ver e editar seus detalhes.</p>
                )
              )}

              {rightTab === "cena" && (
                currentScene ? (
                  <div>
                    <CollapsibleSection title="sinopse" open={cenaSections.sinopse} onToggle={() => toggleCenaSection("sinopse")} colors={colors}>
                      <textarea
                        className={`${inputBase} font-body text-sm w-full resize-none rounded px-2 py-1.5`}
                        style={{ color: colors.mutedLight, backgroundColor: colors.deskLight, minHeight: "60px" }}
                        placeholder="Sinopse curta da cena…"
                        value={currentScene.synopsis}
                        onChange={(e) => updateScene(selectedScene, { synopsis: e.target.value })}
                      />
                    </CollapsibleSection>

                    <CollapsibleSection title="detalhes" open={cenaSections.detalhes} onToggle={() => toggleCenaSection("detalhes")} colors={colors}>
                      <div className="grid grid-cols-2 gap-2 font-mono text-[10px]" style={{ color: colors.muted }}>
                        <div>
                          <div className="mb-1">status</div>
                          <select className="w-full px-2 py-1 rounded outline-none" style={{ backgroundColor: colors.deskLight, color: colors.mutedLight }} value={currentScene.status} onChange={(e) => updateScene(selectedScene, { status: e.target.value })}>
                            {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                          </select>
                        </div>
                        <div>
                          <div className="mb-1">POV</div>
                          <select className="w-full px-2 py-1 rounded outline-none" style={{ backgroundColor: colors.deskLight, color: colors.mutedLight }} value={currentScene.pov || ""} onChange={(e) => updateScene(selectedScene, { pov: e.target.value })}>
                            <option value="">—</option>
                            {project.characters.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                          </select>
                        </div>
                        <div>
                          <div className="mb-1">ordem cronológica</div>
                          <input type="number" className="w-full px-2 py-1 rounded outline-none" style={{ backgroundColor: colors.deskLight, color: colors.mutedLight }} value={currentScene.chronOrder ?? ""} onChange={(e) => updateScene(selectedScene, { chronOrder: e.target.value === "" ? undefined : Number(e.target.value) })} />
                        </div>
                        <div>
                          <div className="mb-1">tensão: {currentScene.tension}</div>
                          <input type="range" min="0" max="10" value={currentScene.tension} onChange={(e) => updateScene(selectedScene, { tension: Number(e.target.value) })} className="w-full mt-2" />
                        </div>
                      </div>
                    </CollapsibleSection>

                    <CollapsibleSection title="personagens na cena" open={cenaSections.personagens} onToggle={() => toggleCenaSection("personagens")} colors={colors} count={(currentScene.characterIds || []).length}>
                      {project.characters.length === 0 ? (
                        <p className="font-mono text-[10px]" style={{ color: colors.muted }}>nenhum personagem criado ainda</p>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {project.characters.map((c) => {
                            const active = (currentScene.characterIds || []).includes(c.id);
                            return (
                              <button key={c.id} onClick={() => updateScene(selectedScene, {
                                characterIds: active ? currentScene.characterIds.filter((id) => id !== c.id) : [...(currentScene.characterIds || []), c.id],
                              })} className="chip font-mono" style={{ backgroundColor: active ? colors.gold : colors.deskLight, color: active ? colors.ink : colors.muted }}>
                                {c.name}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </CollapsibleSection>

                    {(project.threads || []).length > 0 && (
                      <CollapsibleSection title="fios narrativos" open={cenaSections.fios} onToggle={() => toggleCenaSection("fios")} colors={colors} count={(currentScene.threadIds || []).length}>
                        <div className="flex flex-wrap gap-1">
                          {project.threads.map((t) => {
                            const active = (currentScene.threadIds || []).includes(t.id);
                            return (
                              <button key={t.id} onClick={() => updateScene(selectedScene, {
                                threadIds: active ? currentScene.threadIds.filter((id) => id !== t.id) : [...(currentScene.threadIds || []), t.id],
                              })} className="chip font-mono" style={{ backgroundColor: active ? t.color : colors.deskLight, color: active ? "#fff" : colors.muted }}>
                                {t.name}
                              </button>
                            );
                          })}
                        </div>
                      </CollapsibleSection>
                    )}

                    <CollapsibleSection title="ferramentas de escrita" open={cenaSections.ferramentas} onToggle={() => toggleCenaSection("ferramentas")} colors={colors}>
                      <div className="flex flex-wrap gap-1.5 mb-2">
                        <button onClick={() => { insertDialogueLine(contentTextareaRef.current, (v) => updateScene(selectedScene, { content: v })); showToast("Fala inserida"); }} disabled={readMode || visualMode} className="flex items-center gap-1 font-mono text-[10px] px-2 py-1 rounded disabled:opacity-30" style={{ backgroundColor: colors.deskLight, color: colors.mutedLight }}>
                          <Quote size={11} /> diálogo
                        </button>
                        <button onClick={() => { insertSceneBreak(contentTextareaRef.current, (v) => updateScene(selectedScene, { content: v })); showToast("Quebra de cena inserida"); }} disabled={readMode || visualMode} className="flex items-center gap-1 font-mono text-[10px] px-2 py-1 rounded disabled:opacity-30" style={{ backgroundColor: colors.deskLight, color: colors.mutedLight }}>
                          <Minus size={11} /> quebra
                        </button>
                        <div className="relative" ref={paragraphMenuRef}>
                          <button onClick={() => setParagraphMenuOpen((o) => !o)} disabled={readMode || visualMode} className="flex items-center gap-1 font-mono text-[10px] px-2 py-1 rounded disabled:opacity-30" style={{ backgroundColor: paragraphMenuOpen ? colors.gold : colors.deskLight, color: paragraphMenuOpen ? colors.ink : colors.mutedLight }}>
                            <Pilcrow size={11} /> parágrafo
                          </button>
                          {paragraphMenuOpen && (
                            <div className="absolute left-0 top-full mt-1 z-20 w-44 rounded shadow-2xl p-1" style={{ backgroundColor: colors.panel }}>
                              {PARAGRAPH_STYLES.map((ps) => (
                                <button
                                  key={ps.key}
                                  onClick={() => {
                                    const applied = applyParagraphStyle(contentTextareaRef.current, ps.key, (v) => updateScene(selectedScene, { content: v }));
                                    setParagraphMenuOpen(false);
                                    if (applied) {
                                      showToast(`Parágrafo: ${ps.label}`);
                                    } else if (ps.key === "h1") {
                                      showToast("Já existe um Título grande nesta cena");
                                    } else if (ps.key === "h2") {
                                      showToast("Adicione um Título grande antes deste");
                                    } else if (ps.key === "h3") {
                                      showToast("Adicione um Título antes deste");
                                    }
                                  }}
                                  className="w-full px-2 py-1.5 rounded font-mono text-xs text-left"
                                  style={{ color: colors.mutedLight }}
                                >
                                  {ps.label}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>

                      <button onClick={() => { setReadMode((r) => !r); if (!readMode) { setVisualMode(false); setCmMode(false); } showToast(!readMode ? "Modo leitura — markdown convertido em visual" : "Modo escrita"); }} className="w-full flex items-center gap-2 px-2 py-1.5 mb-2 rounded font-mono text-xs text-left" style={{ backgroundColor: colors.deskLight, color: colors.mutedLight }}>
                        {readMode ? <EyeOff size={12} /> : <Eye size={12} />} {readMode ? "voltar ao modo escrita" : "modo leitura"}
                      </button>

                      <button
                        onClick={() => { setVisualMode((v) => !v); if (!visualMode) { setReadMode(false); setCmMode(false); } showToast(!visualMode ? "Editor visual — clique num parágrafo para ver a marcação" : "Editor de texto simples"); }}
                        disabled={readMode}
                        className="w-full flex items-center gap-2 px-2 py-1.5 mb-2 rounded font-mono text-xs text-left disabled:opacity-30"
                        style={{ backgroundColor: visualMode ? colors.gold : colors.deskLight, color: visualMode ? colors.ink : colors.mutedLight }}
                      >
                        <Pilcrow size={12} /> {visualMode ? "desligar editor visual" : "editor visual (clique no parágrafo)"}
                      </button>

                      <button
                        onClick={() => { setCmMode((v) => !v); if (!cmMode) { setReadMode(false); setVisualMode(false); } showToast(!cmMode ? "Editor CodeMirror — base sem decoração ainda" : "Editor de texto simples"); }}
                        disabled={readMode}
                        className="w-full flex items-center gap-2 px-2 py-1.5 mb-2 rounded font-mono text-xs text-left disabled:opacity-30"
                        style={{ backgroundColor: cmMode ? colors.gold : colors.deskLight, color: cmMode ? colors.ink : colors.mutedLight }}
                      >
                        <Sparkles size={12} /> {cmMode ? "desligar editor CodeMirror" : "editor CodeMirror (teste)"}
                      </button>

                      <div className="flex items-center gap-2 mb-2">
                        <span className="font-mono text-[10px]" style={{ color: colors.muted }}>fonte</span>
                        <button onClick={() => updateStore((p) => ({ ...p, appSettings: { ...p.appSettings, fontSize: Math.max(12, p.appSettings.fontSize - 1) } }))} className="px-2 py-1 rounded font-mono text-xs" style={{ backgroundColor: colors.deskLight, color: colors.mutedLight }}>A-</button>
                        <span className="font-mono text-[10px]" style={{ color: colors.mutedLight }}>{fontSize}px</span>
                        <button onClick={() => updateStore((p) => ({ ...p, appSettings: { ...p.appSettings, fontSize: Math.min(28, p.appSettings.fontSize + 1) } }))} className="px-2 py-1 rounded font-mono text-xs" style={{ backgroundColor: colors.deskLight, color: colors.mutedLight }}>A+</button>
                      </div>
                      <select
                        className="w-full font-mono text-xs rounded px-2 py-1 outline-none mb-2"
                        style={{ backgroundColor: colors.deskLight, color: colors.mutedLight }}
                        value={store.appSettings.fontFamily || "lora"}
                        onChange={(e) => updateStore((p) => ({ ...p, appSettings: { ...p.appSettings, fontFamily: e.target.value } }))}
                      >
                        {FONT_OPTIONS.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
                      </select>

                      <button
                        onClick={(e) => openTextContextMenu(e, (v) => updateScene(selectedScene, { content: v }), { onCreateNote: createNoteFromText, taOverride: contentTextareaRef.current })}
                        disabled={readMode || visualMode}
                        className="w-full flex items-center gap-2 px-2 py-1.5 mb-2 rounded font-mono text-xs text-left disabled:opacity-30"
                        style={{ backgroundColor: colors.deskLight, color: colors.mutedLight }}
                      >
                        <Bold size={12} /> formatar seleção…
                      </button>

                      <button onClick={linkSelectionToGlossary} disabled={readMode || visualMode} className="w-full flex items-center gap-2 px-2 py-1.5 rounded font-mono text-xs text-left disabled:opacity-30" style={{ backgroundColor: colors.deskLight, color: colors.mutedLight }}>
                        <Link2 size={12} /> vincular seleção ao glossário
                      </button>
                    </CollapsibleSection>

                    <CollapsibleSection title="versões salvas" open={cenaSections.versoes} onToggle={() => toggleCenaSection("versoes")} colors={colors} count={(currentScene.versions || []).length}>
                      <button onClick={saveVersion} className="w-full flex items-center justify-center gap-1 font-mono text-[11px] px-2 py-1.5 mb-2 rounded" style={{ backgroundColor: colors.deskLight, color: colors.mutedLight }}>
                        <Save size={11} /> salvar versão atual
                      </button>
                      {(currentScene.versions || []).length === 0 ? (
                        <p className="font-mono text-[10px]" style={{ color: colors.muted }}>nenhuma versão salva ainda</p>
                      ) : (
                        <div className="space-y-1 max-h-32 overflow-y-auto">
                          {currentScene.versions.map((v) => (
                            <div key={v.ts} className="flex items-center justify-between font-mono text-[10px] px-2 py-1 rounded" style={{ backgroundColor: colors.deskLight, color: colors.muted }}>
                              <span>{new Date(v.ts).toLocaleString("pt-BR")} · {wordCount(v.content)} palavras</span>
                              <button onClick={() => restoreVersion(v.content)} className="flex items-center gap-1" style={{ color: colors.wine }}><RotateCcw size={10} /> restaurar</button>
                            </div>
                          ))}
                        </div>
                      )}
                    </CollapsibleSection>
                  </div>
                ) : (
                  <p className="font-body text-sm" style={{ color: colors.muted }}>Selecione uma cena para ver e editar seus detalhes.</p>
                )
              )}

              {rightTab === "personagens" && (
                <div>
                  <div className="flex items-center gap-1 mb-3">
                    <TabPill active={charSubView === "lista"} onClick={() => setCharSubView("lista")} colors={colors} icon={List} label="lista" />
                    <TabPill active={charSubView === "rede"} onClick={() => setCharSubView("rede")} colors={colors} icon={Network} label="rede" />
                  </div>

                  {charSubView === "lista" ? (
                    <div>
                      <button onClick={addCharacter} className="w-full flex items-center justify-center gap-1.5 py-2 mb-3 rounded font-mono text-xs" style={{ backgroundColor: colors.deskLight, color: colors.mutedLight }}>
                        <Plus size={13} /> novo personagem
                      </button>
                      {project.characters.map((c) => (
                        <CharacterCard key={c.id} character={c} allCharacters={project.characters} colors={colors}
                          onUpdate={(patch) => updateCharacter(c.id, patch)} onDelete={() => deleteCharacter(c.id)}
                          onAddRel={(targetId, label) => addRelationship(c.id, targetId, label)} onRemoveRel={(idx) => removeRelationship(c.id, idx)} />
                      ))}
                    </div>
                  ) : (
                    <RelationshipWeb characters={project.characters} colors={colors} />
                  )}
                </div>
              )}

              {rightTab === "fios" && (
                <div>
                  <button onClick={addThread} className="w-full flex items-center justify-center gap-1.5 py-2 mb-3 rounded font-mono text-xs" style={{ backgroundColor: colors.deskLight, color: colors.mutedLight }}>
                    <Plus size={13} /> novo fio / subtrama
                  </button>
                  {(project.threads || []).length === 0 ? (
                    <p className="font-body text-sm" style={{ color: colors.muted }}>Crie fios para acompanhar subtramas ou POVs (ex: "Mistério Principal", "Romance B") ao longo dos capítulos.</p>
                  ) : (
                    <>
                      {project.threads.map((t) => (
                        <div key={t.id} className="flex items-center gap-2 mb-2 p-2 rounded" style={{ backgroundColor: colors.deskLight }}>
                          <input type="color" value={t.color} onChange={(e) => updateThread(t.id, { color: e.target.value })} className="w-6 h-6 rounded flex-shrink-0" style={{ backgroundColor: "transparent" }} />
                          <input className={`${inputBase} font-body text-sm flex-1`} style={{ color: colors.mutedLight }} value={t.name} onChange={(e) => updateThread(t.id, { name: e.target.value })} />
                          <button onClick={() => deleteThread(t.id)} style={{ color: colors.wine }}><Trash2 size={13} /></button>
                        </div>
                      ))}

                      {chapters.length === 0 ? (
                        <p className="font-mono text-[10px] mt-2" style={{ color: colors.muted }}>Crie capítulos e marque cenas com os fios para ver a grade.</p>
                      ) : (
                        <div className="overflow-x-auto mt-3">
                          <table className="font-mono text-[10px] w-full" style={{ color: colors.mutedLight }}>
                            <thead>
                              <tr>
                                <th className="text-left pr-2 pb-1"> </th>
                                {chapters.map((ch) => <th key={ch.id} className="px-1 pb-1 font-normal" style={{ writingMode: "vertical-rl" }}>{ch.title}</th>)}
                              </tr>
                            </thead>
                            <tbody>
                              {project.threads.map((t) => (
                                <tr key={t.id}>
                                  <td className="text-right pr-2 whitespace-nowrap">{t.name}</td>
                                  {chapters.map((ch) => {
                                    const present = ch.scenes.some((s) => (s.threadIds || []).includes(t.id));
                                    return <td key={ch.id} className="text-center px-1"><span className="inline-block w-2.5 h-2.5 rounded-full" style={{ backgroundColor: present ? t.color : colors.desk }} /></td>;
                                  })}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

              {rightTab === "notas" && (
                <div>
                  {workspace === "manuscrito" ? (
                    <>
                      <div className="flex gap-1 mb-2">
                        <button onClick={() => addNote("cena")} disabled={!selectedScene} className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded font-mono text-[10px] disabled:opacity-30" style={{ backgroundColor: colors.deskLight, color: colors.mutedLight }}>
                          <Plus size={11} /> da cena
                        </button>
                        <button onClick={() => addNote("capitulo")} disabled={!selectedScene} className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded font-mono text-[10px] disabled:opacity-30" style={{ backgroundColor: colors.deskLight, color: colors.mutedLight }}>
                          <Plus size={11} /> do capítulo
                        </button>
                        <button onClick={() => addNote("geral")} className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded font-mono text-[10px]" style={{ backgroundColor: colors.deskLight, color: colors.mutedLight }}>
                          <Plus size={11} /> geral
                        </button>
                      </div>

                      <div className="flex flex-wrap gap-2 mb-2 font-mono text-[10px]" style={{ color: colors.muted }}>
                        <span className="w-full mb-0.5" style={{ color: colors.muted }}>o que ver enquanto escrevo:</span>
                        {[["cena", "cena atual"], ["capitulo", "capítulo atual"], ["geral", "gerais"]].map(([k, label]) => (
                          <label key={k} className="flex items-center gap-1 cursor-pointer">
                            <input type="checkbox" checked={noteScopeFilter[k]} onChange={(e) => setNoteScopeFilter((f) => ({ ...f, [k]: e.target.checked }))} />
                            {label}
                          </label>
                        ))}
                      </div>
                    </>
                  ) : (
                    <button onClick={() => addNote("geral")} className="w-full flex items-center justify-center gap-1.5 py-2 mb-2 rounded font-mono text-xs" style={{ backgroundColor: colors.deskLight, color: colors.mutedLight }}>
                      <Plus size={13} /> nova nota
                    </button>
                  )}

                  <div className="flex flex-wrap gap-1 mb-3">
                    {["todas", ...NOTE_CATEGORIES].map((cat) => (
                      <button key={cat} onClick={() => setNoteFilter(cat)} className="chip font-mono" style={{ backgroundColor: noteFilter === cat ? colors.gold : colors.deskLight, color: noteFilter === cat ? colors.ink : colors.mutedLight }}>{cat}</button>
                    ))}
                  </div>

                  {(workspace === "manuscrito" ? visibleNotes : project.notes.filter((n) => (n.scope || "geral") === "geral" && (noteFilter === "todas" || n.category === noteFilter)))
                    .length === 0 && (
                    <p className="font-body text-sm" style={{ color: colors.muted }}>Nenhuma nota visível com esses filtros.</p>
                  )}

                  {(workspace === "manuscrito" ? visibleNotes : project.notes.filter((n) => (n.scope || "geral") === "geral" && (noteFilter === "todas" || n.category === noteFilter)))
                    .slice()
                    .sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0))
                    .map((n) => {
                      const { sceneTitle, chapterTitle } = findSceneAndChapterTitles(project, n.sceneId, n.chapterId);
                      const scopeLabel = n.scope === "cena" ? (sceneTitle ? `cena: ${sceneTitle}` : "cena") : n.scope === "capitulo" ? (chapterTitle ? `capítulo: ${chapterTitle}` : "capítulo") : "geral";
                      return (
                        <div key={n.id} className="mb-3 p-3 rounded" style={{ backgroundColor: colors.deskLight, border: n.pinned ? `1px solid ${colors.gold}` : "1px solid transparent" }}>
                          <div className="flex items-center justify-between mb-1 gap-2">
                            <button onClick={() => updateNote(n.id, { pinned: !n.pinned })} title="Fixar nota" style={{ color: n.pinned ? colors.gold : colors.muted }}><Pin size={13} /></button>
                            <input className={`${inputBase} font-display text-sm flex-1`} style={{ color: colors.paper }} value={n.title} onChange={(e) => updateNote(n.id, { title: e.target.value })} />
                            <select className="font-mono text-[10px] rounded px-1 py-0.5 outline-none" style={{ backgroundColor: colors.desk, color: colors.gold }} value={n.category} onChange={(e) => updateNote(n.id, { category: e.target.value })}>
                              {NOTE_CATEGORIES.map((cat) => <option key={cat} value={cat}>{cat}</option>)}
                            </select>
                            <button onClick={() => deleteNote(n.id)} style={{ color: colors.wine }}><Trash2 size={13} /></button>
                          </div>
                          {workspace === "manuscrito" && (
                            <span className="font-mono text-[9px] chip inline-block mb-2" style={{ backgroundColor: colors.desk, color: colors.muted }}>{scopeLabel}</span>
                          )}
                          <textarea
                            className={`${inputBase} font-body text-xs w-full resize-none mb-2`}
                            style={{ color: colors.mutedLight, minHeight: "60px" }}
                            value={n.content}
                            onChange={(e) => updateNote(n.id, { content: e.target.value })}
                            onKeyDown={(e) => handleEditorKeyDown(e, (v) => updateNote(n.id, { content: v }))}
                            onContextMenu={(e) => openTextContextMenu(e, (v) => updateNote(n.id, { content: v }))}
                            {...onLongPress((e) => openTextContextMenu(e, (v) => updateNote(n.id, { content: v })))}
                          />
                          <TagRow tags={n.tags || []} colors={colors} onAdd={(t) => addNoteTag(n.id, t)} onRemove={(t) => removeNoteTag(n.id, t)} />
                        </div>
                      );
                    })}
                </div>
              )}

              {rightTab === "glossario" && (
                <div>
                  <button onClick={addGlossary} className="w-full flex items-center justify-center gap-1.5 py-2 mb-3 rounded font-mono text-xs" style={{ backgroundColor: colors.deskLight, color: colors.mutedLight }}>
                    <Plus size={13} /> novo termo
                  </button>
                  {project.glossary.map((g) => (
                    <div key={g.id} className="mb-2 p-3 rounded" style={{ backgroundColor: colors.deskLight }}>
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <input className={`${inputBase} font-display text-sm flex-1`} placeholder="termo" style={{ color: colors.gold }} value={g.term} onChange={(e) => updateGlossary(g.id, { term: e.target.value })} />
                        <button onClick={() => deleteGlossary(g.id)} style={{ color: colors.wine }}><Trash2 size={13} /></button>
                      </div>
                      <textarea className={`${inputBase} font-body text-xs w-full resize-none`} placeholder="definição" style={{ color: colors.mutedLight, minHeight: "40px" }} value={g.definition} onChange={(e) => updateGlossary(g.id, { definition: e.target.value })} />
                    </div>
                  ))}
                </div>
              )}

              {rightTab === "visao" && (
                <div className="space-y-6">
                  <div>
                    <h4 className="font-mono text-[10px] uppercase tracking-wide mb-2" style={{ color: colors.muted }}>Arco narrativo (tensão)</h4>
                    {arcData.length < 2 ? (
                      <p className="font-body text-sm" style={{ color: colors.muted }}>Adicione ao menos duas cenas com nível de tensão.</p>
                    ) : (
                      <div style={{ height: 200 }}>
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={arcData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                            <CartesianGrid stroke={colors.deskLight} vertical={false} />
                            <XAxis dataKey="label" tick={false} stroke={colors.muted} />
                            <YAxis domain={[0, 10]} stroke={colors.muted} tick={{ fill: colors.muted, fontSize: 10 }} />
                            <Tooltip contentStyle={{ backgroundColor: colors.paper, border: "none", fontFamily: "Lora, serif", fontSize: 12 }} />
                            {arcData.map((d, i) => d.isActStart && i > 0 && <ReferenceLine key={d.key} x={d.label} stroke={colors.deskLight} strokeDasharray="3 3" />)}
                            <Line type="monotone" dataKey="tension" stroke={colors.gold} strokeWidth={2.5} dot={{ r: 3, fill: colors.gold }} />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    )}
                  </div>

                  <div>
                    <h4 className="font-mono text-[10px] uppercase tracking-wide mb-2" style={{ color: colors.muted }}>Progresso de palavras</h4>
                    {hist.length < 2 ? (
                      <p className="font-body text-sm" style={{ color: colors.muted }}>Escreva em mais de um dia para ver o histórico.</p>
                    ) : (
                      <div style={{ height: 160 }}>
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={hist} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                            <CartesianGrid stroke={colors.deskLight} vertical={false} />
                            <XAxis dataKey="date" tick={{ fill: colors.muted, fontSize: 9 }} />
                            <YAxis stroke={colors.muted} tick={{ fill: colors.muted, fontSize: 10 }} />
                            <Tooltip contentStyle={{ backgroundColor: colors.paper, border: "none", fontFamily: "Lora, serif", fontSize: 12 }} />
                            <Bar dataKey="words" fill={colors.teal} radius={[3, 3, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    )}
                  </div>

                  <div>
                    <h4 className="font-mono text-[10px] uppercase tracking-wide mb-2" style={{ color: colors.muted }}>Presença de personagens por capítulo</h4>
                    {project.characters.length === 0 || chapters.length === 0 ? (
                      <p className="font-body text-sm" style={{ color: colors.muted }}>Adicione personagens e vincule-os às cenas para ver o mapa.</p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="font-mono text-[10px] w-full" style={{ color: colors.mutedLight }}>
                          <thead>
                            <tr>
                              <th className="text-left pr-2 pb-1"> </th>
                              {chapters.map((ch) => <th key={ch.id} className="px-1 pb-1 font-normal" style={{ writingMode: "vertical-rl", maxHeight: 60 }}>{ch.title}</th>)}
                            </tr>
                          </thead>
                          <tbody>
                            {project.characters.map((c) => (
                              <tr key={c.id}>
                                <td className="text-right pr-2 whitespace-nowrap">{c.name}</td>
                                {chapters.map((ch) => {
                                  const present = ch.scenes.some((s) => (s.characterIds || []).includes(c.id));
                                  return <td key={ch.id} className="text-center px-1"><span className="inline-block w-2.5 h-2.5 rounded-full" style={{ backgroundColor: present ? colors.gold : colors.deskLight }} /></td>;
                                })}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Mobile bottom nav — switches which single panel is visible on small screens */}
      {!focusMode && (
        <div className={isMobileLayout ? "flex border-t" : "hidden"} style={{ borderColor: colors.deskLight, backgroundColor: colors.desk }}>
          {[
            { key: "estrutura", icon: List, label: workspace === "diario" ? "Diários" : "Estrutura" },
            { key: "escrita", icon: Feather, label: "Escrita" },
            { key: "detalhes", icon: SlidersHorizontal, label: "Detalhes" },
          ].map((t) => (
            <button
              key={t.key}
              onClick={() => setMobilePanel(t.key)}
              className="flex-1 flex flex-col items-center gap-1 py-2.5 font-mono text-[10px] uppercase tracking-wide"
              style={{ color: mobilePanel === t.key ? colors.gold : colors.muted, borderTop: mobilePanel === t.key ? `2px solid ${colors.gold}` : "2px solid transparent" }}
            >
              <t.icon size={16} />{t.label}
            </button>
          ))}
        </div>
      )}

      {/* Everything below (modals, menus, toast) renders outside the zoomed
          wrapper so their fixed-position coordinates always match the real
          click/touch position, regardless of the UI scale setting. */}
    </div>

      {/* Settings modal */}
      {settingsOpen && (
        <Modal onClose={() => setSettingsOpen(false)} colors={colors} title="Configurações">
          <Field label="Tema" colors={colors}>
            <div className="flex gap-2">
              <button onClick={() => updateStore((p) => ({ ...p, appSettings: { ...p.appSettings, theme: "night" } }))} className="flex items-center gap-1.5 px-3 py-1.5 rounded font-mono text-xs" style={{ backgroundColor: store.appSettings.theme === "night" ? colors.gold : colors.deskLight, color: store.appSettings.theme === "night" ? colors.ink : colors.mutedLight }}><Moon size={12} /> noite</button>
              <button onClick={() => updateStore((p) => ({ ...p, appSettings: { ...p.appSettings, theme: "day" } }))} className="flex items-center gap-1.5 px-3 py-1.5 rounded font-mono text-xs" style={{ backgroundColor: store.appSettings.theme === "day" ? colors.gold : colors.deskLight, color: store.appSettings.theme === "day" ? colors.ink : colors.mutedLight }}><Sun size={12} /> dia</button>
            </div>
          </Field>

          <Field label="Layout" colors={colors}>
            <div className="grid grid-cols-3 gap-1.5">
              {[
                { key: "auto", label: "Automático" },
                { key: "desktop", label: "Desktop" },
                { key: "mobile", label: "Celular" },
              ].map((opt) => (
                <button
                  key={opt.key}
                  onClick={() => updateStore((p) => ({ ...p, appSettings: { ...p.appSettings, layoutMode: opt.key } }))}
                  className="px-2 py-1.5 rounded font-mono text-xs"
                  style={{ backgroundColor: layoutMode === opt.key ? colors.gold : colors.deskLight, color: layoutMode === opt.key ? colors.ink : colors.mutedLight }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <p className="font-mono text-[10px] mt-1.5" style={{ color: colors.muted }}>Automático detecta pelo tamanho da tela e se o toque é a entrada principal — mas em tablets isso pode errar. Force manualmente se preferir.</p>
          </Field>

          <Field label="Tamanho da interface (ícones, botões, textos)" colors={colors}>
            <div className="grid grid-cols-2 gap-1.5">
              {UI_SCALE_OPTIONS.map((s) => (
                <button
                  key={s.key}
                  onClick={() => updateStore((p) => ({ ...p, appSettings: { ...p.appSettings, uiScale: s.value } }))}
                  className="px-3 py-1.5 rounded font-mono text-xs"
                  style={{ backgroundColor: uiScaleValue === s.value ? colors.gold : colors.deskLight, color: uiScaleValue === s.value ? colors.ink : colors.mutedLight }}
                >
                  {s.label}
                </button>
              ))}
            </div>
            <p className="font-mono text-[10px] mt-1.5" style={{ color: colors.muted }}>Útil no celular, onde alguns botões podem ficar pequenos para tocar.</p>
          </Field>

          <Field label={`Tamanho da fonte do editor (${fontSize}px)`} colors={colors}>
            <input type="range" min="12" max="28" value={fontSize} onChange={(e) => updateStore((p) => ({ ...p, appSettings: { ...p.appSettings, fontSize: Number(e.target.value) } }))} className="w-full" />
          </Field>

          <Field label="Fonte do editor" colors={colors}>
            <div className="flex flex-col gap-1.5">
              {FONT_OPTIONS.map((f) => (
                <button key={f.key} onClick={() => updateStore((p) => ({ ...p, appSettings: { ...p.appSettings, fontFamily: f.key } }))} className="px-3 py-1.5 rounded font-mono text-xs text-left" style={{ backgroundColor: (store.appSettings.fontFamily || "lora") === f.key ? colors.gold : colors.deskLight, color: (store.appSettings.fontFamily || "lora") === f.key ? colors.ink : colors.mutedLight, fontFamily: f.value }}>
                  {f.label}
                </button>
              ))}
            </div>
          </Field>

          <Field label="Meta diária de palavras" colors={colors}>
            <input type="number" className="px-2 py-1 rounded outline-none font-mono text-sm w-28" style={{ backgroundColor: colors.deskLight, color: colors.mutedLight }} value={project.dailyWordGoal} onChange={(e) => updateProject((p) => ({ ...p, dailyWordGoal: Number(e.target.value) || 0 }))} />
          </Field>

          <Field label="Modelos de estrutura" colors={colors}>
            <div className="flex flex-col gap-1.5">
              {Object.keys(TEMPLATES).map((k) => (
                <button key={k} onClick={() => applyTemplate(k)} className="flex items-center gap-1.5 px-3 py-1.5 rounded font-mono text-xs text-left" style={{ backgroundColor: colors.deskLight, color: colors.mutedLight }}>
                  <Sparkles size={12} style={{ color: colors.gold }} /> {k === "tres_atos" ? "3 Atos" : k === "jornada_heroi" ? "Jornada do Herói" : "Save the Cat — 15 Batidas"}
                </button>
              ))}
            </div>
          </Field>

          <Field label="Exportar" colors={colors}>
            <div className="flex flex-wrap gap-1.5">
              <button onClick={exportManuscriptMarkdown} className="flex items-center gap-1.5 px-3 py-1.5 rounded font-mono text-xs" style={{ backgroundColor: colors.deskLight, color: colors.mutedLight }}><Download size={12} /> manuscrito (.md)</button>
              <button onClick={exportBackup} className="flex items-center gap-1.5 px-3 py-1.5 rounded font-mono text-xs" style={{ backgroundColor: colors.deskLight, color: colors.mutedLight }}><Download size={12} /> backup (.json)</button>
              <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-1.5 px-3 py-1.5 rounded font-mono text-xs" style={{ backgroundColor: colors.deskLight, color: colors.mutedLight }}><Upload size={12} /> importar backup</button>
              <input ref={fileInputRef} type="file" accept="application/json" className="hidden" onChange={(e) => e.target.files[0] && importBackup(e.target.files[0])} />
            </div>
            <p className="font-mono text-[10px] mt-2" style={{ color: colors.muted }}>Para um arquivo Word (.docx) formatado do manuscrito finalizado, é só pedir separadamente.</p>
          </Field>
        </Modal>
      )}

      {/* Help modal (sintaxe e comandos) */}
      {helpOpen && (
        <Modal onClose={() => setHelpOpen(false)} colors={colors} title="Sintaxe e comandos">
          <div className="space-y-5">
            <div>
              <h4 className="font-mono text-[10px] uppercase tracking-wide mb-2" style={{ color: colors.gold }}>Formatação (aparece no modo leitura)</h4>
              <div className="space-y-1.5">
                {[
                  ["**texto**", "negrito"],
                  ["*texto*", "itálico"],
                  ["***texto***", "negrito + itálico"],
                  ["~~texto~~", "riscado"],
                  ["==texto==", "destacado"],
                  ["{{c:vermelho}}texto{{/c}}", "cor do texto (vermelho, verde, azul, roxo, dourado)"],
                  ["# / ## / ###", "título, no início da linha"],
                  ["> texto", "citação"],
                  ["— texto", "fala de personagem"],
                  ["* * *", "quebra de cena, sozinho na linha"],
                  ["%%texto%%", "comentário do autor — some no modo leitura, não conta palavras"],
                ].map(([syn, desc]) => (
                  <div key={syn} className="flex items-center gap-2 font-mono text-[10px]">
                    <span className="px-1.5 py-0.5 rounded flex-shrink-0" style={{ backgroundColor: colors.deskLight, color: colors.gold }}>{syn}</span>
                    <span style={{ color: colors.mutedLight }}>{desc}</span>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h4 className="font-mono text-[10px] uppercase tracking-wide mb-2" style={{ color: colors.gold }}>Atalhos de teclado</h4>
              <div className="space-y-1.5">
                {[
                  ["Ctrl/Cmd + B", "negrito"],
                  ["Ctrl/Cmd + I", "itálico"],
                  ["Ctrl/Cmd + Shift + X", "riscado"],
                  ["Ctrl/Cmd + Shift + H", "destacar"],
                  ["Ctrl/Cmd + Shift + L", "cor do texto"],
                  ["Ctrl/Cmd + K", "vincular seleção ao glossário"],
                  ["{{c: + começo do nome da cor", "autocompletar sugere a cor"],
                ].map(([syn, desc]) => (
                  <div key={syn} className="flex items-center gap-2 font-mono text-[10px]">
                    <span className="px-1.5 py-0.5 rounded flex-shrink-0" style={{ backgroundColor: colors.deskLight, color: colors.gold }}>{syn}</span>
                    <span style={{ color: colors.mutedLight }}>{desc}</span>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h4 className="font-mono text-[10px] uppercase tracking-wide mb-2" style={{ color: colors.gold }}>Botão direito no texto</h4>
              <p className="font-body text-sm" style={{ color: colors.mutedLight }}>
                Selecione um trecho e clique com o botão direito para: negrito, itálico, negrito+itálico, riscado, destacar, cor do texto, título, citação, copiar, recortar, vincular ao glossário, comentário do autor, ou criar uma nota a partir da seleção.
              </p>
            </div>

            <div>
              <h4 className="font-mono text-[10px] uppercase tracking-wide mb-2" style={{ color: colors.gold }}>Ferramentas da cena</h4>
              <p className="font-body text-sm" style={{ color: colors.mutedLight }}>
                Na aba "Cena", em "ferramentas de escrita": inserir diálogo, inserir quebra de cena, aplicar estilo de parágrafo, alternar modo leitura, ajustar fonte, e vincular a seleção ao glossário.
              </p>
            </div>

            <div>
              <h4 className="font-mono text-[10px] uppercase tracking-wide mb-2" style={{ color: colors.gold }}>Organização da estrutura</h4>
              <p className="font-body text-sm" style={{ color: colors.mutedLight }}>
                Clique simples em atos, capítulos ou diários abre/fecha; clique em cenas seleciona. Botão direito em qualquer um deles: renomear, mover para cima/baixo, mover para outro capítulo ou ato, e excluir.
              </p>
            </div>
          </div>
        </Modal>
      )}

      {/* Color autocomplete (estilo VS Code — aparece ao digitar "{{c:") */}
      {colorAutocomplete && (
        <div
          className="fixed z-50 rounded shadow-2xl p-1 flex gap-1"
          style={{ top: colorAutocomplete.y, left: colorAutocomplete.x, backgroundColor: colors.panel, border: `1px solid ${colors.deskLight}` }}
        >
          {colorAutocomplete.options.map((c) => (
            <button
              key={c.key}
              onMouseDown={(e) => { e.preventDefault(); applyColorAutocomplete(c.key); }}
              title={c.label}
              className="flex items-center gap-1 px-2 py-1 rounded font-mono text-[10px]"
              style={{ backgroundColor: colors.deskLight, color: colors.mutedLight }}
            >
              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: c.value }} />
              {c.key}
            </button>
          ))}
        </div>
      )}

      {/* Color picker (cor do texto selecionado) */}
      {colorPicker && (
        <Modal onClose={() => setColorPicker(null)} colors={colors} title="Cor do texto">
          <p className="font-body text-sm mb-3" style={{ color: colors.mutedLight }}>Vale só no modo leitura — a caixa de escrita continua em texto puro.</p>
          <div className="grid grid-cols-3 gap-2">
            {TEXT_COLORS.map((c) => (
              <button
                key={c.key}
                onClick={() => {
                  toggleWrapSelectionInTextarea(colorPicker.taEl, `{{c:${c.key}}}`, "{{/c}}", colorPicker.onChange);
                  setColorPicker(null);
                  showToast(`Cor aplicada: ${c.label}`);
                }}
                className="flex flex-col items-center gap-1.5 p-3 rounded"
                style={{ backgroundColor: colors.deskLight }}
              >
                <span className="w-6 h-6 rounded-full" style={{ backgroundColor: c.value }} />
                <span className="font-mono text-[10px]" style={{ color: colors.mutedLight }}>{c.label}</span>
              </button>
            ))}
          </div>
        </Modal>
      )}

      {/* Move picker (mover cena/capítulo para outro pai) */}
      {movePicker && (
        <Modal onClose={() => setMovePicker(null)} colors={colors} title={movePicker.title}>
          <div className="space-y-1 max-h-80 overflow-y-auto">
            {movePicker.options.length === 0 && <p className="font-body text-sm" style={{ color: colors.muted }}>Nenhum outro destino disponível.</p>}
            {movePicker.options.map((o, i) => (
              <button
                key={i}
                disabled={o.disabled}
                onClick={() => { o.onClick(); setMovePicker(null); }}
                className="w-full text-left px-3 py-2 rounded font-body text-sm disabled:opacity-30"
                style={{ backgroundColor: colors.deskLight, color: colors.mutedLight }}
              >
                {o.label}
              </button>
            ))}
          </div>
        </Modal>
      )}

      {/* Tree context menu (rename/delete for acts, chapters, diaries, scenes) */}
      {treeContextMenu && (
        <ContextMenu
          x={treeContextMenu.x}
          y={treeContextMenu.y}
          colors={colors}
          onClose={() => setTreeContextMenu(null)}
          items={treeContextMenu.items}
        />
      )}

      {/* Context menu (right-click) */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          colors={colors}
          onClose={() => setContextMenu(null)}
          items={[
            { label: "Negrito", icon: Bold, disabled: !contextMenu.hasSelection, action: () => { toggleWrapSelectionInTextarea(contextMenu.taEl, "**", "**", contextMenu.onChange); showToast("Negrito"); } },
            { label: "Itálico", icon: Italic, disabled: !contextMenu.hasSelection, action: () => { toggleWrapSelectionInTextarea(contextMenu.taEl, "*", "*", contextMenu.onChange); showToast("Itálico"); } },
            { label: "Negrito + itálico", icon: Bold, disabled: !contextMenu.hasSelection, action: () => { toggleWrapSelectionInTextarea(contextMenu.taEl, "***", "***", contextMenu.onChange); showToast("Negrito + itálico"); } },
            { label: "Riscado", icon: Strikethrough, disabled: !contextMenu.hasSelection, action: () => { toggleWrapSelectionInTextarea(contextMenu.taEl, "~~", "~~", contextMenu.onChange); showToast("Riscado"); } },
            { label: "Destacar", icon: Highlighter, disabled: !contextMenu.hasSelection, action: () => { toggleWrapSelectionInTextarea(contextMenu.taEl, "==", "==", contextMenu.onChange); showToast("Destaque"); } },
            { label: "Cor do texto…", icon: Palette, disabled: !contextMenu.hasSelection, action: () => setColorPicker({ taEl: contextMenu.taEl, onChange: contextMenu.onChange }) },
            { divider: true },
            { label: "Título", icon: Type, action: () => { const ok = applyParagraphStyle(contextMenu.taEl, "h2", contextMenu.onChange); showToast(ok ? "Título aplicado — visível no modo leitura" : "Adicione um Título grande antes deste"); } },
            { label: "Citação", icon: Quote, action: () => { applyParagraphStyle(contextMenu.taEl, "quote", contextMenu.onChange); showToast("Citação aplicada — visível no modo leitura"); } },
            { divider: true },
            { label: "Copiar", icon: Copy, disabled: !contextMenu.hasSelection, action: () => document.execCommand("copy") },
            { label: "Recortar", icon: Scissors, disabled: !contextMenu.hasSelection, action: () => document.execCommand("cut") },
            { divider: true },
            { label: "Vincular ao glossário", icon: Link2, disabled: !contextMenu.hasSelection, action: () => linkTextToGlossary(contextMenu.selectedText) },
            { label: "Comentário do autor", icon: MessageSquarePlus, action: () => { wrapSelectionInTextarea(contextMenu.taEl, "%%", "%%", contextMenu.onChange); showToast("Comentário inserido — some no modo leitura e não conta palavras"); } },
            ...(contextMenu.onCreateNote ? [{ label: "Criar nota da seleção", icon: StickyNote, disabled: !contextMenu.hasSelection, action: () => contextMenu.onCreateNote(contextMenu.selectedText) }] : []),
          ]}
        />
      )}

      {/* Glossary term popover */}
      {glossaryPopover && (
        <Modal onClose={() => setGlossaryPopover(null)} colors={colors} title={glossaryPopover.term}>
          <p className="font-body text-sm mb-3" style={{ color: colors.mutedLight }}>{glossaryPopover.definition || "Sem definição ainda."}</p>
          <button onClick={() => { setRightTab("glossario"); setGlossaryPopover(null); }} className="font-mono text-xs px-3 py-1.5 rounded" style={{ backgroundColor: colors.deskLight, color: colors.mutedLight }}>
            editar no glossário
          </button>
        </Modal>
      )}

      {/* Search overlay */}
      {searchOpen && (
        <Modal onClose={() => setSearchOpen(false)} colors={colors} title={workspace === "diario" ? "Buscar no diário" : "Buscar no manuscrito"}>
          <input autoFocus className={`${inputBase} font-body text-sm w-full px-3 py-2 rounded mb-3`} style={{ backgroundColor: colors.deskLight, color: colors.mutedLight }} placeholder={workspace === "diario" ? "Digite para buscar em entradas e notas…" : "Digite para buscar em cenas e notas…"} value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
          <div className="space-y-1 max-h-80 overflow-y-auto">
            {searchResults.map((r, i) => (
              <button key={i} onClick={() => {
                if (r.kind === "scene") { setSelectedScene({ actId: r.actId, chapterId: r.chapterId, sceneId: r.sceneId }); }
                else if (r.kind === "entry") { setSelectedEntry({ diaryId: r.diaryId, entryId: r.entryId }); }
                else { setRightTab("notas"); }
                setSearchOpen(false); setSearchQuery("");
              }} className="w-full text-left flex items-center gap-2 px-3 py-2 rounded font-body text-sm" style={{ backgroundColor: colors.deskLight, color: colors.mutedLight }}>
                <span className="font-mono text-[9px] chip" style={{ backgroundColor: colors.desk, color: colors.gold }}>{r.kind === "scene" ? "cena" : r.kind === "entry" ? "entrada" : "nota"}</span>
                {r.label}
              </button>
            ))}
            {searchQuery && searchResults.length === 0 && <p className="font-body text-sm" style={{ color: colors.muted }}>Nada encontrado.</p>}
          </div>
        </Modal>
      )}

      {/* Toast feedback */}
      {toast && (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-full font-mono text-xs shadow-2xl" style={{ backgroundColor: colors.gold, color: colors.ink }}>
          {toast}
        </div>
      )}
    </div>
  );
}

function CollapsibleSection({ title, open, onToggle, colors, count, children }) {
  return (
    <div className="mb-4">
      <button onClick={onToggle} className="w-full flex items-center justify-between font-mono text-[10px] uppercase tracking-wide mb-1.5" style={{ color: colors.muted }}>
        <span className="flex items-center gap-1.5">
          {title}
          {typeof count === "number" && count > 0 && (
            <span className="chip" style={{ backgroundColor: colors.deskLight, color: colors.mutedLight }}>{count}</span>
          )}
        </span>
        {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
      </button>
      {open && children}
    </div>
  );
}

function TreeLabel({ id, value, onChange, renamingId, setRenamingId, className, style, placeholder }) {
  if (renamingId === id) {
    return (
      <input
        autoFocus
        className={`${className} bg-transparent outline-none`}
        style={style}
        value={value}
        placeholder={placeholder}
        onClick={(e) => e.stopPropagation()}
        onChange={(e) => onChange(e.target.value)}
        onBlur={() => setRenamingId(null)}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === "Escape") e.currentTarget.blur(); }}
      />
    );
  }
  return (
    <span className={`${className} truncate`} style={style}>
      {value || placeholder}
    </span>
  );
}

// Editor visual: cada parágrafo aparece já formatado (negrito, título, cor...);
// clicar nele revela a marcação crua numa textarea nativa de verdade — o que
// mantém cursor, seleção, desfazer e teclado mobile funcionando normalmente,
// sem precisar reimplementar nada disso à mão. Clicar fora recolhe de novo.
// Decoração de sintaxe ao estilo Obsidian: fora da linha onde está o cursor,
// os símbolos (**, ##, {{c:...}}) somem e o texto aparece formatado de
// verdade (negrito, título grande, cor). Na linha onde o cursor está, os
// símbolos ficam visíveis (só um pouco apagados), pra você poder editá-los.
const MD_COLOR_MAP = { vermelho: "#B23B3B", verde: "#3F5D54", azul: "#4A6FA5", roxo: "#7A5C9E", dourado: "#B08B3D" };
const MD_INLINE_REGEX = /\*\*\*([^*]+)\*\*\*|\*\*([^*]+)\*\*|\*([^*]+)\*|~~([^~]+)~~|==([^=]+)==|\{\{c:(vermelho|verde|azul|roxo|dourado)\}\}([^{]*)\{\{\/c\}\}/g;

function computeMarkdownDecorations(view) {
  const builder = new RangeSetBuilder();
  const cursorLine = view.state.doc.lineAt(view.state.selection.main.head).number;

  for (const { from, to } of view.visibleRanges) {
    let pos = from;
    while (pos <= to) {
      const line = view.state.doc.lineAt(pos);
      const text = line.text;
      const active = line.number === cursorLine;
      let contentStart = 0;

      const prefixMatch = text.match(/^(#{1,3}|>) /);
      if (prefixMatch) {
        const lineClass =
          prefixMatch[1] === ">" ? "cm-md-quote-line" :
          prefixMatch[1].length === 1 ? "cm-md-h1-line" :
          prefixMatch[1].length === 2 ? "cm-md-h2-line" : "cm-md-h3-line";
        builder.add(line.from, line.from, Decoration.line({ class: lineClass }));

        const markerEnd = line.from + prefixMatch[0].length;
        builder.add(line.from, markerEnd, active ? Decoration.mark({ class: "cm-md-marker" }) : Decoration.replace({}));
        contentStart = prefixMatch[0].length;
      }

      MD_INLINE_REGEX.lastIndex = contentStart;
      let m;
      while ((m = MD_INLINE_REGEX.exec(text)) !== null) {
        const mStart = line.from + m.index;
        const mEnd = mStart + m[0].length;
        if (m[6] !== undefined) {
          const openLen = `{{c:${m[6]}}}`.length, closeLen = 6;
          builder.add(mStart, mStart + openLen, active ? Decoration.mark({ class: "cm-md-marker" }) : Decoration.replace({}));
          builder.add(mStart + openLen, mEnd - closeLen, Decoration.mark({ attributes: { style: `color:${MD_COLOR_MAP[m[6]]}` } }));
          builder.add(mEnd - closeLen, mEnd, active ? Decoration.mark({ class: "cm-md-marker" }) : Decoration.replace({}));
          continue;
        }
        let markerLen, cls;
        if (m[1] !== undefined) { markerLen = 3; cls = "cm-md-boldital"; }
        else if (m[2] !== undefined) { markerLen = 2; cls = "cm-md-bold"; }
        else if (m[3] !== undefined) { markerLen = 1; cls = "cm-md-ital"; }
        else if (m[4] !== undefined) { markerLen = 2; cls = "cm-md-strike"; }
        else { markerLen = 2; cls = "cm-md-highlight"; }
        builder.add(mStart, mStart + markerLen, active ? Decoration.mark({ class: "cm-md-marker" }) : Decoration.replace({}));
        builder.add(mStart + markerLen, mEnd - markerLen, Decoration.mark({ class: cls }));
        builder.add(mEnd - markerLen, mEnd, active ? Decoration.mark({ class: "cm-md-marker" }) : Decoration.replace({}));
      }

      pos = line.to + 1;
    }
  }
  return builder.finish();
}

const markdownDecorationPlugin = ViewPlugin.fromClass(
  class {
    constructor(view) {
      this.decorations = computeMarkdownDecorations(view);
    }
    update(update) {
      if (update.docChanged || update.selectionSet || update.viewportChanged) {
        this.decorations = computeMarkdownDecorations(update.view);
      }
    }
  },
  { decorations: (v) => v.decorations }
);

const markdownSyntaxTheme = EditorView.theme({
  ".cm-md-marker": { opacity: "0.45" },
  ".cm-md-bold": { fontWeight: "700" },
  ".cm-md-ital": { fontStyle: "italic" },
  ".cm-md-boldital": { fontWeight: "700", fontStyle: "italic" },
  ".cm-md-strike": { textDecoration: "line-through", opacity: "0.6" },
  ".cm-md-highlight": { backgroundColor: "rgba(176,139,61,.35)" },
  ".cm-md-h1-line": { fontSize: "1.5em", fontWeight: "700" },
  ".cm-md-h2-line": { fontSize: "1.25em", fontWeight: "700" },
  ".cm-md-h3-line": { fontSize: "1.1em", fontWeight: "600" },
  ".cm-md-quote-line": { fontStyle: "italic", opacity: "0.9", borderLeft: "3px solid currentColor", paddingLeft: "0.6em" },
});

// Editor baseado em CodeMirror 6 — o mesmo motor de edição por trás do
// Obsidian e do VS Code. Integração própria e enxuta com o React (em vez de
// um pacote "de conveniência" de terceiros), pra não depender de versões
// externas que podem não bater entre si.
const cmBaseExtensions = [
  EditorView.lineWrapping,
  history(),
  keymap.of([...defaultKeymap, ...historyKeymap]),
  markdownDecorationPlugin,
  markdownSyntaxTheme,
];

function CodeMirrorSceneEditor({ content, onChange, colors, fontSize, fontFamily }) {
  const containerRef = useRef(null);
  const viewRef = useRef(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    if (!containerRef.current) return;
    const theme = EditorView.theme({
      "&": { fontSize: `${fontSize}px`, backgroundColor: "transparent", height: "100%", minHeight: "50vh" },
      ".cm-content": { fontFamily, color: colors.ink, padding: 0, caretColor: colors.ink, minHeight: "50vh" },
      ".cm-line": { padding: 0, lineHeight: 1.7 },
      "&.cm-focused": { outline: "none" },
      ".cm-scroller": { fontFamily, overflow: "visible" },
      ".cm-gutters": { display: "none" },
    });
    const state = EditorState.create({
      doc: content,
      extensions: [
        ...cmBaseExtensions,
        theme,
        EditorView.updateListener.of((update) => {
          if (update.docChanged) onChangeRef.current(update.state.doc.toString());
        }),
      ],
    });
    const view = new EditorView({ state, parent: containerRef.current });
    viewRef.current = view;
    return () => { view.destroy(); viewRef.current = null; };
    // Recria o editor só quando a aparência muda (fonte/tema) — o texto em
    // si é sincronizado à parte, no efeito abaixo, sem recriar o editor a
    // cada letra digitada.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fontSize, fontFamily, colors]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const current = view.state.doc.toString();
    if (current !== content) {
      view.dispatch({ changes: { from: 0, to: current.length, insert: content || "" } });
    }
  }, [content]);

  return <div ref={containerRef} className="w-full break-words" style={{ minHeight: "50vh" }} />;
}

function VisualMarkdownEditor({ content, onChange, glossary, onTermClick, colors, fontSize, fontFamily }) {
  const [editingIndex, setEditingIndex] = useState(null);
  const [draft, setDraft] = useState("");
  const taRef = useRef(null);
  const lines = (content || "").split("\n");

  useEffect(() => {
    if (editingIndex === null || !taRef.current) return;
    const ta = taRef.current;
    ta.focus();
    const len = ta.value.length;
    ta.setSelectionRange(len, len);
    ta.style.height = "auto";
    ta.style.height = `${ta.scrollHeight}px`;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingIndex]);

  const startEditing = (i) => {
    setDraft(lines[i]);
    setEditingIndex(i);
  };

  const commit = (nextEditingIndex) => {
    if (editingIndex === null) return;
    const newLines = [...lines.slice(0, editingIndex), ...draft.split("\n"), ...lines.slice(editingIndex + 1)];
    onChange(newLines.join("\n"));
    if (typeof nextEditingIndex === "number") {
      setEditingIndex(nextEditingIndex);
      setDraft("");
    } else {
      setEditingIndex(null);
    }
  };

  return (
    <div>
      {lines.map((line, i) =>
        editingIndex === i ? (
          <textarea
            key={i}
            ref={taRef}
            className="w-full bg-transparent outline-none resize-none"
            style={{ color: colors.ink, fontFamily, fontSize: `${fontSize}px`, lineHeight: 1.7, border: `1px dashed ${colors.paperEdge}`, borderRadius: "4px", padding: "2px 6px", marginBottom: "0.4rem" }}
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value);
              e.target.style.height = "auto";
              e.target.style.height = `${e.target.scrollHeight}px`;
            }}
            onBlur={() => commit()}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                commit(editingIndex + 1);
              } else if (e.key === "Escape") {
                e.currentTarget.blur();
              }
            }}
          />
        ) : (
          <div key={i} onClick={() => startEditing(i)} style={{ cursor: "text", fontFamily, fontSize: `${fontSize}px`, color: colors.ink, lineHeight: 1.7 }}>
            {line === "" && lines.length === 1 ? (
              <p className="mb-3" style={{ color: colors.muted, textIndent: "1.5em" }}>Era uma vez…</p>
            ) : (
              renderMarkdownLine(line, i, glossary, onTermClick)
            )}
          </div>
        )
      )}
    </div>
  );
}

function TagRow({ tags, colors, onAdd, onRemove }) {
  const [value, setValue] = useState("");
  return (
    <div className="flex flex-wrap items-center gap-1">
      {tags.map((t) => (
        <span key={t} className="chip font-mono flex items-center gap-1" style={{ backgroundColor: colors.paperEdge, color: colors.muted }}>
          {t}
          <button onClick={() => onRemove(t)} style={{ color: colors.wine }}><X size={9} /></button>
        </span>
      ))}
      <input
        className="font-mono text-[10px] bg-transparent outline-none w-20"
        style={{ color: colors.muted }}
        placeholder="+ tag"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && value.trim()) { onAdd(value.trim()); setValue(""); }
        }}
      />
    </div>
  );
}

function IconBtn({ children, onClick, colors, active, title }) {
  return (
    <button onClick={onClick} title={title} className="p-2 md:p-1.5 rounded" style={{ backgroundColor: active ? colors.gold : colors.deskLight, color: active ? colors.ink : colors.mutedLight }}>
      {children}
    </button>
  );
}

function TabPill({ active, onClick, colors, icon: Icon, label }) {
  return (
    <button onClick={onClick} className="flex items-center gap-1 px-2 py-1 rounded font-mono text-[10px]" style={{ backgroundColor: active ? colors.gold : colors.deskLight, color: active ? colors.ink : colors.muted }}>
      <Icon size={11} />{label}
    </button>
  );
}

function Field({ label, children, colors }) {
  return (
    <div className="mb-4">
      <label className="block font-mono text-[11px] uppercase tracking-wide mb-1.5" style={{ color: colors.muted }}>{label}</label>
      {children}
    </div>
  );
}

function Modal({ onClose, title, colors, children }) {
  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center p-4" style={{ backgroundColor: "rgba(0,0,0,0.5)" }} onClick={onClose}>
      <div className="w-full max-w-md rounded-lg p-5 max-h-[85vh] overflow-y-auto" style={{ backgroundColor: colors.panel }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display text-lg" style={{ color: colors.mutedLight }}>{title}</h3>
          <button onClick={onClose} style={{ color: colors.muted }}><X size={16} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

function CharacterCard({ character: c, allCharacters, colors, onUpdate, onDelete, onAddRel, onRemoveRel }) {
  const [relTarget, setRelTarget] = useState("");
  const [relLabel, setRelLabel] = useState("");
  return (
    <div className="mb-3 p-3 rounded" style={{ backgroundColor: colors.deskLight }}>
      <div className="flex items-center justify-between mb-1">
        <input className={`${inputBase} font-display text-sm flex-1`} style={{ color: colors.paper }} value={c.name} onChange={(e) => onUpdate({ name: e.target.value })} />
        <button onClick={onDelete} style={{ color: colors.wine }}><Trash2 size={13} /></button>
      </div>
      <input className={`${inputBase} font-mono text-[11px] w-full mb-2`} style={{ color: colors.gold }} placeholder="papel na história" value={c.role} onChange={(e) => onUpdate({ role: e.target.value })} />
      <textarea className={`${inputBase} font-body text-xs w-full resize-none mb-2`} style={{ color: colors.mutedLight, minHeight: "40px" }} placeholder="descrição geral" value={c.description} onChange={(e) => onUpdate({ description: e.target.value })} />
      <div className="grid grid-cols-2 gap-2 mb-2">
        <textarea className={`${inputBase} font-body text-xs resize-none`} style={{ color: colors.mutedLight, minHeight: "32px" }} placeholder="aparência" value={c.appearance} onChange={(e) => onUpdate({ appearance: e.target.value })} />
        <textarea className={`${inputBase} font-body text-xs resize-none`} style={{ color: colors.mutedLight, minHeight: "32px" }} placeholder="motivação" value={c.motivation} onChange={(e) => onUpdate({ motivation: e.target.value })} />
        <textarea className={`${inputBase} font-body text-xs resize-none`} style={{ color: colors.mutedLight, minHeight: "32px" }} placeholder="conflito interno" value={c.conflictInternal} onChange={(e) => onUpdate({ conflictInternal: e.target.value })} />
        <textarea className={`${inputBase} font-body text-xs resize-none`} style={{ color: colors.mutedLight, minHeight: "32px" }} placeholder="conflito externo" value={c.conflictExternal} onChange={(e) => onUpdate({ conflictExternal: e.target.value })} />
      </div>
      <textarea className={`${inputBase} font-body text-xs w-full resize-none mb-2`} style={{ color: colors.mutedLight, minHeight: "32px" }} placeholder="arco de transformação" value={c.arc} onChange={(e) => onUpdate({ arc: e.target.value })} />

      <div className="pt-2 border-t" style={{ borderColor: colors.desk }}>
        <span className="font-mono text-[10px]" style={{ color: colors.muted }}>relacionamentos</span>
        {c.relationships.map((r, i) => {
          const target = allCharacters.find((a) => a.id === r.charId);
          return (
            <div key={i} className="flex items-center justify-between font-mono text-[10px] mt-1" style={{ color: colors.mutedLight }}>
              <span>{r.type} de {target ? target.name : "?"}</span>
              <button onClick={() => onRemoveRel(i)} style={{ color: colors.wine }}><X size={10} /></button>
            </div>
          );
        })}
        <div className="flex items-center gap-1 mt-2">
          <select className="font-mono text-[10px] rounded px-1 py-1 outline-none flex-1" style={{ backgroundColor: colors.desk, color: colors.mutedLight }} value={relTarget} onChange={(e) => setRelTarget(e.target.value)}>
            <option value="">personagem…</option>
            {allCharacters.filter((a) => a.id !== c.id).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
          <input className="font-mono text-[10px] rounded px-1.5 py-1 outline-none w-16" style={{ backgroundColor: colors.desk, color: colors.mutedLight }} placeholder="tipo" value={relLabel} onChange={(e) => setRelLabel(e.target.value)} />
          <button onClick={() => { onAddRel(relTarget, relLabel); setRelTarget(""); setRelLabel(""); }} style={{ color: colors.gold }}><Plus size={13} /></button>
        </div>
      </div>
    </div>
  );
}

function RelationshipWeb({ characters, colors }) {
  if (characters.length === 0) return <p className="font-body text-sm" style={{ color: colors.muted }}>Adicione personagens para ver o mapa.</p>;
  const size = 280, cx = size / 2, cy = size / 2, r = size / 2 - 40;
  const positions = characters.map((c, i) => {
    const angle = (i / characters.length) * 2 * Math.PI - Math.PI / 2;
    return { id: c.id, name: c.name, x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) };
  });
  const posById = Object.fromEntries(positions.map((p) => [p.id, p]));
  const edges = [];
  characters.forEach((c) => c.relationships.forEach((rel) => {
    if (posById[rel.charId]) edges.push({ a: posById[c.id], b: posById[rel.charId], type: rel.type });
  }));

  return (
    <div className="flex justify-center">
      <svg width={size} height={size}>
        {edges.map((e, i) => (
          <line key={i} x1={e.a.x} y1={e.a.y} x2={e.b.x} y2={e.b.y} stroke={colors.gold} strokeWidth="1" opacity="0.5" />
        ))}
        {positions.map((p) => (
          <g key={p.id}>
            <circle cx={p.x} cy={p.y} r="5" fill={colors.gold} />
            <text x={p.x} y={p.y - 10} textAnchor="middle" fontSize="10" fontFamily="Lora, serif" fill={colors.mutedLight}>{p.name}</text>
          </g>
        ))}
      </svg>
    </div>
  );
}

// ============================================================
// Simulador de window.storage para rodar fora do ambiente de artifacts —
// usa o localStorage de verdade do navegador, com a mesma assinatura
// (get/set/delete/list) que o app já espera.
// ============================================================
if (!window.storage) {
  const ns = (key, shared) => (shared ? "shared:" : "personal:") + key;
  window.storage = {
    async get(key, shared = false) {
      const raw = window.localStorage.getItem(ns(key, shared));
      return raw === null ? null : { key, value: raw, shared };
    },
    async set(key, value, shared = false) {
      window.localStorage.setItem(ns(key, shared), value);
      return { key, value, shared };
    },
    async delete(key, shared = false) {
      window.localStorage.removeItem(ns(key, shared));
      return { key, deleted: true, shared };
    },
    async list(prefix = "", shared = false) {
      const p = ns(prefix, shared);
      const keys = [];
      for (let i = 0; i < window.localStorage.length; i++) {
        const k = window.localStorage.key(i);
        if (k && k.startsWith(p)) keys.push(k.slice((shared ? "shared:" : "personal:").length));
      }
      return { keys, prefix, shared };
    },
  };
}

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<StoryEditor />);
