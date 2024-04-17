const zodValidatorMiddleware = (schema) => (req, res, next) => {
    try {
        schema.parse(req.body)
        next()
    } catch (error) {
        res.status(400).send(error)
    }
}

module.exports = zodValidatorMiddleware