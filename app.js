
"use strict";

/* RISHI JU — Jadavpur University Civil Engineering Study Companion */

const PDF_FILE = "BEcivilSyllabus.pdf";
const STORAGE_KEY = "rishiJUProgress";

const semesterNames = [
  "First Semester", "Second Semester",
  "Third Semester", "Fourth Semester",
  "Fifth Semester", "Sixth Semester",
  "Seventh Semester", "Eighth Semester"
];

const yearNames = ["First Year", "Second Year", "Third Year", "Fourth Year"];

let pdfDocument = null;
let syllabusPages = [];
let semesterRanges = [];
let selectedSemester = -1;
let visiblePageLimit = 30;
let searchTerm = "";
let progress = loadProgress();

const $ = (id) => document.getElementById(id);

function loadProgress() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
  } catch {
    return {};
  }
}

function saveProgress() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
  updateProgressUI();
}

function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;",
    '"': "&quot;", "'": "&#039;"
  })[char]);
}

function highlightText(text, query) {
  const safeText = escapeHTML(text);
  if (!query) return safeText;

  const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(`(${escapedQuery})`, "gi");
  return safeText.replace(regex, "<mark>$1</mark>");
}

function setView(viewName) {
  document.querySelectorAll(".view").forEach(view => {
    view.classList.toggle("active", view.id === viewName);
  });

  document.querySelectorAll(".nav-link").forEach(button => {
    button.classList.toggle("active", button.dataset.view === viewName);
  });

  const labels = {
    dashboard: "Dashboard",
    syllabus: "Complete Syllabus",
    semesters: "Semesters",
    progress: "My Progress",
    resources: "Resources"
  };

  $("breadcrumbPage").textContent = labels[viewName] || "Dashboard";
  $("sidebar").classList.remove("open");
  window.scrollTo({ top: 0, behavior: "smooth" });

  if (viewName === "progress") updateProgressUI();
}

function goToSemester(index) {
  selectedSemester = index;
  searchTerm = "";
  $("searchInput").value = "";
  visiblePageLimit = 30;
  setView("syllabus");
  renderSemesterMenu();
  renderSyllabusPages();
}

function getSemesterForPage(pageNumber) {
  for (let i = 0; i < semesterRanges.length; i++) {
    const range = semesterRanges[i];
    if (range && pageNumber >= range.start && pageNumber <= range.end) {
      return i;
    }
  }
  return -1;
}

function buildSemesterRanges() {
  const markers = [
    /FIRST\s+YEAR\s+FIRST\s+SEMESTER/i,
    /FIRST\s+YEAR\s+SECOND\s+SEMESTER/i,
    /SECOND\s+YEAR\s+FIRST\s+SEMESTER/i,
    /SECOND\s+YEAR\s+SECOND\s+SEMESTER/i,
    /THIRD\s+YEAR\s+FIRST\s+SEMESTER/i,
    /THIRD\s+YEAR\s+SECOND\s+SEMESTER/i,
    /FOURTH\s+YEAR\s+FIRST\s+SEMESTER/i,
    /FOURTH\s+YEAR\s+SECOND\s+SEMESTER/i
  ];

  const found = [];

  syllabusPages.forEach(page => {
    const text = page.text.slice(0, 1800);
    markers.forEach((marker, index) => {
      if (marker.test(text)) {
        found.push({ index, page: page.number });
      }
    });
  });

  const unique = [];
  found.sort((a, b) => a.page - b.page).forEach(item => {
    if (!unique.some(existing => existing.index === item.index)) {
      unique.push(item);
    }
  });

  semesterRanges = Array(8).fill(null);

  unique.forEach((item, position) => {
    const next = unique[position + 1];
    semesterRanges[item.index] = {
      start: item.page,
      end: next ? next.page - 1 : syllabusPages.length
    };
  });
}

async function loadSyllabus() {
  const status = $("pdfStatus");

  if (!window.pdfjsLib) {
    status.textContent = "The PDF reader could not load. Check your internet connection and refresh.";
    status.classList.add("error");
    return;
  }

  pdfjsLib.GlobalWorkerOptions.workerSrc =
    "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";

  try {
    status.innerHTML = '<span class="loading-dot"></span> Opening your official syllabus...';

    const loadingTask = pdfjsLib.getDocument({
      url: PDF_FILE,
      isEvalSupported: false
    });

    pdfDocument = await loadingTask.promise;
    syllabusPages = [];

    for (let pageNumber = 1; pageNumber <= pdfDocument.numPages; pageNumber++) {
      const page = await pdfDocument.getPage(pageNumber);
      const content = await page.getTextContent();

      const text = content.items
        .map(item => item.str)
        .join(" ")
        .replace(/[ \t]+/g, " ")
        .trim();

      syllabusPages.push({
        number: pageNumber,
        text: text || "No selectable text was found on this PDF page."
      });

      if (pageNumber % 10 === 0 || pageNumber === pdfDocument.numPages) {
        status.textContent =
          `Reading syllabus pages: ${pageNumber} / ${pdfDocument.numPages}`;
      }
    }

    buildSemesterRanges();

    status.textContent =
      `Syllabus loaded successfully · ${pdfDocument.numPages} pages`;
    status.classList.add("success");

    renderSemesterMenu();
    renderSyllabusPages();
    renderSemesterCards();
    updateProgressUI();

  } catch (error) {
    console.error("Syllabus loading error:", error);
    status.innerHTML =
      `Could not load <strong>${PDF_FILE}</strong>. Make sure the PDF is in the same folder as index.html and that its filename is correct.`;
    status.classList.add("error");

    $("syllabusPages").innerHTML = `
      <div class="empty-state">
        <h3>Syllabus PDF not found</h3>
        <p>Place <strong>${PDF_FILE}</strong> beside index.html, then refresh the page.</p>
        <p>For local testing, use the VS Code Live Server extension rather than opening the HTML file directly.</p>
      </div>`;
  }
}

function renderSemesterMenu() {
  const container = $("syllabusSemesterList");

  container.innerHTML = `
    <button class="semester-option ${selectedSemester === -1 ? "active" : ""}"
      data-semester="-1">All syllabus pages</button>
    ${semesterNames.map((name, index) => `
      <button class="semester-option ${selectedSemester === index ? "active" : ""}"
        data-semester="${index}">
        ${yearNames[Math.floor(index / 2)]} · ${name}
      </button>
    `).join("")}
  `;

  container.querySelectorAll("[data-semester]").forEach(button => {
    button.addEventListener("click", () => {
      selectedSemester = Number(button.dataset.semester);
      visiblePageLimit = 30;
      renderSemesterMenu();
      renderSyllabusPages();
    });
  });
}

function getFilteredPages() {
  let pages = syllabusPages;

  if (selectedSemester !== -1) {
    const range = semesterRanges[selectedSemester];

    if (range) {
      pages = pages.filter(page =>
        page.number >= range.start && page.number <= range.end
      );
    } else {
      pages = [];
    }
  }

  if (searchTerm) {
    const query = searchTerm.toLowerCase();
    pages = pages.filter(page => page.text.toLowerCase().includes(query));
  }

  return pages;
}

function renderSyllabusPages() {
  const container = $("syllabusPages");
  const title = $("resultsTitle");
  const count = $("resultsCount");
  const eyebrow = $("resultsEyebrow");

  if (!syllabusPages.length) return;

  if (selectedSemester === -1) {
    title.textContent = searchTerm ? "Search results" : "All syllabus pages";
    eyebrow.textContent = "JU CIVIL ENGINEERING";
  } else {
    title.textContent = semesterNames[selectedSemester];
    eyebrow.textContent = yearNames[Math.floor(selectedSemester / 2)].toUpperCase();
  }

  const pages = getFilteredPages();
  count.textContent = `${pages.length} page${pages.length === 1 ? "" : "s"} found`;

  if (selectedSemester !== -1 && !semesterRanges[selectedSemester]) {
    container.innerHTML = `
      <div class="empty-state">
        This semester heading could not be detected automatically in the PDF text.
        Use "All syllabus pages" and search for the semester name.
      </div>`;
    return;
  }

  if (!pages.length) {
    container.innerHTML = `
      <div class="empty-state">
        No matching pages found. Try another keyword or select all syllabus pages.
      </div>`;
    return;
  }

  const shownPages = pages.slice(0, visiblePageLimit);

  container.innerHTML = shownPages.map(page => {
    const isDone = Boolean(progress[page.number]);

    return `
      <article class="syllabus-page">
        <div class="page-card-top">
          <span class="page-number">PDF PAGE ${page.number}</span>
          <button class="mark-btn ${isDone ? "done" : ""}"
            data-page="${page.number}">
            ${isDone ? "✓ Reviewed" : "+ Mark reviewed"}
          </button>
        </div>
        <div class="page-text">${highlightText(page.text, searchTerm)}</div>
      </article>`;
  }).join("");

  container.querySelectorAll("[data-page]").forEach(button => {
    button.addEventListener("click", () => {
      const page = Number(button.dataset.page);
      if (progress[page]) delete progress[page];
      else progress[page] = true;

      saveProgress();
      renderSyllabusPages();
    });
  });

  if (pages.length > visiblePageLimit) {
    const more = document.createElement("button");
    more.className = "secondary-btn";
    more.style.marginTop = "12px";
    more.textContent = `Show more pages (${pages.length - visiblePageLimit} remaining)`;
    more.addEventListener("click", () => {
      visiblePageLimit += 30;
      renderSyllabusPages();
    });
    container.appendChild(more);
  }
}

function renderSemesterCards() {
  const dashboard = $("dashboardSemesters");
  const all = $("allSemesters");

  dashboard.innerHTML = semesterNames.map((name, index) => `
    <button class="semester-tile" data-open-semester="${index}">
      <strong>0${index + 1}</strong>
      <span>${yearNames[Math.floor(index / 2)]}</span>
      <span>${name}</span>
    </button>
  `).join("");

  all.innerHTML = semesterNames.map((name, index) => `
    <article class="year-card">
      <p>${yearNames[Math.floor(index / 2)].toUpperCase()}</p>
      <h3>Semester 0${index + 1}</h3>
      <button data-open-semester="${index}">Explore syllabus →</button>
    </article>
  `).join("");

  document.querySelectorAll("[data-open-semester]").forEach(button => {
    button.addEventListener("click", () => {
      goToSemester(Number(button.dataset.openSemester));
    });
  });
}

function updateProgressUI() {
  const total = syllabusPages.length;
  const completed = Object.keys(progress).filter(key => progress[key]).length;
  const percent = total ? Math.round((completed / total) * 100) : 0;

  $("completedCount").textContent = completed;
  $("progressPercent").textContent = `${percent}%`;
  $("ringPercent").textContent = `${percent}%`;
  $("reviewedPages").textContent = completed;
  $("reviewedPercent").textContent = `${percent}%`;
  $("progressRing").style.background =
    `conic-gradient(var(--gold) ${percent}%, #26364a ${percent}%)`;

  const list = $("progressList");
  if (!list) return;

  list.innerHTML = semesterNames.map((name, index) => {
    const range = semesterRanges[index];
    let semesterTotal = 0;
    let semesterDone = 0;

    if (range) {
      semesterTotal = range.end - range.start + 1;

      for (let page = range.start; page <= range.end; page++) {
        if (progress[page]) semesterDone++;
      }
    }

    const rate = semesterTotal
      ? Math.round((semesterDone / semesterTotal) * 100)
      : 0;

    return `
      <div class="progress-row">
        <div>
          <strong>${yearNames[Math.floor(index / 2)]} · ${name}</strong>
          <div class="mini-track"><div style="width:${rate}%"></div></div>
          <span>${semesterTotal ? `${semesterDone} of ${semesterTotal} pages reviewed` : "Semester range not detected"}</span>
        </div>
        <strong>${rate}%</strong>
      </div>`;
  }).join("");
}

function setupNavigation() {
  document.querySelectorAll(".nav-link").forEach(button => {
    button.addEventListener("click", () => setView(button.dataset.view));
  });

  document.querySelectorAll("[data-go]").forEach(button => {
    button.addEventListener("click", () => setView(button.dataset.go));
  });

  $("mobileMenu").addEventListener("click", () => {
    $("sidebar").classList.toggle("open");
  });
}

function setupSearch() {
  $("searchInput").addEventListener("input", event => {
    searchTerm = event.target.value.trim();
    visiblePageLimit = 30;
    selectedSemester = -1;
    renderSemesterMenu();
    renderSyllabusPages();
  });

  $("clearSearch").addEventListener("click", () => {
    $("searchInput").value = "";
    searchTerm = "";
    renderSyllabusPages();
  });
}

function setupOtherActions() {
  $("todayDate").textContent = new Date().toLocaleDateString("en-IN", {
    day: "2-digit", month: "short", year: "numeric"
  }).toUpperCase();

  $("openPdf").addEventListener("click", () => {
    window.open(PDF_FILE, "_blank", "noopener");
  });

  $("resetProgress").addEventListener("click", () => {
    const confirmed = window.confirm(
      "Are you sure you want to reset all your reviewed pages?"
    );

    if (!confirmed) return;

    progress = {};
    saveProgress();
    renderSyllabusPages();
  });
}

function registerAppWorker() {
  if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
    navigator.serviceWorker.register("./service-worker.js")
      .catch(error => console.warn("Offline support registration failed:", error));
  }
}

setupNavigation();
setupSearch();
setupOtherActions();
renderSemesterCards();
updateProgressUI();
loadSyllabus();
registerAppWorker();
