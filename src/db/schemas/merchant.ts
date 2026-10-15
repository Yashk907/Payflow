import {z} from 'zod'

const merchantSchema = z.object({
    name : z.string().trim().min(2).max(100),
    email : z.email().toLowerCase(),
    password : z.string().min(8).refine((p)=>Buffer.byteLength(p,'utf-8')<=72,{
        message : "Password must be at most 72 bytes"
    })
})

export default merchantSchema;