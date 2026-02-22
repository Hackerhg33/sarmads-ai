// ================= CONFIG =================
let API_KEY = localStorage.getItem("gemini_api_key") || "";
const MODEL = "gemini-2.0-flash-exp";

// ================= DOM ELEMENTS =================
const orb = document.getElementById("orb");
const statusText = document.getElementById("status");
const btn = document.getElementById("btn");
const keyStatus = document.getElementById("keyStatus");
const apiPanel = document.getElementById("apiPanel");
const apiInput = document.getElementById("apiKeyInput");

let recognition;

// ================= INITIAL CHECK =================
updateKeyStatus();

if(!API_KEY) {
    setTimeout(() => {
        apiPanel.style.display = 'block';
    }, 1000);
}

// ================= API KEY FUNCTIONS =================
function showApiPanel() {
    apiPanel.style.display = 'block';
    if(API_KEY) apiInput.value = API_KEY;
}

function hideApiPanel() {
    apiPanel.style.display = 'none';
}

function updateKeyStatus() {
    if(API_KEY) {
        keyStatus.innerHTML = '✓ KEY SET';
        keyStatus.style.color = '#00ffaa';
    } else {
        keyStatus.innerHTML = '⚡ NO KEY';
        keyStatus.style.color = '#ffaa00';
    }
}

function saveApiKey() {
    let key = apiInput.value.trim();
    if(key) {
        API_KEY = key;
        localStorage.setItem("gemini_api_key", key);
        hideApiPanel();
        updateKeyStatus();
        statusText.innerText = "✅ API Key saved! Initialize system.";
        speak("API key saved");
    } else {
        alert("Please enter a valid API key");
    }
}

async function testApiKey() {
    let key = apiInput.value.trim();
    if(!key) {
        alert("Enter a key first");
        return;
    }
    
    statusText.innerText = "🔄 Testing API key...";
    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1/models?key=${key}`);
        const data = await response.json();
        
        if(data.error) {
            alert("❌ Invalid key: " + data.error.message);
            statusText.innerText = "❌ API key invalid";
        } else {
            alert("✅ API key works! Ready to use.");
            statusText.innerText = "✅ API key valid!";
        }
    } catch(e) {
        alert("Error testing key: " + e.message);
    }
}

function showInstructions() {
    alert(
        "📱 HOW TO SHARE THIS APP:\n\n" +
        "1. Upload both files to GitHub:\n" +
        "   - index.html\n" +
        "   - app.js\n\n" +
        "2. Enable GitHub Pages in repository Settings\n\n" +
        "3. Share the URL:\n" +
        "   https://[username].github.io/[repo-name]\n\n" +
        "4. Users need their own API key (free from Google)"
    );
}

// ================= MEMORY SYSTEM =================
let memory = JSON.parse(localStorage.getItem("sarmadAI_Memory")) || {
    facts: {},
    customReplies: {},
    history: []
};

function saveMemory(){
    localStorage.setItem("sarmadAI_Memory", JSON.stringify(memory));
}

// ================= VOICE OUTPUT =================
function speak(text){
    window.speechSynthesis.cancel();
    const speech = new SpeechSynthesisUtterance(text);
    speech.rate = 1;
    speech.pitch = 0.9;
    speech.volume = 1;
    window.speechSynthesis.speak(speech);
}

// ================= BOOT SEQUENCE =================
btn.onclick = () => {
    if(!API_KEY) {
        showApiPanel();
        statusText.innerText = "⚠️ Please set API key first";
        return;
    }
    
    if(btn.innerText === "INITIALIZE SYSTEM"){
        boot();
    } else {
        startWakeListening();
    }
};

async function boot(){
    btn.style.display="none";
    orb.classList.add("loading");
    statusText.innerText="⚡ INITIALIZING NEURAL CORE ...";
    await sleep(1300);
    orb.classList.remove("loading");
    statusText.innerText="🟢 ONLINE · SAY 'HELLO' TO ACTIVATE";
    speak("Sarmad's AI is online. Say 'hello' to activate.");
    btn.innerText="🎤 LISTEN";
    btn.style.display="inline-block";
}

// ================= WAKE WORD LISTENER =================
function startWakeListening(){
    if(!API_KEY) {
        showApiPanel();
        statusText.innerText = "⚠️ Set API key first";
        return;
    }
    
    if(!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)){
        statusText.innerText="❌ Voice not supported. Use Chrome/Edge.";
        return;
    }
    
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    recognition = new SpeechRecognition();
    recognition.lang = "en-US";
    recognition.interimResults = false;
    recognition.continuous = false;

    recognition.start();
    orb.classList.add("loading");
    statusText.innerText="🎤 Listening for 'hello'...";

    recognition.onresult = (event)=>{
        let raw = event.results[0][0].transcript;
        let text = raw.toLowerCase();
        orb.classList.remove("loading");

        if(text.includes("hello")){
            orb.classList.add("thinking");
            statusText.innerText="✅ Wake word detected. Processing...";
            let query = text.replace(/hello/gi, "").trim();
            if(query === "") query = "Hello there";
            askGemini(query);
        } else {
            statusText.innerText="⛔ No 'hello' detected. Try again.";
            orb.classList.remove("loading");
        }

        memory.history.push("[wake] "+text);
        if(memory.history.length>50) memory.history.shift();
        saveMemory();
    };

    recognition.onerror = (event)=>{
        orb.classList.remove("loading");
        statusText.innerText="🎙️ Mic error: " + (event.error || 'unknown');
        if(event.error === 'not-allowed') speak("Please allow microphone access.");
    };

    recognition.onend = ()=>{
        orb.classList.remove("loading");
    };
}

// ================= GEMINI API CALL =================
async function askGemini(userText){
    if(!userText || userText.length===0){
        reply("Say something after 'hello'.");
        return;
    }

    // Check memory commands
    if(userText.startsWith("remember that") || userText.includes("store reply")){
        handleMemoryCommand(userText);
        return;
    }
    if(userText.includes("show memory") || userText.includes("list triggers")){
        showMemory();
        return;
    }

    // Check custom replies
    for(let trigger in memory.customReplies){
        if(userText.includes(trigger.toLowerCase())){
            reply(memory.customReplies[trigger]);
            return;
        }
    }

    try{
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1/models/${MODEL}:generateContent?key=${API_KEY}`,
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    contents:[{ parts:[{ text:userText }] }]
                })
            }
        );
        const data = await response.json();

        if(data.error){
            if(data.error.message.includes("API key")) {
                reply("❌ API key invalid. Please check your key.");
                showApiPanel();
            } else {
                reply("⚠️ Error: " + data.error.message.substring(0,60));
            }
            return;
        }

        let replyText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
        reply(replyText || "(no response)");

    } catch(e){
        reply("Connection failed. Offline echo: " + userText);
    }
}

// ================= MEMORY COMMANDS =================
function handleMemoryCommand(cmd){
    let lower = cmd.toLowerCase();
    
    if(lower.includes("remember that")){
        let parts = cmd.split("remember that")[1].split("is");
        if(parts.length>=2){
            let trigger = parts[0].trim();
            let response = parts.slice(1).join("is").trim();
            if(trigger && response){
                memory.customReplies[trigger] = response;
                saveMemory();
                reply(`✅ Stored: "${trigger}" → "${response}"`);
            } else reply("Use: remember that [trigger] is [reply]");
        } else reply("Example: remember that sky is blue");
    }
    else if(lower.includes("store reply")){
        let match = cmd.match(/store reply ["'](.+?)["']\s*=>\s*["'](.+?)["']/);
        if(match){
            memory.customReplies[match[1].toLowerCase()] = match[2];
            saveMemory();
            reply(`✅ Trigger "${match[1]}" stored.`);
        } else reply('Format: store reply "trigger" => "response"');
    }
    else reply("❌ Memory command not recognized");
}

function showMemory(){
    let keys = Object.keys(memory.customReplies);
    reply(keys.length ? "📚 Triggers: " + keys.join(", ") : "📭 No custom memory.");
}

// ================= RESPONSE =================
function reply(text){
    orb.classList.remove("thinking");
    orb.classList.remove("loading");
    statusText.innerText = text;
    speak(text);
}

// ================= UTILITY =================
function sleep(ms){
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Click on orb to listen
orb.addEventListener('click', ()=>{
    if(btn.innerText !== "INITIALIZE SYSTEM") startWakeListening();
});

// Handle speech errors
window.speechSynthesis.onerror = (e)=>{};