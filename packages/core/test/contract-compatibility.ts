import type { ProductState as CoreProductState } from "../src/domain/product.js";
import type { ProductState } from "@relay/contracts";
import type { Config } from "../src/domain/config.js";
import type { ProjectConfig } from "@relay/contracts";

type Assert<T extends true> = T;
type Assignable<Source, Target> = [Source] extends [Target] ? true : false;

/** Компиляция обнаруживает рассогласование общих DTO и реальных схем ядра. */
export type ConfigMatches = Assert<Assignable<Config, ProjectConfig>>;
export type ProductMatches = Assert<Assignable<CoreProductState, ProductState>>;
