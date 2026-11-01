// Both exist in browsers and Node. Declaring only these keeps DOM and Node types out of the package.
declare class TextEncoder {
  encode(input: string): Uint8Array<ArrayBuffer>;
}

declare class TextDecoder {
  constructor(label: string, options: { fatal: boolean });
  decode(input: Uint8Array): string;
}
