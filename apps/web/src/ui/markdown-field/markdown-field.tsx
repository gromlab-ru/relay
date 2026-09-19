import clsx from "clsx";
import { useEffect, useEffectEvent, useRef, useState, useId } from "react";
import { Text } from "@mantine/core";
import type { MarkdownFieldProps } from "./types/markdown-field-props.type";
import styles from "./styles/markdown-field.module.css";

/**
 * Редактирует исходный Markdown с подсветкой синтаксиса.
 *
 * Используется для:
 *  - редактирования описаний и сообщений без копирования состояния формы
 */
export const MarkdownField = (props: MarkdownFieldProps) => {
  const {
    label,
    defaultValue = "",
    onChange,
    onBlur,
    error,
    placeholder,
    disabled,
    minRows = 6,
    className,
    ...rootAttrs
  } = props;
  const input = useRef<HTMLDivElement>(null);
  const initialValue = useRef(defaultValue);
  const [failure, setFailure] = useState(false);
  const labelId = useId();
  const handleChange = useEffectEvent((value: string) => onChange?.(value));
  const handleBlur = useEffectEvent(() => onBlur?.());
  const handleDisabled = useEffectEvent(() => disabled === true);
  useEffect(() => {
    let disposed = false;
    let destroy: (() => void) | undefined;
    void Promise.all([
      import("@codemirror/view"),
      import("@codemirror/state"),
      import("@codemirror/lang-markdown"),
      import("@codemirror/language"),
      import("@codemirror/commands"),
      import("@lezer/highlight"),
    ])
      .then(([view, state, md, language, commands, highlight]) => {
        if (disposed || input.current === null) return;
        const editor = new view.EditorView({
          parent: input.current,
          state: state.EditorState.create({
            doc: initialValue.current,
            extensions: [
              md.markdown(),
              commands.history(),
              view.keymap.of([...commands.defaultKeymap, ...commands.historyKeymap]),
              view.EditorView.lineWrapping,
              view.EditorView.contentAttributes.of({
                "aria-labelledby": labelId,
                "aria-multiline": "true",
              }),
              state.EditorState.changeFilter.of(() => !handleDisabled()),
              view.EditorView.updateListener.of((update) => {
                if (update.docChanged) handleChange(update.state.doc.toString());
              }),
              view.EditorView.domEventHandlers({
                blur: () => {
                  handleBlur();
                },
              }),
              view.placeholder(placeholder ?? "Описание в Markdown…"),
              language.syntaxHighlighting(
                language.HighlightStyle.define([
                  {
                    tag: highlight.tags.heading,
                    color: "light-dark(var(--mantine-color-blue-8), var(--mantine-color-blue-3))",
                    fontWeight: "600",
                  },
                  { tag: highlight.tags.strong, fontWeight: "700" },
                  { tag: highlight.tags.emphasis, fontStyle: "italic" },
                  {
                    tag: [highlight.tags.link, highlight.tags.url],
                    color: "var(--mantine-color-teal-text)",
                  },
                  {
                    tag: [highlight.tags.monospace, highlight.tags.contentSeparator],
                    color: "var(--mantine-color-violet-text)",
                  },
                  {
                    tag: [highlight.tags.meta, highlight.tags.processingInstruction],
                    color: "var(--mantine-color-dimmed)",
                  },
                ]),
              ),
              view.EditorView.theme({
                "&": {
                  backgroundColor: "var(--mantine-color-body)",
                  color: "var(--mantine-color-text)",
                  fontSize: "14px",
                },
                ".cm-content": {
                  fontFamily: "var(--mantine-font-family-monospace)",
                  padding: "14px",
                  minHeight: `${minRows * 1.6}em`,
                  caretColor: "var(--mantine-color-text)",
                },
                ".cm-line": { padding: "0", lineHeight: "1.7" },
                ".cm-scroller": { maxHeight: "36dvh", overflow: "auto" },
                "&.cm-focused": { outline: "none" },
              }),
            ],
          }),
        });
        destroy = () => editor.destroy();
      })
      .catch(() => {
        if (!disposed) setFailure(true);
      });
    return () => {
      disposed = true;
      destroy?.();
    };
  }, [labelId, minRows, placeholder]);
  return (
    <div
      {...rootAttrs}
      className={clsx(styles.root, className)}
      onKeyDownCapture={(event) => {
        if (event.key === "Enter" && (event.ctrlKey || event.metaKey) && !disabled) {
          event.preventDefault();
          event.stopPropagation();
          event.currentTarget.closest("form")?.requestSubmit();
        }
      }}
    >
      <div id={labelId} className={styles.label}>
        {label}
      </div>
      <div ref={input} className={styles.editor} aria-disabled={disabled} />
      {failure && (
        <Text c="red" role="alert">
          Редактор не загрузился. Повторно откройте редактирование; черновик сохранён.
        </Text>
      )}
      <Text size="xs" c="red">
        {error}
      </Text>
      <span className={styles.hint}>Markdown · Ctrl/⌘ + Enter — сохранить</span>
    </div>
  );
};
