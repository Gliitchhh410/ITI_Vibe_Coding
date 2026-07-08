import dotenv from 'dotenv';
dotenv.config();

async function runRealAudioTest() {
  console.log("=== TESTING REAL VOICE AUDIO WITH VOXTRAL ===");
  
  try {
    const audioUrl = 'https://www.w3schools.com/html/horse.mp3';
    console.log("Downloading real MP3 file from:", audioUrl);
    
    const res = await fetch(audioUrl);
    console.log("Download Status:", res.status, res.statusText);
    if (!res.ok) throw new Error("Failed to download audio");
    
    const arrayBuffer = await res.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const audioBase64 = `data:audio/mpeg;base64,${buffer.toString('base64')}`;
    console.log("Downloaded MP3. Base64 length:", audioBase64.length);

    const payload = {
      model_id: 'mistral.voxtral-small-24b-2507',
      messages: [
        {
          role: 'user',
          content: `Transcribe the sound or spoken words in this audio file: ${audioBase64}`
        }
      ],
      system_prompt: "You are a transcription machine. Output the transcription.",
      max_tokens: 100
    };

    console.log("Sending payload to gateway...");
    const response = await fetch('http://apiaccess.iti.net.eg/api/v1/student/chat', {
      method: 'POST',
      headers: {
        "Authorization": `Bearer ${process.env.SBG_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    console.log("Status:", response.status);
    const data = await response.json();
    console.log("Response:", JSON.stringify(data));
  } catch (err) {
    console.error("Test failed:", err);
  }
}

runRealAudioTest();
