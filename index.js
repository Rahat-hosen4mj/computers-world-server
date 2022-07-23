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

// verify jwt for unautorized access
function verifyJWT(req, res, next){
  const authHeader = req.headers.authorization;
  if(!authHeader){
    return res.status(401).send({message: 'Unauthorized access'})
  }
  const token = authHeader.split(' ')[1];
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, function(err, decoded){
    if(err){
      return res.status(403).send({message: 'Forbidded Access'})
    }
    req.decoded = decoded;
    next()
  });
}

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
      const token = jwt.sign({email: email}, process.env.ACCESS_TOKEN_SECRET, {expiresIn:'1d'})
      res.send({result, token})
    })

    // get order from server
    app.get("/order", verifyJWT, async(req, res) => {
      const buyer = req.query.buyer || "nusrat@gmail.com";
      const decodedEmail = req.decoded.email
      if(decodedEmail === buyer){
        const query = { buyer: buyer };
        const orders = await orderCollection.find(query).toArray();
        res.send(orders);
      }
      else{
        return res.status(403).send({message: 'Forbidded Access'})
      }
     
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
