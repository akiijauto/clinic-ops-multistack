/**
 * `data/price_items.json`, loaded once. The single place that knows the
 * relative path from this lane's compiled location to the repo's shared
 * `data/` directory (`src/lib` is two directories under `stacks/nextjs`, so
 * four `..` reach `clinic-ops-multistack/data` -- see `scripts/seed.ts` for
 * the same arithmetic one level shallower). Everything in 領域3 that needs
 * the price picker or a `price_code -> category_major` lookup (`sales.ts`,
 * the accounting screen) reads it from here rather than recomputing the path.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { moduleDir } from './paths.ts';

export type PriceItem = {
  price_code: string;
  name: string;
  unit_price: number | null;
  is_taxable: boolean;
  category_major: string;
  category: string;
};

let cache: PriceItem[] | undefined;

export function loadPriceItems(): PriceItem[] {
  if (!cache) {
    cache = JSON.parse(
      readFileSync(resolve(moduleDir(import.meta.dirname, import.meta.url), '../../../../data/price_items.json'), 'utf8'),
    ) as PriceItem[];
  }
  return cache;
}
