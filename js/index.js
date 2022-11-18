console.log("Bing MMMM");

function csvToArray(str, delimiter = ",") {
  const headers = str.slice(0, str.indexOf("\n")).split(delimiter);
  const rows = str.slice(str.indexOf("\n") + 1).split("\n");
  const arr = rows.map((row) => {
    const values = row.split(delimiter);
    const el = headers.reduce((object, header, index) => {
      object[header] = values[index];
      return object;
    }, {});
    return el;
  });
  return arr;
}

let prevCount = 0;

fetch("./data/count.csv")
  .then((response) => response.text())
  .then((text) => {
    console.log(text);
    let csv = csvToArray(text);
    console.log(csv);
    const table = document.getElementById("mmmm-table");
    csv.forEach((item) => {
      let row = table.insertRow();
      let yearCell = row.insertCell();
      let yearText = document.createTextNode(item.year);
      yearCell.append(yearText);

      let date = new Date();
      date.setMonth(parseInt(item.month) - 1);
      let monthCell = row.insertCell();
      let monthText = document.createTextNode(
        date.toLocaleDateString("en-US", { month: "long" })
      );
      monthCell.append(monthText);

      let countCell = row.insertCell();
      let countText = document.createTextNode(item.count);
      countCell.append(countText);
      prevCount += parseInt(item.count);
    });
  });

const counter = document.getElementById("counter");

function fetchCount() {
  fetch("https://g7wog95atg.execute-api.us-west-2.amazonaws.com/bing")
    .then((response) => response.json())
    .then((data) => {
      const totalCount = data.count + prevCount;
      counter.innerHTML = totalCount.toString();
    });
}

fetchCount();
setInterval(fetchCount, 60000);
