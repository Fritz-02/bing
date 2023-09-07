import WebSocket from "ws";
import {
  DynamoDBClient,
  UpdateItemCommand,
  GetItemCommand,
} from "@aws-sdk/client-dynamodb";
import * as fs from "fs";

const args = process.argv.slice(2);
const client = new DynamoDBClient({ region: "us-west-2" });
const tableName = "bing-mmmm";

async function getCounter() {
  const item = (
    await client.send(
      new GetItemCommand({
        TableName: tableName,
        Key: {
          key: {
            S: "count",
          },
        },
      })
    )
  ).Item;
  return parseInt(item.value.N);
}
let count = await getCounter();

async function updateCounter() {
  const command = new UpdateItemCommand({
    TableName: tableName,
    Key: {
      key: {
        S: "count",
      },
    },
    UpdateExpression: `SET #value = :n`,
    ExpressionAttributeValues: {
      ":n": {
        N: count.toString(),
      },
    },
    ExpressionAttributeNames: {
      "#value": "value",
    },
  });
  const response = await client.send(command);
}

async function updateFromRustleSearch(
  startDate,
  endDate = null,
  searchAfter = null,
  updatedCount = 0
) {
  let date = new Date(searchAfter);
  console.log(date.toUTCString(), searchAfter, updatedCount);
  return fetch(
    `https://api-v2.rustlesearch.dev/anon/search?username=bing&channel=Destinygg&text=MMMM&start_date=${startDate}` +
      (searchAfter ? `&search_after=${searchAfter}` : "") +
      (endDate ? `&end_date=${endDate}` : "")
  )
    .then((response) => response.json())
    .then((data) => {
      let messages = data.data.messages;
      messages.forEach((msg) => {
        updatedCount += (msg.text.match(/(?<=(^|\s))MMMM(?=($|\s))/g) || [])
          .length;
      });
      if (messages.length == 100) {
        updatedCount = updateFromRustleSearch(
          startDate,
          endDate,
          messages[messages.length - 1].searchAfter,
          updatedCount
        );
      }
      return updatedCount;
    });
}

const autoReconnectDelay = 5000;

const connectToWSS = () => {
  let ws = new WebSocket("wss://chat.destiny.gg/ws");

  ws.on("open", () => {
    console.log("Websocket opened");
  });

  ws.on("close", () => {
    ws.terminate();
    clearTimeout(ws.pingTimeout);
    setTimeout(() => {
      ws.removeAllListeners();
      ws = connectToWSS();
    }, autoReconnectDelay);
  });

  ws.on("message", async function message(data) {
    const str = data.toString();
    let msgType = str.substring(0, str.indexOf(" "));
    let msgData = JSON.parse(str.substring(str.indexOf(" ") + 1));
    switch (msgType) {
      case "MSG":
        if (msgData.nick == "Bing") {
          console.log(
            `[${msgData.timestamp}] ${msgData.nick}: ${msgData.data}`
          );
          count += (msgData.data.match(/(?<=(^|\s))MMMM(?=($|\s))/g) || [])
            .length;
          await updateCounter();
        }
        break;
    }
  });

  ws.on("error", (err) => {
    if (err.code === "ECONNREFUSED") {
      ws.removeAllListeners();
      ws = connectToWSS().ws;
    }
    ws.terminate();
  });
  return ws;
};

switch (args[0]) {
  case "-U":
    console.log("Updating count from RustleSearch...");
    fs.readFile("data/count.csv", "utf8", async function (err, data) {
      if (err) {
        throw err;
      }
      let [year, month, _] = data.split(/\r?\n/)[1].split(",");
      let monthInt = parseInt(month) + 1;
      if (monthInt > 12) {
        monthInt -= 12;
        year++;
      }
      monthInt = monthInt > 12 ? monthInt - 12 : monthInt;
      const monthStr = monthInt.toString().padStart(2, "0");
      count = await updateFromRustleSearch(`${year}-${monthStr}-01`);
      console.log(`Updated count: ${count}`);
      await updateCounter();
    });
    connectToWSS();
    break;
  case "-csv":
    const updateMonth = args[1]; // e.g. 2022-12
    const yearStr = updateMonth.slice(0, 4);
    const monthStr = updateMonth.slice(5);
    const lastDayOfMonth = new Date(
      parseInt(yearStr),
      parseInt(monthStr),
      0
    ).getDate();
    // Updates count.csv
    fs.readFile("data/count.csv", "utf8", async function (err, data) {
      if (err) {
        throw err;
      }
      const monthCount = await updateFromRustleSearch(
        `${updateMonth}-01`,
        `${updateMonth}-${lastDayOfMonth}`
      );
      let lines = data.split(/\r?\n/);
      lines.splice(1, 0, `${yearStr},${monthStr},${monthCount}`);
      fs.writeFile("data/count.csv", lines.join("\n"), (err) => {
        if (err) console.log(err);
        console.log("Updated count.csv");
        process.exit(0);
      });
    });
}
