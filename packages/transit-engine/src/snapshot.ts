import { FORMAT_VERSION } from './network.ts';
import type { Network, NetworkMeta } from './network.ts';

// Binary layout: magic, header length (uint32 LE), JSON header, padding to 8 bytes, typed arrays each aligned on 8 bytes.
const MAGIC = 'ONYVA-TE';
type ArrayKind = 'i32' | 'u8' | 'f64';
const TYPED = { i32: Int32Array, u8: Uint8Array, f64: Float64Array } as const;
const ARRAY_FIELDS = [
  ['stationLat', 'f64'], ['stationLon', 'f64'], ['stopStation', 'i32'], ['stationStopOffsets', 'i32'], ['stationStops', 'i32'],
  ['routeTypes', 'i32'], ['routeNight', 'u8'], ['patternRoute', 'i32'], ['patternStopOffsets', 'i32'], ['patternStops', 'i32'],
  ['patternTripOffsets', 'i32'], ['patternTimeOffsets', 'i32'], ['arrivals', 'i32'], ['departures', 'i32'], ['flags', 'u8'],
  ['tripService', 'i32'], ['stopPatternOffsets', 'i32'], ['stopPatterns', 'i32'], ['stopPatternPositions', 'i32'], ['serviceDays', 'u8'],
  ['transferOffsets', 'i32'], ['transferTo', 'i32'], ['transferTime', 'i32'], ['transferInOffsets', 'i32'], ['transferFrom', 'i32'], ['transferInTime', 'i32'],
] as const satisfies ReadonlyArray<readonly [keyof Network, ArrayKind]>;

interface Header { meta: NetworkMeta; serviceCount: number; stationIds: string[]; stationNames: string[]; routeIds: string[]; routeNames: string[]; arrays: Array<{ name: string; kind: ArrayKind; offset: number; length: number }> }
const align = (value: number) => Math.ceil(value / 8) * 8;

export function serializeNetwork(network: Network): Uint8Array {
  const arrays: Header['arrays'] = [];
  let cursor = 0;
  for (const [name, kind] of ARRAY_FIELDS) {
    const array = network[name] as Int32Array | Uint8Array | Float64Array;
    arrays.push({ name, kind, offset: cursor, length: array.length });
    cursor = align(cursor + array.byteLength);
  }
  const header: Header = { meta: network.meta, serviceCount: network.serviceCount, stationIds: network.stationIds, stationNames: network.stationNames, routeIds: network.routeIds, routeNames: network.routeNames, arrays };
  const json = new TextEncoder().encode(JSON.stringify(header)), dataStart = align(MAGIC.length + 4 + json.length);
  const out = new Uint8Array(dataStart + cursor);
  out.set(new TextEncoder().encode(MAGIC), 0);
  new DataView(out.buffer).setUint32(MAGIC.length, json.length, true);
  out.set(json, MAGIC.length + 4);
  for (const entry of arrays) {
    const array = network[entry.name as keyof Network] as Int32Array | Uint8Array | Float64Array;
    out.set(new Uint8Array(array.buffer, array.byteOffset, array.byteLength), dataStart + entry.offset);
  }
  return out;
}

/** Views share the given buffer: pass a SharedArrayBuffer-backed array to share one snapshot between threads. */
export function deserializeNetwork(bytes: Uint8Array): Network {
  if (new TextDecoder().decode(bytes.subarray(0, MAGIC.length)) !== MAGIC) throw new Error('Not an Onyva transit snapshot.');
  const length = new DataView(bytes.buffer, bytes.byteOffset).getUint32(MAGIC.length, true);
  const header = JSON.parse(new TextDecoder().decode(bytes.subarray(MAGIC.length + 4, MAGIC.length + 4 + length))) as Header;
  if (header.meta.formatVersion !== FORMAT_VERSION) throw new Error(`Snapshot format ${header.meta.formatVersion} is not supported.`);
  let base = bytes;
  // Typed array views need an aligned offset: copy only when the caller's buffer is misaligned.
  if (bytes.byteOffset % 8 !== 0) { base = new Uint8Array(bytes.length); base.set(bytes); }
  const dataStart = base.byteOffset + align(MAGIC.length + 4 + length), fields: Record<string, unknown> = {};
  const buffer = base.buffer as ArrayBuffer;
  for (const entry of header.arrays) fields[entry.name] = new TYPED[entry.kind](buffer, dataStart + entry.offset, entry.length);
  return { ...(fields as unknown as Network), meta: header.meta, serviceCount: header.serviceCount, stationIds: header.stationIds, stationNames: header.stationNames, routeIds: header.routeIds, routeNames: header.routeNames };
}
