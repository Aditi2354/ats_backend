/**This middleware verifies the JWT authentication token,
from the request header to ensure that the user is authorized before accessing protected routes. */
import jwt from "jsonwebtoken";

export function authenticateToken(req,res,next){
    const JWT_SECRET = process.env.JWT_SECRET || "supersecretkey";

    const authHeader = req.headers.authorization;

    if(!authHeader){
        return res.status(401).json({error:"Token required"});
    }

    const token = authHeader.split(" ")[1];

    try{
        const decoded = jwt.verify(token,JWT_SECRET);
        req.user = decoded;
        next();
    }
    catch(err){
        return res.status(403).json({error:"Invalid token"});
    }
}