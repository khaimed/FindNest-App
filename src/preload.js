const path = require("path");
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
  shell.openExternal("https://www.facebook.com/khaimedev");
});
instagramButton.addEventListener("click", () => {
  shell.openExternal("https://www.instagram.com/khaimedev");
});
twitterButton.addEventListener("click", () => {
  shell.openExternal("https://www.twitter.com/khaimed1");
});
linkedinButton.addEventListener("click", () => {
  shell.openExternal("https://www.linkedin.com/in/khaimed");
});
youtubeButton.addEventListener("click", () => {
  shell.openExternal("https://www.youtube.com/@khaimedev");
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
  const products = document.querySelectorAll('.product');

  // Remove all product elements
  products.forEach(product => {
    product.remove();
  });
  ipcRenderer.send('delete-all-data');
})

// Execute a function when the user presses a key on the keyboard
document.querySelector('input[type="text"]').addEventListener("keypress", function (event) {
    if (
      event.key === "Enter" &&
      document.querySelector("input[type=text]").value != ""
    ) {
      event.preventDefault();
      document.querySelector(".search").click();
      document.getElementById('load_zone').style.display = "block"
      document.getElementById("is_charge").style.width = 0 + "%";
      document.getElementById("is_number").innerHTML = 0 + "%";
    }
  });

document.addEventListener("DOMContentLoaded", function () {
  ipcRenderer.on('data-read', (event, data) => {
    Object.keys(data).forEach((itemId) => {
      const item = data[itemId];

      // Create a div for each item
      const itemDiv = document.createElement('div');
      itemDiv.className = 'product';

      itemDiv.innerHTML = `
        <a href="${item.urls}" target="_blank" rel="noopener noreferrer">
          <img src="${item.images}" alt="image">
          <p class="product_title">${item.titles}</p>
          <p class="product_price">${item.prices}</p>
        </a>
      `;

      container.appendChild(itemDiv);
    });
  });
  
  ipcRenderer.on("load-progress", async (event, value) => {
    document.getElementById("load_zone").style.display = "block";
    document.getElementById("is_charge").style.width = value + "%";
    document.getElementById("is_number").innerHTML = value + "%";
    if (value == 100.0) {
      document.querySelector(".result").style.top = "0";
    }
  });
});

document.getElementById("stop").addEventListener("click", function () {
  document.getElementById("load_zone").style = "";
  ipcRenderer.send("stop-searching");
});

document.querySelector(".extract_button").addEventListener("click", function () {
  const products = document.querySelectorAll('.product');
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Products');

  // Add headers to the worksheet
  worksheet.addRow(["Href", "Image", "Title", "Price"]);

  // Iterate through products and add data to the worksheet
  products.forEach(product => {
    const hrefProduct = product.querySelector("a").href;
    const imageProduct = product.querySelector("img").src;
    const titleProduct = product.querySelector(".product_title").textContent;
    const priceProduct = product.querySelector(".product_price").textContent;

    // Add a new row with product data
    worksheet.addRow([hrefProduct, imageProduct, titleProduct, priceProduct]);
  });

  // Create a blob from the Excel workbook
  workbook.xlsx.writeBuffer().then(buffer => {
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

    // Create an anchor element and set its attributes
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'products.xlsx';

    // Append the anchor element to the document and click it programmatically
    document.body.appendChild(a);
    a.click();

    // Remove the anchor element
    document.body.removeChild(a);
  });
});
