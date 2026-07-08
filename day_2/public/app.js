// ─── State ───────────────────────────────────────────────────────────────────
let activeConversationId = null;
let isStreaming = false;
let attachedFile = null;
let currentSpeechUtterance = null;

// Model metadata
const MODEL_META = {
  'us.meta.llama3-3-70b-instruct-v1:0':            { label: 'Llama 3.3 70B',       type: 'chat' },
  'deepseek.r1-v1:0':                               { label: 'DeepSeek R1',          type: 'chat' },
  'deepseek.v3.2':                                  { label: 'DeepSeek V3',          type: 'chat' },
  'openai.gpt-oss-120b-1:0':                        { label: 'GPT OSS 120B',         type: 'chat' },
  'openai.gpt-oss-20b-1:0':                         { label: 'GPT OSS 20B',          type: 'chat' },
  'openai.gpt-oss-safeguard-120b':                  { label: 'GPT Safeguard 120B',   type: 'chat' },
  'openai.gpt-oss-safeguard-20b':                   { label: 'GPT Safeguard 20B',    type: 'chat' },
  'qwen.qwen3-vl-235b-a22b':                        { label: 'Qwen 3 VL 235B',       type: 'vision' },
  'mistral.voxtral-small-24b-2507':                 { label: 'Voxtral',              type: 'audio' },
  'anthropic.claude-haiku-4-5-20251001-v1:0':       { label: 'Claude Haiku 4.5',     type: 'chat' },
  'anthropic.claude-sonnet-4-6':                    { label: 'Claude Sonnet 4.6',    type: 'chat' },
  'anthropic.claude-opus-4-7':                      { label: 'Claude Opus 4.7',      type: 'chat' },
  'us.amazon.nova-2-lite-v1:0':                     { label: 'Nova 2 Lite',          type: 'chat' },
  'amazon.nova-2-sonic-v1:0':                       { label: 'Nova Sonic',           type: 'tts' },
  'amazon.nova-2-multimodal-embeddings-v1:0':       { label: 'Nova Multimodal Embed',type: 'embed' },
  'amazon.titan-image-generator-v2:0':              { label: 'Titan Image Gen v2',   type: 'image-gen' },
  'stability.stable-fast-upscale-v1:0':             { label: 'Stability Upscale',    type: 'image-edit' },
  'stability.stable-image-inpaint-v1:0':            { label: 'Stability Inpaint',    type: 'image-edit' },
  'stability.stable-image-remove-background-v1:0':  { label: 'Stability Remove BG',  type: 'image-edit' },
  'stability.stable-outpaint-v1:0':                 { label: 'Stability Outpaint',   type: 'image-edit' },
  'amazon.nova-reel-v1:1':                          { label: 'Nova Reel v1.1',       type: 'video-gen' },
  'amazon.titan-embed-image-v1':                    { label: 'Titan Image Embed',    type: 'embed' },
  'amazon.titan-embed-text-v2:0:8k':               { label: 'Titan Text Embed',     type: 'embed' },
  'us.cohere.embed-v4:0':                           { label: 'Cohere Embed v4',      type: 'embed' },
  'us.twelvelabs.marengo-embed-3-0-v1:0':          { label: 'Marengo Embed',        type: 'embed' },
  'global.twelvelabs.pegasus-1-2-v1:0':            { label: 'Pegasus 1.2',          type: 'chat' },
};

const TYPE_ICONS = {
  chat:       '💬',
  vision:     '👁️',
  audio:      '🎙️',
  'image-gen':  '🎨',
  'image-edit': '🖼️',
  'video-gen':  '🎬',
  tts:        '🔊',
  embed:      '📦',
};

const IMAGE_GEN_TYPES = new Set(['image-gen', 'image-edit', 'video-gen']);

// ─── DOM References ───────────────────────────────────────────────────────────
const sidebar              = document.getElementById('sidebar');
const chatList             = document.getElementById('chatList');
const newChatBtn           = document.getElementById('newChatBtn');
const toggleSidebarBtn     = document.getElementById('toggleSidebarBtn');
const chatTitle            = document.getElementById('chatTitle');
const messagesContainer    = document.getElementById('messagesContainer');
const chatForm             = document.getElementById('chatForm');
const userInput            = document.getElementById('userInput');
const sendBtn              = document.getElementById('sendBtn');
const modelSelect          = document.getElementById('modelSelect');
const modelTypeBadge       = document.getElementById('modelTypeBadge');
const modelPill            = document.getElementById('modelPill');
const attachBtn            = document.getElementById('attachBtn');
const fileInput            = document.getElementById('fileInput');
const attachmentPreviewContainer = document.getElementById('attachmentPreviewContainer');
const attachmentName       = document.getElementById('attachmentName');
const attachmentIcon       = document.getElementById('attachmentIcon');
const removeAttachmentBtn  = document.getElementById('removeAttachmentBtn');
const voiceBtn             = document.getElementById('voiceBtn');
const voiceStatusContainer = document.getElementById('voiceStatusContainer');
const voiceStatusText      = document.getElementById('voiceStatusText');
const recordingDot         = document.getElementById('recordingDot');
const autoTtsToggle        = document.getElementById('autoTtsToggle');
const imageGenPanel        = document.getElementById('imageGenPanel');
const imageSize            = document.getElementById('imageSize');
const imageGenInfo         = document.getElementById('imageGenInfo');
const inputHint            = document.getElementById('inputHint');

// ─── Utilities ────────────────────────────────────────────────────────────────
function generateUUID() {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 7);
}

function escapeHtml(text) {
  return text
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

function showToast(msg) {
  const t = document.createElement('div');
  t.className = 'toast';
  t.textContent = msg;
  document.body.appendChild(t);
  requestAnimationFrame(() => t.classList.add('visible'));
  setTimeout(() => { t.classList.remove('visible'); setTimeout(() => t.remove(), 400); }, 3000);
}

function scrollToBottom() {
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function getCurrentModelType() {
  const meta = MODEL_META[modelSelect.value];
  return meta ? meta.type : 'chat';
}

function isImageGenModel() {
  return IMAGE_GEN_TYPES.has(getCurrentModelType());
}

// ─── Model Selection UI ───────────────────────────────────────────────────────
function updateModelUI() {
  const modelId = modelSelect.value;
  const meta = MODEL_META[modelId] || { label: modelId, type: 'chat' };
  const type = meta.type;
  const icon = TYPE_ICONS[type] || '💬';

  modelTypeBadge.textContent = `${icon} ${type.replace('-', ' ').replace(/\b\w/g, c => c.toUpperCase())}`;
  modelTypeBadge.className = `model-type-badge type-${type}`;
  modelPill.textContent = meta.label;

  // Show image gen panel for image/video models
  if (IMAGE_GEN_TYPES.has(type)) {
    imageGenPanel.style.display = 'flex';
    userInput.placeholder = type === 'image-edit'
      ? 'Describe the edit (attach an image above)...'
      : 'Describe the image or video to generate...';
    inputHint.textContent = type === 'image-edit'
      ? 'This model requires an attached image to edit.'
      : 'This model generates images from your text description.';

    if (type === 'image-edit') {
      imageSize.style.display = 'none';
    } else {
      imageSize.style.display = '';
    }
  } else {
    imageGenPanel.style.display = 'none';
    userInput.placeholder = type === 'audio'
      ? 'Message Voxtral (or use mic for audio transcription)...'
      : type === 'vision'
      ? 'Attach an image and ask a question...'
      : 'Message Bedrock...';
    inputHint.textContent = '';
  }
}

modelSelect.addEventListener('change', updateModelUI);

// ─── New Chat / Init ──────────────────────────────────────────────────────────
function initNewChat() {
  activeConversationId = generateUUID();
  messagesContainer.innerHTML = `
    <div class="welcome-screen" id="welcomeScreen">
      <h1>Bedrock Portal</h1>
      <p>Select a model and start chatting. Supports text, vision, STT, and image generation.</p>
    </div>`;
  chatTitle.innerText = 'New Conversation';
  document.querySelectorAll('.chat-item').forEach(i => i.classList.remove('active'));
  clearAttachment();
}

// ─── File Attachment ──────────────────────────────────────────────────────────
attachBtn.addEventListener('click', () => fileInput.click());

function compressImage(file, maxW, maxH, quality) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > maxW) { height = Math.round(height * maxW / width); width = maxW; }
        if (height > maxH) { width = Math.round(width * maxH / height); height = maxH; }
        const canvas = document.createElement('canvas');
        canvas.width = width; canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

fileInput.addEventListener('change', async e => {
  const file = e.target.files[0];
  if (!file) return;
  if (!file.type.startsWith('image/')) { alert('Only image files are supported.'); fileInput.value = ''; return; }
  if (file.size > 25 * 1024 * 1024) { alert('File too large (max 25MB).'); fileInput.value = ''; return; }

  try {
    attachmentName.innerText = 'Compressing...';
    attachmentPreviewContainer.style.display = 'flex';
    const base64Data = await compressImage(file, 1024, 1024, 0.85);
    attachmentIcon.textContent = '🖼️';

    attachedFile = {
      name: file.name,
      type: 'image/jpeg',
      isImage: true,
      base64: base64Data
    };
    attachmentName.innerText = file.name;
    attachmentPreviewContainer.style.display = 'flex';
  } catch (err) {
    console.error('File load error:', err);
    alert('Failed to load file.');
    clearAttachment();
  }
});

removeAttachmentBtn.addEventListener('click', clearAttachment);

function clearAttachment() {
  attachedFile = null;
  fileInput.value = '';
  attachmentPreviewContainer.style.display = 'none';
}

// ─── STT: Local Whisper (runs in browser via @xenova/transformers) ────────────
// Works on any network — no Google servers, no external API after first load.
let whisperPipeline = null;
let whisperLoadPromise = null;
let isRecording = false;
let mediaRecorder = null;
let audioChunks = [];

function setVoiceStatus(text, show = true) {
  voiceStatusText.textContent = text;
  voiceStatusContainer.style.display = show ? 'flex' : 'none';
  recordingDot.classList.toggle('active', show && isRecording);
}

function loadWhisper() {
  if (whisperPipeline) return Promise.resolve(whisperPipeline);
  if (whisperLoadPromise) return whisperLoadPromise;

  whisperLoadPromise = import('https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2')
    .then(({ pipeline, env }) => {
      env.allowLocalModels = false;
      return pipeline('automatic-speech-recognition', 'Xenova/whisper-tiny');
    })
    .then(p => { whisperPipeline = p; return p; });

  return whisperLoadPromise;
}

async function startRecording() {
  let stream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch (err) {
    setVoiceStatus(
      err.name === 'NotAllowedError'
        ? '❌ Mic permission denied — allow in browser settings.'
        : '❌ Could not access mic: ' + err.message,
      true
    );
    voiceBtn.classList.remove('recording');
    setTimeout(() => setVoiceStatus('', false), 5000);
    return;
  }

  const mimeType = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus']
    .find(m => MediaRecorder.isTypeSupported(m)) || '';
  mediaRecorder = new MediaRecorder(stream, mimeType ? { mimeType } : {});
  audioChunks = [];

  mediaRecorder.ondataavailable = e => { if (e.data.size > 0) audioChunks.push(e.data); };
  mediaRecorder.onstop = async () => {
    stream.getTracks().forEach(t => t.stop());
    setVoiceStatus('⏳ Transcribing...', true);
    try {
      const blob = new Blob(audioChunks, { type: mimeType || 'audio/webm' });
      const arrayBuffer = await blob.arrayBuffer();
      const audioCtx = new AudioContext({ sampleRate: 16000 });
      const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
      const float32Audio = audioBuffer.getChannelData(0);

      const result = await whisperPipeline(float32Audio, { language: 'english', task: 'transcribe' });
      const text = (result.text || '').trim();

      if (text) {
        userInput.value = userInput.value ? userInput.value + ' ' + text : text;
        userInput.style.height = 'auto';
        userInput.style.height = userInput.scrollHeight + 'px';
        setVoiceStatus('✅ Done — press Send', true);
      } else {
        setVoiceStatus('⚠️ No speech detected', true);
      }
    } catch (err) {
      setVoiceStatus('❌ Transcription failed: ' + err.message, true);
    }
    setTimeout(() => setVoiceStatus('', false), 3000);
  };

  mediaRecorder.start(100);
  isRecording = true;
  voiceBtn.classList.add('recording');
  setVoiceStatus('🔴 Recording — click mic to stop');
}

voiceBtn.addEventListener('click', async e => {
  e.preventDefault();
  e.stopPropagation();
  const now = Date.now();
  if (voiceBtn._lastClick && now - voiceBtn._lastClick < 400) return;
  voiceBtn._lastClick = now;

  if (isRecording) {
    isRecording = false;
    voiceBtn.classList.remove('recording');
    if (mediaRecorder && mediaRecorder.state !== 'inactive') mediaRecorder.stop();
    return;
  }

  voiceBtn.classList.add('recording');
  setVoiceStatus(
    whisperPipeline
      ? '⏳ Starting mic...'
      : '⏳ Loading speech model (~80MB, cached after first load)...',
    true
  );

  try {
    await loadWhisper();
    await startRecording();
  } catch (err) {
    voiceBtn.classList.remove('recording');
    setVoiceStatus('❌ Could not load speech model — check your connection.', true);
    setTimeout(() => setVoiceStatus('', false), 6000);
  }
});

// ─── TTS (Browser Web Speech Synthesis) ──────────────────────────────────────
function speakText(text) {
  if (!window.speechSynthesis) return;

  // Stop existing speech
  window.speechSynthesis.cancel();

  // Clean markdown and base64 from text
  const clean = text
    .replace(/!\[.*?\]\(.*?\)/g, '[image]')
    .replace(/data:[a-z/+]+;base64,[A-Za-z0-9+/=]*/g, '[media]')
    .replace(/[*#`_~>\-]/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/\n+/g, ' ')
    .trim();

  if (!clean) return;

  const utterance = new SpeechSynthesisUtterance(clean);

  // Prefer a clear natural voice if available
  const voices = window.speechSynthesis.getVoices();
  const preferred = voices.find(v =>
    v.lang.startsWith('en') && (v.name.includes('Google') || v.name.includes('Natural') || v.name.includes('Enhanced'))
  ) || voices.find(v => v.lang.startsWith('en'));
  if (preferred) utterance.voice = preferred;

  utterance.rate = 1.0;
  utterance.pitch = 1.0;
  utterance.volume = 1.0;

  currentSpeechUtterance = utterance;
  window.speechSynthesis.speak(utterance);
  return utterance;
}

function speakMessage(text, buttonEl) {
  if (window.speechSynthesis && window.speechSynthesis.speaking) {
    window.speechSynthesis.cancel();
    if (buttonEl) { buttonEl.textContent = '🔊 Speak'; buttonEl.classList.remove('speaking'); }
    return;
  }

  const utterance = speakText(text);
  if (!utterance) return;
  if (buttonEl) {
    buttonEl.textContent = '⏹ Stop';
    buttonEl.classList.add('speaking');
    utterance.onend = () => { buttonEl.textContent = '🔊 Speak'; buttonEl.classList.remove('speaking'); };
    utterance.onerror = () => { buttonEl.textContent = '🔊 Speak'; buttonEl.classList.remove('speaking'); };
  }
}

// ─── Conversations / History ──────────────────────────────────────────────────
async function loadConversations() {
  try {
    const res = await fetch('/api/conversations');
    const list = await res.json();
    chatList.innerHTML = '';
    list.forEach(thread => {
      const li = document.createElement('li');
      li.className = `chat-item ${thread.id === activeConversationId ? 'active' : ''}`;
      li.setAttribute('data-id', thread.id);
      li.innerHTML = `<span>${escapeHtml(thread.title)}</span><button class="delete-thread-btn" title="Delete">&times;</button>`;
      li.addEventListener('click', e => {
        if (e.target.classList.contains('delete-thread-btn')) { e.stopPropagation(); deleteThread(thread.id); }
        else selectConversation(thread.id, thread.title);
      });
      chatList.appendChild(li);
    });
  } catch (err) {
    console.error('Failed to load conversations:', err);
  }
}

async function selectConversation(id, title) {
  if (isStreaming) return;
  activeConversationId = id;
  chatTitle.innerText = title;
  document.querySelectorAll('.chat-item').forEach(i =>
    i.classList.toggle('active', i.getAttribute('data-id') === id)
  );

  try {
    const res = await fetch(`/api/conversations/${id}/messages`);
    const messages = await res.json();
    messagesContainer.innerHTML = '';
    if (messages.length === 0) { initNewChat(); return; }
    messages.forEach(msg => appendMessageToDOM(msg.role, msg.content, msg.id));
    scrollToBottom();
  } catch (err) {
    console.error('Failed to load messages:', err);
  }
}

async function deleteThread(id) {
  if (!confirm('Delete this conversation?')) return;
  try {
    await fetch(`/api/conversations/${id}`, { method: 'DELETE' });
    if (activeConversationId === id) initNewChat();
    loadConversations();
  } catch (err) {
    console.error('Failed to delete thread:', err);
  }
}

// ─── Message DOM ──────────────────────────────────────────────────────────────
function appendMessageToDOM(role, text, id = null) {
  const welcome = document.getElementById('welcomeScreen');
  if (welcome) welcome.remove();

  const wrapper = document.createElement('div');
  wrapper.className = `message-wrapper ${role}`;
  if (id) wrapper.setAttribute('data-msg-id', id);

  const content = document.createElement('div');
  content.className = 'message-content';
  content.innerHTML = formatMarkdown(text);
  wrapper.appendChild(content);

  const actions = document.createElement('div');
  actions.className = 'message-actions';

  if (role === 'user') {
    const editBtn = document.createElement('span');
    editBtn.className = 'action-link edit';
    editBtn.textContent = 'Edit';
    editBtn.addEventListener('click', () => startEditPrompt(id, wrapper));
    actions.appendChild(editBtn);
  } else {
    const regenBtn = document.createElement('span');
    regenBtn.className = 'action-link regenerate';
    regenBtn.textContent = 'Regenerate';
    regenBtn.addEventListener('click', () => regenerateLastResponse());
    actions.appendChild(regenBtn);

    const speakBtn = document.createElement('span');
    speakBtn.className = 'action-link speak';
    speakBtn.textContent = '🔊 Speak';
    speakBtn.addEventListener('click', () => speakMessage(text, speakBtn));
    actions.appendChild(speakBtn);
  }

  wrapper.appendChild(actions);
  messagesContainer.appendChild(wrapper);
  scrollToBottom();
  return content;
}

function formatMarkdown(text) {
  let html = '';
  if (typeof marked !== 'undefined') {
    marked.setOptions({ breaks: true, gfm: true });
    html = marked.parse(text);
  } else {
    html = escapeHtml(text).replace(/\n/g, '<br>');
  }

  // Render inline base64 images
  html = html.replace(/data:image\/([a-zA-Z+]*);base64,([A-Za-z0-9+/=]+)/g, match =>
    `<div class="chat-media-preview"><img src="${match}" alt="Image" class="chat-image-attachment"></div>`
  );

  // Render inline base64 audio
  html = html.replace(/data:audio\/([a-zA-Z0-9+]*);base64,([A-Za-z0-9+/=]+)/g, match =>
    `<div class="chat-media-preview"><audio src="${match}" controls class="chat-audio-attachment"></audio></div>`
  );

  return html;
}

// ─── Image Generation Flow ────────────────────────────────────────────────────
async function handleImageGeneration(prompt, modelId) {
  const [w, h] = (imageSize.value || '512x512').split('x').map(Number);
  const inputImageBase64 = attachedFile?.isImage ? attachedFile.base64.split(',')[1] : null;

  appendMessageToDOM('user', prompt);
  const responseBubble = appendMessageToDOM('model', '...');
  clearAttachment();

  try {
    isStreaming = true;
    sendBtn.disabled = true;
    responseBubble.innerHTML = '<div class="generating-indicator"><span></span><span></span><span></span></div>';

    const response = await fetch('/api/generate-image', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt,
        modelName: modelId,
        inputImage: inputImageBase64,
        width: w,
        height: h
      })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Image generation failed');
    }

    // Handle various response formats
    let imageBase64 = null;
    if (data.images && data.images[0]) {
      imageBase64 = data.images[0];
    } else if (data.output_image) {
      imageBase64 = data.output_image;
    } else if (data.base64) {
      imageBase64 = data.base64;
    } else if (data.image) {
      imageBase64 = data.image;
    }

    if (imageBase64) {
      const src = imageBase64.startsWith('data:') ? imageBase64 : `data:image/png;base64,${imageBase64}`;
      const sourceLabel = data.source === 'pollinations.ai' ? ' (via Pollinations.ai)' : '';
      responseBubble.innerHTML = `
        <div class="chat-media-preview">
          <img src="${src}" alt="Generated image" class="chat-image-attachment generated">
          <div class="image-caption">Generated${sourceLabel}: ${escapeHtml(prompt)}</div>
        </div>`;
    } else {
      responseBubble.innerHTML = `<pre class="image-raw-response">${escapeHtml(JSON.stringify(data, null, 2))}</pre>`;
    }

  } catch (err) {
    responseBubble.innerHTML = `<span class="error-text">Image generation error: ${escapeHtml(err.message)}</span>`;
  } finally {
    isStreaming = false;
    sendBtn.disabled = false;
    await loadConversations();
  }
}

// ─── Chat Submit ──────────────────────────────────────────────────────────────
async function handleFormSubmit(e) {
  if (e) e.preventDefault();
  const text = userInput.value.trim();
  if ((!text && !attachedFile) || isStreaming) return;

  userInput.value = '';
  userInput.style.height = 'auto';

  const modelId = modelSelect.value;

  // Route to image generation for image/video gen models
  if (isImageGenModel()) {
    return handleImageGeneration(text, modelId);
  }

  let fullMessage = text;
  let effectiveModel = modelId;
  const pendingImage = attachedFile?.isImage ? attachedFile : null;
  clearAttachment();

  // Handle image: auto-switch to Qwen VL
  if (pendingImage) {
    const VISION_MODEL = 'qwen.qwen3-vl-235b-a22b';
    if (getCurrentModelType() !== 'vision') {
      effectiveModel = VISION_MODEL;
      showToast('Switched to Qwen VL for image analysis');
    }
    fullMessage = `${text}\n\n${pendingImage.base64}`;
  }

  appendMessageToDOM('user', fullMessage);
  const responseBubble = appendMessageToDOM('model', '...');

  try {
    isStreaming = true;
    sendBtn.disabled = true;

    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conversationId: activeConversationId, message: fullMessage, modelName: effectiveModel })
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || 'Chat API failed');
    }

    const responseText = await readStream(response, responseBubble);
    isStreaming = false;

    // Auto-TTS if enabled
    if (autoTtsToggle.checked && responseText) {
      speakText(responseText);
    }

    await loadConversations();
    await selectConversation(activeConversationId, chatTitle.innerText);

  } catch (err) {
    responseBubble.innerHTML = `<span class="error-text">Error: ${escapeHtml(err.message)}</span>`;
  } finally {
    isStreaming = false;
    sendBtn.disabled = false;
  }
}

// ─── SSE Stream Reader ────────────────────────────────────────────────────────
async function readStream(response, bubbleElement) {
  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let accumulated = '';
  bubbleElement.innerHTML = '';

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    const chunk = decoder.decode(value);
    for (const line of chunk.split('\n')) {
      if (!line.startsWith('data: ')) continue;
      const payload = line.slice(6).trim();
      if (payload === '[DONE]') break;
      try {
        const parsed = JSON.parse(payload);
        if (parsed.error) { bubbleElement.innerHTML = `<span class="error-text">Error: ${escapeHtml(parsed.error)}</span>`; return ''; }
        if (parsed.text) { accumulated += parsed.text; bubbleElement.innerHTML = formatMarkdown(accumulated); scrollToBottom(); }
      } catch (_) {}
    }
  }
  return accumulated;
}

// ─── Edit & Regenerate ────────────────────────────────────────────────────────
function startEditPrompt(messageId, wrapper) {
  if (isStreaming) return;
  const contentEl = wrapper.querySelector('.message-content');
  const originalText = contentEl.innerText;
  contentEl.innerHTML = '';

  const textarea = document.createElement('textarea');
  textarea.className = 'edit-textarea';
  textarea.value = originalText;
  contentEl.appendChild(textarea);

  const actionsDiv = document.createElement('div');
  actionsDiv.className = 'edit-actions';

  const cancelBtn = document.createElement('button');
  cancelBtn.className = 'edit-btn cancel';
  cancelBtn.textContent = 'Cancel';
  cancelBtn.addEventListener('click', () => { contentEl.innerHTML = formatMarkdown(originalText); });

  const saveBtn = document.createElement('button');
  saveBtn.className = 'edit-btn';
  saveBtn.textContent = 'Save & Submit';
  saveBtn.addEventListener('click', () => submitEdit(messageId, textarea.value.trim(), wrapper));

  actionsDiv.appendChild(cancelBtn);
  actionsDiv.appendChild(saveBtn);
  contentEl.appendChild(actionsDiv);
}

async function submitEdit(messageId, newContent, wrapper) {
  if (!newContent || isStreaming) return;

  let next = wrapper.nextElementSibling;
  while (next) { const r = next; next = next.nextElementSibling; r.remove(); }

  wrapper.querySelector('.message-content').innerHTML = formatMarkdown(newContent);
  const responseBubble = appendMessageToDOM('model', '...');

  try {
    isStreaming = true;
    sendBtn.disabled = true;

    const response = await fetch('/api/chat/edit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conversationId: activeConversationId, messageId, newContent, modelName: modelSelect.value })
    });

    if (!response.ok) { const err = await response.json(); throw new Error(err.error || 'Edit failed'); }

    const responseText = await readStream(response, responseBubble);
    isStreaming = false;
    if (autoTtsToggle.checked && responseText) speakText(responseText);
    await loadConversations();
    await selectConversation(activeConversationId, chatTitle.innerText);
  } catch (err) {
    responseBubble.innerHTML = `<span class="error-text">Error: ${escapeHtml(err.message)}</span>`;
  } finally {
    isStreaming = false;
    sendBtn.disabled = false;
  }
}

async function regenerateLastResponse() {
  if (isStreaming) return;
  const lastBubble = messagesContainer.lastElementChild;
  if (!lastBubble?.classList.contains('model')) { alert('Last message is not an AI response.'); return; }
  lastBubble.remove();

  const responseBubble = appendMessageToDOM('model', '...');

  try {
    isStreaming = true;
    sendBtn.disabled = true;

    const response = await fetch('/api/chat/regenerate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conversationId: activeConversationId, modelName: modelSelect.value })
    });

    if (!response.ok) { const err = await response.json(); throw new Error(err.error || 'Regenerate failed'); }

    const responseText = await readStream(response, responseBubble);
    isStreaming = false;
    if (autoTtsToggle.checked && responseText) speakText(responseText);
    await loadConversations();
    await selectConversation(activeConversationId, chatTitle.innerText);
  } catch (err) {
    responseBubble.innerHTML = `<span class="error-text">Error: ${escapeHtml(err.message)}</span>`;
  } finally {
    isStreaming = false;
    sendBtn.disabled = false;
  }
}

// ─── Auto-resize textarea ─────────────────────────────────────────────────────
userInput.addEventListener('input', () => {
  userInput.style.height = 'auto';
  userInput.style.height = userInput.scrollHeight + 'px';
});

userInput.addEventListener('keydown', e => {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); chatForm.dispatchEvent(new Event('submit')); }
});

// ─── Event Bindings ───────────────────────────────────────────────────────────
chatForm.addEventListener('submit', handleFormSubmit);
newChatBtn.addEventListener('click', initNewChat);
toggleSidebarBtn.addEventListener('click', () => sidebar.classList.toggle('collapsed'));

document.getElementById('clearAllBtn').addEventListener('click', async () => {
  if (!confirm('Delete ALL conversations? This cannot be undone.')) return;
  try {
    const res = await fetch('/api/conversations');
    const list = await res.json();
    await Promise.all(list.map(t => fetch(`/api/conversations/${t.id}`, { method: 'DELETE' })));
    initNewChat();
    loadConversations();
  } catch (err) {
    console.error('Clear all failed:', err);
  }
});

// Preload voices for TTS
if (window.speechSynthesis) {
  window.speechSynthesis.onvoiceschanged = () => window.speechSynthesis.getVoices();
  window.speechSynthesis.getVoices();
}

// ─── Initialize ───────────────────────────────────────────────────────────────
activeConversationId = generateUUID();
updateModelUI();
loadConversations();
