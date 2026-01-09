// Global store so you can reuse parsed data later
const state = {
  acquisitions: [], 
  selectedChassis: null,
  selectedRD: null,
  selectedRG: null,
  rawGyrUnits: null  // 'degs' or 'rads'      
};

// Classe rawDataFiles pour stocker les données IMU
class rawDataFiles {
  constructor(fileName) {
    this.fileName = fileName;
    this.nbFrames = null;
    this.Headers = {};
    this.Data = {};
  }

// Charger les données dans l'objet
  async loadRAW(file) { 
    const text = await file.text();
    const name = file.name.toLowerCase();

    if (!text || typeof text !== 'string') {
      return;
    }

    // JSON -------------------------------------------------------
    if (name.endsWith(".json")) {
      let json;
      try {
        json = JSON.parse(text);
      } catch {
        throw new Error("Invalid JSON file");
      }

      // Cas 1 : Array of objects [{}, {}, ...]
      if (Array.isArray(json) && typeof json[0] === "object") {
        this.Headers = Object.keys(json[0]);
        this.Data = {};
        this.Headers.forEach(h => {
          this.Data[h] = [];
        });

        json.forEach(row => {
          this.Headers.forEach(h => {
            this.Data[h].push(row[h] ?? null);
          });
        });

        this.nbFrames = json.length;
        return this;
      }

      // Cas 2 : Object of arrays { Ax: [], Ay: [] }
      if (
        typeof json === "object" &&
        !Array.isArray(json) &&
        Object.values(json).every(v => Array.isArray(v))
      ) {

        this.Headers = Object.keys(json);
        this.Data = {};
        let maxLength = 0;

        this.Headers.forEach(h => {
          const arr = json[h] ?? [];
          this.Data[h] = arr;
          if (arr.length > maxLength) maxLength = arr.length;
        });

        this.nbFrames = maxLength;  // ✅ longueur max des colonnes
        return this;
      }

      // Format inconnu
      throw new Error("Unsupported JSON structure");
    }


    // CSV / TXT / TSV --------------------------------------------
    const lines = text.split(/\r?\n/);

    // Find the first line that looks like a header (tab or comma separated)
    const { delimiter, headerIndex, dataIndex } = detectHeaderAndData(lines);

    // Lire les headers
    let rawHeaders;
    if (headerIndex !== null && lines[headerIndex]) {
      rawHeaders = lines[headerIndex].split(delimiter).map(h => h.trim());
    } else {
      const colCount = lines[dataIndex].split(delimiter).length;
      rawHeaders = Array.from({ length: colCount }, (_, i) => `col${i}`);
    }

    // Identifier les colonnes valides (header non vide)
    const validColumns = rawHeaders
      .map((h, i) => ({ h, i }))
      .filter(col => col.h !== "");

    // Appliquer headers nettoyés
    this.Headers = validColumns.map(c => c.h);

    // Initialiser Data
    this.Data = {};
    this.Headers.forEach(h => {
      this.Data[h] = [];
    });

    // Extraire les données en ignorant les colonnes invalides
    for (let i = dataIndex; i < lines.length; i++) {
      const line = lines[i];
      if (!line) continue;

      const parts = line.split(delimiter);
      if (parts.length < rawHeaders.length) continue;

      validColumns.forEach((col, idx) => {
        const v = parts[col.i]?.trim();
        const value =
          v === "" ? null :
          isNaN(v) ? v :
          Number(v);

        this.Data[this.Headers[idx]].push(value);
      });
    }

    // nbFrames fiable
    this.nbFrames = this.Headers.length
      ? Math.max(...this.Headers.map(h => this.Data[h].length))
      : 0;

  }
}

//Initialisation au chagement de la page
document.addEventListener("DOMContentLoaded", () => {
  // Réinitialiser les champs de texte
  document.querySelectorAll("input").forEach(input => {
    switch (input.type) {
      case "text":
        input.value = ""; 
        break;
      case "number":
        input.value = "";
        break;
      case "radio":
        input.checked = false;
        break;
      case "file":
        input.value = "";
        break;
    }
  });

  // Réinitialiser le bouton d'export
  const exportBtn = document.getElementById("generateCSVBtn");
  if (exportBtn) {
    exportBtn.disabled = true;
    exportBtn.classList.remove("highlight-btn"); // si tu utilises cette classe pour activer le style
  }

  //Rafraichir les menus déroulant pour affichage placeholder
  refreshSelect();
  refreshBatchSelects();
  updateFirstBatchRowDisplay()
});

// Gestion des unités des vitesses angulaires
document.querySelectorAll('input[name="rawgyrunit"]').forEach(radio => {
  radio.addEventListener('change', () => {
    state.rawGyrUnits = radio.value; // 'degs' ou 'rads'
    checkExportReady();              // réévaluer l’état du bouton CSV
  });
});


// Gestion du bouton de chargement des acquisitions IMU
document.getElementById("loadimu2csv").addEventListener("click", () => {
  const input = document.createElement("input");
  input.type = "file";
  input.accept=".txt,.csv,.json,.tsv";
  input.multiple = true;

  input.addEventListener("change", async (e) => {
    await handleFiles(e.target.files, "raw");
    refreshSelect()
    refreshBatchSelects()
  });

  input.click();
});

// Drop zone pour les acquisitions à traiter
const dropZoneimu2csv = document.getElementById("dropZoneimu2csv");
if (dropZoneimu2csv) {
  dropZoneimu2csv.addEventListener('dragover', (e) => { e.preventDefault(); dropZoneimu2csv.classList.add('dragover'); });
  dropZoneimu2csv.addEventListener('dragleave', () => { dropZoneimu2csv.classList.remove('dragover'); });
  dropZoneimu2csv.addEventListener('drop', async (e) => {
    e.preventDefault();
    dropZoneimu2csv.classList.remove('dragover');
    await handleFiles(e.target.files, "raw");
    refreshSelect();
    refreshBatchSelects()
  });
  // Clicking the drop zone should open the file picker like the load button
  dropZoneimu2csv.addEventListener('click', (e) => {
    e.preventDefault();
    // Safely open the associated file picker button if present
    document.getElementById('loadimu2csv')?.click();
  });
}

// Bouton ajout ligne Batch
document.getElementById('addBatchRowBtn')?.addEventListener('click', () => {
    addBatchRow();
    checkExportReady()
});

// Bouton suppression ligne Batch
document.getElementById('removeBatchRowBtn')?.addEventListener('click', () => {
  removeLastBatchRow();
  checkExportReady()
});

// Bouton de création du CSV
document.getElementById("generateCSVBtn").addEventListener("click", () => {
  generateCSVBatchHybrid();
  showStatus((window.i18n && typeof window.i18n.t === 'function') ? window.i18n.t('showStatus_savepreprocess') : "✅ Fichier enregistré dans le dossier /Téléchargements !", "success","statusMsgSaveCSV");
});

//Vérification si chaque colonne a une sélection à chaque modification de tableau
document.addEventListener("change", (e) => {
  if (e.target.matches("input[type=radio]") ||
    e.target.matches("#tableBatch select")) {
    checkExportReady();
  }
});

//Gestion du bouton Nouvelle acquisition
document.getElementById("NewCuration")?.addEventListener("click", () => {
  if (confirm("⚠️ Voulez-vous vraiment recommencer une nouvelle acquisition ? Toutes les sélections en cours seront perdues.")) {
    window.location.reload();
  }
});

// Réccuperer l'état des menus déroulants lors de modifications
document.getElementById('acqSelect')
  ?.addEventListener('change', () => {
    const appState = getAppState();
    const selectedAcq = getSelectedAcquisition('acqSelect');
    appState.selectedChassis = selectedAcq.fileName;

    buildSelectionTable("tableCorrespChassis", selectedAcq.Headers);
    updateFirstBatchRowDisplay();
  });

document.getElementById('acqSelectRD')
  ?.addEventListener('change', () => {
    const appState = getAppState();
    const selectedAcqRD = getSelectedAcquisition('acqSelectRD');
    appState.selectedRD = selectedAcqRD.fileName;

    buildSelectionTable("tableCorrespRD", selectedAcqRD.Headers);
    updateFirstBatchRowDisplay();
  });

document.getElementById('acqSelectRG')
  ?.addEventListener('change', () => {
    const appState = getAppState();
    const selectedAcqRG = getSelectedAcquisition('acqSelectRG');
    appState.selectedRG = selectedAcqRG.fileName;

    buildSelectionTable("tableCorrespRG", selectedAcqRG.Headers);
    updateFirstBatchRowDisplay();
  });

// Permettre le clic sur toute la cellule du tableau de correspondance
document.addEventListener("click", (e) => {
  const cell = e.target.closest("td");
  if (!cell) return;

  const radio = cell.querySelector("input[type=radio]");
  if (!radio || radio.checked) return;

  const row = cell.closest("tr");
  const table = cell.closest("table");

  // ----- Limiter 1 radio par ligne -----
  row.querySelectorAll("input[type=radio]").forEach(r => {
    if (r !== radio) r.checked = false;
  });

  // ----- Cocher le bouton cliqué -----
  radio.checked = true;

  // ----- Gestion colonnes sélectionnées -----
  table.querySelectorAll("td, th").forEach(td => td.classList.remove("selected-col"));

  table.querySelectorAll("tr").forEach(tr => {
    tr.querySelectorAll("td, th").forEach((td, i) => {
      const input = td.querySelector("input[type=radio]");
      if (input && input.checked) {
        table.querySelectorAll("tr").forEach(r => {
          const colCell = r.children[i];
          if (colCell) colCell.classList.add("selected-col");
        });
      }
    });
  });
  // Déclencher l'événement change pour mise à jour de l'état
  radio.dispatchEvent(new Event("change", { bubbles: true }));
});

//Gestion du hover
document.addEventListener("mouseover", (e) => {
  const cell = e.target.closest("td");
  if (!cell) return;
  if (cell.cellIndex === 0) return;

  const row = cell.parentElement;
  const table = row.closest("table");
  const colIndex = cell.cellIndex;

  if (table.id === "fileTableIMUraw") return;

  // Ligne (toutes cellules de mapping)
  row.querySelectorAll("td:not(:first-child)")
    .forEach(td => td.classList.add("hover-row"));

  // Cellule titre (première colonne)
  const titleCell = row.children[0];
  if (titleCell) titleCell.classList.add("hover-title");

  // Colonne (th + td)
  table.querySelectorAll("tr").forEach(tr => {
    const colCell = tr.children[colIndex];
    if (colCell) colCell.classList.add("hover-col");
  });
});

document.addEventListener("mouseout", (e) => {
  const cell = e.target.closest("td");
  if (!cell) return;
  if (cell.cellIndex === 0) return;

  const row = cell.parentElement;
  const table = row.closest("table");
  const colIndex = cell.cellIndex;

  row.querySelectorAll("td:not(:first-child)")
    .forEach(td => td.classList.remove("hover-row"));

  const titleCell = row.children[0];
  if (titleCell) titleCell.classList.remove("hover-title");

  table.querySelectorAll("tr").forEach(tr => {
    const colCell = tr.children[colIndex];
    if (colCell) colCell.classList.remove("hover-col");
  });
});


// ------------------------------------- FONCTIONS -----------------------------------------
// Fonctions pour LoadRAW :
function detectDelimiter(line) {
  const candidates = [",", ";", "\t"];
  return candidates.reduce((best, d) =>
    line.split(d).length > line.split(best).length ? d : best
  );
}

function isNumericLine(line, delimiter) {
  const parts = line.split(delimiter);
  if (parts.length < 3) return false;

  let numericCount = 0;
  for (const p of parts) {
    const v = p.trim();
    if (v !== "" && !isNaN(v)) numericCount++;
  }

  return numericCount / parts.length >= 0.7;
}

function detectHeaderAndData(lines) {
  for (let i = 0; i < lines.length - 1; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const delimiter = detectDelimiter(line);
    if (!delimiter) continue;

    if (isNumericLine(lines[i + 1], delimiter) && isNumericLine(lines[i + 2], delimiter)) {
      let headerIndex = i;

      let headers = line.split(delimiter).map(h => h.trim());
      const uniqueHeaders = new Set(headers);
      if ((uniqueHeaders.size !== headers.length)) {
        if (headerIndex > 0) {
          headerIndex = i - 1;
        } else {
          headerIndex = null;
        }
      }
      
      return {
        delimiter,
        dataIndex: i + 1,
        headerIndex
      };
    }
  }
  throw new Error("No data section detected in file.");
}

// Fonctions pour tableaux de correspondance :
function initiateTables() {
  const appState = getAppState();

  const tables = [
    { id: "tableCorrespChassis", acq: appState.selectedChassis },
    { id: "tableCorrespRD", acq: appState.selectedRD },
    { id: "tableCorrespRG", acq: appState.selectedRG }
  ];

  tables.forEach(({ id, acq }) => {
    // Si aucune acquisition à réinitialiser ou si ce n'est pas celle-ci, passer
    if (acq) return;

    const table = document.getElementById(id);
    if (!table) return;

    // Supprimer toutes les lignes sauf la première (header)
    const tbody = table.querySelector("tbody");
    if (tbody) tbody.innerHTML = "";

    // Supprimer toutes les classes de sélection et hover
    table.querySelectorAll("td, th").forEach(el => {
      el.classList.remove("selected-row", "selected-col", "hover-row", "hover-col", "hover-title");
    });

    // Supprimer toutes les radios cochées
    table.querySelectorAll("input[type=radio]").forEach(radio => radio.checked = false);
  });
}

function buildSelectionTable(tableID, headers) {
  const table = document.getElementById(tableID);
  const tbody = table.querySelector("tbody");
  if (!tbody) return;

  // Supprimer anciennes lignes
  tbody.innerHTML = "";

  headers.forEach(header => {
    const tr = document.createElement("tr");

    // Nom du header
    const tdHeader = document.createElement("td");
    tdHeader.textContent = header;
    if (header.length > 20) tdHeader.classList.add("small-header");
    tr.appendChild(tdHeader);

    // Colonnes IMU
    const imuColumns = getImuColumnsFromTable(table);
    imuColumns.forEach(col => {
      const td = document.createElement("td");
      const radio = document.createElement("input");

      radio.type = "radio";
      radio.name = `${tableID}_${col.key}`;
      radio.value = header;
      radio.dataset.imu = col.key;

      td.appendChild(radio);
      tr.appendChild(td);
    });

    tbody.appendChild(tr);
  });
}

function getTableMapping(idTableCorresp) {
  const mapping = {};

  const table = document.getElementById(idTableCorresp);
  if (!table) return mapping;

  table.querySelectorAll("input[type=radio]:checked")
    .forEach(radio => {
      mapping[radio.dataset.imu] = radio.value;
    });

  return mapping;
}

function getImuColumnsFromTable(table) {
  const ths = table.querySelectorAll("tr:first-child th");

  return Array.from(ths)
    .slice(1) // ignorer la première colonne vide
    .map(th => ({
      label: th.textContent.trim(),
      key: th.textContent.replace(/\s+/g, "") // "Gyr X" → "GyrX"
    }));
}

//Vérification si chaque colonne a une sélection
function checkExportReady() {
  const tableIDs = ["tableCorrespChassis", "tableCorrespRD", "tableCorrespRG"];
  let allReady = true;

  tableIDs.forEach(id => {
    const table = document.getElementById(id);
    if (!table) return;

    // Récupérer toutes les colonnes sauf la première (colonne de titres)
    const nCols = table.rows[0].cells.length;
    for (let col = 1; col < nCols; col++) {
      const radios = Array.from(table.querySelectorAll(`tr td:nth-child(${col + 1}) input[type=radio]`));
      // Si aucune radio cochée dans cette colonne → tableau pas prêt
      if (!radios.some(r => r.checked)) {
        allReady = false;
        break;
      }
    }
  });

  const batchTable = document.getElementById("tableBatch");
  if (batchTable) {
    const selects = batchTable.querySelectorAll("select");
    selects.forEach(select => {
      if (!select.value) {
        allReady = false;
      }
    });
  }

  // Vérification des unités des vitesses angulaires
  if (!state.rawGyrUnits) {
  allReady = false;
  }

  // Activer/désactiver le bouton export
  const exportBtn = document.getElementById("generateCSVBtn");
  if (exportBtn) exportBtn.disabled = !allReady;
  if (allReady) exportBtn.classList.add("highlight-btn");
}

// Fonction pour générer le CSV final
async function generateCSVBatchHybrid() {
  const tbody = document.querySelector('#tableBatch tbody');
  if (!tbody) return;

  const rows = Array.from(tbody.querySelectorAll('tr'));
  if (rows.length === 0) return;

  const useZip = rows.length >= 3;
  const zip = useZip ? new JSZip() : null;

  const chassisMapping = getTableMapping("tableCorrespChassis");
  const rdMapping = getTableMapping("tableCorrespRD");
  const rgMapping = getTableMapping("tableCorrespRG");

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const cells = row.querySelectorAll('td');

    // Nom du fichier
    const input = row.querySelector('input[type=text]');
    const fileName =
      input?.value?.trim()
        ? input.value.trim().replace(/\s+/g, "_")
        : input.placeholder;
    
    // Acquisitions (texte ou select)
    const getAcq = (cell) => {
      const sel = cell.querySelector('select');
      const name = sel
        ? sel.selectedOptions[0]?.textContent
        : cell.textContent.trim();
      return getAcquisitionByName(name);
    };

    const acqChassis = getAcq(cells[1]);
    const acqRD = getAcq(cells[2]);
    const acqRG = getAcq(cells[3]);

    if (!acqChassis || !acqRD || !acqRG) continue;

    const csvContent = buildCSVForBatchLine({
      acqChassis,
      acqRD,
      acqRG,
      chassisMapping,
      rdMapping,
      rgMapping
    });

    if (useZip) {
      zip.file(`${fileName}.csv`, csvContent);
    } else {
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `${fileName}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  }

  // Téléchargement ZIP si nécessaire
  if (useZip && zip) {
    const blob = await zip.generateAsync({ type: "blob" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "imu_batch_export.zip";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}

function buildCSVForBatchLine({
  acqChassis,
  acqRD,
  acqRG,
  chassisMapping,
  rdMapping,
  rgMapping
}) {

  // fonction locale de conversion des vitesses angulaires
  function convertIfGyr(k, value) {
    if (value == null || value === "") return value;
    // Conversion uniquement pour les gyroscopes
    if (k.startsWith("Gyr") && state.rawGyrUnits === "degs") {
      return value *  Math.PI / 180;  // deg/s → rad/s
    }
    return value;
  }

  const headers = [
    'Chassis_Acc_X','Chassis_Acc_Y','Chassis_Acc_Z',
    'Chassis_Gyr_X','Chassis_Gyr_Y','Chassis_Gyr_Z',
    'RoueGauche_Acc_X','RoueGauche_Acc_Y','RoueGauche_Acc_Z',
    'RoueGauche_Gyr_X','RoueGauche_Gyr_Y','RoueGauche_Gyr_Z',
    'RoueDroite_Acc_X','RoueDroite_Acc_Y','RoueDroite_Acc_Z',
    'RoueDroite_Gyr_X','RoueDroite_Gyr_Y','RoueDroite_Gyr_Z'
  ];

  const n = Math.min(acqChassis.nbFrames, acqRD.nbFrames, acqRG.nbFrames);
  const lines = [headers];

  for (let i = 0; i < n; i++) {
    const row = [];

    ['AccX','AccY','AccZ','GyrX','GyrY','GyrZ'].forEach(k =>
      row.push(chassisMapping[k] ? convertIfGyr(k, acqChassis.Data[chassisMapping[k]]?.[i]) ?? "" : "")
    );
    ['AccX','AccY','AccZ','GyrX','GyrY','GyrZ'].forEach(k =>
      row.push(rgMapping[k] ? convertIfGyr(k, acqRG.Data[rgMapping[k]]?.[i]) ?? "" : "")
    );
    ['AccX','AccY','AccZ','GyrX','GyrY','GyrZ'].forEach(k =>
      row.push(rdMapping[k] ? convertIfGyr(k, acqRD.Data[rdMapping[k]]?.[i]) ?? "" : "")
    );

    lines.push(row);
  }

  return lines.map(l => l.join(";")).join("\n");
}

// Fonctions pour batch processing :
function populateBatchSelect(selectEl, selectedItem = null) {
  const appState = getAppState();

  selectEl.innerHTML = '';

  const opt = document.createElement('option');
  opt.value = '';
  opt.textContent = window.i18n?.t ? window.i18n.t('select_acquisition') : '— Choisir —';
  opt.disabled = true;
  opt.selected = true;
  opt.hidden = true;
  selectEl.appendChild(opt);

  appState.acquisitions
    .filter(acq => acq.category === 'raw')
    .forEach((acq, idx) => {
      const option = document.createElement('option');
      option.value = acq.fileName;
      option.textContent = acq.fileName;
      if (acq.fileName === selectedItem) option.selected = true;
      selectEl.appendChild(option);
    });
}

function addBatchRow() {
  const tbody = document.querySelector('#tableBatch tbody');
  const rowIndex = tbody.querySelectorAll('tr').length;
  if (!tbody) return;

  // Créer la nouvelle ligne
  const tr = document.createElement('tr');

  // --- Colonne 1 : input texte
  const tdInput = document.createElement('td');
  const input = document.createElement('input');
  input.type = 'text';
  input.placeholder = `batch_${rowIndex + 1}`;
  tdInput.appendChild(input);
  tr.appendChild(tdInput);

  // --- Colonnes 2 à 4 : selects
  for (let i = 0; i < 3; i++) {
    const tdSelect = document.createElement('td');
    const select = document.createElement('select');
    
    // On peut remplir chaque select avec populateBatchSelect
    populateBatchSelect(select);

    tdSelect.appendChild(select);
    tr.appendChild(tdSelect);
  }

  // Ajouter la ligne au tbody
  tbody.appendChild(tr);
}

function removeLastBatchRow() {
  const tbody = document.querySelector('#tableBatch tbody');
  if (!tbody) return;

  const rows = tbody.querySelectorAll('tr');
  if (rows.length <= 1) return;

  tbody.removeChild(rows[rows.length - 1]);
}

function refreshBatchSelects() {
  const selects = document.querySelectorAll('.batch-acq-select');
  selects.forEach(select => {
    const previousValue = select.value || null;
    populateBatchSelect(select, previousValue);
  });
}

function updateFirstBatchRowDisplay() {
  const tbody = document.querySelector('#tableBatch tbody');
  if (!tbody) return;

  const firstRow = tbody.querySelector('tr');
  if (!firstRow) return;

  // Récupère les trois cellules à remplir (après la première colonne input)
  const displayCells = firstRow.querySelectorAll('td');
  if (displayCells.length < 4) return;

  const input = displayCells[0].querySelector('input[type="text"]');
  if (input && !input.placeholder) {
    input.placeholder = 'batch_1';
  }

  const acqSelectChassis = document.getElementById('acqSelect');
  const acqSelectRD = document.getElementById('acqSelectRD');
  const acqSelectRG = document.getElementById('acqSelectRG');

  // La première cellule est l'input, donc on commence à la deuxième
  displayCells[1].textContent = acqSelectChassis?.selectedOptions[0]?.textContent ?? '—';
  displayCells[2].textContent = acqSelectRD?.selectedOptions[0]?.textContent ?? '—';
  displayCells[3].textContent = acqSelectRG?.selectedOptions[0]?.textContent ?? '—';
}


