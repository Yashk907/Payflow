import { NextFunction, Request, Response } from "express";
import { paginationSchema } from "../db/schemas/validationSchemas.js";
import { success } from "zod";
import { error } from "node:console";

export const validatePagination = async (req : Request,res : Response,next : NextFunction)=>{
    const validate = paginationSchema.parse(req.query); 
    res.locals.pagination = {
        page : validate.page,
        limit : validate.limit
    };
    next()
}