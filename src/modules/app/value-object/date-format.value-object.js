exports.default = class DateFormatValueObject {
    constructor(value) {
        this.value = value
        this.validate()
    }

    validate() {
        if(!this.value) {
            throw new Error("Date arguments cannot be empty")
        }
        if(typeof this.value !== "string") {
            throw new Error("Date arguments must be a string")
        }
        if(!/\d{4}-\d{2}-\d{2}/.test(this.value)) {
            throw new Error("Date format is not valid")
        }
    }
}