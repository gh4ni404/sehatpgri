// const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxFwJo0NgeDlRv0C8hz3LJGQP1hx-XrTWH5Ln7ATklUQAnOhNFJRoG0RUDwlwvueDBDGA/exec";
// const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxeyMslfLamw3n1tULtwn3PNCQuQapHN130iJQOua9Ofh8D467SYM-5mAptdJWTQ6fR/exec";
const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxeyMslfLamw3n1tULtwn3PNCQuQapHN130iJQOua9Ofh8D467SYM-5mAptdJWTQ6fR/exec";
const form = document.getElementById("formPendaftaran");
const nikError = document.getElementById('nik-error');
const nikSuccess = document.getElementById('nik-success');
const loading = document.getElementById('loading');
const nikInput = document.getElementById('nik');
const kecamatanSelect = document.getElementById('kecamatan');
const kecamatanError = document.getElementById('kecamatan-error');
const instansiWrapper = document.getElementById('instansi-wrapper');
const instansiInput = document.getElementById('instansi');
const instansiToggle = document.getElementById('instansi-toggle');
const instansiDropdown = document.getElementById('instansi-dropdown');
const btnPendaftaran = document.getElementById('btnPendaftaran');
const btnCekNik = document.getElementById('btnCekNik');
const formPendaftaran = document.getElementById('formRegistrasi');
const formCekNik = document.getElementById('formCekNik');
const btnSearch = document.getElementById('btn-search');
const resultArea = document.getElementById('result');
const searchNik = document.getElementById('search-nik');

// Fungsi untuk generate nomor pendaftaran
// function generateNomorPendaftaran() {
//   return "PGRIBERAMAL-"+Date.now().toString().slice(-6);
// }

// Fungsi untuk mengecek apakah nomor Pendaftaran sudah ada
// async function checkNomorPendaftaranExists(nomorPendaftaran) {
//   try {
//     const response = await fetch(`${SCRIPT_URL}?action=check_nomor_pendaftaran&nomor_pendaftaran=${encodeURIComponent(nomorPendaftaran)}`);
//     const result = await response.json();
//     return result.exists || false;
//   } catch(error){
//     console.error('Error checking nomor pendaftaran: ', error);
//     return false;
//   }
// }

// Fungsi untuk mendapatkan nomor pendaftaran yang unik
// async function getUniqueNomorPendaftaran() {
//   let nomorPendaftaran;
//   let isUnique = false;
//   let attempts = 0;
//   const maxAttempts = 5; 
//   while (!isUnique && attempts < maxAttempts) {
//     nomorPendaftaran = generateNomorPendaftaran();
//     const exists = await checkNomorPendaftaranExists(nomorPendaftaran);

//     if(!exists) {
//       isUnique = true;
//     } else {
//       attempts++;
//       console.log(`Nomor Pendaftaran ${nomorPendaftaran} sudah ada, mencoba lagi...`);
//       await new Promise(resolve => setTimeout(resolve, 100));
//     }
//   }
//   if (!isUnique) {
//     throw new Error('Gagal menghasilkan nomor pendaftaran unik setelah beberapa percobaan');
//   }
//   return nomorPendaftaran;
// }

nikInput.addEventListener('input', async function () {
  const nik = this.value.trim();

  nikError.style.display = 'none';
  nikSuccess.style.display = 'none';

  if (nik.length === 16 && /^\d+$/.test(nik)) {
    loading.classList.remove('hidden');
    submitBtn.disabled = true;

    try {
      const response = await fetch(`${SCRIPT_URL}?action=check_nik&nik=${nik}`);
      const result = await response.json();

      loading.classList.add('hidden');

      if (result.exists) {
        nikError.textContent = 'NIK sudah terdaftar!';
        nikError.style.display = 'block';
        submitBtn.disabled = true;
      } else {
        nikSuccess.textContent = 'NIK tersedia';
        nikSuccess.style.display = 'block';
        submitBtn.disabled = false;
      }
    } catch (error) {
      loading.classList.add('hidden');
      console.error('Error checking NIK:', error);
      submitBtn.disabled = false;
    }
  } else if (nik.length === 0 || nik.length < 16) {
    nikError.textContent = 'NIK harus terdiri dari 16 digit angka.';
    nikError.style.display = 'block';
    submitBtn.disabled = true;
  } else {
    submitBtn.disabled = false;
  }
});

form.addEventListener("submit", async function (e) {
  e.preventDefault();

  const nik = nikInput.value.trim();
  if (nik.length !== 16 || !/^\d+$/.test(nik)) {
    nikError.textContent = 'NIK harus terdiri dari 16 digit angka.';
    nikError.style.display = 'block';
    return;
  }

  const kecamatan = kecamatanSelect.value.trim();
  if (!kecamatan) {
    kecamatanError.textContent = 'Silakan pilih kecamatan terlebih dahulu.';
    kecamatanError.style.display = 'block';
    kecamatanSelect.focus();
    return;
  }
  kecamatanError.style.display = 'none';

  const canonicalInstansi = resolveInstansiValue(instansiInput.value);
  if (!canonicalInstansi) {
    instansiInput.value = '';
    instansiInput.focus();
    return;
  }
  instansiInput.value = canonicalInstansi;

  loading.classList.remove('hidden');
  submitBtn.disabled = true;
  
  // const nomorPendaftaran = await getUniqueNomorPendaftaran();

  const formData = new FormData(form);
  const data = Object.fromEntries(formData);
  data.instansi = canonicalInstansi;

  // const nomorPendaftaran = "PGRI-" + Date.now().toString().slice(-6);
  data.alamat = data.alamat || "";
  // data.nomor_pendaftaran = nomorPendaftaran;
  data.timestamp = new Date().toISOString();

  try {
    const response = await fetch(SCRIPT_URL, {
      method: "POST",
      body: JSON.stringify(data)
    });
    const result = await response.json();

    if (result.success) {
      addInstansiOption(canonicalInstansi);
      form.reset();
      nikSuccess.style.display = 'none';
      kecamatanError.style.display = 'none';
      closeInstansiDropdown();
      // alert(`✅ Pendaftaran berhasil dikirim! Nomor Pendaftaran Anda: ${nomorPendaftaran}`);
      alert(`✅ Pendaftaran berhasil dikirim! Nomor Pendaftaran Anda: ${result.nomor_pendaftaran}`);
    } else {
      throw new Error(result.message || 'Terjadi kesalahan saat mendaftar.');
    }
  } catch (error) {
    if (error.message.includes('NIK sudah terdaftar')) {
      nikError.textContent = error.message;
      nikError.style.display = 'block';
    } else {
      alert('❌ Terjadi kesalahan: ' + error.message);
    }
  } finally {
    loading.classList.add('hidden');
    submitBtn.disabled = false;
  }
});

nikInput.addEventListener('keypress', function (e) {
  const char = String.fromCharCode(e.keyCode);
  if (!/^\d$/.test(char)) {
    e.preventDefault();
  }
});

kecamatanSelect.addEventListener('change', function () {
  if (this.value.trim()) {
    kecamatanError.style.display = 'none';
  } else {
    kecamatanError.textContent = 'Silakan pilih kecamatan terlebih dahulu.';
    kecamatanError.style.display = 'block';
  }
});

function setActiveTab(tab) {
  if (tab === "pendaftaran") {
    btnPendaftaran.classList.add("bg-green-600", "text-white");
    btnPendaftaran.classList.remove("bg-white", "text-green-700", "border", "border-green-600");

    btnCekNik.classList.add("bg-white", "text-green-700", "border", "border-green-600");
    btnCekNik.classList.remove("bg-green-600", "text-white");

    formPendaftaran.classList.remove("hidden");
    formCekNik.classList.add("hidden");
  } else {
    btnCekNik.classList.add("bg-green-600", "text-white");
    btnCekNik.classList.remove("bg-white", "text-green-700", "border", "border-green-600");

    btnPendaftaran.classList.add("bg-white", "text-green-700", "border", "border-green-600");
    btnPendaftaran.classList.remove("bg-green-600", "text-white");

    formCekNik.classList.remove("hidden");
    formPendaftaran.classList.add("hidden");
  }
}

btnPendaftaran.addEventListener("click", () => setActiveTab("pendaftaran"));
btnCekNik.addEventListener("click", () => setActiveTab("cek-nik"));

setActiveTab("pendaftaran");

// Cegah format ilmiah
searchNik.addEventListener("input", e => {
  e.target.value = e.target.value.replace(/[^0-9]/g, "").slice(0, 16);
});

btnSearch.addEventListener("click", async () => {
  const nik = searchNik.value.trim();
  if (nik.length !== 16) {
    result.innerHTML = `<p class="text-red-500 font-medium">⚠️ NIK harus 16 digit angka.</p>`;
    return;
  }

  result.innerHTML = `<div class="flex justify-center items-center">
        <div class="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-green-600 mr-2"></div> Memeriksa data...
      </div>`;

  try {
    const res = await fetch(`${SCRIPT_URL}?action=check_by_nik&nik=${nik}`);
    const data = await res.json();

    if (data && data.exists) {
      const d = data.data;
      result.innerHTML = `
            <div class="mt-4 bg-green-50 border border-green-200 rounded-lg p-5 text-left shadow">
              <h3 class="text-lg font-semibold text-green-700 mb-2 text-center">✅ Data Ditemukan</h3>
              <div class="space-y-1 text-sm">
                <p><b>Nama:</b> ${d.nama}</p>
                <p><b>Kategori:</b> ${d.kategori}</p>
                <p><b>Instansi:</b> ${d.instansi}</p>
                <p><b>Telepon:</b> ${d.telepon}</p>
                ${d.kecamatan ? `<p><b>Kecamatan:</b> ${d.kecamatan}</p>` : ''}
                ${d.alamat ? `<p><b>Alamat:</b> ${d.alamat}</p>` : ''}
                <p><b>Nomor Pendaftaran:</b> <span class="font-semibold">${d.nomor_pendaftaran}</span></p>
              </div>
            </div>`;
    } else {
      result.innerHTML = `<p class="text-red-500 font-medium mt-3">❌ NIK tidak ditemukan dalam database.</p>`;
    }
  } catch (err) {
    result.innerHTML = `<p class="text-red-500 font-medium">Terjadi kesalahan koneksi.</p>`;
    console.error(err);
  }
});

// Enhanced sticky effect dengan shadow pada scroll
document.addEventListener('DOMContentLoaded', function () {
  const stickyNav = document.getElementById('stickyNav');
  const mainContent = document.querySelector('.main-content');

  // Untuk mobile: tambahkan padding ke main content
  if (window.innerWidth <= 768) {
    const navHeight = stickyNav.offsetHeight;
    if (mainContent) {
      mainContent.style.paddingTop = navHeight + 'px';
    }
  }

  // Shadow effect pada scroll
  window.addEventListener('scroll', function () {
    if (window.scrollY > 10) {
      stickyNav.classList.add('scrolled');
    } else {
      stickyNav.classList.remove('scrolled');
    }
  });

  // Handle resize
  window.addEventListener('resize', function () {
    if (window.innerWidth <= 768) {
      const navHeight = stickyNav.offsetHeight;
      if (mainContent) {
        mainContent.style.paddingTop = navHeight + 'px';
      }
    } else {
      if (mainContent) {
        mainContent.style.paddingTop = '0';
      }
    }
  });
});

// ==================== SEARCHABLE DROPDOWN ASAL SEKOLAH ====================
const INSTANSI_REFRESH_COOLDOWN_MS = 20000; // Refresh maksimal tiap 20 detik
let instansiOptions = [];
let instansiLoading = true;
let instansiLastFetchAt = 0;
let instansiFetchPromise = null;
let activeInstansiIndex = -1;

const INSTANSI_ABBREV_RULES = [
  [/\bSMK\s+(?:NEGERI|N)\b/g, 'SMKN'],
  [/\bSMA\s+(?:NEGERI|N)\b/g, 'SMAN'],
  [/\bSMP\s+(?:NEGERI|N)\b/g, 'SMPN'],
  [/\bSD\s+(?:NEGERI|N)\b/g, 'SDN'],
  [/\bSLB\s+(?:NEGERI|N)\b/g, 'SLBN'],
  [/\bMTS\s+(?:NEGERI|N)\b/g, 'MTSN'],
  [/\bMA\s+(?:NEGERI|N)\b/g, 'MAN'],
  [/\bMI\s+(?:NEGERI|N)\b/g, 'MIN'],
  [/\bSD\s+INP\b/g, 'SD INPRES']
];

function normalizeInstansi(value) {
  let text = String(value || '').trim().replace(/\s+/g, ' ').toUpperCase();
  if (!text) return '';

  text = text
    .replace(/\b(TK|SD|SMP|SMA|SMK|SLB|MI|MTS|MA|MIN|MTSN|MAN|SDN|SMPN|SMAN|SMKN|SLBN)\./g, '$1 ')
    .replace(/\bN\.\s*/g, 'N ')
    .replace(/\s+/g, ' ')
    .trim();

  for (const [pattern, replacement] of INSTANSI_ABBREV_RULES) {
    text = text.replace(pattern, replacement);
  }

  return text.replace(/\s+/g, ' ').trim();
}

function insertUniqueInstansi(list, value) {
  const normalized = normalizeInstansi(value);
  if (!normalized || normalized === 'TIDAK DIKETAHUI') return false;
  if (list.includes(normalized)) return false;
  list.push(normalized);
  return true;
}

function resolveInstansiValue(rawValue) {
  return normalizeInstansi(rawValue);
}

function addInstansiOption(value) {
  if (insertUniqueInstansi(instansiOptions, value)) {
    instansiOptions.sort((a, b) => a.localeCompare(b, 'id', { sensitivity: 'base' }));
  }
}

function openInstansiDropdown(shouldRefresh = false) {
  if (shouldRefresh) {
    loadInstansiOptions();
  }
  renderInstansiDropdown(instansiInput.value);
  instansiDropdown.classList.remove('hidden');
}

function closeInstansiDropdown() {
  instansiDropdown.classList.add('hidden');
  activeInstansiIndex = -1;
}

function selectInstansiOption(value) {
  instansiInput.value = value;
  closeInstansiDropdown();
}

function renderInstansiDropdown(query) {
  const normalizedQuery = normalizeInstansi(query);
  instansiDropdown.innerHTML = '';
  activeInstansiIndex = -1;

  if (instansiLoading && instansiOptions.length === 0) {
    const li = document.createElement('li');
    li.className = 'px-3 py-2 text-gray-400 italic';
    li.textContent = 'Memuat daftar sekolah...';
    instansiDropdown.appendChild(li);
    return;
  }

  const filtered = normalizedQuery
    ? instansiOptions.filter(opt => opt.includes(normalizedQuery))
    : instansiOptions;

  filtered.forEach(opt => {
    const li = document.createElement('li');
    li.className = 'px-3 py-2 cursor-pointer hover:bg-green-50 text-gray-700';
    li.dataset.optionValue = opt;
    li.textContent = opt;
    li.addEventListener('click', () => selectInstansiOption(opt));
    instansiDropdown.appendChild(li);
  });

  const hasExactMatch = normalizedQuery && instansiOptions.includes(normalizedQuery);
  if (normalizedQuery && !hasExactMatch) {
    const li = document.createElement('li');
    li.className = 'px-3 py-2 cursor-pointer bg-green-50 hover:bg-green-100 text-green-700 font-medium border-t border-gray-100';
    li.dataset.optionValue = normalizedQuery;
    li.textContent = `+ Gunakan "${normalizedQuery}" (sekolah baru)`;
    li.addEventListener('click', () => selectInstansiOption(normalizedQuery));
    instansiDropdown.appendChild(li);
  } else if (filtered.length === 0) {
    const li = document.createElement('li');
    li.className = 'px-3 py-2 text-gray-400 italic';
    li.textContent = 'Belum ada daftar sekolah, ketik nama sekolah Anda';
    instansiDropdown.appendChild(li);
  }
}

function updateActiveInstansiHighlight(items) {
  items.forEach((item, idx) => {
    item.classList.toggle('bg-green-100', idx === activeInstansiIndex);
  });
  if (activeInstansiIndex >= 0 && items[activeInstansiIndex]) {
    items[activeInstansiIndex].scrollIntoView({ block: 'nearest' });
  }
}

async function loadInstansiOptions(force = false) {
  if (instansiFetchPromise) return instansiFetchPromise;
  if (!force && Date.now() - instansiLastFetchAt < INSTANSI_REFRESH_COOLDOWN_MS) {
    return;
  }

  instansiLoading = true;
  instansiFetchPromise = (async () => {
    try {
      const response = await fetch(`${SCRIPT_URL}?action=registration_stats`);
      const result = await response.json();
      if (result && result.success && result.data && result.data.by_instansi) {
        const syncedOptions = [];
        Object.keys(result.data.by_instansi).forEach(raw => insertUniqueInstansi(syncedOptions, raw));
        syncedOptions.sort((a, b) => a.localeCompare(b, 'id', { sensitivity: 'base' }));
        instansiOptions = syncedOptions;
        instansiLastFetchAt = Date.now();
      }
    } catch (error) {
      console.error('Gagal memuat daftar asal sekolah:', error);
    } finally {
      instansiLoading = false;
      instansiFetchPromise = null;
      if (!instansiDropdown.classList.contains('hidden')) {
        renderInstansiDropdown(instansiInput.value);
      }
    }
  })();

  return instansiFetchPromise;
}

instansiInput.addEventListener('focus', () => openInstansiDropdown(true));
instansiInput.addEventListener('input', () => openInstansiDropdown(false));

instansiToggle.addEventListener('click', () => {
  if (instansiDropdown.classList.contains('hidden')) {
    instansiInput.focus();
    openInstansiDropdown(true);
  } else {
    closeInstansiDropdown();
  }
});

instansiInput.addEventListener('keydown', (e) => {
  const items = Array.from(instansiDropdown.querySelectorAll('li[data-option-value]'));
  if (e.key === 'Escape') {
    closeInstansiDropdown();
    return;
  }
  if (instansiDropdown.classList.contains('hidden') || items.length === 0) return;

  if (e.key === 'ArrowDown') {
    e.preventDefault();
    activeInstansiIndex = (activeInstansiIndex + 1) % items.length;
    updateActiveInstansiHighlight(items);
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    activeInstansiIndex = (activeInstansiIndex - 1 + items.length) % items.length;
    updateActiveInstansiHighlight(items);
  } else if (e.key === 'Enter' && activeInstansiIndex >= 0) {
    e.preventDefault();
    selectInstansiOption(items[activeInstansiIndex].dataset.optionValue);
  }
});

document.addEventListener('click', (e) => {
  if (!instansiWrapper.contains(e.target)) {
    closeInstansiDropdown();
  }
});

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    loadInstansiOptions();
  }
});

loadInstansiOptions(true);
