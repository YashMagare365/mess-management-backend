require("dotenv").config();
const express = require("express");
const Razorpay = require("razorpay");
const cors = require("cors");
const bodyParser = require("body-parser");

const admin = require("firebase-admin");
const serviceAccount = require("./mess-management-609b4-firebase-adminsdk.json");

// 🔥 Initialize Firebase Admin SDK
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL:
    "https://mess-management-609b4-default-rtdb.asia-southeast1.firebasedatabase.app", // Your RTDB URL
});

const auth = admin.auth();
const db = admin.database();

const app = express();
const PORT = process.env.PORT || 5000;

// 🔧 Middleware
app.use(cors());
app.use(bodyParser.json());

// 🏦 Initialize Razorpay instance
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

/**
 * ✅ Function to Set User as Admin
 */
const setAdmin = async (uid) => {
  try {
    await auth.setCustomUserClaims(uid, { admin: true });
    console.log(`✅ Admin role assigned to UID: ${uid}`);
  } catch (error) {
    console.error("❌ Error setting admin:", error);
  }
};

// 📌 Route to sign up a new admin
app.post("/signup", async (req, res) => {
  try {
    const { email, password, displayName } = req.body;

    if (!email || !password || !displayName) {
      return res.status(400).json({ error: "All fields are required!" });
    }

    // 🔹 Create user in Firebase Authentication
    const userRecord = await auth.createUser({
      email,
      password,
      displayName,
    });

    // 🔹 Assign admin privileges
    await setAdmin(userRecord.uid);

    // 🔹 Store in Firebase RTDB under /admins
    await db.ref(`/admins/${userRecord.uid}`).set({
      email,
      displayName,
      createdAt: new Date().toISOString(),
    });

    res.status(201).json({
      message: "✅ Admin created successfully!",
      uid: userRecord.uid,
      email: userRecord.email,
    });
  } catch (error) {
    console.error("❌ Error signing up:", error);
    res.status(500).json({ error: error.message });
  }
});

// 📌 Create Order API (Razorpay)
app.post("/create-order", async (req, res) => {
  try {
    const { amount, currency = "INR", receipt } = req.body;

    if (!amount || !receipt) {
      return res.status(400).json({ error: "Amount and receipt are required" });
    }

    const options = {
      amount: amount * 100, // Convert to paise
      currency,
      receipt,
      payment_capture: 1, // Auto-capture payment
    };

    const order = await razorpay.orders.create(options);

    res.json({
      success: true,
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
    });
  } catch (error) {
    console.error("❌ Error creating order:", error);
    res.status(500).json({ success: false, error: "Failed to create order" });
  }
});

// 📌 Test Route
app.get("/", (req, res) => {
  res.send("🔥 Mess Management Backend is Running!");
});

// 🚀 Start Server
app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
});
