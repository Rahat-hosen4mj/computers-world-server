const express = require("express");
const app = express();
const cors = require("cors");
const jwt = require("jsonwebtoken");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
require("dotenv").config();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.ox1ut.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverApi: ServerApiVersion.v1,
});

async function run() {
  try {
    await client.connect();
    const partsCollection = client.db("computer_world").collection("parts");
    const orderCollection = client.db("computer_world").collection("orders");
    const userCollection = client.db("computer_world").collection("users");

    // get part
    app.get("/part", async (req, res) => {
      const query = {};
      const cursor = partsCollection.find(query);
      const parts = await cursor.toArray();
      res.send(parts);
    });

    app.get("/part/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: ObjectId(id) };
      const part = await partsCollection.findOne(query);
      res.send(part);
    });

    // update user info into database
    app.put('/user/:email', async(req, res) =>{
      const email = req.params.email;
      const user = req.body;
      const filter = {email: email}
      const options = {upsert: true}
      const updateDoc = {
        $set: user,
      }
      const result = await userCollection.updateOne(filter, updateDoc, options);
      res.send(result)
    })

    // get order from server
    app.get("/order", async (req, res) => {
      const buyer = req.query.buyer || "nusrat@gmail.com";
      const query = { buyer: buyer };
      const orders = await orderCollection.find(query).toArray();
      res.send(orders);
    });

    // post order in the server
    app.post("/order", async (req, res) => {
      const order = req.body;
      // const query = { product: order.product,  buyer: order.buyer }
      const result = await orderCollection.insertOne(order);
      res.send(result);
    });
  } finally {
  }
}

run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Computers wrold server side running");
});

app.listen(port, () => {
  console.log(`Computers wrold server side running : ${port}`);
});
