const COLORS = [
  "#ff6b6b", "#4f7cff", "#ffd23f", "#4fd6a8",
  "#c874ff", "#ff9f4f", "#4fc9ff", "#ff5ca8",
  "#8bd450", "#ff8181"
];

const STORAGE_KEY = "ruleta-preguntas";

let questions = loadQuestions();
let currentRotation = 0;
let spinning = false;

const canvas = document.getElementById("wheel");
const ctx = canvas.getContext("2d");
const questionInput = document.getElementById("questionInput");
const addForm = document.getElementById("addForm");
const questionList = document.getElementById("questionList");
const emptyHint = document.getElementById("emptyHint");
const spinBtn = document.getElementById("spinBtn");
const overlay = document.getElementById("overlay");
const resultText = document.getElementById("resultText");

function loadQuestions() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {}
  return ["x + 3 = 16", "2x = 10", "x - 5 = 7", "3x + 1 = 13"];
}

function saveQuestions() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(questions));
  } catch (e) {}
}

function renderList() {
  questionList.innerHTML = "";
  questions.forEach((q, i) => {
    const li = document.createElement("li");

    const swatch = document.createElement("span");
    swatch.className = "swatch";
    swatch.style.background = COLORS[i % COLORS.length];

    const text = document.createElement("span");
    text.className = "q-text";
    text.textContent = q;

    const delBtn = document.createElement("button");
    delBtn.textContent = "✕";
    delBtn.title = "Eliminar";
    delBtn.addEventListener("click", () => {
      questions.splice(i, 1);
      saveQuestions();
      renderList();
      drawWheel();
    });

    li.appendChild(swatch);
    li.appendChild(text);
    li.appendChild(delBtn);
    questionList.appendChild(li);
  });

  emptyHint.classList.toggle("hidden", questions.length > 0);
  spinBtn.disabled = questions.length < 2 || spinning;
}

function wrapText(ctx, text, maxWidth) {
  const words = text.split(" ");
  const lines = [];
  let line = "";
  for (const word of words) {
    const test = line ? line + " " + word : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function drawWheel() {
  const size = canvas.width;
  const cx = size / 2;
  const cy = size / 2;
  const radius = size / 2;
  ctx.clearRect(0, 0, size, size);

  const n = questions.length;
  if (n === 0) {
    ctx.fillStyle = "#2a2f3f";
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#7a8194";
    ctx.font = "16px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("Agrega preguntas", cx, cy);
    return;
  }

  const seg = (Math.PI * 2) / n;

  questions.forEach((q, i) => {
    const start = i * seg;
    const end = start + seg;

    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, radius, start, end);
    ctx.closePath();
    ctx.fillStyle = COLORS[i % COLORS.length];
    ctx.fill();
    ctx.strokeStyle = "rgba(0,0,0,0.15)";
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(start + seg / 2);
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#1b1f2a";
    ctx.font = "bold 15px sans-serif";
    const lines = wrapText(ctx, q, radius - 40);
    const lineHeight = 17;
    const offsetStart = -((lines.length - 1) * lineHeight) / 2;
    lines.forEach((line, li) => {
      ctx.fillText(line, radius - 18, offsetStart + li * lineHeight);
    });
    ctx.restore();
  });

  ctx.beginPath();
  ctx.arc(cx, cy, 22, 0, Math.PI * 2);
  ctx.fillStyle = "#262b3a";
  ctx.fill();
  ctx.strokeStyle = "#ffd23f";
  ctx.lineWidth = 3;
  ctx.stroke();
}

addForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const value = questionInput.value.trim();
  if (!value) return;
  questions.push(value);
  saveQuestions();
  questionInput.value = "";
  renderList();
  drawWheel();
});

function normalizeDeg(deg) {
  return ((deg % 360) + 360) % 360;
}

spinBtn.addEventListener("click", () => {
  if (spinning || questions.length < 2) return;
  spinning = true;
  spinBtn.disabled = true;

  const n = questions.length;
  const segDeg = 360 / n;
  const targetIndex = Math.floor(Math.random() * n);
  const midDeg = targetIndex * segDeg + segDeg / 2;

  const jitter = (Math.random() - 0.5) * segDeg * 0.6;
  const desiredWorldAngleForMid = 0;
  let neededMod = normalizeDeg(desiredWorldAngleForMid - midDeg - jitter);

  const currentMod = normalizeDeg(currentRotation);
  let delta = normalizeDeg(neededMod - currentMod);
  const extraSpins = 6;
  const newRotation = currentRotation + extraSpins * 360 + delta;

  currentRotation = newRotation;
  canvas.style.transform = `rotate(${newRotation}deg)`;

  const onEnd = () => {
    canvas.removeEventListener("transitionend", onEnd);
    spinning = false;
    spinBtn.disabled = questions.length < 2;
    showResult(questions[targetIndex]);
  };
  canvas.addEventListener("transitionend", onEnd);
});

function showResult(text) {
  resultText.textContent = text;
  overlay.classList.remove("hidden");
}

overlay.addEventListener("click", () => {
  overlay.classList.add("hidden");
});

renderList();
drawWheel();
