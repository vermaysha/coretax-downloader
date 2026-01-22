let scrapedData = [];

const scrapeBtn = document.getElementById('scrapeBtn');
const exportBtn = document.getElementById('exportBtn');
const resetBtn = document.getElementById('resetBtn');
const clearBtn = document.getElementById('clearBtn');
const statusDiv = document.getElementById('status');
const dataCountDiv = document.getElementById('dataCount');

function showStatus(message, type = 'info') {
  statusDiv.textContent = message;
  statusDiv.className = `status ${type}`;
}

function updateDataCount() {
  console.log('updateDataCount called, scrapedData.length:', scrapedData.length);

  if (scrapedData.length > 0) {
    dataCountDiv.style.display = 'block';
    dataCountDiv.querySelector('strong').textContent = scrapedData.length;
    exportBtn.disabled = false;
    console.log('Export button enabled');
  } else {
    dataCountDiv.style.display = 'none';
    exportBtn.disabled = true;
    console.log('Export button disabled');
  }
}

function saveDataToStorage(data) {
  chrome.storage.local.set({
    scrapedData: data,
    lastScrapedTime: new Date().toISOString()
  }, () => {
    console.log('Data saved to storage');
  });
}

function setScrapingInProgress(inProgress) {
  chrome.storage.local.set({
    scrapingInProgress: inProgress,
    scrapingStartTime: inProgress ? new Date().toISOString() : null
  }, () => {
    console.log('Scraping state saved:', inProgress);
  });
}

function loadDataFromStorage() {
  chrome.storage.local.get(['scrapedData', 'lastScrapedTime', 'scrapingInProgress', 'scrapingStartTime'], (result) => {
    console.log('Loading from storage:', result);

    if (result.scrapingInProgress) {
      scrapeBtn.disabled = true;
      const startTime = result.scrapingStartTime ? new Date(result.scrapingStartTime) : null;
      if (startTime) {
        const elapsed = getTimeAgo(startTime);
        showStatus(`Scraping sedang berjalan... (dimulai ${elapsed})`, 'info');
      } else {
        showStatus('Scraping sedang berjalan...', 'info');
      }
      console.log('Scraping is in progress');
    }
    else if (result.scrapedData && result.scrapedData.length > 0) {
      scrapedData = result.scrapedData;
      console.log('Restored data:', scrapedData.length, 'records');

      updateDataCount();

      const lastTime = result.lastScrapedTime ? new Date(result.lastScrapedTime) : null;
      if (lastTime) {
        const timeAgo = getTimeAgo(lastTime);
        showStatus(`Data tersedia (${timeAgo})`, 'success');
      } else {
        showStatus(`${scrapedData.length} records tersedia`, 'success');
      }
    } else {
      console.log('No stored data found');
    }
  });
}

function getTimeAgo(date) {
  const seconds = Math.floor((new Date() - date) / 1000);

  if (seconds < 60) return 'baru saja';
  if (seconds < 3600) return `${Math.floor(seconds / 60)} menit lalu`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} jam lalu`;
  return `${Math.floor(seconds / 86400)} hari lalu`;
}

function clearStoredData() {
  chrome.storage.local.remove(['scrapedData', 'lastScrapedTime'], () => {
    scrapedData = [];
    updateDataCount();
    console.log('Stored data cleared');
  });
}

scrapeBtn.addEventListener('click', async () => {
  try {
    clearStoredData();
    scrapeBtn.disabled = true;
    setScrapingInProgress(true);
    showStatus('Mengirim perintah scraping...', 'info');

    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab.url.includes('coretaxdjp.pajak.go.id')) {
      showStatus('Error: Buka halaman coretaxdjp.pajak.go.id terlebih dahulu', 'error');
      scrapeBtn.disabled = false;
      return;
    }

    chrome.tabs.sendMessage(tab.id, { action: 'startScraping' }, (response) => {
      if (chrome.runtime.lastError) {
        showStatus('Error: ' + chrome.runtime.lastError.message, 'error');
        scrapeBtn.disabled = false;
        return;
      }

      if (response && response.success) {
        showStatus('Scraping dimulai...', 'info');
      } else {
        showStatus('Error: Gagal memulai scraping', 'error');
        scrapeBtn.disabled = false;
      }
    });

  } catch (error) {
    showStatus('Error: ' + error.message, 'error');
    scrapeBtn.disabled = false;
  }
});

resetBtn.addEventListener('click', async () => {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab.url.includes('coretaxdjp.pajak.go.id')) {
      showStatus('Error: Buka halaman coretaxdjp.pajak.go.id terlebih dahulu', 'error');
      return;
    }

    resetBtn.disabled = true;
    showStatus('Mereset dan reload halaman...', 'info');

    chrome.tabs.sendMessage(tab.id, { action: 'resetAndReload' }, (response) => {
      if (chrome.runtime.lastError) {
        showStatus('Error: ' + chrome.runtime.lastError.message, 'error');
        resetBtn.disabled = false;
      } else {
        showStatus('Halaman akan direload...', 'info');
        setTimeout(() => {
          resetBtn.disabled = false;
        }, 2000);
      }
    });

  } catch (error) {
    showStatus('Error: ' + error.message, 'error');
    resetBtn.disabled = false;
  }
});

clearBtn.addEventListener('click', async () => {
  if (scrapedData.length === 0) {
    showStatus('Tidak ada data untuk dihapus', 'info');
    return;
  }

  const recordCount = scrapedData.length;
  if (confirm(`Hapus ${recordCount} records yang tersimpan?`)) {
    clearStoredData();
    showStatus('Data berhasil dihapus', 'success');
  }
});

async function exportToExcel() {
  try {
    if (scrapedData.length === 0) {
      showStatus('Tidak ada data untuk di-export', 'error');
      return;
    }

    exportBtn.disabled = true;
    showStatus('Membuat file Excel...', 'info');

    const headers = scrapedData.length > 0 ? Object.keys(scrapedData[0]) : [];

    const headerRow = headers.map(key => ({
      value: key,
      fontWeight: 'bold'
    }));

    const dataRows = scrapedData.map(item =>
      headers.map(key => ({
        type: typeof item[key] === 'number' ? Number : String,
        value: item[key] !== null && item[key] !== undefined ? item[key] : ''
      }))
    );

    const excelData = [headerRow, ...dataRows];

    const blob = await writeXlsxFile(excelData);

    const url = URL.createObjectURL(blob);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const filename = `coretax-data-${timestamp}.xlsx`;

    chrome.downloads.download({
      url: url,
      filename: filename,
      saveAs: true
    }, async (downloadId) => {
      if (chrome.runtime.lastError) {
        showStatus('Error saat download: ' + chrome.runtime.lastError.message, 'error');
        exportBtn.disabled = false;
      } else {
        showStatus(`Berhasil export ${scrapedData.length} records ke Excel`, 'success');

        setTimeout(async () => {
          const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

          if (tab && tab.url.includes('coretaxdjp.pajak.go.id')) {
            showStatus('Mereset dan reload halaman...', 'info');

            chrome.tabs.sendMessage(tab.id, { action: 'resetAndReload' }, (response) => {
              if (chrome.runtime.lastError) {
                console.error('Failed to reset:', chrome.runtime.lastError);
                exportBtn.disabled = false;
              }
            });
          } else {
            exportBtn.disabled = false;
          }
        }, 1500);
      }

      setTimeout(() => URL.revokeObjectURL(url), 1000);
    });

  } catch (error) {
    showStatus('Error saat export: ' + error.message, 'error');
    exportBtn.disabled = false;
  }
}

exportBtn.addEventListener('click', async () => {
  await exportToExcel();
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'scrapingComplete') {
    scrapedData = message.data;

    setScrapingInProgress(false);

    console.log('Popup: Received scraped data from background');

    showStatus(`Scraping selesai! Ditemukan ${scrapedData.length} records`, 'success');
    updateDataCount();
    scrapeBtn.disabled = false;

    setTimeout(() => {
      exportToExcel();
    }, 500);

    sendResponse({ received: true });
  } else if (message.action === 'scrapingError') {
    setScrapingInProgress(false);

    showStatus('Error saat scraping: ' + message.error, 'error');
    scrapeBtn.disabled = false;
    sendResponse({ received: true });
  } else if (message.action === 'scrapingProgress') {
    const pageInfo = message.total !== '?' ? `${message.page}/${message.total}` : message.page;
    showStatus(`Scraping halaman ${pageInfo}...`, 'info');
    sendResponse({ received: true });
  }

  return true;
});

console.log('Popup initialized, loading data from storage...');
loadDataFromStorage();
