import { Buffer } from "node:buffer";

const XOR_KEY = buildXorKey();

/**
 * 与 ExtractorSharp 的 NpkCoder/WritePath 对齐的最小 NPK 构造器：
 * 16 字节魔数 + int32 条目数 + 每条 264 字节（int32 offset/length + 256 字节
 * 整段 XOR 加密路径，路径结束处解密为 0）。
 */
export function buildNpkBytes(entryPaths: readonly string[]): Buffer {
  const header = Buffer.alloc(20);
  header.write("NeoplePack_Bill", 0, "utf8");
  header.writeInt32LE(entryPaths.length, 16);
  const entries = entryPaths.map((path) => {
    const entry = Buffer.alloc(264);
    entry.writeInt32LE(0, 0);
    entry.writeInt32LE(0, 4);
    encodeEntryPath(path).copy(entry, 8);
    return entry;
  });
  return Buffer.concat([header, ...entries]);
}

function buildXorKey(): Buffer {
  const key = Buffer.alloc(256);
  const header = Buffer.from("puchikon@neople dungeon and fighter ", "utf8");
  const filler = Buffer.from("DNF", "utf8");
  key.set(header);
  for (let i = header.length; i < 255; i += 1) key[i] = filler[i % 3] ?? 0;
  return key;
}

function encodeEntryPath(path: string): Buffer {
  const raw = Buffer.from(path, "utf8");
  const encrypted = Buffer.alloc(256);
  for (let i = 0; i < 255 && i < raw.length; i += 1) {
    encrypted[i] = (raw[i] ?? 0) ^ (XOR_KEY[i] ?? 0);
  }
  for (let i = raw.length; i < 255; i += 1) encrypted[i] = XOR_KEY[i] ?? 0;
  return encrypted;
}
