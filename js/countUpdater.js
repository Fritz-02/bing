import WebSocket from "ws";
import {
  DynamoDBClient,
  UpdateItemCommand,
  GetItemCommand,
} from "@aws-sdk/client-dynamodb";

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

const ws = new WebSocket("wss://chat.destiny.gg/ws");

ws.on("open", function open() {
  console.log("Websocket opened");
});

ws.on("close", function close() {
  console.log("Websocket closed");
});

ws.on("message", async function message(data) {
  const str = data.toString();
  let msgType = str.substring(0, str.indexOf(" "));
  let msgData = JSON.parse(str.substring(str.indexOf(" ") + 1));
  switch (msgType) {
    case "MSG":
      if (msgData.nick == "Bing" || msgData.nick == "Fritz") {
        count += (msgData.data.match(/(?<=(^|\s))MMMM(?=($|\s))/g) || [])
          .length;
        await updateCounter();
      }
      break;
  }
});