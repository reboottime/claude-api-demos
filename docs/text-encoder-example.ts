/**
 * TextEncoder Example
 *
 * TextEncoder is a Web API that converts strings to UTF-8 encoded bytes (Uint8Array).
 * Works in: browsers, Node.js (v11+), Deno
 *
 * Why use it?
 * - Streams (like ReadableStream) work with bytes, not strings
 * - Network protocols expect bytes
 * - File I/O needs byte representation
 *
 * Run: npx tsx docs/text-encoder-example.ts
 * Docs: https://developer.mozilla.org/en-US/docs/Web/API/TextEncoder
 */

// Basic usage: string → bytes
const encoder = new TextEncoder();

const text = "Hello, World!";
const bytes = encoder.encode(text);

console.log("Original string:", text);
console.log("Encoded bytes:", bytes);
// Uint8Array(13) [72, 101, 108, 108, 111, 44, 32, 87, 111, 114, 108, 100, 33]

console.log("Byte length:", bytes.length); // 13 (one byte per ASCII char)

// UTF-8 handles non-ASCII characters
const emoji = "Hello 👋";
const emojiBytes = encoder.encode(emoji);

console.log("\nEmoji string:", emoji);
console.log("Emoji bytes:", emojiBytes);
// Note: 👋 takes 4 bytes in UTF-8, so length > character count

// Decoding: bytes → string (use TextDecoder)
const decoder = new TextDecoder();
const decoded = decoder.decode(bytes);

console.log("\nDecoded back:", decoded); // "Hello, World!"

// Real-world use: preparing data for a stream
const sseMessage = `data: ${JSON.stringify({ type: "text", content: "chunk" })}\n\n`;
const sseBytes = encoder.encode(sseMessage);

console.log("\nSSE message as bytes:", sseBytes);
// These bytes can now be sent via ReadableStream
