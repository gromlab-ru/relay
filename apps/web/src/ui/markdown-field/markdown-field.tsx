import clsx from "clsx";
import { useRef, useState } from "react";
import { Tabs, Textarea } from "@mantine/core";
import { MarkdownView } from "ui/markdown-view";
import type { MarkdownFieldProps } from "./types/markdown-field-props.type";
import styles from "./styles/markdown-field.module.css";

/**
 * Сочетает неконтролируемый текстовый ввод с предпросмотром Markdown.
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
  const input = useRef<HTMLTextAreaElement>(null);
  const [preview, setPreview] = useState(defaultValue);
  return (
    <div {...rootAttrs} className={clsx(styles.root, className)}>
      <Tabs defaultValue="write" onChange={() => setPreview(input.current?.value ?? defaultValue)}>
        <div className={styles.heading}>
          <span className={styles.label}>{label}</span>
          <Tabs.List>
            <Tabs.Tab value="write">Текст</Tabs.Tab>
            <Tabs.Tab value="preview">Просмотр</Tabs.Tab>
          </Tabs.List>
        </div>
        <Tabs.Panel value="write">
          <Textarea
            ref={input}
            aria-label={label}
            defaultValue={defaultValue}
            onChange={(event) => onChange?.(event.currentTarget.value)}
            onBlur={onBlur}
            error={error}
            placeholder={placeholder}
            disabled={disabled}
            autosize
            minRows={minRows}
            maxRows={24}
          />
        </Tabs.Panel>
        <Tabs.Panel value="preview" className={styles.preview}>
          <MarkdownView text={preview} emptyText="Здесь появится предпросмотр вашего текста" />
        </Tabs.Panel>
      </Tabs>
      <span className={styles.hint}>Markdown: **жирный**, - список, `код`</span>
    </div>
  );
};
