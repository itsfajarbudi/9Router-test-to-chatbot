async function test() {
  const res = await fetch("https://9-router-test-to-chatbot.vercel.app/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": "Bearer portofolio-fajar",
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: "auto",
      messages: [{role: "user", content: "hi"}]
    })
  });
  console.log("Status:", res.status);
  console.log("Body:", await res.text());
}
test();
