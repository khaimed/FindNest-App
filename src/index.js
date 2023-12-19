const { app, BrowserWindow, ipcMain} = require('electron');
const path = require('path');
const { Builder, By, Key } = require('selenium-webdriver');
const chrome = require('selenium-webdriver/chrome');

let options = new chrome.Options();
options.addArguments('--headless');

let mainWindow;

if (require('electron-squirrel-startup')) {
  app.quit();
}

const createWindow = () => {

  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    autoHideMenuBar: true,
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

const { initializeApp } = require('firebase/app');
const { getDatabase, ref, push, set, onValue, remove} = require('firebase/database');

const firebaseConfig = {
  apiKey: "AIzaSyA4a8FT5fWjqsPFrBZE28kaycap5Dw6y-c",
  authDomain: "findnestapp.firebaseapp.com",
  databaseURL: "https://findnestapp-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "findnestapp",
  storageBucket: "findnestapp.appspot.com",
  messagingSenderId: "978620798503",
  appId: "1:978620798503:web:8859e9550aaf11052be002",
  measurementId: "G-KN861XYMZ2"
};

// Initialize Firebase
const findNest = initializeApp(firebaseConfig);
const database = getDatabase(findNest);

var findNestDB = ref(database, "findnest/findNestApp");

const saveAppDB = (title, image, price, url) => {
  // Call push as a method on the reference
  var newFindNestDB = push(findNestDB);

  // Set data using the push key
  set(newFindNestDB, {
    titles: title,
    images: image,
    prices: price,
    urls: url
  }, (error) => {
    if (error) {
      console.error("Data could not be saved.", error);
    } else {
      console.log("Data saved successfully.");
    }
  });
};

ipcMain.on('delete-all-data', (event) => {
  // Reference to the entire data
  const entireDataRef = ref(database);

  // Remove all data
  remove(entireDataRef)
    .then(() => {
      console.log('All data deleted successfully.');
    })
    .catch((error) => {
      console.error('Error deleting all data:', error);
    });
});

// to Call all function for each one click
ipcMain.on('avito-caller', async (event, value) => {
  let driver;

  try {
    driver = await new Builder().forBrowser('chrome').setChromeOptions(options).build();

    let url = 'https://www.avito.ma/';
    await driver.get(url)

    await driver.findElement(By.name('keyword')).sendKeys(value, Key.ENTER)

    let data = [];

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
          saveAppDB(title , image , price.replace(/,/g, ''), url)
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
      // console.log(`The page ${i + 1}`)

      const progressValue = (((i + 1) / finNumberPage) * 100).toFixed(2);
      // console.log(progressValue)

      //here i want to send the progressValue to rendrer.js
      mainWindow.webContents.send("load-progress", progressValue);

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

    onValue(findNestDB, (snapshot) => {
      const data = snapshot.val();
      mainWindow.webContents.send('data-read', data);
    });
    await driver.quit();
  } catch (error){
    console.log("the error is :", error)
    await driver.quit();
  }
});

ipcMain.on('jumia-caller',  async (event, value) => {
  let driver;
    try {
      driver = await new Builder().forBrowser('chrome').build();
      
      await driver.manage().window().maximize(); // Maximize Window
  
      let url = 'https://www.jumia.ma/';
      await driver.get(url)

      if(await driver.findElement(By.css('.popup')).getAttribute('class').then(classes => classes.includes('_open'))){
          await driver.findElement(By.xpath('/html/body/div[1]/div[4]/div/section/button')).click()
      }
      // put the value to search
      await driver.findElement(By.name('q')).sendKeys(value,Key.ENTER);
      
      let lengthValue;
      const getfinNumberPage = async () => {
        const lengthOfBar = await driver.findElements(By.xpath('//*[@id="jm"]/main/div[2]/div[3]/section/div[2]/a'))
        const numberTwo = await driver.findElement(By.xpath('/html/body/div[1]/main/div[2]/div[3]/section/div[2]/a[4]'))
        const numberMax = await driver.findElement(By.xpath('/html/body/div[1]/main/div[2]/div[3]/section/div[2]/a[5]'))
        const goTo= await driver.findElement(By.xpath('/html/body/div[1]/main/div[2]/div[3]/section/div[2]/a[7]'))
        const backTo = await driver.findElement(By.xpath('/html/body/div[1]/main/div[2]/div[3]/section/div[2]/a[1]'))
        await driver.executeScript(`window.scrollTo(0, 999);`);
        if(lengthOfBar.length == 6){
          lengthValue = numberTwo.getText()
            return lengthValue
        } else if (lengthOfBar.length == 7){
            goTo.click()
            lengthValue = numberMax.getText()
            backTo.click()
          return lengthValue
        } else if(lengthOfBar == 0){
          return lengthValue = lengthOfBar.length
        }
      }
      
      lengthValue = await getfinNumberPage()

    } catch (error){
      console.log("the error is :", error)
      await driver.quit();
    }
});

ipcMain.on('aliexpress-caller', (event, value) => {
  
});

ipcMain.on('banggood-caller', (event, value) => {
  
});




