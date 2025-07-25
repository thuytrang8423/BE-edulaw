require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const swaggerUi = require("swagger-ui-express");
const swaggerDocument = require("./swagger.json");
const http = require("http");
const ChatRoomController = require("./controllers/ChatRoomController");
const answerRoutes = require("./routes/answer");

const app = express();
const server = http.createServer(app);
const { Server } = require("socket.io");
const io = new Server(server, { cors: { origin: "*" } });
app.set("io", io);

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);
  socket.on("send_question", async (data) => {
    try {
      const req = { body: data };
      let sent = false;
      const res = {
        status: (code) => ({
          json: (result) => {
            if (!sent) {
              socket.emit("receive_answer", { status: code, ...result });
              sent = true;
            }
          },
        }),
        json: (result) => {
          if (!sent) {
            socket.emit("receive_answer", { status: 200, ...result });
            sent = true;
          }
        },
      };
      await ChatRoomController.sendMessage(req, res);
    } catch (err) {
      socket.emit("receive_answer", { status: 500, error: err.message });
    }
  });
});

const authRoutes = require("./routes/auth");
const questionRoutes = require("./routes/question");
const legalDocumentRoutes = require("./routes/legalDocs");
const legalClauseRoutes = require("./routes/legalClauses");
const notificationRoutes = require("./routes/notifications");
const feedbackRoutes = require("./routes/feedbacks");
const chatRoomRoutes = require("./routes/chatRoom");
const profileRoutes = require("./routes/Profile");
// Middleware
app.use(helmet());
app.use(cors({ origin: "*" }));
app.use(express.json());
app.use(morgan("dev"));

// Connect to MongoDB
mongoose
  .connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("MongoDB connected"))
  .catch((err) => {
    console.error("MongoDB connection error:", err);
    process.exit(1);
  });

// Routes
app.use("/api/auth", authRoutes);
app.use("/api", profileRoutes);
app.use("/api/questions", questionRoutes);
app.use("/api/legal-docs", legalDocumentRoutes);
app.use("/api/legal-clauses", legalClauseRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/feedbacks", feedbackRoutes);
app.use("/api/chat-room", chatRoomRoutes);
app.use("/api", answerRoutes);
// Swagger UI
app.use("/api/docs", swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// Health check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

// 404 handler
app.use((req, res, next) => {
  res.status(404).json({ message: "Not found" });
});

// Error handler
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);
  res.status(500).json({ message: "Internal server error" });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Swagger running on http://localhost:${PORT}/api/docs`);
});
