// State management
let activeConversationId = null;
let isStreaming = false;

// DOM Elements
const sidebar = document.getElementById('sidebar');
const chatList = document.getElementById('chatList');
const newChatBtn = document.getElementById('newChatBtn');
const toggleSidebarBtn = document.getElementById('toggleSidebarBtn');
const chatTitle = document.getElementById('chatTitle');
const messagesContainer = document.getElementById('messagesContainer');
const welcomeScreen = document.getElementById('welcomeScreen');
const chatForm = document.getElementById('chatForm');
const userInput = document.getElementById('userInput');
const sendBtn = document.getElementById('sendBtn');
const modelSelect = document.getElementById('modelSelect');

// Generate unique session IDs
function generateUUID() {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 7);
}

// Start a fresh conversation
function initNewChat() {
  activeConversationId = generateUUID();
  messagesContainer.innerHTML = `
    <div class="welcome-screen" id="welcomeScreen">
      <h1>Gemini Chat</h1>
      <p>How can I help you today?</p>
    </div>
  `;
  chatTitle.innerText = "New Conversation";
  
  // Highlight active item if any
  document.querySelectorAll('.chat-item').forEach(item => item.classList.remove('active'));
}

// Fetch and render conversations in the sidebar
async function loadConversations() {
  try {
    const res = await fetch('/api/conversations');
    const list = await res.json();
    chatList.innerHTML = '';

    list.forEach(thread => {
      const li = document.createElement('li');
      li.className = `chat-item ${thread.id === activeConversationId ? 'active' : ''}`;
      li.setAttribute('data-id', thread.id);
      
      li.innerHTML = `
        <span>${escapeHtml(thread.title)}</span>
        <button class="delete-thread-btn" title="Delete conversation">&times;</button>
      `;

      // Load thread on click
      li.addEventListener('click', (e) => {
        if (e.target.classList.contains('delete-thread-btn')) {
          e.stopPropagation();
          deleteThread(thread.id);
        } else {
          selectConversation(thread.id, thread.title);
        }
      });

      chatList.appendChild(li);
    });
  } catch (error) {
    console.error("Failed to load conversations:", error);
  }
}

// Select and restore a conversation
async function selectConversation(id, title) {
  if (isStreaming) return;
  activeConversationId = id;
  chatTitle.innerText = title;
  
  // Update sidebar selection visual
  document.querySelectorAll('.chat-item').forEach(item => {
    item.classList.toggle('active', item.getAttribute('data-id') === id);
  });

  try {
    const res = await fetch(`/api/conversations/${id}/messages`);
    const messages = await res.json();
    messagesContainer.innerHTML = '';

    if (messages.length === 0) {
      initNewChat();
      return;
    }

    messages.forEach(msg => {
      appendMessageToDOM(msg.role, msg.content, msg.id);
    });

    scrollToBottom();
  } catch (error) {
    console.error("Failed to load messages:", error);
  }
}

// Delete a conversation thread
async function deleteThread(id) {
  if (confirm("Are you sure you want to delete this chat thread?")) {
    try {
      await fetch(`/api/conversations/${id}`, { method: 'DELETE' });
      if (activeConversationId === id) {
        initNewChat();
      }
      loadConversations();
    } catch (error) {
      console.error("Failed to delete thread:", error);
    }
  }
}

// Appends message block to the container UI
function appendMessageToDOM(role, text, id = null) {
  // Clear welcome screen on first message
  const welcome = document.getElementById('welcomeScreen');
  if (welcome) welcome.remove();
  const wrapper = document.createElement('div');
  wrapper.className = `message-wrapper ${role}`;
  if (id) wrapper.setAttribute('data-msg-id', id);
  const content = document.createElement('div');
  content.className = 'message-content';
  content.innerHTML = formatMarkdown(text);
  wrapper.appendChild(content);
  // Add Action buttons (Edit for User, Regenerate for Model)
  const actions = document.createElement('div');
  actions.className = 'message-actions';
  
  if (role === 'user') {
    const editBtn = document.createElement('span');
    editBtn.className = 'action-link edit';
    editBtn.innerText = 'Edit';
    // Bind click event listener directly (no onclick inline attribute)
    editBtn.addEventListener('click', () => startEditPrompt(id, wrapper));
    actions.appendChild(editBtn);
  } else {
    const regenBtn = document.createElement('span');
    regenBtn.className = 'action-link regenerate';
    regenBtn.innerText = 'Regenerate';
    regenBtn.addEventListener('click', () => regenerateLastResponse());
    actions.appendChild(regenBtn);
  }
  wrapper.appendChild(actions);
  messagesContainer.appendChild(wrapper);
  scrollToBottom();
  return content;
}

// Send standard message stream request
async function handleFormSubmit(e) {
  if (e) e.preventDefault();
  const text = userInput.value.trim();
  if (!text || isStreaming) return;

  userInput.value = '';
  userInput.style.height = 'auto'; // Reset text area height
  
  // Append user message in UI
  appendMessageToDOM('user', text);
  
  // Append AI message container with loading indicator
  const responseBubble = appendMessageToDOM('model', '...');
  
  try {
    isStreaming = true;
    sendBtn.disabled = true;

    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        conversationId: activeConversationId,
        message: text,
        modelName: modelSelect.value
      })
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || "Failed to call chat api");
    }

    await readStream(response, responseBubble);
    isStreaming = false; // Disable streaming flag before calling selectConversation
    await loadConversations();
    // Sync database IDs to the UI elements
    await selectConversation(activeConversationId, chatTitle.innerText);

  } catch (error) {
    responseBubble.innerHTML = `<span style="color: var(--danger-color)">Error: ${error.message}</span>`;
  } finally {
    isStreaming = false;
    sendBtn.disabled = false;
  }
}



// SSE stream reader using Fetch + ReadableStream
async function readStream(response, bubbleElement) {
  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let accumulatedText = '';
  bubbleElement.innerHTML = ''; // Clear loading dots

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;

    const chunk = decoder.decode(value);
    const lines = chunk.split('\n');

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const payload = line.replace('data: ', '').trim();
        
        if (payload === '[DONE]') {
          break;
        }

        try {
          const parsed = JSON.parse(payload);
          if (parsed.error) {
            bubbleElement.innerHTML = `<span style="color: var(--danger-color)">Error: ${parsed.error}</span>`;
            return;
          }
          if (parsed.text) {
            accumulatedText += parsed.text;
            bubbleElement.innerHTML = formatMarkdown(accumulatedText);
            scrollToBottom();
          }
        } catch (err) {
          // Keep reading if parsing hits trailing splits
        }
      }
    }
  }
}


function formatMarkdown(text) {
  if (typeof marked !== 'undefined') {
    // Set options to break lines on \n
    marked.setOptions({
      breaks: true,
      gfm: true
    });
    return marked.parse(text);
  }
  
  // Fallback if library fails to load
  return escapeHtml(text).replace(/\n/g, '<br>');
}

function escapeHtml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function scrollToBottom() {
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// Auto-expand textarea height based on typing
userInput.addEventListener('input', () => {
  userInput.style.height = 'auto';
  userInput.style.height = userInput.scrollHeight + 'px';
});

// Keyboard listeners: Enter sends, Shift+Enter newlines
userInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    chatForm.dispatchEvent(new Event('submit'));
  }
});

// Binding control button actions
chatForm.addEventListener('submit', handleFormSubmit);
newChatBtn.addEventListener('click', initNewChat);
toggleSidebarBtn.addEventListener('click', () => {
  sidebar.classList.toggle('collapsed');
});

// Start application
activeConversationId = generateUUID();
loadConversations();



// Local handlers (no longer need window. prefix since we bind directly)
function startEditPrompt(messageId, wrapper) {
  if (isStreaming) return;
  const contentEl = wrapper.querySelector('.message-content');
  const originalText = getOriginalTextFromDOM(contentEl);
  contentEl.innerHTML = '';
  const textarea = document.createElement('textarea');
  textarea.className = 'edit-textarea';
  textarea.value = originalText;
  contentEl.appendChild(textarea);
  const actionsDiv = document.createElement('div');
  actionsDiv.className = 'edit-actions';
  const cancelBtn = document.createElement('button');
  cancelBtn.className = 'edit-btn cancel';
  cancelBtn.innerText = 'Cancel';
  cancelBtn.addEventListener('click', () => {
    contentEl.innerHTML = formatMarkdown(originalText);
  });
  const saveBtn = document.createElement('button');
  saveBtn.className = 'edit-btn';
  saveBtn.innerText = 'Save & Submit';
  saveBtn.addEventListener('click', () => {
    submitEdit(messageId, textarea.value.trim(), wrapper);
  });

  actionsDiv.appendChild(cancelBtn);
  actionsDiv.appendChild(saveBtn);
  contentEl.appendChild(actionsDiv);
}

async function submitEdit(messageId, newContent, wrapper) {
  if (!newContent || isStreaming) return;

  // 1. Remove all succeeding message bubbles in the UI
  let nextEl = wrapper.nextElementSibling;
  while (nextEl) {
    const toRemove = nextEl;
    nextEl = nextEl.nextElementSibling;
    toRemove.remove();
  }

  // Update current message bubble in UI
  const contentEl = wrapper.querySelector('.message-content');
  contentEl.innerHTML = formatMarkdown(newContent);

  // Append new model message loading bubble
  const responseBubble = appendMessageToDOM('model', '...');

  try {
    isStreaming = true;
    sendBtn.disabled = true;

    // Send edit query to backend
    const response = await fetch('/api/chat/edit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        conversationId: activeConversationId,
        messageId: messageId,
        newContent: newContent,
        modelName: modelSelect.value
      })
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || "Failed to process edit");
    }

    await readStream(response, responseBubble);
    isStreaming = false; // Disable streaming flag
    
    // Sync thread IDs
    await loadConversations();
    await selectConversation(activeConversationId, chatTitle.innerText);

  } catch (error) {
    responseBubble.innerHTML = `<span style="color: var(--danger-color)">Error: ${error.message}</span>`;
  } finally {
    isStreaming = false;
    sendBtn.disabled = false;
  }
}

async function regenerateLastResponse() {
  if (isStreaming) return;

  // Get the last bubble
  const lastBubble = messagesContainer.lastElementChild;
  if (!lastBubble || !lastBubble.classList.contains('model')) {
    alert("Last message is not an AI message to regenerate");
    return;
  }

  // Remove the last model bubble in the UI
  lastBubble.remove();

  // Append a fresh model loading bubble
  const responseBubble = appendMessageToDOM('model', '...');

  try {
    isStreaming = true;
    sendBtn.disabled = true;

    const response = await fetch('/api/chat/regenerate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        conversationId: activeConversationId,
        modelName: modelSelect.value
      })
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || "Failed to regenerate");
    }

    await readStream(response, responseBubble);
    isStreaming = false;

    // Sync database IDs to the UI elements
    await loadConversations();
    await selectConversation(activeConversationId, chatTitle.innerText);

  } catch (error) {
    responseBubble.innerHTML = `<span style="color: var(--danger-color)">Error: ${error.message}</span>`;
  } finally {
    isStreaming = false;
    sendBtn.disabled = false;
  }
}

// Helper to reverse formatMarkdown and extract raw text from bubble
function getOriginalTextFromDOM(contentEl) {
  // If there's a code block, get its text, otherwise get innerText
  const codeBlock = contentEl.querySelector('pre code');
  if (codeBlock) {
    return codeBlock.innerText;
  }
  return contentEl.innerText;
}