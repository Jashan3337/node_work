const puppeteer = require("puppeteer");
const { google } = require("googleapis");
const cron = require("node-cron");

// Google Sheets helper function
async function appendToSheet(dataRows) {
  const auth = new google.auth.GoogleAuth({
    keyFile: "google-sheets-service-account.json",
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });

  const client = await auth.getClient();
  const sheets = google.sheets({ version: "v4", auth: client });

  const spreadsheetId = "1vBtkGANVQ7T5TKhSnm1DHijDGoiIxjVmH-jhdo64EP0";
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

async function scrape() {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();

  await page.goto("https://www.myairtrade.com/engines/model", {
    waitUntil: "networkidle2",
  });

  const modelUrls = await page.$$eval(".model a", (anchors) =>
    anchors.map((a) => a.href)
  );
  console.log(`Found ${modelUrls.length} model URLs.`);

  let allRows = [];

  for (const url of modelUrls) {
    console.log(`Processing ${url} ...`);
    await page.goto(url, { waitUntil: "networkidle2" });

    try {
      await page.waitForSelector(".jsgrid-grid-body .jsgrid-table tbody tr", {
        timeout: 10000,
      });
    } catch {
      console.log(`No data table found on ${url}`);
      continue;
    }

    const rows = await page.$$eval(
      ".jsgrid-grid-body .jsgrid-table tbody tr",
      (trs) =>
        trs.map((tr) =>
          Array.from(tr.querySelectorAll("td")).map((td) =>
            td.textContent.trim()
          )
        )
    );

    console.log(`Rows found: ${rows.length}`);
    allRows.push(...rows);
  }

  await browser.close();
  await appendToSheet(allRows);

  console.log("✅ Finished scraping and uploading data.");
}

// Run once immediately when script starts (manual run)
scrape().catch(console.error);

// Schedule to run once a month at midnight on the 1st day
cron.schedule("0 0 1 * *", () => {
  console.log("🔄 Running scheduled monthly scrape job...");
  scrape().catch(console.error);
});
