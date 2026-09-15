const COLORS = [
  "#ff6b6b", "#4f7cff", "#ffd23f", "#4fd6a8",
  "#c874ff", "#ff9f4f", "#4fc9ff", "#ff5ca8",
  "#8bd450", "#ff8181"
];

const STORAGE_KEY = "ruleta-preguntas";
const SESSIONS_KEY = "ruleta-sesiones";
const IMAGE_MAX_DIM = 480;
const IMAGE_QUALITY = 0.8;

let questions = loadQuestions();
let currentRotation = 0;
let spinning = false;
const imageCache = {};

const canvas = document.getElementById("wheel");
const ctx = canvas.getContext("2d");
const questionInput = document.getElementById("questionInput");
const addForm = document.getElementById("addForm");
const questionList = document.getElementById("questionList");
const emptyHint = document.getElementById("emptyHint");
const spinBtn = document.getElementById("spinBtn");
const overlay = document.getElementById("overlay");
const resultContent = document.getElementById("resultContent");
const addImageBtn = document.getElementById("addImageBtn");
const imageFileInput = document.getElementById("imageFileInput");
const sessionSelect = document.getElementById("sessionSelect");
const saveSessionBtn = document.getElementById("saveSessionBtn");
const loadSessionBtn = document.getElementById("loadSessionBtn");
const deleteSessionBtn = document.getElementById("deleteSessionBtn");

function defaultQuestions() {
  return [
    { type: "text", content: "x + 3 = 16" },
    { type: "text", content: "2x = 10" },
    { type: "text", content: "x - 5 = 7" },
    { type: "text", content: "3x + 1 = 13" },
  ];
}

function loadQuestions() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return parsed.map((q) =>
        typeof q === "string" ? { type: "text", content: q } : q
      );
    }
  } catch (e) {}
  return defaultQuestions();
}

function saveQuestions() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(questions));
  } catch (e) {
    alert("No se pudo guardar (el almacenamiento local está lleno, prueba con imágenes más pequeñas).");
  }
}

function loadSessions() {
  try {
    const raw = localStorage.getItem(SESSIONS_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {}
  return {};
}

function saveSessions(sessions) {
  try {
    localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions));
    return true;
  } catch (e) {
    alert("No se pudo guardar la sesión (el almacenamiento local está lleno).");
    return false;
  }
}

function renderSessionSelect() {
  const sessions = loadSessions();
  const names = Object.keys(sessions).sort((a, b) => a.localeCompare(b));
  const current = sessionSelect.value;
  sessionSelect.innerHTML = '<option value="">— Selecciona una sesión —</option>';
  names.forEach((name) => {
    const opt = document.createElement("option");
    opt.value = name;
    opt.textContent = name;
    sessionSelect.appendChild(opt);
  });
  if (names.includes(current)) sessionSelect.value = current;
}

saveSessionBtn.addEventListener("click", () => {
  if (questions.length === 0) {
    alert("No hay preguntas para guardar en una sesión.");
    return;
  }
  const name = prompt("Nombre de la sesión:");
  if (!name) return;
  const sessions = loadSessions();
  if (sessions[name] && !confirm(`Ya existe una sesión "${name}". ¿Sobrescribirla?`)) return;
  sessions[name] = questions;
  if (saveSessions(sessions)) {
    renderSessionSelect();
    sessionSelect.value = name;
  }
});

loadSessionBtn.addEventListener("click", () => {
  const name = sessionSelect.value;
  if (!name) {
    alert("Selecciona una sesión para cargar.");
    return;
  }
  const sessions = loadSessions();
  if (!sessions[name]) return;
  if (questions.length > 0 && !confirm("Esto reemplazará las preguntas actuales. ¿Continuar?")) return;
  questions = JSON.parse(JSON.stringify(sessions[name]));
  saveQuestions();
  renderList();
  drawWheel();
});

deleteSessionBtn.addEventListener("click", () => {
  const name = sessionSelect.value;
  if (!name) {
    alert("Selecciona una sesión para eliminar.");
    return;
  }
  if (!confirm(`¿Eliminar la sesión "${name}"?`)) return;
  const sessions = loadSessions();
  delete sessions[name];
  if (saveSessions(sessions)) renderSessionSelect();
});

function renderList() {
  questionList.innerHTML = "";
  questions.forEach((q, i) => {
    const li = document.createElement("li");

    const swatch = document.createElement("span");
    swatch.className = "swatch";
    swatch.style.background = COLORS[i % COLORS.length];

    let contentEl;
    if (q.type === "image") {
      contentEl = document.createElement("img");
      contentEl.className = "q-thumb";
      contentEl.src = q.content;
      contentEl.alt = "Pregunta (imagen)";
    } else {
      contentEl = document.createElement("span");
      contentEl.className = "q-text";
      contentEl.textContent = q.content;
    }

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
    li.appendChild(contentEl);
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

function roundRectPath(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function getImage(src) {
  let img = imageCache[src];
  if (!img) {
    img = new Image();
    img.onload = () => drawWheel();
    img.src = src;
    imageCache[src] = img;
  }
  return img;
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

    if (q.type === "image") {
      const img = getImage(q.content);
      const boxSize = Math.min(64, radius * 0.32);
      const boxX = radius - 24 - boxSize;
      const boxY = -boxSize / 2;

      if (img.complete && img.naturalWidth) {
        ctx.save();
        roundRectPath(ctx, boxX, boxY, boxSize, boxSize, 8);
        ctx.clip();
        ctx.drawImage(img, boxX, boxY, boxSize, boxSize);
        ctx.restore();
        ctx.strokeStyle = "rgba(0,0,0,0.35)";
        ctx.lineWidth = 2;
        roundRectPath(ctx, boxX, boxY, boxSize, boxSize, 8);
        ctx.stroke();
      } else {
        roundRectPath(ctx, boxX, boxY, boxSize, boxSize, 8);
        ctx.fillStyle = "rgba(0,0,0,0.15)";
        ctx.fill();
      }
    } else {
      ctx.textAlign = "right";
      ctx.textBaseline = "middle";
      ctx.fillStyle = "#1b1f2a";
      ctx.font = "bold 15px sans-serif";
      const lines = wrapText(ctx, q.content, radius - 40);
      const lineHeight = 17;
      const offsetStart = -((lines.length - 1) * lineHeight) / 2;
      lines.forEach((line, li) => {
        ctx.fillText(line, radius - 18, offsetStart + li * lineHeight);
      });
    }

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
  questions.push({ type: "text", content: value });
  saveQuestions();
  questionInput.value = "";
  renderList();
  drawWheel();
});

function compressImage(file, maxDim = IMAGE_MAX_DIM, quality = IMAGE_QUALITY) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > height && width > maxDim) {
          height = Math.round(height * (maxDim / width));
          width = maxDim;
        } else if (height > maxDim) {
          width = Math.round(width * (maxDim / height));
          height = maxDim;
        }
        const off = document.createElement("canvas");
        off.width = width;
        off.height = height;
        off.getContext("2d").drawImage(img, 0, 0, width, height);
        resolve(off.toDataURL("image/jpeg", quality));
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

addImageBtn.addEventListener("click", () => imageFileInput.click());

imageFileInput.addEventListener("change", async () => {
  const file = imageFileInput.files[0];
  if (!file) return;
  try {
    const dataUrl = await compressImage(file);
    questions.push({ type: "image", content: dataUrl });
    saveQuestions();
    renderList();
    drawWheel();
  } catch (e) {
    alert("No se pudo cargar la imagen.");
  } finally {
    imageFileInput.value = "";
  }
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

function showResult(question) {
  resultContent.innerHTML = "";
  if (question.type === "image") {
    const img = document.createElement("img");
    img.className = "result-image";
    img.src = question.content;
    resultContent.appendChild(img);
  } else {
    const span = document.createElement("span");
    span.className = "result-text";
    span.textContent = question.content;
    resultContent.appendChild(span);
  }
  overlay.classList.remove("hidden");
}

overlay.addEventListener("click", () => {
  overlay.classList.add("hidden");
});

renderList();
renderSessionSelect();
drawWheel();
