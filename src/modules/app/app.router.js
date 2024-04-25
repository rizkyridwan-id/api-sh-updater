const router = require("express").Router()
const AppService = require("./app.service")
const zodValidator = require("../../middleware/zod-validator.middleware")
const {UpdateAppRequestDto} = require("./app.zod")

const appService = new AppService()

router.get("/app", (req, res) => appService.getAppNames(req, res))
router.get("/app/update-queue", (req, res) => appService.getUpdateQueue(req, res))
router.post("/app/git-log", (req, res) => appService.showGitLog(req, res))
router.post("/app/update", zodValidator(UpdateAppRequestDto), (req, res) => appService.updateApp(req, res))
router.post("/app/update-history", (req, res) => appService.getUpdateHistory(req, res))
module.exports = router