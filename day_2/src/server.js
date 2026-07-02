import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { 
    getDbConnection,
  getConversations, 
  getConversationMessages, 
  createConversation, 
  saveMessage, 
  deleteConversation,
  deleteMessagesAfter
} from './db.js';
import { GoogleGenerativeAI } from "@google/generative-ai";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);


const __dirname = path.dirname(fileURLToPath(import.meta.url));

app.use(express.json())
app.use(express.static(path.resolve(__dirname, '../public')));


// 1. GET /api/conversations: Get all history threads
app.get('/api/conversations', async (req, res) => {
  try {
    const list = await getConversations();
    res.json(list);
  } catch (error) {
    console.error("Failed to get conversations:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});


// 2. GET /api/conversations/:id/messages: Get history messages for a thread
app.get('/api/conversations/:id/messages', async (req, res) => {
  try {
    const { id } = req.params;
    const messages = await getConversationMessages(id);
    res.json(messages);
  } catch (error) {
    console.error("Failed to get messages:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});
// 3. DELETE /api/conversations/:id: Delete a thread
app.delete('/api/conversations/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await deleteConversation(id);
    res.json({ success: true });
  } catch (error) {
    console.error("Failed to delete conversation:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});


app.post('/api/chat', async (req, res) => {
  const { conversationId, message, modelName } = req.body;
  if (!message || !conversationId) {
    return res.status(400).json({ error: "Missing conversationId or message" });
  }
  // Fallback to standard Gemini model if none provided
  const modelToUse = modelName || 'gemini-2.5-flash';
  try {
    // 1. Fetch history from DB and map to Gemini format
    const dbMessages = await getConversationMessages(conversationId);
    
    let isNewChat = dbMessages.length === 0;
    if (isNewChat) {
      // Create conversation with the first 40 chars of prompt as the title
      const title = message.substring(0, 40) + (message.length > 40 ? '...' : '');
      await createConversation(conversationId, title);
    }
    // Save user message in DB
    await saveMessage(conversationId, 'user', message);
    // Format history for the Gemini API
    const geminiHistory = dbMessages.map(msg => ({
      role: msg.role === 'user' ? 'user' : 'model',
      parts: [{ text: msg.content }]
    }));
    // 2. Initialize Gemini Model and Chat session
    const model = genAI.getGenerativeModel({ model: modelToUse });
    const chat = model.startChat({
      history: geminiHistory
    });
    // 3. Set SSE Headers for Streaming
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders(); // Establish stream
    // 4. Send query to Gemini in stream mode
    const result = await chat.sendMessageStream(message);
    let fullResponseText = '';
    // Stream chunks back to client
    for await (const chunk of result.stream) {
      const chunkText = chunk.text();
      fullResponseText += chunkText;
      
      // SSE format: data: <payload>\n\n
      res.write(`data: ${JSON.stringify({ text: chunkText })}\n\n`);
    }
    // Save model response to DB
    await saveMessage(conversationId, 'model', fullResponseText);
    // Signal end of stream
    res.write('data: [DONE]\n\n');
    res.end();
  } catch (error) {
    console.error("Gemini API Error:", error);
    // Write SSE error chunk if headers already sent, otherwise send JSON response
    if (res.headersSent) {
      res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
      res.end();
    } else {
      res.status(500).json({ error: error.message || "Failed to process AI chat" });
    }
  }
});


// POST /api/chat/regenerate: Regenerates response for the last user prompt
app.post('/api/chat/regenerate', async (req, res) => {
  const { conversationId, modelName } = req.body;
  if (!conversationId) {
    return res.status(400).json({ error: "Missing conversationId" });
  }
  const modelToUse = modelName || 'gemini-2.5-flash';
  try {
    const dbMessages = await getConversationMessages(conversationId);
    if (dbMessages.length < 2) {
      return res.status(400).json({ error: "Cannot regenerate: Not enough messages in thread" });
    }
    const lastMsg = dbMessages[dbMessages.length - 1];
    if (lastMsg.role !== 'model') {
      return res.status(400).json({ error: "Last message is not an AI response" });
    }
    // Delete the last message (the model's message)
    // Since our deleteMessagesAfter deletes messages with id > specifiedId,
    // we specify the second to last message ID (which is the user prompt).
    const secondToLastMsg = dbMessages[dbMessages.length - 2];
    await deleteMessagesAfter(conversationId, secondToLastMsg.id);
    // Re-fetch remaining messages (now ends with the user prompt)
    const remainingMessages = await getConversationMessages(conversationId);
    
    // The prompt is the last remaining message (the user message)
    const promptMessage = remainingMessages[remainingMessages.length - 1];
    // The history is everything before the prompt
    const historyMessages = remainingMessages.slice(0, -1);
    const geminiHistory = historyMessages.map(msg => ({
      role: msg.role === 'user' ? 'user' : 'model',
      parts: [{ text: msg.content }]
    }));
    // Initialize Gemini Chat
    const model = genAI.getGenerativeModel({ model: modelToUse });
    const chat = model.startChat({
      history: geminiHistory
    });
    // Set SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();
    const result = await chat.sendMessageStream(promptMessage.content);
    let fullResponseText = '';
    for await (const chunk of result.stream) {
      const chunkText = chunk.text();
      fullResponseText += chunkText;
      res.write(`data: ${JSON.stringify({ text: chunkText })}\n\n`);
    }
    // Save newly generated response
    await saveMessage(conversationId, 'model', fullResponseText);
    res.write('data: [DONE]\n\n');
    res.end();
  } catch (error) {
    console.error("Regenerate Error:", error);
    if (res.headersSent) {
      res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
      res.end();
    } else {
      res.status(500).json({ error: error.message || "Failed to regenerate response" });
    }
  }
});
// POST /api/chat/edit: Edits a prompt, deletes trailing messages, and re-streams response
app.post('/api/chat/edit', async (req, res) => {
  const { conversationId, messageId, newContent, modelName } = req.body;
  if (!conversationId || !messageId || !newContent) {
    return res.status(400).json({ error: "Missing conversationId, messageId, or newContent" });
  }
  const modelToUse = modelName || 'gemini-2.5-flash';
  try {
    const dbMessages = await getConversationMessages(conversationId);
    const targetMsg = dbMessages.find(m => m.id === parseInt(messageId));
    if (!targetMsg) {
      return res.status(404).json({ error: "Target message not found" });
    }
    if (targetMsg.role !== 'user') {
      return res.status(400).json({ error: "Only user prompts can be edited" });
    }
    // Delete all trailing messages after the user prompt
    await deleteMessagesAfter(conversationId, targetMsg.id);
    // Update the edited message content in SQLite
    const database = await getDbConnection();
    await database.run(
      'UPDATE messages SET content = ? WHERE id = ?',
      [newContent, messageId]
    );
    // Retrieve active history (which now ends with the updated message)
    const updatedMessages = await getConversationMessages(conversationId);
    const promptMessage = updatedMessages[updatedMessages.length - 1];
    const historyMessages = updatedMessages.slice(0, -1);
    const geminiHistory = historyMessages.map(msg => ({
      role: msg.role === 'user' ? 'user' : 'model',
      parts: [{ text: msg.content }]
    }));
    // Start Gemini Chat
    const model = genAI.getGenerativeModel({ model: modelToUse });
    const chat = model.startChat({
      history: geminiHistory
    });
    // Set SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();
    const result = await chat.sendMessageStream(promptMessage.content);
    let fullResponseText = '';
    for await (const chunk of result.stream) {
      const chunkText = chunk.text();
      fullResponseText += chunkText;
      res.write(`data: ${JSON.stringify({ text: chunkText })}\n\n`);
    }
    // Save newly generated response
    await saveMessage(conversationId, 'model', fullResponseText);
    res.write('data: [DONE]\n\n');
    res.end();
  } catch (error) {
    console.error("Edit Error:", error);
    if (res.headersSent) {
      res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
      res.end();
    } else {
      res.status(500).json({ error: error.message || "Failed to process edit" });
    }
  }
});



// Start Express Server
app.listen(PORT, () => {
  console.log(`Server is running at http://localhost:${PORT}`);
});