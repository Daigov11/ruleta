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
const resetUsedBtn = document.getElementById("resetUsedBtn");
const overlay = document.getElementById("overlay");
const resultContent = document.getElementById("resultContent");
const addImageBtn = document.getElementById("addImageBtn");
const imageFileInput = document.getElementById("imageFileInput");
const sessionSelect = document.getElementById("sessionSelect");
const saveSessionBtn = document.getElementById("saveSessionBtn");
const loadSessionBtn = document.getElementById("loadSessionBtn");
const deleteSessionBtn = document.getElementById("deleteSessionBtn");
const enableOptionsCheckbox = document.getElementById("enableOptions");
const optionsEditor = document.getElementById("optionsEditor");
const resultCard = document.getElementById("resultCard");

enableOptionsCheckbox.addEventListener("change", () => {
  optionsEditor.classList.toggle("hidden", !enableOptionsCheckbox.checked);
});

function collectOptionsFromEditor() {
  if (!enableOptionsCheckbox.checked) return null;
  const rows = Array.from(optionsEditor.querySelectorAll(".option-row"));
  const correctRadio = optionsEditor.querySelector('input[name="correctOption"]:checked');
  const correctSlot = correctRadio ? parseInt(correctRadio.value, 10) : -1;
  const filled = [];
  rows.forEach((row, idx) => {
    const input = row.querySelector(".option-input");
    const text = input.value.trim();
    if (text) filled.push({ text, wasCorrect: idx === correctSlot });
  });
  if (filled.length < 2) return null;
  const letters = ["A", "B", "C", "D"];
  const options = filled.map((f, i) => ({ label: letters[i], text: f.text }));
  let correctIndex = filled.findIndex((f) => f.wasCorrect);
  if (correctIndex === -1) correctIndex = 0;
  return { options, correctIndex };
}

function resetOptionsEditor() {
  enableOptionsCheckbox.checked = false;
  optionsEditor.classList.add("hidden");
  optionsEditor.querySelectorAll(".option-input").forEach((i) => (i.value = ""));
  const firstRadio = optionsEditor.querySelector('input[name="correctOption"][value="0"]');
  if (firstRadio) firstRadio.checked = true;
}

function defaultQuestions() {
  return [
    { type: "text", content: "x + 3 = 16", used: false },
    { type: "text", content: "2x = 10", used: false },
    { type: "text", content: "x - 5 = 7", used: false },
    { type: "text", content: "3x + 1 = 13", used: false },
  ];
}

function loadQuestions() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return parsed.map((q) =>
        typeof q === "string"
          ? { type: "text", content: q, used: false }
          : { used: false, ...q }
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

function seedDefaultSessions() {
  const SEED_FLAG = "ruleta-sesiones-seeded";
  if (localStorage.getItem(SEED_FLAG)) return;
  localStorage.setItem(SEED_FLAG, "1");
  if (Object.keys(loadSessions()).length > 0) return;

  const q = (content) => ({ type: "text", content, used: false });
  const seed = {
    "Ecuaciones básicas": [
      q("x + 3 = 16"),
      q("2x = 10"),
      q("x - 5 = 7"),
      q("3x + 1 = 13"),
    ],
    "Fracciones": [
      q("1/2 + 1/4 = ?"),
      q("3/4 - 1/2 = ?"),
      q("2/3 × 3/5 = ?"),
      q("5/6 ÷ 1/2 = ?"),
    ],
    "Multiplicación": [
      q("7 × 8 = ?"),
      q("9 × 6 = ?"),
      q("12 × 4 = ?"),
      q("6 × 6 = ?"),
    ],
    "Geometría": [
      q("Área de un cuadrado de lado 5"),
      q("Perímetro de un rectángulo de 4 x 6"),
      q("Área de un triángulo de base 8 y altura 3"),
      q("Circunferencia de un círculo de radio 7"),
    ],
  };
  saveSessions(seed);
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
  questions = JSON.parse(JSON.stringify(sessions[name])).map((q) => ({ ...q, used: false }));
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
    li.classList.toggle("used", !!q.used);

    const row = document.createElement("div");
    row.className = "li-row";

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

    row.appendChild(swatch);
    row.appendChild(contentEl);
    if (q.used) {
      const tag = document.createElement("span");
      tag.className = "used-tag";
      tag.textContent = "Ya salió";
      row.appendChild(tag);
    }
    row.appendChild(delBtn);
    li.appendChild(row);

    if (q.options && q.options.length) {
      const preview = document.createElement("div");
      preview.className = "q-options-preview";
      preview.textContent = q.options
        .map((o, oi) => `${o.label}) ${o.text}${oi === q.correctIndex ? " ✓" : ""}`)
        .join("   ");
      li.appendChild(preview);
    }

    questionList.appendChild(li);
  });

  emptyHint.classList.toggle("hidden", questions.length > 0);
  spinBtn.disabled = questions.length < 2 || spinning;
  resetUsedBtn.hidden = questions.every((q) => !q.used);
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
    ctx.fillStyle = q.used ? "#3a3f4d" : COLORS[i % COLORS.length];
    ctx.fill();
    ctx.strokeStyle = "rgba(0,0,0,0.15)";
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(start + seg / 2);
    ctx.globalAlpha = q.used ? 0.4 : 1;

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
  const q = { type: "text", content: value, used: false };
  const opts = collectOptionsFromEditor();
  if (opts) {
    q.options = opts.options;
    q.correctIndex = opts.correctIndex;
  }
  questions.push(q);
  saveQuestions();
  questionInput.value = "";
  resetOptionsEditor();
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
    const q = { type: "image", content: dataUrl, used: false };
    const opts = collectOptionsFromEditor();
    if (opts) {
      q.options = opts.options;
      q.correctIndex = opts.correctIndex;
    }
    questions.push(q);
    saveQuestions();
    resetOptionsEditor();
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

  const availableIndices = questions
    .map((q, i) => i)
    .filter((i) => !questions[i].used);

  if (availableIndices.length === 0) {
    alert('¡Ya salieron todas las preguntas! Pulsa "Reiniciar preguntas" para volver a jugar.');
    return;
  }

  spinning = true;
  spinBtn.disabled = true;

  const n = questions.length;
  const segDeg = 360 / n;
  const targetIndex = availableIndices[Math.floor(Math.random() * availableIndices.length)];
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
    questions[targetIndex].used = true;
    saveQuestions();
    renderList();
    drawWheel();
    spinBtn.disabled = questions.length < 2;
    showResult(questions[targetIndex]);
  };
  canvas.addEventListener("transitionend", onEnd);
});

resetUsedBtn.addEventListener("click", () => {
  questions.forEach((q) => (q.used = false));
  saveQuestions();
  renderList();
  drawWheel();
});

function showResult(question) {
  resultContent.innerHTML = "";
  const hasOptions = !!(question.options && question.options.length);
  resultCard.classList.toggle("has-options", hasOptions);

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

  if (hasOptions) {
    const optsWrap = document.createElement("div");
    optsWrap.className = "result-options";
    question.options.forEach((opt, i) => {
      const item = document.createElement("div");
      item.className = "result-option";
      item.dataset.idx = i;

      const lbl = document.createElement("span");
      lbl.className = "opt-label";
      lbl.textContent = opt.label + ")";

      const txt = document.createElement("span");
      txt.className = "opt-text";
      txt.textContent = opt.text;

      item.appendChild(lbl);
      item.appendChild(txt);
      optsWrap.appendChild(item);
    });
    resultContent.appendChild(optsWrap);

    const revealBtn = document.createElement("button");
    revealBtn.type = "button";
    revealBtn.className = "reveal-btn";
    revealBtn.textContent = "Revelar respuesta";
    revealBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      if (revealBtn.disabled) return;
      const correctEl = optsWrap.querySelector(`[data-idx="${question.correctIndex}"]`);
      if (correctEl) correctEl.classList.add("correct");
      launchConfetti();
      revealBtn.disabled = true;
      revealBtn.textContent = "¡Respuesta revelada!";
    });
    resultContent.appendChild(revealBtn);
  }

  overlay.classList.remove("hidden");
}

function launchConfetti() {
  const colors = ["#ff6b6b", "#4f7cff", "#ffd23f", "#4fd6a8", "#c874ff", "#ff9f4f", "#4fc9ff", "#ff5ca8"];
  const count = 140;
  for (let i = 0; i < count; i++) {
    const piece = document.createElement("div");
    piece.className = "confetti-piece";
    const duration = 2.2 + Math.random() * 1.6;
    const delay = Math.random() * 0.3;
    const rot = 360 + Math.random() * 720;
    piece.style.left = Math.random() * 100 + "vw";
    piece.style.background = colors[Math.floor(Math.random() * colors.length)];
    piece.style.setProperty("--rot", rot + "deg");
    piece.style.animationDuration = duration + "s";
    piece.style.animationDelay = delay + "s";
    piece.style.borderRadius = Math.random() > 0.5 ? "50%" : "2px";
    document.body.appendChild(piece);
    setTimeout(() => piece.remove(), (duration + delay) * 1000 + 150);
  }
}

overlay.addEventListener("click", () => {
  overlay.classList.add("hidden");
});

seedDefaultSessions();
renderList();
renderSessionSelect();
drawWheel();
