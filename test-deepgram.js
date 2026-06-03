import fetch from 'node-fetch';
import dotenv from 'dotenv';
dotenv.config({ path: '.env' });

async function testDeepgram() {
  const url = "https://api.deepgram.com/v1/listen?model=nova-2&smart_format=true&diarize=true";
  
  // Send a tiny empty audio payload just to check authentication/credits
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Authorization": `Token ${process.env.DEEPGRAM_API_KEY}`,
      "Content-Type": "audio/webm",
    },
    body: Buffer.from([]),
  });

  const text = await response.text();
  console.log("Status:", response.status);
  console.log("Response:", text);
}

testDeepgram();
