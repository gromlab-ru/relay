export { useProduct } from "./hooks/use-product.hook";
export { getProduct, saveProduct, productError } from "./adapters/product.adapter";
export type { ProductState, ProductLink, ProductInput, ProductCommand } from "./types/product.type";
export { PRODUCT_LINK_SCHEMA } from "./config/product.schema";
