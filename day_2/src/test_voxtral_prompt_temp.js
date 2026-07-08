import dotenv from 'dotenv';
dotenv.config();

const tinyWavBase64 = "data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAAA";

const promptVariations = [
  {
    name: "Variation 1: Machine STT Command",
    system_prompt: "You are an automated Speech-to-Text system. You only output the transcript of the audio. Do not greet. Do not chat. Output empty string if silent.",
    content: `Transcript of the following audio:\n\n${tinyWavBase64}`
  },
  {
    name: "Variation 2: Short Prefix",
    system_prompt: "You are an accurate Speech-to-Text transcriber. Output only the spoken words. Never explain or talk.",
    content: `[AUDIO]\n${tinyWavBase64}\n[TRANSCRIPT]`
  },
  {
    name: "Variation 3: Simple Content-Only",
    system_prompt: "You are an offline STT compiler. You listen to the file and print the transcript. If there is no speech, write nothing.",
    content: `${tinyWavBase64}`
  }
];

async function testPrompts() {
  console.log("=== TESTING PROMPT VARIATIONS FOR STRICT STT ===");

  for (const item of promptVariations) {
    console.log(`\n--- Running: ${item.name} ---`);
    
    const payload = {
      model_id: 'mistral.voxtral-small-24b-2507',
      messages: [
        {
          role: 'user',
          content: item.content
        }
      ],
      system_prompt: item.system_prompt,
      max_tokens: 50
    };

    try {
      const response = await fetch('http://apiaccess.iti.net.eg/api/v1/student/chat', {
        method: 'POST',
        headers: {
          "Authorization": `Bearer ${process.env.SBG_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });

      const resData = await response.json();
      console.log("Output Text:", JSON.stringify(resData.output_text));
    } catch (err) {
      console.error("Failed:", err.message);
    }
  }
}

testPrompts();
