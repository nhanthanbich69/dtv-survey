export function asList<T>(data: unknown): T[] {
  return (Array.isArray(data) ? data : []) as T[];
}

export function asOne<T>(data: unknown): T | null {
  if (!data) return null;
  if (Array.isArray(data)) return (data[0] as T) ?? null;
  return data as T;
}

export function asRecord<T>(data: unknown): T | null {
  return (data ?? null) as T | null;
}
