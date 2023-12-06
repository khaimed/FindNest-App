const { ipcRenderer } = require("electron");
const ExcelJS = require("exceljs");
const shell = require("electron").shell;
let khaimedButton = document.getElementById("khaimed_button");
let facebookButton = document.getElementById("facebook_button");
let instagramButton = document.getElementById("instagram_button");
let twitterButton = document.getElementById("twitter_button");
let youtubeButton = document.getElementById("youtube_button");
let linkedinButton = document.getElementById("linkedin_button");

// click for my link
khaimedButton.addEventListener("click", () => {
  shell.openExternal("https://www.khaimed.com/");
});
// click for open browser
facebookButton.addEventListener("click", () => {
  shell.openExternal("https://www.facebook.com/khaimed");
});
instagramButton.addEventListener("click", () => {
  shell.openExternal("https://www.instagram.com/khaimed1");
});
twitterButton.addEventListener("click", () => {
  shell.openExternal("https://www.twitter.com/khaimed1");
});
linkedinButton.addEventListener("click", () => {
  shell.openExternal("https://www.linkedin.com/in/khaimed");
});
youtubeButton.addEventListener("click", () => {
  shell.openExternal("https://www.youtube.com/@khalidaitmhamed");
});

// click for call function selenium
document.querySelector(".search").addEventListener("click", () => {
  const selectValue = document.querySelector("select").value;
  const inputValue = document.querySelector("input[type=text]").value;
  switch (selectValue) {
    case "avito":
      ipcRenderer.send("avito-caller", inputValue);
      break;
    case "jumia":
      ipcRenderer.send("jumia-caller", inputValue);
      break;
    case "aliexpress":
      ipcRenderer.send("aliexpress-caller", inputValue);
      break;
    case "banggood":
      ipcRenderer.send("banggood-caller", inputValue);
      break;
    default:
      break;
  }
});
document.querySelector(".close").addEventListener("click",() => {
  document.querySelector(".result").style = "";
  document.getElementById("load_zone").style = "";
  document.getElementById("container").innerHTML = '';
})

// Execute a function when the user presses a key on the keyboard
document
  .querySelector('input[type="text"]')
  .addEventListener("keypress", function (event) {
    // If the user presses the "Enter" key on the keyboard
    if (
      event.key === "Enter" &&
      document.querySelector("input[type=text]").value != ""
    ) {
      // Cancel the default action, if needed
      event.preventDefault();
      // Trigger the button element with a click
      document.querySelector(".search").click();
    }
  });

document.addEventListener("DOMContentLoaded", function () {
  ipcRenderer.on("load-progress", async (event, value) => {
    document.getElementById("load_zone").style.display = "block";
    document.getElementById("is_charge").style.width = value + "%";
    document.getElementById("is_number").innerHTML = value + "%";
    if (value == 100.0) {
      document.querySelector(".result").style.top = "0";
      setTimeout(() => {
        const excelFilePath = path.join(
          __dirname,
          "../data_file/data.xlsx"
        );
  
        let products = [];
  
        // Create a new workbook and read the Excel file
        const workbook = new ExcelJS.Workbook();
        workbook.xlsx
          .readFile(excelFilePath)
          .then(() => {
            // Iterate over each sheet in the workbook
            workbook.eachSheet((sheet, sheetId) => {
              console.log(`Sheet Name: ${sheet.name}`);
  
              // Iterate over each row in the sheet
              sheet.eachRow((row, rowNumber) => {
                if (rowNumber != 1) {
                  let product = [];
                  row.eachCell((cell) => {
                    product.push(cell.value);
                  });
  
                  products.push(product);
                }
              });
            });
  
            console.log(products);
            if (products.length == 1) {
              const productDiv = document.createElement("div");
              productDiv.className = "product";
  
              // Set the innerHTML of the div using the template string
              productDiv.innerHTML = `
                  <a href="${products[0][3]}" target="_blank" rel="noopener noreferrer">
                    <img src="${products[0][1]}" alt="image">
                    <p class="product_title">${products[0][0]}</p>
                    <p class="product_price">${products[0][2]}</p>
                  </a>
                `;
  
              // Append the created div to the container
              document.getElementById("container").appendChild(productDiv);
            } else {
              products.forEach((product) => {
                console.log(product);
                const productDiv = document.createElement("div");
                productDiv.className = "product";
  
                // Set the innerHTML of the div using the template string
                productDiv.innerHTML = `
                    <a href="${product[3]}" target="_blank" rel="noopener noreferrer">
                      <img src="${product[1]}" alt="image">
                      <p class="product_title">${product[0]}</p>
                      <p class="product_price">${product[2]}</p>
                    </a>
                  `;
  
                // Append the created div to the container
                document.getElementById("container").appendChild(productDiv);
              });
            }
          })
          .catch((error) => {
            console.error("Error reading Excel file:", error.message);
          });
      }, 3000)
    }
  });
});

const path = require("path");
document.getElementById("stop").addEventListener("click", function () {
  ipcRenderer.send("stop-searching");
});
