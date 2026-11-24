// Pure stock arithmetic (docs/DATA_MODEL.md, StockMovement). No database.

export interface Level {
  onHand: number;
  reserved: number;
}

export interface Needed {
  productId: string;
  quantity: number;
}

export interface Shortfall {
  productId: string;
  needed: number;
  available: number;
}

// Available = on hand minus what open orders already reserve. Can be
// negative (an overridden assignment, or a delivery without stock).
export function available(level: Level | undefined): number {
  return (level?.onHand ?? 0) - (level?.reserved ?? 0);
}

// The items an agent cannot cover. Empty means the order can be assigned.
export function findShortfalls(
  levels: ReadonlyMap<string, Level>,
  needed: readonly Needed[],
): Shortfall[] {
  const totals = new Map<string, number>();
  for (const item of needed) {
    totals.set(
      item.productId,
      (totals.get(item.productId) ?? 0) + item.quantity,
    );
  }
  const result: Shortfall[] = [];
  for (const [productId, quantity] of totals) {
    const have = available(levels.get(productId));
    if (have < quantity) {
      result.push({ productId, needed: quantity, available: have });
    }
  }
  return result;
}
