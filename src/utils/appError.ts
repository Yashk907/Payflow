
export class AppError extends Error{
    public status : number;
    public code :string;

    constructor(status : number,code : string,message : string){
        super(message)
        this.name = "AppError"
        this.status = status
        this.code = code

        Error.captureStackTrace(this,this.constructor)
    }
}