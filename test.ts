import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: "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",
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
