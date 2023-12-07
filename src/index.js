const { app, BrowserWindow, ipcMain} = require('electron');
const path = require('path');
const { Builder, By, Key } = require('selenium-webdriver');
const ExcelJS = require('exceljs');

let mainWindow;

if (require('electron-squirrel-startup')) {
  app.quit();
}

const createWindow = () => {

  mainWindow = new BrowserWindow({
    height: 600,
    webPreferences: {
      nodeIntegration: true,
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: false,
      contentSecurityPolicy: "script-src 'self' 'unsafe-eval' 'zwxpBwzZbURUl3JTSABruEg1kvcUuFAJ' 'sha256-2l30QxSunNDaaNuCPRFcr2eKTYDRur0Sa2UznSlq8LQ='",
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'index.html'));

  // mainWindow.webContents.openDevTools();
};

app.on('ready', createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// to Call all function for each one click
ipcMain.on('avito-caller', async (event, value) => {
  let driver;

  try {
    driver = await new Builder().forBrowser('chrome').build();

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Sheet 1');

    await driver.manage().window().maximize(); // Maximize Window

    let url = 'https://www.avito.ma/';
    await driver.get(url)

    await driver.executeScript('document.getElementById("google_ads_iframe_58092247/d_am_rm_0__container__").remove()');
    await driver.findElement(By.name('keyword')).sendKeys(value, Key.ENTER)

    let data = [];
    isStarted = true

    ipcMain.on('stop-searching', async (event) => {
      await driver.quit()
    });

    // Add headers to the data array
    data.push(['Titles', 'Images', 'Prices', 'Url']);
    // function to click and navigate for each page
    const navigateToPage = async (x) => {
      await driver.findElement(By.xpath(`//*[@id="__next"]/div/main/div/div[5]/div[1]/div/div[4]/div/a[${x}]`)).click();
    }
    // Upload Data
    const uploadData = async () => {
      let titles = await driver.findElements(By.xpath('/html/body/div[1]/div/main/div/div[5]/div[1]/div/div[3]/a/div[3]/div/p'))
      let images = await driver.findElements(By.xpath('/html/body/div[1]/div/main/div/div[5]/div[1]/div/div[3]/a/div//img'))
      let prices = await driver.findElements(By.xpath('/html/body/div[1]/div/main/div/div[5]/div[1]/div/div[3]/a/div[3]/div/div/p'))
      let urls = await driver.findElements(By.xpath('/html/body/div[1]/div/main/div/div[5]/div[1]/div/div[3]/a'))
      for (let i = 0; i < titles.length; i++) {
        if (prices[i]) {
          let title = await titles[i].getText();
          let image = await images[i].getAttribute('src');
          let price = await prices[i].getText();
          let url = await urls[i].getAttribute('href');
          let article = title + '\n' + image + '\n' + price.replace(/,/g, '') + '\n' + url;
          let articles = article.split('\n');
          data.push(articles);
        }
      }
    }
    // The final number page to stop it
    let finNumberPage = (await driver.findElements(By.xpath('/html/body/div[1]/div/main/div/div[5]/div[1]/div/div[4]/div/a'))).length
    if(finNumberPage === 0){
      await uploadData()
      mainWindow.webContents.send("load-progress", 100);
    }
    // Browse for a specified period
    for (let i = 0; i < finNumberPage; i++) {
      console.log(`The page ${i + 1}`)

      const progressValue = (((i + 1) / finNumberPage) * 100).toFixed(2);
      console.log(progressValue)

      //here i want to send the progressValue to rendrer.js
      mainWindow.webContents.send("load-progress", progressValue);

      await driver.executeScript('document.getElementById("google_ads_iframe_58092247/d_am_rm_0__container__").remove()');
      let numberPages = (await driver.findElements(By.className('sc-2y0ggl-1'))).length
      if (i === 0) {
        await uploadData()
        await navigateToPage(numberPages);
      } else if (i + 1 === finNumberPage) {
        console.log('stopping the loop.');
        break;
      } else {
        await uploadData();
        await navigateToPage(numberPages);
      }
    }
    worksheet.addRows(data)
    workbook.xlsx.writeFile(`data_file/data.xlsx`)
      .then(function () {
        console.log('Excel file created');
      })
      .catch(function (error) {
        console.error('Error creating Excel file:', error);
      });
    await driver.quit();
  } finally {
    await driver.quit();
  }
});

ipcMain.on('jumia-caller', (event, value) => {
  
});

ipcMain.on('aliexpress-caller', (event, value) => {
  
});

ipcMain.on('banggood-caller', (event, value) => {
  
});




