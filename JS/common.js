// common.js
// Fonctions utilitaires partagées pour le chargement de fichiers et l'interface

// Helper pour accéder à l'objet state quelle que soit la page (pretraitement/locomotion)
function getAppState() {
  if (typeof state !== 'undefined') return state;
  if (!window.state) window.state = { acquisitions: [] };
  return window.state;
}

// -------------Fonction générique pour charger des fichiers -------------------
// files: FileList (e.target.files ou dataTransfer.files)
// category: optionnel, chaîne (ex: "Statique" ou "LigneDroite") permettant
//             d'indiquer que le fichier représente une catégorie particulière.
async function handleFiles(files, category = null) {
  if (!files || files.length === 0) return;

  const appState = getAppState();
  if (!Array.isArray(appState.acquisitions)) appState.acquisitions = [];

  for (const file of files) {
    const visibleName = file && file.name ? file.name : "(fichier)";
    const fileNameWithoutExt = visibleName.replace(/\.csv$/i, "");
    let idForRow = category;

    // Vérifier extension
    if (!visibleName.toLowerCase().endsWith('.csv')) {
      const key = 'row_wrongformat';
      const msg = (window.i18n && typeof window.i18n.t === 'function') ? window.i18n.t(key) : "Format non supporté (seuls les CSV sont acceptés)";
      addFileRow(visibleName, msg, true, idForRow, fileNameWithoutExt, key);
      continue;
    }

    // Vérifier doublon
    if (appState.acquisitions.some(acq => acq.fileName === fileNameWithoutExt && acq.category === category)) {
      const key = 'row_doublon';
      const msg = (window.i18n && typeof window.i18n.t === 'function') ? window.i18n.t(key) : "Fichier déjà chargé";
      addFileRow(visibleName, msg, true, idForRow, fileNameWithoutExt, key);
      continue;
    }

    try {
      const text = await file.text();
    const acq = new Acquisition(fileNameWithoutExt);
    acq.loadDataFromCSV(text);

    // Marquer la catégorie/type (Statique | LigneDroite | Acquis)
    acq.category = category;

    // Ajouter l'acquisition
    appState.acquisitions.push(acq);
      const key = 'row_loaded';
      const msg = (window.i18n && typeof window.i18n.t === 'function') ? window.i18n.t(key) : "Chargé";
      addFileRow(visibleName, msg, false, idForRow, fileNameWithoutExt, key);
    } catch (err) {
      const msgerr = (window.i18n && typeof window.i18n.t === 'function') ? window.i18n.t(err.message) : err.message;
      addFileRow(visibleName, msgerr, true, idForRow, fileNameWithoutExt, err.message);
    }
  }

  // Mettre à jour l'UI (table, bouton run)
  updateFileTableState(true);
}

// ---------------------- Show Status ----------------------
function showStatus(message, type = 'success', elementId = 'statusMsgLoad', duration = 3000) {
  const statusDiv = document.getElementById(elementId);
  if (!statusDiv) return;

  statusDiv.className = `status ${type}`;

  if (type === 'processing') {
    statusDiv.innerHTML = `<div class="loader"></div> ${message}`;
  } else if (type === 'partial') {
    statusDiv.textContent = `⚠️ ${message}`;
    if (duration > 0) setTimeout(() => { statusDiv.textContent = ''; statusDiv.className = 'status hidden'; }, duration);
  } else {
    statusDiv.textContent = message;
    if (duration > 0) setTimeout(() => { statusDiv.textContent = ''; statusDiv.className = 'status hidden'; }, duration);
  }

  statusDiv.classList.remove('hidden');
}

//----------------- Tableau chargement fichiers -----------------
// filename: nom visible (inclut extension)
// status: texte de statut
// isError: bool
// idTable: chaîne optionnelle fournie par l'appelant (ex: "Statique")
// acqName: nom interne de l'acquisition sans extension (utilisé pour retrouver l'objet dans state.acquisitions)
// filename, status (string), isError, idTable, acqName, statusKey (optional i18n key)
function addFileRow(filename, status, isError = false, idTable = null, acqName = null, statusKey = null) {
  // Choisir le tbody selon le type demandé
  let tbody = null;
  if (idTable === 'Statique') tbody = document.querySelector('#fileTableStatique tbody');
  else if (idTable === 'LigneDroite') tbody = document.querySelector('#fileTableLigneDroite tbody');
  else if (idTable === 'Acquis') tbody = document.querySelector('#fileTableAcquis tbody');
  else tbody = document.querySelector('#fileTable tbody');

  if (!tbody) {
    // fallback : essayer le tableau principal
    tbody = document.querySelector('#fileTable tbody');
    if (!tbody) {
      console.warn('Aucun tableau de fichiers trouvé pour ajouter la ligne');
      return;
    }
  }

  const row = document.createElement('tr');
  if (idTable) row.dataset.type = idTable;

  const nameCell = document.createElement('td');
  nameCell.textContent = idTable ? `${filename} (${idTable})` : filename;

  const statusCell = document.createElement('td');
  // If a translation key was provided, prefer using i18n.t and register a listener to update on language change
  if (statusKey && window.i18n && typeof window.i18n.t === 'function') {
    try {
      statusCell.textContent = window.i18n.t(statusKey);
    } catch (e) {
      statusCell.textContent = status;
    }
      // subscribe to language changes
    if (window.i18n && typeof window.i18n.onChange === 'function') {
      const updater = () => {
        try { statusCell.textContent = window.i18n.t(statusKey); } catch (e) { /* ignore */ }
      };
      window.i18n.onChange(updater);
      // keep a direct reference so we can unregister later
      statusCell._i18nUpdater = updater;
    }
  } else {
    statusCell.textContent = status;
  }
  // marquer la ligne entière (utile pour colorer toute la ligne)
  row.classList.add(isError ? 'error' : 'success');

  const actionCell = document.createElement('td');
  actionCell.style.textAlign = 'center';
  actionCell.style.verticalAlign = 'middle';

  const removeBtn = document.createElement('button');
  removeBtn.innerHTML = '✖';
  removeBtn.style.color = '#dc3545';
  removeBtn.style.background = 'transparent';
  removeBtn.style.border = 'none';
  removeBtn.style.cursor = 'pointer';
  removeBtn.style.fontWeight = 'bold';
  removeBtn.style.fontSize = '1.1em';
  removeBtn.style.lineHeight = '1';
  removeBtn.style.padding = '0';
  removeBtn.style.margin = '0';

  removeBtn.dataset.acqName = acqName || filename.replace(/\.csv$/i, '');

  removeBtn.addEventListener('click', () => {
    // before removing the row, unregister any i18n listener attached to the status cell
    try {
      const statusCellBefore = row.querySelector('td:nth-child(2)');
      if (statusCellBefore && statusCellBefore._i18nUpdater && window.i18n && typeof window.i18n.offChange === 'function') {
        try { window.i18n.offChange(statusCellBefore._i18nUpdater); } catch(e) { /* ignore */ }
        try { delete statusCellBefore._i18nUpdater; } catch(e) { /* ignore */ }
      }
    } catch(e) { /* ignore */ }
    row.remove();

    const appState = getAppState();
    if (!isError && appState && Array.isArray(appState.acquisitions)) {
      const idx = appState.acquisitions.findIndex(a => a.fileName === removeBtn.dataset.acqName);
      if (idx !== -1) {
        // Supprimer l'acquisition de l'état uniquement.
        // Ne pas supprimer le conteneur du chronogramme ni modifier currentAcq
        appState.acquisitions.splice(idx, 1);
      }
    }

    updateFileTableState(true);
  });

  actionCell.appendChild(removeBtn);
  row.appendChild(nameCell);
  row.appendChild(statusCell);
  row.appendChild(actionCell);
  tbody.appendChild(row);

  updateFileTableState(true);
}

// ----------------- Mise à jour de l'état du tableau et boutons -----------------
// callWithBtnValidate true => on tentera de mettre à jour l'état du bouton btnValidate s'il existe
function updateFileTableState(callWithBtnValidate = false) {
  // containers et leurs tbodies
  const tbodyMain = document.querySelector('#fileTable tbody');
  const tbodyStat = document.querySelector('#fileTableStatique tbody');
  const tbodyLigne = document.querySelector('#fileTableLigneDroite tbody');
  const tbodyAcquis = document.querySelector('#fileTableAcquis tbody');

  const containerMain = document.getElementById('fileTableContainer');
  const containerStat = document.getElementById('fileTableContainerStatique');
  const containerLigne = document.getElementById('fileTableContainerLigneDroite');
  const containerAcquis = document.getElementById('fileTableContainerAcquis');

  const btnValidate = callWithBtnValidate ? document.getElementById('btnValidate') : null;

  if (containerStat && tbodyStat) containerStat.classList.toggle('hidden', tbodyStat.children.length === 0);
  if (containerLigne && tbodyLigne) containerLigne.classList.toggle('hidden', tbodyLigne.children.length === 0);
  if (containerAcquis && tbodyAcquis) containerAcquis.classList.toggle('hidden', tbodyAcquis.children.length === 0);

  // fallback / main container: visible si au moins un des tableaux a des lignes
  const anyRows = [tbodyMain, tbodyStat, tbodyLigne, tbodyAcquis].some(tb => tb && tb.children.length > 0);
  if (containerMain) containerMain.classList.toggle('hidden', !anyRows);

  const appState = getAppState();
  if (btnValidate) btnValidate.disabled = !(appState && Array.isArray(appState.acquisitions) && appState.acquisitions.length > 0);
}

// Activer/désactiver tous les boutons présents dans le tableau d'une catégorie
// category: 'Statique' | 'LigneDroite' | 'Acquis'
function setFileTableButtonsState(category, disabled) {
  let tableSelector = null;
  if (category === 'Statique') tableSelector = '#fileTableStatique';
  else if (category === 'LigneDroite') tableSelector = '#fileTableLigneDroite';
  else if (category === 'Acquis') tableSelector = '#fileTableAcquis';
  else if (category === 'DetectionTache') tableSelector = '#fileTable';
  if (!tableSelector) return;

  const tbody = document.querySelector(`${tableSelector} tbody`);
  if (!tbody) return;

  const buttons = tbody.querySelectorAll('button');
  buttons.forEach(btn => {
    try {
      if (disabled) {
        btn.style.display = 'none';
      } else {
        btn.style.display = '';
      }
    } catch (e) { /* ignore */ }
  });

  // Additionally hide/show the entire "action" column (3rd column)
  // Hide the header TH if present
  const tableEl = document.querySelector(tableSelector);
  if (tableEl) {
    const headerCell = tableEl.querySelector('thead th:nth-child(3)');
    if (headerCell) headerCell.style.display = disabled ? 'none' : '';

    // Hide/show the 3rd TD in each body row
    const rows = tableEl.querySelectorAll('tbody tr');
    rows.forEach(r => {
      const actionCell = r.querySelector('td:nth-child(3)');
      if (actionCell) actionCell.style.display = disabled ? 'none' : '';
    });
  }
}

// Marquer une acquisition comme traitée dans le tableau (étape 5)
// acqName: nom interne de l'acquisition sans extension (correspond à data-acq-name)
function markAcquisitionTreated(acqName) {
  if (!acqName) return;
  // Priorité: table Acquis, fallback to main table
  const tbodyAcquis = document.querySelector('#fileTableAcquis tbody');
  const tbodyMain = document.querySelector('#fileTable tbody');
  const searchContainers = [tbodyAcquis, tbodyMain].filter(Boolean);

  for (const tbody of searchContainers) {
    // chercher le bouton avec data-acq-name
    const btn = tbody.querySelector(`button[data-acq-name="${acqName}"]`);
    if (!btn) continue;
    const row = btn.closest('tr');
    if (!row) continue;
    const statusCell = row.querySelector('td:nth-child(2)');
    if (statusCell) {
      statusCell.textContent = (window.i18n && typeof window.i18n.t === 'function') ? window.i18n.t('table_done') : "Traité ✅";
    }
  }
}

// Compute Savitzky-Golay filter rows (pseudo-inverse). Returns an object with
// smoothing and derivative coefficients already scaled according to Fe (h = 1/Fe)
function getSGFilters(window, polyOrder, Fe) {
  const m = (window - 1) / 2;
  const fen = [];
  for (let i=-m;i<=m;i++) fen.push(i);
  const d = polyOrder;
  const polyExp = Array.from({length:d+1}, (_,i)=>i);
  const J = fen.map(f => polyExp.map(p => Math.pow(f,p)));
  const Jt = numeric.transpose(J);
  const AtA = numeric.dot(Jt, J);
  const invAtA = numeric.inv(AtA);
  const pseudo = numeric.dot(invAtA, Jt);

  const h = 1 / Fe;
  // smoothing row (0th), derivative rows scaled like MATLAB implementation
  const smooth = pseudo[0].slice();
  const deriv1 = (pseudo[1] || Array(window).fill(0)).map(c => c * (1 / h));
  const deriv2 = (pseudo[2] || Array(window).fill(0)).map(c => c * (2 / (h * h)));
  return { smooth, deriv1, deriv2 };
}

// Apply convolution with mirror padding. NaN values in data are treated as 0 in accumulation.
function applySGFilter(data, coeffs) {
  const n = data.length;
  const half = Math.floor(coeffs.length / 2);
  const t = numeric.linspace(0, n - 1, n);
  const t2 = numeric.linspace(-half, n - 1 + half, n + 2 * half);
  const data_ext = pchipInterpolate(t, data, t2);

  const out = new Array(n);
  for (let i = 0; i < n; i++) {
    let acc = 0;
    for (let k = 0; k < coeffs.length; k++) {
      acc += coeffs[k] * data_ext[i + k];
    }
    out[i] = acc;
  }
  return out;
}

// Compute arithmetic mean over arr[start..end] ignoring NaN values.
// If start/end omitted, defaults to full array. Returns NaN when no valid values.
function meanIgnoringNaN(arr, start = 0, end = null) {
  if (!Array.isArray(arr)) return NaN;
  const s = Math.max(0, start | 0);
  const e = end == null ? arr.length : Math.min(arr.length, end | 0);
  let sum = 0;
  let count = 0;
  for (let i = s; i < e; i++) {
    const v = arr[i];
    if (Number.isFinite(v)) { sum += v; count++; }
  }
  return count ? (sum / count) : NaN;
}

// Filtre de moyenne glissante centrée avec extrapolation linéaire aux bords 
function movingAverage(data, n = 5) {
  if (!Array.isArray(data) || data.length === 0) return [];
  if (n < 1 || n % 2 === 0) throw new Error("n doit être impair et >= 1");

  const n2 = Math.floor((n - 1) / 2);
  const len = data.length;

  // --- 1️⃣ Extrapolation linéaire aux bords
  const a2 = new Array(len + 2 * n2);
  
  // copie au centre
  for (let i = 0; i < len; i++) {
    a2[n2 + i] = data[i];
  }

  // extrapolation avant
  for (let i = 1; i <= n2; i++) {
    a2[n2 - i] = a2[n2] - (a2[n2 + i] - a2[n2]);
  }

  // extrapolation après
  const end = n2 + len - 1;
  for (let i = 1; i <= n2; i++) {
    a2[end + i] = a2[end] - (a2[end - i] - a2[end]);
  }

  // --- 2️⃣ Lissage - sens horaire
  const a3 = [...a2];
  for (let i = n2; i < a2.length - n2; i++) {
    let sum = 0;
    for (let k = -n2; k <= n2; k++) {
      sum += a2[i + k];
    }
    a3[i] = sum / n;
  }

  // --- 3️⃣ Lissage - sens antihoraire
  const a4 = [...a3];
  for (let i = n2; i < a2.length - n2; i++) {
    const j = a2.length - 1 - i;
    let sum = 0;
    for (let k = -n2; k <= n2; k++) {
      sum += a4[j + k];
    }
    a4[j] = sum / n;
  }

  // --- 4️⃣ Extraire la partie centrale (signal lissé)
  const result = a4.slice(n2, n2 + len);

  return result;
}

// ------------- Calcul rpr_mvt_un_axe -------------------
function Rpr_mvt_un_axe(data, axePrincipal) {
  const [x, y, z] = data;
  const norme = Math.sqrt(x ** 2 + y ** 2 + z ** 2);
  const Xnorm = x / norme;
  const Ynorm = y / norme;
  const Znorm = z / norme;

  switch (axePrincipal) {
    case 0: // X dominant
      {
        const epsilon = Math.atan(Ynorm / Xnorm);
        const gamma = Math.atan((-Znorm * Math.sin(epsilon)) / Ynorm);

        Rz = [
          [Math.cos(epsilon), -Math.sin(epsilon), 0],
          [Math.sin(epsilon), Math.cos(epsilon), 0],
          [0, 0, 1]
        ];

        Ry = [
          [Math.cos(gamma), 0, Math.sin(gamma)],
          [0, 1, 0],
          [-Math.sin(gamma), 0, Math.cos(gamma)]
        ];

        M = numeric.dot(Ry, Rz);
      }
      break;
    case 1: // Y dominant
       {
        const alpha = Math.atan(Znorm / Ynorm);
        const beta = Math.atan((-Xnorm * Math.sin(alpha)) / Znorm);

        Rz = [
          [Math.cos(beta), -Math.sin(beta), 0],
          [Math.sin(beta), Math.cos(beta), 0],
          [0, 0, 1]
        ];

        Rx = [
          [1, 0, 0],
          [0, Math.cos(alpha), -Math.sin(alpha)],
          [0, Math.sin(alpha), Math.cos(alpha)]
        ];

        M = numeric.dot(Rx, Rz);
      }
      break; 
    case 2: // Z dominant
      {
        const beta = Math.atan(Xnorm / Znorm);
        const alpha = Math.atan((-Ynorm * Math.cos(beta)) / Znorm);

        Rx = [
          [1, 0, 0],
          [0, Math.cos(alpha), -Math.sin(alpha)],
          [0, Math.sin(alpha), Math.cos(alpha)]
        ];

        Ry = [
          [Math.cos(beta), 0, Math.sin(beta)],
          [0, 1, 0],
          [-Math.sin(beta), 0, Math.cos(beta)]
        ];

        M = numeric.dot(Ry, Rx);
      }
      break;
    }
    return numeric.inv(M)
}

// ------------opérations sur les matrices -------------------
// Moyenne par colonnes
function meanMatrixRows(mat) {
  const n = mat.length;
  const sum = [0,0,0];
  for (let i=0;i<n;i++) for (let j=0;j<3;j++) sum[j] += mat[i][j];
  return sum.map(v => v/n);
}

// Soustraction d'un vecteur à chaque ligne
function subtractMatrixRows(mat, vec) {
  return mat.map(r => r.map((v,i)=>v-vec[i]));
}

// Ajout vecteurs
function addVectors(a,b){return a.map((v,i)=>v+b[i])}

// Fonction trapz (intégrale numérique par la règle des trapèzes)
function trapz(y) {
  let s = 0;
  for (let i = 0; i < y.length - 1; i++) {
    s += 0.5 * (y[i] + y[i + 1]);
  }
  return s;
}

function tand(deg) {
  return Math.tan(deg * Math.PI / 180);
}

function cosd(deg) {
  return Math.cos(deg * Math.PI / 180);
}

// Conception filtre Butterworth passe-bas (bilinéaire, comme MATLAB)
function butterworth2Lowpass(fc, fs) {

    const wc = Math.tan(Math.PI * fc / fs); // pré-warping
    const k1 = Math.sqrt(2) * wc;
    const k2 = wc * wc;

    const a0 = 1 + k1 + k2;
    const a1 = 2 * (k2 - 1);
    const a2 = 1 - k1 + k2;

    const b0 = k2;
    const b1 = 2 * k2;
    const b2 = k2;

    // Normalisation comme MATLAB (a0 = 1)
    return {
        b: [b0/a0, b1/a0, b2/a0],
        a: [1, a1/a0, a2/a0]
    };
}

function filtfilt(b, a, x){
  // Gustafsson-like initialization for forward-backward filtering.
  // Compute initial state zi by solving the steady-state linear system (lfilter_zi),
  // then apply direct-form II filtering forward and backward using these states.
  if (!Array.isArray(b) || !Array.isArray(a) || !Array.isArray(x)) return x;

  // Normalize so that a[0] == 1
  const a0 = a[0];
  const aN = a.map(v => v / a0);
  const bN = b.map(v => v / a0);

  const na = aN.length;
  const nb = bN.length;
  const n = Math.max(na, nb);
  const m = Math.max(0, n - 1); // state vector length

  // direct-form II lfilter with initial state zi (length m)
  function lfilter_df2(b, a, xin, zi_in) {
    const N = Math.max(a.length, b.length);
    // pad b and a to length N
    const bb = b.slice(); while (bb.length < N) bb.push(0);
    const aa = a.slice(); while (aa.length < N) aa.push(0);

    const mlen = Math.max(0, N - 1);
    const z = new Array(mlen).fill(0);
    if (Array.isArray(zi_in)) {
      for (let i = 0; i < Math.min(mlen, zi_in.length); i++) z[i] = zi_in[i];
    }

    const y = new Array(xin.length).fill(0);
    for (let nidx = 0; nidx < xin.length; nidx++) {
      const xn = xin[nidx];
      const y0 = (bb[0] * xn) + (mlen > 0 ? z[0] : 0);
      y[nidx] = y0;
      if (mlen > 0) {
        for (let i = 0; i < mlen - 1; i++) {
          z[i] = bb[i + 1] * xn + z[i + 1] - aa[i + 1] * y0;
        }
        z[mlen - 1] = bb[mlen] * xn - aa[mlen] * y0;
      }
    }
    return { y: y, zf: z };
  }

  // compute lfilter steady-state initial conditions for unit step input
  function lfilter_zi(b, a) {
    // ensure arrays are same length
    const N = Math.max(a.length, b.length);
    const aa = a.slice(); while (aa.length < N) aa.push(0);
    const bb = b.slice(); while (bb.length < N) bb.push(0);

    const mlen = Math.max(0, N - 1);
    if (mlen === 0) return [];

    // Build matrix M (mlen x mlen)
    const M = Array.from({ length: mlen }, () => new Array(mlen).fill(0));
    for (let i = 0; i < mlen; i++) {
      for (let j = 0; j < mlen; j++) M[i][j] = 0;
      M[i][i] = 1;
      if (i + 1 < mlen) M[i][i + 1] = -1;
      // add a[i+1] term to column 0
      M[i][0] += aa[i + 1];
    }

    // rhs = (b[1:] - a[1:]*b[0])
    const rhs = new Array(mlen).fill(0);
    for (let i = 0; i < mlen; i++) {
      rhs[i] = bb[i + 1] - aa[i + 1] * bb[0];
    }

    // Solve M * zi = rhs
    try {
      const Minv = numeric.inv(M);
      const zi_vec = numeric.dot(Minv, rhs);
      return zi_vec;
    } catch (e) {
      // fallback to zeros
      return new Array(mlen).fill(0);
    }
  }

  // if trivial filter (no states), just forward-backward simple lfilter
  if (m === 0) {
    const f1 = lfilter_df2(bN, aN, x, []);
    const rev = f1.y.slice().reverse();
    const f2 = lfilter_df2(bN, aN, rev, []);
    return f2.y.slice().reverse();
  }

  // compute unit-step zi and scale by initial samples
  const zi_unit = lfilter_zi(bN, aN); // length m
  const x0 = x.length ? x[0] : 0;
  const zi_fwd = zi_unit.map(v => v * x0);

  // forward filter with initial state
  const fwd = lfilter_df2(bN, aN, x, zi_fwd);

  // backward filter: compute initial state scaled by first value of reversed signal
  const yrev0 = fwd.y.length ? fwd.y[fwd.y.length - 1] : 0; // last of forward is first of reversed
  const zi_bwd = zi_unit.map(v => v * yrev0);
  const rev_in = fwd.y.slice().reverse();
  const bwd = lfilter_df2(bN, aN, rev_in, zi_bwd);
  const y = bwd.y.slice().reverse();
  return y;
}

// Intégration numérique cumulative (méthode des trapèzes)
function integrateCumulative(signal, dt) {
  const result = [0];
  for (let i = 1; i < signal.length; i++) {
    const val = result[i - 1] + ((signal[i - 1] + signal[i]) / 2) * dt;
    result.push(val);
  }
  return result;
}

// --- Interpolation cubique type PCHIP (Piecewise Cubic Hermite)
function pchipInterpolate(x, y, xi) {
  const n = x.length;
  const h = new Array(n - 1);
  const delta = new Array(n - 1);

  for (let i = 0; i < n - 1; i++) {
    h[i] = x[i + 1] - x[i];
    delta[i] = (y[i + 1] - y[i]) / h[i];
  }

  // calcul des pentes m[i]
  const m = new Array(n);
  m[0] = delta[0];
  m[n - 1] = delta[n - 2];
  for (let i = 1; i < n - 1; i++) {
    if (delta[i - 1] * delta[i] > 0) {
      const w1 = 2 * h[i] + h[i - 1];
      const w2 = h[i] + 2 * h[i - 1];
      m[i] = (w1 + w2) > 0 ? (w1 + w2) / ((w1 / delta[i - 1]) + (w2 / delta[i])) : 0;
    } else {
      m[i] = 0;
    }
  }

  // interpolation + extrapolation cubique
  const yi = [];
  for (const xq of xi) {
    let i = 0;
    if (xq <= x[0]) i = 0;
    else if (xq >= x[n - 1]) i = n - 2;
    else {
      while (i < n - 2 && xq > x[i + 1]) i++;
    }

    const h_i = h[i];
    const t = (xq - x[i]) / h_i;
    const h00 = (1 + 2 * t) * Math.pow(1 - t, 2);
    const h10 = t * Math.pow(1 - t, 2);
    const h01 = t * t * (3 - 2 * t);
    const h11 = t * t * (t - 1);
    yi.push(h00 * y[i] + h10 * h_i * m[i] + h01 * y[i + 1] + h11 * h_i * m[i + 1]);
  }
  return yi;
}

// ------------------ Help dropdown (attach to #helpBtn) ------------------
// Creates a shared dropdown menu positioned under the help button.
(function initHelpDropdown(){
  // create menu DOM once
  let menu = null;
  function buildMenu() {
    if (menu) return menu;
    menu = document.createElement('div');
    menu.className = 'help-menu hidden';
    menu.id = 'helpMenu';
    menu.setAttribute('role','menu');

    // create menu items with i18n attributes so runtime i18n can set text and href
    const items = [
      { key: 'help_manual', hrefKey: 'help_manual_href' },
      { key: 'help_explication', hrefKey: 'help_explication_href' }
    ];

    for (const it of items) {
      const a = document.createElement('a');
      a.className = 'help-menu-item';
      a.setAttribute('data-i18n', it.key);
      a.setAttribute('data-i18n-href', it.hrefKey);
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      a.setAttribute('role','menuitem');
      a.textContent = it.key;
      menu.appendChild(a);
    }

    document.body.appendChild(menu);
    return menu;
  }

  function closeMenu() {
    if (!menu) return;
    menu.classList.add('hidden');
    menu.style.left = '';
    menu.style.top = '';
    // update button aria-expanded if present
    const btns = document.querySelectorAll('#helpBtn');
    btns.forEach(b => b.setAttribute('aria-expanded','false'));
  }

  function openMenuUnderButton(btn) {
    const m = buildMenu();
    // applyTranslations(m);
    // toggle if already open under same button
    const isHidden = m.classList.contains('hidden');
    // close any existing then possibly open
    closeMenu();
    if (!isHidden) return; // it was visible -> now closed

    const rect = btn.getBoundingClientRect();
    // position: below the button, right-aligned with the button's right edge
    m.style.position = 'absolute';
    m.style.left = '0px';
    m.style.top = '-9999px';
    m.classList.remove('hidden'); // temporarily show to measure
    const menuWidth = m.offsetWidth || 220;
    // compute left so that menu's right edge equals button's right edge
    let left = rect.right + window.scrollX - menuWidth;
    // ensure it doesn't go off-screen to the left
    left = Math.max(8 + window.scrollX, left);
    const top = rect.bottom + 6 + window.scrollY;
    m.style.left = left + 'px';
    m.style.top = top + 'px';
    btn.setAttribute('aria-expanded','true');
  }

  // close on outside click or Escape
  document.addEventListener('click', function(ev){
    const menuEl = document.getElementById('helpMenu');
    if (!menuEl || menuEl.classList.contains('hidden')) return;
    const target = ev.target;
    // if the click is inside the menu or on a help button, keep it
    if (menuEl.contains(target)) return;
    if (target && (target.id === 'helpBtn' || target.closest && target.closest('#helpBtn'))) return;
    closeMenu();
  }, true);

  document.addEventListener('keydown', function(ev){
    if (ev.key === 'Escape' || ev.key === 'Esc') {
      const menuEl = document.getElementById('helpMenu');
      if (menuEl && !menuEl.classList.contains('hidden')) {
        closeMenu();
        ev.stopPropagation();
      }
    }
  });

  // Attach click handler to all help buttons (may be several across pages)
  function attachHandlers() {
    const btns = document.querySelectorAll('#helpBtn');
    if (!btns || btns.length === 0) return;
    btns.forEach(btn => {
      btn.setAttribute('aria-haspopup','true');
      btn.setAttribute('aria-expanded','false');
      btn.addEventListener('click', function(ev){
        ev.preventDefault();
        openMenuUnderButton(btn);
      });
    });
  }

  // wait for DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', attachHandlers);
  } else {
    attachHandlers();
  }


})();

