// testar-chat-audio-validacao-qa.ts - valida bytes, sem banco e sem AWS
import assert from "node:assert/strict";
assert.equal(process.env.NODE_ENV, "test");
assert.equal(process.env.ENABLE_CHAT_AUDIO_LOCAL, "true");
assert.notEqual(process.env.NODE_ENV, "production");
const { validarChatAudio } = await import("./server/services/chatAudioStorage.js");
const webm = Buffer.from([0x1a, 0x45, 0xdf, 0xa3, 0x42, 0x82]);
const mp4 = Buffer.from("\0\0\0\x18ftypisom");
const ogg = Buffer.from("OggS\0\0");
assert.equal(validarChatAudio(webm, "audio/webm;codecs=opus").ext, "webm");
assert.equal(validarChatAudio(mp4, "audio/mp4").ext, "m4a");
assert.equal(validarChatAudio(ogg, "audio/ogg").ext, "ogg");
assert.throws(() => validarChatAudio(Buffer.from("hello"), "audio/webm"));
assert.throws(() => validarChatAudio(Buffer.alloc(0), "audio/webm"));
console.log("CHAT_AUDIO_VALIDACAO_QA_OK — 5/5; nenhum arquivo gravado.");
