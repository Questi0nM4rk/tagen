export class ImmutableMap<Key, Value> implements ReadonlyMap<Key, Value> {
  readonly #values: Map<Key, Value>;

  constructor(entries?: Iterable<readonly [Key, Value]>) {
    this.#values = new Map(entries);
    Object.freeze(this);
  }

  get size(): number {
    return this.#values.size;
  }

  get(key: Key): Value | undefined {
    return this.#values.get(key);
  }

  has(key: Key): boolean {
    return this.#values.has(key);
  }

  entries(): MapIterator<[Key, Value]> {
    return this.#values.entries();
  }

  keys(): MapIterator<Key> {
    return this.#values.keys();
  }

  values(): MapIterator<Value> {
    return this.#values.values();
  }

  forEach(
    callbackfn: (value: Value, key: Key, map: ReadonlyMap<Key, Value>) => void,
    thisArg?: unknown
  ): void {
    for (const [key, value] of this.#values) {
      callbackfn.call(thisArg, value, key, this);
    }
  }

  [Symbol.iterator](): MapIterator<[Key, Value]> {
    return this.entries();
  }

  get [Symbol.toStringTag](): string {
    return "ImmutableMap";
  }
}

export class ImmutableSet<Value> implements ReadonlySet<Value> {
  readonly #values: Set<Value>;

  constructor(values?: Iterable<Value>) {
    this.#values = new Set(values);
    Object.freeze(this);
  }

  get size(): number {
    return this.#values.size;
  }

  has(value: Value): boolean {
    return this.#values.has(value);
  }

  union<Other>(other: ReadonlySetLike<Other>): Set<Value | Other> {
    const result = new Set<Value | Other>(this.#values);
    const values = other.keys();
    for (let next = values.next(); !next.done; next = values.next()) {
      result.add(next.value);
    }
    return result;
  }

  intersection<Other>(other: ReadonlySetLike<Other>): Set<Value & Other> {
    const result = new Set<Value & Other>();
    for (const value of this.#values) {
      if (other.has(value as Value & Other)) result.add(value as Value & Other);
    }
    return result;
  }

  difference<Other>(other: ReadonlySetLike<Other>): Set<Value> {
    const result = new Set<Value>();
    for (const value of this.#values) {
      if (!other.has(value as Value & Other)) result.add(value);
    }
    return result;
  }

  symmetricDifference<Other>(other: ReadonlySetLike<Other>): Set<Value | Other> {
    const result = this.union(other);
    for (const value of this.#values) {
      if (other.has(value as Value & Other)) result.delete(value);
    }
    return result;
  }

  isSubsetOf(other: ReadonlySetLike<unknown>): boolean {
    for (const value of this.#values) {
      if (!other.has(value)) return false;
    }
    return true;
  }

  isSupersetOf(other: ReadonlySetLike<unknown>): boolean {
    const values = other.keys();
    for (let next = values.next(); !next.done; next = values.next()) {
      if (!this.#values.has(next.value as Value)) return false;
    }
    return true;
  }

  isDisjointFrom(other: ReadonlySetLike<unknown>): boolean {
    for (const value of this.#values) {
      if (other.has(value)) return false;
    }
    return true;
  }

  entries(): SetIterator<[Value, Value]> {
    return this.#values.entries();
  }

  keys(): SetIterator<Value> {
    return this.#values.keys();
  }

  values(): SetIterator<Value> {
    return this.#values.values();
  }

  forEach(
    callbackfn: (value: Value, value2: Value, set: ReadonlySet<Value>) => void,
    thisArg?: unknown
  ): void {
    for (const value of this.#values) {
      callbackfn.call(thisArg, value, value, this);
    }
  }

  [Symbol.iterator](): SetIterator<Value> {
    return this.values();
  }

  get [Symbol.toStringTag](): string {
    return "ImmutableSet";
  }
}
