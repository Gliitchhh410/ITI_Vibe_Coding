import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import {
  getDbConnection,
  getConversations,
  getConversationMessages,
  createConversation,
  saveMessage,
  deleteConversation,
  deleteMessagesAfter
} from './db.js';
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const base_url = 'http://apiaccess.iti.net.eg/api/v1';

// Model type classification
const IMAGE_GEN_MODELS = new Set([
  'amazon.titan-image-generator-v2:0',
  'stability.stable-fast-upscale-v1:0',
  'stability.stable-image-inpaint-v1:0',
  'stability.stable-image-remove-background-v1:0',
  'stability.stable-outpaint-v1:0',
  'amazon.nova-reel-v1:1',
]);

const ALLOWED_CHAT_MODELS = new Set([
  'us.meta.llama3-3-70b-instruct-v1:0',
  'anthropic.claude-haiku-4-5-20251001-v1:0',
  'anthropic.claude-sonnet-4-6',
  'anthropic.claude-opus-4-7',
  'deepseek.r1-v1:0',
  'deepseek.v3.2',
  'openai.gpt-oss-120b-1:0',
  'openai.gpt-oss-20b-1:0',
  'openai.gpt-oss-safeguard-120b',
  'openai.gpt-oss-safeguard-20b',
  'us.amazon.nova-2-lite-v1:0',
  'qwen.qwen3-vl-235b-a22b',
  'mistral.voxtral-small-24b-2507',
  'amazon.nova-2-multimodal-embeddings-v1:0',
  'amazon.nova-2-sonic-v1:0',
  'amazon.titan-embed-image-v1',
  'amazon.titan-embed-text-v2:0:8k',
  'global.twelvelabs.pegasus-1-2-v1:0',
  'us.cohere.embed-v4:0',
  'us.twelvelabs.marengo-embed-3-0-v1:0',
]);

const DEFAULT_MODEL = 'us.meta.llama3-3-70b-instruct-v1:0';

async function callBedrockGateway(dbMessages, newMessage, modelName) {
  const apiMessages = dbMessages.map(msg => ({
    role: msg.role === 'user' ? 'user' : 'assistant',
    content: msg.content
  }));
  apiMessages.push({ role: 'user', content: newMessage });

  let selectedModel = modelName;
  if (!selectedModel || (!ALLOWED_CHAT_MODELS.has(selectedModel) && !IMAGE_GEN_MODELS.has(selectedModel))) {
    selectedModel = DEFAULT_MODEL;
  }

  const payload = {
    model_id: selectedModel,
    messages: apiMessages,
    system_prompt: "You are a helpful and concise assistant.",
    max_tokens: 1000
  };

  const response = await fetch(`${base_url}/student/chat`, {
    method: 'POST',
    headers: {
      "Authorization": `Bearer ${process.env.SBG_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.error?.message || `Gateway returned status ${response.status}`);
  }

  const data = await response.json();
  return data.output_text;
}

async function callImageGeneration(prompt, modelName, inputImageBase64, width, height) {
  const payload = {
    model_id: modelName,
    prompt,
    width: width || 512,
    height: height || 512,
    num_images: 1
  };
  if (inputImageBase64) payload.input_image = inputImageBase64;

  const response = await fetch(`${base_url}/student/generate-image`, {
    method: 'POST',
    headers: {
      "Authorization": `Bearer ${process.env.SBG_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.error?.message || `Image generation returned status ${response.status}`);
  }

  return await response.json();
}

async function callPollinationsImageGen(prompt, width, height) {
  const seed = Math.floor(Math.random() * 999999);
  const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=${width}&height=${height}&nologo=true&seed=${seed}`;
  const response = await fetch(url, { signal: AbortSignal.timeout(30000) });
  if (!response.ok) throw new Error(`Pollinations returned ${response.status}`);
  const arrayBuffer = await response.arrayBuffer();
  const base64 = Buffer.from(arrayBuffer).toString('base64');
  return { images: [`data:image/jpeg;base64,${base64}`], source: 'pollinations.ai' };
}


const __dirname = path.dirname(fileURLToPath(import.meta.url));

app.use(express.json({ limit: '50mb' }));
app.use(express.static(path.resolve(__dirname, '../public')));


// GET /api/conversations
app.get('/api/conversations', async (req, res) => {
  try {
    res.json(await getConversations());
  } catch (error) {
    console.error("Failed to get conversations:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// GET /api/conversations/:id/messages
app.get('/api/conversations/:id/messages', async (req, res) => {
  try {
    res.json(await getConversationMessages(req.params.id));
  } catch (error) {
    console.error("Failed to get messages:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// DELETE /api/conversations/:id
app.delete('/api/conversations/:id', async (req, res) => {
  try {
    await deleteConversation(req.params.id);
    res.json({ success: true });
  } catch (error) {
    console.error("Failed to delete conversation:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// POST /api/generate-image — Image Generation (Bedrock → Pollinations.ai fallback)
app.post('/api/generate-image', async (req, res) => {
  const { prompt, modelName, inputImage, width, height } = req.body;
  if (!prompt) return res.status(400).json({ error: 'Missing prompt' });

  const model = modelName || 'amazon.titan-image-generator-v2:0';
  const w = width || 512;
  const h = height || 512;

  // Try Bedrock first
  try {
    const data = await callImageGeneration(prompt, model, inputImage, w, h);
    return res.json(data);
  } catch (bedrockErr) {
    console.log(`Bedrock image gen failed (${bedrockErr.message}), falling back to Pollinations.ai`);
  }

  // Fallback: Pollinations.ai (free, no API key needed)
  try {
    const data = await callPollinationsImageGen(prompt, w, h);
    return res.json(data);
  } catch (pollinationsErr) {
    console.error("All image gen failed:", pollinationsErr);
    return res.status(500).json({ error: 'Image generation unavailable. Bedrock models are region-restricted; Pollinations.ai fallback also failed.' });
  }
});

// POST /api/chat
app.post('/api/chat', async (req, res) => {
  const { conversationId, message, modelName } = req.body;
  if (!message || !conversationId) {
    return res.status(400).json({ error: "Missing conversationId or message" });
  }

  const modelToUse = modelName || DEFAULT_MODEL;

  try {
    const dbMessages = await getConversationMessages(conversationId);

    if (dbMessages.length === 0) {
      const cleanTitleText = message.split('data:')[0].trim() || 'New Chat';
      const title = cleanTitleText.substring(0, 40) + (cleanTitleText.length > 40 ? '...' : '');
      await createConversation(conversationId, title);
    }

    const responseText = await callBedrockGateway(dbMessages, message, modelToUse);

    await saveMessage(conversationId, 'user', message);
    await saveMessage(conversationId, 'model', responseText);

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    res.write(`data: ${JSON.stringify({ text: responseText })}\n\n`);
    res.write('data: [DONE]\n\n');
    res.end();

  } catch (error) {
    console.error("Gateway API Error:", error);
    if (res.headersSent) {
      res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
      res.end();
    } else {
      res.status(500).json({ error: error.message || "Failed to process chat response" });
    }
  }
});

// POST /api/chat/regenerate
app.post('/api/chat/regenerate', async (req, res) => {
  const { conversationId, modelName } = req.body;
  if (!conversationId) return res.status(400).json({ error: "Missing conversationId" });
  const modelToUse = modelName || DEFAULT_MODEL;
  try {
    const dbMessages = await getConversationMessages(conversationId);
    if (dbMessages.length < 2) return res.status(400).json({ error: "Not enough messages" });
    if (dbMessages[dbMessages.length - 1].role !== 'model') return res.status(400).json({ error: "Last message is not an AI response" });

    const secondToLastMsg = dbMessages[dbMessages.length - 2];
    await deleteMessagesAfter(conversationId, secondToLastMsg.id);

    const remaining = await getConversationMessages(conversationId);
    const promptMsg = remaining[remaining.length - 1];
    const history = remaining.slice(0, -1);

    const responseText = await callBedrockGateway(history, promptMsg.content, modelToUse);
    await saveMessage(conversationId, 'model', responseText);

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();
    res.write(`data: ${JSON.stringify({ text: responseText })}\n\n`);
    res.write('data: [DONE]\n\n');
    res.end();
  } catch (error) {
    console.error("Regenerate Error:", error);
    if (res.headersSent) { res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`); res.end(); }
    else res.status(500).json({ error: error.message || "Failed to regenerate" });
  }
});

// POST /api/chat/edit
app.post('/api/chat/edit', async (req, res) => {
  const { conversationId, messageId, newContent, modelName } = req.body;
  if (!conversationId || !messageId || !newContent) {
    return res.status(400).json({ error: "Missing conversationId, messageId, or newContent" });
  }
  const modelToUse = modelName || DEFAULT_MODEL;
  try {
    const dbMessages = await getConversationMessages(conversationId);
    const targetMsg = dbMessages.find(m => m.id === parseInt(messageId));
    if (!targetMsg) return res.status(404).json({ error: "Target message not found" });
    if (targetMsg.role !== 'user') return res.status(400).json({ error: "Only user prompts can be edited" });

    await deleteMessagesAfter(conversationId, targetMsg.id);
    const database = await getDbConnection();
    await database.run('UPDATE messages SET content = ? WHERE id = ?', [newContent, messageId]);

    const updated = await getConversationMessages(conversationId);
    const promptMsg = updated[updated.length - 1];
    const history = updated.slice(0, -1);

    const responseText = await callBedrockGateway(history, promptMsg.content, modelToUse);
    await saveMessage(conversationId, 'model', responseText);

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();
    res.write(`data: ${JSON.stringify({ text: responseText })}\n\n`);
    res.write('data: [DONE]\n\n');
    res.end();
  } catch (error) {
    console.error("Edit Error:", error);
    if (res.headersSent) { res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`); res.end(); }
    else res.status(500).json({ error: error.message || "Failed to process edit" });
  }
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
