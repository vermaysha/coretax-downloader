console.log('Coretax Scraper: Content script loaded');

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

function scrapeCurrentPage() {
    try {
        const rows = document.querySelectorAll('table tbody > tr');
        
        const pageData = [...rows].map(row => {
            // skip kolom checkbox dan button
            const cells = [...row.querySelectorAll('td')].slice(2);
            
            if (cells.length === 0) return null;

            return {
                "NPWP PEMBELI / Identitas Lainnya": cells[0]?.innerText.trim(),
                "Nama Pembeli": cells[1]?.innerText.trim(),
                "Kode Transaksi": cells[2]?.innerText.trim(),
                "Nomor Faktur Pajak": cells[3]?.innerText.trim(),
                "Tanggal Faktur Pajak": cells[4]?.innerText.trim(),
                "Masa Pajak": cells[5]?.innerText.trim(),
                "Tahun": Number(cells[6]?.innerText.trim()),
                "Status Faktur": cells[7]?.innerText.trim(),
                "ESignStatus": cells[8]?.innerText.trim(),
                "Harga Jual/Penggantian/DPP": Number(cells[9]?.innerText.trim().replace(/\D/g,'')),
                "DPP Nilai Lain/DPP": Number(cells[10]?.innerText.trim().replace(/\D/g,'')),
                "PPN": Number(cells[11]?.innerText.trim().replace(/\D/g,'')),
                "PPnBM": Number(cells[12]?.innerText.trim().replace(/\D/g,'')),
                "Penandatangan": cells[13]?.innerText.trim(),
                "Referensi": cells[14]?.innerText.trim(),
                "Dilaporkan oleh Penjual": cells[15]?.innerText.trim(),
                "Dilaporkan oleh Pemungut PPN": cells[16]?.innerText.trim()
            };
        }).filter(item => item !== null);

        console.log(`Berhasil mengambil ${pageData.length} data dari halaman ini.`);
        return pageData;

    } catch (error) {
        console.error('Error saat scraping halaman:', error);
        return [];
    }
}

async function scrapePage() {
    let allData = [];
    let hasNextPage = true;
    let pageCount = 1;

    console.log("🚀 Memulai proses scraping otomatis...");

    while (hasNextPage) {
        const currentPageData = scrapeCurrentPage();
        allData = [...allData, ...currentPageData];

        const nextButton = document.querySelector('.p-paginator-next');

        const isDisabled = nextButton.classList.contains('p-disabled') || nextButton.disabled;

        if (nextButton && !isDisabled) {
            console.log(`➡️ Pindah ke halaman ${pageCount + 1}...`);
            
            nextButton.scrollIntoView({ behavior: 'smooth', block: 'center' });
            
            nextButton.click();
            
            pageCount++;

            // Tunggu seluruh data kerender
            await sleep(500);
            window.focus();
            document.querySelector('table').focus();
            await sleep(5000); 
            window.focus();
            document.querySelector('table').focus();
            await sleep(500);

        } else {
            console.log("🛑 Tombol Next tidak aktif atau sudah di halaman terakhir.");
            hasNextPage = false;
        }
    }

    console.log(`✅ Selesai! Total ${allData.length} data berhasil diambil.`);
    return allData;
}


function resetAndReload() {
    try {
        console.log('🔄 Resetting localStorage and extension state...');
        
        chrome.storage.local.clear(() => {
            console.log('✅ Extension storage cleared');

            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                const value = localStorage.getItem(key);
                
                try {
                    const parsed = JSON.parse(value);
                    
                    if (parsed && typeof parsed === 'object' && 'first' in parsed) {
                        console.log(`✅ Found localStorage key: ${key}`);
                        console.log(`   Old 'first' value: ${parsed.first}`);
                        
                        parsed.first = 0;
                        
                        localStorage.setItem(key, JSON.stringify(parsed));
                        console.log(`   New 'first' value: 0`);
                        
                        console.log('🔄 Reloading page...');
                        window.location.reload();
                        return true;
                    }
                } catch (e) {
                    continue;
                }
            }
            
            console.warn('⚠️ No localStorage key with "first" property found, reloading anyway');
            window.location.reload();
            return false;
        });
        
    } catch (error) {
        console.error('❌ Error resetting:', error);
        return false;
    }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'startScraping') {
        console.log('Coretax Scraper: Received scraping request');

        sendResponse({ success: true, message: 'Scraping started' });

        (async () => {
            try {
                const scrapedData = await scrapePage();

                chrome.runtime.sendMessage({
                    action: 'scrapingComplete',
                    data: scrapedData
                }, (response) => {
                    if (chrome.runtime.lastError) {
                        console.error('Coretax Scraper: Error sending data:', chrome.runtime.lastError);
                    } else {
                        console.log('Coretax Scraper: Data sent to background script');
                    }
                });

            } catch (error) {
                console.error('Coretax Scraper: Scraping failed:', error);

                chrome.runtime.sendMessage({
                    action: 'scrapingError',
                    error: error.message
                });
            }
        })();

        return false;
    } else if (message.action === 'resetAndReload') {
        console.log('Coretax Scraper: Received reset & reload request');
        sendResponse({ success: true });
        
        setTimeout(() => {
            resetAndReload();
        }, 100);
        
        return false;
    }
});
