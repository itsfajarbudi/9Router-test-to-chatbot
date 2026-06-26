const { OpenAI } = require('openai');

async function test() {
  const apiKey = 'sk-ws-H.RYRHYLY.V82a.MEUCIQCjDktEgr5hZ3Co3LQkfM5ekz-seURfMHEekNBWZ7fc_wlgZyFQWyoQRpngr373dLfHZX55QfY3Il9COauVUetjCe0';
  const openai = new OpenAI({ 
    apiKey: apiKey, 
    baseURL: 'https://ws-k6d35118uujugt6w.cn-beijing.maas.aliyuncs.com/compatible-mode/v1' 
  });
  
  const modelsToTest = ['qwen-plus', 'qwen-max', 'qwen-turbo', 'qwen3.7-max', 'qwen-long'];
  
  for (const model of modelsToTest) {
    try {
      console.log(`Testing model: ${model}...`);
      const response = await openai.chat.completions.create({
        messages: [{ role: 'user', content: 'hello' }],
        model: model,
        max_tokens: 10
      });
      console.log(`SUCCESS with ${model}:`, response.choices[0].message.content);
      return; // Stop on first success
    } catch (e) {
      console.error(`FAILED with ${model}:`, e.message);
    }
  }
}
test();
