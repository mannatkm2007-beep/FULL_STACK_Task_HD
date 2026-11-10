const express = require("express");
const https = require("https");
const cors = require("cors");
const dotenv = require("dotenv");
const path = require("path");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { z } = require("zod");
const { initializeApp } = require("firebase/app");
const {
    getFirestore,
    collection,
    query,
    where,
    getDocs,
    getDoc,
    addDoc,
    updateDoc,
    doc,
    serverTimestamp,
    runTransaction,
    Timestamp
} = require("firebase/firestore");

// Load backend/.env first, then the project root .env (which holds the Firebase keys)
dotenv.config();
dotenv.config({ path: path.join(__dirname, "..", ".env") });

const app = express();

const PORT = 3000;

// --------------------------------------------------
// Middleware
// --------------------------------------------------

// Allow React frontend to communicate with Express
app.use(cors());

// Read form data
app.use(express.urlencoded({ extended: true }));

// Read JSON data from React fetch()
app.use(express.json());

// --------------------------------------------------
// Serve frontend files
// --------------------------------------------------

app.use(express.static(path.join(__dirname, "..")));

// --------------------------------------------------
// SendGrid settings
// --------------------------------------------------

const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;
const FROM_EMAIL = process.env.FROM_EMAIL;

// Check that environment variables exist
if (!SENDGRID_API_KEY || !FROM_EMAIL) {
    console.log("ERROR: SendGrid environment variables are missing.");
}

// --------------------------------------------------
// Home page
// --------------------------------------------------

app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "..", "index.html"));
});

// --------------------------------------------------
// Signup route
// --------------------------------------------------

app.post("/signup", (req, res) => {

    console.log("Received data:", req.body);

    const fname = req.body.firstName;
    const lname = req.body.lastName;
    const email = req.body.email;

    console.log("First Name:", fname);
    console.log("Last Name:", lname);
    console.log("Email:", email);

    // Validate input
    if (!fname || !lname || !email) {
        return res.status(400).json({
            message: "Please provide first name, last name and email."
        });
    }

    // SendGrid email data
    const data = {
        personalizations: [
            {
                to: [
                    {
                        email: email
                    }
                ],
                subject: "Welcome to DEV@Deakin!"
            }
        ],

        from: {
            email: FROM_EMAIL,
            name: "DEV@Deakin"
        },

        content: [
            {
                type: "text/html",
                value: `
                    <h2>Hey ${fname},</h2>

                    <p>
                        Thanks for subscribing to DEV@Deakin!
                    </p>

                    <p>
                        We'll email you whenever a new
                        project or update goes live.
                    </p>

                    <p>
                        — DEV@Deakin
                    </p>
                `
            }
        ]
    };

    const jsondata = JSON.stringify(data);

    // --------------------------------------------------
    // SendGrid API request
    // --------------------------------------------------

    const options = {
        hostname: "api.sendgrid.com",
        path: "/v3/mail/send",
        method: "POST",

        headers: {
            "Authorization": `Bearer ${SENDGRID_API_KEY}`,
            "Content-Type": "application/json",
            "Content-Length": Buffer.byteLength(jsondata)
        }
    };

    const request = https.request(options, (response) => {

        console.log(
            "SendGrid status code:",
            response.statusCode
        );

        let responseBody = "";

        response.on("data", (chunk) => {
            responseBody += chunk;
        });

        response.on("end", () => {

            console.log(
                "SendGrid response:",
                responseBody || "(empty response)"
            );

            // SendGrid returns 202 when the email is accepted
            if (response.statusCode === 202) {

                console.log(
                    "Welcome email accepted successfully!"
                );

                return res.status(202).json({
                    message: `Welcome ${fname}! Your welcome email has been sent.`
                });

            } else {

                console.log(
                    "SendGrid returned an error:",
                    responseBody
                );

                return res.status(500).json({
                    message: "SendGrid could not send the email."
                });
            }
        });
    });

    // --------------------------------------------------
    // Handle HTTPS errors
    // --------------------------------------------------

    request.on("error", (error) => {

        console.log(
            "Error calling SendGrid:",
            error
        );

        return res.status(500).json({
            message: "Could not connect to SendGrid."
        });
    });

    // Send JSON data to SendGrid
    request.write(jsondata);

    // Finish HTTPS request
    request.end();
});

// --------------------------------------------------
// Firebase (normal client SDK) - same Firestore the frontend used in Task P4
// --------------------------------------------------

const firebaseConfig = {
    apiKey: process.env.FIREBASE_API_KEY || process.env.VITE_FIREBASE_API_KEY,
    authDomain: process.env.FIREBASE_AUTH_DOMAIN || process.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET || process.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.FIREBASE_APP_ID || process.env.VITE_FIREBASE_APP_ID
};

const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp);

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
    console.log("ERROR: JWT_SECRET is missing in backend/.env");
}

// --------------------------------------------------
// Validation schemas (Zod)
// --------------------------------------------------

const registerSchema = z.object({
    firstName: z.string().trim().min(1, "First name is required"),
    lastName: z.string().trim().min(1, "Last name is required"),
    email: z.email("Please enter a valid email address"),
    password: z.string().min(8, "Password must be at least 8 characters")
});

const loginSchema = z.object({
    email: z.email("Please enter a valid email address"),
    password: z.string().min(1, "Password is required")
});

const paymentSchema = z.object({
    cardName: z.string().trim().min(2, "Name on card is required"),
    cardNumber: z.string().regex(/^\d{16}$/, "Card number must be 16 digits"),
    expiry: z.string().regex(/^(0[1-9]|1[0-2])\/\d{2}$/, "Expiry must be MM/YY"),
    cvc: z.string().regex(/^\d{3,4}$/, "CVC must be 3 or 4 digits")
});


const tagsSchema = z
    .array(z.string().trim().min(1).max(30))
    .min(1, "Please add at least 1 tag")
    .max(3, "You can add up to 3 tags");

const planField = z.enum(["free", "paid"], "Post plan must be free or paid");

const questionPostSchema = z.object({
    type: z.literal("question"),
    plan: planField,
    title: z.string().trim()
        .min(10, "Title must be at least 10 characters")
        .max(150, "Title must be 150 characters or fewer")
        .regex(/^(how|what|why|when|where|which|who|can|should|is|are|do|does)\b/i,
            "Start your question with how, what, why, etc."),
    body: z.string().trim()
        .min(20, "Please describe your problem in at least 20 characters")
        .max(5000, "Description must be 5000 characters or fewer"),
    tags: tagsSchema
});

const articlePostSchema = z.object({
    type: z.literal("article"),
    plan: planField,
    title: z.string().trim()
        .min(5, "Title must be at least 5 characters")
        .max(120, "Title must be 120 characters or fewer"),
    abstract: z.string().trim()
        .min(20, "Abstract must be at least 20 characters")
        .max(300, "Abstract must be 300 characters or fewer"),
    body: z.string().trim()
        .min(50, "Article text must be at least 50 characters")
        .max(10000, "Article text must be 10000 characters or fewer"),
    tags: tagsSchema
});

const postSchema = z.discriminatedUnion("type", [questionPostSchema, articlePostSchema]);

// --------------------------------------------------
// Helpers
// --------------------------------------------------

// --------------------------------------------------
// Subscription helpers (Free / 7-day trial / Paid)
// --------------------------------------------------

const TRIAL_DAYS = 7;

// Works out what a user can access RIGHT NOW. The result is calculated on
// every request from the stored data, so a trial ends automatically
// without any scheduled job.
//   subscription: "paid"  -> bought Premium
//                 "trial" -> trial still running (gets Premium access)
//                 "free"  -> everything else
function getSubscription(data) {
    const trialEnd = data.trialEndsAt ? data.trialEndsAt.toDate() : null;
    const trialActive = trialEnd !== null && trialEnd.getTime() > Date.now();

    let subscription = "free";
    if (data.plan === "paid") {
        subscription = "paid";
    } else if (trialActive) {
        subscription = "trial";
    }

    return {
        subscription: subscription,
        // "plan" is what decides access: trial users get Premium access
        plan: subscription === "free" ? "free" : "paid",
        trialEndsAt: trialEnd ? trialEnd.toISOString() : null,
        trialUsed: Boolean(data.trialUsed)
    };
}

// Only send safe fields back to the frontend (never the password hash).
// Users created before subscriptions existed have no "plan" field -> Free.
function publicUser(id, data) {
    return {
        id: id,
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        ...getSubscription(data)
    };
}

function signToken(id, email) {
    return jwt.sign({ id: id, email: email }, JWT_SECRET, { expiresIn: "2h" });
}

// Middleware: checks the "Authorization: Bearer <jwt>" header
function verifyToken(req, res, next) {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;

    if (!token) {
        return res.status(401).json({ message: "Not logged in." });
    }

    try {
        req.user = jwt.verify(token, JWT_SECRET);
        next();
    } catch (error) {
        return res.status(401).json({ message: "Session expired. Please log in again." });
    }
}


// Like verifyToken, but a missing/invalid token just means "visitor" (no error).
function optionalToken(req, res, next) {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;

    if (token) {
        try {
            req.user = jwt.verify(token, JWT_SECRET);
        } catch (error) {
            req.user = null;
        }
    }
    next();
}

// --------------------------------------------------
// Register route
// --------------------------------------------------

app.post("/api/register", async (req, res) => {
    const result = registerSchema.safeParse(req.body);

    if (!result.success) {
        return res.status(400).json({ message: result.error.issues[0].message });
    }

    try {
        const email = result.data.email.trim().toLowerCase();

        // Make sure this email isn't already registered
        const existing = await getDocs(
            query(collection(db, "users"), where("email", "==", email))
        );

        if (!existing.empty) {
            return res.status(409).json({
                message: "An account with this email already exists. Please log in."
            });
        }

        // Hash the password (never store plain text)
        const hashedPassword = await bcrypt.hash(result.data.password, 10);

        await addDoc(collection(db, "users"), {
            firstName: result.data.firstName,
            lastName: result.data.lastName,
            email: email,
            password: hashedPassword,
            plan: "free",
            createdAt: serverTimestamp()
        });

        return res.status(201).json({ message: "Account created successfully." });
    } catch (error) {
        console.log("Register error:", error);
        return res.status(500).json({ message: "Something went wrong. Please try again." });
    }
});

// --------------------------------------------------
// Login route -> returns a signed JWT
// --------------------------------------------------

app.post("/api/login", async (req, res) => {
    const result = loginSchema.safeParse(req.body);

    if (!result.success) {
        return res.status(400).json({ message: result.error.issues[0].message });
    }

    try {
        const email = result.data.email.trim().toLowerCase();

        const snapshot = await getDocs(
            query(collection(db, "users"), where("email", "==", email))
        );

        if (snapshot.empty) {
            return res.status(401).json({ message: "Incorrect email or password." });
        }

        const userDoc = snapshot.docs[0];
        const user = userDoc.data();

        const match = await bcrypt.compare(result.data.password, user.password);

        if (!match) {
            return res.status(401).json({ message: "Incorrect email or password." });
        }

        const token = signToken(userDoc.id, user.email);

        return res.json({
            message: "Login successful.",
            token: token,
            user: publicUser(userDoc.id, user)
        });
    } catch (error) {
        console.log("Login error:", error);
        return res.status(500).json({ message: "Something went wrong. Please try again." });
    }
});

// --------------------------------------------------
// Current user (used to restore the session on page refresh)
// --------------------------------------------------

app.get("/api/me", verifyToken, async (req, res) => {
    try {
        const snap = await getDoc(doc(db, "users", req.user.id));

        if (!snap.exists()) {
            return res.status(404).json({ message: "User not found." });
        }

        return res.json({ user: publicUser(snap.id, snap.data()) });
    } catch (error) {
        console.log("Me error:", error);
        return res.status(500).json({ message: "Something went wrong." });
    }
});

// --------------------------------------------------
// Upgrade plan (logged-in Free users only)
// --------------------------------------------------

app.post("/api/upgrade", verifyToken, async (req, res) => {
    const result = paymentSchema.safeParse(req.body);

    if (!result.success) {
        return res.status(400).json({ message: result.error.issues[0].message });
    }

    try {
        const userRef = doc(db, "users", req.user.id);
        const snap = await getDoc(userRef);

        if (!snap.exists()) {
            return res.status(404).json({ message: "User not found." });
        }

        if ((snap.data().plan || "free") === "paid") {
            return res.status(400).json({ message: "You are already on the Paid plan." });
        }

        // Demo only: payment details are validated but NEVER stored.
        await updateDoc(userRef, {
            plan: "paid",
            upgradedAt: serverTimestamp()
        });

        const updated = await getDoc(userRef);

        return res.json({
            message: "Plan upgraded successfully.",
            user: publicUser(updated.id, updated.data())
        });
    } catch (error) {
        console.log("Upgrade error:", error);
        return res.status(500).json({ message: "Something went wrong. Please try again." });
    }
});

// --------------------------------------------------
// Start the 7-day free trial (once per account, Free users only)
// --------------------------------------------------

app.post("/api/trial/start", verifyToken, async (req, res) => {
    try {
        const userRef = doc(db, "users", req.user.id);
        const snap = await getDoc(userRef);

        if (!snap.exists()) {
            return res.status(404).json({ message: "User not found." });
        }

        const data = snap.data();

        if (data.plan === "paid") {
            return res.status(400).json({ message: "You are already on the Paid plan." });
        }
        if (data.trialUsed) {
            return res.status(400).json({ message: "You have already used your free trial." });
        }

        const endsAt = new Date(Date.now() + TRIAL_DAYS * 24 * 60 * 60 * 1000);

        await updateDoc(userRef, {
            trialUsed: true,
            trialStartedAt: serverTimestamp(),
            trialEndsAt: Timestamp.fromDate(endsAt)
        });

        const updated = await getDoc(userRef);

        return res.json({
            message: `Your ${TRIAL_DAYS}-day Premium trial has started.`,
            user: publicUser(updated.id, updated.data())
        });
    } catch (error) {
        console.log("Trial error:", error);
        return res.status(500).json({ message: "Could not start your trial. Please try again." });
    }
});

// --------------------------------------------------
// Create a post (logged-in users only) -> saved in Firestore "posts"
// --------------------------------------------------

app.post("/api/posts", verifyToken, async (req, res) => {
    const result = postSchema.safeParse(req.body);

    if (!result.success) {
        return res.status(400).json({ message: result.error.issues[0].message });
    }

    try {
        // Look the author up so we can store their ID and display name
        const userSnap = await getDoc(doc(db, "users", req.user.id));

        if (!userSnap.exists()) {
            return res.status(401).json({ message: "Account not found. Please log in again." });
        }

        const author = userSnap.data();

        // Only the validated fields are saved (anything extra is dropped by Zod)
        const newPost = {
            ...result.data,
            userId: userSnap.id,
            authorName: `${author.firstName} ${author.lastName}`,
            createdAt: serverTimestamp()
        };

        const ref = await addDoc(collection(db, "posts"), newPost);

        return res.status(201).json({ message: "Post published successfully.", id: ref.id });
    } catch (error) {
        console.log("Create post error:", error);
        return res.status(500).json({ message: "Could not save your post. Please try again." });
    }
});

// --------------------------------------------------
// Browse posts (paginated). The BACKEND decides which posts the caller may see:
//   visitor / Free user -> free posts only
//   Paid user or active trial -> free + paid posts
// Paid posts are never sent to a client that is not allowed to see them.
//
// Query string: ?page=1&limit=10&type=&plan=&tag=&q=&from=YYYY-MM-DD&to=YYYY-MM-DD
// --------------------------------------------------

const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Dates must look like 2026-01-31");

const browseQuerySchema = z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(10),
    type: z.enum(["article", "question"]).optional(),
    plan: z.enum(["free", "paid"]).optional(),
    tag: z.string().trim().max(30).optional(),
    q: z.string().trim().max(100).optional(),
    from: dateString.optional(),
    to: dateString.optional()
});

// Turns a Firestore post document into the JSON the frontend receives
function serializePost(id, data) {
    return {
        id: id,
        type: data.type,
        plan: data.plan,
        title: data.title,
        abstract: data.abstract || "",
        body: data.body,
        tags: data.tags || [],
        authorName: data.authorName || "Unknown",
        likeCount: data.likeCount || 0,
        createdAt: data.createdAt ? data.createdAt.toDate().toISOString() : null
    };
}

app.get("/api/posts", optionalToken, async (req, res) => {
    const parsed = browseQuerySchema.safeParse(req.query);

    if (!parsed.success) {
        return res.status(400).json({ message: parsed.error.issues[0].message });
    }

    const { page, limit, type, plan: planFilter, tag, q, from, to } = parsed.data;

    try {
        let sub = { plan: "free", subscription: "free" };

        if (req.user) {
            // Read the plan from Firestore (not the JWT) so upgrades/trials apply immediately
            const userSnap = await getDoc(doc(db, "users", req.user.id));
            if (userSnap.exists()) {
                sub = getSubscription(userSnap.data());
            }
        }

        // Step 1: fetch ONLY what this viewer is allowed to see
        const postsRef = collection(db, "posts");
        const snapshot = sub.plan === "paid"
            ? await getDocs(postsRef)
            : await getDocs(query(postsRef, where("plan", "==", "free")));

        let posts = snapshot.docs.map((d) => serializePost(d.id, d.data()));

        // Newest first (sorted here to avoid needing a Firestore composite index)
        posts.sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));

        // Tags available to this viewer (before filtering) so the dropdown stays complete
        const availableTags = [...new Set(posts.flatMap((p) => p.tags))]
            .sort((a, b) => a.localeCompare(b));

        // Step 2: apply the user's filters
        const search = (q || "").toLowerCase();
        const fromDate = from ? new Date(from + "T00:00:00.000Z") : null;
        const toDate = to ? new Date(to + "T23:59:59.999Z") : null;

        posts = posts.filter((p) => {
            if (type && p.type !== type) return false;
            if (planFilter && p.plan !== planFilter) return false;
            if (tag && !p.tags.includes(tag)) return false;
            if (search && !`${p.title} ${p.abstract} ${p.body}`.toLowerCase().includes(search)) return false;
            const created = p.createdAt ? new Date(p.createdAt) : new Date();
            if (fromDate && created < fromDate) return false;
            if (toDate && created > toDate) return false;
            return true;
        });

        // Step 3: cut out the requested page
        const total = posts.length;
        const start = (page - 1) * limit;
        const pagePosts = posts.slice(start, start + limit);

        // Step 4: tell a logged-in user which posts on this page they already liked
        let likedIds = new Set();
        if (req.user && pagePosts.length > 0) {
            const likeDocs = await Promise.all(
                pagePosts.map((p) => getDoc(doc(db, "likes", `${p.id}_${req.user.id}`)))
            );
            likedIds = new Set(
                pagePosts.filter((p, i) => likeDocs[i].exists()).map((p) => p.id)
            );
        }

        return res.json({
            plan: sub.plan,
            subscription: sub.subscription,
            posts: pagePosts.map((p) => ({ ...p, likedByMe: likedIds.has(p.id) })),
            tags: availableTags,
            page: page,
            limit: limit,
            total: total,
            hasMore: start + limit < total
        });
    } catch (error) {
        console.log("Browse posts error:", error);
        return res.status(500).json({ message: "Could not load posts. Please try again." });
    }
});

// --------------------------------------------------
// Real-time notifications (Server-Sent Events)
// --------------------------------------------------

// userId -> set of open response streams (one user can have several tabs open)
const notificationClients = new Map();

function sendToUser(userId, eventName, payload) {
    const streams = notificationClients.get(userId);
    if (!streams) return;

    for (const stream of streams) {
        stream.write(`event: ${eventName}\ndata: ${JSON.stringify(payload)}\n\n`);
    }
}

// Saves a notification in Firestore (so it is still there after a refresh)
// and instantly pushes it to the user if they are online.
async function notifyUser(userId, details) {
    const ref = await addDoc(collection(db, "notifications"), {
        userId: userId,
        read: false,
        createdAt: serverTimestamp(),
        ...details
    });

    sendToUser(userId, "notification", {
        id: ref.id,
        read: false,
        createdAt: new Date().toISOString(),
        ...details
    });
}

function serializeNotification(id, data) {
    return {
        id: id,
        type: data.type,
        postId: data.postId,
        postTitle: data.postTitle,
        fromName: data.fromName,
        read: Boolean(data.read),
        createdAt: data.createdAt ? data.createdAt.toDate().toISOString() : new Date().toISOString()
    };
}

// The open connection the browser listens on
app.get("/api/notifications/stream", verifyToken, (req, res) => {
    res.set({
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        "Connection": "keep-alive",
        "X-Accel-Buffering": "no"
    });
    res.flushHeaders();
    res.write(": connected\n\n");

    const userId = req.user.id;
    if (!notificationClients.has(userId)) {
        notificationClients.set(userId, new Set());
    }
    notificationClients.get(userId).add(res);

    // A comment line every 25s stops proxies from closing an idle connection
    const heartbeat = setInterval(() => res.write(": ping\n\n"), 25000);

    req.on("close", () => {
        clearInterval(heartbeat);
        const streams = notificationClients.get(userId);
        if (streams) {
            streams.delete(res);
            if (streams.size === 0) notificationClients.delete(userId);
        }
    });
});

// Notification history for the dashboard
app.get("/api/notifications", verifyToken, async (req, res) => {
    try {
        const snapshot = await getDocs(
            query(collection(db, "notifications"), where("userId", "==", req.user.id))
        );

        const notifications = snapshot.docs
            .map((d) => serializeNotification(d.id, d.data()))
            .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
            .slice(0, 50);

        return res.json({
            notifications: notifications,
            unread: notifications.filter((n) => !n.read).length
        });
    } catch (error) {
        console.log("Notifications error:", error);
        return res.status(500).json({ message: "Could not load notifications." });
    }
});

// Mark everything as read
app.post("/api/notifications/read", verifyToken, async (req, res) => {
    try {
        const snapshot = await getDocs(
            query(
                collection(db, "notifications"),
                where("userId", "==", req.user.id),
                where("read", "==", false)
            )
        );

        await Promise.all(snapshot.docs.map((d) => updateDoc(d.ref, { read: true })));

        return res.json({ message: "All notifications marked as read." });
    } catch (error) {
        console.log("Mark read error:", error);
        return res.status(500).json({ message: "Could not update notifications." });
    }
});

// --------------------------------------------------
// Likes. POST toggles: like if not liked yet, otherwise remove the like.
// A Firestore transaction keeps the count correct even if two people
// like the same post at the same moment.
// --------------------------------------------------

app.post("/api/posts/:id/like", verifyToken, async (req, res) => {
    const postId = req.params.id;
    const userId = req.user.id;

    try {
        const userSnap = await getDoc(doc(db, "users", userId));
        if (!userSnap.exists()) {
            return res.status(401).json({ message: "Account not found. Please log in again." });
        }
        const liker = userSnap.data();

        const postRef = doc(db, "posts", postId);
        const likeRef = doc(db, "likes", `${postId}_${userId}`);

        const outcome = await runTransaction(db, async (transaction) => {
            const postSnap = await transaction.get(postRef);
            if (!postSnap.exists()) {
                return { status: 404, message: "Post not found." };
            }

            const post = postSnap.data();

            // You cannot like a Premium post you are not allowed to see
            if (post.plan === "paid" && getSubscription(liker).plan !== "paid") {
                return { status: 403, message: "This post is for Premium members." };
            }

            const likeSnap = await transaction.get(likeRef);
            const currentCount = post.likeCount || 0;

            if (likeSnap.exists()) {
                const newCount = Math.max(0, currentCount - 1);
                transaction.delete(likeRef);
                transaction.update(postRef, { likeCount: newCount });
                return { status: 200, liked: false, likeCount: newCount, post: post };
            }

            transaction.set(likeRef, { postId: postId, userId: userId, createdAt: serverTimestamp() });
            transaction.update(postRef, { likeCount: currentCount + 1 });
            return { status: 200, liked: true, likeCount: currentCount + 1, post: post };
        });

        if (outcome.status !== 200) {
            return res.status(outcome.status).json({ message: outcome.message });
        }

        // Tell the author (but not when they like their own post)
        if (outcome.liked && outcome.post.userId !== userId) {
            await notifyUser(outcome.post.userId, {
                type: "like",
                postId: postId,
                postTitle: outcome.post.title,
                fromName: `${liker.firstName} ${liker.lastName}`
            });
        }

        return res.json({ liked: outcome.liked, likeCount: outcome.likeCount });
    } catch (error) {
        console.log("Like error:", error);
        return res.status(500).json({ message: "Could not update your like. Please try again." });
    }
});

// --------------------------------------------------
// Start Express server
// --------------------------------------------------

app.listen(PORT, () => {

    console.log(
        `Express server running at http://localhost:${PORT}`
    );

});