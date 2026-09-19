export { useProduct, useProductContext } from "./hooks/use-product.hook";
export { getProductContextOptions } from "./helpers/context-options";
export { getProduct, saveProduct, productError } from "./adapters/product.adapter";
export type { ProductState, ProductLink, ProductInput, ProductCommand } from "./types/product.type";
export { PRODUCT_LINK_SCHEMA, APPLICATION_SLUG_SCHEMA } from "./config/product.schema";
