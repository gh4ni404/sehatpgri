const SHEET_ID = '1zwGwrjdycq_frYTJPWidnShKofD6CgpkoD9jlLhHz7w';

const CONFIG = {
  SHEET_ID: '1zwGwrjdycq_frYTJPWidnShKofD6CgpkoD9jlLhHz7w',
  SHEET_NAME: 'tb_reg_sehat',
  QUEUE_SHEET: 'whatsapp_queue',
  FONNTE_TOKEN: 'AZ1qn13Yayin98G7Pysa',
  EVENT_NAME: 'Jalan Sehat PGRI Bone 2025',
  EVENT_DATE: 'Ahad, 23 November 2025',
  EVENT_TIME: '06.00 WITA',
  EVENT_LOCATION: 'Lapangan Merdeka Watampone',
  BATCH_SIZE: 30,
  DELAY_MINUTES: 10, // Delay 10 menit untuk pengiriman WhatsApp setelah pendaftaran
  INTER_USER_DELAY_MINUTES: 4 // Delay 5 menit antar pengiriman ke user berbeda
};

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    return handleRegistration(data);
  } catch(error) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      message: error.message
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet(e) {
  try {
    const action = e.parameter.action;
    const nik = e.parameter.nik;

    if(action === 'check_nik' && nik){
      return checkNIKExists(nik);
    }

    if (action === 'check_by_nik' && nik) {
      return getDataByNIK(nik);
    }

    if(action === 'format_niks') {
      return formatExistingNIKs();
    }

    if(action === 'check_duplicates') {
      const result = checkDuplicateNomorPendaftaran();
      return ContentService.createTextOutput(JSON.stringify({
        success: true,
        data: result
      })).setMimeType(ContentService.MimeType.JSON);
    }

    if(action === 'check_nomor_pendaftaran') {
      return checkNomorPendaftaran(e);
    }

    if(action === 'registration_stats') {
      const stats = getRegistrationStats();
      return ContentService.createTextOutput(JSON.stringify({
        success: true,
        data: stats
      })).setMimeType(ContentService.MimeType.JSON);
    }

    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      message: 'Action tidak valid'
    })).setMimeType(ContentService.MimeType.JSON);
  }catch(error) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      message: error.message
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

function checkNIKExists(nik) {
  const sheet = getSheet();
  const data = sheet.getDataRange().getValues();
  const formattedNIK = formatNIK(nik);

  for(let i = 1; i < data.length; i++){
    const existingNIK = String(data[i][2]).trim();
    // Bandingkan dengan dua kemungkinan: NIK yang sudah diformat dan yang belum
    if(existingNIK === formattedNIK || existingNIK === nik) {
      return ContentService.createTextOutput(JSON.stringify({
        exists: true
      })).setMimeType(ContentService.MimeType.JSON);
    }
  }

  return ContentService.createTextOutput(JSON.stringify({
    exists: false
  })).setMimeType(ContentService.MimeType.JSON);
}

function isNIKExists(sheet, nik){
  const data = sheet.getDataRange().getValues();
  const formattedNIK = formatNIK(nik);

  for(let i=1; i < data.length; i++) {
    const existingNIK = String(data[i][2]).trim();
    // Bandingkan dengan dua kemungkinan: NIK yang sudah diformat dan yang belum
    if(existingNIK === formattedNIK || existingNIK === nik) {
      return true;
    }
  }
  return false;
}

function getDataByNIK(nik) {
  if (!nik) {
    return ContentService
      .createTextOutput(JSON.stringify({ error: "Missing NIK" }))
      .setMimeType(ContentService.MimeType.JSON);
  }
  const sheet = getSheet();
  const data = sheet.getDataRange().getValues();
  const headers = data.shift(); // Ambil header baris pertama
  const formattedNIK = formatNIK(nik);

  // Cari baris berdasarkan NIK (kolom pertama)
  const found = data.find(row => {
    const existingNIK = String(row[2]).trim();
    return existingNIK === formattedNIK || existingNIK === nik;
  });

  if (found) {
    const obj = {};
    headers.forEach((h, i) => {
      obj[h.toLowerCase().replace(/\s+/g, "_")] = found[i];
    });

    return ContentService
      .createTextOutput(JSON.stringify({ exists: true, data: obj }))
      .setMimeType(ContentService.MimeType.JSON);
  } else {
    return ContentService
      .createTextOutput(JSON.stringify({ exists: false }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// Update handleRegistration untuk penanganan yang lebih robust
function handleRegistration(data) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
    const sheet = getSheet();

    const formattedNIK = formatNIK(data.nik);

    // Cek duplikasi dengan kedua format
    if(isNIKExists(sheet, data.nik)) {
      throw new Error('NIK sudah terdaftar!');
    }

    const seqResult = getNextSequentialNomorPendaftaran(sheet);
    data.nomor_pendaftaran = seqResult.nomor;
    data.instansi = resolveCanonicalInstansi(sheet, data.instansi);

    const timestamp = new Date();

    const row = [
      timestamp,
      data.nomor_pendaftaran,
      formattedNIK, // Simpan dengan format yang benar
      data.nama,
      data.kategori,
      data.instansi,
      data.telepon,
      data.alamat,
      'MENUNGGU_WHATSAPP',
      data.kecamatan
    ];
    
    sheet.appendRow(row);
    PropertiesService.getScriptProperties().setProperty('LAST_SEQ_PGRIBERAMAL', String(seqResult.seq));

    data.nik = formattedNIK;

    // Tambahkan ke queue untuk dikirim 30 menit kemudian
    addToWhatsAppQueue(data, timestamp);
  
    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      message: 'Pendaftaran Berhasil',
      nomor_pendaftaran: data.nomor_pendaftaran
    })).setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      message: error.message
    })).setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}

// Fungsi untuk memformat NIK - tambahkan tanda petik jika berakhiran nol
function formatNIK(nik) {
  let nikString = String(nik).trim();
  
  // Jika NIK berakhiran nol dan belum diawali tanda petik
  if (nikString.endsWith('0') && !nikString.startsWith("'")) {
    return "'" + nikString;
  }
  
  return nikString;
}

function getSheet() {
  const wbook = SpreadsheetApp.openById(SHEET_ID);
  const tb_reg_sehat = wbook.getSheetByName("tb_reg_sehat"); 

  if (!tb_reg_sehat) {
    tb_reg_sehat = wbook.insertSheet("tb_reg_sehat");
    tb_reg_sehat.getRange('A1:J1').setValues([[
      'timestamp',
      'nomor_pendaftaran',
      'nik',
      'nama',
      'kategori',
      'instansi',
      'telepon',
      'alamat',
      'status_whatsapp',
      'kecamatan'
    ]]);
    tb_reg_sehat.getRange('A1:J1').setFontWeight('bold');
    tb_reg_sehat.setFrozenRows(1);
  } else if (!tb_reg_sehat.getRange('J1').getValue()) {
    tb_reg_sehat.getRange('J1').setValue('kecamatan').setFontWeight('bold');
  }
  return tb_reg_sehat;
}

// ==================== SISTEM QUEUE WHATSAPP ====================
function getQueueSheet() {
  const wbook = SpreadsheetApp.openById(SHEET_ID);
  let queueSheet = wbook.getSheetByName(CONFIG.QUEUE_SHEET);

  if (!queueSheet) {
    queueSheet = wbook.insertSheet(CONFIG.QUEUE_SHEET);
    queueSheet.getRange('A1:K1').setValues([[
      'timestamp',
      'scheduled_time',
      'nomor_pendaftaran',
      'telepon',
      'nama',
      'nik',
      'kategori',
      'instansi',
      'status',
      'attempt_count',
      'kecamatan'
    ]]);
    queueSheet.getRange('A1:K1').setFontWeight('bold');
    queueSheet.setFrozenRows(1);
  } else if (!queueSheet.getRange('K1').getValue()) {
    queueSheet.getRange('K1').setValue('kecamatan').setFontWeight('bold');
  }
  return queueSheet;
}

function addToWhatsAppQueue(data, timestamp) {
  const queueSheet = getQueueSheet();
  const scheduledTime = new Date(timestamp.getTime() + (CONFIG.DELAY_MINUTES * 60 * 1000));
  
  const queueRow = [
    timestamp,
    scheduledTime,
    data.nomor_pendaftaran,
    data.telepon,
    data.nama,
    data.nik,
    data.kategori,
    data.instansi,
    'PENDING',
    0,
    data.kecamatan
  ];
  
  queueSheet.appendRow(queueRow);
}

function processWhatsAppQueue() {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
    
    const queueSheet = getQueueSheet();
    const data = queueSheet.getDataRange().getValues();
    const now = new Date();
    
    const results = {
      processed: 0,
      success: 0,
      failed: 0,
      details: []
    };

    // Ambil timestamp terakhir pengiriman dari properti script
    const properties = PropertiesService.getScriptProperties();
    const lastSentTimestamp = properties.getProperty('LAST_SENT_TIMESTAMP');
    let lastSentTime = lastSentTimestamp ? new Date(parseInt(lastSentTimestamp)) : new Date(0);
    
    // Mulai dari baris 2 (index 1) karena baris 1 adalah header
    for (let i = 1; i < data.length && results.processed < CONFIG.BATCH_SIZE; i++) {
      const row = data[i];
      const scheduledTime = new Date(row[1]);
      const status = row[8];
      const attemptCount = row[9] || 0;
      
      // Cek jika sudah waktunya dikirim dan status masih PENDING
      if (status === 'PENDING' && scheduledTime <= now) {
         // Cek delay 10 menit dari pengiriman terakhir
        const timeSinceLastSent = now.getTime() - lastSentTime.getTime();
        const minutesSinceLastSent = timeSinceLastSent / (1000 * 60);
        
        if (minutesSinceLastSent < CONFIG.INTER_USER_DELAY_MINUTES) {
          console.log(`Menunggu ${(CONFIG.INTER_USER_DELAY_MINUTES - minutesSinceLastSent).toFixed(1)} menit sebelum pengiriman berikutnya`);
          break; // Berhenti processing untuk menunggu delay
        }
        const participantData = {
          nomor_pendaftaran: row[2],
          telepon: String(row[3]),
          nama: row[4],
          // Tambahkan data lengkap untuk WhatsApp message
          nik: row[5] || '',
          kategori: row[6] || '',
          instansi: row[7] || '',
          kecamatan: row[10] || ''
        };
        try {
          const sendResult = sendWhatsAppConfirmation(participantData);
          
          if (sendResult.success) {
            queueSheet.getRange(i + 1, 9).setValue('TERKIRIM');
            queueSheet.getRange(i + 1, 10).setValue(attemptCount + 1);
            
            // Update status di sheet utama
            updateMainSheetStatus(participantData.nomor_pendaftaran, 'TERKIRIM');
            
            results.success++;
            results.details.push({
              nomor_pendaftaran: participantData.nomor_pendaftaran,
              status: 'Berhasil'
            });
          } else {
            // Jika gagal, increment attempt count
            const newAttemptCount = attemptCount + 1;
            queueSheet.getRange(i + 1, 10).setValue(newAttemptCount);
            
            if (newAttemptCount >= 3) {
              // Jika sudah 3x gagal, mark sebagai FAILED
              queueSheet.getRange(i + 1, 9).setValue('FAILED');
              updateMainSheetStatus(participantData.nomor_pendaftaran, 'GAGAL');
            } else {
              // Jadwalkan ulang 10 menit kemudian
              const newScheduledTime = new Date(now.getTime() + (10 * 60 * 1000));
              queueSheet.getRange(i + 1, 2).setValue(newScheduledTime);
            }
            
            results.failed++;
            results.details.push({
              nomor_pendaftaran: participantData.nomor_pendaftaran,
              status: 'Gagal',
              attempt: newAttemptCount
            });
          }

          // Update timestamp terakhir pengiriman
          lastSentTime = new Date();
          properties.setProperty('LAST_SENT_TIMESTAMP', lastSentTime.getTime().toString());
          
          results.processed++;
          
          console.log(`Berhasil mengirim WhatsApp ke ${participantData.nomor_pendaftaran}. Menunggu 5 menit untuk pengiriman berikutnya...`);
        } catch (error) {
          console.error(`Error processing ${participantData.nomor_pendaftaran}:`, error);
          results.failed++;
          results.details.push({
            nomor_pendaftaran: participantData.nomor_pendaftaran,
            status: 'Error',
            error: error.message
          });
        }
        
        // Delay antar pengiriman untuk menghindari rate limit
        if (results.processed < CONFIG.BATCH_SIZE) {
          Utilities.sleep(2000); // Delay 2 detik
        }
      }
    }
    
    console.log(`Queue processing completed: ${results.processed} processed, ${results.success} success, ${results.failed} failed`);

    // Jika tidak ada yang diproses karena menunggu delay, beri info
    if (results.processed === 0) {
      const nextAvailableTime = new Date(lastSentTime.getTime() + (CONFIG.INTER_USER_DELAY_MINUTES * 60 * 1000));
      const waitTime = (nextAvailableTime - now) / (1000 * 60);
      
      if (waitTime > 0) {
        console.log(`Menunggu ${waitTime.toFixed(1)} menit hingga pengiriman berikutnya diperbolehkan`);
        results.message = `Delay aktif. Pengiriman berikutnya dalam ${waitTime.toFixed(1)} menit`;
      }
    }
    return results;
  } finally {
    lock.releaseLock();
  }
}

function updateMainSheetStatus(nomorPendaftaran, status) {
  try {
    const sheet = getSheet();
    const data = sheet.getDataRange().getValues();
    
    for (let i = 1; i < data.length; i++) {
      if (data[i][1] === nomorPendaftaran) {
        sheet.getRange(i + 1, 9).setValue(status); // Kolom I (index 8)
        break;
      }
    }
  } catch (error) {
    console.error('Error updating main sheet status:', error);
  }
}

function sendWhatsAppConfirmation(data) {
  try {
    const phone = formatPhoneNumber(data.telepon);
    const msg = createWhatsAppMessage(data);
    
    const response = sendFonnteMessage(phone, msg);
    const messageId = response.id && response.id.length > 0 ? response.id[0] : null;
    
    return {
      success: true,
      messageId: messageId,
      fonnteRespond: response
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

function sendFonnteMessage(phone, message) {
  const url = 'https://api.fonnte.com/send';
  const options = {
    'method': 'POST',
    'headers': {
      'Authorization': CONFIG.FONNTE_TOKEN
    },
    'payload': {
      'target': phone,
      'message': message
    },
    'muteHttpExceptions': true
  };

  const response = UrlFetchApp.fetch(url, options);
  const responseText = response.getContentText();
  const result = JSON.parse(responseText);
  
  if (result.status === true) {
    return result;
  } else {
    throw new Error(result.message || 'Gagal mengirim pesan WhatsApp');
  }
}

function formatPhoneNumber(phone) {
  // Hapus semua karakter non-digit
  let cleaned = phone.replace(/\D/g, '');
  
  // Jika diawali dengan 0, ganti dengan 62
  if (cleaned.startsWith('0')) {
    cleaned = '62' + cleaned.substring(1);
  }
  
  // Jika diawali dengan 8, tambahkan 62
  if (cleaned.startsWith('8')) {
    cleaned = '62' + cleaned;
  }
  
  return cleaned;
}

// ==================== MONITORING & UTILITY ====================

function getQueueStatus() {
  const queueSheet = getQueueSheet();
  const data = queueSheet.getDataRange().getValues();
  
  let pending = 0;
  let sent = 0;
  let failed = 0;
  let total = data.length - 1; // Exclude header
  
  // Cari pesan berikutnya yang akan dikirim
  let nextMessage = null;
  const now = new Date();

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const status = row[8];
    const scheduledTime = new Date(row[1]);
    
    if (status === 'PENDING' && scheduledTime <= now) {
      if (!nextMessage || scheduledTime < new Date(nextMessage.scheduled_time)) {
        nextMessage = {
          nomor_pendaftaran: row[2],
          nama: row[4],
          scheduled_time: row[1]
        };
      }
    }

    if (status === 'PENDING') pending++;
    else if (status === 'TERKIRIM') sent++;
    else if (status === 'FAILED') failed++;
  }

  // Cek kapan pengiriman berikutnya diperbolehkan
  const properties = PropertiesService.getScriptProperties();
  const lastSentTimestamp = properties.getProperty('LAST_SENT_TIMESTAMP');
  let nextAvailableTime = null;
  let waitTimeMinutes = 0;
  
  if (lastSentTimestamp) {
    const lastSentTime = new Date(parseInt(lastSentTimestamp));
    nextAvailableTime = new Date(lastSentTime.getTime() + (CONFIG.INTER_USER_DELAY_MINUTES * 60 * 1000));
    waitTimeMinutes = (nextAvailableTime - now) / (1000 * 60);
    waitTimeMinutes = Math.max(0, waitTimeMinutes);
  }
  
  const status = {
    total: total,
    pending: pending,
    sent: sent,
    failed: failed,
    next_available: nextAvailableTime ? nextAvailableTime.toISOString() : null,
    wait_time_minutes: waitTimeMinutes.toFixed(1),
    next_message: nextMessage,
    delay_config: {
      inter_user_minutes: CONFIG.INTER_USER_DELAY_MINUTES,
      initial_delay_minutes: CONFIG.DELAY_MINUTES
    }
  };

  console.log("Queue Status: ", status);
  
  return ContentService.createTextOutput(JSON.stringify({
    success: true,
    data: status
  })).setMimeType(ContentService.MimeType.JSON);
}

function manualProcessQueue() {
  return processWhatsAppQueue();
}

function clearOldQueueEntries() {
  const queueSheet = getQueueSheet();
  const data = queueSheet.getDataRange().getValues();
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000));
  
  let deletedCount = 0;
  
  // Mulai dari bawah untuk menghindari masalah index
  for (let i = data.length - 1; i >= 1; i--) {
    const row = data[i];
    const timestamp = new Date(row[0]);
    const status = row[8];
    
    // Hapus entri yang sudah lebih dari 30 hari dan statusnya bukan PENDING
    if (timestamp < thirtyDaysAgo && status !== 'PENDING') {
      queueSheet.deleteRow(i + 1);
      deletedCount++;
    }
  }
  
  console.log(`Deleted ${deletedCount} old queue entries`);
  return deletedCount;
}

function setupQueueTrigger() {
  // Hapus trigger existing
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(trigger => {
    if (trigger.getHandlerFunction() === 'processWhatsAppQueue') {
      ScriptApp.deleteTrigger(trigger);
    }
  });
  
  // Buat trigger baru - jalankan setiap 5 menit
  ScriptApp.newTrigger('processWhatsAppQueue')
    .timeBased()
    .everyMinutes(1)
    .create();
    
  console.log('Queue trigger setup completed');
}

function removeQueueTrigger() {
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(trigger => {
    if (trigger.getHandlerFunction() === 'processWhatsAppQueue') {
      ScriptApp.deleteTrigger(trigger);
    }
  });
  console.log('Queue trigger removed');
}

// ==================== RESET DELAY TIMER ====================

function resetDelayTimer() {
  const properties = PropertiesService.getScriptProperties();
  properties.deleteProperty('LAST_SENT_TIMESTAMP');
  console.log('Delay timer telah direset. Pengiriman berikutnya dapat segera dilakukan.');
  return {
    success: true,
    message: 'Delay timer telah direset'
  };
}


// ==================== BACKFILL DATA LAMA ====================

function backfillExistingDataToQueue() {
  const lock = LockService.getScriptLock();
  
  try {
    lock.waitLock(30000);
    
    const sheet = getSheet();
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    
    // Cari index kolom status_whatsapp
    const statusIndex = headers.indexOf('status_whatsapp');
    const phoneIndex = headers.indexOf('telepon');
    const nomorPendaftaranIndex = headers.indexOf('nomor_pendaftaran');
    const namaIndex = headers.indexOf('nama');
    const nikIndex = headers.indexOf('nik');
    const kategoriIndex = headers.indexOf('kategori');
    const instansiIndex = headers.indexOf('instansi');
    const kecamatanIndex = headers.indexOf('kecamatan');
    const timestampIndex = headers.indexOf('timestamp');
    
    if (statusIndex === -1) {
      throw new Error('Kolom status_whatsapp tidak ditemukan');
    }
    
    const results = {
      totalProcessed: 0,
      addedToQueue: 0,
      alreadySent: 0,
      missingPhone: 0,
      errors: 0,
      details: []
    };

    // Untuk backfill, kita atur jadwal dengan interval 10 menit antar user
    let scheduleOffsetMinutes = 5; // Mulai 5 menit dari sekarang
    
    // Mulai dari baris 2 (index 1)
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const status = row[statusIndex];
      const phone = row[phoneIndex];
      const nomorPendaftaran = row[nomorPendaftaranIndex];
      const nama = row[namaIndex];
      const originalTimestamp = row[timestampIndex];
      const originalNIK = row[nikIndex];
      
      try {
        // Skip jika status sudah TERKIRIM atau sedang MENUNGGU
        if (status === 'TERKIRIM' || status === 'MENUNGGU_WHATSAPP' || status === 'Dikirim Ulang') {
          results.alreadySent++;
          continue;
        }
        
        // Skip jika nomor telepon tidak valid
        if (!phone || String(phone).trim() === '') {
          results.missingPhone++;
          results.details.push({
            nomor_pendaftaran: nomorPendaftaran,
            status: 'Dilewati - No Telepon Kosong'
          });
          continue;
        }
        const formattedNIK = formatNIK(originalNIK);

        // Data untuk queue
        const participantData = {
          nomor_pendaftaran: nomorPendaftaran,
          telepon: String(phone),
          nama: nama,
          nik: formattedNIK,
          kategori: row[kategoriIndex],
          instansi: row[instansiIndex],
          kecamatan: kecamatanIndex !== -1 ? (row[kecamatanIndex] || '') : ''
        };
        
        // Jadwalkan dengan interval 10 menit antar user
        const scheduledTime = new Date(Date.now() + (scheduleOffsetMinutes * 60 * 1000));
        addToQueueWithSchedule(participantData, originalTimestamp, scheduledTime);

        // Update status di sheet utama
        sheet.getRange(i + 1, statusIndex + 1).setValue('MENUNGGU_WHATSAPP');
        
        results.addedToQueue++;
        results.details.push({
          nomor_pendaftaran: nomorPendaftaran,
          status: 'Ditambahkan ke Queue'
        });
        
        // Tambah offset untuk user berikutnya
        scheduleOffsetMinutes += CONFIG.INTER_USER_DELAY_MINUTES;
      } catch (error) {
        results.errors++;
        results.details.push({
          nomor_pendaftaran: nomorPendaftaran,
          status: 'Error',
          error: error.message
        });
        console.error(`Error processing ${nomorPendaftaran}:`, error);
      }
      
      results.totalProcessed++;
      
      // Beri jeda setiap 10 data untuk menghindari timeout
      if (results.totalProcessed % 2 === 0) {
        Utilities.sleep(1000);
      }
    }
    
    console.log('Backfill completed:', results);
    return results;
    
  } finally {
    lock.releaseLock();
  }
}

function addToQueueWithSchedule(data, originalTimestamp, scheduledTime) {
  const queueSheet = getQueueSheet();
  
  const queueRow = [
    originalTimestamp || new Date(),
    scheduledTime,
    data.nomor_pendaftaran,
    data.telepon,
    data.nama,
    data.nik,
    data.kategori,
    data.instansi,
    'PENDING',
    0,
    data.kecamatan
  ];
  
  queueSheet.appendRow(queueRow);
}

function addExistingToQueue(data, originalTimestamp) {
  const queueSheet = getQueueSheet();
  
  // Untuk data lama, jadwalkan 5 menit dari sekarang
  // agar cepat diproses tanpa harus menunggu 30 menit
  const scheduledTime = new Date(Date.now() + (5 * 60 * 1000));
  
  const queueRow = [
    originalTimestamp || new Date(), // Gunakan timestamp asli jika ada
    scheduledTime,
    data.nomor_pendaftaran,
    data.telepon,
    data.nama,
    data.nik,
    data.kategori,
    data.instansi,
    'PENDING',
    0,
    data.kecamatan
  ];
  
  queueSheet.appendRow(queueRow);
}

// Fungsi untuk mengecek status data yang belum terkirim
function checkUnsentRegistrations() {
  const sheet = getSheet();
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  
  const statusIndex = headers.indexOf('status_whatsapp');
  const phoneIndex = headers.indexOf('telepon');
  const nomorPendaftaranIndex = headers.indexOf('nomor_pendaftaran');
  const namaIndex = headers.indexOf('nama');
  
  if (statusIndex === -1) {
    throw new Error('Kolom status_whatsapp tidak ditemukan');
  }
  
  const unsentData = [];
  const statusCount = {
    total: data.length - 1,
    menunggu: 0,
    terkirim: 0,
    gagal: 0,
    lainnya: 0,
    no_phone: 0
  };
  
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const status = row[statusIndex];
    const phone = row[phoneIndex];
    const nomorPendaftaran = row[nomorPendaftaranIndex];
    const nama = row[namaIndex];
    
    // Hitung status
    if (!phone || String(phone).trim() === '') {
      statusCount.no_phone++;
    } else if (status === 'TERKIRIM' || status === 'Dikirim Ulang') {
      statusCount.terkirim++;
    } else if (status === 'MENUNGGU_WHATSAPP') {
      statusCount.menunggu++;
    } else if (status === 'GAGAL' || status === 'Gagal') {
      statusCount.gagal++;
    } else {
      statusCount.lainnya++;
      // Kumpulkan data yang belum terkirim
      unsentData.push({
        nomor_pendaftaran: nomorPendaftaran,
        nama: nama,
        telepon: phone,
        status: status || 'BELUM_ADA_STATUS'
      });
    }
  }
  console.log("Summary: ", statusCount);
  console.log("Total Unsent: ", unsentData.length);
  return {
    summary: statusCount,
    unsent: unsentData,
    total_unsent: unsentData.length
  };
}

// ==================== NOT USED FUNCTION ====================
function updateWhatsAppStatus(sheet, nomorPendaftaran, success) {
  const data = sheet.getDataRange().getValues();
  
  // Cari baris berdasarkan nomor pendaftaran (kolom B, index 1)
  for (let i = 1; i < data.length; i++) {
    if (data[i][1] === nomorPendaftaran) {
      // Update status WhatsApp (kolom I, index 8)
      sheet.getRange(i + 1, 9).setValue(success ? 'Terkirim' : 'Gagal');
      break;
    }
  }
}

function resendPendingWhatsApp() {
  const sheet = getSheet();
  const data = sheet.getDataRange().getValues();
  
  const results = {
    totalProcessed: 0,
    success: 0,
    failed: 0,
    details: []
  };
  
  // Mulai dari baris 2 (index 1) karena baris 1 adalah header
  for (let i = 1; i < data.length && results.totalProcessed < CONFIG.BATCH_SIZE; i++) {
    const row = data[i];
    const statusWhatsApp = row[8]; // Kolom I - Status WhatsApp
    
    // Cek jika status bukan "Terkirim"
    if (statusWhatsApp !== 'TERKIRIM' && statusWhatsApp !== 'Dikirim Ulang') {
      const participantData = {
        timestamp: row[0],
        nomor_pendaftaran: row[1],
        nik: row[2],
        nama: row[3],
        kategori: row[4],
        instansi: row[5],
        telepon: String(row[6]),
        alamat: row[7],
        kecamatan: row[9]
      };
      
      try {
        const sendResult = sendWhatsAppConfirmation(participantData);
        
        if (sendResult.success === true) {
          sheet.getRange(i + 1, 9).setValue('Dikirim Ulang'); // Update status
          results.success++;
          results.details.push({
            nomor_pendaftaran: participantData.nomor_pendaftaran,
            status: 'Berhasil',
            messageId: sendResult.messageId
          });
        } else {
          sheet.getRange(i + 1, 9).setValue('Gagal - ' + new Date().toLocaleString());
          results.failed++;
          results.details.push({
            nomor_pendaftaran: participantData.nomor_pendaftaran,
            status: 'Gagal',
            error: sendResult.error
          });
        }
      } catch (error) {
        sheet.getRange(i + 1, 9).setValue('Error - ' + new Date().toLocaleString());
        results.failed++;
        results.details.push({
          nomor_pendaftaran: participantData.nomor_pendaftaran,
          status: 'Error',
          error: error.message
        });
      }
      
      results.totalProcessed++;
      
    //  JEDA antara pengiriman - TUNGGU SEBELUM LANJUT KE PESAN BERIKUTNYA
      if (i < data.length - 1 && results.totalProcessed < CONFIG.BATCH_SIZE) {
        let totalMs = 100000; // 100 detik
        let interval = 1000; // 1 detik

        for (let t = totalMs; t > 0; t -= interval) {
          console.log(`⏳ Menunggu ${Math.ceil(t / 1000)} detik lagi...`);
          Utilities.sleep(interval);
        }
      }
    }
  }
  console.log(results);
  return results;
}

function createJSONResponse(success, message, additionalData = {}) {
  return ContentService
  .createTextOutput(JSON.stringify({
    success: success,
    message: message,
    ...additionalData
  }))
  .setMimeType(ContentService.MimeType.JSON);
}

// Fungsi untuk menghitung jumlah WhatsApp yang pending
function getPendingWhatsAppCount() {
  const sheet = getSheet();
  const data = sheet.getDataRange().getValues();
  let count = 0;
  
  for (let i = 1; i < data.length; i++) {
    const statusWhatsApp = data[i][8];
    if (statusWhatsApp !== 'Terkirim' && statusWhatsApp !== 'Dikirim Ulang') {
      count++;
    }
  }

  console.log(count);
  return count;
}

// ==================== TEMPLATE MESSAGE WA ====================
function createWhatsAppMessage(data) {
  return `Halo ${data.nama},
Pendaftaran Anda untuk **Jalan Sehat PGRI Bone** telah berhasil!
Berikut adalah detail pendaftaran Anda:
* Nomor Pendaftaran: **${data.nomor_pendaftaran}**
* NIK: ${data.nik}
* Asal Instansi: ${data.instansi}
* Kategori: ${data.kategori}${data.kecamatan ? `\n* Kecamatan: ${data.kecamatan}` : ''}

### **📅 Detail Acara**
* ${CONFIG.EVENT_DATE} | ${CONFIG.EVENT_TIME}
* Lokasi & Titik Kumpul: ${CONFIG.EVENT_LOCATION}

### **💡 Catatan Penting**
1.  **Wajib simpan pesan ini** untuk Doorprize.
2.  Mohon gunakan pakaian olahraga yang sesuai cabang masing-masing.

Salam hormat,
**Panitia ${CONFIG.EVENT_NAME}**

_(Pesan ini dikirim otomatis, mohon tidak membalas.)_`;
}

// Fungsi untuk memformat NIK yang sudah ada di sheet (opsional)
function formatExistingNIKs() {
  const sheet = getSheet();
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  
  const nikIndex = headers.indexOf('nik');
  let updatedCount = 0;
  
  if (nikIndex === -1) {
    throw new Error('Kolom NIK tidak ditemukan');
  }
  
  // Mulai dari baris 2 (index 1)
  for (let i = 1; i < data.length; i++) {
    const originalNIK = data[i][nikIndex];
    const formattedNIK = formatNIK(originalNIK);
    
    // Jika NIK perlu diformat (berbeda dengan aslinya)
    if (formattedNIK !== String(originalNIK).trim()) {
      sheet.getRange(i + 1, nikIndex + 1).setValue(formattedNIK);
      updatedCount++;
      console.log(`Updated NIK: ${originalNIK} -> ${formattedNIK}`);
    }
  }
  
  console.log(`Formatted ${updatedCount} NIK entries`);
  return createJSONResponse(true, `Formatted ${updatedCount} NIK entries`);
}

// Tambahkan juga fungsi untuk membersihkan dan memformat semua NIK yang ada di sheet
function cleanAndFormatAllNIKs() {
  const sheet = getSheet();
  const data = sheet.getDataRange().getValues();
  
  let updatedCount = 0;
  let duplicateCount = 0;
  const duplicates = [];
  
  // Mulai dari baris 2 (index 1)
  for (let i = 1; i < data.length; i++) {
    const originalNIK = data[i][2];
    const formattedNIK = formatNIK(originalNIK);
    
    // Jika NIK perlu diformat
    if (formattedNIK !== String(originalNIK).trim()) {
      // Cek duplikasi sebelum update
      let isDuplicate = false;
      for (let j = 1; j < data.length; j++) {
        if (i !== j && String(data[j][2]).trim() === formattedNIK) {
          isDuplicate = true;
          duplicateCount++;
          duplicates.push({
            row: i + 1,
            original_nik: originalNIK,
            formatted_nik: formattedNIK,
            duplicate_with: data[j][1] // nomor pendaftaran
          });
          break;
        }
      }
      
      if (!isDuplicate) {
        sheet.getRange(i + 1, 3).setValue(formattedNIK); // Kolom C adalah NIK
        updatedCount++;
        console.log(`Updated NIK: ${originalNIK} -> ${formattedNIK}`);
      }
    }
  }
  
  console.log(`Formatted ${updatedCount} NIK entries, found ${duplicateCount} duplicates`);
  
  return {
    success: true,
    updated: updatedCount,
    duplicates: duplicateCount,
    duplicate_details: duplicates,
    message: `Formatted ${updatedCount} NIK entries, found ${duplicateCount} duplicates`
  };
}

function checkNomorPendaftaran(e) {
  const nomorPendaftaran = e.parameter.nomor_pendaftaran;
  const sheet = getSheet();
  const data = sheet.getDataRange().getValues();

  const headers = data[0];
  const nomorPendaftaranIndex = headers.indexOf('nomor_pendaftaran');

  if (nomorPendaftaranIndex === -1) {
    return ContentService.createTextOutput(JSON.stringify({exists: false})).setMimeType(ContentService.MimeType.JSON);
  }

  for (let i = 1; i < data.length; i++) {
    if(data[i][nomorPendaftaranIndex] === nomorPendaftaran) {
      return ContentService.createTextOutput(JSON.stringify({exists: true})).setMimeType(ContentService.MimeType.JSON);
    }
  }

  return ContentService.createTextOutput(JSON.stringify({ exists: false})).setMimeType(ContentService.MimeType.JSON);
}

// Untuk Mengecek Duplikasi Nomor Pendaftaran
function checkDuplicateNomorPendaftaran() {
  const sheet = getSheet();
  const data = sheet.getDataRange().getValues();
  
  // Skip header (baris pertama)
  const registrations = data.slice(1);
  
  const duplicates = {};
  const duplicateCount = {};
  const results = {
    totalRegistrations: registrations.length,
    uniqueCount: 0,
    duplicateCount: 0,
    duplicates: [],
    summary: {}
  };

  // Hitung frekuensi setiap nomor_pendaftaran
  for (let i = 0; i < registrations.length; i++) {
    const row = registrations[i];
    const nomorPendaftaran = row[1]; // Kolom B (index 1) adalah nomor_pendaftaran
    const nama = row[3]; // Kolom D (index 3) adalah nama
    const nik = row[2]; // Kolom C (index 2) adalah NIK
    const timestamp = row[0]; // Kolom A (index 0) adalah timestamp
    
    if (!duplicateCount[nomorPendaftaran]) {
      duplicateCount[nomorPendaftaran] = {
        count: 0,
        entries: []
      };
    }
    
    duplicateCount[nomorPendaftaran].count++;
    duplicateCount[nomorPendaftaran].entries.push({
      row: i + 2, // +2 karena header dan index mulai dari 0
      nomor_pendaftaran: nomorPendaftaran,
      nama: nama,
      nik: nik,
      timestamp: timestamp,
      kategori: row[4],
      instansi: row[5],
      telepon: row[6],
      alamat: row[7],
      kecamatan: row[9]
    });
  }

  // Identifikasi duplikat
  for (const [nomorPendaftaran, info] of Object.entries(duplicateCount)) {
    if (info.count > 1) {
      results.duplicateCount++;
      results.duplicates.push({
        nomor_pendaftaran: nomorPendaftaran,
        duplicate_count: info.count,
        entries: info.entries
      });
    } else {
      results.uniqueCount++;
    }
  }

  // Buat summary
  results.summary = {
    total: results.totalRegistrations,
    unique: results.uniqueCount,
    duplicate: results.duplicateCount,
    duplicate_percentage: ((results.duplicateCount / results.totalRegistrations) * 100).toFixed(2)
  };

  console.log('Duplicate check results:', results.summary);
  console.log("Duplicate Results: ", results);
  return results;
}

// Fungsi untuk membersihkan duplikasi nomor_pendaftaran (menyimpan yang terbaru)
function cleanDuplicateRegistrations() {
  const sheet = getSheet();
  const data = sheet.getDataRange().getValues();
  
  const registrations = data.slice(1);
  const latestEntries = {};
  const duplicatesToRemove = [];
  
  // Identifikasi entri terbaru untuk setiap nomor_pendaftaran
  for (let i = 0; i < registrations.length; i++) {
    const row = registrations[i];
    const nomorPendaftaran = row[1];
    const timestamp = new Date(row[0]);
    
    if (!latestEntries[nomorPendaftaran] || 
        timestamp > new Date(latestEntries[nomorPendaftaran].timestamp)) {
      
      // Jika sudah ada entri sebelumnya, tandai untuk dihapus
      if (latestEntries[nomorPendaftaran]) {
        duplicatesToRemove.push(latestEntries[nomorPendaftaran].row);
      }
      
      latestEntries[nomorPendaftaran] = {
        row: i + 2,
        timestamp: timestamp,
        data: row
      };
    } else {
      // Entri ini lebih lama, tandai untuk dihapus
      duplicatesToRemove.push(i + 2);
    }
  }
  
  // Hapus duplikat dari bawah ke atas untuk menjaga index
  duplicatesToRemove.sort((a, b) => b - a); // Urutkan descending
  
  let removedCount = 0;
  for (const rowIndex of duplicatesToRemove) {
    sheet.deleteRow(rowIndex);
    removedCount++;
    console.log(`Removed duplicate row ${rowIndex}`);
  }
  
  const result = {
    success: true,
    removed_count: removedCount,
    remaining_count: Object.keys(latestEntries).length,
    message: `Berhasil menghapus ${removedCount} entri duplikat, tersisa ${Object.keys(latestEntries).length} entri unik`
  };
  
  console.log('Clean duplicates result:', result);
  return result;
}

// Fungsi untuk mendapatkan statistik pendaftaran
function getRegistrationStats() {
  const sheet = getSheet();
  const data = sheet.getDataRange().getValues();
  const registrations = data.slice(1);
  
  const stats = {
    total: registrations.length,
    by_kategori: {},
    by_instansi: {},
    by_kecamatan: {},
    by_date: {},
    by_status: {}
  };
  
  // Hitung statistik
  for (const row of registrations) {
    const kategori = row[4] || 'Tidak Diketahui';
    const instansi = row[5] || 'Tidak Diketahui';
    const status = row[8] || 'Tidak Diketahui';
    const kecamatan = row[9] || 'Tidak Diketahui';
    const date = new Date(row[0]).toISOString().split('T')[0]; // YYYY-MM-DD
    
    // Hitung by kategori
    stats.by_kategori[kategori] = (stats.by_kategori[kategori] || 0) + 1;
    
    // Hitung by instansi
    stats.by_instansi[instansi] = (stats.by_instansi[instansi] || 0) + 1;

    // Hitung by kecamatan
    stats.by_kecamatan[kecamatan] = (stats.by_kecamatan[kecamatan] || 0) + 1;
    
    // Hitung by date
    stats.by_date[date] = (stats.by_date[date] || 0) + 1;
    
    // Hitung by status
    stats.by_status[status] = (stats.by_status[status] || 0) + 1;
  }
  
  // Urutkan by kategori (descending)
  stats.by_kategori = Object.fromEntries(
    Object.entries(stats.by_kategori).sort((a, b) => b[1] - a[1])
  );
  
  // Urutkan by instansi (descending)
  stats.by_instansi = Object.fromEntries(
    Object.entries(stats.by_instansi).sort((a, b) => b[1] - a[1])
  );

  // Urutkan by kecamatan (descending)
  stats.by_kecamatan = Object.fromEntries(
    Object.entries(stats.by_kecamatan).sort((a, b) => b[1] - a[1])
  );
  
  // Urutkan by date (ascending)
  stats.by_date = Object.fromEntries(
    Object.entries(stats.by_date).sort((a, b) => a[0].localeCompare(b[0]))
  );
  
  return stats;
}

// Fungsi untuk generate nomor pendaftaran otomatis
function generateNomorPendaftaran() {
  const sheet = getSheet();
  const data = sheet.getDataRange().getValues();
  const now = new Date();
  const year = now.getFullYear();
  
  // Cari nomor pendaftaran tertinggi untuk tahun ini
  let highestNumber = 0;
  
  for (let i = 1; i < data.length; i++) {
    const nomorPendaftaran = data[i][1]; // Kolom B
    if (nomorPendaftaran && typeof nomorPendaftaran === 'string') {
      // Format: JS-YYYY-NNNN
      const match = nomorPendaftaran.match(/PGRI-(\d+)-(\d+)/);
      if (match && parseInt(match[1]) === year) {
        const sequence = parseInt(match[2]);
        if (sequence > highestNumber) {
          highestNumber = sequence;
        }
      }
    }
  }
  
  // Generate nomor berikutnya
  const nextSequence = highestNumber + 1;
  const sequenceFormatted = nextSequence.toString().padStart(4, '0');
  
  return `JS-${year}-${sequenceFormatted}`;
}

// Generate nomor pendaftaran berurutan mulai dari PGRIBERAMAL-000001
function getNextSequentialNomorPendaftaran(sheet) {
  const properties = PropertiesService.getScriptProperties();
  const lastSeq = parseInt(properties.getProperty('LAST_SEQ_PGRIBERAMAL') || '0', 10);

  const data = sheet.getDataRange().getValues();
  const existingSet = new Set();
  for (let i = 1; i < data.length; i++) {
    existingSet.add(String(data[i][1]).trim());
  }

  let nextSeq = lastSeq + 1;
  let nomor = `PGRIBERAMAL-${String(nextSeq).padStart(6, '0')}`;
  while (existingSet.has(nomor)) {
    nextSeq++;
    nomor = `PGRIBERAMAL-${String(nextSeq).padStart(6, '0')}`;
  }

  return { seq: nextSeq, nomor: nomor };
}

function resetNomorPendaftaranCounter() {
  PropertiesService.getScriptProperties().deleteProperty('LAST_SEQ_PGRIBERAMAL');
}

function testSequentialNomor() {
  const sheet = getSheet();
  Logger.log(getNextSequentialNomorPendaftaran(sheet));
}

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

function formatCanonicalInstansi(value) {
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

function resolveCanonicalInstansi(sheet, rawInstansi) {
  const canonical = formatCanonicalInstansi(rawInstansi);
  if (!canonical) return '';

  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    const existing = String(data[i][5] || '').trim().replace(/\s+/g, ' ');
    if (existing && formatCanonicalInstansi(existing) === canonical) {
      return existing === existing.toUpperCase() ? existing : canonical;
    }
  }
  return canonical;
}