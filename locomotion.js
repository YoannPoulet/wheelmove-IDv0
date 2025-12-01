// État global de l'application
const state = {
  acquisitions: [],       // Liste des acquisitions
  currentAcq: null,       // Acquisition en cours
  freqAcq: 100,           // Fréquence d’échantillonnage
  segmentationSize: 25,   // Taille fenêtre segmentation
  maxLookBack: 30,       // Combien de frames pour affinage seuils
  maxLookAhead: 30,      // Combien de frames pour affinage seuils


  // Seuils utilisés
  seuils: {
    vitLinAbs: 0.5,
    vitAngAbs: 40,
    rayonSerre: 0.2,
    rayonLarge: 0.5,
    secondSeuil_vitLinAbs: 0.1,
    secondSeuil_vitAngAbs: 10
  },

  // Valeurs par défaut pour reset
  defSeuils: {
    freqAcq: 100,
    vitLinAbs: 0.5,
    vitAngAbs: 40,
    rayonSerre: 0.2,
    rayonLarge: 0.5,
    secondSeuil_vitLinAbs: 0.1,
    secondSeuil_vitAngAbs: 10
  },

  // Paramètres interface
  showVitLin: true,
  showVitAng: false
};

//Couleur des tâches
const TASKS = {
  1: { label: "Statique", color: "rgba(255,0,0,0.2)" },
  2: { label: "Propulsion avant", color: "rgba(0,255,0,0.2)" },
  3: { label: "Propulsion arrière", color: "rgba(255,255,0,0.2)" },
  4: { label: "Pivot", color: "rgba(255,0,255,0.2)" },
  5: { label: "Virage serré", color: "rgba(0,255,255,0.2)" },
  6: { label: "Virage large", color: "rgba(0,0,255,0.2)" }
};

// Classe Acquisition
class Acquisition {
  constructor(fileName) {
    this.fileName = fileName;
    this.containerId = 'chronogramme-' + fileName.replace(/\W+/g, "_");
    this.vitLin = [];
    this.vitLinAbs = [];
    this.vitAngDegSec = [];
    this.vitAngDegSecAbs = [];
    this.RayonCourbure = [];
    this.nbFrames = 0;
    this.signalUnique = [];
  }

// Charger les données CSV dans l'objet
  loadDataFromCSV(csvText) { 
    const lines = csvText.trim().split('\n');
    const headers = lines[0].split(';').map(h => h.trim());
    const idxVitLin = headers.findIndex(h => h.toLowerCase().includes('lin'));
    const idxVitAng = headers.findIndex(h => h.toLowerCase().includes('ang'));
    if (idxVitLin === -1 || idxVitAng === -1) throw new Error("Colonnes manquantes dans " + this.fileName);

    this.nbFrames = lines.length - 1;

    this.vitLin = [];
    this.vitLinAbs = [];
    this.vitAngDegSec = [];
    this.vitAngDegSecAbs = [];
    this.RayonCourbure = [];

    for (let i = 1; i < lines.length; i++) {
      const row = lines[i].split(';').map(s => s.trim());
      const vLin = parseFloat(row[idxVitLin].replace(',', '.'));
      const vAng = parseFloat(row[idxVitAng].replace(',', '.'));

      if (isNaN(vLin) || isNaN(vAng)) {
      throw new Error("Données manquantes (NaN) dans " + this.fileName);
      }

      this.vitLin.push(vLin);
      this.vitLinAbs.push(Math.abs(vLin));
      this.vitAngDegSec.push(vAng);
      this.vitAngDegSecAbs.push(Math.abs(vAng));
      const vitAngRads = vAng * (Math.PI / 180); // conversion en rad/s
      this.RayonCourbure.push(vitAngRads !== 0 ? Math.abs(vLin / vitAngRads) : NaN);
    }
  }
}

// ================ Gestion dynamique de la page (légendes et seuils)  ===================
// Générer la légende au chargement de la page
document.addEventListener("DOMContentLoaded", renderLegend);

//Initialisation de seuils au chargement de la page
window.addEventListener("DOMContentLoaded", () => {
    setDefaultSeuils(); //Charger les valeurs par défaut des seuils
    updateSeuilsFromInputs(); // Synchroniser les variables JS avec les inputs

    // Cacher les paramètres
    const d = document.getElementById("detailsParam");
    d.dataset.locked = 'true';
 
    const summary = d.querySelector('summary');
    if (!summary) return;

    // Use capture-phase click listener to prevent default toggle without flicker.
    summary.addEventListener('click', (ev) => {
      if (ev.target.closest('.summary-buttons')) {
        ev.preventDefault();
        return;
      }
      // If the detail is locked, prevent ANY click on the summary from toggling it
      if (d.dataset.locked === 'true') {
        ev.preventDefault();
        ev.stopPropagation();
        ev.stopImmediatePropagation();
        return;
      }
      // Otherwise allow the normal toggle
    }, true);

  // Initialiser les boutons de gestion des paramètres comme désactivés
  document.getElementById('btnLoadParameters').disabled = true;
  document.getElementById('btnExportParameters').disabled = true;
  document.getElementById('resetSeuilsBtn').disabled = true;
});

function setDefaultSeuils() {
    document.getElementById("freqAcq").value = state.defSeuils.freqAcq;
    document.getElementById("seuilVitLinAbs").value = state.defSeuils.vitLinAbs
    document.getElementById("seuilVitAngAbs").value = state.defSeuils.vitAngAbs;
    document.getElementById("seuilRayonMin").value = state.defSeuils.rayonSerre;
    document.getElementById("seuilRayonMax").value = state.defSeuils.rayonLarge;
    document.getElementById("newSeuilVitLinAbs").value = state.defSeuils.secondSeuil_vitLinAbs;
    document.getElementById("newSeuilVitAngAbs").value = state.defSeuils.secondSeuil_vitAngAbs;
}

function updateSeuilsFromInputs() {
    state.freqAcq = parseFloat(document.getElementById("freqAcq").value);
    state.seuils.vitLinAbs = parseFloat(document.getElementById("seuilVitLinAbs").value);
    state.seuils.vitAngAbs = parseFloat(document.getElementById("seuilVitAngAbs").value);
    state.seuils.rayonSerre  = parseFloat(document.getElementById("seuilRayonMin").value);
    state.seuils.rayonLarge  = parseFloat(document.getElementById("seuilRayonMax").value);
    state.seuils.secondSeuil_vitLinAbs = parseFloat(document.getElementById("newSeuilVitLinAbs").value);
    state.seuils.secondSeuil_vitAngAbs = parseFloat(document.getElementById("newSeuilVitAngAbs").value);
}

// ========================== Gestion des boutons ==========================
// 1. Bouton chargement des données
document.getElementById('loadDataBtn').addEventListener('click', () => {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = ".csv";
  input.multiple = true;

  input.addEventListener("change", (e) => {
    const files = e.target.files;

    // Si des fichiers ont été sélectionnés :
    if (files && files.length > 0) {
      handleFiles(files);
      affichageParametresSeuils()
    }
  });

  input.click();
});

// 1.1. Zone de drag and drop
const dropZone = document.getElementById("dropZone");
const loadDataBtn = document.getElementById("loadDataBtn");

// Simule un clic sur le bouton si on clique sur la zone
dropZone.addEventListener("click", () => {
  loadDataBtn.click();
});
// Highlight visuel quand on survole avec un fichier
dropZone.addEventListener("dragover", (e) => {
  e.preventDefault();
  dropZone.classList.add("dragover");
});
dropZone.addEventListener("dragleave", () => {
  dropZone.classList.remove("dragover");
});
// Gestion du dépôt
dropZone.addEventListener("drop", async (e) => {
  e.preventDefault();
  dropZone.classList.remove("dragover");
  await handleFiles(e.dataTransfer.files);
  affichageParametresSeuils()
});

// 1.5 Bouton validation des fichiers et paramètres
document.getElementById('btnValidateFilesParam').addEventListener('click', () => {
  showStatus("✅ Fichiers et paramètres validés", "success", "statusMsgValidate", 3000);
  updateSeuilsFromInputs()

  //Cacher les paramètres
  const d = document.getElementById("detailsParam");
  d.open = false;

  //Empecher la suppression des acquisitions
  setFileTableButtonsState('DetectionTache', true);

  //Enlever la mise en forme du bouton
  document.getElementById("btnValidateFilesParam").classList.remove("highlight-btn");

  //Permettre le clic sur le bouton suivant en le mettant en avant
  document.getElementById('btnRunPipeline').disabled = false;
  document.getElementById("btnRunPipeline").classList.add("highlight-btn");
});

//2. Bouton calcul des tâches et plot graphe
document.getElementById('btnRunPipeline').addEventListener('click', () => {
    document.getElementById("chronogrammesContainer").innerHTML = ""; // Vider les chronogrammes précédents
    state.segmentationSize = state.freqAcq / 4; //Fenêtre de traitement de 0.25s (choix arbitraire)
    processFilesOnebyOne();

    //Enlever la mise en forme du bouton
    document.getElementById("btnRunPipeline").classList.remove("highlight-btn");

    //Permettre le clic sur le bouton suivant en le mettant en avant
    document.getElementById('saveDataBtn').disabled = false;
    document.getElementById("saveDataBtn").classList.add("highlight-btn");

    // reveal legend and mark as visible; keep it visible thereafter
    document.getElementById('plotPanel').classList.add('visible');
    document.getElementById('plotPanel').setAttribute('aria-hidden','false');
    document.getElementById('legendPanel').classList.add('visible');
    document.getElementById('legendPanel').setAttribute('aria-hidden','false');
});

//3. Boutons load, save et template paramètres
document.getElementById('btnLoadParameters').addEventListener('click', () => {
    importJson()//Charger les paramètres
});
document.getElementById('btnExportParameters').addEventListener('click', () => {
    exportJson()//Exporter les paramètres
});

//4. Bouton de reset des seuils
document.getElementById("resetSeuilsBtn").addEventListener("click", () => {
    setDefaultSeuils(); //Charger les valeurs par défaut des seuils
    updateSeuilsFromInputs(); // Synchroniser les variables JS avec les inputs
});

//5. TickBox chronogramme 
document.getElementById("chkVitLin").addEventListener("change", (e) => {
    state.showVitLin = e.target.checked;
    if (!state.acquisitions || state.acquisitions.length === 0) return;

    state.acquisitions.forEach(acq => {
        plotChronogramme(acq);
    });
});
document.getElementById("chkVitAng").addEventListener("change", (f) => {
    state.showVitAng = f.target.checked;
    if (!state.acquisitions || state.acquisitions.length === 0) return;
    state.acquisitions.forEach(acq => {
        plotChronogramme(acq);
    });
});

// 6. Bouton sauvegarde des résultats
document.getElementById('saveDataBtn').addEventListener('click', () => {
    if (!state.acquisitions || state.acquisitions.length === 0) {
      console.warn("Aucune acquisition à traiter.");
      return;
    }

    state.acquisitions.forEach(acq => {
      console.log(`%%% Sauvegarde des résultats %%%`);
      saveDataCSV(acq);
    });

    //Message enregistrement réussi
    showStatus("✅ Résultats enregistrés", "success","statusMsgSave");

    //Enlever la mise en forme du bouton
    document.getElementById("saveDataBtn").classList.remove("highlight-btn");
});

// 7. Bouton export légende
document.getElementById('btnExportLegend').addEventListener('click', () => {
    exportJson(true)//Exporter la légende
});

// ================ Boucle sur les fichiers chargés ======================
async function processFilesOnebyOne() {
  if (!state.acquisitions || state.acquisitions.length === 0) {
    console.warn("Aucune acquisition à traiter.");
    return;
  }

  showStatus("En cours …", "processing", "statusMsgRun");
  // Forcer un rafraîchissement et un délai avant les calculs 
  await new Promise(resolve => requestAnimationFrame(resolve));
  await new Promise(resolve => setTimeout(resolve, 20)); 

  for (const acq of state.acquisitions) {
    console.log(`Traitement du fichier : ${acq.fileName}`);
    await runPipelineAsync(acq);  // attendre la fin avant de passer au suivant
  }

  showStatus("✅ Traitement terminé !", "success", "statusMsgRun", 3000);
  console.log("%%% Traitement de toutes les acquisitions terminé %%%");
}

// ====================== PIPELINE LOCOMOTION ======================
function runPipeline(acq) {
  // --- 0) Vérifier si des données sont chargées ---
  if (!acq.vitLin || acq.vitLin.length === 0 || !acq.vitAngDegSecAbs || acq.vitAngDegSecAbs.length === 0) {
     return;
  }

  // --- 1) Réduction des données par PAA avec offset ---
  const allPAA_vitLin = computePAA(acq.vitLin, acq.nbFrames);
  const allPAA_vitLinAbs = computePAA(acq.vitLinAbs, acq.nbFrames);
  const allPAA_vitAngDegSecAbs = computePAA(acq.vitAngDegSecAbs, acq.nbFrames);
  const allPAA_RayonCourbure = computePAA(acq.RayonCourbure, acq.nbFrames);

  // --- 2.1) Transformation en labels ---
  const label_vitLin = allPAA_vitLin.map(row => row.map(v => v <= -state.seuils.vitLinAbs ? -1 : v >= state.seuils.vitLinAbs ? 1 : 0));
  const label_vitLinAbs = allPAA_vitLinAbs.map(row => row.map(v => v >= state.seuils.vitLinAbs ? 1 : 0));
  const label_vitAngDegSecAbs = allPAA_vitAngDegSecAbs.map(row => row.map(v => v >= state.seuils.vitAngAbs ? 1 : 0));
  const label_RayonCourbure = allPAA_RayonCourbure.map(row => row.map(v =>
    v <= state.seuils.rayonSerre ? 1 :
    (v > state.seuils.rayonSerre && v < state.seuils.rayonLarge) ? 2 : 3
  )
);

  // --- 2.2) Calcul du mode à chaque frame ---
  const PAA_vitlin = applicationModeJS(label_vitLin, acq.nbFrames);
  const PAA_vitLinAbs = applicationModeJS(label_vitLinAbs, acq.nbFrames);
  const PAA_vitAngDegSecAbs = applicationModeJS(label_vitAngDegSecAbs, acq.nbFrames);
  const PAA_RayonCourbure = applicationModeJS(label_RayonCourbure, acq.nbFrames);

  // --- 3) Regrouper tous les signaux pour pattern matching ---
  const allSignals = Array.from({ length: acq.nbFrames }, (_, i) => [
    PAA_vitlin[i],
    PAA_vitLinAbs[i],
    PAA_vitAngDegSecAbs[i],
    PAA_RayonCourbure[i]
  ]);

    // --- 4) Identifier les tâches locomotrices ---
  const A_statique = findPatternActionLocomotrice(allSignals, [[NaN, 0, 0, NaN]]);
  const B_avant = findPatternActionLocomotrice(allSignals, [
    [1, 1, 0, NaN],
    [0, 1, 0, NaN],
    [1, 0, 0, NaN]
  ]);
  const C_arriere = findPatternActionLocomotrice(allSignals, [[-1, 1, 0, NaN]]);
  const D_rot_pivot = findPatternActionLocomotrice(allSignals, [[NaN, NaN, 1, 1]]);
  const E_rot_serre = findPatternActionLocomotrice(allSignals, [[NaN, NaN, 1, 2]]);
  const F_rot_large = findPatternActionLocomotrice(allSignals, [[NaN, NaN, 1, 3]]);

  // --- 5) Création du signal symbolique (one-hot) ---
  const signalSymbolique = [
    A_statique.map(b => b ? 1 : 0),
    B_avant.map(b => b ? 1 : 0),
    C_arriere.map(b => b ? 1 : 0),
    D_rot_pivot.map(b => b ? 1 : 0),
    E_rot_serre.map(b => b ? 1 : 0),
    F_rot_large.map(b => b ? 1 : 0)
  ];

  // --- 6) Affiner les transitions ---
  const improvedSignal = improveTransitionsActionsLocomotrices(
    signalSymbolique,
    acq.vitLinAbs,
    acq.vitAngDegSecAbs
  );

  // --- 7) Réduire la variabilité ---
  const improvedSignalLessVariability = reduceVariabilityActionsLocomotrices(improvedSignal, state.segmentationSize);

  // --- 8) Convertir en signal unique pour chronogramme ---
  acq.signalUnique = Array(acq.nbFrames).fill(0);
  for (let i = 0; i < acq.nbFrames; i++) {
    for (let t = 0; t < 6; t++) {
      if (improvedSignalLessVariability[t][i] === 1) {
        acq.signalUnique[i] = t + 1;
        break;
      }
    }
  }

  // --- 9) Tracer le chronogramme ---
  // Créer dynamiquement un conteneur pour chaque acquisition
  let container = document.createElement("div");
  container.id = acq.containerId;
  container.className = "chronogramme";
  document.getElementById("chronogrammesContainer").appendChild(container);
  plotChronogramme(acq);
}
async function runPipelineAsync(acq) {
  runPipeline(acq);
  markAcquisitionTreated(acq.fileName)
  // permet d'afficher les chronogrammes au fur et à mesure
  await new Promise(resolve => setTimeout(resolve, 0)); 
}

// ================== DEFINITION DES SOUS-FONCTIONS ===================
function computePAA(signal, nbFrames) {
  const allPAA = [];
  for (let offset = 0; offset < state.segmentationSize; offset++) {
    allPAA.push(PAAdataReduction(offset, signal));
  }
  return allPAA 
}

// ---------------------- Application ModeJS ----------------------
function applicationModeJS(signal, nbFrames) {
// Calcul du mode à chaque frame
const Mode_signal = [];
  for (let i = 0; i < nbFrames; i++) {
    const vals = signal.map(row => row[i]);
    Mode_signal.push(modeJS(vals.filter(v => !isNaN(v))));
  }
  return Mode_signal;
}

// ---------------------- PAA Data Reduction ----------------------
function PAAdataReduction(offset, timeSeries) {
  if (timeSeries.length < state.segmentationSize) {
    throw new Error(`La série temporelle doit avoir au moins ${state.segmentationSize} points.`);
  }

  const numSegments = Math.ceil((timeSeries.length - offset) / state.segmentationSize);
  const paaValues = Array(timeSeries.length).fill(NaN);

  for (let i = 0; i < numSegments; i++) {
    let segmentStart = offset + i * state.segmentationSize;
    let segmentEnd = offset + (i + 1) * state.segmentationSize - 1;
    if (segmentEnd >= timeSeries.length) segmentEnd = timeSeries.length - 1;
    if (segmentStart < 0) segmentStart = 0;

    const segment = timeSeries.slice(segmentStart, segmentEnd + 1);
    const meanVal = segment.reduce((a, b) => a + b, 0) / segment.length;

    for (let j = segmentStart; j <= segmentEnd; j++) {
      paaValues[j] = meanVal;
    }
  }

  return paaValues;
}

// ---------------------- Find Pattern Action Locomotrice ----------------------
function findPatternActionLocomotrice(signals, targets) {
  const N = signals.length;
  const M = signals[0].length;
  const matches = Array(N).fill(false);

  for (let k = 0; k < targets.length; k++) {
    let mask = Array(N).fill(true);
    for (let j = 0; j < M; j++) {
      if (!isNaN(targets[k][j])) {
        for (let i = 0; i < N; i++) {
          mask[i] = mask[i] && signals[i][j] === targets[k][j];
        }
      }
    }
    for (let i = 0; i < N; i++) {
      matches[i] = matches[i] || mask[i];
    }
  }
  return matches;
}

// ---------------------- Improve Transitions ----------------------
function improveTransitionsActionsLocomotrices(signalSymbolique, vitLinAbs, vitAngDegSecAbs) {
  const newSignal = signalSymbolique.map(row => [...row]);
  const nbFrames = signalSymbolique[0].length;

  const idxA = 0, idxB = 1, idxC = 2, idxD = 3, idxE = 4, idxF = 5;

  // Propulsion avant (B)
  let B = [...newSignal[idxB]];
  let prevB = [0, ...B.slice(0, -1)];
  let risingB = B.map((val, i) => val === 1 && prevB[i] === 0);
  let fallingB = B.map((val, i) => val === 0 && prevB[i] === 1);

  for (let i = 0; i < nbFrames; i++) {
    if (risingB[i]) {
      let jmin = Math.max(0, i - state.maxLookBack);
      for (let j = i - 1; j >= jmin; j--) {
        if (vitLinAbs[j] < state.seuils.secondSeuil_vitLinAbs) {
          for (let k = j + 1; k <= i; k++) {
            newSignal[idxB][k] = 1;
            [idxA, idxC, idxD, idxE, idxF].forEach(idx => newSignal[idx][k] = 0);
          }
          break;
        }
      }
    }
    if (fallingB[i]) {
      let jmax = Math.min(nbFrames - 1, i + state.maxLookAhead);
      for (let j = i + 1; j <= jmax; j++) {
        if (vitLinAbs[j] < state.seuils.secondSeuil_vitLinAbs) {
          for (let k = i; k < j; k++) {
            newSignal[idxB][k] = 1;
            [idxA, idxC, idxD, idxE, idxF].forEach(idx => newSignal[idx][k] = 0);
          }
          break;
        }
      }
    }
  }

  // Propulsion arrière (C)
  let C = [...newSignal[idxC]];
  let prevC = [0, ...C.slice(0, -1)];
  let risingC = C.map((val, i) => val === 1 && prevC[i] === 0);
  let fallingC = C.map((val, i) => val === 0 && prevC[i] === 1);

  for (let i = 0; i < nbFrames; i++) {
    if (risingC[i]) {
      let jmin = Math.max(0, i - state.maxLookBack);
      for (let j = i - 1; j >= jmin; j--) {
        if (vitLinAbs[j] < state.seuils.secondSeuil_vitLinAbs) {
          for (let k = j + 1; k <= i; k++) {
            newSignal[idxC][k] = 1;
            [idxA, idxB, idxD, idxE, idxF].forEach(idx => newSignal[idx][k] = 0);
          }
          break;
        }
      }
    }
    if (fallingC[i]) {
      let jmax = Math.min(nbFrames - 1, i + state.maxLookAhead);
      for (let j = i + 1; j <= jmax; j++) {
        if (vitLinAbs[j] < state.seuils.secondSeuil_vitLinAbs) {
          for (let k = i; k < j; k++) {
            newSignal[idxC][k] = 1;
            [idxA, idxB, idxD, idxE, idxF].forEach(idx => newSignal[idx][k] = 0);
          }
          break;
        }
      }
    }
  }

  // Rotations (D,E,F)
  let R = Array(nbFrames).fill(0);
  for (let i = 0; i < nbFrames; i++) {
    if (newSignal[idxD][i] || newSignal[idxE][i] || newSignal[idxF][i]) R[i] = 1;
  }
  let prevR = [0, ...R.slice(0, -1)];
  let risingR = R.map((val, i) => val === 1 && prevR[i] === 0);
  let fallingR = R.map((val, i) => val === 0 && prevR[i] === 1);

    for (let i = 0; i < nbFrames; i++) {
    if (risingR[i]) {
      // Identifier la rotation active à la frame i (D, E ou F)
      const activeRot = [idxD, idxE, idxF].find(idx => newSignal[idx][i] === 1);
      if (activeRot === undefined) continue;
      let jmin = Math.max(0, i - state.maxLookBack);
      for (let j = i - 1; j >= jmin; j--) {
        if (vitAngDegSecAbs[j] < state.seuils.secondSeuil_vitAngAbs) {
          for (let k = j + 1; k <= i; k++) {
            // Étendre cette seule rotation et mettre à 0 toutes les autres lignes
            [idxA, idxB, idxC, idxD, idxE, idxF].forEach(idx => newSignal[idx][k] = (idx === activeRot) ? 1 : 0);
          }
          break;
        }
      }
    }
    if (fallingR[i]) {
      // Identifier la rotation active au frame i (D, E ou F)
      const activeRot2 = [idxD, idxE, idxF].find(idx => newSignal[idx][i-1] === 1);
      if (activeRot2 === undefined) continue;
      let jmax = Math.min(nbFrames - 1, i + state.maxLookAhead);
      for (let j = i + 1; j <= jmax; j++) {
        if (vitAngDegSecAbs[j] < state.seuils.secondSeuil_vitAngAbs) {
          for (let k = i; k < j; k++) {
            // Étendre cette seule rotation et mettre à 0 toutes les autres lignes
            [idxA, idxB, idxC, idxD, idxE, idxF].forEach(idx => newSignal[idx][k] = (idx === activeRot2) ? 1 : 0);
          }
          break;
        }
      }
    }
  }

  // Résolution des conflits : priorité aux rotations
  const totalSum = newSignal.flat().reduce((s, v) => s + v, 0);

if (totalSum !== nbFrames) {
  console.log(totalSum, nbFrames);
  for (let i = 0; i < nbFrames; i++) {
    if ((newSignal[idxB][i] === 1 || newSignal[idxC][i] === 1) && (newSignal[idxD][i] === 1 || newSignal[idxE][i] === 1 || newSignal[idxF][i] === 1)) {
      newSignal[idxB][i] = 0;
      newSignal[idxC][i] = 0;
    }
  }
} 

  return newSignal;
}

// ---------------------- Reduce Variability ----------------------
function reduceVariabilityActionsLocomotrices(signal) {
  const nTasks = signal.length;
  const nFrames = signal[0].length;
  let labels = [];

  for (let t = 0; t < nFrames; t++) {
    let idx = signal.findIndex(row => row[t] === 1);
    labels.push(idx >= 0 ? idx + 1 : 0);
  }

  let changed = true;
  while (changed) {
    changed = false;
    const starts = [0];
    let prev = labels[0];
    for (let i = 1; i < nFrames; i++) {
      if (labels[i] !== prev) {
        starts.push(i);
        prev = labels[i];
      }
    }
    starts.push(nFrames);

    for (let k = 1; k < starts.length - 2; k++) {
      let segLen = starts[k + 1] - starts[k];
      if (segLen < state.segmentationSize) {
        let leftLabel = labels[starts[k] - 1];
        let rightLabel = labels[starts[k + 1]];
        if (leftLabel === rightLabel) {
          for (let i = starts[k]; i < starts[k + 1]; i++) {
            labels[i] = leftLabel;
          }
          changed = true;
        }
      }
    }
  }

  const improvedSignal = Array.from({ length: nTasks }, () => Array(nFrames).fill(0));
  for (let t = 0; t < nFrames; t++) {
    if (labels[t] > 0) improvedSignal[labels[t] - 1][t] = 1;
  }

  return improvedSignal;
}

// ---------------------- Mode JS ----------------------
function modeJS(arr) {
  if (arr.length === 0) return null;
  let counts = {};
  let maxCount = 0;
  let modeVal = arr[0];
  for (let val of arr) {
    counts[val] = (counts[val] || 0) + 1;
    if (counts[val] > maxCount || (counts[val] === maxCount && val < modeVal)) {
      maxCount = counts[val];
      modeVal = val;
    }
  }
  return modeVal;
}

// ---------------------- Plot Chronogramme ----------------------
function plotChronogramme(acq) {
  if (!acq.signalUnique) return;

  // ------------------- Segmentation patches -------------------
  const starts = [0];
  const ends = [];
  let prev = acq.signalUnique[0];
  for (let i = 1; i < acq.nbFrames; i++) {
    if (acq.signalUnique[i] !== prev) {
      ends.push(i);
      starts.push(i);
      prev = acq.signalUnique[i];
    }
  }
  ends.push(acq.nbFrames - 1);

  // ------------------- Stats des vitesses -------------------
  const statsLin = acq.vitLin
    ? { min: Math.min(...acq.vitLin), max: Math.max(...acq.vitLin) }
    : null;
  const statsAng = acq.vitAngDegSec
    ? { min: Math.min(...acq.vitAngDegSec), max: Math.max(...acq.vitAngDegSec) }
    : null;

  // Déterminer les bornes globales pour forcer un zéro commun
  // Déterminer des bornes séparées pour les deux signaux afin de ne pas forcer
  // les deux axes à partager la même échelle (ce qui rendrait la lecture mauvaise)
  function paddedRange(min, max) {
    // s'assurer que min/max incluent zéro
    min = Math.min(min, 0);
    max = Math.max(max, 0);
    // si min == max, donner une marge par défaut
    let span = max - min;
    if (span === 0) span = Math.abs(max) || 1;
    const margin = span * 0.05;
    return [min - margin, max + margin];
  }

  const yRangeLin = (state.showVitLin && statsLin) ? paddedRange(statsLin.min, statsLin.max) : null;
  const yRangeAng = (state.showVitAng && statsAng) ? paddedRange(statsAng.min, statsAng.max) : null;

  // Range utilisée pour dessiner les patches (préférence aux vitesses linéaires si présentes)
  const yRange = yRangeLin || yRangeAng || null;

  // ------------------- Patches -------------------
  const patches = [];
  for (let iSeg = 0; iSeg < starts.length; iSeg++) {
    const curLabel = acq.signalUnique[starts[iSeg]];
    const x = [starts[iSeg], ends[iSeg], ends[iSeg], starts[iSeg]];
    const y = yRange ? [yRange[0], yRange[0], yRange[1], yRange[1]] : [0, 0, 1, 1];
    patches.push({
      x: x,
      y: y,
      fill: "toself",
      fillcolor: TASKS[curLabel].color || "rgba(0,0,0,0.2)",
      line: { color: "rgba(0,0,0,0)" },
      type: "scatter",
      mode: "lines",
      showlegend: false,
      hoverinfo: "skip"
    });
  }

  // ------------------- Courbes de vitesse -------------------
  const traces = [...patches];
  if (state.showVitLin && acq.vitLin) {
    traces.push({
      x: Array.from({ length: acq.nbFrames }, (_, i) => i),
      y: acq.vitLin,
      // y: acq.RayonCourbure,
      mode: "lines",
      name: "Vitesse linéaire",
      line: { color: "black", width: 2 },
      yaxis: "y"
    });
  }
  if (state.showVitAng && acq.vitAngDegSec) {
    traces.push({
      x: Array.from({ length: acq.nbFrames }, (_, i) => i),
      y: acq.vitAngDegSec,
      mode: "lines",
      name: "Vitesse angulaire",
      line: { color: "orange", width: 2 },
      yaxis: state.showVitLin ? "y2" : "y" // si seule → axe gauche, sinon → axe droit
    });
  }

  // ------------------- Layout -------------------
  const layout = {
    xaxis: { title: { text: "Frames" }, range: [0, acq.nbFrames] },
    showlegend: true,
    legend: {
      orientation: "h",
      x: 1,
      y: 1.02,       // juste au-dessus de la zone de tracé
      xanchor: "right",
      yanchor: "bottom",
      font: { size: 12 }
    },
    height: 350,
    autosize: true,
    margin: { t: 50, l: 50, r: 50, b: 50 }, 

    // TITRE via annotation pour le placer exactement
    annotations: [
      {
        text: acq.fileName.replace(/\W+/g, "_"),
        x: 0,           // commence au début de l'axe X
        y: 1.05,        // même hauteur que la légende
        xref: 'x',
        yref: 'paper',  // position relative au graphique complet
        xanchor: 'left',
        yanchor: 'bottom',
        showarrow: false,
        font: { size: 16, family: "Arial, sans-serif", weight: "bold" }
      }
    ]
  };

  // Cas 1 : les deux vitesses sont affichées → double axe
  if (state.showVitLin && state.showVitAng) {
    layout.yaxis = {
      title: { text: "Vitesse linéaire (m/s)" },
      side: "left",
      range: yRangeLin || undefined
    };
    layout.yaxis2 = {
      title: { text: "Vitesse angulaire (°/s)" },
      side: "right",
      overlaying: "y",
      range: yRangeAng || undefined
    };
  }
  // Cas 2 : seule la vitesse linéaire
  else if (state.showVitLin) {
    layout.yaxis = {
      title: { text: "Vitesse linéaire (m/s)" },
      side: "left",
      range: yRangeLin || undefined
    };
  }
  // Cas 3 : seule la vitesse angulaire
  else if (state.showVitAng) {
    layout.yaxis = {
      title: { text: "Vitesse angulaire (°/s)" },
      side: "left",
      range: yRangeAng || undefined
    };
  } else {
    // aucune vitesse affichée → cacher l'axe Y
    layout.yaxis = {
      showticklabels: false,
    };
  }

  // tracer
  Plotly.newPlot(acq.containerId, traces, layout, {responsive: true});
  Plotly.Plots.resize(acq.containerId);
}

// ---------------- enregistrer un CSV résultat ----------------------
function saveDataCSV(acq) {
  if (!acq.vitLin || !acq.vitAngDegSec || !acq.signalUnique) {
    //Message enregistrement réussi
    showStatus("❌ Erreur à l'enregistrement des résutlats", "error","statusMsgSave");
    return;
  }
  const CSVresultname = acq.fileName + '_resultats.csv';

  // Création du CSV : en-tête
  const header = ["Vitesse lineaire (m/s)", "Vitesse angulaire (deg/s)", "Actions locomotrices"];
  const rows = [header.join(";")];

  for (let i = 0; i < acq.nbFrames; i++) {
    const line = [
      acq.vitLin[i].toFixed(3),  // vitesse linéaire
      acq.vitAngDegSec[i].toFixed(3),  // vitesse angulaire
      acq.signalUnique[i]        // signal unique
    ];
    rows.push(line.join(";"));
  }

  const csvContent = rows.join("\n");

  // Création du Blob et téléchargement
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  if (navigator.msSaveBlob) { // pour IE 10+
    navigator.msSaveBlob(blob, CSVresultname);
  } else {
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", CSVresultname);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}

// ------------ charger un json pour les paramètres -------------------
function importJson() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';
  input.click();

  input.addEventListener('change', (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {

        const data = JSON.parse(e.target.result);

        // Mise à jour des inputs HTML si les clés existent
        if (data.freqAcq !== undefined) document.getElementById("freqAcq").value = data.freqAcq;
        if (data.seuilVitLinAbs !== undefined) document.getElementById("seuilVitLinAbs").value = data.seuilVitLinAbs;
        if (data.seuilVitAngAbs !== undefined) document.getElementById("seuilVitAngAbs").value = data.seuilVitAngAbs;
        if (data.seuilRayonMin !== undefined) document.getElementById("seuilRayonMin").value = data.seuilRayonMin;
        if (data.seuilRayonMax !== undefined) document.getElementById("seuilRayonMax").value = data.seuilRayonMax;
        if (data.newSeuilVitLinAbs !== undefined) document.getElementById("newSeuilVitLinAbs").value = data.newSeuilVitLinAbs;
        if (data.newSeuilVitAngAbs !== undefined) document.getElementById("newSeuilVitAngAbs").value = data.newSeuilVitAngAbs;

    };
    reader.readAsText(file);
  });
}

// ------------ enregistrer un json pour les paramètres -------------------
function exportJson(isLegend = false) {
  // On récupère les valeurs des champs du <details>
  let params = {};
  if (isLegend) {
    params = {
      "1": TASKS[1].label,
      "2": TASKS[2].label,
      "3": TASKS[3].label,
      "4": TASKS[4].label,
      "5": TASKS[5].label,
      "6": TASKS[6].label,
      };
      console.log(params);
  } else {
    params = {
      freqAcq: parseFloat(document.getElementById("freqAcq").value) || null,

      seuilVitLinAbs: parseFloat(document.getElementById("seuilVitLinAbs").value) || null,
      seuilVitAngAbs: parseFloat(document.getElementById("seuilVitAngAbs").value) || null,
      seuilRayonMin: parseFloat(document.getElementById("seuilRayonMin").value) || null,
      seuilRayonMax: parseFloat(document.getElementById("seuilRayonMax").value) || null,

      newSeuilVitLinAbs: parseFloat(document.getElementById("newSeuilVitLinAbs").value) || null,
      newSeuilVitAngAbs: parseFloat(document.getElementById("newSeuilVitAngAbs").value) || null
      };
  }
  
  // Nom du fichier : templateParameters.json si demandé, sinon lié au CSV
  let fileName;
  if (isLegend) {
    fileName = "legend.json";
    } else {
    fileName = (state.acquisitions[0].fileName || "parametres") + "_param.json";
  }


  // On convertit en JSON formaté (lisible)
  const jsonContent = JSON.stringify(params, null, 2);

  // On crée le blob et on lance le téléchargement
  const blob = new Blob([jsonContent], { type: "application/json" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = fileName;
  link.click();
}

//---------------- Légende chronogrammes -----------------------
//pour que la légende et les chronogrmame aient toujours les mêmes couleurs
function renderLegend() {
  const container = document.querySelector(".legend-grid");
  if (!container) return;

  container.innerHTML = ""; // vider

  // Ordre voulu
  const col1 = [1, 2, 3];
  const col2 = [4, 5, 6];

  // Créer deux colonnes
  const col1Div = document.createElement("div");
  const col2Div = document.createElement("div");

  col1.forEach(id => {
    const { label, color } = TASKS[id];
    const item = document.createElement("div");
    item.className = "legend-item";
    item.innerHTML = `
      <span class="color-box" style="background-color:${color}">${id}</span>
      ${label}
    `;
    col1Div.appendChild(item);
  });

  col2.forEach(id => {
    const { label, color } = TASKS[id];
    const item = document.createElement("div");
    item.className = "legend-item";
    item.innerHTML = `
      <span class="color-box" style="background-color:${color}">${id}</span>
      ${label}
    `;
    col2Div.appendChild(item);
  });

  container.appendChild(col1Div);
  container.appendChild(col2Div);
}

// -------------Afficher les paramètres après clic sur bouton chargement ------------
function affichageParametresSeuils() {
  const d = document.getElementById("detailsParam");
  d.classList.remove('locked');
  d.removeAttribute('data-locked');
  d.open = true;

  // Activer les boutons de gestion des paramètres
  document.getElementById('btnLoadParameters').disabled = false;
  document.getElementById('btnExportParameters').disabled = false;
  document.getElementById('resetSeuilsBtn').disabled = false;

  //Enlever la mise en forme du bouton
  document.getElementById("loadDataBtn").classList.remove("highlight-btn");

  //Permettre le clic sur le bouton suivant en le mettant en avant
  document.getElementById('btnValidateFilesParam').disabled = false;
  document.getElementById("btnValidateFilesParam").classList.add("highlight-btn");
}
