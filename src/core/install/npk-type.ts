import { type FileHandle, open } from "node:fs/promises";

/**
 * NPK 目录头结构（还原自 ExtractorSharp NpkCoder.cs）：
 * 16 字节魔数 "NeoplePack_Bill\0"、int32 条目数、每条 264 字节
 * （int32 offset、int32 length、256 字节 XOR 加密内部路径）。
 */
const NPK_FLAG = "NeoplePack_Bill";
const NPK_FLAG_BYTES = 16;
const ENTRY_PATH_BYTES = 256;
const ENTRY_BYTES = 8 + ENTRY_PATH_BYTES;
const OGG_FLAG = "OggS";
const KEY_HEADER = "puchikon@neople dungeon and fighter ";
const KEY_FILLER = "DNF";

/** 条目数异常时的读取字节上限，防止被篡改的 count 拖爆内存。 */
const MAX_INDEX_BYTES = 1024 * 1024;

const xorKey: readonly number[] = buildXorKey();

function buildXorKey(): readonly number[] {
  const key = new Array<number>(ENTRY_PATH_BYTES).fill(0);
  const header = Buffer.from(KEY_HEADER, "utf8");
  const filler = Buffer.from(KEY_FILLER, "utf8");
  for (let i = 0; i < header.length && i < ENTRY_PATH_BYTES; i += 1) key[i] = header[i] ?? 0;
  for (let i = header.length; i < ENTRY_PATH_BYTES - 1; i += 1) key[i] = filler[i % 3] ?? 0;
  return key;
}

export type NpkPatchKind = "image" | "sound";

/**
 * 解析 NPK 头部并按内部条目路径分类补丁类型。
 * 任何读取失败、结构损坏或条目数异常都回落为 "image"，
 * 与既有安装行为保持一致，不阻塞安装。
 */
export async function classifyNpk(filePath: string): Promise<NpkPatchKind> {
  try {
    return await withFileHandle(filePath);
  } catch {
    return "image";
  }
}

async function withFileHandle(filePath: string): Promise<NpkPatchKind> {
  const handle = await open(filePath, "r");
  try {
    const head = Buffer.alloc(NPK_FLAG_BYTES + 4);
    await handle.read(head, 0, head.length, 0);
    if (head.subarray(0, NPK_FLAG_BYTES).toString("utf8").replace(/\0.*$/, "") !== NPK_FLAG) {
      return await sniffNonNpk(handle);
    }
    const entryCount = head.readInt32LE(NPK_FLAG_BYTES);
    if (entryCount <= 0) return "image";
    const indexBytes = entryCount * ENTRY_BYTES;
    if (indexBytes > MAX_INDEX_BYTES) return "image";
    const index = Buffer.alloc(indexBytes);
    const { bytesRead } = await handle.read(index, 0, indexBytes, head.length);
    if (bytesRead < indexBytes) return "image";
    for (let i = 0; i < entryCount; i += 1) {
      const entryPath = decryptEntryPath(index, i * ENTRY_BYTES + 8);
      if (isSoundEntryPath(entryPath)) return "sound";
    }
    return "image";
  } finally {
    await handle.close();
  }
}

async function sniffNonNpk(handle: FileHandle): Promise<NpkPatchKind> {
  const magic = Buffer.alloc(4);
  const { bytesRead } = await handle.read(magic, 0, 4, 0);
  return bytesRead === 4 && magic.toString("utf8") === OGG_FLAG ? "sound" : "image";
}

function decryptEntryPath(index: Buffer, offset: number): string {
  const bytes: number[] = [];
  for (let i = 0; i < ENTRY_PATH_BYTES; i += 1) {
    const byte = (index[offset + i] ?? 0) ^ (xorKey[i] ?? 0);
    if (byte === 0) break;
    bytes.push(byte);
  }
  return Buffer.from(bytes).toString("utf8");
}

function isSoundEntryPath(entryPath: string): boolean {
  const lowered = entryPath.toLocaleLowerCase();
  return lowered.startsWith("sounds/") && lowered.endsWith(".ogg");
}
