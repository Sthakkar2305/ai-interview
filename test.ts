import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY || process.env.NVIDIA_API_KEY || "",
  baseURL: "https://integrate.api.nvidia.com/v1",
});

async function test() {
  try {
    const completion = await openai.chat.completions.create({
      model: "meta/llama-3.1-70b-instruct",
      messages: [{ role: "user", content: "hello" }],
    });
    console.log("Success!", completion.choices[0].message.content);
  } catch (e: any) {
    console.error("Error:", e.message);
    if (e.response) {
      console.error(await e.response.text());
    }
  }
}

test();
