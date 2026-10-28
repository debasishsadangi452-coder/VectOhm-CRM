// pako 2.x ships no types; only inflate/inflateRaw are used (resume-parser.ts).
declare module "pako" {
  interface Pako {
    inflate(data: Uint8Array | ArrayBuffer, options?: { to?: "string" }): string;
    inflateRaw(data: Uint8Array | ArrayBuffer, options?: { to?: "string" }): string;
  }
  const pako: Pako;
  export default pako;
}
