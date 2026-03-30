export interface TagSet {
  phase: string[];
  domain: string[];
  language: string;
  layer: string;
  concerns: string[];
}

export interface CatalogCard {
  skill: string;
  plugin: string;
  source: string;
  tags: TagSet;
  composes: string[];
  enhances: string[];
  description: string;
  ironLaws: string[];
  body: string;
  filePath: string;
}

export interface BuildQuery {
  tags: Partial<Record<keyof TagSet, string | string[]>>;
}

export interface BuildConfig {
  name: string;
  version: string;
  description: string;
  author: { name: string };
  keywords: string[];
  queries: BuildQuery[];
  include: string[];
  exclude: string[];
  hooks?: string;
}

export interface VocabularyDimension {
  description: string;
  order?: string[];
  values: Record<string, string>;
}

export interface Vocabulary {
  dimensions: Record<string, VocabularyDimension>;
  relationships: Record<string, string>;
}

export interface ResolvedPath {
  filters: Record<string, string[]>;
  path: Array<{
    skill: string;
    layer: string;
    source: string;
    description: string;
    expanded: boolean;
  }>;
}
