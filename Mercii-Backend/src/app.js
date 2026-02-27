require('dotenv').config();
var express = require('express');
var path = require('path');
const morgan = require("morgan");
var cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const cors = require('cors');
const bodyParser = require('body-parser');
const fileUpload = require('express-fileupload');
var passport = require('passport');
const { getJwtStrategy } = require('./config/passport');
const globalErrorHandler = require('../src/middlewares/globalError');
const { connectDb } = require('./config/database');
const router = express.Router();
const mainRoutes = require("./routes/index");
const logger = require('../src/utils/logger')
var app = express();
const transactionRoutes = require('./routes/transaction');
const bonusRoutes = require('./routes/bonus');
const healthRoutes = require('./routes/health');
const dashboardRoutes = require('./routes/dashboard');
const simpleAuthRoutes = require('./routes/simpleAuth');

// Set up the Express app
const corsOrigin = process.env.CORS_ORIGIN || 'http://localhost:3001';
app.use(cors({
  origin: [corsOrigin, 'http://localhost:3001'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use(fileUpload());
app.use(bodyParser.json({ limit: '5mb' }));

const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    message: 'Too many requests',
    standardHeaders: true,
    legacyHeaders: false,
});

// app.use(limiter)
app.use(helmet());
app.use(
    morgan(
        ":method :url :status :res[content-length] - :response-time ms",
        {
            stream: {
                write: (message) => logger.info(message.trim()),
            },
        }
    )
);
// Set up the database connection
connectDb();


// Use the routes
app.use("/api/v1/", mainRoutes(router));
app.use('/api/transaction', transactionRoutes);
app.use('/api/v1/bonus', bonusRoutes);
app.use('/api/v1/health', healthRoutes);
app.use('/dashboard', dashboardRoutes);
app.use('/api/v1/admin/auth', simpleAuthRoutes);
const adminRouter = express.Router();
const adminRoutes = require('./routes/admin');
app.use('/api/v1/admin', adminRoutes(adminRouter));
app.use('/api/v1/admin/infrastructure', require('./routes/adminInfrastructure'));
app.use('/api/v1/admin/integration', require('./routes/adminIntegration'));
app.use('/api/v1/admin/notifications', require('./routes/adminNotifications'));
app.use(passport.initialize());
passport.use(getJwtStrategy());

app.use(globalErrorHandler);

// Serve React frontend
const frontendBuildPath = path.join(__dirname, '../../mercii-admin/build');
app.use(express.static(frontendBuildPath));
app.get('*', (req, res) => {
  res.sendFile(path.join(frontendBuildPath, 'index.html'));
});

module.exports = app;
