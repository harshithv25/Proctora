const express = require('express');
const authRouter = require('../modules/auth/router');
const examConfigRouter = require('../modules/examConfig/router');
const examDeliveryRouter = require('../modules/examDelivery/router');
const integrityMonitoringRouter = require('../modules/integrityMonitoring/router');
const evaluationExportRouter = require('../modules/evaluationExport/router');

const router = express.Router();

// Mount all DFD module routers — matches plan Section 2 & 11 route map
router.use('/auth', authRouter);
router.use('/exams', examConfigRouter);
router.use('/delivery', examDeliveryRouter);
router.use('/monitoring', integrityMonitoringRouter);
router.use('/evaluation', evaluationExportRouter);

module.exports = router;
