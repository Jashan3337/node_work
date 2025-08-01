const puppeteer = require("puppeteer");
const { google } = require("googleapis");
const cron = require("node-cron");
console.log("⏱ Script started at", new Date().toISOString());


// Google Sheets helper function
async function appendToSheet(dataRows) {
  const auth = new google.auth.GoogleAuth({
    keyFile: "google-sheets-service-account.json", 
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });

  const client = await auth.getClient();
  const sheets = google.sheets({ version: "v4", auth: client });

  const spreadsheetId = "1DGm994jbkkpNFTX74VK0cpMB8UD0Pzi6XpJQepSPiNc"; // your Sheet ID
  const range = "Sheet1!A1";

  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range,
    valueInputOption: "RAW",
    requestBody: {
      values: dataRows,
    },
  });

  console.log("✅ Data appended to Google Sheet!");
}

// Scraper function
async function scrape() {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();

  const BASE_URL =
    "https://www.aeroconnect.com/available-aircraft-for-sale-or-lease/model/";

  await page.goto(BASE_URL, { waitUntil: "networkidle2" });

    const modelUrls = await page.$$eval(
      ".module_content a.aircraft__model__name, \
   .module_content a.aircraft__manufacturer__name, \
   .module_content a.aircraft__vendor__name, \
   .module_content a.single_module.module_all a",
      (anchors) => [...new Set(anchors.map((a) => a.href))]
    );



  console.log(`Found ${modelUrls.length} model URLs.`);

  let allRows = [];

  for (const url of modelUrls) {
    console.log(`Processing ${url} ...`);
    const aircraftPage = await browser.newPage();
    await aircraftPage.goto(url, { waitUntil: "networkidle2" });

    try {
      await aircraftPage.waitForSelector("tbody tr", { timeout: 10000 });
    } catch {
      console.log(`❌ No data table found on ${url}`);
      await aircraftPage.close();
      continue;
    }

    const rows = await aircraftPage.$$eval("tbody tr", (trs) =>
      trs.map((tr) =>
        Array.from(tr.querySelectorAll("td")).map((td) => {
          const link = td.querySelector("a");
          return link ? link.href : td.textContent.trim();
        })
      )
    );

    console.log(`✅ Rows found: ${rows.length}`);
    allRows.push(...rows);
    await aircraftPage.close();
  }

  await browser.close();

  if (allRows.length > 0) {
    await appendToSheet(allRows);
  } else {
    console.log("⚠️ No rows to append.");
  }

  console.log("✅ Finished scraping and uploading data.");
}

// Run immediately
scrape().catch(console.error);

// Schedule to run once a month at midnight on the 1st
// cron.schedule("0 0 1 * *", () => {
//   console.log("🔄 Running scheduled monthly scrape job...");
//   scrape().catch(console.error);
// });
