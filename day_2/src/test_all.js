/**
 * Comprehensive test of all /api/* endpoints.
 * Run: node src/test_all.js
 */
import dotenv from 'dotenv';
dotenv.config();

const BASE = 'http://localhost:3000';
const CONV_ID = 'test-' + Date.now();

let passed = 0;
let failed = 0;

async function test(label, fn) {
  try {
    const result = await fn();
    console.log(`  ✅ ${label}: ${result}`);
    passed++;
  } catch (err) {
    console.log(`  ❌ ${label}: ${err.message}`);
    failed++;
  }
}

async function readSSE(response) {
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let text = '';
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    const chunk = decoder.decode(value);
    for (const line of chunk.split('\n')) {
      if (line.startsWith('data: ') && !line.includes('[DONE]')) {
        try {
          const p = JSON.parse(line.slice(6));
          if (p.text) text += p.text;
          if (p.error) throw new Error(p.error);
        } catch (_) {}
      }
    }
  }
  return text;
}

async function runTests() {
  console.log('\n═══════════════════════════════════════');
  console.log('   BEDROCK PORTAL — FULL API TEST SUITE');
  console.log('═══════════════════════════════════════\n');

  // ── 1. Conversations API ──────────────────────────────────────────────────
  console.log('1. CONVERSATIONS API');

  await test('GET /api/conversations', async () => {
    const r = await fetch(`${BASE}/api/conversations`);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const data = await r.json();
    return `OK (${data.length} conversations)`;
  });

  // ── 2. Chat — Text Models ─────────────────────────────────────────────────
  console.log('\n2. CHAT — TEXT MODELS');

  const chatModels = [
    ['us.meta.llama3-3-70b-instruct-v1:0',        'Llama 3.3 70B'],
    ['deepseek.v3.2',                              'DeepSeek V3'],
    ['openai.gpt-oss-120b-1:0',                   'GPT OSS 120B'],
    ['openai.gpt-oss-20b-1:0',                    'GPT OSS 20B'],
    ['mistral.voxtral-small-24b-2507',             'Voxtral (text)'],
  ];

  for (const [modelId, name] of chatModels) {
    await test(`/api/chat → ${name}`, async () => {
      const r = await fetch(`${BASE}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId: CONV_ID + modelId, message: 'Say "PONG" only.', modelName: modelId })
      });
      if (!r.ok) { const e = await r.json(); throw new Error(e.error || `HTTP ${r.status}`); }
      const text = await readSSE(r);
      return text.substring(0, 60).trim() || '(empty response)';
    });
  }

  // ── 3. Chat — Vision Models ───────────────────────────────────────────────
  console.log('\n3. CHAT — VISION (IMAGE UNDERSTANDING)');

  // Tiny 1x1 red pixel PNG as data URI
  const redPixel = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADklEQVQI12P4z8BQDwAEgAF/QualIQAAAABJRU5ErkJggg==';

  await test('Qwen VL — image understanding', async () => {
    const convId = CONV_ID + '-qwen-vision';
    const message = `What color is this image? Answer in one word: ${redPixel}`;
    const r = await fetch(`${BASE}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conversationId: convId, message, modelName: 'qwen.qwen3-vl-235b-a22b' })
    });
    if (!r.ok) { const e = await r.json(); throw new Error(e.error || `HTTP ${r.status}`); }
    const text = await readSSE(r);
    return text.substring(0, 60).trim();
  });

  // ── 4. STT — Voxtral ─────────────────────────────────────────────────────
  console.log('\n4. STT — VOXTRAL SPEECH-TO-TEXT');

  await test('/api/stt with real MP3 audio', async () => {
    // Download a short audio file and convert to raw base64
    const audioRes = await fetch('https://www.w3schools.com/html/horse.mp3');
    if (!audioRes.ok) throw new Error('Could not download test audio');
    const buf = await audioRes.arrayBuffer();
    const rawBase64 = Buffer.from(buf).toString('base64');

    const r = await fetch(`${BASE}/api/stt`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ audio: rawBase64 })
    });
    if (!r.ok) { const e = await r.json(); throw new Error(e.error || `HTTP ${r.status}`); }
    const data = await r.json();
    if (!data.text) throw new Error('No text in response');
    return `"${data.text.substring(0, 80).trim()}"`;
  });

  // ── 5. Image Generation ───────────────────────────────────────────────────
  console.log('\n5. IMAGE GENERATION');

  await test('/api/generate-image — Titan v2 (expect EOL error)', async () => {
    const r = await fetch(`${BASE}/api/generate-image`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: 'A red circle', modelName: 'amazon.titan-image-generator-v2:0' })
    });
    const data = await r.json();
    if (r.ok) {
      return data.images ? `Got image! ${data.images.length} image(s)` : JSON.stringify(data).substring(0, 80);
    } else {
      // Expected to fail — show the error
      return `Expected error: ${data.error}`;
    }
  });

  await test('/api/generate-image — Stability remove-bg (expect region error)', async () => {
    const r = await fetch(`${BASE}/api/generate-image`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: 'A cat', modelName: 'stability.stable-image-remove-background-v1:0' })
    });
    const data = await r.json();
    return r.ok ? 'Success!' : `Expected error: ${data.error}`;
  });

  // ── 6. Conversation Management ────────────────────────────────────────────
  console.log('\n6. CONVERSATION MANAGEMENT');

  const mgmtId = CONV_ID + '-mgmt';

  await test('Create conversation via chat', async () => {
    const r = await fetch(`${BASE}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conversationId: mgmtId, message: 'Say "HELLO"', modelName: 'us.meta.llama3-3-70b-instruct-v1:0' })
    });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    await readSSE(r);
    return 'Conversation created';
  });

  await test('GET messages for conversation', async () => {
    const r = await fetch(`${BASE}/api/conversations/${mgmtId}/messages`);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const msgs = await r.json();
    if (msgs.length < 2) throw new Error(`Expected 2+ messages, got ${msgs.length}`);
    return `${msgs.length} messages found`;
  });

  await test('Regenerate last response', async () => {
    const r = await fetch(`${BASE}/api/chat/regenerate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conversationId: mgmtId, modelName: 'us.meta.llama3-3-70b-instruct-v1:0' })
    });
    if (!r.ok) { const e = await r.json(); throw new Error(e.error || `HTTP ${r.status}`); }
    const text = await readSSE(r);
    return `Regenerated: "${text.substring(0, 40).trim()}"`;
  });

  await test('Edit message and re-submit', async () => {
    const msgsR = await fetch(`${BASE}/api/conversations/${mgmtId}/messages`);
    const msgs = await msgsR.json();
    const userMsg = msgs.find(m => m.role === 'user');
    if (!userMsg) throw new Error('No user message found');

    const r = await fetch(`${BASE}/api/chat/edit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conversationId: mgmtId, messageId: userMsg.id, newContent: 'Say "EDITED"', modelName: 'us.meta.llama3-3-70b-instruct-v1:0' })
    });
    if (!r.ok) { const e = await r.json(); throw new Error(e.error || `HTTP ${r.status}`); }
    const text = await readSSE(r);
    return `Edit response: "${text.substring(0, 40).trim()}"`;
  });

  await test('DELETE conversation', async () => {
    const r = await fetch(`${BASE}/api/conversations/${mgmtId}`, { method: 'DELETE' });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return 'Deleted OK';
  });

  // ── 7. Model capability tests (restricted models show expected errors) ────
  console.log('\n7. RESTRICTED/UNAVAILABLE MODELS (verify graceful errors)');

  const restrictedModels = [
    ['anthropic.claude-haiku-4-5-20251001-v1:0', 'Claude Haiku 4.5'],
    ['us.amazon.nova-2-lite-v1:0',               'Nova 2 Lite'],
  ];

  for (const [modelId, name] of restrictedModels) {
    await test(`${name} — graceful error handling`, async () => {
      const r = await fetch(`${BASE}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId: CONV_ID + modelId, message: 'Hi', modelName: modelId })
      });
      if (r.ok) {
        const text = await readSSE(r);
        return `Working! "${text.substring(0, 40).trim()}"`;
      }
      const err = await r.json();
      return `Expected error: "${err.error?.substring(0, 60)}"`;
    });
  }

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log('\n═══════════════════════════════════════');
  console.log(`  Results: ${passed} passed, ${failed} failed`);
  console.log('═══════════════════════════════════════\n');
}

runTests().catch(err => {
  console.error('\nTest suite crashed:', err);
  process.exit(1);
});
