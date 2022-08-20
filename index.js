const express = require("express");
const app = express();
const cors = require("cors");
const jwt = require("jsonwebtoken");

const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
require("dotenv").config();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
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
    console.log('apps running succesfully')
    const partsCollection = client.db("computer_world").collection("parts");
    const reviewCollection = client.db("computer_world").collection("reviews");
    const orderCollection = client.db("computer_world").collection("orders");
    const userCollection = client.db("computer_world").collection("users");
    const paymentCollection = client.db("computer_world").collection("payments");

    // verify admin
    const verifyAdmin = async (req, res, next) => {
      const requester = req.decoded.email;
      const requesterAccount = await userCollection.findOne({ email: requester });
      if (requesterAccount.role === 'admin') {
        next();
      }
      else {
        res.status(403).send({ message: 'forbidden' });
      }
    }

    // get all  part
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

    // get all review
    app.get("/review", async (req, res) => {
      const query = {};
      const cursor = reviewCollection.find(query);
      const reviews = await cursor.toArray();
      res.send(reviews);
    });


    // get all user in the page
    app.get('/user', verifyJWT, async(req, res) => {
      const users = await userCollection.find().toArray();
      res.send(users);
    });

    // only admin can see user page
    app.get('/admin/:email', async (req, res) => {
      const email = req.params.email;
      const user = await userCollection.findOne({ email: email });
      const isAdmin = user.role === 'admin';
      res.send({ admin: isAdmin })
    })

    // make admit 
   app.put('/user/admin/:email', verifyJWT, verifyAdmin, async (req, res) => {
      const email = req.params.email;
      const filter = { email: email };
      const updateDoc = {
        $set: { role: 'admin' },
      };
      const result = await userCollection.updateOne(filter, updateDoc);
      res.send(result);
    })

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

    // get a specific order [by id]
    app.get('/order/:id', verifyJWT, async(req, res) =>{
      const id = req.params.id;
      const filter = {_id: ObjectId(id)};
      const order = await orderCollection.findOne(filter);
      res.send(order)
    })

    // make payment intent
    app.post("/create-payment-intent", verifyJWT, async (req, res) => {
      const  service  = req.body;
      const price = service.price
      const amount = price * 100
      // Create a PaymentIntent with the order amount and currency
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: "usd",
        payment_method_types: ['card']
      });
      res.send({
        clientSecret: paymentIntent.client_secret
      });

    });

     // update when payment success
     app.patch('/order/:id', verifyJWT, async(req, res) =>{
      const id  = req.params.id;
      const payment = req.body;
      const filter = {_id: ObjectId(id)};
      const updatedDoc = {
        $set: {
          paid: true,
          transactionId: payment.transactionId
        }
      }
      const result = await paymentCollection.insertOne(payment);
      const updatedBooking = await orderCollection.updateOne(filter, updatedDoc);
      res.send(updatedBooking);
    })

    // delete part from database
    app.delete('/part/:id', verifyJWT, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const query = { _id: ObjectId(id) };
      const result = await partsCollection.deleteOne(query);
      res.send(result);
    })

    // add part in the database
    app.post("/part", verifyJWT, verifyAdmin, async (req, res) => {
      const part = req.body;
      const result = await partsCollection.insertOne(part);
      res.send(result);
    });

    // post review in the database
    app.post("/review", async (req, res) => {
      const review = req.body;
      const result = await reviewCollection.insertOne(review);
      res.send(result);
    });

    // post order in the server
    app.post("/order", async (req, res) => {
      const order = req.body;
      const result = await orderCollection.insertOne(order);
      res.send(result);
    });
  } finally {
  }
}

run().catch(console.dir);

// for testing purpose
app.get("/", (req, res) => {
  res.send("Computers wrold server side running");
});

app.listen(port, () => {
  console.log(`Computers wrold server side running : ${port}`);
});
