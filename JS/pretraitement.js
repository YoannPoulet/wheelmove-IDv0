const state = {
  acquisitions: [],          
    
  param: {
    freqAcq: [],
    winMA:5,
    winSG:5,
    orderSG:3,
    carrossage: [],
    rayonRoueDroite: [],
    rayonRoueGauche: [],
    rayonMode: 'rayon',
    distCentresRoues: [],
  },
  matricesRotations: {
    roueGauche: null,
    roueDroite: null,
    chassis: null
  },
  axePrincipal: {
    roueDroite: [],
    roueGauche: [],
    chassis: []
  },
  axeSecondaire: {
    chassis: []
  },
  inversionVitesseAngulaire: {
    roueDroite: false,
    roueGauche: false
  }
};

// Classe Acquisition
class Acquisition {
  constructor(fileName) {
    this.fileName = fileName;
    this.nbFrames = 0;
    this.IMUroueDroite = {
      gyrX: [],
      gyrY: [],
      gyrZ: [],
      accX: [],
      accY: [],
      accZ: []
    };
    this.IMUroueGauche = {
      gyrX: [],
      gyrY: [],
      gyrZ: [],
      accX: [],
      accY: [],
      accZ: []
    };
    this.IMUchassis = {
      gyrX: [],
      gyrY: [],
      gyrZ: [],
      accX: [],
      accY: [],
      accZ: []
    };
    this.dataIMUChassis={
      vitAngRf: [],
      accLinRf: []
    }
    this.dataIMURoues={
      vitAngRD: [],
      vitAngRG: [],
      vitLinRD: [],
      vitLinRG: [],
      vitAngFRMroue: [],
      vitLineaireFRMSc: []
    }
    this.correctionGlissement={
      framesGlissement: [],
      fenetresGlissement: [],
      dureeFenetreGlissementMoyenne: [],
      nbFramesGlissementTotal: [],
      nbOccurrenceGlissement: [],
      nbFrameAcquisition: [],
      pourcentageTempsGlissement: [],
      debutGliss: [],
      finGliss: [],
      vitLinCorrGliss: []
    }
  }

// Charger les données CSV dans l'objet
  loadDataFromCSV(csvText) { 
    // initialize arrays
    for (const k of Object.keys(this.IMUroueDroite)) this.IMUroueDroite[k] = [];
    for (const k of Object.keys(this.IMUroueGauche)) this.IMUroueGauche[k] = [];
    for (const k of Object.keys(this.IMUchassis)) this.IMUchassis[k] = [];

    if (!csvText || typeof csvText !== 'string') {
      this.nbFrames = 0;
      return;
    }

    // split lines and ignore empty lines
    const lines = csvText.split(/\r?\n/).map(l => l.replace(/\uFEFF/g,'').trim()).filter(l => l.length > 0);
    if (lines.length < 2) {
      this.nbFrames = 0;
      return;
    }

    // header is the first line
    const headerLine = lines[0];
    // split on tab or comma
    const split = (s) => s.split(';').map(x => x.trim());
    const headers = split(headerLine);

    // expected exact headers (case-insensitive match)
    const expected = [
      'Chassis_Acc_X','Chassis_Acc_Y','Chassis_Acc_Z',
      'Chassis_Gyr_X','Chassis_Gyr_Y','Chassis_Gyr_Z',
      'RoueGauche_Acc_X','RoueGauche_Acc_Y','RoueGauche_Acc_Z',
      'RoueGauche_Gyr_X','RoueGauche_Gyr_Y','RoueGauche_Gyr_Z',
      'RoueDroite_Acc_X','RoueDroite_Acc_Y','RoueDroite_Acc_Z',
      'RoueDroite_Gyr_X','RoueDroite_Gyr_Y','RoueDroite_Gyr_Z'
    ];

    // build index map
    const idx = {};
    expected.forEach(h => {
      const i = headers.findIndex(col => col.toLowerCase() === h.toLowerCase());
      idx[h] = i; // -1 if not found
    });

    const pushParsed = (arr, raw) => {
      const s = (raw === undefined || raw === null) ? '' : String(raw).trim();
      const v = parseFloat(s.replace(',', '.'));
      arr.push(!Number.isNaN(v) && s !== '' ? v : NaN);
    };

    // process each data row
    const dataLines = lines.slice(1);
    for (const line of dataLines) {
      const cols = split(line);

      // chassis
      pushParsed(this.IMUchassis.accX, cols[idx['Chassis_Acc_X']]);
      pushParsed(this.IMUchassis.accY, cols[idx['Chassis_Acc_Y']]);
      pushParsed(this.IMUchassis.accZ, cols[idx['Chassis_Acc_Z']]);
      pushParsed(this.IMUchassis.gyrX, cols[idx['Chassis_Gyr_X']]);
      pushParsed(this.IMUchassis.gyrY, cols[idx['Chassis_Gyr_Y']]);
      pushParsed(this.IMUchassis.gyrZ, cols[idx['Chassis_Gyr_Z']]);

      // roue gauche
      pushParsed(this.IMUroueGauche.accX, cols[idx['RoueGauche_Acc_X']]);
      pushParsed(this.IMUroueGauche.accY, cols[idx['RoueGauche_Acc_Y']]);
      pushParsed(this.IMUroueGauche.accZ, cols[idx['RoueGauche_Acc_Z']]);
      pushParsed(this.IMUroueGauche.gyrX, cols[idx['RoueGauche_Gyr_X']]);
      pushParsed(this.IMUroueGauche.gyrY, cols[idx['RoueGauche_Gyr_Y']]);
      pushParsed(this.IMUroueGauche.gyrZ, cols[idx['RoueGauche_Gyr_Z']]);

      // roue droite
      pushParsed(this.IMUroueDroite.accX, cols[idx['RoueDroite_Acc_X']]);
      pushParsed(this.IMUroueDroite.accY, cols[idx['RoueDroite_Acc_Y']]);
      pushParsed(this.IMUroueDroite.accZ, cols[idx['RoueDroite_Acc_Z']]);
      pushParsed(this.IMUroueDroite.gyrX, cols[idx['RoueDroite_Gyr_X']]);
      pushParsed(this.IMUroueDroite.gyrY, cols[idx['RoueDroite_Gyr_Y']]);
      pushParsed(this.IMUroueDroite.gyrZ, cols[idx['RoueDroite_Gyr_Z']]);
    }

    // set nbFrames as the maximum length among arrays
    const all = [
      ...Object.values(this.IMUchassis),
      ...Object.values(this.IMUroueGauche),
      ...Object.values(this.IMUroueDroite)
    ];
    this.nbFrames = all.reduce((m, a) => Math.max(m, Array.isArray(a) ? a.length : 0), 0);

    // If any NaN values are present in the parsed data, throw an error
    const arraysToCheck = [
      ...Object.values(this.IMUchassis),
      ...Object.values(this.IMUroueGauche),
      ...Object.values(this.IMUroueDroite)
    ];
    const hasNaN = arraysToCheck.some(arr => Array.isArray(arr) && arr.some(v => Number.isNaN(v)));
    if (hasNaN) {
      throw new Error((window.i18n && typeof window.i18n.t === 'function') ? window.i18n.t('error_missingValue') : "Données manquantes (NaN) dans " + this.fileName);
    }
  }
}

// ================ Gestion dynamique de la page  ===================
// vider les paramètres de traitement
document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll("input").forEach(input => {
    if (input.type === "number" || input.type === "text") {
      // Don't clear certain inputs that may have meaningful defaults
      // Preserve newly added filter parameter inputs so their defaults remain
      if (input.id === 'FRMcarrossage' || input.id === 'freqIMU' || input.id === 'maWindow' || input.id === 'sgWindow' || input.id === 'sgPoly') {
        if (input.hasAttribute('value')) {
          input.value = input.getAttribute('value');
        }
      } else {
        input.value = "";
      }
    } else if (input.type === "checkbox" || input.type === "radio") {
      // Preserve default selection for the initialFilter radio group
      if (input.name === 'initialFilter') {
        // keep the 'none' option checked by default
        input.checked = (input.value === 'none');
      } else {
        input.checked = false;
      }
    } else if (input.type === "file") {
      input.value = null;
    }
  });
});

//------------ Boutons validation étape 1 -----------------------
document.getElementById("validateStep1").addEventListener("click", () => {
  const freq = document.getElementById("freqIMU").value;
  if (freq) unlockStep("step1", "step2", "tickStep1");
});

//------------- Rayons différenciés ----------------------
const toggleBtn = document.getElementById('toggleRayonsDiff');
const bloc = document.getElementById('FRMRayonsSepares');
const champUnique = document.getElementById('FRMRayonRoues');
const gauche = document.getElementById('FRMRayonRoueG');
const droite = document.getElementById('FRMRayonRoueD');

let modeDiff = false;

// Toggle Rayon / Circonférence embedded in the Rayon label
const toggle = document.getElementById('toggleRayonCirc');
const onOpt = document.getElementById('onOpt');
const offOpt = document.getElementById('offOpt');
let isOn = true; // true => Rayon, false => Circonférence

if (toggle && onOpt && offOpt) {
  // ensure texts are correct
  onOpt.textContent = 'Rayon';
  offOpt.textContent = 'Circonférence';
  onOpt.classList.toggle('active', isOn);
  offOpt.classList.toggle('active', !isOn);

  toggle.addEventListener('click', () => {
    isOn = !isOn;
    onOpt.classList.toggle('active', isOn);
    offOpt.classList.toggle('active', !isOn);
    // store selection in app state for later use
    if (state && state.param) state.param.rayonMode = isOn ? 'rayon' : 'circonference';
  });
  // initialize state
  if (state && state.param) state.param.rayonMode = isOn ? 'rayon' : 'circonference';
}

// helper to update the toggle button text using i18n (keeps a data attribute with the active key)
function updateToggleRayonsText() {
  if (!toggleBtn) return;
  const activeKey = toggleBtn.dataset.i18nActive || toggleBtn.getAttribute('data-i18n') || 'FRM_gauchedroite';
  if (window.i18n && typeof window.i18n.t === 'function') {
    try {
      toggleBtn.textContent = window.i18n.t(activeKey);
      return;
    } catch (e) {
      console.warn('i18n.t failed for', activeKey, e);
    }
  }
  // fallback labels
  if (activeKey === 'FRM_fusion') toggleBtn.textContent = '🗙 Fusionner gauche/droite';
  else toggleBtn.textContent = '⚙️ Différencier gauche/droite';
}

// ensure the button has an initial i18n key so updateToggleRayonsText can work
if (toggleBtn && !toggleBtn.dataset.i18nActive) toggleBtn.dataset.i18nActive = toggleBtn.getAttribute('data-i18n') || 'FRM_gauchedroite';

toggleBtn.addEventListener('click', () => {
  modeDiff = !modeDiff;
  if (modeDiff) {
    bloc.style.display = 'block';
    champUnique.disabled = true;
    toggleBtn.dataset.i18nActive = 'FRM_fusion';
    updateToggleRayonsText();
    gauche.value = champUnique.value || '';
    droite.value = champUnique.value || '';
    champUnique.value = '';
    gauche.dispatchEvent(new Event('input', { bubbles: true }));
    droite.dispatchEvent(new Event('input', { bubbles: true }));
    champUnique.dispatchEvent(new Event('input', { bubbles: true }));
    } else {
      bloc.style.display = 'none';
      champUnique.disabled = false;
      toggleBtn.dataset.i18nActive = 'FRM_gauchedroite';
      updateToggleRayonsText();
      const g = parseFloat(gauche.value);
      const d = parseFloat(droite.value);
      if (!isNaN(g)) {
        champUnique.value = g;
      } else {
        if (!isNaN(d)) champUnique.value = d;
      }
      gauche.value = '';
      droite.value = '';
      gauche.dispatchEvent(new Event('input', { bubbles: true }));
      droite.dispatchEvent(new Event('input', { bubbles: true }));
      champUnique.dispatchEvent(new Event('input', { bubbles: true }));
  } 
});

// Subscribe to language changes (if i18n provides onChange)
if (window.i18n && typeof window.i18n.onChange === 'function') {
  window.i18n.onChange(updateToggleRayonsText);
}
// Apply initial text (if translations already loaded)
setTimeout(updateToggleRayonsText, 0);

//------------ Boutons validation étape 2 -----------------------
document.getElementById("validateStep2").addEventListener("click", () => {
  const carrossage = Math.abs(Number(document.getElementById('FRMcarrossage').value));
  const rayons = document.getElementById('FRMRayonRoues').value;
  const rayonG = document.getElementById('FRMRayonRoueG').value;
  const rayonD = document.getElementById('FRMRayonRoueD').value;
  const dist = document.getElementById("FRMdistCentresRoues").value;
  if (!Number.isNaN(carrossage) && (rayons || (rayonG && rayonD)) && dist) unlockStep("step2", "step3", "tickStep2");
});

// Mettre à jour l'état (disabled) de tous les boutons de validation (1 à 5)
function updateAllValidateButtons() {
  // inputs pour étapes 1/2
  const freq = document.getElementById('freqIMU');
  const windowMA = document.getElementById('maWindow');
  const sgEl = document.getElementById('sgWindow');
  const sgPolyEl = document.getElementById('sgPoly');
  const carrossage = Math.abs(Number(document.getElementById('FRMcarrossage').value));
  const rayons = document.getElementById('FRMRayonRoues');
  const rayonG = document.getElementById('FRMRayonRoueG');
  const rayonD = document.getElementById('FRMRayonRoueD');
  const dist = document.getElementById('FRMdistCentresRoues');

  // enregistrement dans le state des paramètres de filtrage
  const sel = document.querySelector('input[name="initialFilter"]:checked');
  const filterChoice = sel.value;
  state.param.winMA = windowMA.value;
  state.param.winSG = sgEl.value;
  state.param.orderSG = sgPolyEl.value;

  // enregistrement dans le state avec passage en metres pour les rayons et distances
  state.param.freqAcq = freq.value;
  state.param.carrossage = carrossage;
  if (rayons.value) {
    state.param.rayonRoueGauche = rayons.value*0.01; // cm -> m
    state.param.rayonRoueDroite = rayons.value*0.01; // cm -> m
  } else if (rayonG.value && rayonD.value){
    state.param.rayonRoueGauche = rayonG.value*0.01; // cm -> m
    state.param.rayonRoueDroite = rayonD.value*0.01; // cm -> m
  };  
  if (state.param.rayonMode === 'circonference') {
    // convert circumference to radius
    state.param.rayonRoueGauche = state.param.rayonRoueGauche / (2 * Math.PI);
    state.param.rayonRoueDroite = state.param.rayonRoueDroite / (2 * Math.PI);
  }
  const distContactPoints = dist.value*0.01; // cm -> m 
  const carrossageRad = state.param.carrossage * Math.PI / 180; // degrees to radians
  state.param.distCentresRoues = distContactPoints - (state.param.rayonRoueGauche * Math.cos(carrossageRad) + state.param.rayonRoueDroite * Math.cos(carrossageRad));

  // états basés sur inputs
  const canValidate1 = !!(freq && freq.value) &&
    (filterChoice=='none' || 
    (filterChoice=='ma' && windowMA.value) ||
    (filterChoice=='SG' && sgEl.value && sgPolyEl.value));
  const canValidate2 = !!((!Number.isNaN(carrossage))
    && ((rayons && rayons.value) || (rayonG && rayonG.value && rayonD && rayonD.value)) 
    && dist && dist.value);

  // états basés sur acquisitions
  const appState = (typeof getAppState === 'function') ? getAppState() : window.state;
  const hasStat = appState && Array.isArray(appState.acquisitions) && appState.acquisitions.some(a => a.category === 'Statique');
  const hasLigne = appState && Array.isArray(appState.acquisitions) && appState.acquisitions.some(a => a.category === 'LigneDroite');
  const hasAcq = appState && Array.isArray(appState.acquisitions) && appState.acquisitions.some(a => a.category === 'Acquis');

  // boutons
  const btn1 = document.getElementById('validateStep1');
  const btn2 = document.getElementById('validateStep2');
  const btn3 = document.getElementById('validateStep3');
  const btn4 = document.getElementById('validateStep4');
  const btn5 = document.getElementById('validateStep5');

  const step1El = document.getElementById('step1');
  const step2El = document.getElementById('step2');
  const step3El = document.getElementById('step3');
  const step4El = document.getElementById('step4');
  const step5El = document.getElementById('step5');

  if (btn1) {
    // keep disabled if already validated
    if (step1El && step1El.dataset && step1El.dataset.validated === 'true') btn1.disabled = true;
    else btn1.disabled = !canValidate1;
  }
  if (btn2) {
    if (step2El && step2El.dataset && step2El.dataset.validated === 'true') btn2.disabled = true;
    else btn2.disabled = !canValidate2; 
  }
  if (btn3) {
    if (step3El && step3El.dataset && step3El.dataset.validated === 'true') btn3.disabled = true;
    else btn3.disabled = !hasStat; 
  }
  if (btn4) {
    if (step4El && step4El.dataset && step4El.dataset.validated === 'true') btn4.disabled = true;
    else btn4.disabled = !hasLigne; 
  }
  if (btn5) {
    if (step5El && step5El.dataset && step5El.dataset.validated === 'true') btn5.disabled = true;
    else btn5.disabled = !hasAcq; 
  }

  // Update Modifier buttons: enable only when step is validated
  for (let i = 1; i <= 5; i++) {
    const stepEl = document.getElementById('step' + i);
    const modifyBtn = document.getElementById('modifyStep' + i);
    if (modifyBtn && stepEl) {
      modifyBtn.disabled = stepEl.dataset.validated !== 'true';
    }
  }
}

// Attacher des écouteurs pour mettre à jour l'état des boutons lorsqu'on modifie les inputs
document.getElementById('freqIMU').addEventListener('input', updateAllValidateButtons);
document.querySelectorAll('input[name="initialFilter"]').forEach(radio => {
  radio.addEventListener('change', updateAllValidateButtons);
});
document.getElementById('maWindow').addEventListener('input', updateAllValidateButtons);
document.getElementById('sgWindow').addEventListener('input', updateAllValidateButtons);
document.getElementById('sgPoly').addEventListener('input', updateAllValidateButtons);
document.getElementById('FRMcarrossage').addEventListener('input', updateAllValidateButtons);
document.getElementById('FRMRayonRoues').addEventListener('input', updateAllValidateButtons);
document.getElementById('FRMRayonRoueG').addEventListener('input', updateAllValidateButtons);
document.getElementById('FRMRayonRoueD').addEventListener('input', updateAllValidateButtons);
document.getElementById('FRMdistCentresRoues').addEventListener('input', updateAllValidateButtons);

// Validation étape 3 : nécessite au moins une statique chargée (dans state.acquisitions)
document.getElementById("validateStep3").addEventListener("click", () => {
  const appState = (typeof getAppState === 'function') ? getAppState() : window.state;
  const hasStat = appState && Array.isArray(appState.acquisitions) && appState.acquisitions.some(a => a.category === 'Statique');
  if (hasStat) unlockStep("step3", "step4", "tickStep3");
  if (hasStat && typeof setFileTableButtonsState === 'function') setFileTableButtonsState('Statique', true);
});

// Validation étape 4 : nécessite au moins une ligne droite chargée (dans state.acquisitions)
document.getElementById("validateStep4").addEventListener("click", () => {
  const appState = (typeof getAppState === 'function') ? getAppState() : window.state;
  const hasLigne = appState && Array.isArray(appState.acquisitions) && appState.acquisitions.some(a => a.category === 'LigneDroite');
  if (hasLigne) unlockStep("step4", "step5", "tickStep4");
  if (hasLigne && typeof setFileTableButtonsState === 'function') setFileTableButtonsState('LigneDroite', true);
});

// Validation étape 5 : nécessite au moins une acquisition à traiter chargée (dans state.acquisitions)
document.getElementById("validateStep5").addEventListener("click", () => {
  const appState = (typeof getAppState === 'function') ? getAppState() : window.state;
  const hasAcq = appState && Array.isArray(appState.acquisitions) && appState.acquisitions.some(a => a.category === 'Acquis');
  if (hasAcq) {
    const saveBtn = document.getElementById("saveDataIMUBtn");
    const newBtn = document.getElementById("newFRMBtn");
    if (saveBtn) saveBtn.disabled = false;
    if (newBtn) newBtn.disabled = false;
    unlockStep("step5", null, "tickStep5");
    // Désactiver les boutons d'action dans le tableau des acquisitions traitées
    if (typeof setFileTableButtonsState === 'function') setFileTableButtonsState('Acquis', true);
  }
});

//---------- Boutons chargement de données et dropzones ---------------
document.getElementById("loadStatic").addEventListener("click", () => {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = ".csv";

  input.addEventListener("change", (e) => {
    handleFiles(e.target.files, "Statique");
  });

  input.click();
});

  // Drop zone pour la statique
const dropZoneStatic = document.getElementById("dropZoneStatic");
if (dropZoneStatic) {
  dropZoneStatic.addEventListener('dragover', (e) => { e.preventDefault(); dropZoneStatic.classList.add('dragover'); });
  dropZoneStatic.addEventListener('dragleave', () => { dropZoneStatic.classList.remove('dragover'); });
  dropZoneStatic.addEventListener('drop', async (e) => {
    e.preventDefault();
    dropZoneStatic.classList.remove('dragover');
    await handleFiles(e.dataTransfer.files, "Statique");
    // afficher tick si un fichier a été chargé
    if (state.acquisitions && state.acquisitions.some(a => a.fileName)) document.getElementById('tickStep3')?.classList.remove('hidden');
  });
  // Clicking the drop zone should open the file picker like the load button
  dropZoneStatic.addEventListener('click', (e) => {
    e.preventDefault();
    // Safely open the associated file picker button if present
    document.getElementById('loadStatic')?.click();
  });
}

document.getElementById("loadLigneDroite").addEventListener("click", () => {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = ".csv";

  input.addEventListener("change", (e) => {
    handleFiles(e.target.files, "LigneDroite");
  });

  input.click();
});

// Drop zone pour la ligne droite
const dropZoneLigneDroite = document.getElementById("dropZoneLigneDroite");
if (dropZoneLigneDroite) {
  dropZoneLigneDroite.addEventListener('dragover', (e) => { e.preventDefault(); dropZoneLigneDroite.classList.add('dragover'); });
  dropZoneLigneDroite.addEventListener('dragleave', () => { dropZoneLigneDroite.classList.remove('dragover'); });
  dropZoneLigneDroite.addEventListener('drop', async (e) => {
    e.preventDefault();
    dropZoneLigneDroite.classList.remove('dragover');
    await handleFiles(e.dataTransfer.files, "LigneDroite");
    if (state.acquisitions && state.acquisitions.some(a => a.fileName)) document.getElementById('tickStep4')?.classList.remove('hidden');
  });
  // Clicking the drop zone should open the file picker like the load button
  dropZoneLigneDroite.addEventListener('click', (e) => {
    e.preventDefault();
    // Safely open the associated file picker button if present
    document.getElementById('loadLigneDroite')?.click();
  });
}

document.getElementById("loadAcquis").addEventListener("click", () => {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = ".csv";
  input.multiple = true;

  input.addEventListener("change", (e) => {
    handleFiles(e.target.files, "Acquis");
  });

  input.click();
});

// Drop zone pour les acquisitions à traiter
const dropZoneAcquis = document.getElementById("dropZoneAcquis");
if (dropZoneAcquis) {
  dropZoneAcquis.addEventListener('dragover', (e) => { e.preventDefault(); dropZoneAcquis.classList.add('dragover'); });
  dropZoneAcquis.addEventListener('dragleave', () => { dropZoneAcquis.classList.remove('dragover'); });
  dropZoneAcquis.addEventListener('drop', async (e) => {
    e.preventDefault();
    dropZoneAcquis.classList.remove('dragover');
    await handleFiles(e.dataTransfer.files, "Acquis");
    if (state.acquisitions && state.acquisitions.some(a => a.fileName)) document.getElementById('tickStep5')?.classList.remove('hidden');
  });
  // Clicking the drop zone should open the file picker like the load button
  dropZoneAcquis.addEventListener('click', (e) => {
    e.preventDefault();
    // Safely open the associated file picker button if present
    document.getElementById('loadAcquis')?.click();
  });
}

// Bouton traitement des acquisitions
document.getElementById("saveDataIMUBtn").addEventListener("click", () => {
  console.log("%% Lissage, traitement statique et ligne droite %%");
  lisserDataIMU();

  traitementStatique();
  traitementLigneDroite();
  for (const acq of state.acquisitions) {
    if (acq.category === 'Acquis') {
      console.log("Traitement :", acq.fileName);
      traitementIMUChassis(acq);
      traitementIMURoues(acq);
      traitementCorrglissmeent(acq);
      sauvegardePretraitement(acq);
      markAcquisitionTreated(acq.fileName);
    }
  }
  
  //Message enregistrement réussi
  console.log("%%%%% Fin du traitement des acquisitions %%%%%");
  showStatus((window.i18n && typeof window.i18n.t === 'function') ? window.i18n.t('showStatus_savepreprocess') : "✅ Résultats enregistrés dans le dossier /Téléchargements !", "success","statusMsgSaveIMU");
});

// Affichage automatique des tick de validation
function unlockStep(currentStep, nextStepId, tickId) {
  const nextStep = nextStepId ? document.getElementById(nextStepId) : null;
  const cur = currentStep ? document.getElementById(currentStep) : null;
  // If this step was reopened via the "Modifier" button, we consider it an edit 
  // session: in that case validation should NOT automatically open the next step.
  const isEditing = cur && cur.dataset && cur.dataset.editing === 'true';

  // Open next step (and ensure it's unlocked) only when not coming from a Modify/edit session
  if (nextStep && !isEditing) {
    nextStep.classList.remove("locked");
    nextStep.open = true;
    const idNumNext = nextStepId.replace('step','');
    const validateBtnNext = document.getElementById('validateStep' + idNumNext);
    if (validateBtnNext) validateBtnNext.classList.add('highlight-btn');
  }

  // Close and lock the current step to prevent re-opening
  if (cur) {
    cur.open = false;
    cur.classList.add('locked');
    cur.dataset.locked = 'true';
    // mark as validated so buttons remain disabled until explicit 'Modifier'
    cur.dataset.validated = 'true';
    // disable this step's validate button so it cannot be clicked again
    if (currentStep) {
      const idNum2 = currentStep.replace('step','');
      const validateBtn = document.getElementById('validateStep' + idNum2);
      if (validateBtn) {
        validateBtn.disabled = true;
        validateBtn.classList.remove('highlight-btn');
      }
    }
    // If we were in an edit session, clear that flag now that the step is validated/locked
    if (isEditing) {
      delete cur.dataset.editing;
      step1 = document.getElementById('step1');
      step2 = document.getElementById('step2');
      step3 = document.getElementById('step3');
      step4 = document.getElementById('step4');
      step5 = document.getElementById('step5');
      if (step1.dataset.validated === 'true' && step2.dataset.validated === 'true' &&
          step3.dataset.validated === 'true' && step4.dataset.validated === 'true' &&
          step5.dataset.validated === 'true') {
        document.getElementById("saveDataIMUBtn").disabled = false;
        document.getElementById("saveDataIMUBtn").classList.add('highlight-btn');
      }
    }
  }

  if (tickId) {
    const tick = document.getElementById(tickId);
    if (tick) tick.classList.remove("hidden");
  }

  // Update button states after validation
  if (typeof updateAllValidateButtons === 'function') updateAllValidateButtons();
}

// Observer les changements dans state.acquisitions pour mettre à jour les boutons
function observeFileTables() {
  let prevCount = -1;
  setInterval(() => {
    const appState = (typeof getAppState === 'function') ? getAppState() : window.state;
    const count = appState && Array.isArray(appState.acquisitions) ? appState.acquisitions.length : 0;
    if (count !== prevCount) {
      prevCount = count;
        updateAllValidateButtons();
    }
  }, 300); // vérifie toutes les 300ms
}

// Initialisation au chargement de la page
document.addEventListener('DOMContentLoaded', () => {
  // Initialiser les boutons de sauvegarde et nouveau FRM comme désactivés
  const saveBtn = document.getElementById('saveDataIMUBtn');
  const newBtn = document.getElementById('newFRMBtn');
  if (saveBtn) saveBtn.disabled = true;
  if (newBtn) newBtn.disabled = true;

  // activer/désactiver les boutons selon l'état des tables
  // mettre à jour les boutons de validation des étapes 1/2 en priorité
  updateAllValidateButtons();  
  observeFileTables();
  
  // Initialiser le verrouillage/validation et attacher un handler 'click' sur le summary
  ['step1','step2','step3','step4','step5'].forEach(id => {
    const d = document.getElementById(id);
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
  });

  // Handlers pour les boutons Modifier : réouvrent le détail et réaffichent les boutons du tableau
  ['1','2','3','4','5'].forEach(n => {
    const btn = document.getElementById('modifyStep' + n);
    if (!btn) return;
    btn.addEventListener('click', () => {
      const stepId = 'step' + n;
      const d = document.getElementById(stepId);
      if (!d) return;
      // déverrouiller temporairement et rouvrir
      d.classList.remove('locked');
      d.dataset.validated = 'false';
      // mark this detail as being edited via the Modify button so validation later
      // won't automatically advance to the next step
      d.dataset.editing = 'true';
      // re-enable the validate button so the user can validate again after editing
      const revalBtn = document.getElementById('validateStep' + n);
      if (revalBtn) {
          revalBtn.disabled = false;
          revalBtn.classList.add('highlight-btn');
      }
        
      d.open = true;
      // réactiver les boutons du tableau correspondant
      if (typeof setFileTableButtonsState === 'function') {
        if (n === '3') setFileTableButtonsState('Statique', false);
        if (n === '4') setFileTableButtonsState('LigneDroite', false);
        if (n === '5') setFileTableButtonsState('Acquis', false);
      }
      // désactiver à nouveau le bouton modifier (il sera réactivé après nouvelle validation)
      btn.disabled = true;
      document.getElementById('saveDataIMUBtn').disabled = true;
      document.getElementById('tickStep' + n).classList.add("hidden");
    });
  });
});

// fonction lisserDataIMU
function lisserDataIMU() {
  // Lecture du choix utilisateur
  const sel = document.querySelector('input[name="initialFilter"]:checked');
  const filterChoice = sel ? sel.value : 'none';

  // Fréquence d'acquisition (coerce en Number)
  const Fe = (state && state.param && state.param.freqAcq) ? Number(state.param.freqAcq) : null;
  if (!Fe) {
    console.warn("Fréquence d'acquisition introuvable dans state.param.freqAcq — amélioration annulée");
    return;
  }

  // Accès à l’état global de l’application
  const appState = (typeof getAppState === 'function') ? getAppState() : window.state;
  if (!appState || !Array.isArray(appState.acquisitions)) return;

  // Déterminer la fonction de filtrage selon le choix utilisateur
  let filterFn = null;

  switch (filterChoice) {
    case 'none':
      // Aucun filtrage
      filterFn = data => data;
      break;

    case 'ma':
      filterFn = data => movingAverage(data, appState.param.winMA);
      break;

    case 'SG':
      const filters = getSGFilters(appState.param.winSG, appState.param.orderSG, Fe);
      filterFn = data => applySGFilter(data, filters.smooth);
      break;

    default:
      filterFn = data => data;
  }

  // Boucle principale : appliquer le filtre choisi
  for (const acq of appState.acquisitions) {
    ['IMUchassis', 'IMUroueGauche', 'IMUroueDroite'].forEach(key => {
      const imu = acq[key];
      if (!imu) return;
      Object.keys(imu).forEach(field => {
        const data = imu[field];
        if (!Array.isArray(data) || data.length === 0) return;
        try {
          imu[field] = filterFn(data);
        } catch (e) {
          console.warn('Erreur filtrage', acq.fileName, key, field, e.message);
        }
      });
    });
  }
} 

//fonction de traitement de la statique
function traitementStatique() {
  const appState = (typeof getAppState === 'function') ? getAppState() : window.state;
  if (!appState || !Array.isArray(appState.acquisitions)) return;

  for (const acq of appState.acquisitions) {
    if (!acq || acq.category !== 'Statique') continue;
    const imu = acq.IMUchassis;
    if (!imu) continue;

    const start = Math.round(acq.nbFrames / 4);
    const end = Math.round(acq.nbFrames * 3 / 4);

    const mx = meanIgnoringNaN(imu.accX, start, end);
    const my = meanIgnoringNaN(imu.accY, start, end);
    const mz = meanIgnoringNaN(imu.accZ, start, end);

    // Recherche de l'axe principal, considéré comme celui avec la plus grande valeur absolue (donc le plus proche de g)
    const valeursMoy = [mx, my, mz];
    const absValues = valeursMoy.map(Math.abs);
    const indiceMax = absValues.indexOf(Math.max(...absValues));

    appState.axePrincipal.chassis = indiceMax;
    appState.matricesRotations.chassis = Rpr_mvt_un_axe([mx, my, mz], indiceMax);
  }
}

//fonction de traitement de la ligne droite
function traitementLigneDroite() {
  const appState = (typeof getAppState === 'function') ? getAppState() : window.state;
  if (!appState || !Array.isArray(appState.acquisitions)) return;

  for (const acq of appState.acquisitions) {
    if (!acq || acq.category !== 'LigneDroite') continue;
    const imuRD = acq.IMUroueDroite;
    const imuRG = acq.IMUroueGauche;
    if (!imuRD && !imuRG) continue;

    const mgx = meanIgnoringNaN(imuRD.gyrX);
    const mgy = meanIgnoringNaN(imuRD.gyrY);
    const mgz = meanIgnoringNaN(imuRD.gyrZ);

    const valeursMoy = [mgx, mgy, mgz];
    const absValues = valeursMoy.map(Math.abs);
    const axePrincipal = absValues.indexOf(Math.max(...absValues));
    appState.axePrincipal.roueDroite = axePrincipal;

    const mgxG = meanIgnoringNaN(imuRG.gyrX);
    const mgyG = meanIgnoringNaN(imuRG.gyrY);
    const mgzG = meanIgnoringNaN(imuRG.gyrZ);

    const valeursMoyG = [mgxG, mgyG, mgzG];
    const absValuesG = valeursMoyG.map(Math.abs);
    const axePrincipalG = absValuesG.indexOf(Math.max(...absValuesG));
    appState.axePrincipal.roueGauche= axePrincipalG;  

    //enregister si on doit inverser le signe de la vitesse angulaire d'une des deux roues
    if (trapz([imuRD.gyrX, imuRD.gyrY, imuRD.gyrZ][axePrincipal]) < 0) {
      appState.inversionVitesseAngulaire.roueDroite = true;
      console.log("Inversion de la vitesse angulaire de la roue droite sur la base de la ligne droite");
    }
    if (trapz([imuRG.gyrX, imuRG.gyrY, imuRG.gyrZ][axePrincipalG]) < 0) {
      appState.inversionVitesseAngulaire.roueGauche = true;
      console.log("Inversion de la vitesse angulaire de la roue gauche sur la base de la ligne droite");
    }

    //Calcul d'un seuil à 80% de la valeur maximale sur l'axe principal (pour isoler les mouvements significatifs)
    const gyrPrincipal = [
      imuRD.gyrX,
      imuRD.gyrY,
      imuRD.gyrZ
    ][axePrincipal];
    const maxVal = Math.max(...gyrPrincipal.map(Math.abs));
    const seuil = 0.8 * maxVal;
    
    const accXseuil = [];
    const accYseuil = [];
    const accZseuil = [];
    const matricesRotationRD = [];
    const matricesRotationRG = [];
    for (let iFrame = 0; iFrame < acq.nbFrames; iFrame++) {
       if (Math.abs(gyrPrincipal[iFrame]) <= seuil) continue;
      matricesRotationRD.push(Rpr_mvt_un_axe([imuRD.gyrX[iFrame], imuRD.gyrY[iFrame], imuRD.gyrZ[iFrame]], axePrincipal));
      matricesRotationRG.push(Rpr_mvt_un_axe([imuRG.gyrX[iFrame], imuRG.gyrY[iFrame], imuRG.gyrZ[iFrame]], axePrincipal));

      accXseuil.push(acq.IMUchassis.accX[iFrame]);
      accYseuil.push(acq.IMUchassis.accY[iFrame]);
      accZseuil.push(acq.IMUchassis.accZ[iFrame]);
    }

    //Identification de l'axe secondaire pour la centrale du châssis (axe dans le sens du déplacement)
    const axePrincipalchassis = appState?.axePrincipal?.chassis || 2;
    const meanAccX = meanIgnoringNaN(accXseuil.map(Math.abs), 0);
    const meanAccY = meanIgnoringNaN(accYseuil.map(Math.abs), 0);
    const meanAccZ = meanIgnoringNaN(accZseuil.map(Math.abs), 0);

    const valeursMoyAcc = [meanAccX, meanAccY, meanAccZ];
    const valeurMoyAcchorsaxePrincipal = valeursMoyAcc.filter((_,i) => i !== axePrincipalchassis);
    const axeSecondaire = valeurMoyAcchorsaxePrincipal.indexOf(Math.max(...valeurMoyAcchorsaxePrincipal));
    appState.axeSecondaire.chassis = axeSecondaire;

    // Calcul de la matrice de rotation moyenne
    const matRDmoy = meanRotationMatrix(matricesRotationRD);
    const matRGmoy = meanRotationMatrix(matricesRotationRG);

    // On s'assure que la matrice soit bien orthogonale par recalage rigide (SVD)
    appState.matricesRotations.roueDroite = fct_recalage(matRDmoy);
    appState.matricesRotations.roueGauche = fct_recalage(matRGmoy);
  }
}

// fonction de traitement de l'IMU châssis
function traitementIMUChassis(acq) {
  const appState = (typeof getAppState === 'function') ? getAppState() : window.state;
  if (!acq || acq.category !== 'Acquis') return;
  const imu = acq.IMUchassis;
  if (!imu) return;

  const gyrVec = [imu.gyrX, imu.gyrY, imu.gyrZ];
  const accVec = [imu.accX, imu.accY, imu.accZ];

  const vitAngRf = numeric.dot(appState.matricesRotations.chassis, gyrVec); 
  const accLinRf = numeric.dot(appState.matricesRotations.chassis, accVec);

  acq.dataIMUChassis.vitAngRf = vitAngRf;
  acq.dataIMUChassis.accLinRf = accLinRf;
}

// fonction de traitement des IMU roues
function traitementIMURoues(acq) {
  const appState = (typeof getAppState === 'function') ? getAppState() : window.state;
  if (!acq || acq.category !== 'Acquis') return;
  const imuRD = acq.IMUroueDroite;
  const imuRG = acq.IMUroueGauche;
  if (!imuRD || !imuRG) return;

  const gyrRD = [imuRD.gyrX, imuRD.gyrY, imuRD.gyrZ];
  const gyrRG = [imuRG.gyrX, imuRG.gyrY, imuRG.gyrZ];

  let vitAngRD_temp = numeric.dot(appState.matricesRotations.roueDroite, gyrRD);
  let vitAngRG_temp = numeric.dot(appState.matricesRotations.roueGauche, gyrRG);

  // si vitesse angulaire négative, on inverse le signe
  if (appState.inversionVitesseAngulaire.roueDroite) {
    vitAngRD_temp = vitAngRD_temp.map(v => v.map(x => -x));
  }
  if (appState.inversionVitesseAngulaire.roueGauche) {
    vitAngRG_temp = vitAngRG_temp.map(v => v.map(x => -x));
  }

  //enregistrement des vitesses de rotation des roues
  acq.dataIMURoues.vitAngRD = vitAngRD_temp;
  acq.dataIMURoues.vitAngRG = vitAngRG_temp;

  //application de pansiot
  pansiot2011(acq);
}

// fonction de traitement de la correction du glissement
function traitementCorrglissmeent(acq) {
  const appState = (typeof getAppState === 'function') ? getAppState() : window.state;
  if (!acq || acq.category !== 'Acquis') return;
  const vitRotRoue = acq.dataIMURoues.vitAngFRMroue;
  const col = appState?.axePrincipal?.chassis || 2;
  const vitRotchassis = acq.dataIMUChassis.vitAngRf[col];
  const deltaW = numeric.sub(vitRotchassis,vitRotRoue);
  const seuil_deltaW = 0.2;
  const outputglissment = calculTauxGlissement(deltaW, seuil_deltaW);

  const vitIMUSansCorrection = acq.dataIMURoues.vitLineaireFRMSc;
  const accIMUChassis = acq.dataIMUChassis.accLinRf[appState.axeSecondaire.chassis];
  const debutgliss = outputglissment.debutGliss;
  const fingliss = outputglissment.finGliss;
  const nbGliss = debutgliss.length;
  const freq = appState.param.freqAcq;

  const resultat = correctionGlissement(vitIMUSansCorrection, accIMUChassis, debutgliss, fingliss, nbGliss, freq);

  // Enregistrement du résultat
  acq.correctionGlissement = outputglissment;
  acq.correctionGlissement.vitLinCorrGliss = resultat.vitLinCorrGliss;
}

// fonction de sauvegarde du prétraitement
function sauvegardePretraitement(acq) {
  const appState = (typeof getAppState === 'function') ? getAppState() : window.state;
  const vitLin = acq?.correctionGlissement?.vitLinCorrGliss;
  const col = appState?.axePrincipal?.chassis || 2; // axe principal du châssis
  const vitAng = acq?.dataIMUChassis?.vitAngRf?.[col];
  const vitAngDegs = vitAng.map(v => v * (180 / Math.PI)); // conversion en deg/s
  const fs = appState?.param?.freqAcq;


  if (!Array.isArray(vitLin) || !Array.isArray(vitAngDegs)) {
    console.error((window.i18n && typeof window.i18n.t === 'function') ? window.i18n.t('error_missingData') : "Données introuvables pour sauvegarde du prétraitement");
    return;
  }
  const CSVprttmtname = acq.fileName + '_preprocessed.csv';
  
  const n = Math.min(vitLin.length, vitAngDegs.length);

  // Création du CSV : en-tête (use i18n if available)
  const detectedLang = (window.i18n && window.i18n.currentLang) ? window.i18n.currentLang : (localStorage.getItem('siteLang') || ((navigator.language || navigator.userLanguage || 'fr').startsWith('en') ? 'en' : 'fr'));
  const header = [
    (window.i18n && typeof window.i18n.t === 'function') ? window.i18n.t('csv_header_time') : (detectedLang === 'en' ? 'Time (s)' : 'Temps (s)'),
    (window.i18n && typeof window.i18n.t === 'function') ? window.i18n.t('csv_header_vit_lin') : (detectedLang === 'en' ? 'Linear velocity (m/s)' : 'Vitesse lineaire (m/s)'),
    (window.i18n && typeof window.i18n.t === 'function') ? window.i18n.t('csv_header_vit_ang') : (detectedLang === 'en' ? 'Angular velocity (deg/s)' : 'Vitesse angulaire (deg/s)')
  ];
  const lines = [header];
  for (let i = 0; i < n; i++) {
    const t = (i / fs).toFixed(3); // arrondi à la milliseconde
    lines.push([t, vitLin[i], vitAngDegs[i]]);
  }

  const csvContent = lines.map(row => row.join(";")).join("\n");
  // Création du Blob et téléchargement
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = CSVprttmtname;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// Moyenner des matrices 3D
function meanRotationMatrix(matrices) {
  if (!Array.isArray(matrices) || matrices.length === 0) return null;
  const n = matrices.length;
  const M = Array.from({ length: 3 }, () => Array(3).fill(0));

  // Somme de toutes les matrices
  for (const mat of matrices) {
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) {
        M[i][j] += mat[i][j];
      }
    }
  }

  // Moyenne élément par élément
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      M[i][j] /= n;
    }
  }

  return M;
}

//fonction de recalage rigide par SVD
function fct_recalage(Cluster_Reference) {
  const baseId = numeric.identity(3);
  const { Transformation } = Recalage_svd(Cluster_Reference, baseId);

  const MR2R1t = numeric.transpose(Transformation.MR2R1);
  const translation = Transformation.translation;

  // Transformation homogène 4x4
  const MH_R1R2 = [
    [...MR2R1t[0], translation[0]],
    [...MR2R1t[1], translation[1]],
    [...MR2R1t[2], translation[2]],
    [0,0,0,1]
  ];

  // Application aux données
  const Data_homog = baseId.map(r => [...r,1]);
  const Registered_homog = numeric.dot(MH_R1R2, numeric.transpose(Data_homog));
  const Registered_Data = numeric.transpose(Registered_homog).map(r => r.slice(0,3));

  return Registered_Data;
}

// ------------ Recalage SVD (Traduction IA from MATLAB)---------------
function Recalage_svd(Ref, Rec) {
  // 1️⃣ Sélection des points valides (non NaN)
  const Rec_sel = [];
  const Ref_sel = [];
  for (let i = 0; i < Rec.length; i++) {
    if (!isNaN(Rec[i][0]) && !isNaN(Ref[i][0])) {
      Rec_sel.push(Rec[i]);
      Ref_sel.push(Ref[i]);
    }
  }

  if (Rec_sel.length < 3) {
    const nanMatrix = Array.from({ length: 3 }, () => Array(3).fill(NaN));
    return {
      NRec: Rec.map(() => [NaN, NaN, NaN]),
      Transformation: {
        MR2R1: nanMatrix,
        translation: [NaN, NaN, NaN]
      }
    };
  }

  // 2️⃣ Moyenne (centre)
  const Ref_mean = meanMatrixRows(Ref_sel);
  const Rec_mean = meanMatrixRows(Rec_sel);

  // 3️⃣ Centrage
  const Rec_i = numeric.transpose(subtractMatrixRows(Rec_sel, Rec_mean));
  const Ref_i = numeric.transpose(subtractMatrixRows(Ref_sel, Ref_mean));

  // 4️⃣ Matrice de corrélation
  const C = numeric.dot(Ref_i, numeric.transpose(Rec_i));

  // 5️⃣ Décomposition SVD via fonction maison
  const svd = numeric.svd(C);
  const Vt = numeric.transpose(svd.V);

  // 6️⃣ Calcul rotation
  const detSign = numeric.det(numeric.dot(svd.U, Vt)) < 0 ? -1 : 1;
  const D = [[1,0,0],[0,1,0],[0,0,detSign]]; // diag([1,1,det])
  const MR2R1 = numeric.transpose(numeric.dot(numeric.dot(svd.U, D), Vt));

  // 7️⃣ Translation
  const MR2R1_Rec_mean = numeric.dot(Rec_mean, MR2R1);
  const translation = numeric.sub(Ref_mean, MR2R1_Rec_mean);

  // 8️⃣ Application aux points Rec
  const NRec = Rec.map(r => addVectors(numeric.dot(MR2R1, r), translation));

  return {
    NRec,
    Transformation: {
      MR2R1,
      translation
    }
  };
}

// --------------- Fonction Pansiot 2011 ------------------
function pansiot2011(acq) {
  const appState = (typeof getAppState === 'function') ? getAppState() : window.state;
  // Récupération des paramètres nécessaires
  const Fe = (appState && appState.param && appState.param.freqAcq) ? appState.param.freqAcq : null;
  const carrossage = (appState && appState.param && appState.param.carrossage) ? appState.param.carrossage : null;
  const rayonRoueDroite = (appState && appState.param && appState.param.rayonRoueDroite) ? appState.param.rayonRoueDroite : null;
  const rayonRoueGauche = (appState && appState.param && appState.param.rayonRoueGauche) ? appState.param.rayonRoueGauche : null;
  
  const distCentresRoues = (appState && appState.param && appState.param.distCentresRoues) ? appState.param.distCentresRoues : null;

  if (!Fe || !carrossage || !rayonRoueGauche || !rayonRoueDroite || !distCentresRoues) {
    console.warn("Paramètres manquants dans state.param — traitement des roues annulé");
    return;
  }

  const axePrincipalRoueDroite = appState.axePrincipal.roueDroite;
  const axePrincipalRoueGauche = appState.axePrincipal.roueGauche;

  const resultD = reorderGyr(acq.dataIMURoues.vitAngRD, axePrincipalRoueDroite);
  const resultG = reorderGyr(acq.dataIMURoues.vitAngRG, axePrincipalRoueGauche);

  // Calcul omegaPD et omegaPG
  const omegaPD = resultD.gyrY.map((y,i) => y - tand(carrossage) * Math.sqrt(resultD.gyrX[i]**2 + resultD.gyrZ[i]**2));
  const omegaPG = resultG.gyrY.map((y,i) => y + tand(carrossage) * Math.sqrt(resultG.gyrX[i]**2 + resultG.gyrZ[i]**2));

  // Vitesses linéaires par roue
  const vitLinRD = omegaPD.map(w => w * rayonRoueDroite);
  const vitLinRG = omegaPG.map(w => w * rayonRoueGauche);

  acq.dataIMURoues.vitLinRD = vitLinRD;
  acq.dataIMURoues.vitLinRG = vitLinRG;

  // Vitesse linéaire moyenne FRMSc
  acq.dataIMURoues.vitLineaireFRMSc = vitLinRD.map((val, i) => (val + vitLinRG[i]) / 2);

  // Vitesse angulaire FRM roue
  acq.dataIMURoues.vitAngFRMroue = vitLinRD.map((v,i) => (v - vitLinRG[i])/distCentresRoues);
}

function reorderGyr(gyr, axePrincipal) {
  const others = [0,1,2].filter(i => i !== axePrincipal);

  const gyrX = gyr[others[0]];
  const gyrY = gyr[axePrincipal];
  const gyrZ = gyr[others[1]];

  return { gyrX, gyrY, gyrZ };
}

// --------------- Fonctions correction du glissement ------------------
function calculTauxGlissement(deltaW, seuil) {
  const start = [];
  const end = [];
  const n = deltaW.length;

  // Détection des fenêtres de glissement
  for (let i = 0; i < n; i++) {
    if (Math.abs(deltaW[i]) > seuil) {
      const startIdx = i;
      start.push(startIdx);
      while (i < n && Math.abs(deltaW[i]) > seuil) i++;
      const endIdx = i - 1;
      end.push(endIdx);
    }
  }

  // Fusion des fenêtres trop proches (< 10 frames)
  for (let i = 1; i < start.length; i++) {
    if (start[i] - end[i - 1] < 10) {
      start.splice(i, 1);
      end.splice(i - 1, 1);
      i--; // revenir en arrière pour vérifier la fusion
    }
  }

  // Calculs principaux
  const durations = end.map((e, i) => e - start[i] + 1);
  const totalFrames = durations.reduce((a, b) => a + b, 0);
  const nbOccur = durations.length;
  const meanDuration = nbOccur ? totalFrames / nbOccur : 0;
  const pourcentage = (totalFrames / n) * 100;

  // Liste des frames avec glissement (concat directe)
  const frames = start.flatMap((s, i) =>
    Array.from({ length: end[i] - s + 1 }, (_, k) => s + k)
  );

  // Résultat final
  return {
    framesGlissement: frames,
    fenetresGlissement: durations,
    dureeFenetreGlissementMoyenne: meanDuration,
    nbFramesGlissementTotal: totalFrames,
    nbOccurrenceGlissement: nbOccur,
    nbFrameAcquisition: n,
    pourcentageTempsGlissement: pourcentage,
    debutGliss: start,
    finGliss: end,
  };
}

function correctionGlissement(vitIMUSansCorrection, accIMUChassis, debutGliss, finGliss, nbGliss,fs) {
  if (nbGliss === 0) {
    return { vitLinCorrGliss: vitIMUSansCorrection };
  }

  let tempSpeed = [...vitIMUSansCorrection];

  for (let j = 0; j < nbGliss; j++) {
    const deb = debutGliss[j];
    const fin = finGliss[j];
    const curTailleFenetre = fin - deb + 1;

    if (curTailleFenetre > 6) {
      // Mise à NaN pendant le glissement
      for (let k = deb; k <= fin; k++) tempSpeed[k] = NaN;

      // Accélération sur la période
      const cur_aX = accIMUChassis.slice(deb, fin + 1);
      const dt = 1 / fs;

      // Filtrage passe-bas (Butterworth)
      const fc = 2; // Hz
      const {b, a} = butterworth2Lowpass(fc, fs); // BW d'ordre 2 codé uniquement.
      const a_x_filt = filtfilt(b, a, cur_aX); // Pas exactement le comportement MATLAB mais au plus proche.

      // Intégration numérique (trapèzes)
      const v = integrateCumulative(a_x_filt, dt);

      // Alignement avec la vitesse avant glissement
      if (deb > 0) v.forEach((_, idx) => (v[idx] += tempSpeed[deb - 1]));

      // Correction linéaire pour recoller à la fin
      if (fin + 1 < tempSpeed.length) {
        const x = Array.from({ length: v.length }, (_, i) => i);
        const diff = v[v.length - 1] - tempSpeed[fin + 1];
        v.forEach((_, i) => (v[i] -= (diff / (v.length - 1)) * x[i]));
      }

      // Remplacement des valeurs corrigées
      for (let k = 0; k < v.length; k++) {
        tempSpeed[deb + k] = v[k];
      }
    }
  }

  return { vitLinCorrGliss: tempSpeed };
}

// Bouton 'Nouveau FRM' : réinitialise les étapes 2 à 5, vide les tables de fichiers
document.getElementById('newFRMBtn').addEventListener('click', () => {
  const appState = (typeof getAppState === 'function') ? getAppState() : window.state;
  if (appState && Array.isArray(appState.acquisitions)) {
    appState.acquisitions.length = 0; // vider sans changer la référence
  }

  // Vider les TBODY des tableaux par catégorie si présents
  const tableIds = ['fileTableStatique','fileTableLigneDroite','fileTableAcquis','fileTable'];
  tableIds.forEach(id => {
    const tbl = document.getElementById(id);
    if (!tbl) return;
    const tbody = tbl.querySelector('tbody');
    if (tbody) tbody.innerHTML = '';
  });

  // Réinitialiser les steps 2..5 : marquer non validés et verrouillés
  ['step2','step3','step4','step5'].forEach(stepId => {
    const d = document.getElementById(stepId);
    if (!d) return;
    d.dataset.validated = 'false';
    d.dataset.locked = 'true';
    d.classList.add('locked');
    d.open = false;
    // cacher le tick associé (ids: tickStep2..tickStep5)
    const num = stepId.replace('step','');
    const tick = document.getElementById('tickStep' + num);
    if (tick) tick.classList.add('hidden');
    // désactiver le bouton validate correspondant
    const vbtn = document.getElementById('validateStep' + num);
    if (vbtn) vbtn.disabled = true;
  });

  // Conserver l'étape 1 validée si elle l'était
  const step1 = document.getElementById('step1');
  if (step1) {
    step1.dataset.validated = 'true';
    step1.dataset.locked = 'true';
    step1.classList.add('locked');
    step1.open = false;
    const tick1 = document.getElementById('tickStep1');
    if (tick1) tick1.classList.remove('hidden');
    const vbtn1 = document.getElementById('validateStep1');
    if (vbtn1) vbtn1.disabled = true;
  }

  // Réinitialiser les paramètres FRM (inputs et état)
  const inputsToClear = [
    'FRMcarrossage',
    'FRMRayonRoues','FRMRayonRoueG','FRMRayonRoueD',
    'FRMdistCentresRoues'
  ];
  inputsToClear.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  if (appState && appState.param) {
    appState.param.carrossage = '';
    appState.param.rayonRoueGauche = '';
    appState.param.rayonRoueDroite = '';
    appState.param.distCentresRoues = '';
  }

  // Déverrouiller et ouvrir step2 pour commencer le nouveau FRM
  const step2 = document.getElementById('step2');
  if (step2) {
    step2.classList.remove('locked');
    step2.removeAttribute('data-locked');
    step2.dataset.validated = 'false';
    step2.open = true;
  }

  // Désactiver le bouton d'enregistrement et actualiser l'état des boutons
  const saveBtn = document.getElementById('saveDataIMUBtn');
  const newBtn = document.getElementById('newFRMBtn');
  if (saveBtn) saveBtn.disabled = true;
  if (newBtn) newBtn.disabled = true;

  if (typeof updateFileTableState === 'function') updateFileTableState(true);
  if (typeof updateAllValidateButtons === 'function') updateAllValidateButtons();
});

