import {
  ActionIcon,
  Button,
  createTheme,
  defaultVariantColorsResolver,
  Input,
  Modal,
  Progress,
  Select,
  Textarea,
  TextInput,
  Tooltip,
} from "@mantine/core";
import type { CSSVariablesResolver } from "@mantine/core";

/**
 * Согласует поверхности Mantine с графитовой палитрой и контрастом нейтральных действий.
 */
export const themeVariables: CSSVariablesResolver = () => ({
  variables: {
    "--mantine-color-dimmed": "var(--tasks-muted)",
    "--mantine-color-text": "var(--tasks-ink)",
    "--mantine-color-body": "var(--tasks-surface)",
    "--mantine-color-default": "var(--tasks-surface)",
    "--mantine-color-default-hover": "var(--tasks-subtle)",
    "--mantine-color-default-color": "var(--tasks-ink)",
    "--mantine-color-default-border": "var(--tasks-border)",
    "--mantine-color-anchor": "var(--tasks-ink)",
    "--mantine-color-placeholder": "var(--tasks-soft)",
  },
  light: {
    "--mantine-primary-color-contrast": "var(--mantine-color-white)",
    "--mantine-color-gray-filled": "var(--mantine-color-gray-8)",
    "--mantine-color-gray-filled-hover": "var(--mantine-color-gray-9)",
    "--mantine-color-gray-text": "var(--mantine-color-gray-8)",
    "--mantine-color-gray-light-color": "var(--mantine-color-gray-8)",
  },
  dark: {
    "--mantine-primary-color-contrast": "var(--mantine-color-gray-9)",
    "--mantine-color-gray-filled": "var(--mantine-color-gray-2)",
    "--mantine-color-gray-text": "var(--mantine-color-gray-1)",
    "--mantine-color-gray-light-color": "var(--mantine-color-gray-1)",
    "--mantine-color-gray-filled-hover": "var(--mantine-color-gray-1)",
  },
});

/** Спокойная, компактная тема для длительной работы с текстом. */
export const theme = createTheme({
  primaryColor: "gray",
  primaryShade: 6,
  autoContrast: true,
  // Цвет текста заливки меняется вместе со схемой, а не вычисляется один раз по светлой палитре.
  variantColorResolver: (input) => {
    const colors = defaultVariantColorsResolver(input);
    if (input.color === "gray" && input.variant === "filled") {
      return { ...colors, color: "var(--mantine-primary-color-contrast)" };
    }
    return colors;
  },
  defaultRadius: "md",
  fontFamily: "Inter Variable, Inter, system-ui, sans-serif",
  fontFamilyMonospace: "ui-monospace, SFMono-Regular, Consolas, monospace",
  headings: { fontFamily: "Inter Variable, Inter, system-ui, sans-serif", fontWeight: "650" },
  fontSizes: { xs: "0.75rem", sm: "0.8125rem", md: "0.875rem", lg: "1rem", xl: "1.125rem" },
  radius: { xs: "0.25rem", sm: "0.375rem", md: "0.5rem", lg: "0.75rem", xl: "1rem" },
  colors: {
    gray: [
      "#f7f7f5",
      "#ededeb",
      "#deded9",
      "#c6c6c0",
      "#b3b3ac",
      "#96968f",
      "#6e6e68",
      "#53534f",
      "#343432",
      "#20201e",
    ],
    dark: [
      "#ededeb",
      "#d1d1cd",
      "#a3a3a0",
      "#858580",
      "#52524f",
      "#333333",
      "#292929",
      "#202020",
      "#1a1a1a",
      "#161616",
    ],
    teal: [
      "#f1f8f3",
      "#e4efe7",
      "#c9dfcf",
      "#aac6b4",
      "#8aaf98",
      "#709a80",
      "#547c62",
      "#42634f",
      "#34503f",
      "#293e32",
    ],
  },
  components: {
    Button: Button.extend({ defaultProps: { size: "sm", fw: 550 } }),
    ActionIcon: ActionIcon.extend({ defaultProps: { size: 32, variant: "subtle", color: "gray" } }),
    Input: Input.extend({ defaultProps: { size: "md" } }),
    TextInput: TextInput.extend({ defaultProps: { size: "md" } }),
    Textarea: Textarea.extend({ defaultProps: { size: "md" } }),
    Select: Select.extend({ defaultProps: { size: "md" } }),
    Progress: Progress.extend({ defaultProps: { color: "var(--tasks-muted)" } }),
    Tooltip: Tooltip.extend({ defaultProps: { withArrow: true, openDelay: 400 } }),
    Modal: Modal.extend({
      defaultProps: {
        centered: true,
        radius: "lg",
        overlayProps: { backgroundOpacity: 0.3, blur: 2 },
      },
    }),
  },
});
