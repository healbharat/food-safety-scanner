const API_KEY = "AIzaSyAiwJm7hIjCYyD-qSGe7Kf_MkUL4wPT2SQ";
async function checkModels() {
  const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${API_KEY}`;
  try {
    const response = await fetch(url);
    const data = await response.json();
    if (data.models) {
      data.models.forEach(m => console.log(m.name));
    } else {
      console.log("No models found or error:", JSON.stringify(data));
    }
  } catch (error) {
    console.error("Error fetching models:", error);
  }
}
checkModels();
