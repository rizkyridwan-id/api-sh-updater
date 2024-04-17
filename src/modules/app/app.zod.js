const z = require("zod")

const UpdateAppRequestDto = z.object({
    name: z.string(),
    branchBe: z.string().optional(),
    branchFe: z.string().optional()
})

exports.UpdateAppRequestDto = UpdateAppRequestDto